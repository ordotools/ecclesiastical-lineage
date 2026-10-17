from flask import render_template, request, redirect, url_for, flash, session, jsonify, make_response, current_app
from models import db, Clergy, Rank, Organization, User, ClergyComment, Ordination, Consecration, Status, clergy_statuses, Tag
from utils import log_audit_event
from datetime import datetime
import json
import re
import threading
from .image_upload import get_image_upload_service
from services.validation_cascade import compute_system_tags_for_clergy, merge_user_and_system_tags

# Sprite rebuild single-flight state: {'running': bool, 'again': bool}
_sprite_sheet_status = {}
_sprite_sheet_lock = threading.Lock()


_RESERVED_SYSTEM_TAG_NAMES = {
    'invalid_priest', 'invalid_bishop',
    'doubtful_priest', 'doubtful_bishop',
    'valid',
}


def _parse_user_tag_labels(raw_value):
    """Parse a comma-separated tag string into a list of unique, trimmed labels."""
    if not raw_value:
        return []
    labels = []
    seen = set()
    for part in str(raw_value).split(','):
        label = part.strip()
        if not label:
            continue
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        labels.append(label)
    return labels


def _slugify_tag_label(label):
    """Slug-like machine name for a tag label (lowercase, alnum + hyphen)."""
    import re

    slug = (label or '').strip().lower()
    # Replace whitespace with single hyphen
    slug = re.sub(r'\s+', '-', slug)
    # Drop anything that's not alphanumeric or hyphen
    slug = re.sub(r'[^a-z0-9\-]', '', slug)
    return slug or None


def _ensure_user_tags(labels):
    """
    Ensure Tag rows exist for the given human-readable labels and return Tag objects.

    System-reserved tag names are skipped here so that validity-based system tags
    remain exclusively controlled by the validation logic.
    """
    tags = []
    for label in labels or []:
        slug = _slugify_tag_label(label)
        if not slug:
            continue
        if slug in _RESERVED_SYSTEM_TAG_NAMES:
            # Reserved for system/computed tags; user input should not create or
            # override these records. Validity logic will attach them as needed.
            continue
        tag = Tag.query.filter_by(name=slug).first()
        if not tag:
            tag = Tag(name=slug, label=label, is_system=False)
            db.session.add(tag)
        tags.append(tag)
    return tags


def _apply_tags_for_clergy_from_selected_ids(clergy, raw_value):
    """
    Attach Tag records based on a comma-separated list of tag IDs and merge system tags.

    This is the ID-based variant used by Editor v2. It intentionally ignores any
    invalid IDs and de-duplicates input.
    """
    if not clergy:
        return

    if not raw_value:
        system_tags = compute_system_tags_for_clergy(clergy)
        clergy.tags = merge_user_and_system_tags(clergy, system_tags)
        return

    ids = []
    seen = set()
    for part in str(raw_value).split(','):
        token = part.strip()
        if not token:
            continue
        try:
            tag_id = int(token)
        except (ValueError, TypeError):
            continue
        if tag_id in seen:
            continue
        seen.add(tag_id)
        ids.append(tag_id)

    user_tags = Tag.query.filter(Tag.id.in_(ids)).all() if ids else []
    clergy.tags = list(user_tags)

    system_tags = compute_system_tags_for_clergy(clergy)
    clergy.tags = merge_user_and_system_tags(clergy, system_tags)


def _apply_tags_for_clergy_from_raw_input(clergy, raw_value):
    """
    Parse user-entered tags, attach Tag records, and merge in validity-based tags.

    This helper is used by both create and edit flows so that:
    - user tags are derived from the comma-separated input field
    - system tags are recomputed from current ordinations/consecrations
    """
    if not clergy:
        return

    user_labels = _parse_user_tag_labels(raw_value)
    user_tags = _ensure_user_tags(user_labels)

    # First attach only user tags to the clergy instance.
    clergy.tags = list(user_tags)

    # Then compute validity-based system tags from current events and merge.
    system_tags = compute_system_tags_for_clergy(clergy)
    clergy.tags = merge_user_and_system_tags(clergy, system_tags)


