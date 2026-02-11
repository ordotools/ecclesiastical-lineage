from flask import render_template, request, redirect, url_for, flash, session, jsonify, make_response, current_app
from models import db, Clergy, Rank, Organization, User, ClergyComment, Ordination, Consecration, Status, clergy_statuses
from utils import log_audit_event
from datetime import datetime
import json
import threading
from .image_upload import get_image_upload_service

# Background task status tracking
_sprite_sheet_status = {}
_sprite_sheet_lock = threading.Lock()

def _regenerate_sprite_sheet():
    """Helper function to regenerate the sprite sheet after clergy changes"""
    try:
        image_upload_service = get_image_upload_service()
        if not image_upload_service.backblaze_configured:
            return

        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        if not all_clergy:
            return

        result = image_upload_service.create_sprite_sheet(all_clergy)
        
        if result['success']:
            current_app.logger.info("Sprite sheet regenerated: %s (saved to database)", result['url'])
        else:
            current_app.logger.warning("Failed to regenerate sprite sheet: %s", result.get('error', 'Unknown error'))
    except Exception as e:
        current_app.logger.exception("Error in sprite sheet regeneration")

def _regenerate_sprite_sheet_background(clergy_id=None):
    """Regenerate sprite sheet in background thread"""
    app = current_app._get_current_object()

    def background_task():
        try:
            with app.app_context():
                with _sprite_sheet_lock:
                    _sprite_sheet_status['status'] = 'in_progress'
                    _sprite_sheet_status['clergy_id'] = clergy_id
                    _sprite_sheet_status['started_at'] = datetime.utcnow().isoformat()

                image_upload_service = get_image_upload_service()
                if not image_upload_service.backblaze_configured:
                    with _sprite_sheet_lock:
                        _sprite_sheet_status['status'] = 'error'
                        _sprite_sheet_status['error'] = 'Backblaze B2 not configured'
                    return

                all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
                if not all_clergy:
                    with _sprite_sheet_lock:
                        _sprite_sheet_status['status'] = 'error'
                        _sprite_sheet_status['error'] = 'No clergy found'
                    return

                result = image_upload_service.create_sprite_sheet(all_clergy)
                
                if result['success']:
                    with _sprite_sheet_lock:
                        _sprite_sheet_status['status'] = 'completed'
                        _sprite_sheet_status['sprite_sheet_id'] = result.get('sprite_sheet_id')
                        _sprite_sheet_status['url'] = result.get('url')
                        _sprite_sheet_status['mapping'] = result.get('mapping', {})
                        _sprite_sheet_status['completed_at'] = datetime.utcnow().isoformat()
                    current_app.logger.info("Sprite sheet regenerated in background: %s", result['url'])
                else:
                    with _sprite_sheet_lock:
                        _sprite_sheet_status['status'] = 'error'
                        _sprite_sheet_status['error'] = result.get('error', 'Unknown error')
                    current_app.logger.warning("Failed to regenerate sprite sheet: %s", result.get('error', 'Unknown error'))
        except Exception as e:
            with _sprite_sheet_lock:
                _sprite_sheet_status['status'] = 'error'
                _sprite_sheet_status['error'] = str(e)
            current_app.logger.exception("Error in background sprite sheet regeneration")

    thread = threading.Thread(target=background_task, daemon=True)
    thread.start()
    return True

def get_sprite_sheet_status():
    """Get current sprite sheet generation status"""
    with _sprite_sheet_lock:
        return _sprite_sheet_status.copy()

def set_clergy_display_name(clergy):
    """Set the display name for a clergy member based on their rank and papal name."""
    if clergy.rank.lower() == 'pope':
        # For popes, use papal name if available, otherwise use regular name
        display_name = clergy.papal_name if clergy.papal_name else clergy.name
        clergy.display_name = f"His Holiness {display_name}"
    elif clergy.rank.lower() == 'cardinal':
        # For cardinals, use "first name Cardinal last name" format
        name_parts = clergy.name.split()
        if len(name_parts) >= 2:
            first_name = name_parts[0]
            last_name = ' '.join(name_parts[1:])
            clergy.display_name = f"{first_name} Cardinal {last_name}"
        else:
            clergy.display_name = f"His Eminence {clergy.name}"
    elif clergy.rank.lower() in ['bishop', 'archbishop']:
        clergy.display_name = f"Most. Rev. {clergy.name}"
    elif clergy.rank.lower() == 'priest':
        clergy.display_name = f"Rev. {clergy.name}"
    else:
        clergy.display_name = clergy.name

