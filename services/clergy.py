from flask import render_template, request, redirect, url_for, flash, session, jsonify, make_response
from models import db, Clergy, Rank, Organization, User, ClergyComment
from utils import generate_breadcrumbs, log_audit_event
from datetime import datetime
import json

def create_clergy_from_form(form):
    clergy = Clergy()
    clergy.name = form.get('name')
    clergy.rank = form.get('rank')
    clergy.organization = form.get('organization')
    date_of_birth = form.get('date_of_birth')
    date_of_ordination = form.get('date_of_ordination')
    date_of_consecration = form.get('date_of_consecration')
    date_of_death = form.get('date_of_death')
    clergy.notes = form.get('notes')
    if date_of_birth:
        clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
    if date_of_ordination:
        clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
    if date_of_consecration:
        clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
    if date_of_death:
        clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
    # Handle ordaining bishop with auto-creation logic
    ordaining_bishop_id = form.get('ordaining_bishop_id')
    ordaining_bishop_input = form.get('ordaining_bishop_input')
    if ordaining_bishop_id and ordaining_bishop_id != 'None':
        clergy.ordaining_bishop_id = int(ordaining_bishop_id)
    elif ordaining_bishop_input:
        # Check if bishop exists by name
        existing = Clergy.query.filter_by(name=ordaining_bishop_input.strip()).first()
        if existing:
            clergy.ordaining_bishop_id = existing.id
        else:
            # Auto-create missing ordaining bishop
            new_bishop = Clergy(name=ordaining_bishop_input.strip(), rank='Bishop')
            db.session.add(new_bishop)
            db.session.flush()  # Get the ID without committing
            clergy.ordaining_bishop_id = new_bishop.id
    
    # Handle consecrator with auto-creation logic
    consecrator_id = form.get('consecrator_id')
    consecrator_input = form.get('consecrator_input')
    if consecrator_id and consecrator_id != 'None':
        clergy.consecrator_id = int(consecrator_id)
    elif consecrator_input:
        # Check if bishop exists by name
        existing = Clergy.query.filter_by(name=consecrator_input.strip()).first()
        if existing:
            clergy.consecrator_id = existing.id
        else:
            # Auto-create missing consecrator
            new_bishop = Clergy(name=consecrator_input.strip(), rank='Bishop')
            db.session.add(new_bishop)
            db.session.flush()  # Get the ID without committing
            clergy.consecrator_id = new_bishop.id
    
    # Handle co-consecrators
    co_consecrators = form.get('co_consecrators')
    if co_consecrators:
        co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
        clergy.set_co_consecrators(co_consecrator_ids)
    
    # Handle image upload for new clergy
    # New comprehensive image system: 64x64 for lineage, 320x320 for detail views
    image_data_json = form.get('image_data_json')
    if image_data_json:
        try:
            import json
            image_data = json.loads(image_data_json)
            
            # Store the lineage image (48x48) as the main image_url for lineage visualization
            clergy.image_url = image_data.get('lineage', '')
            
            # Store the comprehensive image data as a JSON field for future use
            clergy.image_data = image_data_json
            
            # Log the image data received
            lineage_image = image_data.get('lineage', '')
            detail_image = image_data.get('detail', '')
            cropped_image = image_data.get('cropped', '')
            original_image = image_data.get('original', '')
            
            print(f"Comprehensive image data received for new clergy:")
            print(f"  - Lineage (48x48): {len(lineage_image or '')} chars")
            print(f"  - Detail (320x320): {len(detail_image or '')} chars")
            print(f"  - Cropped: {len(cropped_image or '')} chars")
            print(f"  - Original: {len(original_image or '')} chars")
            
            # Store metadata if available
            if 'metadata' in image_data:
                metadata = image_data['metadata']
                print(f"  - Original file size: {metadata.get('originalSize', 0)} bytes")
                print(f"  - Quality setting: {metadata.get('quality', 'unknown')}")
                print(f"  - Cropped quality: {metadata.get('croppedQuality', 'unknown')}")
                print(f"  - Crop dimensions: {metadata.get('cropDimensions', {})}")
                
        except json.JSONDecodeError as e:
            print(f"Error parsing image data JSON: {e}")
            # Fallback to processed_image_data if available
            processed_image_data = form.get('processed_image_data')
            if processed_image_data:
                clergy.image_url = processed_image_data
                print(f"Processed image data received for new clergy: {len(processed_image_data)} characters")
    elif form.get('processed_image_data'):
        processed_image_data = form.get('processed_image_data')
        clergy.image_url = processed_image_data
        print(f"Processed image data received for new clergy: {len(processed_image_data)} characters")
    
    # Also handle file uploads for new clergy (fallback)
    if 'clergy_image' in form and hasattr(form['clergy_image'], 'filename') and form['clergy_image'].filename:
        file = form['clergy_image']
        if file and file.filename:
            # Store the actual file content as base64
            import base64
            file_content = file.read()
            file.seek(0)  # Reset file pointer
            base64_data = base64.b64encode(file_content).decode('utf-8')
            mime_type = file.content_type or 'image/jpeg'
            clergy.image_url = f"data:{mime_type};base64,{base64_data}"
            print(f"File converted to base64 for new clergy: {len(base64_data)} characters")
    
    db.session.add(clergy)
    db.session.commit()
    return clergy

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
            coconsecrator_ids.update(c.get_co_consecrators())
        if coconsecrator_ids:
            query = query.filter(~Clergy.id.in_(coconsecrator_ids))
    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))
    if search:
        query = query.filter(Clergy.name.ilike(f'%{search}%'))
    clergy_list = query.all()
    for clergy in clergy_list:
        if clergy.rank.lower() == 'bishop':
            clergy.display_name = f"Most. Rev. {clergy.name}"
        elif clergy.rank.lower() == 'priest':
            clergy.display_name = f"Rev. {clergy.name}"
        else:
            clergy.display_name = clergy.name
    organizations = Organization.query.order_by(Organization.name).all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    ranks = Rank.query.order_by(Rank.name).all()
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
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
    breadcrumbs = generate_breadcrumbs('clergy_list')
    return render_template('clergy_list.html', 
                         clergy_list=clergy_list, 
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         breadcrumbs=breadcrumbs,
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
            clergy = create_clergy_from_form(request.form)
            
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
                return clergy, jsonify({'success': True, 'message': 'Clergy record added successfully!'})
            
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
    # ... (rest of GET logic unchanged, but return as (None, response)) ...
    # You may need to pass the same context as in clergy_list_handler for GET
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
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
    
    # Convert to list of dictionaries with temporal data for client-side filtering
    all_bishops_suggested = [
        {
            'id': bishop.id,
            'name': bishop.name,
            'rank': bishop.rank,
            'date_of_birth': bishop.date_of_birth.isoformat() if bishop.date_of_birth else None,
            'date_of_death': bishop.date_of_death.isoformat() if bishop.date_of_death else None,
            'date_of_consecration': bishop.date_of_consecration.isoformat() if bishop.date_of_consecration else None
        }
        for bishop in all_bishops
    ]
    
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    breadcrumbs = generate_breadcrumbs('add_clergy')
    return None, render_template('add_clergy.html', 
                         all_clergy=all_clergy, 
                         all_clergy_data=all_clergy_data,
                         all_bishops_suggested=all_bishops_suggested,
                         ranks=ranks,
                         organizations=organizations,
                         breadcrumbs=breadcrumbs) 

def view_clergy_handler(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to view clergy records.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    clergy = Clergy.query.get_or_404(clergy_id)
    if user.can_edit_clergy():
        return redirect(url_for('clergy.edit_clergy', clergy_id=clergy_id))
    organizations = Organization.query.all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    comments = ClergyComment.query.filter_by(clergy_id=clergy_id, is_public=True, is_resolved=False).order_by(ClergyComment.created_at.desc()).all()
    breadcrumbs = generate_breadcrumbs('view_clergy', clergy=clergy)
    return render_template('clergy_detail_with_comments.html', 
                         clergy=clergy, 
                         user=user,
                         comments=comments,
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         breadcrumbs=breadcrumbs)

def edit_clergy_handler(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to edit clergy records.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    clergy = Clergy.query.get_or_404(clergy_id)
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
                clergy.organization = request.form.get('organization')
                date_of_birth = request.form.get('date_of_birth')
                date_of_ordination = request.form.get('date_of_ordination')
                ordaining_bishop_id = request.form.get('ordaining_bishop_id')
                ordaining_bishop_input = request.form.get('ordaining_bishop_input')
                date_of_consecration = request.form.get('date_of_consecration')
                consecrator_id = request.form.get('consecrator_id')
                consecrator_input = request.form.get('consecrator_input')
                co_consecrators = request.form.get('co_consecrators')
                date_of_death = request.form.get('date_of_death')
                clergy.notes = request.form.get('notes')
                
                # Handle image upload or removal
                image_removed = request.form.get('image_removed') == 'true'
                if image_removed:
                    # Clear image data when image is removed
                    clergy.image_url = None
                    clergy.image_data = None
                    print(f"Image removed for clergy {clergy.name}")
                else:
                    image_data_json = request.form.get('image_data_json')
                    if image_data_json:
                        try:
                            import json
                            image_data = json.loads(image_data_json)
                            
                            # Store the lineage image (64x64) as the main image_url for lineage visualization
                            clergy.image_url = image_data.get('lineage', '')
                            
                            # Store the comprehensive image data as a JSON field for future use
                            clergy.image_data = image_data_json
                            
                            # Log the image data received
                            lineage_image = image_data.get('lineage', '')
                            detail_image = image_data.get('detail', '')
                            cropped_image = image_data.get('cropped', '')
                            original_image = image_data.get('original', '')
                            
                            print(f"Comprehensive image data received for clergy {clergy.name}:")
                            print(f"  - Lineage (48x48): {len(lineage_image or '')} chars")
                            print(f"  - Detail (320x320): {len(detail_image or '')} chars")
                            print(f"  - Cropped: {len(cropped_image or '')} chars")
                            print(f"  - Original: {len(original_image or '')} chars")
                            
                            # Store metadata if available
                            if 'metadata' in image_data:
                                metadata = image_data['metadata']
                                print(f"  - Original file size: {metadata.get('originalSize', 0)} bytes")
                                print(f"  - Quality setting: {metadata.get('quality', 'unknown')}")
                                print(f"  - Cropped quality: {metadata.get('croppedQuality', 'unknown')}")
                                print(f"  - Crop dimensions: {metadata.get('cropDimensions', {})}")
                                
                        except json.JSONDecodeError as e:
                            print(f"Error parsing image data JSON: {e}")
                            # Fallback to processed_image_data if available
                            processed_image_data = request.form.get('processed_image_data')
                            if processed_image_data:
                                clergy.image_url = processed_image_data
                                print(f"Processed image data received for clergy {clergy.name}: {len(processed_image_data or '')} characters")
                    elif request.form.get('processed_image_data'):
                        processed_image_data = request.form.get('processed_image_data')
                        clergy.image_url = processed_image_data
                        print(f"Processed image data received for clergy {clergy.name}: {len(processed_image_data or '')} characters")
                    elif 'clergy_image' in request.files and request.files['clergy_image'].filename:
                        # Fallback to file upload if no processed data
                        file = request.files['clergy_image']
                        if file and file.filename:
                            # Store the actual file content as base64
                            import base64
                            file_content = file.read()
                            file.seek(0)  # Reset file pointer for potential future reads
                            base64_data = base64.b64encode(file_content).decode('utf-8')
                            mime_type = file.content_type or 'image/jpeg'
                            clergy.image_url = f"data:{mime_type};base64,{base64_data}"
                            print(f"File converted to base64 for clergy {clergy.name}: {len(base64_data)} characters")
                if date_of_birth:
                    clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
                else:
                    clergy.date_of_birth = None
                if date_of_ordination:
                    clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
                else:
                    clergy.date_of_ordination = None
                if date_of_consecration:
                    clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
                else:
                    clergy.date_of_consecration = None
                if date_of_death:
                    clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
                else:
                    clergy.date_of_death = None
                if ordaining_bishop_id and ordaining_bishop_id != 'None':
                    clergy.ordaining_bishop_id = int(ordaining_bishop_id)
                elif ordaining_bishop_input:
                    existing = Clergy.query.filter_by(name=ordaining_bishop_input.strip()).first()
                    if existing:
                        clergy.ordaining_bishop_id = existing.id
                    else:
                        new_bishop = Clergy(name=ordaining_bishop_input.strip(), rank='Bishop')
                        db.session.add(new_bishop)
                        db.session.flush()
                        clergy.ordaining_bishop_id = new_bishop.id
                else:
                    clergy.ordaining_bishop_id = None
                if consecrator_id and consecrator_id != 'None':
                    clergy.consecrator_id = int(consecrator_id)
                elif consecrator_input:
                    existing = Clergy.query.filter_by(name=consecrator_input.strip()).first()
                    if existing:
                        clergy.consecrator_id = existing.id
                    else:
                        new_bishop = Clergy(name=consecrator_input.strip(), rank='Bishop')
                        db.session.add(new_bishop)
                        db.session.flush()
                        clergy.consecrator_id = new_bishop.id
                else:
                    clergy.consecrator_id = None
                if co_consecrators:
                    co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
                    clergy.set_co_consecrators(co_consecrator_ids)
                else:
                    clergy.set_co_consecrators([])
                
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
                        'date_of_ordination': clergy.date_of_ordination.isoformat() if clergy.date_of_ordination else None,
                        'date_of_consecration': clergy.date_of_consecration.isoformat() if clergy.date_of_consecration else None,
                        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                        'ordaining_bishop_id': clergy.ordaining_bishop_id,
                        'consecrator_id': clergy.consecrator_id,
                        'co_consecrators': clergy.get_co_consecrators(),
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
                    return jsonify({'success': True, 'message': 'Clergy record updated successfully!'})
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': str(e)}), 400
        # Handle regular form submission (fallback)
        clergy.name = request.form.get('name')
        clergy.rank = request.form.get('rank')
        clergy.organization = request.form.get('organization')
        date_of_birth = request.form.get('date_of_birth')
        date_of_ordination = request.form.get('date_of_ordination')
        ordaining_bishop_id = request.form.get('ordaining_bishop_id')
        ordaining_bishop_input = request.form.get('ordaining_bishop_input')
        date_of_consecration = request.form.get('date_of_consecration')
        consecrator_id = request.form.get('consecrator_id')
        consecrator_input = request.form.get('consecrator_input')
        co_consecrators = request.form.get('co_consecrators')
        date_of_death = request.form.get('date_of_death')
        clergy.notes = request.form.get('notes')
        if date_of_birth:
            clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        else:
            clergy.date_of_birth = None
        if date_of_ordination:
            clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
        else:
            clergy.date_of_ordination = None
        if date_of_consecration:
            clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
        else:
            clergy.date_of_consecration = None
        if date_of_death:
            clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
        else:
            clergy.date_of_death = None
        if ordaining_bishop_id and ordaining_bishop_id != 'None':
            clergy.ordaining_bishop_id = int(ordaining_bishop_id)
        elif ordaining_bishop_input:
            existing = Clergy.query.filter_by(name=ordaining_bishop_input.strip()).first()
            if existing:
                clergy.ordaining_bishop_id = existing.id
            else:
                new_bishop = Clergy(name=ordaining_bishop_input.strip(), rank='Bishop')
                db.session.add(new_bishop)
                db.session.flush()
                clergy.ordaining_bishop_id = new_bishop.id
        else:
            clergy.ordaining_bishop_id = None
        if consecrator_id and consecrator_id != 'None':
            clergy.consecrator_id = int(consecrator_id)
        elif consecrator_input:
            existing = Clergy.query.filter_by(name=consecrator_input.strip()).first()
            if existing:
                clergy.consecrator_id = existing.id
            else:
                new_bishop = Clergy(name=consecrator_input.strip(), rank='Bishop')
                db.session.add(new_bishop)
                db.session.flush()
                clergy.consecrator_id = new_bishop.id
        else:
            clergy.consecrator_id = None
        if co_consecrators:
            co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
            clergy.set_co_consecrators(co_consecrator_ids)
        else:
            clergy.set_co_consecrators([])
        
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
                'date_of_ordination': clergy.date_of_ordination.isoformat() if clergy.date_of_ordination else None,
                'date_of_consecration': clergy.date_of_consecration.isoformat() if clergy.date_of_consecration else None,
                'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                'ordaining_bishop_id': clergy.ordaining_bishop_id,
                'consecrator_id': clergy.consecrator_id,
                'co_consecrators': clergy.get_co_consecrators(),
                'is_deleted': clergy.is_deleted,
                'deleted_at': clergy.deleted_at.isoformat() if clergy.deleted_at else None
            }
        )
        flash('Clergy record updated successfully!', 'success')
        return redirect(url_for('clergy.clergy_list'))
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': clergy_member.name,
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    
    # Get bishops for the pre-filtered dropdowns with temporal logic
    # A bishop can only ordain/consecrate if they were:
    # 1. Alive on the ordination/consecration date
    # 2. Already a bishop on that date (consecrated before or on that date)
    all_bishops = Clergy.query.filter(
        Clergy.rank.ilike('%bishop%'),
        Clergy.is_deleted != True
    ).order_by(Clergy.name).all()
    
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
    ordination_date = clergy.date_of_ordination
    consecration_date = clergy.date_of_consecration
    
    all_bishops_suggested = [
        bishop for bishop in all_bishops
        if is_valid_bishop_for_dates(bishop, ordination_date, consecration_date)
    ]
    
    # Convert to list of dictionaries for JSON serialization
    all_bishops_suggested = [
        {
            'id': bishop.id,
            'name': bishop.name
        }
        for bishop in all_bishops_suggested
    ]
    
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    breadcrumbs = generate_breadcrumbs('edit_clergy', clergy=clergy)



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
                         edit_mode=True,
                         breadcrumbs=breadcrumbs)

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
        coconsecrator_ids = set()
        for c in all_clergy:
            coconsecrator_ids.update(c.get_co_consecrators())
        if coconsecrator_ids:
            query = query.filter(~Clergy.id.in_(coconsecrator_ids))
    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))
    if search:
        query = query.filter(Clergy.name.ilike(f'%{search}%'))
    clergy_list = query.all()
    for clergy in clergy_list:
        # include traditional titles for all the clerical ranks
        if clergy.rank.lower() in ['bishop', 'archbishop']:
            clergy.display_name = f"Most. Rev. {clergy.name}"
        elif clergy.rank.lower() == 'priest':
            clergy.display_name = f"Rev. {clergy.name}"
        elif clergy.rank.lower() == 'cardinal':
            clergy.display_name = f"His Eminence {clergy.name}"
        else:
            clergy.display_name = clergy.name
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
        'date_of_ordination': clergy.date_of_ordination.strftime('%Y-%m-%d') if clergy.date_of_ordination else None,
        'ordaining_bishop_id': clergy.ordaining_bishop_id,
        'date_of_consecration': clergy.date_of_consecration.strftime('%Y-%m-%d') if clergy.date_of_consecration else None,
        'consecrator_id': clergy.consecrator_id,
        'notes': clergy.notes
    }) 