def _apply_image_data_json(clergy, image_data_json):
    """Save the bucket URLs /api/process-cropped-image returned. Anything else (base64 originals
    and crops from older editor code) is dropped: it once grew rows to 1.4MB and rode along on every clergy query."""
    try:
        data = json.loads(image_data_json)
    except json.JSONDecodeError as e:
        current_app.logger.warning("Failed to parse image data JSON: %s", e)
        return
    config = get_image_upload_service().config
    kept = {k: data[k] for k in ('original', 'detail', 'lineage') if config and config.get_object_key(data.get(k))}
    if 'detail' not in kept:
        current_app.logger.warning("Ignoring image_data_json without a bucket detail URL (clergy_id=%s)", clergy.id)
        return
    if isinstance(data.get('metadata'), dict):
        kept['metadata'] = data['metadata']
    clergy.image_data = json.dumps(kept)
    clergy.image_url = kept.get('original', kept['detail'])


def _save_image_upload(clergy, original, cropped_image_data):
    """Store the form's newly chosen file and/or square crop (sizes auto-cropped when there's no crop)."""
    result = get_image_upload_service().save_clergy_image(clergy.id, original, cropped_image_data or None)
    if not result['success']:
        current_app.logger.warning("Failed to save image for clergy %s: %s", clergy.id, result['error'])
        return
    clergy.image_data = json.dumps(result['urls'])
    clergy.image_url = result['urls'].get('original', result['urls']['detail'])


def _regenerate_sprite_sheet_background(clergy_id=None):
    """Rebuild the sprite sheet in a background thread. One build at a time: saves that land
    mid-build just flag one more pass, so the last save is always in the sheet that ends up current."""
    # ponytail: lock is per process; with several gunicorn workers two builds can still overlap (harmless, newest id wins)
    with _sprite_sheet_lock:
        if _sprite_sheet_status.get('running'):
            _sprite_sheet_status['again'] = True
            return True
        _sprite_sheet_status.update(running=True, again=False)
    app = current_app._get_current_object()

    def background_task():
        with app.app_context():
            while True:
                try:
                    image_upload_service = get_image_upload_service()
                    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
                    if image_upload_service.backblaze_configured and all_clergy:
                        result = image_upload_service.create_sprite_sheet(all_clergy)
                        if result['success']:
                            current_app.logger.info("Sprite sheet regenerated in background: %s", result['url'])
                        else:
                            current_app.logger.warning("Failed to regenerate sprite sheet: %s", result.get('error', 'Unknown error'))
                except Exception:
                    current_app.logger.exception("Error in background sprite sheet regeneration")
                finally:
                    db.session.remove()  # next pass must see rows committed meanwhile
                with _sprite_sheet_lock:
                    if not _sprite_sheet_status['again']:
                        _sprite_sheet_status['running'] = False
                        return
                    _sprite_sheet_status['again'] = False

    thread = threading.Thread(target=background_task, daemon=True)
    thread.start()
    return True

def resolve_clergy_name(clergy):
    """Return the display name for clergy based on rank and optional name fields."""
    if not clergy:
        return ''
    if clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name:
        return clergy.papal_name
    if clergy.rank:
        rank_obj = Rank.query.filter_by(name=clergy.rank).first()
        if rank_obj and rank_obj.is_bishop:
            return clergy.name
    if clergy.religious_name:
        return clergy.religious_name
    return clergy.name


def set_clergy_display_name(clergy):
    """Set the display name for a clergy member based on their rank and name fields."""
    resolved = resolve_clergy_name(clergy)
    if clergy.rank.lower() == 'pope':
        clergy.display_name = f"His Holiness {resolved}"
    elif clergy.rank.lower() == 'cardinal':
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
        clergy.display_name = f"Rev. {resolved}"
    else:
        clergy.display_name = resolved

def create_clergy_from_form(form):
    clergy = Clergy()
    clergy.name = form.get('name')
    clergy.rank = form.get('rank')
    clergy.papal_name = form.get('papal_name')
    clergy.religious_name = form.get('religious_name')
    clergy.organization = form.get('organization')
    date_of_birth = form.get('date_of_birth')
    date_of_death = form.get('date_of_death')
    clergy.notes = form.get('notes')
    # Admin exclude-from-visualization flag
    exclude_raw = form.get('exclude_from_visualization') or form.get('exclude')
    clergy.exclude_from_visualization = bool(exclude_raw) and str(exclude_raw).lower() in ('1', 'true', 'on', 'yes')

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
            _apply_image_data_json(clergy, image_data_json)

        elif file_upload or form.get('cropped_image_data'):
            _save_image_upload(clergy, file_upload, form.get('cropped_image_data'))

        elif processed_image_data:
            image_url = image_upload_service.upload_image_from_base64(processed_image_data, clergy.id, 'original')
            if image_url:
                clergy.image_url = image_url
            else:
                current_app.logger.warning("Failed to upload single image for clergy %s", clergy.id)

    except Exception as e:
        current_app.logger.exception("Error processing images for clergy %s", clergy.id)

    sync_events_from_form(clergy, form)

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

    # Apply tags from Editor v2 ID-based picker when present, otherwise fall back
    # to legacy comma-separated label input.
    raw_selected_ids = form.get('tags_selected')
    if raw_selected_ids is not None:
        _apply_tags_for_clergy_from_selected_ids(clergy, raw_selected_ids)
    else:
        raw_tags = form.get('tags_input')
        _apply_tags_for_clergy_from_raw_input(clergy, raw_tags)

    db.session.commit()

    try:
        _regenerate_sprite_sheet_background(clergy.id)
    except Exception as e:
        current_app.logger.warning("Failed to start background sprite sheet generation: %s", e)

    return clergy