def create_clergy_from_form(form):
    clergy = Clergy()
    clergy.name = form.get('name')
    clergy.rank = form.get('rank')
    clergy.papal_name = form.get('papal_name')
    clergy.organization = form.get('organization')
    date_of_birth = form.get('date_of_birth')
    date_of_death = form.get('date_of_death')
    clergy.notes = form.get('notes')
    if date_of_birth:
        clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
    if date_of_death:
        clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()

    image_data_json = form.get('image_data_json')
    processed_image_data = form.get('processed_image_data')
    file_upload = None
    if 'clergy_image' in form and hasattr(form['clergy_image'], 'filename') and form['clergy_image'].filename:
        file_upload = form['clergy_image']

    db.session.add(clergy)
    db.session.flush()

    try:
        image_upload_service = get_image_upload_service()
        
        if image_data_json:
            try:
                image_data = json.loads(image_data_json)
                original_url = image_data.get('original')
                if not original_url:
                    try:
                        response = image_upload_service.s3_client.list_objects_v2(
                            Bucket=image_upload_service.bucket_name,
                            Prefix=f"clergy/{clergy.id}/"
                        )
                        for obj in response.get('Contents', []):
                            key = obj['Key']
                            if 'original_' in key and 'lineage_' not in key and 'detail_' not in key:
                                    original_url = image_upload_service.config.get_public_url(key)
                                    image_data['original'] = original_url
                                    break
                    except Exception as e:
                        current_app.logger.debug("Could not find original in storage: %s", e)

                if original_url:
                    clergy.image_url = original_url
                else:
                    current_app.logger.warning(
                        "No original URL found, using detail as fallback for clergy.image_url (clergy_id=%s)",
                        clergy.id,
                    )
                    clergy.image_url = image_data.get('detail', image_data.get('lineage', ''))

                clergy.image_data = json.dumps(image_data)
            except json.JSONDecodeError as e:
                current_app.logger.warning("Failed to parse image data JSON: %s", e)

        elif file_upload:
            result = image_upload_service.upload_original_image(file_upload, clergy.id)
            
            if result['success']:
                clergy.image_url = result['url']
                clergy.image_data = json.dumps(result['image_data'])
            else:
                current_app.logger.warning(
                    "Failed to upload original image for clergy %s: %s",
                    clergy.id, result['error'],
                )

        elif processed_image_data:
            image_url = image_upload_service.upload_image_from_base64(processed_image_data, clergy.id, 'original')
            if image_url:
                clergy.image_url = image_url
            else:
                current_app.logger.warning("Failed to upload single image for clergy %s", clergy.id)

    except Exception as e:
        current_app.logger.exception("Error processing images for clergy %s", clergy.id)

    create_ordinations_from_form(clergy, form)
    create_consecrations_from_form(clergy, form)

    status_ids = form.getlist('status_ids[]') or form.getlist('status_ids')
    if status_ids:
        for status_id in status_ids:
            if status_id:  # Skip empty values
                try:
                    status = Status.query.get(int(status_id))
                    if status:
                        clergy.statuses.append(status)
                except (ValueError, TypeError):
                    pass  # Skip invalid status IDs
    
    db.session.commit()

    try:
        _regenerate_sprite_sheet_background(clergy.id)
    except Exception as e:
        current_app.logger.warning("Failed to start background sprite sheet generation: %s", e)

    return clergy

def create_ordinations_from_form(clergy, form):
    """Create ordination records from form data"""
    ordinations_data = {}

    for key, value in form.items():
        if key.startswith('ordinations[') and ']' in key:
            import re
            match = re.match(r'ordinations\[(\d+)\]\[([^\]]+)\]', key)
            if match:
                index_part = match.group(1)
                field_part = match.group(2)
                
                if index_part not in ordinations_data:
                    ordinations_data[index_part] = {}
                ordinations_data[index_part][field_part] = value
    
    # Create ordination records
    for index, data in ordinations_data.items():
        date_val = (data.get('date') or '').strip()
        date_unknown = data.get('date_unknown') in ('1', 'true', 'on')
        year_val = (data.get('year') or '').strip()
        if not date_val and not date_unknown:
            continue
        ordination = Ordination()
        ordination.clergy_id = clergy.id
        if date_val:
            ordination.date = datetime.strptime(date_val, '%Y-%m-%d').date()
            ordination.year = None
        else:
            ordination.date = None
            try:
                ordination.year = int(year_val) if year_val else None
            except (ValueError, TypeError):
                ordination.year = None
        
        ordination.is_sub_conditione = data.get('is_sub_conditione') == 'on'
        ordination.is_doubtful_event = data.get('is_doubtful_event') == 'on'
        
        # Handle validity dropdown
        validity = data.get('validity', 'valid')
        ordination.is_doubtfully_valid = (validity == 'doubtfully_valid')
        ordination.is_invalid = (validity == 'invalid')
        
        ordination.notes = data.get('notes', '')
        
        # Handle ordaining bishop
        ordaining_bishop_id = data.get('ordaining_bishop_id')
        ordaining_bishop_input = data.get('ordaining_bishop_input')
        if ordaining_bishop_id and ordaining_bishop_id != 'None':
            ordination.ordaining_bishop_id = int(ordaining_bishop_id)
        elif ordaining_bishop_input:
            # Check if bishop exists by name
            existing = Clergy.query.filter_by(name=ordaining_bishop_input.strip()).first()
            if existing:
                ordination.ordaining_bishop_id = existing.id
            else:
                # Auto-create missing ordaining bishop
                new_bishop = Clergy(name=ordaining_bishop_input.strip(), rank='Bishop')
                db.session.add(new_bishop)
                db.session.flush()
                ordination.ordaining_bishop_id = new_bishop.id
        
        db.session.add(ordination)

