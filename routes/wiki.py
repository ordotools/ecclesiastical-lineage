from flask import Blueprint, render_template, request, jsonify, session, current_app
from sqlalchemy.orm import joinedload
from services.image_upload import get_image_upload_service
from models import db, WikiPage, User, Clergy, Ordination, Consecration, Organization, Rank
from constants import GREEN_COLOR, BLACK_COLOR
from datetime import datetime
from sqlalchemy import or_
import json
import base64

wiki_bp = Blueprint('wiki', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

@wiki_bp.route('/wiki')
def wiki():
    return render_template('wiki.html')

@wiki_bp.route('/wiki/<path:slug>')
def wiki_page(slug):
    return render_template('wiki.html', initial_slug=slug)

@wiki_bp.route('/wiki/dashboard')
def dashboard():
    if 'user_id' not in session:
        return render_template('auth/login.html', next='/wiki/dashboard')
    
    pages = WikiPage.query.order_by(WikiPage.updated_at.desc()).all()
    return render_template('wiki_dashboard.html', pages=pages)

# API Routes

@wiki_bp.route('/api/wiki/pages', methods=['GET'])
def get_pages():
    """Get a list of all wiki pages."""
    query = WikiPage.query
    
    # If not logged in, filter out invisible and deleted
    if 'user_id' not in session:
        query = query.filter_by(is_visible=True).filter_by(is_deleted=False)
    
    # If logged in, we return EVERYTHING so the frontend can decide what to show based on mode
    # (The requirement is: admins see everything in edit mode)
        
    pages = query.all()
    # Return objects with metadata
    return jsonify([{
        'title': p.title,
        'is_visible': p.is_visible,
        'is_deleted': p.is_deleted
    } for p in pages])

@wiki_bp.route('/api/wiki/page/<path:slug>', methods=['GET'])
def get_page(slug):
    """Get the content of a specific wiki page."""
    page = WikiPage.query.filter_by(title=slug).first()
    
    if page:
        # Check permissions
        is_editor = 'user_id' in session
        
        if not is_editor:
            if not page.is_visible or page.is_deleted:
                # Treat as 404 for unauthorized users
                return jsonify(None), 404

        return jsonify({
            'id': page.id,
            'title': page.title,
            'content': page.markdown,
            'updated_at': page.updated_at.isoformat() if page.updated_at else None,
            'editor': page.last_editor.username if page.last_editor else None,
            'clergy_id': page.clergy_id,
            'is_visible': page.is_visible,
            'is_deleted': page.is_deleted,
            'author_id': page.author_id
        })
    else:
        return jsonify(None), 404

@wiki_bp.route('/api/wiki/all-clergy', methods=['GET'])
def get_all_clergy():
    """Get all clergy for client-side fuzzy search."""
    # Return lightweight objects including name and rank
    all_clergy = Clergy.query.with_entities(Clergy.id, Clergy.name, Clergy.rank, Clergy.organization).all()
    
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'rank': c.rank,
        'organization': c.organization
    } for c in all_clergy])

@wiki_bp.route('/api/wiki/users', methods=['GET'])
def get_users():
    """Get all users for author selection."""
    users = User.query.with_entities(User.id, User.username, User.full_name).all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'full_name': u.full_name
    } for u in users])

@wiki_bp.route('/api/wiki/save', methods=['POST'])
def save_page():
    """Save or update a wiki page."""
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user_id']
    data = request.json
    slug = data.get('title')
    content = data.get('content')
    clergy_id = data.get('clergy_id')
    is_visible = data.get('is_visible', True)
    is_deleted = data.get('is_deleted', False)
    author_id = data.get('author_id')
    if author_id == "":
        author_id = None

    if not slug or not content:
        return jsonify({'error': 'Title and content are required'}), 400

    # If linked to clergy, ensure title matches clergy name (optional enforcement)
    if clergy_id:
        clergy = Clergy.query.get(clergy_id)
        if clergy:
            slug = clergy.name
        else:
            return jsonify({'error': 'Invalid clergy ID'}), 400

    # Check if page exists by title OR by clergy_id
    page = None
    if clergy_id:
        page = WikiPage.query.filter_by(clergy_id=clergy_id).first()
    
    if not page:
        page = WikiPage.query.filter_by(title=slug).first()
    
    if page:
        page.title = slug # Update title just in case
        page.markdown = content
        page.edit_count += 1
        page.last_editor_id = user_id
        page.updated_at = datetime.utcnow()
        if clergy_id:
             page.clergy_id = clergy_id
        
        # Update metadata
        page.is_visible = is_visible
        page.is_deleted = is_deleted
        page.author_id = author_id

    else:
        page = WikiPage(
            title=slug,
            markdown=content,
            edit_count=1,
            last_editor_id=user_id,
            clergy_id=clergy_id,
            is_visible=is_visible,
            is_deleted=is_deleted,
            author_id=author_id
        )
        db.session.add(page)
    
    db.session.commit()
    
    return jsonify({'success': True, 'title': page.title})

