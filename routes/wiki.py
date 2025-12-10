from flask import Blueprint, render_template

wiki_bp = Blueprint('wiki', __name__)

@wiki_bp.route('/wiki')
def wiki():
    return render_template('wiki.html')

@wiki_bp.route('/wiki/<path:slug>')
def wiki_page(slug):
    return render_template('wiki.html', initial_slug=slug)
