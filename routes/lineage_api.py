from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, current_app, make_response, g
from sqlalchemy.orm import joinedload
from utils import audit_log, require_permission
from models import Clergy, User, db, Organization, Rank, Ordination, Consecration, Status
from constants import GREEN_COLOR, BLACK_COLOR
import json
import base64

lineage_api_bp = Blueprint('lineage_api', __name__)


@lineage_api_bp.route('/clergy/lineage-data')
def get_lineage_data():
    """API endpoint to get lineage data as JSON for AJAX requests"""
    try:
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()
        if ordination_count == 0 and consecration_count == 0:
            current_app.logger.info("No lineage data found, creating synthetic data...")
            from datetime import datetime
            all_clergy = Clergy.query.options(
                joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
                joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
                joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
            ).filter(Clergy.is_deleted != True).all()
            bishops = [c for c in all_clergy if c.rank and 'bishop' in c.rank.lower()]
            priests = [c for c in all_clergy if c.rank and 'priest' in c.rank.lower()]
            for priest in priests[:10]:
                if bishops:
                    ordination = Ordination(
                        clergy_id=priest.id,
                        date=datetime.now().date(),
                        ordaining_bishop_id=bishops[0].id,
                        is_sub_conditione=False,
                        is_doubtful=False,
                        is_invalid=False,
                        notes=f"Synthetic ordination for {priest.name}",
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    db.session.add(ordination)
            for bishop in bishops[1:]:
                consecration = Consecration(
                    clergy_id=bishop.id,
                    date=datetime.now().date(),
                    consecrator_id=bishops[0].id,
                    is_sub_conditione=False,
                    is_doubtful=False,
                    is_invalid=False,
                    notes=f"Synthetic consecration for {bishop.name}",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.session.add(consecration)
            db.session.commit()
            current_app.logger.info("Synthetic lineage data created successfully")
    except Exception as e:
        current_app.logger.error(f"Error checking data counts: {e}")

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
                ordination_date = po.date.strftime('%Y-%m-%d') if po.date else None
            elif clergy.ordinations:
                fo = sorted(clergy.ordinations, key=lambda x: x.date)[0]
                ordination_date = fo.date.strftime('%Y-%m-%d') if fo.date else None
            consecration_date = None
            pc = clergy.get_primary_consecration()
            if pc:
                consecration_date = pc.date.strftime('%Y-%m-%d') if pc.date else None
            elif clergy.consecrations:
                fc = sorted(clergy.consecrations, key=lambda x: x.date)[0]
                consecration_date = fc.date.strftime('%Y-%m-%d') if fc.date else None
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
                        'date': ordination.date.strftime('%Y-%m-%d') if ordination.date else '',
                        'color': BLACK_COLOR,
                        'is_invalid': ordination.is_invalid, 'is_doubtfully_valid': ordination.is_doubtfully_valid,
                        'is_doubtful_event': ordination.is_doubtful_event, 'is_sub_conditione': ordination.is_sub_conditione
                    })
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator:
                    links.append({
                        'source': consecration.consecrator.id, 'target': clergy.id, 'type': 'consecration',
                        'date': consecration.date.strftime('%Y-%m-%d') if consecration.date else '',
                        'color': GREEN_COLOR,
                        'is_invalid': consecration.is_invalid, 'is_doubtfully_valid': consecration.is_doubtfully_valid,
                        'is_doubtful_event': consecration.is_doubtful_event, 'is_sub_conditione': consecration.is_sub_conditione
                    })
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                for co_consecrator in consecration.co_consecrators:
                    links.append({
                        'source': co_consecrator.id, 'target': clergy.id, 'type': 'co-consecration',
                        'date': consecration.date.strftime('%Y-%m-%d') if consecration.date else '',
                        'color': GREEN_COLOR, 'dashed': True,
                        'is_invalid': consecration.is_invalid, 'is_doubtfully_valid': consecration.is_doubtfully_valid,
                        'is_doubtful_event': consecration.is_doubtful_event, 'is_sub_conditione': consecration.is_sub_conditione
                    })
        return jsonify({'success': True, 'nodes': nodes, 'links': links})
    except Exception as e:
        current_app.logger.error(f"Error in get_lineage_data: {e}")
        return jsonify({'success': False, 'message': 'Unable to load lineage data. Please try again later.'}), 500


