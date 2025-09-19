from models import db, Rank, Organization, Clergy
from flask import flash

def edit_rank_service(rank_id, data, user):
    if not user or not getattr(user, 'is_admin', False):
        return {'success': False, 'message': 'Permission denied'}
    rank = Rank.query.get(rank_id)
    if not rank:
        return {'success': False, 'message': 'Rank not found'}
    rank_name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    color = data.get('color', '#000000').strip() or '#000000'
    is_bishop = data.get('is_bishop', False)
    if not rank_name:
        return {'success': False, 'message': 'Rank name is required'}
    existing_rank = Rank.query.filter_by(name=rank_name).first()
    if existing_rank and existing_rank.id != rank_id:
        return {'success': False, 'message': 'Rank name already exists'}
    try:
        old_name = rank.name
        rank.name = rank_name
        rank.description = description
        rank.color = color
        rank.is_bishop = is_bishop
        db.session.commit()
        return {'success': True, 'message': f'Rank "{old_name}" updated to "{rank_name}" successfully', 'rank': {'id': rank.id, 'name': rank.name, 'description': rank.description, 'color': rank.color, 'is_bishop': rank.is_bishop}}
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'message': 'Error updating rank'}

def delete_rank_service(rank_id, user):
    if not user or not getattr(user, 'is_admin', False):
        return {'success': False, 'message': 'Permission denied'}
    rank = Rank.query.get(rank_id)
    if not rank:
        return {'success': False, 'message': 'Rank not found'}
    clergy_using_rank = Clergy.query.filter_by(rank=rank.name).first()
    if clergy_using_rank:
        return {'success': False, 'message': f'Cannot delete rank "{rank.name}" - it is used by clergy records'}
    try:
        db.session.delete(rank)
        db.session.commit()
        return {'success': True, 'message': f'Rank "{rank.name}" deleted successfully'}
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'message': 'Error deleting rank'}

def add_organization_service(data, user):
    if not user or not getattr(user, 'is_admin', False):
        return {'success': False, 'message': 'Permission denied'}
    org_name = data.get('name', '').strip()
    abbreviation = data.get('abbreviation', '').strip()
    description = data.get('description', '').strip()
    color = data.get('color', '#27ae60').strip() or '#27ae60'
    if not org_name:
        return {'success': False, 'message': 'Organization name is required'}
    existing_org = Organization.query.filter_by(name=org_name).first()
    if existing_org:
        return {'success': False, 'message': 'Organization already exists'}
    if abbreviation:
        existing_abbr = Organization.query.filter_by(abbreviation=abbreviation).first()
        if existing_abbr:
            return {'success': False, 'message': f'Abbreviation "{abbreviation}" already exists'}
    try:
        new_org = Organization(name=org_name, abbreviation=abbreviation, description=description, color=color)
        db.session.add(new_org)
        db.session.commit()
        return {'success': True, 'message': f'Organization "{org_name}" added successfully', 'organization': {'id': new_org.id, 'name': new_org.name, 'abbreviation': new_org.abbreviation, 'description': new_org.description, 'color': new_org.color}}
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'message': 'Error adding organization'}

def edit_organization_service(org_id, data, user):
    if not user or not getattr(user, 'is_admin', False):
        return {'success': False, 'message': 'Permission denied'}
    org = Organization.query.get(org_id)
    if not org:
        return {'success': False, 'message': 'Organization not found'}
    org_name = data.get('name', '').strip()
    abbreviation = data.get('abbreviation', '').strip()
    description = data.get('description', '').strip()
    color = data.get('color', '#27ae60').strip() or '#27ae60'
    if not org_name:
        return {'success': False, 'message': 'Organization name is required'}
    existing_org = Organization.query.filter_by(name=org_name).first()
    if existing_org and existing_org.id != org_id:
        return {'success': False, 'message': 'Organization name already exists'}
    if abbreviation:
        existing_abbr = Organization.query.filter_by(abbreviation=abbreviation).first()
        if existing_abbr and existing_abbr.id != org_id:
            return {'success': False, 'message': f'Abbreviation "{abbreviation}" already exists'}
    try:
        old_name = org.name
        org.name = org_name
        org.abbreviation = abbreviation if abbreviation else None
        org.description = description
        org.color = color
        db.session.commit()
        return {'success': True, 'message': f'Organization "{old_name}" updated to "{org_name}" successfully', 'organization': {'id': org.id, 'name': org.name, 'abbreviation': org.abbreviation, 'description': org.description, 'color': org.color}}
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'message': 'Error updating organization'}

def delete_organization_service(org_id, user):
    if not user or not getattr(user, 'is_admin', False):
        return {'success': False, 'message': 'Permission denied'}
    org = Organization.query.get(org_id)
    if not org:
        return {'success': False, 'message': 'Organization not found'}
    clergy_using_org = Clergy.query.filter_by(organization=org.name).first()
    if clergy_using_org:
        return {'success': False, 'message': f'Cannot delete organization "{org.name}" - it is used by clergy records'}
    try:
        db.session.delete(org)
        db.session.commit()
        return {'success': True, 'message': f'Organization "{org.name}" deleted successfully'}
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'message': 'Error deleting organization'} 