_EVENT_FIELD_RE = re.compile(r'(ordinations|consecrations)\[(\d+)\]\[([^\]]+)\](?:\[(\d+)\]\[([^\]]+)\])?$')


def _parse_event_rows(form):
    """{'ordinations': [row, ...], 'consecrations': [...]} in form order; co-consecrators as a list."""
    rows = {'ordinations': {}, 'consecrations': {}}
    for key, value in form.items():
        m = _EVENT_FIELD_RE.match(key)
        if not m:
            continue
        kind, idx, field, sub_idx, sub_field = m.groups()
        row = rows[kind].setdefault(int(idx), {})
        if sub_idx is None:
            row[field] = value
        elif field == 'co_consecrators':
            row.setdefault('co_consecrators', {}).setdefault(int(sub_idx), {})[sub_field] = value
    return {
        kind: [by_idx[i] for i in sorted(by_idx)]
        for kind, by_idx in rows.items()
    }


def _parse_id(value):
    value = (value or '').strip()
    return int(value) if value.isdigit() else None


def _resolve_bishop(id_value, name_value):
    """Hidden id wins; else match by exact name; else create a Bishop with that name."""
    bishop_id = _parse_id(id_value)
    if bishop_id:
        return db.session.get(Clergy, bishop_id)
    name = (name_value or '').strip()
    if not name:
        return None
    existing = Clergy.query.filter_by(name=name).first()
    if existing:
        return existing
    new_bishop = Clergy(name=name, rank='Bishop')
    db.session.add(new_bishop)
    db.session.flush()
    return new_bishop


def _apply_event_fields(event, data, bishop_key):
    """Set every form-controlled field, so an edited row ends up exactly as submitted."""
    date_val = (data.get('date') or '').strip()
    year_val = (data.get('year') or '').strip()
    event.details_unknown = data.get('details_unknown') in ('1', 'true', 'on')
    event.date = datetime.strptime(date_val, '%Y-%m-%d').date() if date_val else None
    event.year = int(year_val) if not date_val and year_val.isdigit() else None
    event.is_sub_conditione = data.get('is_sub_conditione') == 'on'
    event.is_doubtful_event = data.get('is_doubtful_event') == 'on'
    validity = data.get('validity', 'valid')
    event.is_doubtfully_valid = validity == 'doubtfully_valid'
    event.is_invalid = validity == 'invalid'
    event.notes = data.get('notes', '')
    event.is_inherited = data.get('is_inherited') == 'on'
    event.is_other = data.get('is_other') == 'on'
    event.optional_notes = (data.get('optional_notes') or '').strip() or None
    setattr(event, bishop_key, _resolve_bishop(data.get(bishop_key + '_id'), data.get(bishop_key + '_input')))