def create_consecrations_from_form(clergy, form):
    """Create consecration records from form data"""
    consecrations_data = {}
    
    # Parse consecration data from form
    for key, value in form.items():
        if key.startswith('consecrations[') and ']' in key:
            # Extract index and field name from pattern like "consecrations[1][date]" or "consecrations[1][co_consecrators][1][id]"
            import re
            
            # Check for co-consecrators pattern first
            co_match = re.match(r'consecrations\[(\d+)\]\[co_consecrators\]\[(\d+)\]\[([^\]]+)\]', key)
            if co_match:
                index_part = co_match.group(1)
                co_index = co_match.group(2)
                co_field = co_match.group(3)
                
                if index_part not in consecrations_data:
                    consecrations_data[index_part] = {}
                if 'co_consecrators' not in consecrations_data[index_part]:
                    consecrations_data[index_part]['co_consecrators'] = {}
                if co_index not in consecrations_data[index_part]['co_consecrators']:
                    consecrations_data[index_part]['co_consecrators'][co_index] = {}
                consecrations_data[index_part]['co_consecrators'][co_index][co_field] = value
            else:
                # Regular consecration field
                match = re.match(r'consecrations\[(\d+)\]\[([^\]]+)\]', key)
                if match:
                    index_part = match.group(1)
                    field_part = match.group(2)
                    
                    if index_part not in consecrations_data:
                        consecrations_data[index_part] = {}
                    consecrations_data[index_part][field_part] = value
    
    # Create consecration records
    for index, data in consecrations_data.items():
        date_val = (data.get('date') or '').strip()
        date_unknown = data.get('date_unknown') in ('1', 'true', 'on')
        year_val = (data.get('year') or '').strip()
        if not date_val and not date_unknown:
            continue
        consecration = Consecration()
        consecration.clergy_id = clergy.id
        if date_val:
            consecration.date = datetime.strptime(date_val, '%Y-%m-%d').date()
            consecration.year = None
        else:
            consecration.date = None
            try:
                consecration.year = int(year_val) if year_val else None
            except (ValueError, TypeError):
                consecration.year = None
        
        consecration.is_sub_conditione = data.get('is_sub_conditione') == 'on'
        consecration.is_doubtful_event = data.get('is_doubtful_event') == 'on'
        
        # Handle validity dropdown
        validity = data.get('validity', 'valid')
        consecration.is_doubtfully_valid = (validity == 'doubtfully_valid')
        consecration.is_invalid = (validity == 'invalid')
        
        consecration.notes = data.get('notes', '')
        
        # Handle consecrator
        consecrator_id = data.get('consecrator_id')
        consecrator_input = data.get('consecrator_input')
        if consecrator_id and consecrator_id != 'None':
            consecration.consecrator_id = int(consecrator_id)
        elif consecrator_input:
            # Check if bishop exists by name
            existing = Clergy.query.filter_by(name=consecrator_input.strip()).first()
            if existing:
                consecration.consecrator_id = existing.id
            else:
                # Auto-create missing consecrator
                new_bishop = Clergy(name=consecrator_input.strip(), rank='Bishop')
                db.session.add(new_bishop)
                db.session.flush()
                consecration.consecrator_id = new_bishop.id
        
        db.session.add(consecration)
        db.session.flush()  # Get the ID for co-consecrators
        
        # Handle co-consecrators
        co_consecrators_data = data.get('co_consecrators', {})
        for co_index, co_data in co_consecrators_data.items():
            co_consecrator_id = co_data.get('id')
            co_consecrator_input = co_data.get('input')
            if co_consecrator_id and co_consecrator_id != 'None':
                # Add to many-to-many relationship
                co_consecrator = Clergy.query.get(int(co_consecrator_id))
                if co_consecrator:
                    consecration.co_consecrators.append(co_consecrator)
            elif co_consecrator_input:
                # Check if bishop exists by name
                existing = Clergy.query.filter_by(name=co_consecrator_input.strip()).first()
                if existing:
                    consecration.co_consecrators.append(existing)
                else:
                    # Auto-create missing co-consecrator
                    new_bishop = Clergy(name=co_consecrator_input.strip(), rank='Bishop')
                    db.session.add(new_bishop)
                    db.session.flush()
                    consecration.co_consecrators.append(new_bishop)

def update_ordinations_from_form(clergy, form):
    """Update ordination records from form data (for editing)"""
    # Clear existing ordinations
    Ordination.query.filter_by(clergy_id=clergy.id).delete()
    
    # Create new ordinations from form data
    create_ordinations_from_form(clergy, form)

def update_consecrations_from_form(clergy, form):
    """Update consecration records from form data (for editing)"""
    # Clear existing consecrations and their co-consecrators
    existing_consecrations = Consecration.query.filter_by(clergy_id=clergy.id).all()
    for consecration in existing_consecrations:
        consecration.co_consecrators.clear()
        db.session.delete(consecration)
    
    # Create new consecrations from form data
    create_consecrations_from_form(clergy, form)

