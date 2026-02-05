from flask import Blueprint, render_template, request, jsonify, session
from models import db, WikiPage, User, Clergy
from datetime import datetime
from sqlalchemy import or_

wiki_bp = Blueprint('wiki', __name__)

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

@wiki_bp.route('/api/wiki/page/<int:page_id>/toggle-visibility', methods=['POST'])
def toggle_visibility(page_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    page = WikiPage.query.get_or_404(page_id)
    page.is_visible = not page.is_visible
    db.session.commit()
    return jsonify({'success': True, 'is_visible': page.is_visible})
