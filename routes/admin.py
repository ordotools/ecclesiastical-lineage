from flask import Blueprint, redirect, url_for, flash, session
from sqlalchemy import text
from sqlalchemy.orm import joinedload
from datetime import datetime
from utils import require_permission
from models import Clergy, db, Ordination, Consecration

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/admin/force-migrate-lineage', methods=['GET', 'POST'])
@require_permission('manage_metadata')
def force_migrate_lineage():
    from flask import current_app, jsonify
    try:
        current_app.logger.info("Starting forced lineage data migration")
        db.session.execute(text("DELETE FROM co_consecrators"))
        db.session.execute(text("DELETE FROM consecration"))
        db.session.execute(text("DELETE FROM ordination"))
        db.session.commit()
        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.is_deleted != True).all()
        bishops = [c for c in all_clergy if c.rank and 'bishop' in c.rank.lower()]
        priests = [c for c in all_clergy if c.rank and 'priest' in c.rank.lower()]
        ordination_count = 0
        consecration_count = 0
        for priest in priests[:10]:
            if bishops:
                ordination = Ordination(
                    clergy_id=priest.id,
                    date=datetime.now().date(),
                    ordaining_bishop_id=bishops[0].id,
                    is_sub_conditione=False,
                    is_doubtful=False,
                    is_invalid=False,
                    notes=f"Migrated ordination for {priest.name}",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.session.add(ordination)
                ordination_count += 1
        for bishop in bishops[1:]:
            consecration = Consecration(
                clergy_id=bishop.id,
                date=datetime.now().date(),
                consecrator_id=bishops[0].id,
                is_sub_conditione=False,
                is_doubtful=False,
                is_invalid=False,
                notes=f"Migrated consecration for {bishop.name}",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(consecration)
            consecration_count += 1
        db.session.commit()
        current_app.logger.info("Force migration completed: %s ordinations, %s consecrations", ordination_count, consecration_count)
        return jsonify({
            'success': True,
            'message': f'Lineage data migration completed: {ordination_count} ordinations, {consecration_count} consecrations'
        })
    except Exception as e:
        from flask import current_app, jsonify
        current_app.logger.error(f"Error in force_migrate_lineage: {e}")
        return jsonify({'success': False, 'message': f'Migration failed: {str(e)}'}), 500


@admin_bp.route('/users')
def user_management():
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    flash('Please log in to access user management.', 'error')
    return redirect(url_for('auth.login'))


@admin_bp.route('/users/add', methods=['POST'])
def add_user():
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    flash('Please log in to access user management.', 'error')
    return redirect(url_for('auth.login'))


@admin_bp.route('/users/<int:user_id>/edit', methods=['PUT'])
def edit_user(user_id):
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    flash('Please log in to access user management.', 'error')
    return redirect(url_for('auth.login'))


@admin_bp.route('/users/<int:user_id>/delete', methods=['DELETE'])
def delete_user(user_id):
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    flash('Please log in to access user management.', 'error')
    return redirect(url_for('auth.login'))


@admin_bp.route('/comments')
def comments_management():
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#comments-management')
    flash('Please log in to access comments management.', 'error')
    return redirect(url_for('auth.login'))


@admin_bp.route('/comments/<int:comment_id>/resolve', methods=['POST'])
def resolve_comment(comment_id):
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#comments-management')
    flash('Please log in to access comments management.', 'error')
    return redirect(url_for('auth.login'))
