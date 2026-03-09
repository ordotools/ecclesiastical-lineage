"""Editor v2: SPA shell with HTMX-loaded panels. Blueprint uses editor_v2/ templates and static."""
from flask import Blueprint, render_template, request, session
from sqlalchemy.orm import joinedload

from models import (
    Clergy,
    User,
    Rank,
    Organization,
    Status,
    Ordination,
    Consecration,
    LineageRoot,
    db,
)
from routes.editor import FormFields
from utils import require_permission

editor_v2_bp = Blueprint(
    'editor_v2_bp',
    __name__,
    url_prefix='/editor-v2',
    template_folder='../editor_v2/templates',
    static_folder='../editor_v2/static',
    static_url_path='/editor-v2/static',
)


@editor_v2_bp.route('/')
def shell():
    """Full-page shell (three panels + statusbar)."""
    return render_template('editor_v2/shell.html')


@editor_v2_bp.route('/panel/left')
@require_permission('edit_clergy')
def panel_left():
    """Left panel snippet for HTMX swap (clergy list)."""
    clergy_list = Clergy.query.order_by(Clergy.name).all()
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    return render_template(
        'editor_v2/snippets/panel_left.html',
        clergy_list=clergy_list,
        user=user,
    )


def _get_lineage_roots():
    """Return list of Clergy that are lineage roots."""
    return list(Clergy.query.filter(Clergy.id.in_(db.session.query(LineageRoot.clergy_id))).all())


@editor_v2_bp.route('/panel/center')
@require_permission('edit_clergy')
def panel_center():
    """Center panel snippet for HTMX swap."""
    clergy_id_raw = request.args.get('clergy_id')
    ranks = Rank.query.all()
    organizations = Organization.query.all()
    statuses = Status.query.order_by(Status.badge_position, Status.name).all()
    fields = FormFields(ranks, organizations, statuses)
    user = User.query.get(session['user_id']) if 'user_id' in session else None

    clergy = None
    if clergy_id_raw is not None:
        try:
            cid = int(clergy_id_raw)
            clergy = (
                Clergy.query.options(
                    joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
                    joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
                    joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators),
                )
                .filter(Clergy.id == cid)
                .first()
            )
        except (ValueError, TypeError):
            pass

    edit_mode = bool(clergy)
    lineage_roots = _get_lineage_roots()

    return render_template(
        'editor_v2/snippets/panel_center.html',
        fields=fields,
        clergy=clergy,
        edit_mode=edit_mode,
        user=user,
        lineage_roots=lineage_roots,
    )


@editor_v2_bp.route('/panel/right')
def panel_right():
    """Right panel snippet for HTMX swap."""
    return render_template('editor_v2/snippets/panel_right.html')


@editor_v2_bp.route('/panel/statusbar')
def panel_statusbar():
    """Statusbar snippet for HTMX swap."""
    return render_template('editor_v2/snippets/statusbar.html')