def soft_delete_clergy_handler(clergy_id, user=None):
    from models import Clergy, db
    clergy = Clergy.query.get_or_404(clergy_id)
    # Clean up ordaining_bishop_id and consecrator_id references
    referencing_clergy = Clergy.query.filter(
        (Clergy.ordaining_bishop_id == clergy_id) | (Clergy.consecrator_id == clergy_id),
        Clergy.is_deleted != True
    ).all()
    for c in referencing_clergy:
        if c.ordaining_bishop_id == clergy_id:
            c.ordaining_bishop_id = None
        if c.consecrator_id == clergy_id:
            c.consecrator_id = None
    # Clean up co-consecrator references
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    for c in all_clergy:
        co_consecrators = c.get_co_consecrators()
        if clergy_id in co_consecrators:
            co_consecrators = [cid for cid in co_consecrators if cid != clergy_id]
            c.set_co_consecrators(co_consecrators)
    clergy.is_deleted = True
    clergy.deleted_at = datetime.utcnow()
    db.session.commit()
    return {'success': True, 'message': 'Clergy record soft-deleted successfully!'} 

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
    all_bishops = Clergy.query.filter(
        Clergy.rank.ilike('%bishop%'),
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
            'date_of_consecration': bishop.date_of_consecration.isoformat() if bishop.date_of_consecration else None
        }
        for bishop in filtered_bishops
    ]
    
    return jsonify({'bishops': bishops_data}) 