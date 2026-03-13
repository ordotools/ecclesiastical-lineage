"""
Cascade impact computation for validity rules (Rule 6/8).
After root clergy validity changes, compute which descendant ordination/consecration
records should be updated. Matches docs/VALIDITY_RULES.md and Table C.

Details-unknown presumption (reliable-data presumption):
- Events with details_unknown=True are treated as valid unless explicitly marked
  invalid/doubtful.
- When date/year are unknown, ordination is presumed before consecration (Rule 2).
- Children of bishops with only details-unknown events are valid unless stated
  otherwise; such events count as "before" any child event for cascade logic.
"""
from datetime import date
from models import Clergy, Ordination, Consecration, Tag, db

# Table A: effective status priority (worse = higher)
STATUS_PRIORITY = {
    'invalid': 4,
    'doubtfully_valid': 3,
    'doubtful_event': 2,
    'sub_conditione': 1,
    'valid': 0,
}
EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS = ('valid', 'sub_conditione')
VALID_VALIDITY_VALUES = {'valid', 'doubtfully_valid', 'invalid'}


_SYSTEM_TAG_SPECS = {
    'invalid': {
        'label': 'Invalid',
        'color_hex': '#c0392b',
    },
    'doubtful': {
        'label': 'Doubtful validity',
        'color_hex': '#f39c12',
    },
    'sub_cond': {
        'label': 'Sub conditione',
        'color_hex': '#8e44ad',
    },
    'valid': {
        'label': 'Valid',
        'color_hex': '#27ae60',
    },
}


_SYSTEM_TAG_CACHE = {}


def _get_effective_status(record):
    """Effective status from record (Table A)."""
    if record is None:
        return 'valid'
    if getattr(record, 'is_invalid', False):
        return 'invalid'
    if getattr(record, 'is_doubtfully_valid', False):
        return 'doubtfully_valid'
    if getattr(record, 'is_doubtful_event', False):
        return 'doubtful_event'
    if getattr(record, 'is_sub_conditione', False):
        return 'sub_conditione'
    return 'valid'


def _get_worst_status(statuses):
    """Worst status by Table A priority."""
    if not statuses:
        return 'invalid'
    worst = None
    for s in statuses:
        if worst is None or STATUS_PRIORITY.get(s, 0) > STATUS_PRIORITY.get(worst, 0):
            worst = s
    return worst or 'invalid'


def _event_sort_key(record):
    """Sort key for event date (for before/after comparison). Returns (t, known)."""
    if record is None:
        return (None, False)
    if getattr(record, 'date', None):
        return (record.date, True)
    y = getattr(record, 'year', None)
    if y is not None:
        try:
            return (date(int(y), 1, 1), True)
        except (TypeError, ValueError):
            pass
    if getattr(record, 'details_unknown', False):
        return (date.min, True)
    return (None, False)


def _strictly_before(sort_key, event_date_key):
    """True if sort_key is strictly before event_date_key (Rule 2: orders received before giving orders)."""
    t, known = sort_key
    t_evt, known_evt = event_date_key
    if not known_evt:
        return True
    if not known:
        return False
    return t < t_evt


def _bishop_summary_at_date(bishop, event_date_key):
    """
    Bishop validity summary considering only ordinations/consecrations before the event date.
    Returns has_valid_ordination, has_valid_consecration, worst_ordination_status, worst_consecration_status.
    """
    ordination_statuses = [
        _get_effective_status(o) for o in (bishop.ordinations or [])
        if _strictly_before(_event_sort_key(o), event_date_key)
    ]
    consecration_statuses = [
        _get_effective_status(c) for c in (bishop.consecrations or [])
        if _strictly_before(_event_sort_key(c), event_date_key)
    ]
    has_valid_ordination = (
        not ordination_statuses
        or any(s in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS for s in ordination_statuses)
    )
    has_valid_consecration = (
        not consecration_statuses
        or any(s in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS for s in consecration_statuses)
    )
    return {
        'has_valid_ordination': has_valid_ordination,
        'has_valid_consecration': has_valid_consecration,
        'worst_ordination_status': _get_worst_status(ordination_statuses),
        'worst_consecration_status': _get_worst_status(consecration_statuses),
    }


def _map_worst_to_new_validity(worst_status):
    """Table C: presumed validity for orders given when bishop is invalid (Rule 6/8)."""
    if worst_status == 'invalid':
        return 'invalid'
    if worst_status in ('doubtfully_valid', 'doubtful_event'):
        return 'doubtfully_valid'
    return 'valid'


def _get_bishop_worst_status(summary):
    """Worst of worst_ordination_status and worst_consecration_status."""
    o = summary.get('worst_ordination_status') or 'valid'
    c = summary.get('worst_consecration_status') or 'valid'
    return _get_worst_status([o, c])