def clergy_list_handler():
    if 'user_id' not in session:
        flash('Please log in to access clergy records.', 'error')
        return redirect(url_for('auth.login'))
    exclude_priests = request.args.get('exclude_priests') == '1'
    exclude_coconsecrators = request.args.get('exclude_coconsecrators') == '1'
    exclude_organizations = request.args.getlist('exclude_organizations')
    search = request.args.get('search', '').strip()
    query = Clergy.query.filter(Clergy.is_deleted != True)  # Exclude deleted records by default
    if exclude_priests:
        query = query.filter(Clergy.rank != 'Priest')
    if exclude_coconsecrators:
        all_clergy = Clergy.query.all()
        coconsecrator_ids = set()
        for c in all_clergy:
            for consecration in c.consecrations:
                for co_consecrator in consecration.co_consecrators:
                    coconsecrator_ids.add(co_consecrator.id)
        if coconsecrator_ids:
            query = query.filter(~Clergy.id.in_(coconsecrator_ids))
    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))
    if search:
        query = query.filter(Clergy.name.ilike(f'%{search}%'))
    clergy_list = query.all()
    for clergy in clergy_list:
        set_clergy_display_name(clergy)
    organizations = Organization.query.order_by(Organization.name).all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    ranks = Rank.query.order_by(Rank.name).all()
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    # Set display names for all clergy
    for clergy_member in all_clergy:
        set_clergy_display_name(clergy_member)
    
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    all_clergy_json = json.dumps(all_clergy_data)
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    return render_template('clergy_list.html', 
                         clergy_list=clergy_list, 
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         organizations=organizations,
                         ranks=ranks,
                         all_clergy=all_clergy,
                         all_clergy_json=all_clergy_json,
                         exclude_priests=exclude_priests,
                         exclude_coconsecrators=exclude_coconsecrators,
                         exclude_organizations=exclude_organizations,
                         search=search,
                         user=user)

def add_clergy_handler():
    if 'user_id' not in session:
        flash('Please log in to add clergy records.', 'error')
        return None, redirect(url_for('auth.login'))
    if request.method == 'POST':
        try:
            # Create a combined form data that includes both form fields and files
            form_data = request.form.copy()
            form_data.update(request.files)
            clergy = create_clergy_from_form(form_data)
            
            # Check if this is an HTMX request
            is_htmx = request.headers.get('HX-Request') == 'true'
            
            if is_htmx:
                # For HTMX requests, return a response that will trigger redirect
                response = make_response('<script>window.location.href = "' + url_for('clergy.clergy_list') + '";</script>')
                response.headers['HX-Trigger'] = 'redirect'
                return clergy, response
            
            # Handle regular AJAX requests
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return clergy, jsonify({'success': True, 'message': 'Clergy record added successfully!', 'clergy_id': clergy.id})
            
            flash('Clergy record added successfully!', 'success')
            return clergy, redirect(url_for('clergy.clergy_list'))
        except Exception as e:
            db.session.rollback()
            
            # Check if this is an HTMX request
            is_htmx = request.headers.get('HX-Request') == 'true'
            if is_htmx:
                response = make_response(f'<div class="alert alert-danger">Error: {str(e)}</div>')
                return None, response, 400
            
            # Handle regular AJAX requests
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return None, jsonify({'success': False, 'message': str(e)}), 400
            flash('Error adding clergy record.', 'error')
            return None, render_template('add_clergy.html')
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    for clergy_member in all_clergy:
        set_clergy_display_name(clergy_member)
    
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    
    # For add form, provide all active (non-deleted) bishops initially (filtering will be done client-side based on dates)
    all_bishops = Clergy.query.filter(
        Clergy.rank.ilike('%bishop%'),
        Clergy.is_deleted != True
    ).order_by(Clergy.name).all()
    
    # Set display names for bishops
    for bishop in all_bishops:
        set_clergy_display_name(bishop)
    
    # Convert to list of dictionaries with temporal data for client-side filtering
    all_bishops_suggested = [
        {
            'id': bishop.id,
            'name': getattr(bishop, 'display_name', bishop.name),
            'rank': bishop.rank,
            'date_of_birth': bishop.date_of_birth.isoformat() if bishop.date_of_birth else None,
            'date_of_death': bishop.date_of_death.isoformat() if bishop.date_of_death else None,
            'consecrations_count': len(bishop.consecrations)
        }
        for bishop in all_bishops
    ]
    
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    return None, render_template('add_clergy.html', 
                         all_clergy=all_clergy, 
                         all_clergy_data=all_clergy_data,
                         all_bishops_suggested=all_bishops_suggested,
                         ranks=ranks,
                         organizations=organizations) 

def view_clergy_handler(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to view clergy records.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    # Eagerly load ordination and consecration relationships
    from sqlalchemy.orm import joinedload
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
    ).filter(Clergy.id == clergy_id).first_or_404()
    set_clergy_display_name(clergy)  # Set display name for the clergy member
    if user.can_edit_clergy():
        return redirect(url_for('clergy.edit_clergy', clergy_id=clergy_id))
    organizations = Organization.query.all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    comments = ClergyComment.query.filter_by(clergy_id=clergy_id, is_public=True, is_resolved=False).order_by(ClergyComment.created_at.desc()).all()
    
    # Create co-consecrators map for template
    co_consecrators_map = {}
    # Get co-consecrators from the new consecration table
    for consecration in clergy.consecrations:
        for co_consecrator in consecration.co_consecrators:
            co_consecrators_map[co_consecrator.id] = co_consecrator
    
    return render_template('clergy_detail_with_comments.html', 
                         clergy=clergy, 
                         user=user,
                         comments=comments,
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         co_consecrators_map=co_consecrators_map)

