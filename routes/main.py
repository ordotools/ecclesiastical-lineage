from flask import Blueprint, render_template, request, session, jsonify, current_app, g
from models import Clergy, User, db, Organization, Rank, Ordination, Consecration, LineageRoot
from constants import GREEN_COLOR, BLACK_COLOR
import json
import base64

main_bp = Blueprint('main', __name__)


@main_bp.route('/health')
def health():
    return 'ok', 200


@main_bp.route('/')
def index():
    try:
        nodes, links, user = _lineage_nodes_links()
        rows = _flat_hierarchy_rows(nodes, links)
        return render_template('lineage_table.html', rows=rows, user=user)
    except Exception as e:
        current_app.logger.error(f"Error in index (lineage_table): {e}")
        return render_template('lineage_table.html', rows=[], user=None,
                              error_message=f"Unable to load lineage data. Error: {str(e)}")


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


def _get_ancestors_of_roots(root_clergy_ids, all_links):
    """Given root IDs and link list with source/target, return set of ancestor IDs to exclude."""
    from collections import defaultdict
    ancestor_of = defaultdict(set)
    for link in all_links:
        ancestor_of[link['target']].add(link['source'])
    exclude_ids = set()
    for root_id in root_clergy_ids:
        queue = [root_id]
        visited = {root_id}
        while queue:
            node = queue.pop(0)
            for anc in ancestor_of.get(node, set()):
                if anc not in visited:
                    visited.add(anc)
                    exclude_ids.add(anc)
                    queue.append(anc)
    return exclude_ids


def _lineage_nodes_links(apply_root_filter=True):
    """Load clergy, build nodes/links, optionally apply lineage-root filter. Returns (nodes, links, user)."""
    from sqlalchemy.orm import joinedload, selectinload

    def _event_sort_key(date, year):
        """
        Comparable numeric key for ordering events.
        Earlier dates have smaller keys; completely undated events return None.
        """
        if date:
            return int(date.strftime('%Y%m%d'))
        if year:
            return year * 10000
        return None

    all_clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators),
        joinedload(Clergy.statuses),
        selectinload(Clergy.ordinations_performed),
        selectinload(Clergy.consecrations_performed),
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
        # Precompute this clergy member's own consecration sort keys (for date-window logic downstream)
        own_consecration_sort_keys = []
        for consecration in clergy.get_all_consecrations():
            sort_key = _event_sort_key(consecration.date, consecration.year)
            if sort_key is not None:
                own_consecration_sort_keys.append(sort_key)
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
            'ordinations_performed_count': len(clergy.ordinations_performed),
            'consecrations_performed_count': len(clergy.consecrations_performed),
            'ordination_date': ordination_date,
            'consecration_date': consecration_date,
            'bio': clergy.notes,
            'bio': clergy.notes,
            'statuses': statuses_data,
            # Used by lineage-table DFS to build consecration windows per parent
            'own_consecration_sort_keys': sorted(set(own_consecration_sort_keys)),
        })
    for clergy in all_clergy:
        for ordination in clergy.ordinations:
            if ordination.ordaining_bishop:
                sort_key = _event_sort_key(ordination.date, ordination.year)
                links.append({
                    'source': ordination.ordaining_bishop.id, 'target': clergy.id, 'type': 'ordination',
                    'date': ordination.display_date,
                    'event_sort_key': sort_key,
                    'color': BLACK_COLOR,
                    'is_invalid': ordination.is_invalid, 'is_doubtfully_valid': ordination.is_doubtfully_valid,
                    'is_doubtful_event': ordination.is_doubtful_event, 'is_sub_conditione': ordination.is_sub_conditione
                })
    for clergy in all_clergy:
        for consecration in clergy.consecrations:
            if consecration.consecrator:
                sort_key = _event_sort_key(consecration.date, consecration.year)
                consecrator = consecration.consecrator
                # Rare but important: capture if the consecrator was already a bishop at this event
                try:
                    consecrator_was_bishop = consecrator.was_bishop_on(consecration.date)
                except Exception:
                    consecrator_was_bishop = True
                links.append({
                    'source': consecration.consecrator.id, 'target': clergy.id, 'type': 'consecration',
                    'date': consecration.display_date,
                    'event_sort_key': sort_key,
                    'consecrator_was_bishop': consecrator_was_bishop,
                    'color': GREEN_COLOR,
                    'is_invalid': consecration.is_invalid, 'is_doubtfully_valid': consecration.is_doubtfully_valid,
                    'is_doubtful_event': consecration.is_doubtful_event, 'is_sub_conditione': consecration.is_sub_conditione
                })
    for clergy in all_clergy:
        for consecration in clergy.consecrations:
            for co_consecrator in consecration.co_consecrators:
                sort_key = _event_sort_key(consecration.date, consecration.year)
                links.append({
                    'source': co_consecrator.id, 'target': clergy.id, 'type': 'co-consecration',
                    'date': consecration.display_date,
                    'event_sort_key': sort_key,
                    'color': GREEN_COLOR, 'dashed': True,
                    'is_invalid': consecration.is_invalid, 'is_doubtfully_valid': consecration.is_doubtfully_valid,
                    'is_doubtful_event': consecration.is_doubtful_event, 'is_sub_conditione': consecration.is_sub_conditione
                })
    root_clergy_ids = {lr.clergy_id for lr in LineageRoot.query.all()}
    for n in nodes:
        n['is_lineage_root'] = n['id'] in root_clergy_ids
    if apply_root_filter and root_clergy_ids:
        exclude_ids = _get_ancestors_of_roots(root_clergy_ids, links)
        visible_ids = {c.id for c in all_clergy} - exclude_ids
        nodes = [n for n in nodes if n['id'] in visible_ids]
        links = [l for l in links if l['source'] in visible_ids and l['target'] in visible_ids]
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    return (nodes, links, user)