def _get_system_tag(name):
    """
    Return the system Tag with the given machine name, using a small in-process cache.

    Returns None if the tag does not exist; callers must handle missing tags gracefully
    so that tag logic does not break editor flows if the migration has not been applied.
    """
    cached = _SYSTEM_TAG_CACHE.get(name)
    tag = None
    if isinstance(cached, int):
        tag = Tag.query.get(cached)
        if tag is None:
            # Cached id is stale (tag deleted); clear and fall through to query/create path.
            _SYSTEM_TAG_CACHE.pop(name, None)
        else:
            return tag
    elif cached is not None:
        # Backwards compatibility: old cache may contain Tag instances; drop and repopulate with id.
        _SYSTEM_TAG_CACHE.pop(name, None)
    tag = Tag.query.filter_by(name=name, is_system=True).first()
    if tag is None and name in _SYSTEM_TAG_SPECS:
        spec = _SYSTEM_TAG_SPECS[name]
        tag = Tag(
            name=name,
            label=spec.get('label'),
            color_hex=spec.get('color_hex'),
            is_system=True,
        )
        db.session.add(tag)
        try:
            db.session.flush()
        except Exception:
            # If flush fails, drop the tag so callers can safely handle None.
            tag = None
    if tag is not None:
        _SYSTEM_TAG_CACHE[name] = tag.id
    return tag


def compute_system_tags_for_clergy(clergy):
    """
    Compute the set of validity-related system Tag objects for a clergy member.

    This folds over the clergy's own ordinations and consecrations using the same
    effective-status logic as the cascade (Table A), then maps those statuses into
    high-level tags:
      - 'invalid'   → any event whose effective status is 'invalid'
      - 'doubtful'  → any event whose effective status is 'doubtfully_valid' or 'doubtful_event'
      - 'sub_cond'  → any event flagged is_sub_conditione=True
      - 'valid'     → at least one event exists and all effective statuses are in {'valid', 'sub_conditione'}

    The 'unlikely' system tag is reserved for future heuristics and is not emitted
    by this helper yet.
    """
    if clergy is None:
        return []

    effective_statuses = []
    has_sub_conditione = False

    for o in getattr(clergy, 'ordinations', []) or []:
        status = _get_effective_status(o)
        effective_statuses.append(status)
        if getattr(o, 'is_sub_conditione', False):
            has_sub_conditione = True

    for c in getattr(clergy, 'consecrations', []) or []:
        status = _get_effective_status(c)
        effective_statuses.append(status)
        if getattr(c, 'is_sub_conditione', False):
            has_sub_conditione = True

    tags = set()

    if not effective_statuses:
        # No orders recorded; do not attach any validity-related system tags.
        return []

    worst_status = _get_worst_status(effective_statuses)

    # Invalid: at least one event with effective 'invalid'.
    if any(s == 'invalid' for s in effective_statuses):
        tag = _get_system_tag('invalid')
        if tag:
            tags.add(tag)

    # Doubtful: at least one event with doubtfully_valid or doubtful_event.
    if any(s in ('doubtfully_valid', 'doubtful_event') for s in effective_statuses):
        tag = _get_system_tag('doubtful')
        if tag:
            tags.add(tag)

    # Sub cond.: at least one event explicitly marked sub conditione.
    if has_sub_conditione:
        tag = _get_system_tag('sub_cond')
        if tag:
            tags.add(tag)

    # Valid overall: only valid / sub_conditione events and no worse statuses.
    if worst_status in ('valid', 'sub_conditione'):
        tag = _get_system_tag('valid')
        if tag:
            tags.add(tag)

    return list(tags)


def merge_user_and_system_tags(clergy, system_tags):
    """
    Merge user-assigned tags already attached to a clergy instance with a collection
    of system Tag objects, returning a de-duplicated list suitable for assignment to
    clergy.tags.

    User tags are preserved as-is; system tags are brought into sync with the provided
    collection (existing system tags not in system_tags are implicitly dropped when
    the caller assigns the returned list back to clergy.tags).
    """
    if clergy is None:
        return list(system_tags or [])

    system_tags = list(system_tags or [])

    user_tags = [t for t in (clergy.tags or []) if not getattr(t, 'is_system', False)]

    by_name = {t.name: t for t in user_tags if getattr(t, 'name', None)}
    for tag in system_tags:
        name = getattr(tag, 'name', None)
        if not name:
            continue
        by_name[name] = tag

    return list(by_name.values())


def _descendant_clergy_ids(root_clergy_id):
    """BFS from root: all clergy who were ordained or consecrated by root or by any descendant."""
    seen = {root_clergy_id}
    frontier = {root_clergy_id}
    while frontier:
        next_frontier = set()
        for row in db.session.query(Ordination.clergy_id).filter(
            Ordination.ordaining_bishop_id.in_(frontier),
            Ordination.clergy_id.isnot(None)
        ).distinct():
            cid = row[0]
            if cid and cid not in seen:
                next_frontier.add(cid)
        for row in db.session.query(Consecration.clergy_id).filter(
            Consecration.consecrator_id.in_(frontier),
            Consecration.clergy_id.isnot(None)
        ).distinct():
            cid = row[0]
            if cid and cid not in seen:
                next_frontier.add(cid)
        for cid in next_frontier:
            seen.add(cid)
        frontier = next_frontier
    return seen


