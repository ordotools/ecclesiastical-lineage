---
name: Left panel tree refinements
overview: Refine the editor v2 left-panel tree so it shows separate unrelated trees (no connector lines between them), sorted by size; children ordered by event date; children only per consecration range; and priest/ordination-only nodes never have children.
todos:
  - id: add-is-bishop-to-nodes
    content: In _lineage_nodes_links() add is_bishop to each node (from Rank; preload name->is_bishop map)
    status: completed
  - id: dfs-no-children-ordination-only
    content: In _flat_hierarchy_rows() DFS when as_child and incoming_ord set and incoming_cons None return without recursing
    status: completed
  - id: dfs-no-children-non-bishop
    content: In _flat_hierarchy_rows() DFS skip _children_for_parent loop when node is_bishop is False
    status: completed
  - id: sort-children-by-date
    content: In _children_for_parent sort by event_sort_key (cons then ord) then alpha tie-break
    status: completed
  - id: sort-roots-by-size
    content: In panel_left() after _rows_to_tree sort root list by consecration_lineage_size descending
    status: completed
  - id: template-one-tree-per-root
    content: In panel_left.html loop over rows_tree render each root in its own div.file-tree > ul
    status: completed
  - id: update-rows-tree-test
    content: Update test_editor_v2_rows_tree for new child ordering and priest-no-children row set
    status: completed
isProject: false
---

# Left panel tree refinements

## Current behavior

- **[routes/main.py](routes/main.py)**: `_lineage_nodes_links()` builds nodes (with `rank` name) and ordination/consecration links. `_flat_hierarchy_rows(nodes, links)` builds a single DFS-ordered flat list of rows (one or more per clergy when multi-window), with `depth`, `root_id`, `event_type`, etc. Roots are sorted by `consecration_lineage_size` (largest first) then alpha.
- **[routes/editor_v2.py](routes/editor_v2.py)**: `panel_left()` gets `rows` from `_flat_hierarchy_rows`, normalizes IDs, then `rows_tree = _rows_to_tree(rows)` turns the flat list into one list of root nodes (siblings in one `<ul>`).
- **[editor_v2/templates/editor_v2/snippets/panel_left.html](editor_v2/templates/editor_v2/snippets/panel_left.html)**: Renders a single `<div class="file-tree"><ul>{{ render_tree(rows_tree, deceased_ids) }}</ul></div>`. Connector lines (`.file-tree li::before` / `::after`) are drawn for all items in that one `<ul>`, so a vertical line runs between the last item of one root’s subtree and the next root.
- Children are ordered by **name** in `_children_for_parent` (lines 328–330 in main.py), not by event date.
- "Per range per clergy" is already implemented: `_children_for_parent(parent_id, consecration_window_idx)` and DFS windowing.
- Nodes do not carry `is_bishop`; priest vs bishop is not used when recursing, so priests can currently have children.

## Target behavior

1. **No lines between unrelated clergy** – Multiple separate trees in the left panel; no connector lines between different trees.
2. **Sort trees largest to smallest** – Order the list of trees by size (e.g. node count or existing `consecration_lineage_size`), largest first.
3. **Children ordered by ordination/consecration date** – Sort siblings by event date (then tie-break), not by name.
4. **Children only per range per clergy** – Keep current behavior (no change).
5. **Priest ranks never have children; ordination-only placement has no children** – If a row is present only due to ordination (`event_type == 'ordination'`), do not recurse to children. If a row is present due to consecration (or both), allow children only when the node’s rank is bishop (`is_bishop`).

---

## Implementation plan

### 1. Backend: add `is_bishop` to nodes and enforce "no children" rules

**File: [routes/main.py](routes/main.py)**

- In `_lineage_nodes_links()`, when building each node, set `'is_bishop': bool(rank_obj.is_bishop)` (resolve rank by `Rank.query.filter_by(name=clergy.rank).first()` or preload a `name -> is_bishop` map from `Rank.query.all()` for efficiency).
- In `_flat_hierarchy_rows()`, in the DFS:
  - **No children when reached only by ordination**: When `as_child` and `incoming_ord` is set and `incoming_cons` is None, after appending the single row, return `out` without recursing (no call to `_children_for_parent` / no further `dfs`).
  - **No children when parent is not bishop**: Before iterating over `_children_for_parent(...)`, if the current `node` has `is_bishop` False (or missing), skip the loop and return `out` (so priests never have children in the tree).

### 2. Backend: sort children by event date

**File: [routes/main.py](routes/main.py)**

- In `_children_for_parent`, replace the current sort (lines 328–330) with a key that uses the event date:
  - For each `(tid, ord_link, cons_link)`, define a sort key: use `event_sort_key` from `cons_link` if present, else from `ord_link`; treat `None` as a high value so undated events sort last. Tie-break with `_alpha_key_for_node` so order is stable.
  - Sort the `children` list by this key before returning.

### 3. Backend: sort trees by size

**File: [routes/editor_v2.py](routes/editor_v2.py)**

- After `rows_tree = _rows_to_tree(rows)`: sort the list of root nodes by size (e.g. `row['consecration_lineage_size']` or subtree node count), descending. Pass the sorted `rows_tree` to the template.

### 4. Template: render each tree in its own block (no lines between trees)

**File: [editor_v2/templates/editor_v2/snippets/panel_left.html](editor_v2/templates/editor_v2/snippets/panel_left.html)**

- Loop over each root in `rows_tree` and render each in its own block: `{% for root_node in rows_tree %}<div class="file-tree"><ul>{{ render_tree([root_node], deceased_ids) }}</ul></div>{% endfor %}`. Connector lines stay within each tree.

### 5. Tests

**File: [tests/test_editor_v2_rows_tree.py](tests/test_editor_v2_rows_tree.py)**

- Update expectations for new child ordering (by date) and for priests without children (row set may differ); keep or adapt root-count and flatten consistency checks.

---

## Summary of file changes


| File                                                                                                             | Change                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [routes/main.py](routes/main.py)                                                                                 | Add `is_bishop` to nodes; in DFS skip children when (ordination-only child) or (parent is not bishop); sort children in `_children_for_parent` by event date. |
| [routes/editor_v2.py](routes/editor_v2.py)                                                                       | After `_rows_to_tree(rows)`, sort the list of root nodes by tree size (e.g. `consecration_lineage_size`), descending.                                         |
| [editor_v2/templates/editor_v2/snippets/panel_left.html](editor_v2/templates/editor_v2/snippets/panel_left.html) | Loop over each root in `rows_tree` and render each in its own `<div class="file-tree"><ul>...</ul></div>`.                                                    |
| [tests/test_editor_v2_rows_tree.py](tests/test_editor_v2_rows_tree.py)                                           | Update assertions for new ordering and optional row set changes.                                                                                              |


