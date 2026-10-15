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
    'invalid_priest': {'label': 'Invalid Priest', 'color_hex': '#c0392b'},
    'invalid_bishop': {'label': 'Invalid Bishop', 'color_hex': '#e74c3c'},
    'doubtful_priest': {'label': 'Doubtful Priest', 'color_hex': '#e67e22'},
    'doubtful_bishop': {'label': 'Doubtful Bishop', 'color_hex': '#f39c12'},
    'valid': {'label': 'Valid', 'color_hex': '#27ae60'},
}


_SYSTEM_TAG_CACHE = {}


def _record_validity(record):
    """Dropdown validity stored on the record: 'invalid' | 'doubtfully_valid' | 'valid'."""
    if getattr(record, 'is_invalid', False):
        return 'invalid'
    if getattr(record, 'is_doubtfully_valid', False):
        return 'doubtfully_valid'
    return 'valid'


def _get_effective_status(record, validity=None):
    """Effective status from record (Table A). validity overrides the stored dropdown value."""
    if record is None:
        return 'valid'
    if validity is None:
        validity = _record_validity(record)
    if validity != 'valid':
        return validity
    if getattr(record, 'is_doubtful_event', False):
        return 'doubtful_event'
    if getattr(record, 'is_sub_conditione', False):
        return 'sub_conditione'
    return 'valid'


def _get_worst_status(statuses):
    """Worst status by Table A priority. No events = nothing to downgrade ('valid')."""
    if not statuses:
        return 'valid'
    worst = None
    for s in statuses:
        if worst is None or STATUS_PRIORITY.get(s, 0) > STATUS_PRIORITY.get(worst, 0):
            worst = s
    return worst


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


def event_date_key(d=None, year=None):
    """Date key for an order being given. No date/year (incl. details unknown) = unknown,
    so every event of the giving bishop counts as before it. Year only = end of that year,
    so the bishop's own orders earlier in the same year count as before it."""
    if d:
        return (d, True)
    if year is not None:
        try:
            return (date(int(year), 12, 31), True)
        except (TypeError, ValueError):
            pass
    return (None, False)


def _received_before(record, event_key):
    """Bishop's own event counts if strictly before event_key. Undated events are presumed
    earlier (reliable-data presumption, same as details unknown)."""
    key = _event_sort_key(record)
    return not key[1] or _strictly_before(key, event_key)


def _not_after(earlier, later):
    """Rule 1a order check between two sort keys; unknown dates presume ordination first."""
    if not earlier[1] or not later[1]:
        return True
    return earlier[0] <= later[0]


def _bishop_summary_at_date(bishop, event_date_key, overrides=None):
    """
    Bishop validity summary considering only ordinations/consecrations before the event date.
    overrides: {('ordination'|'consecration', id): validity} pending cascade changes not yet saved.
    Returns has_valid_ordination, has_valid_consecration, worst_ordination_status, worst_consecration_status.

    Presumptions: a clergy with no orders recorded at all (a lineage root entered without
    his own orders) is presumed a valid bishop; a bishop with consecration(s) but no
    ordination recorded is presumed validly ordained. Otherwise a valid consecration needs
    a valid ordination not after it (Rule 1a).
    """
    def status(kind, rec):
        return _get_effective_status(rec, overrides.get((kind, rec.id)) if overrides else None)

    all_ords = bishop.ordinations or []
    all_cons = bishop.consecrations or []
    ords = [(o, status('ordination', o)) for o in all_ords if _received_before(o, event_date_key)]
    cons = [(c, status('consecration', c)) for c in all_cons if _received_before(c, event_date_key)]
    no_records = not all_ords and not all_cons

    valid_ord_keys = [
        _event_sort_key(o) for o, st in ords if st in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS
    ]
    has_valid_ordination = not all_ords or bool(valid_ord_keys)
    has_valid_consecration = no_records or any(
        st in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS
        and (not all_ords or any(_not_after(k, _event_sort_key(c)) for k in valid_ord_keys))
        for c, st in cons
    )
    return {
        'has_valid_ordination': has_valid_ordination,
        'has_valid_consecration': has_valid_consecration,
        'worst_ordination_status': _get_worst_status([st for _, st in ords]),
        'worst_consecration_status': _get_worst_status([st for _, st in cons]),
    }


