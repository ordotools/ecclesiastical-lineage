from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, current_app
from services import clergy as clergy_service
from utils import audit_log, require_permission, log_audit_event
from models import Clergy, ClergyComment, User, db, Organization, Rank, Ordination, Consecration, AuditLog
import json
import base64

editor_bp = Blueprint('editor', __name__)

@editor_bp.route('/editor')
@require_permission('edit_clergy')
def editor():
    """Main editor interface with 4-panel layout"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    return render_template('editor.html', user=user)

@editor_bp.route('/editor/clergy-list')
@require_permission('edit_clergy')  
def clergy_list_panel():
    """HTMX endpoint for the left panel clergy list"""
    # Get filter parameters
    search = request.args.get('search', '').strip()
    exclude_priests = request.args.get('exclude_priests') == '1'
    exclude_coconsecrators = request.args.get('exclude_coconsecrators') == '1'
    exclude_organizations = request.args.getlist('exclude_organizations')

    # Base query for active clergy
    query = Clergy.query.filter(Clergy.is_deleted != True)

    # Apply search filter
    if search:
        query = query.filter(
            db.or_(
                Clergy.name.ilike(f'%{search}%'),
                Clergy.papal_name.ilike(f'%{search}%') if hasattr(Clergy, 'papal_name') else False
            )
        )

    # Apply filters
    if exclude_priests:
        query = query.filter(Clergy.rank != 'Priest')

    if exclude_coconsecrators:
        # This would need more complex logic to identify co-consecrators
        pass

    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))

    # Get filtered clergy
    clergy_list = query.order_by(Clergy.name).all()
    organizations = Organization.query.all()
    
    user = User.query.get(session['user_id']) if 'user_id' in session else None

    return render_template('editor_panels/clergy_list.html', 
                         clergy_list=clergy_list, 
                         organizations=organizations,
                         user=user,
                         search=search,
                         exclude_priests=exclude_priests,
                         exclude_coconsecrators=exclude_coconsecrators,
                         exclude_organizations=exclude_organizations)

@editor_bp.route('/editor/visualization')
@require_permission('edit_clergy')
def visualization_panel():
    """HTMX endpoint for the center panel visualization"""
    try:
        # Get only active clergy for the visualization
        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        
        # Get all organizations and ranks for color lookup
        organizations = {org.name: org.color for org in Organization.query.all()}
        ranks = {rank.name: rank.color for rank in Rank.query.all()}

        # SVG placeholder for clergy without images
        placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
        placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')

        # Prepare data for D3.js
        nodes = []
        links = []
        
        # Create nodes for each clergy
        for clergy in all_clergy:
            # Determine node color based on organization or rank
            node_color = '#3498db'  # Default blue
            if clergy.organization and clergy.organization in organizations:
                node_color = organizations[clergy.organization]
            elif clergy.rank and clergy.rank in ranks:
                node_color = ranks[clergy.rank]

            # Get image URL or use placeholder
            image_url = clergy.image_url if clergy.image_url else placeholder_data_url
            
            nodes.append({
                'id': clergy.id,
                'name': clergy.name,
                'papal_name': clergy.papal_name if hasattr(clergy, 'papal_name') else None,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'color': node_color,
                'image_url': image_url,
                'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
                'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                'is_deleted': clergy.is_deleted
            })

        # Create links for ordinations (black lines)
        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop and not ordination.ordaining_bishop.is_deleted:
                    links.append({
                        'source': ordination.ordaining_bishop.id,
                        'target': clergy.id,
                        'type': 'ordination',
                        'color': '#000000',  # Black for ordinations
                        'date': ordination.date.isoformat() if ordination.date else None,
                        'is_sub_conditione': ordination.is_sub_conditione,
                        'is_doubtful': ordination.is_doubtful,
                        'is_invalid': ordination.is_invalid
                    })

        # Create links for consecrations (green lines)
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator and not consecration.consecrator.is_deleted:
                    links.append({
                        'source': consecration.consecrator.id,
                        'target': clergy.id,
                        'type': 'consecration',
                        'color': '#27ae60',  # Green for consecrations
                        'date': consecration.date.isoformat() if consecration.date else None,
                        'is_sub_conditione': consecration.is_sub_conditione,
                        'is_doubtful': consecration.is_doubtful,
                        'is_invalid': consecration.is_invalid
                    })

        # Convert to JSON for JavaScript
        nodes_json = json.dumps(nodes)
        links_json = json.dumps(links)

        return render_template('editor_panels/visualization.html', 
                             nodes_json=nodes_json, 
                             links_json=links_json)
    
    except Exception as e:
        current_app.logger.error(f"Error in visualization panel: {e}")
        return render_template('editor_panels/visualization.html', 
                             error_message=f"Error loading visualization: {str(e)}",
                             nodes_json='[]',
                             links_json='[]')

@editor_bp.route('/editor/clergy-form')
@editor_bp.route('/editor/clergy-form/<int:clergy_id>')
@require_permission('edit_clergy')
def clergy_form_panel(clergy_id=None):
    """HTMX endpoint for the right panel clergy form"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    
    # Get form data
    ranks = Rank.query.all()
    organizations = Organization.query.all()
    
    # Create fields object for the form
    class FormFields:
        def __init__(self, ranks, organizations):
            self.ranks = ranks
            self.organizations = organizations
            self.form_action = None
            self.cancel_url = None
    
    fields = FormFields(ranks, organizations)
    
    if clergy_id:
        # Edit mode
        clergy = Clergy.query.get_or_404(clergy_id)
        return render_template('editor_panels/clergy_form.html', 
                             fields=fields, 
                             clergy=clergy, 
                             edit_mode=True, 
                             user=user)
    else:
        # Add mode
        return render_template('editor_panels/clergy_form.html', 
                             fields=fields, 
                             clergy=None, 
                             edit_mode=False, 
                             user=user)