def sync_events_from_form(clergy, form):
    """Upsert ordinations/consecrations from the form, keyed by each row's hidden [id].

    A row whose id belongs to this clergy is updated in place (its id stays stable
    for evidence); a row without one is created; existing events not submitted are
    deleted. Forms that send no ids (old editor) therefore replace all events.
    A saved row with its date cleared is kept (dateless), not deleted with its evidence.
    """
    rows = _parse_event_rows(form)
    for kind, model, bishop_key in (
        ('ordinations', Ordination, 'ordaining_bishop'),
        ('consecrations', Consecration, 'consecrator'),
    ):
        collection = getattr(clergy, kind)
        existing = {ev.id: ev for ev in collection if ev.id is not None}
        kept = set()
        for data in rows[kind]:
            event = existing.get(_parse_id(data.get('id')))
            if event is not None and event.id in kept:
                event = None
            date_unknown = data.get('date_unknown') in ('1', 'true', 'on')
            details_unknown = data.get('details_unknown') in ('1', 'true', 'on')
            blank = not (data.get('date') or '').strip() and not date_unknown and not details_unknown
            if event is None:
                if blank:
                    continue  # empty new row
                event = model()
                # Append so in-memory clergy.<kind> stays current for tag computation.
                collection.append(event)
            else:
                kept.add(event.id)
            _apply_event_fields(event, data, bishop_key)
            if kind == 'consecrations':
                co_list = []
                for co_data in (data.get('co_consecrators') or {}).values():
                    co = _resolve_bishop(co_data.get('id'), co_data.get('input'))
                    if co and co not in co_list:
                        co_list.append(co)
                event.co_consecrators = co_list
        for event_id, event in existing.items():
            if event_id not in kept:
                if kind == 'consecrations':
                    event.co_consecrators = []
                collection.remove(event)
                db.session.delete(event)

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
                clergy.religious_name = request.form.get('religious_name')
                clergy.organization = request.form.get('organization')
                date_of_birth = request.form.get('date_of_birth')
                date_of_death = request.form.get('date_of_death')
                clergy.notes = request.form.get('notes')
                # Admin exclude-from-visualization flag
                exclude_raw = request.form.get('exclude_from_visualization') or request.form.get('exclude')
                clergy.exclude_from_visualization = bool(exclude_raw) and str(exclude_raw).lower() in ('1', 'true', 'on', 'yes')
                
                # Handle image upload or removal using Backblaze B2
                image_removed = request.form.get('image_removed') == 'true'
                image_changed = False
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
                        cropped_image_data = request.form.get('cropped_image_data')
                        image_changed = bool(image_data_json or file_upload or cropped_image_data or processed_image_data)
                        
                        if image_data_json:
                            _apply_image_data_json(clergy, image_data_json)

                        elif file_upload or cropped_image_data:
                            _save_image_upload(clergy, file_upload, cropped_image_data)

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
                sync_events_from_form(clergy, request.form)
                
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

                # Apply tags from Editor v2 ID-based picker when present, otherwise
                # fall back to legacy comma-separated label input.
                raw_selected_ids = request.form.get('tags_selected')
                if raw_selected_ids is not None:
                    _apply_tags_for_clergy_from_selected_ids(clergy, raw_selected_ids)
                else:
                    raw_tags = request.form.get('tags_input')
                    _apply_tags_for_clergy_from_raw_input(clergy, raw_tags)

                db.session.commit()

                if image_changed:
                    # Only now that the row points at the new files is it safe to drop the old ones.
                    try:
                        saved = json.loads(clergy.image_data) if clergy.image_data else {}
                        get_image_upload_service().prune_clergy_images(clergy.id, [clergy.image_url, *saved.values()])
                    except Exception as e:
                        current_app.logger.warning("Image prune skipped for clergy %s: %s", clergy.id, e)

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
                    return jsonify({
                        'success': True,
                        'message': 'Clergy record updated successfully!',
                        'clergy_id': clergy.id,
                        'is_deleted': bool(clergy.is_deleted),
                    })
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': str(e)}), 400
        # Handle regular form submission (fallback)
        clergy.name = request.form.get('name')
        clergy.rank = request.form.get('rank')
        clergy.papal_name = request.form.get('papal_name')
        clergy.religious_name = request.form.get('religious_name')
        clergy.organization = request.form.get('organization')
        date_of_birth = request.form.get('date_of_birth')
        date_of_death = request.form.get('date_of_death')
        clergy.notes = request.form.get('notes')
        # Admin exclude-from-visualization flag
        exclude_raw = request.form.get('exclude_from_visualization') or request.form.get('exclude')
        clergy.exclude_from_visualization = bool(exclude_raw) and str(exclude_raw).lower() in ('1', 'true', 'on', 'yes')
        if date_of_birth:
            clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        else:
            clergy.date_of_birth = None
        if date_of_death:
            clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
        else:
            clergy.date_of_death = None
        
        # Handle new dynamic ordination and consecration data
        sync_events_from_form(clergy, request.form)
        
        # Handle soft delete
        mark_deleted = request.form.get('mark_deleted') == '1'
        if mark_deleted and not clergy.is_deleted:
            clergy.is_deleted = True
            clergy.deleted_at = datetime.utcnow()
        elif not mark_deleted and clergy.is_deleted:
            clergy.is_deleted = False
            clergy.deleted_at = None

        # Apply tags from Editor v2 ID-based picker when present, otherwise
        # fall back to legacy comma-separated label input.
        raw_selected_ids = request.form.get('tags_selected')
        if raw_selected_ids is not None:
            _apply_tags_for_clergy_from_selected_ids(clergy, raw_selected_ids)
        else:
            raw_tags = request.form.get('tags_input')
            _apply_tags_for_clergy_from_raw_input(clergy, raw_tags)

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

