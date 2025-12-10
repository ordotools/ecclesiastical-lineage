from flask import Blueprint, render_template, request, jsonify, session
from models import db, WikiPage, User
from datetime import datetime

wiki_bp = Blueprint('wiki', __name__)

@wiki_bp.route('/wiki')
def wiki():
    return render_template('wiki.html')

@wiki_bp.route('/wiki/<path:slug>')
def wiki_page(slug):
    return render_template('wiki.html', initial_slug=slug)

# API Routes

@wiki_bp.route('/api/wiki/pages', methods=['GET'])
def get_pages():
    """Get a list of all wiki pages."""
    pages = WikiPage.query.all()
    # If no pages exist, we might want to return defaults or empty
    return jsonify([p.title for p in pages])

@wiki_bp.route('/api/wiki/page/<path:slug>', methods=['GET'])
def get_page(slug):
    """Get the content of a specific wiki page."""
    page = WikiPage.query.filter_by(title=slug).first()
    if page:
        return jsonify({
            'title': page.title,
            'content': page.markdown,
            'updated_at': page.updated_at.isoformat() if page.updated_at else None,
            'editor': page.last_editor.username if page.last_editor else None
        })
    else:
        return jsonify(None), 404

@wiki_bp.route('/api/wiki/save', methods=['POST'])
def save_page():
    """Save or update a wiki page."""
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user_id']
    data = request.json
    slug = data.get('title')
    content = data.get('content')

    if not slug or not content:
        return jsonify({'error': 'Title and content are required'}), 400

    page = WikiPage.query.filter_by(title=slug).first()
    
    if page:
        page.markdown = content
        page.edit_count += 1
        page.last_editor_id = user_id
        page.updated_at = datetime.utcnow()
    else:
        page = WikiPage(
            title=slug,
            markdown=content,
            edit_count=1,
            last_editor_id=user_id
        )
        db.session.add(page)
    
    db.session.commit()
    
    return jsonify({'success': True, 'title': page.title})