def _map_worst_to_new_validity(worst_status):
    """
    Table C: presumed validity for orders given when bishop is invalid (Rule 6/8).
    Only called when the bishop lacks a valid ordination + consecration; if nothing
    recorded is doubtful (e.g. never consecrated, or consecrated before ordination) → invalid.
    """
    if worst_status in ('doubtfully_valid', 'doubtful_event'):
        return 'doubtfully_valid'
    return 'invalid'


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


def _chronological_sort_key(record):
    """
    Ascending sort key for latest-wins tag logic.
    Known dates/years sort by date; details_unknown (no date/year) and fully
    unknown events sort earliest so dated events can win as latest.
    """
    t, known = _event_sort_key(record)
    if not known or t is None:
        return (0, date.min)
    return (1, t)


def _resolve_worst_case_bishop_tags(names):
    """If both invalid_bishop and doubtful_bishop, keep only invalid (worse)."""
    if 'invalid_bishop' in names and 'doubtful_bishop' in names:
        names.discard('doubtful_bishop')
    return names


def compute_system_tag_names_for_clergy(clergy):
    """
    Compute validity-related system tag *names* for a clergy member (no DB).

    Latest-wins semantics (tag rules; distinct from lineage cascade Rule 7):
      - Priest tags from the chronologically last ordination only.
      - Bishop tags from the chronologically last consecration only.
      - If latest ord is invalid/doubtful and a consecration follows it,
        also add the matching invalid_bishop / doubtful_bishop tag (Rule 3:
        cannot validly receive consecration without a valid prior ordination).
      - Latest consecration counts as valid for tags only if a valid-like
        ordination exists strictly before it (Rule 3 gate). Invalid/doubtful
        on the latest consecration still apply as bishop tags regardless of gate.
      - 'valid' when latest ord is valid-like AND (no consecrations OR gated
        latest cons is valid-like).
    """
    if clergy is None:
        return set()

    ordinations = list(getattr(clergy, 'ordinations', []) or [])
    consecrations = list(getattr(clergy, 'consecrations', []) or [])

    names = set()

    ords_sorted = sorted(ordinations, key=_chronological_sort_key)
    has_valid_ordination = False
    if ords_sorted:
        last_ord = ords_sorted[-1]
        last_ord_status = _get_effective_status(last_ord)
        last_ord_key = _event_sort_key(last_ord)
        has_subsequent_cons = any(
            _strictly_before(last_ord_key, _event_sort_key(c))
            for c in consecrations
        )
        if last_ord_status == 'invalid':
            names.add('invalid_priest')
            if has_subsequent_cons:
                names.add('invalid_bishop')
        elif last_ord_status in ('doubtfully_valid', 'doubtful_event'):
            names.add('doubtful_priest')
            if has_subsequent_cons:
                names.add('doubtful_bishop')
        has_valid_ordination = last_ord_status in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS

    cons_sorted = sorted(consecrations, key=_chronological_sort_key)
    if not cons_sorted:
        has_valid_consecration = True
    else:
        latest_cons = cons_sorted[-1]
        last_cons_status = _get_effective_status(latest_cons)
        cons_key = _event_sort_key(latest_cons)
        gate = any(
            _get_effective_status(o) in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS
            and _strictly_before(_event_sort_key(o), cons_key)
            for o in ordinations
        )
        if last_cons_status == 'invalid':
            names.add('invalid_bishop')
        elif last_cons_status in ('doubtfully_valid', 'doubtful_event'):
            names.add('doubtful_bishop')
        has_valid_consecration = (
            gate and last_cons_status in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS
        )

    if has_valid_ordination and has_valid_consecration:
        names.add('valid')

    return _resolve_worst_case_bishop_tags(names)


def compute_system_tags_for_clergy(clergy):
    """
    Compute the set of validity-related system Tag objects for a clergy member.

    See compute_system_tag_names_for_clergy for latest-wins + consecration-gate
    semantics. Resolves names to Tag rows via _get_system_tag.
    """
    names = compute_system_tag_names_for_clergy(clergy)
    tags = []
    for name in names:
        tag = _get_system_tag(name)
        if tag:
            tags.append(tag)
    return tags


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


