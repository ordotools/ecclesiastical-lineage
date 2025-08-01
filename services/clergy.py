from flask import render_template, request, redirect, url_for, flash, session, jsonify
from models import db, Clergy, Rank, Organization, User, ClergyComment
from utils import generate_breadcrumbs, log_audit_event
from datetime import datetime
import json

def create_clergy_from_form(form):
    clergy = Clergy()
    clergy.name = form.get('name')
    clergy.rank = form.get('rank')
    clergy.organization = form.get('organization')
    date_of_birth = form.get('date_of_birth')
    date_of_ordination = form.get('date_of_ordination')
    date_of_consecration = form.get('date_of_consecration')
    date_of_death = form.get('date_of_death')
    clergy.notes = form.get('notes')
    if date_of_birth:
        clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
    if date_of_ordination:
        clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
    if date_of_consecration:
        clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
    if date_of_death:
        clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
    # Optional: handle ordaining_bishop_id, consecrator_id, co_consecrators if present
    ordaining_bishop_id = form.get('ordaining_bishop_id')
    if ordaining_bishop_id:
        clergy.ordaining_bishop_id = int(ordaining_bishop_id)
    consecrator_id = form.get('consecrator_id')
    if consecrator_id:
        clergy.consecrator_id = int(consecrator_id)
    co_consecrators = form.get('co_consecrators')
    if co_consecrators:
        co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
        clergy.set_co_consecrators(co_consecrator_ids)
    db.session.add(clergy)
    db.session.commit()
    return clergy