@wiki_bp.route('/api/wiki/page/<int:page_id>/delete', methods=['POST'])
def delete_page(page_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    page = WikiPage.query.get_or_404(page_id)
    page.is_deleted = True
    db.session.commit()
    return jsonify({'success': True})

@wiki_bp.route('/api/wiki/page/<int:page_id>/restore', methods=['POST'])
def restore_page(page_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    page = WikiPage.query.get_or_404(page_id)
    page.is_deleted = False
    db.session.commit()
    return jsonify({'success': True})

def _clergy_to_summary(clergy):
    ords = [o for o in clergy.ordinations if not o.is_invalid]
    cons = [c for c in clergy.consecrations if not c.is_invalid]
    return {
        'id': clergy.id,
        'name': clergy.name,
        'rank': clergy.rank or '',
        'organization': clergy.organization or '',
        'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
        'ordinations': [{'display_date': o.display_date, 'ordaining_bishop_name': o.ordaining_bishop.name if o.ordaining_bishop else ''} for o in ords],
        'consecrations': [{'display_date': c.display_date, 'consecrator_name': c.consecrator.name if c.consecrator else ''} for c in cons],
    }


@wiki_bp.route('/api/wiki/clergy/summaries', methods=['GET'])
def get_clergy_summaries_batch():
    """Batch fetch clergy summaries. Query: ?ids=1,2,3"""
    ids_param = request.args.get('ids', '')
    if not ids_param:
        return jsonify({})
    try:
        ids = [int(x.strip()) for x in ids_param.split(',') if x.strip()]
    except ValueError:
        return jsonify({'error': 'Invalid ids'}), 400
    if not ids:
        return jsonify({})
    clergy_list = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
    ).filter(Clergy.id.in_(ids), Clergy.is_deleted == False).all()
    return jsonify({c.id: _clergy_to_summary(c) for c in clergy_list})


@wiki_bp.route('/api/wiki/clergy/<int:clergy_id>/summary', methods=['GET'])
def get_clergy_summary(clergy_id):
    """Return summary for clergy shortcode: id, name, rank, org, dates, ordinations, consecrations."""
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
    ).filter_by(id=clergy_id, is_deleted=False).first()
    if not clergy:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(_clergy_to_summary(clergy))


@wiki_bp.route('/api/wiki/clergy/by-name/<path:name>', methods=['GET'])
def get_clergy_by_name(name):
    """Lookup clergy by name (first match). Returns summary JSON or 404."""
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
    ).filter(Clergy.name.ilike(name), Clergy.is_deleted == False).first()
    if not clergy:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(_clergy_to_summary(clergy))


def _is_bishop(clergy):
    """Check if clergy has bishop rank (ordained bishops)."""
    if not clergy or not clergy.rank:
        return False
    rank = Rank.query.filter_by(name=clergy.rank).first()
    return rank and rank.is_bishop


def _get_lineage_subset(clergy_id):
    """
    Traverse ordination (if priest) and consecration chain upward from clergy.
    Returns (node_ids_set, links_list) where links have source/target/type/date/color.
    """
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
    ).filter_by(id=clergy_id, is_deleted=False).first()
    if not clergy:
        return set(), []

    node_ids = {clergy_id}
    links = []
    visited = set()

    def add_node(c):
        if c and c.id and c.id not in visited:
            node_ids.add(c.id)

    def traverse_consecration_chain(cid):
        if cid in visited:
            return
        visited.add(cid)
        c = Clergy.query.options(
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        ).filter_by(id=cid, is_deleted=False).first()
        if not c:
            return
        pc = c.get_primary_consecration()
        if not pc or not pc.consecrator:
            return
        add_node(pc.consecrator)
        links.append({
            'source': pc.consecrator.id, 'target': cid, 'type': 'consecration',
            'date': pc.display_date, 'color': GREEN_COLOR,
        })
        traverse_consecration_chain(pc.consecrator.id)

    is_bishop = _is_bishop(clergy)
    if is_bishop:
        traverse_consecration_chain(clergy_id)
    else:
        # Priest: find ordaining bishop, add ordination link, then traverse consecration chain
        po = clergy.get_primary_ordination()
        if po and po.ordaining_bishop:
            ob = po.ordaining_bishop
            add_node(ob)
            links.append({
                'source': ob.id, 'target': clergy_id, 'type': 'ordination',
                'date': po.display_date, 'color': BLACK_COLOR,
            })
            traverse_consecration_chain(ob.id)

    return node_ids, links


