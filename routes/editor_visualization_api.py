"""Editor visualization and sprite-sheet API routes."""
from flask import request, jsonify, current_app
from routes.editor_bp import editor_bp
from utils import require_permission_api
from models import Clergy, Organization, Rank, Ordination, Consecration, VisualizationSettings, SpriteSheet, ClergySpritePosition, db
from constants import GREEN_COLOR, BLACK_COLOR
from datetime import datetime
import json
import base64


@editor_bp.route('/api/visualization/data')
def get_visualization_data():
    """API endpoint for soft refresh - returns JSON data without HTML template"""
    try:
        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        organizations = {org.name: org.color for org in Organization.query.all()}
        ranks = {rank.name: rank.color for rank in Rank.query.all()}

        placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
        placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')

        nodes = []
        links = []

        for clergy in all_clergy:
            node_color = '#3498db'
            if clergy.organization and clergy.organization in organizations:
                node_color = organizations[clergy.organization]
            elif clergy.rank and clergy.rank in ranks:
                node_color = ranks[clergy.rank]

            image_url = placeholder_data_url
            if clergy.image_data:
                try:
                    image_data = json.loads(clergy.image_data)
                    image_url = image_data.get('lineage', image_data.get('detail', image_data.get('original', '')))
                except (json.JSONDecodeError, AttributeError):
                    pass

            if not image_url or image_url == placeholder_data_url:
                image_url = clergy.image_url if clergy.image_url else placeholder_data_url

            nodes.append({
                'id': clergy.id,
                'name': clergy.name,
                'papal_name': clergy.papal_name if hasattr(clergy, 'papal_name') else None,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'org_color': node_color,
                'rank_color': node_color,
                'image_url': image_url,
                'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
                'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                'is_deleted': clergy.is_deleted
            })

        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop and not ordination.ordaining_bishop.is_deleted:
                    links.append({
                        'source': ordination.ordaining_bishop.id,
                        'target': clergy.id,
                        'type': 'ordination',
                        'color': BLACK_COLOR,
                        'date': ordination.display_date,
                        'is_sub_conditione': ordination.is_sub_conditione,
                        'is_doubtfully_valid': ordination.is_doubtfully_valid,
                        'is_doubtful_event': ordination.is_doubtful_event,
                        'is_invalid': ordination.is_invalid
                    })

        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator and not consecration.consecrator.is_deleted:
                    links.append({
                        'source': consecration.consecrator.id,
                        'target': clergy.id,
                        'type': 'consecration',
                        'color': GREEN_COLOR,
                        'date': consecration.display_date,
                        'is_sub_conditione': consecration.is_sub_conditione,
                        'is_doubtfully_valid': consecration.is_doubtfully_valid,
                        'is_doubtful_event': consecration.is_doubtful_event,
                        'is_invalid': consecration.is_invalid
                    })

        return jsonify({
            'success': True,
            'nodes': nodes,
            'links': links
        })

    except Exception as e:
        current_app.logger.error(f"Error in visualization data API: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'nodes': [],
            'links': []
        }), 500