@lineage_api_bp.route('/clergy/modal/add')
@require_permission('add_clergy')
def clergy_modal_add():
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    all_clergy_data = [{'id': c.id, 'name': getattr(c, 'display_name', c.name), 'rank': c.rank, 'organization': c.organization} for c in all_clergy]
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    all_bishops = db.session.query(Clergy).join(Rank, Clergy.rank == Rank.name).filter(Rank.is_bishop == True, Clergy.is_deleted != True).all()
    all_bishops_suggested = [{'id': b.id, 'name': getattr(b, 'display_name', b.name), 'rank': b.rank, 'organization': b.organization} for b in all_bishops]
    user = User.query.get(session.get('user_id'))
    return render_template('_clergy_modal.html', clergy=None, action='add', all_clergy_data=all_clergy_data,
                           all_bishops_suggested=all_bishops_suggested, ranks=ranks, organizations=organizations, user=user)


@lineage_api_bp.route('/clergy/modal/<int:clergy_id>/edit')
@require_permission('edit_clergy')
def clergy_modal_edit(clergy_id):
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
    ).filter(Clergy.id == clergy_id).first_or_404()
    user = User.query.get(session.get('user_id'))
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    all_clergy_data = [{'id': c.id, 'name': getattr(c, 'display_name', c.name), 'rank': c.rank, 'organization': c.organization} for c in all_clergy]
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    all_bishops = db.session.query(Clergy).join(Rank, Clergy.rank == Rank.name).filter(Rank.is_bishop == True, Clergy.is_deleted != True).all()
    all_bishops_suggested = [{'id': b.id, 'name': getattr(b, 'display_name', b.name), 'rank': b.rank, 'organization': b.organization} for b in all_bishops]
    return render_template('_clergy_modal.html', clergy=clergy, action='edit', all_clergy_data=all_clergy_data,
                           all_bishops_suggested=all_bishops_suggested, ranks=ranks, organizations=organizations, user=user)


@lineage_api_bp.route('/clergy/edit_from_lineage/<int:clergy_id>')
@require_permission('edit_clergy')
def edit_clergy_from_lineage(clergy_id):
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
    ).filter(Clergy.id == clergy_id).first_or_404()
    user = User.query.get(session.get('user_id'))
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    all_clergy_data = [{'id': c.id, 'name': getattr(c, 'display_name', c.name), 'rank': c.rank, 'organization': c.organization} for c in all_clergy]
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    all_bishops = db.session.query(Clergy).join(Rank, Clergy.rank == Rank.name).filter(Rank.is_bishop == True, Clergy.is_deleted != True).all()
    all_bishops_suggested = [{'id': b.id, 'name': getattr(b, 'display_name', b.name), 'rank': b.rank, 'organization': b.organization} for b in all_bishops]
    return render_template('_clergy_form_modal.html', fields={
        'form_action': url_for('clergy.edit_clergy', clergy_id=clergy_id),
        'ranks': ranks, 'organizations': organizations, 'cancel_url': '#'
    }, clergy=clergy, edit_mode=True, user=user, all_clergy_data=all_clergy_data, all_bishops_suggested=all_bishops_suggested)


@lineage_api_bp.route('/clergy/modal/<int:clergy_id>/comment')
def clergy_modal_comment(clergy_id):
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
    ).filter(Clergy.id == clergy_id).first_or_404()
    return render_template('_clergy_comment_modal.html', clergy=clergy)