def edit_clergy_handler(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to edit clergy records.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    # Eagerly load ordination and consecration relationships
    from sqlalchemy.orm import joinedload
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
    ).filter(Clergy.id == clergy_id).first_or_404()
    set_clergy_display_name(clergy)  # Set display name for the clergy being edited
    comments = ClergyComment.query.filter_by(clergy_id=clergy_id, is_public=True, is_resolved=False).order_by(ClergyComment.created_at.desc()).all()
    organizations = Organization.query.all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    if request.method == 'POST':
        content_type = request.headers.get('Content-Type', '')
        is_ajax = (
            request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
            content_type.startswith('multipart/form-data') or
            content_type == 'application/x-www-form-urlencoded'
        )
        if is_ajax:
            try:
                clergy.name = request.form.get('name')
                clergy.rank = request.form.get('rank')
                clergy.papal_name = request.form.get('papal_name')
                clergy.organization = request.form.get('organization')
                date_of_birth = request.form.get('date_of_birth')
                date_of_death = request.form.get('date_of_death')
                clergy.notes = request.form.get('notes')
                
                # Handle image upload or removal using Backblaze B2
                image_removed = request.form.get('image_removed') == 'true'
                if image_removed:
                    # Delete existing images from Backblaze B2 and clear database
                    try:
                        image_upload_service = get_image_upload_service()
                        image_upload_service.delete_clergy_images(clergy.id)
                    except Exception as e:
                        current_app.logger.warning("Error deleting images for clergy %s: %s", clergy.id, e)

                    clergy.image_url = None
                    clergy.image_data = None
                else:
                    # Process new image uploads
                    try:
                        image_upload_service = get_image_upload_service()
                        
                        image_data_json = request.form.get('image_data_json')
                        processed_image_data = request.form.get('processed_image_data')
                        file_upload = None
                        
                        # Check for file upload
                        if 'clergy_image' in request.files and request.files['clergy_image'].filename:
                            file_upload = request.files['clergy_image']
                        
                        if image_data_json:
                            try:
                                image_data = json.loads(image_data_json)
                                original_url = image_data.get('original')
                                if not original_url:
                                    if clergy.image_url and 'original_' in clergy.image_url:
                                        original_url = clergy.image_url
                                        image_data['original'] = original_url
                                    else:
                                        try:
                                            response = image_upload_service.s3_client.list_objects_v2(
                                                Bucket=image_upload_service.bucket_name,
                                                Prefix=f"clergy/{clergy.id}/"
                                            )
                                            for obj in response.get('Contents', []):
                                                key = obj['Key']
                                                if 'original_' in key and 'lineage_' not in key and 'detail_' not in key:
                                                    original_url = image_upload_service.config.get_public_url(key)
                                                    image_data['original'] = original_url
                                                    break
                                        except Exception as e:
                                            current_app.logger.debug("Could not find original in storage: %s", e)

                                if original_url:
                                    clergy.image_url = original_url
                                else:
                                    current_app.logger.warning(
                                        "No original URL found, using detail as fallback for clergy.image_url (clergy_id=%s)",
                                        clergy.id,
                                    )
                                    clergy.image_url = image_data.get('detail', image_data.get('lineage', ''))

                                clergy.image_data = json.dumps(image_data)
                            except json.JSONDecodeError as e:
                                current_app.logger.warning("Failed to parse image data JSON: %s", e)

                        elif file_upload:
                            result = image_upload_service.upload_original_image(file_upload, clergy.id)
                            if result['success']:
                                clergy.image_url = result['url']
                                clergy.image_data = json.dumps(result['image_data'])
                            else:
                                current_app.logger.warning(
                                    "Failed to upload original image for clergy %s: %s",
                                    clergy.id, result['error'],
                                )

                        elif processed_image_data:
                            image_url = image_upload_service.upload_image_from_base64(processed_image_data, clergy.id, 'original')
                            if image_url:
                                clergy.image_url = image_url
                            else:
                                current_app.logger.warning("Failed to upload single image for clergy %s", clergy.id)

                    except Exception as e:
                        current_app.logger.exception("Error processing images for clergy %s", clergy.id)
                        # Continue without images rather than failing the entire operation
                if date_of_birth:
                    clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
                else:
                    clergy.date_of_birth = None
                if date_of_death:
                    clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
                else:
                    clergy.date_of_death = None
                
                # Handle new dynamic ordination and consecration data
                update_ordinations_from_form(clergy, request.form)
                update_consecrations_from_form(clergy, request.form)
                
                # Handle status indicators
                status_ids = request.form.getlist('status_ids[]') or request.form.getlist('status_ids')
                clergy.statuses = []  # Clear existing statuses
                if status_ids:
                    for status_id in status_ids:
                        if status_id:  # Skip empty values
                            try:
                                status = Status.query.get(int(status_id))
                                if status:
                                    clergy.statuses.append(status)
                            except (ValueError, TypeError):
                                pass  # Skip invalid status IDs
                
                # Handle soft delete
                mark_deleted = request.form.get('mark_deleted') == '1'
                if mark_deleted and not clergy.is_deleted:
                    clergy.is_deleted = True
                    clergy.deleted_at = datetime.utcnow()
                elif not mark_deleted and clergy.is_deleted:
                    clergy.is_deleted = False
                    clergy.deleted_at = None
                
                db.session.commit()
                
                # Generate sprite sheet in background (non-blocking)
                try:
                    _regenerate_sprite_sheet_background(clergy_id)
                except Exception as e:
                    current_app.logger.warning("Failed to start background sprite sheet generation: %s", e)

                log_audit_event(
                    action='update',
                    entity_type='clergy',
                    entity_id=clergy.id,
                    entity_name=clergy.name,
                    details={
                        'rank': clergy.rank,
                        'organization': clergy.organization,
                        'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
                        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                        'ordinations_count': len(clergy.ordinations),
                        'consecrations_count': len(clergy.consecrations),
                        'is_deleted': clergy.is_deleted,
                        'deleted_at': clergy.deleted_at.isoformat() if clergy.deleted_at else None
                    }
                )
                # Check if this is an HTMX request
                is_htmx = request.headers.get('HX-Request') == 'true'
                
                if is_htmx:
                    # For HTMX requests, return a response that will trigger redirect
                    response = make_response('<script>window.location.href = "' + url_for('clergy.clergy_list') + '";</script>')
                    response.headers['HX-Trigger'] = 'redirect'
                    return response
                else:
                    # For regular AJAX requests, return JSON
                    return jsonify({'success': True, 'message': 'Clergy record updated successfully!', 'clergy_id': clergy.id})
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': str(e)}), 400
        # Handle regular form submission (fallback)
        clergy.name = request.form.get('name')
        clergy.rank = request.form.get('rank')
        clergy.papal_name = request.form.get('papal_name')
        clergy.organization = request.form.get('organization')
        date_of_birth = request.form.get('date_of_birth')
        date_of_death = request.form.get('date_of_death')
        clergy.notes = request.form.get('notes')
        if date_of_birth:
            clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        else:
            clergy.date_of_birth = None
        if date_of_death:
            clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
        else:
            clergy.date_of_death = None
        
        # Handle new dynamic ordination and consecration data
        update_ordinations_from_form(clergy, request.form)
        update_consecrations_from_form(clergy, request.form)
        
        # Handle soft delete
        mark_deleted = request.form.get('mark_deleted') == '1'
        if mark_deleted and not clergy.is_deleted:
            clergy.is_deleted = True
            clergy.deleted_at = datetime.utcnow()
        elif not mark_deleted and clergy.is_deleted:
            clergy.is_deleted = False
            clergy.deleted_at = None
        
        db.session.commit()
        log_audit_event(
            action='update',
            entity_type='clergy',
            entity_id=clergy.id,
            entity_name=clergy.name,
            details={
                'rank': clergy.rank,
                'organization': clergy.organization,
                'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
                'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                'ordinations_count': len(clergy.ordinations),
                'consecrations_count': len(clergy.consecrations),
                'is_deleted': clergy.is_deleted,
                'deleted_at': clergy.deleted_at.isoformat() if clergy.deleted_at else None
            }
        )
        flash('Clergy record updated successfully!', 'success')
        return redirect(url_for('clergy.clergy_list'))
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    # Set display names for all clergy
    for clergy_member in all_clergy:
        set_clergy_display_name(clergy_member)
    
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    
    # Get bishops for the pre-filtered dropdowns with temporal logic
    # A bishop can only ordain/consecrate if they were:
    # 1. Alive on the ordination/consecration date
    # 2. Already a bishop on that date (consecrated before or on that date)
    # Get all clergy with ranks that are flagged as bishops
    all_bishops = db.session.query(Clergy).join(Rank, Clergy.rank == Rank.name).filter(
        Rank.is_bishop == True,
        Clergy.is_deleted != True
    ).order_by(Clergy.name).all()
    
    # Set display names for bishops
    for bishop in all_bishops:
        set_clergy_display_name(bishop)
    
    # Filter bishops based on temporal logic
    def is_valid_bishop_for_dates(bishop, ordination_date, consecration_date):
        """Check if a bishop was valid for the given ordination and consecration dates."""
        
        # For ordaining bishop: must be alive and be a bishop on ordination date
        if ordination_date:
            if not bishop.was_bishop_on(ordination_date):
                return False
        
        # For consecrator: must be alive and be a bishop on consecration date
        if consecration_date:
            if not bishop.was_bishop_on(consecration_date):
                return False
        
        # If no dates specified, include all bishops
        return True
    
    # Filter bishops based on the clergy's dates
    # Get ordination and consecration dates from new tables
    ordination_date = None
    consecration_date = None
    
    # Get primary ordination date
    primary_ordination = clergy.get_primary_ordination()
    if primary_ordination:
        ordination_date = primary_ordination.date
    
    # Get primary consecration date
    primary_consecration = clergy.get_primary_consecration()
    if primary_consecration:
        consecration_date = primary_consecration.date
    
    all_bishops_suggested = [
        bishop for bishop in all_bishops
        if is_valid_bishop_for_dates(bishop, ordination_date, consecration_date)
    ]
    
    # Convert to list of dictionaries for JSON serialization
    all_bishops_suggested = [
        {
            'id': bishop.id,
            'name': getattr(bishop, 'display_name', bishop.name)
        }
        for bishop in all_bishops_suggested
    ]
    
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    return render_template('edit_clergy_with_comments.html',
                         clergy=clergy,
                         user=user,
                         comments=comments,
                         all_clergy=all_clergy,
                         all_clergy_data=all_clergy_data,
                         all_bishops_suggested=all_bishops_suggested,
                         ranks=ranks,
                         organizations=organizations,
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         edit_mode=True)