def _clergy_to_lineage_node(clergy, organizations, ranks):
    """Build a lineage node dict matching main lineage viz format."""
    org_color = organizations.get(clergy.organization) or '#2c3e50'
    rank_color = ranks.get(clergy.rank) or '#888888'
    placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
    placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')
    image_url = placeholder_data_url
    if clergy.image_data:
        try:
            data = json.loads(clergy.image_data)
            image_url = data.get('lineage', data.get('detail', data.get('original', ''))) or clergy.image_url or placeholder_data_url
        except (json.JSONDecodeError, AttributeError):
            pass
    if not image_url:
        image_url = clergy.image_url or placeholder_data_url
    po = clergy.get_primary_ordination()
    pc = clergy.get_primary_consecration()
    ord_date = po.display_date if po else (clergy.ordinations[0].display_date if getattr(clergy, 'ordinations', None) and clergy.ordinations else None)
    cons_date = pc.display_date if pc else (clergy.consecrations[0].display_date if getattr(clergy, 'consecrations', None) and clergy.consecrations else None)
    return {
        'id': clergy.id,
        'name': clergy.papal_name if (clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name) else clergy.name,
        'rank': clergy.rank,
        'organization': clergy.organization,
        'org_color': org_color,
        'rank_color': rank_color,
        'image_url': image_url,
        'ordination_date': ord_date,
        'consecration_date': cons_date,
    }


def _clergy_image_url(clergy):
    """Extract image URL for clergy (profile/lineage display)."""
    placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
    placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')
    image_url = placeholder_data_url
    if clergy.image_data:
        try:
            data = json.loads(clergy.image_data)
            image_url = data.get('lineage', data.get('detail', data.get('original', ''))) or clergy.image_url or placeholder_data_url
        except (json.JSONDecodeError, AttributeError):
            pass
    if not image_url or image_url == placeholder_data_url:
        image_url = clergy.image_url or placeholder_data_url
    return image_url


def _clergy_to_profile(clergy, clergy_id_to_wiki_slug):
    """Build full profile JSON for clergy aside."""
    ords = [o for o in clergy.get_all_ordinations() if not o.is_invalid]
    cons = [c for c in clergy.get_all_consecrations() if not c.is_invalid]
    ords_data = [{
        'display_date': o.display_date,
        'ordaining_bishop': {
            'id': o.ordaining_bishop.id,
            'name': o.ordaining_bishop.name if o.ordaining_bishop else 'Unknown',
            'wiki_slug': clergy_id_to_wiki_slug.get(o.ordaining_bishop.id) if o.ordaining_bishop else None,
        } if o.ordaining_bishop else {'id': None, 'name': 'Unknown', 'wiki_slug': None},
    } for o in ords]
    cons_data = [{
        'display_date': c.display_date,
        'consecrator': {
            'id': c.consecrator.id,
            'name': c.consecrator.name if c.consecrator else 'Unknown',
            'wiki_slug': clergy_id_to_wiki_slug.get(c.consecrator.id) if c.consecrator else None,
        } if c.consecrator else {'id': None, 'name': 'Unknown', 'wiki_slug': None},
    } for c in cons]

    payload = {
        'image_url': _clergy_image_url(clergy),
        'name': clergy.papal_name if (clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name) else clergy.name,
        'rank': clergy.rank or '',
        'organization': clergy.organization or '',
        'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
        'ordinations': ords_data,
        'consecrations': cons_data,
    }

    if _is_bishop(clergy):
        ord_performed = [o for o in getattr(clergy, 'ordinations_performed', []) if not o.is_invalid]
        cons_performed = [c for c in getattr(clergy, 'consecrations_performed', []) if not c.is_invalid]
        def _key_ord(o):
            return (0, o.date) if o.date else (1, o.year or 0)
        def _key_cons(c):
            return (0, c.date) if c.date else (1, c.year or 0)
        ord_performed = sorted(ord_performed, key=_key_ord)
        cons_performed = sorted(cons_performed, key=_key_cons)
        payload['ordained'] = [{
            'display_date': o.display_date,
            'clergy': {
                'id': o.clergy.id,
                'name': o.clergy.name if o.clergy else 'Unknown',
                'wiki_slug': clergy_id_to_wiki_slug.get(o.clergy.id) if o.clergy else None,
            } if o.clergy else {'id': None, 'name': 'Unknown', 'wiki_slug': None},
        } for o in ord_performed]
        payload['consecrated'] = [{
            'display_date': c.display_date,
            'clergy': {
                'id': c.clergy.id,
                'name': c.clergy.name if c.clergy else 'Unknown',
                'wiki_slug': clergy_id_to_wiki_slug.get(c.clergy.id) if c.clergy else None,
            } if c.clergy else {'id': None, 'name': 'Unknown', 'wiki_slug': None},
        } for c in cons_performed]
    else:
        payload['ordained'] = []
        payload['consecrated'] = []

    return payload