@editor_bp.route('/api/visualization/styles', methods=['GET'])
def get_visualization_styles():
    """Get current visualization style preferences (public endpoint)"""
    try:
        settings = VisualizationSettings.query.filter_by(setting_key='visualization_styles').first()

        if settings:
            styles = json.loads(settings.setting_value)
            return jsonify({
                'success': True,
                'styles': styles
            })
        else:
            default_styles = {
                'node': {
                    'outer_radius': 30,
                    'inner_radius': 24,
                    'image_size': 48,
                    'stroke_width': 3
                },
                'link': {
                    'ordination_color': '#1c1c1c',
                    'consecration_color': '#11451e',
                    'stroke_width': 2
                },
                'label': {
                    'font_size': 12,
                    'color': '#ffffff',
                    'dy': 35
                }
            }
            return jsonify({
                'success': True,
                'styles': default_styles
            })

    except Exception as e:
        current_app.logger.error(f"Error getting visualization styles: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@editor_bp.route('/api/visualization/styles', methods=['POST'])
def save_visualization_styles():
    """Save visualization style preferences (public endpoint - no auth required)"""
    try:
        data = request.get_json()

        if not data or 'styles' not in data:
            return jsonify({
                'success': False,
                'error': 'Invalid request: styles data required'
            }), 400

        styles = data['styles']

        required_keys = ['node', 'link', 'label']
        for key in required_keys:
            if key not in styles:
                return jsonify({
                    'success': False,
                    'error': f'Invalid styles: missing {key} section'
                }), 400

        settings = VisualizationSettings.query.filter_by(setting_key='visualization_styles').first()

        if settings:
            settings.setting_value = json.dumps(styles)
            settings.updated_at = datetime.utcnow()
        else:
            settings = VisualizationSettings(
                setting_key='visualization_styles',
                setting_value=json.dumps(styles),
                updated_at=datetime.utcnow()
            )
            db.session.add(settings)

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Styles saved successfully'
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error saving visualization styles: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@editor_bp.route('/api/sprite-sheet')
def get_sprite_sheet():
    """API endpoint to get the current sprite sheet URL and mapping"""
    try:
        sprite_sheet = SpriteSheet.query.filter_by(is_current=True).first()

        if sprite_sheet:
            positions = ClergySpritePosition.query.filter_by(sprite_sheet_id=sprite_sheet.id).all()
            mapping = {pos.clergy_id: (pos.x_position, pos.y_position) for pos in positions}

            return jsonify({
                'success': True,
                'url': sprite_sheet.url,
                'mapping': mapping,
                'thumbnail_size': sprite_sheet.thumbnail_size,
                'images_per_row': sprite_sheet.images_per_row,
                'sprite_width': sprite_sheet.sprite_width,
                'sprite_height': sprite_sheet.sprite_height
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No sprite sheet exists. Please upload or edit an image to generate one.'
            }), 404

    except Exception as e:
        current_app.logger.error(f"Error getting sprite sheet: {e}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@editor_bp.route('/api/sprite-sheet-status')
@require_permission_api('edit_clergy')
def get_sprite_sheet_status():
    """API endpoint to check spritesheet generation status"""
    try:
        from services.clergy import get_sprite_sheet_status
        status = get_sprite_sheet_status()

        if status.get('status') == 'completed':
            try:
                sprite_sheet = SpriteSheet.query.filter_by(id=status.get('sprite_sheet_id')).first()
                if sprite_sheet:
                    positions = ClergySpritePosition.query.filter_by(sprite_sheet_id=sprite_sheet.id).all()
                    mapping = {pos.clergy_id: (pos.x_position, pos.y_position) for pos in positions}

                    return jsonify({
                        'success': True,
                        'status': 'completed',
                        'url': sprite_sheet.url,
                        'mapping': mapping,
                        'thumbnail_size': sprite_sheet.thumbnail_size,
                        'images_per_row': sprite_sheet.images_per_row,
                        'sprite_width': sprite_sheet.sprite_width,
                        'sprite_height': sprite_sheet.sprite_height,
                        'completed_at': status.get('completed_at')
                    })
            except Exception as db_error:
                current_app.logger.warning(f"Could not fetch sprite sheet data: {db_error}")
                return jsonify({
                    'success': True,
                    'status': 'completed',
                    'url': status.get('url'),
                    'mapping': status.get('mapping', {}),
                    'completed_at': status.get('completed_at')
                })

        return jsonify({
            'success': True,
            'status': status.get('status', 'idle'),
            'error': status.get('error'),
            'started_at': status.get('started_at'),
            'clergy_id': status.get('clergy_id')
        })

    except Exception as e:
        current_app.logger.error(f"Error getting sprite sheet status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