def clergy_filter_partial_handler():
    if 'user_id' not in session:
        return '', 401
    user = User.query.get(session['user_id'])
    exclude_priests = request.args.get('exclude_priests') == '1'
    exclude_coconsecrators = request.args.get('exclude_coconsecrators') == '1'
    exclude_organizations = request.args.getlist('exclude_organizations')
    search = request.args.get('search', '').strip()
    query = Clergy.query.filter(Clergy.is_deleted != True)  # Exclude deleted records by default
    if exclude_priests:
        query = query.filter(Clergy.rank != 'Priest')
    if exclude_coconsecrators:
        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        # Get co-consecrator IDs from the new consecration table
        coconsecrator_ids = set()
        for c in all_clergy:
            for consecration in c.consecrations:
                for co_consecrator in consecration.co_consecrators:
                    coconsecrator_ids.add(co_consecrator.id)
        if coconsecrator_ids:
            query = query.filter(~Clergy.id.in_(coconsecrator_ids))
    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))
    if search:
        query = query.filter(Clergy.name.ilike(f'%{search}%'))
    clergy_list = query.all()
    for clergy in clergy_list:
        set_clergy_display_name(clergy)
    organizations = Organization.query.order_by(Organization.name).all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    return render_template('clergy_table_body.html', clergy_list=clergy_list, org_abbreviation_map=org_abbreviation_map, org_color_map=org_color_map, user=user)

