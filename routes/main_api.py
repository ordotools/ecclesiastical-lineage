from flask import Blueprint, request, jsonify, current_app, Response, abort
from services.geocoding import geocoding_service
from utils import require_permission_api, log_audit_event
from models import Clergy, db, Organization, Location
import os
import requests

main_api_bp = Blueprint('main_api', __name__)


@main_api_bp.route('/api/check-and-create-bishops', methods=['POST'])
@require_permission_api('add_clergy')
def check_and_create_bishops():
    try:
        data = request.get_json()
        bishop_names = data.get('bishop_names', [])
        if not bishop_names:
            return jsonify({'success': True, 'bishop_mapping': {}, 'newly_created_bishop_ids': []})
        bishop_mapping = {}
        newly_created_ids = []
        for name in bishop_names:
            name = name.strip()
            if not name:
                continue
            existing_bishop = Clergy.query.filter_by(name=name).first()
            if existing_bishop:
                bishop_mapping[name] = existing_bishop.id
            else:
                new_bishop = Clergy(name=name, rank='Bishop', notes=f'Auto-created bishop record for {name}')
                db.session.add(new_bishop)
                db.session.flush()
                bishop_mapping[name] = new_bishop.id
                newly_created_ids.append(new_bishop.id)
                log_audit_event(action='create', entity_type='clergy', entity_id=new_bishop.id, entity_name=new_bishop.name,
                               details={'rank': new_bishop.rank, 'auto_created': True, 'reason': 'Missing bishop for ordination/consecration'})
        db.session.commit()
        return jsonify({
            'success': True,
            'bishop_mapping': bishop_mapping,
            'newly_created_bishop_ids': newly_created_ids,
            'message': f'Created {len(newly_created_ids)} new bishop records'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating bishops: {str(e)}')
        return jsonify({'success': False, 'message': f'Error creating bishops: {str(e)}'}), 500


@main_api_bp.route('/api/check-and-create-pastor', methods=['POST'])
@require_permission_api('add_clergy')
def check_and_create_pastor():
    try:
        data = request.get_json()
        pastor_name = data.get('pastor_name', '').strip()
        if not pastor_name:
            return jsonify({'success': True, 'pastor_id': None})
        existing_pastor = Clergy.query.filter_by(name=pastor_name).first()
        if existing_pastor:
            return jsonify({'success': True, 'pastor_id': existing_pastor.id, 'pastor_name': existing_pastor.name, 'created': False})
        new_pastor = Clergy(name=pastor_name, rank='Pastor', notes=f'Auto-created pastor record for {pastor_name}')
        db.session.add(new_pastor)
        db.session.flush()
        log_audit_event(action='create', entity_type='clergy', entity_id=new_pastor.id, entity_name=new_pastor.name,
                       details={'rank': new_pastor.rank, 'auto_created': True, 'reason': 'Missing pastor for chapel/location'})
        db.session.commit()
        return jsonify({'success': True, 'pastor_id': new_pastor.id, 'pastor_name': new_pastor.name, 'created': True, 'message': f'Created new pastor record for {pastor_name}'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating pastor: {str(e)}')
        return jsonify({'success': False, 'message': f'Error creating pastor: {str(e)}'}), 500


@main_api_bp.route('/api/test-locations-add', methods=['POST'])
def test_add_location():
    if not current_app.debug:
        abort(404)
    try:
        organization_id = request.form.get('organization_id')
        organization_id = int(organization_id) if organization_id else None
        location = Location(
            name=request.form['name'],
            address=request.form.get('street_address'),
            city=request.form.get('city'),
            state_province=request.form.get('state_province'),
            country=request.form.get('country'),
            postal_code=request.form.get('postal_code'),
            latitude=float(request.form['latitude']) if request.form.get('latitude') else None,
            longitude=float(request.form['longitude']) if request.form.get('longitude') else None,
            location_type=request.form.get('location_type', 'church'),
            pastor_name=request.form.get('pastor_name'),
            organization=request.form.get('organization'),
            organization_id=organization_id,
            notes=request.form.get('notes'),
            deleted=False,
            created_by=None
        )
        db.session.add(location)
        db.session.commit()
        db.session.refresh(location)
        return jsonify({
            'success': True, 'message': 'Test location added successfully!',
            'location': {
                'id': location.id, 'name': location.name, 'address': location.address, 'city': location.city,
                'state_province': location.state_province, 'country': location.country, 'postal_code': location.postal_code,
                'latitude': location.latitude, 'longitude': location.longitude, 'location_type': location.location_type,
                'pastor_name': location.pastor_name, 'organization': location.organization, 'organization_id': location.organization_id,
                'organization_name': location.organization_obj.name if location.organization_obj else None,
                'notes': location.notes, 'deleted': location.deleted
            }
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding test location: {e}")
        return jsonify({'success': False, 'message': f'Error adding location: {str(e)}'}), 500


@main_api_bp.route('/init-db')
def init_db():
    if not current_app.debug:
        secret = request.args.get('secret')
        if not secret or secret != os.environ.get('INIT_DB_SECRET'):
            abort(404)
    return jsonify({'success': False, 'message': 'Not implemented yet'}), 501


@main_api_bp.route('/api/process-cropped-image', methods=['POST'])
@require_permission_api('edit_clergy')
def process_cropped_image():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        cropped_image_data = data.get('cropped_image_data')
        clergy_id = data.get('clergy_id')
        original_object_key = data.get('original_object_key')
        if not cropped_image_data or not clergy_id:
            return jsonify({'success': False, 'error': 'Missing required parameters'}), 400
        from services.image_upload import get_image_upload_service
        image_upload_service = get_image_upload_service()
        result = image_upload_service.process_cropped_image(cropped_image_data, clergy_id, original_object_key)
        if result['success']:
            return jsonify({'success': True, 'image_data': result['urls']})
        return jsonify({'success': False, 'error': result['error']}), 500
    except Exception as e:
        current_app.logger.error(f"Error processing cropped image: {e}")
        return jsonify({'success': False, 'error': str(e)})


@main_api_bp.route('/api/organizations')
def api_organizations():
    try:
        organizations = Organization.query.all()
        org_data = [{'id': org.id, 'name': org.name, 'abbreviation': org.abbreviation, 'description': org.description, 'color': org.color} for org in organizations]
        return jsonify({'success': True, 'organizations': org_data, 'count': len(org_data)})
    except Exception as e:
        current_app.logger.error(f"Error getting organization data: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@main_api_bp.route('/proxy-image')
def proxy_image():
    image_url = request.args.get('url')
    if not image_url:
        return 'Missing URL parameter', 400
    try:
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        return Response(
            response.content,
            mimetype=response.headers.get('content-type', 'image/jpeg'),
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=3600'
            }
        )
    except requests.RequestException as e:
        current_app.logger.error(f"Error proxying image {image_url}: {e}")
        return 'Error fetching image', 500


@main_api_bp.route('/api/geocode', methods=['POST'])
def geocode_address():
    try:
        data = request.get_json()
        address = data.get('address', '').strip()
        if not address:
            return jsonify({'error': 'Address is required'}), 400
        if not geocoding_service.is_configured():
            return jsonify({'error': 'Geocoding service not configured'}), 503
        result = geocoding_service.geocode_address(address)
        if result:
            return jsonify({
                'success': True, 'latitude': result['latitude'], 'longitude': result['longitude'],
                'formatted_address': result['formatted_address'], 'city': result.get('city'), 'state': result.get('state'),
                'country': result.get('country'), 'postcode': result.get('postcode'), 'confidence': result.get('confidence', 0)
            })
        return jsonify({'error': 'Address not found'}), 404
    except Exception as e:
        current_app.logger.error(f"Geocoding error: {e}")
        return jsonify({'error': 'Geocoding failed'}), 500


@main_api_bp.route('/api/reverse-geocode', methods=['POST'])
def reverse_geocode():
    try:
        data = request.get_json()
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        if latitude is None or longitude is None:
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        if not geocoding_service.is_configured():
            return jsonify({'error': 'Geocoding service not configured'}), 503
        result = geocoding_service.reverse_geocode(float(latitude), float(longitude))
        if result:
            return jsonify({
                'success': True, 'formatted_address': result['formatted_address'],
                'city': result.get('city'), 'state': result.get('state'), 'country': result.get('country'),
                'postcode': result.get('postcode'), 'confidence': result.get('confidence', 0)
            })
        return jsonify({'error': 'Address not found for coordinates'}), 404
    except Exception as e:
        current_app.logger.error(f"Reverse geocoding error: {e}")
        return jsonify({'error': 'Reverse geocoding failed'}), 500


@main_api_bp.route('/api/geocoding-status', methods=['GET'])
def geocoding_status():
    return jsonify({
        'configured': geocoding_service.is_configured(),
        'service': 'OpenCage' if geocoding_service.is_configured() else None
    })


_COUNTRIES_LIST = [
    'United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica',
    'Haiti', 'Dominican Republic', 'Puerto Rico', 'Trinidad and Tobago', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela',
    'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname', 'United Kingdom', 'Ireland', 'France', 'Germany', 'Italy', 'Spain',
    'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria',
    'Greece', 'Croatia', 'Slovenia', 'Serbia', 'Montenegro', 'Bosnia and Herzegovina', 'Macedonia', 'Albania', 'Moldova', 'Ukraine', 'Belarus',
    'Lithuania', 'Latvia', 'Estonia', 'Finland', 'Sweden', 'Norway', 'Denmark', 'Iceland', 'Russia', 'Turkey', 'China', 'Japan', 'South Korea',
    'North Korea', 'Mongolia', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Myanmar', 'Thailand', 'Vietnam', 'Laos', 'Cambodia',
    'Malaysia', 'Singapore', 'Indonesia', 'Philippines', 'Brunei', 'Taiwan', 'Hong Kong', 'Macau', 'Afghanistan', 'Iran', 'Iraq', 'Israel', 'Palestine',
    'Jordan', 'Lebanon', 'Syria', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Kuwait', 'Oman', 'Yemen', 'Kazakhstan', 'Uzbekistan',
    'Turkmenistan', 'Tajikistan', 'Kyrgyzstan', 'Georgia', 'Armenia', 'Azerbaijan', 'Egypt', 'Libya', 'Tunisia', 'Algeria', 'Morocco', 'Sudan',
    'South Sudan', 'Ethiopia', 'Eritrea', 'Djibouti', 'Somalia', 'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Burundi', 'Democratic Republic of the Congo',
    'Republic of the Congo', 'Central African Republic', 'Chad', 'Cameroon', 'Nigeria', 'Niger', 'Mali', 'Burkina Faso', 'Senegal', 'Gambia',
    'Guinea-Bissau', 'Guinea', 'Sierra Leone', 'Liberia', 'Ivory Coast', 'Ghana', 'Togo', 'Benin', 'South Africa', 'Namibia', 'Botswana', 'Zimbabwe',
    'Zambia', 'Malawi', 'Mozambique', 'Madagascar', 'Mauritius', 'Seychelles', 'Comoros', 'Angola', 'Equatorial Guinea', 'Gabon', 'São Tomé and Príncipe',
    'Cape Verde', 'Mauritania', 'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands', 'Vanuatu', 'New Caledonia', 'Samoa', 'Tonga',
    'Kiribati', 'Tuvalu', 'Nauru', 'Palau', 'Marshall Islands', 'Micronesia', 'Vatican City', 'San Marino', 'Monaco', 'Liechtenstein', 'Andorra',
    'Greenland', 'Faroe Islands', 'Bermuda', 'Cayman Islands', 'British Virgin Islands', 'US Virgin Islands', 'Guam', 'Northern Mariana Islands',
    'American Samoa', 'Cook Islands', 'French Polynesia', 'Wallis and Futuna', 'Pitcairn Islands', 'Falkland Islands',
    'South Georgia and South Sandwich Islands', 'Antarctica'
]


@main_api_bp.route('/api/countries')
def api_countries():
    try:
        countries = list(_COUNTRIES_LIST)
        existing_countries = db.session.query(Location.country).filter(
            Location.country.isnot(None), Location.country != ''
        ).distinct().all()
        existing_names = {c[0] for c in existing_countries if c[0]}
        for name in existing_names:
            if name not in countries:
                countries.append(name)
        country_list = sorted([{'name': c} for c in countries], key=lambda x: x['name'])
        return jsonify({'success': True, 'countries': country_list})
    except Exception as e:
        current_app.logger.error(f"Error getting countries: {e}")
        return jsonify({'error': 'Failed to get countries'}), 500


@main_api_bp.route('/api/living-clergy')
def api_living_clergy():
    try:
        from datetime import date
        living_clergy = Clergy.query.filter(
            Clergy.is_deleted != True,
            db.or_(Clergy.date_of_death.is_(None), Clergy.date_of_death > date.today())
        ).order_by(Clergy.name).all()
        clergy_list = [{'id': p.id, 'name': p.name, 'rank': p.rank or 'Unknown', 'organization': p.organization or ''} for p in living_clergy]
        return jsonify({'success': True, 'clergy': clergy_list})
    except Exception as e:
        current_app.logger.error(f"Error getting living clergy: {e}")
        return jsonify({'error': 'Failed to get clergy list'}), 500