def _cascaded_validity(summary, current, inherited):
    """
    New validity for an order given by a bishop with this summary (Rule 6/8).
    Inherited records follow the bishop (so they can be cleared when the bishop
    becomes valid); explicitly set records keep their own status unless the bishop
    caps them lower. Orders are never better than the giver.
    """
    if summary['has_valid_ordination'] and summary['has_valid_consecration']:
        cap = 'valid'
    else:
        cap = _map_worst_to_new_validity(_get_bishop_worst_status(summary))
    if inherited:
        return cap
    return _get_worst_status([current, cap])


def _propagate_validity(events, bishops):
    """
    events: [(kind, record, bishop_id)] for descendant ordinations/consecrations.
    bishops: {id: Clergy} with ordinations/consecrations loaded.
    Returns the change list for compute_cascade_impact.
    """
    # Pending validity per event. Repeat until stable so a change to a child's own
    # orders reaches the grandchildren in the same save (Rule 6 across generations).
    # Bounded by len(events) + 1 passes in case the data contains a lineage cycle.
    overrides = {}
    for _ in range(len(events) + 1):
        changed = False
        for kind, rec, bishop_id in events:
            bishop = bishops.get(bishop_id)
            if not bishop:
                continue
            key = (kind, rec.id)
            current = overrides.get(key, _record_validity(rec))
            inherited = rec.is_inherited if key not in overrides else current != 'valid'
            new_validity = _cascaded_validity(
                _bishop_summary_at_date(bishop, event_date_key(rec.date, rec.year), overrides),
                current,
                inherited,
            )
            if new_validity != current:
                overrides[key] = new_validity
                changed = True
        if not changed:
            break

    return [
        {'type': kind, 'id': rec.id, 'new_validity': overrides[(kind, rec.id)]}
        for kind, rec, _ in events
        if (kind, rec.id) in overrides and overrides[(kind, rec.id)] != _record_validity(rec)
    ]


def compute_cascade_impact(root_clergy_id):
    """
    Compute list of ordination/consecration records that should be updated when root's
    validity changes. BFS from root to all descendants; for each descendant event,
    compute bishop status at the event date and add a change with new_validity
    per Rule 6/8 (Table C), see _cascaded_validity. Changes are propagated through
    all generations before returning; only records whose validity changes are listed.

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

    events = [('ordination', rec, rec.ordaining_bishop_id) for rec in ordinations]
    events += [('consecration', rec, rec.consecrator_id) for rec in consecrations]

    return _propagate_validity(events, bishops)


def apply_cascade_changes(changes):
    """
    Apply a list of validity changes to ordination/consecration records.
    Applies is_invalid, is_doubtfully_valid, is_inherited per record (same rules
    the legacy editor bulk-update used). Returns the number of records updated.
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
        # Any status the cascade sets came from the bishop, so it is inherited.
        record.is_inherited = new_validity != 'valid'
        updated += 1
    if updated:
        db.session.commit()
    return updated


def recompute_tags_for_descendants(changes):
    """
    Given the list of changes from apply_cascade_changes, collect unique clergy_ids
    affected and recompute system tags (and merge with user tags) for each.
    """
    if not changes:
        return
    clergy_ids = set()
    for change in changes:
        if not isinstance(change, dict):
            continue
        change_type = change.get('type')
        change_id = change.get('id')
        if change_type == 'ordination':
            rec = Ordination.query.get(change_id)
        elif change_type == 'consecration':
            rec = Consecration.query.get(change_id)
        else:
            continue
        if rec is not None and getattr(rec, 'clergy_id', None) is not None:
            clergy_ids.add(rec.clergy_id)
    if not clergy_ids:
        return
    from sqlalchemy.orm import joinedload
    for clergy in Clergy.query.options(
        joinedload(Clergy.ordinations),
        joinedload(Clergy.consecrations),
        joinedload(Clergy.tags),
    ).filter(Clergy.id.in_(clergy_ids)).all():
        system_tags = compute_system_tags_for_clergy(clergy)
        clergy.tags = merge_user_and_system_tags(clergy, system_tags)
    db.session.commit()