def clergy_json_handler(clergy_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    clergy = Clergy.query.get_or_404(clergy_id)
    return jsonify({
        'id': clergy.id,
        'name': clergy.name,
        'rank': clergy.rank,
        'organization': clergy.organization,
        'date_of_birth': clergy.date_of_birth.strftime('%Y-%m-%d') if clergy.date_of_birth else None,
        'ordinations_count': len(clergy.ordinations),
        'consecrations_count': len(clergy.consecrations),
        'notes': clergy.notes
    }) 

def soft_delete_clergy_handler(clergy_id, user=None):
    from models import Clergy, db
    clergy = Clergy.query.get_or_404(clergy_id)
    # Clean up ordination and consecration references
    # Remove ordinations where this clergy was the ordaining bishop
    Ordination.query.filter(Ordination.ordaining_bishop_id == clergy_id).delete()
    
    # Remove consecrations where this clergy was the consecrator
    Consecration.query.filter(Consecration.consecrator_id == clergy_id).delete()
    
    # Remove co-consecrator relationships
    for consecration in Consecration.query.all():
        if clergy in consecration.co_consecrators:
            consecration.co_consecrators.remove(clergy)
    clergy.is_deleted = True
    clergy.deleted_at = datetime.utcnow()
    db.session.commit()
    return {'success': True, 'message': 'Clergy record soft-deleted successfully!'} 

def permanently_delete_clergy_handler(clergy_ids, user=None):
    """Permanently delete clergy records and all related data"""
    from models import Clergy, Ordination, Consecration, db
    from utils import log_audit_event
    from datetime import datetime
    
    if not clergy_ids:
        return {'success': False, 'message': 'No clergy IDs provided'}
    
    try:
        deleted_count = 0
        deleted_names = []
        
        for clergy_id in clergy_ids:
            clergy = Clergy.query.get(clergy_id)
            if not clergy:
                continue
            
            # Store clergy data for logging before any modifications
            clergy_name = clergy.name
            clergy_rank = clergy.rank
            clergy_organization = clergy.organization
            clergy_dob = clergy.date_of_birth.isoformat() if clergy.date_of_birth else None
            clergy_dod = clergy.date_of_death.isoformat() if clergy.date_of_death else None
            was_deleted = clergy.is_deleted
            deleted_at = clergy.deleted_at.isoformat() if clergy.deleted_at else None
                
            # Log the deletion before deleting
            log_audit_event(
                action='permanent_delete',
                entity_type='clergy',
                entity_id=clergy_id,
                entity_name=clergy_name,
                details={
                    'rank': clergy_rank,
                    'organization': clergy_organization,
                    'date_of_birth': clergy_dob,
                    'date_of_death': clergy_dod,
                    'was_deleted': was_deleted,
                    'deleted_at': deleted_at
                }
            )
            
            # Clean up all related data using clergy_id instead of clergy object
            # IMPORTANT: Delete in the correct order to avoid foreign key violations
            
            # 1. First, remove all co-consecrator relationships (both where clergy was co-consecrator and where clergy was involved in consecrations)
            from sqlalchemy import text
            db.session.execute(text("""
                DELETE FROM co_consecrators 
                WHERE co_consecrator_id = :clergy_id 
                OR consecration_id IN (
                    SELECT id FROM consecration 
                    WHERE clergy_id = :clergy_id OR consecrator_id = :clergy_id
                )
            """), {'clergy_id': clergy_id})
            
            # 2. Remove ordinations where this clergy was the ordaining bishop
            Ordination.query.filter(Ordination.ordaining_bishop_id == clergy_id).delete()
            
            # 3. Remove ordinations where this clergy was ordained
            Ordination.query.filter(Ordination.clergy_id == clergy_id).delete()
            
            # 4. Remove consecrations where this clergy was the consecrator
            Consecration.query.filter(Consecration.consecrator_id == clergy_id).delete()
            
            # 5. Remove consecrations where this clergy was consecrated
            Consecration.query.filter(Consecration.clergy_id == clergy_id).delete()
            
            # 6. Remove any comments associated with this clergy
            from models import ClergyComment
            ClergyComment.query.filter(ClergyComment.clergy_id == clergy_id).delete()
            
            # Finally delete the clergy record
            db.session.delete(clergy)
            deleted_count += 1
            deleted_names.append(clergy_name)
        
        db.session.commit()
        
        return {
            'success': True, 
            'message': f'Successfully permanently deleted {deleted_count} clergy record(s)',
            'deleted_count': deleted_count,
            'deleted_names': deleted_names
        }
        
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'message': f'Error permanently deleting clergy: {str(e)}'}