def clergy_list_handler():
    if 'user_id' not in session:
        flash('Please log in to access clergy records.', 'error')
        return redirect(url_for('auth.login'))
    exclude_priests = request.args.get('exclude_priests') == '1'
    exclude_coconsecrators = request.args.get('exclude_coconsecrators') == '1'
    exclude_organizations = request.args.getlist('exclude_organizations')
    search = request.args.get('search', '').strip()
    query = Clergy.query
    if exclude_priests:
        query = query.filter(Clergy.rank != 'Priest')
    if exclude_coconsecrators:
        all_clergy = Clergy.query.all()
        coconsecrator_ids = set()
        for c in all_clergy:
            coconsecrator_ids.update(c.get_co_consecrators())
        if coconsecrator_ids:
            query = query.filter(~Clergy.id.in_(coconsecrator_ids))
    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))
    if search:
        query = query.filter(Clergy.name.ilike(f'%{search}%'))
    clergy_list = query.all()
    for clergy in clergy_list:
        if clergy.rank.lower() == 'bishop':
            clergy.display_name = f"Most. Rev. {clergy.name}"
        elif clergy.rank.lower() == 'priest':
            clergy.display_name = f"Rev. {clergy.name}"
        else:
            clergy.display_name = clergy.name
    organizations = Organization.query.order_by(Organization.name).all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    ranks = Rank.query.order_by(Rank.name).all()
    all_clergy = Clergy.query.all()
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
    breadcrumbs = generate_breadcrumbs('clergy_list')
    return render_template('clergy_list.html', 
                         clergy_list=clergy_list, 
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         breadcrumbs=breadcrumbs,
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
            clergy = create_clergy_from_form(request.form)
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return clergy, jsonify({'success': True, 'message': 'Clergy record added successfully!'})
            flash('Clergy record added successfully!', 'success')
            return clergy, redirect(url_for('clergy.clergy_list'))
        except Exception as e:
            db.session.rollback()
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return None, jsonify({'success': False, 'message': str(e)}), 400
            flash('Error adding clergy record.', 'error')
            return None, render_template('add_clergy.html')
    # ... (rest of GET logic unchanged, but return as (None, response)) ...
    # You may need to pass the same context as in clergy_list_handler for GET
    all_clergy = Clergy.query.all()
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    breadcrumbs = generate_breadcrumbs('add_clergy')
    return None, render_template('add_clergy.html', 
                         all_clergy=all_clergy, 
                         all_clergy_data=all_clergy_data,
                         ranks=ranks,
                         organizations=organizations,
                         breadcrumbs=breadcrumbs) 

def view_clergy_handler(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to view clergy records.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    clergy = Clergy.query.get_or_404(clergy_id)
    if user.can_edit_clergy():
        return redirect(url_for('clergy.edit_clergy', clergy_id=clergy_id))
    organizations = Organization.query.all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    comments = ClergyComment.query.filter_by(clergy_id=clergy_id, is_public=True, is_resolved=False).order_by(ClergyComment.created_at.desc()).all()
    breadcrumbs = generate_breadcrumbs('view_clergy', clergy=clergy)
    return render_template('clergy_detail_with_comments.html', 
                         clergy=clergy, 
                         user=user,
                         comments=comments,
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         breadcrumbs=breadcrumbs)

def edit_clergy_handler(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to edit clergy records.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    clergy = Clergy.query.get_or_404(clergy_id)
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
                clergy.organization = request.form.get('organization')
                date_of_birth = request.form.get('date_of_birth')
                date_of_ordination = request.form.get('date_of_ordination')
                ordaining_bishop_id = request.form.get('ordaining_bishop_id')
                ordaining_bishop_input = request.form.get('ordaining_bishop_input')
                date_of_consecration = request.form.get('date_of_consecration')
                consecrator_id = request.form.get('consecrator_id')
                consecrator_input = request.form.get('consecrator_input')
                co_consecrators = request.form.get('co_consecrators')
                date_of_death = request.form.get('date_of_death')
                clergy.notes = request.form.get('notes')
                if date_of_birth:
                    clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
                else:
                    clergy.date_of_birth = None
                if date_of_ordination:
                    clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
                else:
                    clergy.date_of_ordination = None
                if date_of_consecration:
                    clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
                else:
                    clergy.date_of_consecration = None
                if date_of_death:
                    clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
                else:
                    clergy.date_of_death = None
                if ordaining_bishop_id and ordaining_bishop_id != 'None':
                    clergy.ordaining_bishop_id = int(ordaining_bishop_id)
                elif ordaining_bishop_input:
                    existing = Clergy.query.filter_by(name=ordaining_bishop_input.strip()).first()
                    if existing:
                        clergy.ordaining_bishop_id = existing.id
                    else:
                        new_bishop = Clergy(name=ordaining_bishop_input.strip(), rank='Bishop')
                        db.session.add(new_bishop)
                        db.session.flush()
                        clergy.ordaining_bishop_id = new_bishop.id
                else:
                    clergy.ordaining_bishop_id = None
                if consecrator_id and consecrator_id != 'None':
                    clergy.consecrator_id = int(consecrator_id)
                elif consecrator_input:
                    existing = Clergy.query.filter_by(name=consecrator_input.strip()).first()
                    if existing:
                        clergy.consecrator_id = existing.id
                    else:
                        new_bishop = Clergy(name=consecrator_input.strip(), rank='Bishop')
                        db.session.add(new_bishop)
                        db.session.flush()
                        clergy.consecrator_id = new_bishop.id
                else:
                    clergy.consecrator_id = None
                if co_consecrators:
                    co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
                    clergy.set_co_consecrators(co_consecrator_ids)
                else:
                    clergy.set_co_consecrators([])
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
                        'date_of_ordination': clergy.date_of_ordination.isoformat() if clergy.date_of_ordination else None,
                        'date_of_consecration': clergy.date_of_consecration.isoformat() if clergy.date_of_consecration else None,
                        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                        'ordaining_bishop_id': clergy.ordaining_bishop_id,
                        'consecrator_id': clergy.consecrator_id,
                        'co_consecrators': clergy.get_co_consecrators()
                    }
                )
                return jsonify({'success': True, 'message': 'Clergy record updated successfully!'})
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': str(e)}), 400
        # Handle regular form submission (fallback)
        clergy.name = request.form.get('name')
        clergy.rank = request.form.get('rank')
        clergy.organization = request.form.get('organization')
        date_of_birth = request.form.get('date_of_birth')
        date_of_ordination = request.form.get('date_of_ordination')
        ordaining_bishop_id = request.form.get('ordaining_bishop_id')
        ordaining_bishop_input = request.form.get('ordaining_bishop_input')
        date_of_consecration = request.form.get('date_of_consecration')
        consecrator_id = request.form.get('consecrator_id')
        consecrator_input = request.form.get('consecrator_input')
        co_consecrators = request.form.get('co_consecrators')
        date_of_death = request.form.get('date_of_death')
        clergy.notes = request.form.get('notes')
        if date_of_birth:
            clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        else:
            clergy.date_of_birth = None
        if date_of_ordination:
            clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
        else:
            clergy.date_of_ordination = None
        if date_of_consecration:
            clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
        else:
            clergy.date_of_consecration = None
        if date_of_death:
            clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
        else:
            clergy.date_of_death = None
        if ordaining_bishop_id and ordaining_bishop_id != 'None':
            clergy.ordaining_bishop_id = int(ordaining_bishop_id)
        elif ordaining_bishop_input:
            existing = Clergy.query.filter_by(name=ordaining_bishop_input.strip()).first()
            if existing:
                clergy.ordaining_bishop_id = existing.id
            else:
                new_bishop = Clergy(name=ordaining_bishop_input.strip(), rank='Bishop')
                db.session.add(new_bishop)
                db.session.flush()
                clergy.ordaining_bishop_id = new_bishop.id
        else:
            clergy.ordaining_bishop_id = None
        if consecrator_id and consecrator_id != 'None':
            clergy.consecrator_id = int(consecrator_id)
        elif consecrator_input:
            existing = Clergy.query.filter_by(name=consecrator_input.strip()).first()
            if existing:
                clergy.consecrator_id = existing.id
            else:
                new_bishop = Clergy(name=consecrator_input.strip(), rank='Bishop')
                db.session.add(new_bishop)
                db.session.flush()
                clergy.consecrator_id = new_bishop.id
        else:
            clergy.consecrator_id = None
        if co_consecrators:
            co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
            clergy.set_co_consecrators(co_consecrator_ids)
        else:
            clergy.set_co_consecrators([])
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
                'date_of_ordination': clergy.date_of_ordination.isoformat() if clergy.date_of_ordination else None,
                'date_of_consecration': clergy.date_of_consecration.isoformat() if clergy.date_of_consecration else None,
                'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                'ordaining_bishop_id': clergy.ordaining_bishop_id,
                'consecrator_id': clergy.consecrator_id,
                'co_consecrators': clergy.get_co_consecrators()
            }
        )
        flash('Clergy record updated successfully!', 'success')
        return redirect(url_for('clergy.clergy_list'))
    all_clergy = Clergy.query.all()
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': clergy_member.name,
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    breadcrumbs = generate_breadcrumbs('edit_clergy', clergy=clergy)
    return render_template('edit_clergy_with_comments.html', 
                         clergy=clergy, 
                         user=user,
                         comments=comments,
                         all_clergy=all_clergy, 
                         all_clergy_data=all_clergy_data,
                         ranks=ranks,
                         organizations=organizations,
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         edit_mode=True,
                         breadcrumbs=breadcrumbs)