@wiki_bp.route('/api/wiki/clergy/<int:clergy_id>/profile', methods=['GET'])
def get_clergy_profile(clergy_id):
    """Full profile for clergy aside: image, dates, ordinations, consecrations, ordained/consecrated (if bishop)."""
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.ordinations_performed).joinedload(Ordination.clergy),
        joinedload(Clergy.consecrations_performed).joinedload(Consecration.clergy),
    ).filter_by(id=clergy_id, is_deleted=False).first()
    if not clergy:
        return jsonify({'error': 'Not found'}), 404

    ids = {clergy.id}
    for o in clergy.ordinations:
        if o.ordaining_bishop and not o.is_invalid:
            ids.add(o.ordaining_bishop.id)
    for c in clergy.consecrations:
        if c.consecrator and not c.is_invalid:
            ids.add(c.consecrator.id)
    for o in getattr(clergy, 'ordinations_performed', []):
        if o.clergy and not o.is_invalid:
            ids.add(o.clergy.id)
    for c in getattr(clergy, 'consecrations_performed', []):
        if c.clergy and not c.is_invalid:
            ids.add(c.clergy.id)

    slug_rows = WikiPage.query.filter(
        WikiPage.clergy_id.in_(ids), WikiPage.is_deleted == False
    ).with_entities(WikiPage.clergy_id, WikiPage.title).all()
    clergy_id_to_wiki_slug = {r.clergy_id: r.title for r in slug_rows if r.clergy_id}

    return jsonify(_clergy_to_profile(clergy, clergy_id_to_wiki_slug))


@wiki_bp.route('/api/wiki/lineage/<path:identifier>', methods=['GET'])
def get_lineage_subset(identifier):
    """
    Get lineage subset for a clergy by ID or name.
    Returns { nodes: [...], links: [...] } matching main lineage viz format.
    """
    clergy = None
    try:
        cid = int(identifier)
        clergy = Clergy.query.filter_by(id=cid, is_deleted=False).first()
    except ValueError:
        clergy = Clergy.query.filter(Clergy.name.ilike(identifier), Clergy.is_deleted == False).first()
    if not clergy:
        return jsonify({'error': 'Not found'}), 404

    node_ids, links = _get_lineage_subset(clergy.id)
    clergy_list = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
    ).filter(Clergy.id.in_(node_ids), Clergy.is_deleted == False).all()

    organizations = {o.name: o.color for o in Organization.query.all()}
    ranks = {r.name: r.color for r in Rank.query.all()}
    nodes = [_clergy_to_lineage_node(c, organizations, ranks) for c in clergy_list]
    return jsonify({'nodes': nodes, 'links': links})


@wiki_bp.route('/api/wiki/backlinks/<path:slug>', methods=['GET'])
def get_backlinks(slug):
    """Pages that link to this page via [[slug]] or [[slug|...]]."""
    query = WikiPage.query.filter_by(is_deleted=False)
    if 'user_id' not in session:
        query = query.filter_by(is_visible=True)
    # Escape LIKE special chars: % and _ (use \ as escape char)
    safe = slug.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
    pattern1 = f'%[[{safe}]]%'
    pattern2 = f'%[[{safe}|%'
    query = query.filter(or_(
        WikiPage.markdown.ilike(pattern1, escape='\\'),
        WikiPage.markdown.ilike(pattern2, escape='\\')
    ))
    pages = query.all()
    return jsonify([{'title': p.title, 'slug': p.title} for p in pages])


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@wiki_bp.route('/api/wiki/upload', methods=['POST'])
def upload_image():
    """Accept image upload and save to Backblaze B2. Returns { url } for use in markdown."""
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    file = request.files.get('file')
    if not file or not file.filename:
        return jsonify({'error': 'No file'}), 400
    if not _allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400
    service = get_image_upload_service()
    url = service.upload_wiki_image(file)
    if not url:
        return jsonify({'error': 'Image storage not configured or upload failed'}), 503
    return jsonify({'url': url})


@wiki_bp.route('/api/wiki/page/<int:page_id>/toggle-visibility', methods=['POST'])
def toggle_visibility(page_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    page = WikiPage.query.get_or_404(page_id)
    page.is_visible = not page.is_visible
    db.session.commit()
    return jsonify({'success': True, 'is_visible': page.is_visible})
