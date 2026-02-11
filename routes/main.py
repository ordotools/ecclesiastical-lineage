from flask import Blueprint, render_template, request, session, jsonify, current_app, g, abort
from models import Clergy, User, db, Organization, Rank, Ordination, Consecration
from constants import GREEN_COLOR, BLACK_COLOR
import json
import base64

main_bp = Blueprint('main', __name__)


@main_bp.route('/health')
def health():
    return 'ok', 200


@main_bp.route('/')
def index():
    return lineage_visualization()


@main_bp.route('/chapel-view')
def chapel_view():
    from routes.locations import _get_location_color
    from models import Location
    try:
        all_locations = Location.query.options(db.joinedload(Location.organization_obj)).filter(Location.is_active == True, Location.deleted == False).all()
        nodes = []
        links = []
        for location in all_locations:
            if location.has_coordinates():
                node_color = _get_location_color(location)
                nodes.append({
                    'id': location.id,
                    'name': location.name,
                    'location_type': location.location_type,
                    'pastor_name': location.pastor_name,
                    'organization': location.organization,
                    'organization_id': location.organization_id,
                    'organization_name': location.organization_obj.name if location.organization_obj else None,
                    'address': location.get_full_address(),
                    'city': location.city,
                    'country': location.country,
                    'latitude': location.latitude,
                    'longitude': location.longitude,
                    'color': node_color,
                    'notes': location.notes
                })
        nodes_json = json.dumps(nodes)
        links_json = json.dumps(links)
        user = None
        if 'user_id' in session:
            user = User.query.get(session['user_id'])
        return render_template('chapel_view.html', nodes_json=nodes_json, links_json=links_json, user=user)
    except Exception as e:
        current_app.logger.error(f"Error in chapel view visualization: {e}")
        return render_template('chapel_view.html', nodes_json='[]', links_json='[]',
                               error_message=f"Error loading chapel view visualization: {str(e)}", user=None)


def lineage_visualization():
    from sqlalchemy.orm import joinedload
    current_app.logger.debug("=== LINEAGE_VISUALIZATION ROUTE CALLED ===")
    try:
        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators),
            joinedload(Clergy.statuses)
        ).filter(Clergy.is_deleted != True).all()
        if not hasattr(g, 'organizations'):
            g.organizations = {org.name: org.color for org in Organization.query.all()}
        if not hasattr(g, 'ranks'):
            g.ranks = {rank.name: rank.color for rank in Rank.query.all()}
        organizations = g.organizations
        ranks = g.ranks
        placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
        placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')
        nodes = []
        links = []
        for clergy in all_clergy:
            org_color = organizations.get(clergy.organization) or '#2c3e50'
            rank_color = ranks.get(clergy.rank) or '#888888'
            image_data = None
            if clergy.image_data:
                try:
                    image_data = json.loads(clergy.image_data)
                except (json.JSONDecodeError, AttributeError):
                    pass
            image_url = placeholder_data_url
            if image_data:
                image_url = image_data.get('lineage', image_data.get('detail', image_data.get('original', '')))
            if not image_url or image_url == placeholder_data_url:
                image_url = clergy.image_url if clergy.image_url else placeholder_data_url
            high_res_image_url = image_data.get('detail') or image_data.get('original') if image_data else None
            statuses_data = [
                {'id': s.id, 'name': s.name, 'description': s.description, 'icon': s.icon, 'color': s.color, 'badge_position': s.badge_position}
                for s in clergy.statuses
            ]
            ordination_date = None
            po = clergy.get_primary_ordination()
            if po:
                ordination_date = po.display_date
            elif clergy.ordinations:
                fo = clergy.get_all_ordinations()[0]
                ordination_date = fo.display_date
            consecration_date = None
            pc = clergy.get_primary_consecration()
            if pc:
                consecration_date = pc.display_date
            elif clergy.consecrations:
                fc = clergy.get_all_consecrations()[0]
                consecration_date = fc.display_date
            nodes.append({
                'id': clergy.id,
                'name': clergy.papal_name if (clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name) else clergy.name,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'org_color': org_color,
                'rank_color': rank_color,
                'image_url': image_url,
                'high_res_image_url': high_res_image_url,
                'ordinations_count': len(clergy.ordinations),
                'consecrations_count': len(clergy.consecrations),
                'ordination_date': ordination_date,
                'consecration_date': consecration_date,
                'bio': clergy.notes,
                'statuses': statuses_data
            })
        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop:
                    links.append({
                        'source': ordination.ordaining_bishop.id, 'target': clergy.id, 'type': 'ordination',
                        'date': ordination.display_date,
                        'color': BLACK_COLOR,
                        'is_invalid': ordination.is_invalid, 'is_doubtfully_valid': ordination.is_doubtfully_valid,
                        'is_doubtful_event': ordination.is_doubtful_event, 'is_sub_conditione': ordination.is_sub_conditione
                    })
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator:
                    links.append({
                        'source': consecration.consecrator.id, 'target': clergy.id, 'type': 'consecration',
                        'date': consecration.display_date,
                        'color': GREEN_COLOR,
                        'is_invalid': consecration.is_invalid, 'is_doubtfully_valid': consecration.is_doubtfully_valid,
                        'is_doubtful_event': consecration.is_doubtful_event, 'is_sub_conditione': consecration.is_sub_conditione
                    })
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                for co_consecrator in consecration.co_consecrators:
                    links.append({
                        'source': co_consecrator.id, 'target': clergy.id, 'type': 'co-consecration',
                        'date': consecration.display_date,
                        'color': GREEN_COLOR, 'dashed': True,
                        'is_invalid': consecration.is_invalid, 'is_doubtfully_valid': consecration.is_doubtfully_valid,
                        'is_doubtful_event': consecration.is_doubtful_event, 'is_sub_conditione': consecration.is_sub_conditione
                    })
        nodes_json = json.dumps(nodes)
        links_json = json.dumps(links)
        user = None
        if 'user_id' in session:
            user = User.query.get(session['user_id'])
        return render_template('lineage_visualization.html', nodes_json=nodes_json, links_json=links_json, user=user)
    except Exception as e:
        current_app.logger.error(f"Error in lineage_visualization: {e}")
        return render_template('lineage_visualization.html', nodes_json=json.dumps([]), links_json=json.dumps([]),
                               error_message=f"Unable to load lineage data. Error: {str(e)}")


@main_bp.route('/lineage_visualization')
def lineage_visualization_alias():
    return lineage_visualization()


@main_bp.route('/favicon.ico')
def favicon():
    return '', 204


@main_bp.route('/geocoding-test')
def geocoding_test():
    if not current_app.debug:
        abort(404)
    return render_template('geocoding_test.html')