def clergy_filter_partial_handler():
    if 'user_id' not in session:
        return '', 401
    user = User.query.get(session['user_id'])
    exclude_priests = request.args.get('exclude_priests') == '1'
    exclude_coconsecrators = request.args.get('exclude_coconsecrators') == '1'
    exclude_organizations = request.args.getlist('exclude_organizations')
    search = request.args.get('search', '').strip()
    query = Clergy.query
    if exclude_priests:
        query = query.filter(Clergy.rank != 'Priest')
    if exclude_coconsecrators:
        all_clergy = Clergy.query.all()
        coconsecrator_ids = set()
        for c in all_clergy:
            coconsecrator_ids.update(c.get_co_consecrators())
        if coconsecrator_ids:
            query = query.filter(~Clergy.id.in_(coconsecrator_ids))
    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))
    if search:
        query = query.filter(Clergy.name.ilike(f'%{search}%'))
    clergy_list = query.all()
    for clergy in clergy_list:
        # include traditional titles for all the clerical ranks
        if clergy.rank.lower() in ['bishop', 'archbishop']:
            clergy.display_name = f"Most. Rev. {clergy.name}"
        elif clergy.rank.lower() == 'priest':
            clergy.display_name = f"Rev. {clergy.name}"
        elif clergy.rank.lower() == 'cardinal':
            clergy.display_name = f"His Eminence {clergy.name}"
        else:
            clergy.display_name = clergy.name
    organizations = Organization.query.order_by(Organization.name).all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    return render_template('clergy_table_body.html', clergy_list=clergy_list, org_abbreviation_map=org_abbreviation_map, org_color_map=org_color_map, user=user)

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
        'date_of_ordination': clergy.date_of_ordination.strftime('%Y-%m-%d') if clergy.date_of_ordination else None,
        'ordaining_bishop_id': clergy.ordaining_bishop_id,
        'date_of_consecration': clergy.date_of_consecration.strftime('%Y-%m-%d') if clergy.date_of_consecration else None,
        'consecrator_id': clergy.consecrator_id,
        'notes': clergy.notes
    }) 

def soft_delete_clergy_handler(clergy_id, user=None):
    from models import Clergy, db
    clergy = Clergy.query.get_or_404(clergy_id)
    # Clean up ordaining_bishop_id and consecrator_id references
    referencing_clergy = Clergy.query.filter(
        (Clergy.ordaining_bishop_id == clergy_id) | (Clergy.consecrator_id == clergy_id)
    ).all()
    for c in referencing_clergy:
        if c.ordaining_bishop_id == clergy_id:
            c.ordaining_bishop_id = None
        if c.consecrator_id == clergy_id:
            c.consecrator_id = None
    # Clean up co-consecrator references
    all_clergy = Clergy.query.all()
    for c in all_clergy:
        co_consecrators = c.get_co_consecrators()
        if clergy_id in co_consecrators:
            co_consecrators = [cid for cid in co_consecrators if cid != clergy_id]
            c.set_co_consecrators(co_consecrators)
    clergy.is_deleted = True
    clergy.deleted_at = datetime.utcnow()
    db.session.commit()
    return {'success': True, 'message': 'Clergy record soft-deleted successfully!'} 