def lineage_visualization():
    current_app.logger.debug("=== LINEAGE_VISUALIZATION ROUTE CALLED ===")
    try:
        nodes, links, user = _lineage_nodes_links()
        nodes_json = json.dumps(nodes)
        links_json = json.dumps(links)
        return render_template('main_viz.html', nodes_json=nodes_json, links_json=links_json, user=user)
    except Exception as e:
        current_app.logger.error(f"Error in lineage_visualization: {e}")
        return render_template('main_viz.html', nodes_json=json.dumps([]), links_json=json.dumps([]),
                               error_message=f"Unable to load lineage data. Error: {str(e)}")


def _flat_hierarchy_rows(nodes, links):
    """Emit one row per ordination/consecration event (repeat clergy as needed). Excludes co-consecration.
    When the same parent both ordained and consecrated a child, one row with marker OC."""
    event_links = [l for l in links if l.get('type') in ('ordination', 'consecration')]
    node_by_id = {n['id']: n for n in nodes}

    def _alpha_key_for_node(node):
        return ((node.get('name') or ''), node['id'])

    # Precompute consecration-only adjacency for lineage-size calculation
    consecration_children = {}
    for link in event_links:
        if link.get('type') != 'consecration':
            continue
        sid, tid = link['source'], link['target']
        consecration_children.setdefault(sid, set()).add(tid)

    # Precompute parent consecration windows from each clergy's own consecrations
    # parent_windows[parent_id] = list of (start_sort_key, end_sort_key_or_None), length >= 2
    parent_windows = {}
    for n in nodes:
        own_keys = n.get('own_consecration_sort_keys') or []
        unique_sorted = sorted(set(k for k in own_keys if k is not None))
        if len(unique_sorted) >= 2:
            windows = []
            for i, start in enumerate(unique_sorted):
                end = unique_sorted[i + 1] if i + 1 < len(unique_sorted) else None
                windows.append((start, end))
            parent_windows[n['id']] = windows

    # Children events grouped by parent (keep all event links; windowing happens later)
    children_events = {}
    for link in event_links:
        sid = link['source']
        children_events.setdefault(sid, []).append(link)

    def _window_index_for_sort_key(sort_key, windows):
        """Map an event sort key into a window index. Undated events go to the last window."""
        if not windows:
            return None
        if sort_key is None:
            return len(windows) - 1
        for idx, (start, end) in enumerate(windows):
            if end is None:
                if sort_key >= start:
                    return idx
            else:
                if start <= sort_key < end:
                    return idx
        return len(windows) - 1

    def _children_for_parent(parent_id, consecration_window_idx):
        """
        For a given parent instance (optionally tied to a consecration window),
        return a list of (target_id, ord_link, cons_link) rows. Multiple events
        per pair are collapsed to at most one ordination and one consecration,
        but filtered to the active window when applicable.
        """
        events = children_events.get(parent_id, [])
        windows = parent_windows.get(parent_id)
        use_windows = windows and consecration_window_idx is not None and len(windows) >= 2

        by_target = {}
        for link in events:
            ltype = link.get('type')
            if ltype not in ('ordination', 'consecration'):
                continue

            if use_windows:
                if ltype == 'ordination':
                    # Product choice: ordination children of a multiply consecrated parent
                    # follow the first consecration window.
                    target_window_idx = 0
                else:
                    sort_key = link.get('event_sort_key')
                    target_window_idx = _window_index_for_sort_key(sort_key, windows)
                if target_window_idx != consecration_window_idx:
                    continue

            tid = link['target']
            bucket = by_target.setdefault(tid, {'ordination': None, 'consecration': None})
            bucket[ltype] = link

        children = [
            (tid, bucket['ordination'], bucket['consecration'])
            for tid, bucket in by_target.items()
        ]
        children.sort(
            key=lambda child: _alpha_key_for_node(node_by_id.get(child[0]) or {'id': child[0]})
        )
        return children

    # roots: lineage roots or nodes with no incoming ordination/consecration
    targets = {link['target'] for link in event_links}
    roots = [n for n in nodes if n.get('is_lineage_root') or n['id'] not in targets]

    # Consecration-lineage size per root (Fix 1)
    consecration_lineage_size = {}

    def _count_consecration_descendants(root_id):
        seen = set()
        stack = list(consecration_children.get(root_id, ()))
        while stack:
            cid = stack.pop()
            if cid in seen:
                continue
            seen.add(cid)
            stack.extend(child for child in consecration_children.get(cid, ()) if child not in seen)
        return len(seen)

    for root in roots:
        consecration_lineage_size[root['id']] = _count_consecration_descendants(root['id'])

    def _root_sort_key(node):
        size = consecration_lineage_size.get(node['id'], 0)
        return (-size, _alpha_key_for_node(node))

    roots.sort(key=_root_sort_key)

    def _make_row(node, depth, incoming_ord, incoming_cons, parent_id, root_id):
        row = {
            'id': node['id'],
            'name': node.get('name'),
            'rank': node.get('rank'),
            'organization': node.get('organization'),
            'depth': depth,
            'parent_id': parent_id,
            'root_id': root_id if root_id is not None else node['id'],
            'consecrations_count': node.get('consecrations_count'),
            'ordinations_count': node.get('ordinations_count'),
            'consecrations_performed_count': node.get('consecrations_performed_count'),
            'ordinations_performed_count': node.get('ordinations_performed_count'),
            'sprite_key': node.get('id'),
        }
        row['is_lineage_root'] = row['id'] == row['root_id']
        if root_id is None:
            root_key = row['id']
        else:
            root_key = root_id
        if root_key in consecration_lineage_size:
            row['consecration_lineage_size'] = consecration_lineage_size[root_key]
        if incoming_ord is None and incoming_cons is None:
            row['event_type'] = None
            row['ordination_date'] = node.get('ordination_date')
            row['consecration_date'] = node.get('consecration_date')
        else:
            if incoming_ord and incoming_cons:
                row['event_type'] = 'ordination_and_consecration'
                row['ordination_date'] = incoming_ord.get('date')
                row['consecration_date'] = incoming_cons.get('date')
            elif incoming_ord:
                row['event_type'] = 'ordination'
                row['ordination_date'] = incoming_ord.get('date')
                row['consecration_date'] = None
            else:
                row['event_type'] = 'consecration'
                row['ordination_date'] = None
                row['consecration_date'] = incoming_cons.get('date')
        return row

    def _child_window_idx(target_id, ord_link, cons_link):
        """Consecration window index for a child when it has multiple consecrations; else None."""
        child_windows = parent_windows.get(target_id)
        if not child_windows or len(child_windows) < 2:
            return None
        link = cons_link or ord_link
        sort_key = link.get('event_sort_key') if link else None
        return _window_index_for_sort_key(sort_key, child_windows)

    def dfs(node, depth, incoming_ord, incoming_cons, path_set, parent_id=None, root_id=None, consecration_window_idx=None):
        node_windows = parent_windows.get(node['id'])
        multi_window = node_windows and len(node_windows) >= 2
        # When reached as a child (consecration_window_idx set), emit only one row for that window.
        # Multi-row emission applies only to roots (no incoming link) or when we're the "parent" context.
        as_child = consecration_window_idx is not None

        if multi_window and not as_child:
            # Root or top-level: emit one row per consecration window, recurse per window.
            out = []
            for w_idx in range(len(node_windows)):
                row = _make_row(node, depth, incoming_ord, incoming_cons, parent_id, root_id)
                out.append(row)
                path_set.add((node['id'], w_idx))
                for target_id, ord_link, cons_link in _children_for_parent(node['id'], w_idx):
                    if target_id not in node_by_id:
                        continue
                    target_node = node_by_id[target_id]
                    child_window_idx = _child_window_idx(target_id, ord_link, cons_link)
                    if (target_id, child_window_idx) in path_set:
                        continue
                    if incoming_ord is not None:
                        allow_child = bool(cons_link is not None and cons_link.get('consecrator_was_bishop') is False)
                        if not allow_child:
                            continue
                    out.extend(
                        dfs(
                            target_node,
                            depth + 1,
                            ord_link,
                            cons_link,
                            path_set,
                            node['id'],
                            root_id,
                            consecration_window_idx=child_window_idx,
                        )
                    )
                path_set.discard((node['id'], w_idx))
            return out

        if multi_window and as_child:
            # Child with multiple consecrations: emit single row for the link's window only.
            w_idx = consecration_window_idx if 0 <= consecration_window_idx < len(node_windows) else (len(node_windows) - 1)
            row = _make_row(node, depth, incoming_ord, incoming_cons, parent_id, root_id)
            out = [row]
            path_set.add((node['id'], w_idx))
            for target_id, ord_link, cons_link in _children_for_parent(node['id'], w_idx):
                if target_id not in node_by_id:
                    continue
                target_node = node_by_id[target_id]
                child_window_idx = _child_window_idx(target_id, ord_link, cons_link)
                if (target_id, child_window_idx) in path_set:
                    continue
                if incoming_ord is not None:
                    allow_child = bool(cons_link is not None and cons_link.get('consecrator_was_bishop') is False)
                    if not allow_child:
                        continue
                out.extend(
                    dfs(
                        target_node,
                        depth + 1,
                        ord_link,
                        cons_link,
                        path_set,
                        node['id'],
                        root_id,
                        consecration_window_idx=child_window_idx,
                    )
                )
            path_set.discard((node['id'], w_idx))
            return out

        row = _make_row(node, depth, incoming_ord, incoming_cons, parent_id, root_id)
        out = [row]
        node_key = (node['id'], consecration_window_idx)
        path_set.add(node_key)
        for target_id, ord_link, cons_link in _children_for_parent(node['id'], consecration_window_idx):
            if target_id not in node_by_id:
                continue
            target_node = node_by_id[target_id]
            child_window_idx = _child_window_idx(target_id, ord_link, cons_link)
            if (target_id, child_window_idx) in path_set:
                continue
            if incoming_ord is not None:
                allow_child = bool(cons_link is not None and cons_link.get('consecrator_was_bishop') is False)
                if not allow_child:
                    continue
            out.extend(
                dfs(
                    target_node,
                    depth + 1,
                    ord_link,
                    cons_link,
                    path_set,
                    node['id'],
                    root_id,
                    consecration_window_idx=child_window_idx,
                )
            )
        path_set.discard(node_key)
        return out

    flat = []
    for root in roots:
        # Roots start without a consecration window; their own children are
        # windowed based on the roots' own consecrations when applicable.
        flat.extend(dfs(root, 0, None, None, set(), None, root_id=root['id'], consecration_window_idx=None))

    if not flat:
        return flat

    # Aggregate consecrations/ordinations performed over the *displayed* subtree only
    # (each node counted once even if it appears in multiple rows due to multiple consecrations)
    root_performed_totals = {}
    for row in flat:
        rid = row['root_id']
        root_performed_totals.setdefault(rid, set()).add(row['id'])
    for rid, node_ids in root_performed_totals.items():
        cons = sum((node_by_id.get(nid) or {}).get('consecrations_performed_count') or 0 for nid in node_ids)
        ords = sum((node_by_id.get(nid) or {}).get('ordinations_performed_count') or 0 for nid in node_ids)
        root_performed_totals[rid] = {'consecrations': cons, 'ordinations': ords}
    for row in flat:
        if row.get('is_lineage_root'):
            agg = root_performed_totals.get(row['root_id'])
            if agg:
                row['consecrations_performed_count'] = agg['consecrations']
                row['ordinations_performed_count'] = agg['ordinations']

    def _has_next_sibling(flat_list, index):
        row = flat_list[index]
        depth = row['depth']
        parent_id = row.get('parent_id')
        for j in range(index + 1, len(flat_list)):
            next_row = flat_list[j]
            if next_row['depth'] < depth:
                return False
            if next_row['depth'] == depth and parent_id is not None and next_row.get('parent_id') == parent_id:
                return True
        return False

    max_depth = max(row['depth'] for row in flat)
    active = [False] * (max_depth + 1)

    for i, row in enumerate(flat):
        d = row['depth']
        row['guides'] = [active[level] for level in range(d)]
        has_sibling_after = _has_next_sibling(flat, i)
        active[d] = has_sibling_after

        if d == 0:
            row['flow'] = 'root'
        elif has_sibling_after:
            row['flow'] = 'sibling'
        else:
            row['flow'] = 'last'
    return flat


@main_bp.route('/lineage-table')
def lineage_table():
    try:
        nodes, links, user = _lineage_nodes_links()
        rows = _flat_hierarchy_rows(nodes, links)
        return render_template('lineage_table.html', rows=rows, user=user)
    except Exception as e:
        current_app.logger.error(f"Error in lineage_table: {e}")
        return render_template('lineage_table.html', rows=[], user=None,
                              error_message=f"Unable to load lineage data. Error: {str(e)}")


@main_bp.route('/lineage_visualization')
def lineage_visualization_alias():
    return lineage_visualization()


@main_bp.route('/favicon.ico')
def favicon():
    return '', 204