def get_filtered_bishops_handler():
    """Get bishops filtered by temporal logic for AJAX requests."""
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    
    # Get dates from request parameters
    ordination_date_str = request.args.get('ordination_date')
    consecration_date_str = request.args.get('consecration_date')
    
    # Convert string dates to date objects
    ordination_date = None
    consecration_date = None
    
    if ordination_date_str:
        try:
            ordination_date = datetime.strptime(ordination_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid ordination date format'}), 400
    
    if consecration_date_str:
        try:
            consecration_date = datetime.strptime(consecration_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid consecration date format'}), 400
    
    # Get all active (non-deleted) bishops
    all_bishops = db.session.query(Clergy).join(Rank, Clergy.rank == Rank.name).filter(
        Rank.is_bishop == True,
        Clergy.is_deleted != True
    ).order_by(Clergy.name).all()
    
    # Filter bishops based on temporal logic
    def is_valid_bishop_for_dates(bishop, ord_date, cons_date):
        """Check if a bishop was valid for the given ordination and consecration dates."""
        
        # For ordaining bishop: must be alive and be a bishop on ordination date
        if ord_date:
            if not bishop.was_bishop_on(ord_date):
                return False
        
        # For consecrator: must be alive and be a bishop on consecration date
        if cons_date:
            if not bishop.was_bishop_on(cons_date):
                return False
        
        # If no dates specified, include all bishops
        return True
    
    # Filter bishops
    filtered_bishops = [
        bishop for bishop in all_bishops
        if is_valid_bishop_for_dates(bishop, ordination_date, consecration_date)
    ]
    
    # Convert to list of dictionaries for JSON serialization
    bishops_data = [
        {
            'id': bishop.id,
            'name': bishop.name,
            'rank': bishop.rank,
            'date_of_birth': bishop.date_of_birth.isoformat() if bishop.date_of_birth else None,
            'date_of_death': bishop.date_of_death.isoformat() if bishop.date_of_death else None,
            'consecrations_count': len(bishop.consecrations)
        }
        for bishop in filtered_bishops
    ]
    
    return jsonify({'bishops': bishops_data})

def get_all_statuses():
    """Retrieve all status definitions"""
    return Status.query.order_by(Status.badge_position, Status.name).all()

def update_clergy_statuses(clergy_id, status_ids, user_id=None):
    """Update clergy statuses (many-to-many relationship)
    
    Args:
        clergy_id: ID of the clergy member
        status_ids: List of status IDs to assign
        user_id: ID of the user making the change (optional)
    """
    clergy = Clergy.query.get(clergy_id)
    if not clergy:
        return False
    
    # Clear existing statuses
    clergy.statuses = []
    
    # Add new statuses
    if status_ids:
        for status_id in status_ids:
            status = Status.query.get(status_id)
            if status:
                clergy.statuses.append(status)
    
    db.session.commit()
    return True

def get_clergy_statuses(clergy_id):
    """Get clergy's current statuses
    
    Args:
        clergy_id: ID of the clergy member
        
    Returns:
        List of status dictionaries with id, name, icon, color, position
    """
    clergy = Clergy.query.get(clergy_id)
    if not clergy:
        return []
    
    return [
        {
            'id': status.id,
            'name': status.name,
            'description': status.description,
            'icon': status.icon,
            'color': status.color,
            'badge_position': status.badge_position
        }
        for status in clergy.statuses
    ] 