def compute_cascade_impact(root_clergy_id):
    """
    Compute list of ordination/consecration records that should be updated when root's
    validity changes. BFS from root to all descendants; for each descendant event,
    compute bishop status at the event date and add a change with new_validity
    per Rule 6/8 (Table C). When the bishop has both valid ordination and valid
    consecration at the event date, descendants receive new_validity='valid' so
    inherited invalidity can be cleared.

    Returns list of dicts: [{ 'type': 'ordination'|'consecration', 'id': int, 'new_validity': str }].
    """
    descendants = _descendant_clergy_ids(root_clergy_id)
    # Exclude root itself: descendant events are those received by descendants (ordinee/consecrand in descendants)
    descendant_ids = descendants - {root_clergy_id}
    if not descendant_ids:
        return []

    # All ordinations/consecrations where the recipient (clergy_id) is a descendant
    ordinations = Ordination.query.filter(
        Ordination.clergy_id.in_(descendant_ids),
        Ordination.ordaining_bishop_id.isnot(None)
    ).all()
    consecrations = Consecration.query.filter(
        Consecration.clergy_id.in_(descendant_ids),
        Consecration.consecrator_id.isnot(None)
    ).all()

    bishop_ids = set()
    for o in ordinations:
        bishop_ids.add(o.ordaining_bishop_id)
    for c in consecrations:
        bishop_ids.add(c.consecrator_id)

    bishops = {}
    if bishop_ids:
        from sqlalchemy.orm import joinedload
        for bishop in Clergy.query.options(
            joinedload(Clergy.ordinations),
            joinedload(Clergy.consecrations)
        ).filter(Clergy.id.in_(bishop_ids)).all():
            bishops[bishop.id] = bishop

    changes = []
    for rec in ordinations:
        bishop_id = rec.ordaining_bishop_id
        bishop = bishops.get(bishop_id) if bishop_id else None
        if not bishop:
            continue
        event_date_key = _event_sort_key(rec)
        summary = _bishop_summary_at_date(bishop, event_date_key)
        if summary['has_valid_ordination'] and summary['has_valid_consecration']:
            new_validity = 'valid'
        else:
            new_validity = _map_worst_to_new_validity(_get_bishop_worst_status(summary))
        if new_validity not in VALID_VALIDITY_VALUES:
            new_validity = 'doubtfully_valid'
        changes.append({'type': 'ordination', 'id': rec.id, 'new_validity': new_validity})

    for rec in consecrations:
        bishop_id = rec.consecrator_id
        bishop = bishops.get(bishop_id) if bishop_id else None
        if not bishop:
            continue
        event_date_key = _event_sort_key(rec)
        summary = _bishop_summary_at_date(bishop, event_date_key)
        if summary['has_valid_ordination'] and summary['has_valid_consecration']:
            new_validity = 'valid'
        else:
            new_validity = _map_worst_to_new_validity(_get_bishop_worst_status(summary))
        if new_validity not in VALID_VALIDITY_VALUES:
            new_validity = 'doubtfully_valid'
        changes.append({'type': 'consecration', 'id': rec.id, 'new_validity': new_validity})

    return changes


def apply_cascade_changes(changes):
    """
    Apply a list of validity changes to ordination/consecration records.
    Same logic as routes/editor.validation_impact_bulk_update (is_invalid,
    is_doubtfully_valid, is_inherited). Returns the number of records updated.
    """
    if not changes:
        return 0
    updated = 0
    for change in changes:
        if not isinstance(change, dict):
            continue
        change_type = change.get('type')
        change_id = change.get('id')
        new_validity = change.get('new_validity')
        if change_type not in ('ordination', 'consecration'):
            continue
        if not isinstance(change_id, int):
            continue
        if new_validity not in VALID_VALIDITY_VALUES:
            continue
        if change_type == 'ordination':
            record = Ordination.query.get(change_id)
        else:
            record = Consecration.query.get(change_id)
        if not record:
            continue
        if new_validity == 'valid':
            record.is_invalid = False
            record.is_doubtfully_valid = False
        elif new_validity == 'doubtfully_valid':
            record.is_invalid = False
            record.is_doubtfully_valid = True
        elif new_validity == 'invalid':
            record.is_invalid = True
            record.is_doubtfully_valid = False
        if new_validity in ('invalid', 'doubtfully_valid'):
            record.is_inherited = True
        elif new_validity == 'valid':
            record.is_inherited = False
        updated += 1
    if updated:
        db.session.commit()
    return updated