@lineage_api_bp.route('/clergy/relationships/<int:clergy_id>')
def clergy_relationships(clergy_id):
    try:
        clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.id == clergy_id).first_or_404()
        ordaining_bishop = None
        po = clergy.get_primary_ordination()
        if po and po.ordaining_bishop:
            ordaining_bishop = po.ordaining_bishop
        consecrator = None
        pc = clergy.get_primary_consecration()
        if pc and pc.consecrator:
            consecrator = pc.consecrator
        ordained_clergy = db.session.query(Clergy).join(Ordination, Clergy.id == Ordination.clergy_id).filter(
            Ordination.ordaining_bishop_id == clergy_id, Clergy.is_deleted == False
        ).all()
        consecrated_clergy = db.session.query(Clergy).join(Consecration, Clergy.id == Consecration.clergy_id).filter(
            Consecration.consecrator_id == clergy_id, Clergy.is_deleted == False
        ).all()
        co_consecrated_clergy = []
        for cons in clergy.consecrations:
            for cc in cons.co_consecrators:
                if not cc.is_deleted:
                    co_consecrated_clergy.append(cc)
        def _name(c):
            return c.papal_name if (c.rank and c.rank.lower() == 'pope' and c.papal_name) else c.name
        return jsonify({
            'success': True,
            'ordaining_bishop': {'id': ordaining_bishop.id, 'name': _name(ordaining_bishop)} if ordaining_bishop else None,
            'consecrator': {'id': consecrator.id, 'name': _name(consecrator)} if consecrator else None,
            'ordained_clergy': [{'id': c.id, 'name': _name(c), 'rank': c.rank, 'organization': c.organization} for c in ordained_clergy],
            'consecrated_clergy': [{'id': c.id, 'name': _name(c), 'rank': c.rank, 'organization': c.organization} for c in consecrated_clergy],
            'co_consecrated_clergy': [{'id': c.id, 'name': _name(c), 'rank': c.rank, 'organization': c.organization} for c in co_consecrated_clergy]
        })
    except Exception as e:
        current_app.logger.error(f"Error getting clergy relationships: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@lineage_api_bp.route('/clergy/info-panel')
def clergy_info_panel():
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    return render_template('_clergy_info_panel.html', user=user)


@lineage_api_bp.route('/debug-lineage')
def debug_lineage():
    from flask import abort
    if not current_app.debug:
        abort(404)
    try:
        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.is_deleted != True).all()
        organizations = {org.name: org.color for org in Organization.query.all()}
        ranks = {rank.name: rank.color for rank in Rank.query.all()}
        nodes = []
        links = []
        for clergy in all_clergy:
            nodes.append({
                'id': clergy.id,
                'name': clergy.papal_name if (clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name) else clergy.name,
                'rank': clergy.rank, 'organization': clergy.organization,
                'org_color': organizations.get(clergy.organization) or '#2c3e50',
                'rank_color': ranks.get(clergy.rank) or '#888888'
            })
        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop:
                    links.append({'source': ordination.ordaining_bishop.id, 'target': clergy.id, 'type': 'ordination',
                                 'date': ordination.date.strftime('%Y-%m-%d') if ordination.date else '', 'color': BLACK_COLOR})
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator:
                    links.append({'source': consecration.consecrator.id, 'target': clergy.id, 'type': 'consecration',
                                 'date': consecration.date.strftime('%Y-%m-%d') if consecration.date else '', 'color': GREEN_COLOR})
        return jsonify({
            'nodes_count': len(nodes), 'links_count': len(links),
            'nodes': nodes[:5], 'links': links[:5],
            'sample_ordination_links': [l for l in links if l['type'] == 'ordination'][:3],
            'sample_consecration_links': [l for l in links if l['type'] == 'consecration'][:3]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lineage_api_bp.route('/clergy/add_from_lineage', methods=['GET', 'POST'])
@audit_log(
    action='create',
    entity_type='clergy',
    get_entity_id=lambda clergy: clergy.id if clergy else None,
    get_entity_name=lambda clergy: clergy.name if clergy else None,
    get_details=lambda clergy: {
        'rank': clergy.rank, 'organization': clergy.organization,
        'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
        'ordinations_count': len(clergy.ordinations), 'consecrations_count': len(clergy.consecrations),
        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None
    } if clergy else None
)
@require_permission('add_clergy')
def add_clergy_from_lineage():
    from services import clergy as clergy_service
    context_type = request.args.get('context_type')
    context_clergy_id = request.args.get('context_clergy_id')
    if request.method == 'POST':
        try:
            clergy = clergy_service.create_clergy_from_form(request.form)
            is_htmx = request.headers.get('HX-Request') == 'true'
            if is_htmx:
                response = make_response('<script>window.location.href = "' + url_for('main.index') + '";</script>')
                response.headers['HX-Trigger'] = 'redirect'
                return response
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return jsonify({'success': True, 'message': 'Clergy record added successfully!', 'redirect': url_for('main.index')})
            flash('Clergy record added successfully!', 'success')
            return redirect(url_for('main.index'))
        except Exception as e:
            db.session.rollback()
            is_htmx = request.headers.get('HX-Request') == 'true'
            if is_htmx:
                return make_response(f'<div class="alert alert-danger">Error: {str(e)}</div>'), 400
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return jsonify({'success': False, 'message': str(e)}), 400
            flash('Error adding clergy record.', 'error')
            return redirect(url_for('main.index'))
    user = User.query.get(session.get('user_id'))
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    all_clergy_data = [{'id': c.id, 'name': getattr(c, 'display_name', c.name), 'rank': c.rank, 'organization': c.organization} for c in all_clergy]
    all_bishops = Clergy.query.filter(Clergy.rank.ilike('%bishop%'), Clergy.is_deleted != True).order_by(Clergy.name).all()
    all_bishops_suggested = [{'id': b.id, 'name': getattr(b, 'display_name', b.name), 'rank': b.rank, 'organization': b.organization} for b in all_bishops]
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    statuses = Status.query.order_by(Status.badge_position, Status.name).all()
    return render_template('_clergy_form_modal.html',
                         fields={
                             'form_action': url_for('lineage_api.add_clergy_from_lineage'),
                             'ranks': ranks, 'organizations': organizations, 'statuses': statuses,
                             'cancel_url': url_for('main.index')
                         },
                         edit_mode=False, user=user, redirect_url=url_for('main.index'), use_htmx=True,
                         context_type=context_type, context_clergy_id=context_clergy_id,
                         all_bishops_suggested=all_bishops_suggested)