@editor_bp.route('/editor/clergy-form-content')
@editor_bp.route('/editor/clergy-form-content/<int:clergy_id>')
@require_permission('edit_clergy')
def clergy_form_content(clergy_id=None):
    """HTMX endpoint for the clergy form content only"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    
    # Get form data
    ranks = Rank.query.all()
    organizations = Organization.query.all()
    
    # Create fields object for the form
    class FormFields:
        def __init__(self, ranks, organizations):
            self.ranks = ranks
            self.organizations = organizations
            self.form_action = None
            self.cancel_url = None
    
    fields = FormFields(ranks, organizations)
    
    if clergy_id:
        # Edit mode
        clergy = Clergy.query.get_or_404(clergy_id)
        return render_template('clergy_form_content.html', 
                             fields=fields, 
                             clergy=clergy, 
                             edit_mode=True, 
                             user=user,
                             context_type=None,
                             context_clergy_id=None)
    else:
        # Add mode
        return render_template('clergy_form_content.html', 
                             fields=fields, 
                             clergy=None, 
                             edit_mode=False, 
                             user=user,
                             context_type=None,
                             context_clergy_id=None)

@editor_bp.route('/editor/audit-logs')
@require_permission('view_audit_logs')
def audit_logs_panel():
    """HTMX endpoint for the bottom panel audit logs tab"""
    page = request.args.get('page', 1, type=int)
    per_page = 50
    
    # Get recent audit logs
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return render_template('editor_panels/audit_logs.html', logs=logs)

@editor_bp.route('/editor/metadata')
@require_permission('manage_metadata')
def metadata_panel():
    """HTMX endpoint for the bottom panel metadata tab"""
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    return render_template('editor_panels/metadata.html', 
                         ranks=ranks, 
                         organizations=organizations)

@editor_bp.route('/editor/comments')
@require_permission('view_comments')
def comments_panel():
    """HTMX endpoint for the bottom panel comments tab"""
    page = request.args.get('page', 1, type=int)
    per_page = 25
    
    # Get recent comments
    comments = ClergyComment.query.order_by(ClergyComment.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return render_template('editor_panels/comments.html', comments=comments)

@editor_bp.route('/editor/statistics')
@require_permission('edit_clergy')
def statistics_panel():
    """HTMX endpoint for the bottom panel statistics tab"""
    # Calculate basic statistics
    total_clergy = Clergy.query.filter(Clergy.is_deleted != True).count()
    total_bishops = Clergy.query.filter(
        Clergy.is_deleted != True,
        Clergy.rank.in_(['Bishop', 'Archbishop', 'Cardinal', 'Pope'])
    ).count()
    total_priests = Clergy.query.filter(
        Clergy.is_deleted != True,
        Clergy.rank == 'Priest'
    ).count()
    
    # Count by organization
    org_stats = db.session.query(
        Clergy.organization,
        db.func.count(Clergy.id).label('count')
    ).filter(
        Clergy.is_deleted != True,
        Clergy.organization.isnot(None)
    ).group_by(Clergy.organization).order_by(db.desc('count')).all()
    
    # Count by rank
    rank_stats = db.session.query(
        Clergy.rank,
        db.func.count(Clergy.id).label('count')
    ).filter(
        Clergy.is_deleted != True,
        Clergy.rank.isnot(None)
    ).group_by(Clergy.rank).order_by(db.desc('count')).all()
    
    statistics = {
        'total_clergy': total_clergy,
        'total_bishops': total_bishops,
        'total_priests': total_priests,
        'org_stats': org_stats,
        'rank_stats': rank_stats
    }
    
    return render_template('editor_panels/statistics.html', statistics=statistics)