def _purge_clergy_related_data(clergy_id):
    """Remove all FK-linked rows before deleting a clergy record."""
    from sqlalchemy import text
    from models import (
        ClergyComment,
        ClergyEvent,
        ClergySpritePosition,
        Consecration,
        LineageRoot,
        Ordination,
        WikiArticleRequest,
        WikiPage,
        clergy_statuses,
        clergy_tags,
        db,
    )

    db.session.execute(text("""
        DELETE FROM co_consecrators
        WHERE co_consecrator_id = :clergy_id
        OR consecration_id IN (
            SELECT id FROM consecration
            WHERE clergy_id = :clergy_id OR consecrator_id = :clergy_id
        )
    """), {'clergy_id': clergy_id})

    Ordination.query.filter(Ordination.ordaining_bishop_id == clergy_id).delete(synchronize_session=False)
    Ordination.query.filter(Ordination.clergy_id == clergy_id).delete(synchronize_session=False)
    Consecration.query.filter(Consecration.consecrator_id == clergy_id).delete(synchronize_session=False)
    Consecration.query.filter(Consecration.clergy_id == clergy_id).delete(synchronize_session=False)
    ClergyComment.query.filter(ClergyComment.clergy_id == clergy_id).delete(synchronize_session=False)
    ClergyEvent.query.filter(ClergyEvent.clergy_id == clergy_id).delete(synchronize_session=False)
    ClergySpritePosition.query.filter(ClergySpritePosition.clergy_id == clergy_id).delete(synchronize_session=False)
    WikiPage.query.filter(WikiPage.clergy_id == clergy_id).delete(synchronize_session=False)
    WikiArticleRequest.query.filter(WikiArticleRequest.clergy_id == clergy_id).delete(synchronize_session=False)
    LineageRoot.query.filter(LineageRoot.clergy_id == clergy_id).delete(synchronize_session=False)
    db.session.execute(clergy_tags.delete().where(clergy_tags.c.clergy_id == clergy_id))
    db.session.execute(clergy_statuses.delete().where(clergy_statuses.c.clergy_id == clergy_id))

    try:
        image_upload_service = get_image_upload_service()
        image_upload_service.delete_clergy_images(clergy_id)
    except Exception as e:
        current_app.logger.warning("Error deleting images for clergy %s: %s", clergy_id, e)


def permanently_delete_clergy_handler(clergy_ids, user=None):
    """Permanently delete clergy records and all related data"""
    from models import Clergy, db
    from utils import log_audit_event

    if not clergy_ids:
        return {'success': False, 'message': 'No clergy IDs provided'}

    try:
        deleted_count = 0
        deleted_names = []
        deleted_ids = []

        for clergy_id in clergy_ids:
            clergy = Clergy.query.get(clergy_id)
            if not clergy:
                continue

            clergy_name = clergy.name
            log_audit_event(
                action='permanent_delete',
                entity_type='clergy',
                entity_id=clergy_id,
                entity_name=clergy_name,
                details={
                    'rank': clergy.rank,
                    'organization': clergy.organization,
                    'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
                    'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                    'was_deleted': bool(clergy.is_deleted),
                    'deleted_at': clergy.deleted_at.isoformat() if clergy.deleted_at else None,
                },
            )

            _purge_clergy_related_data(clergy_id)
            db.session.delete(clergy)
            deleted_count += 1
            deleted_names.append(clergy_name)
            deleted_ids.append(clergy_id)

        db.session.commit()

        try:
            _regenerate_sprite_sheet_background()
        except Exception as e:
            current_app.logger.warning(
                "Failed to start background sprite sheet generation after delete: %s",
                e,
            )

        return {
            'success': True,
            'message': f'Successfully permanently deleted {deleted_count} clergy record(s)',
            'deleted_count': deleted_count,
            'deleted_names': deleted_names,
            'deleted_ids': deleted_ids,
        }

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Error permanently deleting clergy")
        return {'success': False, 'message': f'Error permanently deleting clergy: {str(e)}'}

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