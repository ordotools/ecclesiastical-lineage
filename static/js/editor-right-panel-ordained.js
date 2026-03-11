(() => {
    'use strict';

    const API_PATH = '/editor-v2/panel/ordained-consecrated-data';

    /**
     * Lightweight util: normalize possibly-null/array-like to array.
     * @param {*} value
     * @returns {Array}
     */
    function toArray(value) {
        if (!value) {
            return [];
        }
        return Array.isArray(value) ? value : Array.from(value);
    }

    /**
     * Resolve the root container for the right panel ordained/consecrated UI.
     * Prefer a dedicated child container when present; otherwise fall back to the panel itself.
     */
    function getRightPanelContainer() {
        if (typeof document === 'undefined') {
            return null;
        }
        const panel = document.getElementById('editor-panel-right');
        if (!panel) {
            return null;
        }
        const scoped = panel.querySelector('[data-role="right-panel-ordained-root"]');
        return scoped || panel;
    }

    /**
     * Compute ranges with validity for the form clergy and group ordained / consecrated
     * clergy into those ranges.
     *
     * @param {{ ordinations?: Array<object>, consecrations?: Array<object> }} formEvents
     * @param {Array<{ clergy: object, event: object, role: string }>} ordainedConsecrated
     * @returns {{
     *   ranges: Array<{ index: number, start: string|null, end: string|null, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }>,
     *   groups: Array<{
     *     rangeIndex: number,
     *     rangeLabel: string,
     *     isValidForOrders: boolean,
     *     ordained: Array<object>,
     *     consecrated: Array<object>
     *   }>,
     *   snapshotByClergyId: Map<number, { rangeIndex: number, isValidForOrders: boolean }>
     * }}
     */
    function groupOrdainedConsecratedByRange(formEvents, ordainedConsecrated) {
        const EditorRanges = (typeof window !== 'undefined' && window.EditorRangesValidity) ? window.EditorRangesValidity : null;
        if (!EditorRanges || typeof EditorRanges.buildRangesWithValidity !== 'function' || typeof EditorRanges.placeEventInRange !== 'function') {
            return {
                ranges: [],
                groups: [],
                snapshotByClergyId: new Map()
            };
        }

        const ordinations = toArray(formEvents && formEvents.ordinations);
        const consecrations = toArray(formEvents && formEvents.consecrations);

        const orders = [];
        ordinations.forEach(record => {
            if (!record) { return; }
            orders.push({ type: 'ordination', record: record });
        });
        consecrations.forEach(record => {
            if (!record) { return; }
            orders.push({ type: 'consecration', record: record });
        });

        const rangesResult = EditorRanges.buildRangesWithValidity({ orders: orders });
        const ranges = toArray(rangesResult && rangesResult.ranges);
        if (ranges.length === 0 || orders.length === 0) {
            return {
                ranges: ranges,
                groups: [],
                snapshotByClergyId: new Map()
            };
        }

        const rangeByIndex = new Map(ranges.map(r => [r.index, r]));

        /** @type {Map<number, { rangeIndex: number, rangeLabel: string, isValidForOrders: boolean, ordained: Array<object>, consecrated: Array<object> }>} */
        const groupsByIndex = new Map();
        /** @type {Map<number, { rangeIndex: number, isValidForOrders: boolean }>} */
        const snapshotByClergyId = new Map();

        const allDependents = toArray(ordainedConsecrated);
        allDependents.forEach(item => {
            if (!item || !item.event || !item.clergy) {
                return;
            }
            const event = item.event;
            const clergy = item.clergy;
            const kind = event.kind === 'consecration' ? 'consecration' : 'ordination';

            const dateInfo = EditorRanges.getEventDateSortValue
                ? EditorRanges.getEventDateSortValue(event)
                : { unknown: false };
            const placement = EditorRanges.placeEventInRange(event, ranges, kind, !!(dateInfo && dateInfo.unknown));
            const rangeIndex = placement.rangeIndex != null ? placement.rangeIndex : 0;
            const range = rangeByIndex.get(rangeIndex) || { index: rangeIndex, canValidlyOrdain: false, canValidlyConsecrate: false };

            let group = groupsByIndex.get(rangeIndex);
            if (!group) {
                const isValid = !!range.canValidlyOrdain || !!range.canValidlyConsecrate;
                group = {
                    rangeIndex: rangeIndex,
                    rangeLabel: buildRangeLabel(range, isValid),
                    isValidForOrders: isValid,
                    ordained: [],
                    consecrated: []
                };
                groupsByIndex.set(rangeIndex, group);
            }

            const entry = {
                clergy: clergy,
                event: event,
                role: item.role || null,
                lineType: kind,
                rangeIndex: rangeIndex,
                rangeMeta: range,
                descendants: toArray(item.descendants)
            };

            if (kind === 'consecration') {
                group.consecrated.push(entry);
            } else {
                group.ordained.push(entry);
            }

            const hasOrdination = group.ordained.length > 0;
            const hasConsecration = group.consecrated.length > 0;
            const rangeAllows = {
                ord: !!range.canValidlyOrdain,
                cons: !!range.canValidlyConsecrate
            };
            group.isValidForOrders = (
                (!hasOrdination || rangeAllows.ord) &&
                (!hasConsecration || rangeAllows.cons)
            );

            const cid = typeof clergy.id === 'number' ? clergy.id : parseInt(clergy.id, 10);
            if (Number.isFinite(cid)) {
                snapshotByClergyId.set(cid, {
                    rangeIndex: rangeIndex,
                    isValidForOrders: group.isValidForOrders
                });
            }
        });

        const groups = Array.from(groupsByIndex.values()).sort((a, b) => a.rangeIndex - b.rangeIndex);
        return { ranges, groups, snapshotByClergyId };
    }

    /**
     * Sort key for an entry (or descendant node) by event date for ordering.
     * @param {{ event?: object }} entry
     * @returns {number}
     */
    function getEntryDateSortKey(entry) {
        const event = entry && entry.event;
        if (!event) {
            return Infinity;
        }
        const EditorRanges = (typeof window !== 'undefined' && window.EditorRangesValidity) ? window.EditorRangesValidity : null;
        if (EditorRanges && typeof EditorRanges.getEventDateSortValue === 'function') {
            const v = EditorRanges.getEventDateSortValue(event);
            return v && typeof v.t === 'number' ? v.t : Infinity;
        }
        if (event.date) {
            const t = new Date(event.date).getTime();
            return Number.isFinite(t) ? t : Infinity;
        }
        if (event.year != null) {
            return new Date(event.year, 0, 1).getTime();
        }
        return Infinity;
    }

    /**
     * Build a human-readable label for a range based on its boundaries.
     *
     * For year-only boundaries (e.g. 4-digit year strings or reasonable numeric years),
     * prefer "From year YYYY" / "Until year YYYY" phrasing instead of "After 1990" / "Before 1990".
     *
     * @param {{ index: number, start: string|null, end: string|null }} range
     * @param {boolean} isValid
     * @returns {string}
     */
    function buildRangeLabel(range, isValid) {
        const idx = range.index != null ? range.index : 0;
        const start = range.start;
        const end = range.end;

        function isYearOnly(value) {
            if (typeof value === 'number') {
                return Number.isInteger(value) && value >= 1000 && value <= 3000;
            }
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!/^\d{4}$/.test(trimmed)) {
                    return false;
                }
                const yearNum = parseInt(trimmed, 10);
                return yearNum >= 1000 && yearNum <= 3000;
            }
            return false;
        }

        function formatYearLabel(kind, value) {
            const yearText = String(value).trim();
            if (kind === 'start') {
                return `From year ${yearText}`;
            }
            if (kind === 'end') {
                return `Until year ${yearText}`;
            }
            return yearText;
        }

        let core;
        if (start == null && end == null) {
            core = 'Entire timeline';
        } else if (start == null) {
            if (end === 'unknown') {
                core = 'Before first known order';
            } else if (isYearOnly(end)) {
                core = formatYearLabel('end', end);
            } else {
                core = `Before ${end}`;
            }
        } else if (end == null) {
            if (start === 'unknown') {
                core = 'After unknown date';
            } else if (isYearOnly(start)) {
                core = formatYearLabel('start', start);
            } else {
                core = `After ${start}`;
            }
        } else {
            const startLabel = isYearOnly(start) ? formatYearLabel('start', start) : String(start);
            const endLabel = isYearOnly(end) ? formatYearLabel('end', end) : String(end);
            core = `${startLabel} → ${endLabel}`;
        }
        const validity = isValid ? 'valid' : 'invalid';
        return `Range ${idx} — ${core} (${validity})`;
    }

    /**
     * Render an empty or initial state into the right panel.
     */
    function renderEmpty() {
        const container = getRightPanelContainer();
        if (!container) {
            return;
        }
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'right-panel-section right-panel-section--empty';

        const msg = document.createElement('div');
        msg.className = 'right-panel-empty-message';
        msg.textContent = 'Select a clergy record to see those he ordained or consecrated.';

        wrapper.appendChild(msg);
        container.appendChild(wrapper);
    }

    /**
     * Render grouped ordained / consecrated clergy into the right panel.
     *
     * @param {{
     *   clergy: object|null,
     *   ranges: Array<object>,
     *   groups: Array<object>
     * }} state
     * @param {{
     *   previousSnapshot?: Map<number, { rangeIndex: number, isValidForOrders: boolean }>
     * }} [options]
     */
    function renderRightPanel(state, options) {
        const container = getRightPanelContainer();
        if (!container) {
            return;
        }
        const prevSnapshot = options && options.previousSnapshot ? options.previousSnapshot : null;

        container.innerHTML = '';

        if (!state || !Array.isArray(state.groups) || state.groups.length === 0) {
            renderEmpty();
            return;
        }

        const root = document.createElement('div');
        root.className = 'right-panel-section right-panel-section--ordained';

        const header = document.createElement('div');
        header.className = 'right-panel-range-header';

        const title = document.createElement('div');
        title.className = 'right-panel-title';
        const clergyName = state.clergy && (state.clergy.name || state.clergy.display_name);
        title.textContent = clergyName
            ? `Ordained / consecrated by ${clergyName}`
            : 'Ordained / consecrated by this bishop';

        header.appendChild(title);
        root.appendChild(header);

        const listWrapper = document.createElement('div');
        listWrapper.className = 'right-panel-ranges';

        state.groups.forEach(group => {
            const section = document.createElement('section');
            section.className = 'right-panel-range';
            section.setAttribute('data-range-index', String(group.rangeIndex));
            section.classList.add(group.isValidForOrders ? 'range-valid' : 'range-invalid');

            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'right-panel-range-header-row';

            const label = document.createElement('span');
            label.className = 'right-panel-range-label';
            label.textContent = group.rangeLabel;

            const validityBadge = document.createElement('span');
            validityBadge.className = group.isValidForOrders
                ? 'right-panel-range-badge right-panel-range-badge--valid'
                : 'right-panel-range-badge right-panel-range-badge--invalid';
            validityBadge.textContent = group.isValidForOrders ? 'valid for orders' : 'not valid for orders';

            sectionHeader.appendChild(label);
            sectionHeader.appendChild(validityBadge);
            section.appendChild(sectionHeader);

            const clergyList = document.createElement('div');
            clergyList.className = 'right-panel-clergy-list';

            const indentPerDepth = 1.25;

            function renderLineageNode(entry, depth, parentList) {
                const nodeWrap = document.createElement('div');
                nodeWrap.className = 'right-panel-lineage-node';
                nodeWrap.setAttribute('data-depth', String(depth));
                if (depth > 0) {
                    nodeWrap.style.paddingLeft = (depth * indentPerDepth) + 'em';
                }

                const row = document.createElement('div');
                row.className = 'right-panel-clergy-item';
                row.classList.add(entry.lineType === 'consecration'
                    ? 'right-panel-clergy-item--consecration'
                    : 'right-panel-clergy-item--ordination');

                const cid = entry.clergy && (typeof entry.clergy.id === 'number'
                    ? entry.clergy.id
                    : parseInt(entry.clergy.id, 10));
                if (Number.isFinite(cid)) {
                    row.setAttribute('data-clergy-id', String(cid));
                }

                if (depth === 0 && prevSnapshot && Number.isFinite(cid)) {
                    const prev = prevSnapshot.get(cid);
                    if (prev && (prev.rangeIndex !== entry.rangeIndex || prev.isValidForOrders !== group.isValidForOrders)) {
                        row.classList.add('clergy-needs-update');
                    }
                }

                const name = document.createElement('a');
                name.className = 'right-panel-clergy-name';
                const labelText = entry.clergy && (entry.clergy.name || entry.clergy.display_name) || `Clergy #${cid || ''}`;
                name.textContent = labelText;
                name.setAttribute('data-clergy-id', cid != null ? String(cid) : '');
                name.setAttribute('hx-get', `/editor-v2/panel/center?clergy_id=${cid}`);
                name.setAttribute('hx-target', '#editor-panel-center');
                name.setAttribute('hx-swap', 'innerHTML');

                const meta = document.createElement('div');
                meta.className = 'right-panel-clergy-meta';

                const roleParts = [];
                if (entry.lineType === 'ordination') {
                    roleParts.push('Ordained');
                } else {
                    if (entry.role === 'co_consecrator') {
                        roleParts.push('Co-consecrated');
                    } else {
                        roleParts.push('Consecrated');
                    }
                }

                if (entry.event && entry.event.display_date) {
                    roleParts.push(`on ${entry.event.display_date}`);
                }

                const rankOrg = [];
                if (entry.clergy && entry.clergy.rank) {
                    rankOrg.push(entry.clergy.rank);
                }
                if (entry.clergy && entry.clergy.organization) {
                    rankOrg.push(entry.clergy.organization);
                }
                if (rankOrg.length) {
                    roleParts.push(`(${rankOrg.join(', ')})`);
                }

                meta.textContent = roleParts.join(' ');

                row.appendChild(name);
                row.appendChild(meta);
                nodeWrap.appendChild(row);

                const descendants = toArray(entry.descendants);
                if (descendants.length > 0) {
                    const sortedDesc = descendants.slice().sort((a, b) => getEntryDateSortKey(a) - getEntryDateSortKey(b));
                    sortedDesc.forEach(function (child) {
                        renderLineageNode(child, depth + 1, nodeWrap);
                    });
                }

                parentList.appendChild(nodeWrap);
            }

            const allDirect = toArray(group.ordained).concat(toArray(group.consecrated));
            const sortedDirect = allDirect.slice().sort((a, b) => getEntryDateSortKey(a) - getEntryDateSortKey(b));
            sortedDirect.forEach(function (entry) {
                renderLineageNode(entry, 0, clergyList);
            });

            if (!clergyList.children.length) {
                const empty = document.createElement('div');
                empty.className = 'right-panel-empty-message';
                empty.textContent = 'No clergy found in this range.';
                clergyList.appendChild(empty);
            }

            section.appendChild(clergyList);
            listWrapper.appendChild(section);
        });

        root.appendChild(listWrapper);
        container.appendChild(root);
    }

    /**
     * Global state cache to support "needs update" highlighting across recomputes.
     */
    let lastSnapshotByClergyId = null;
    let lastClergyId = null;

    /**
     * Load JSON data for a clergy ID and render the right panel.
     *
     * @param {number|string|null} clergyIdRaw
     */
    async function loadAndRenderForClergy(clergyIdRaw) {
        if (typeof document === 'undefined' || typeof fetch === 'undefined') {
            return;
        }

        const numericId = clergyIdRaw != null ? parseInt(clergyIdRaw, 10) : NaN;
        if (!Number.isFinite(numericId)) {
            lastClergyId = null;
            lastSnapshotByClergyId = null;
            renderEmpty();
            return;
        }

        lastClergyId = numericId;

        try {
            const response = await fetch(`${API_PATH}?clergy_id=${numericId}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            if (!response.ok) {
                renderEmpty();
                return;
            }
            const data = await response.json();
            if (!data || data.success === false) {
                renderEmpty();
                return;
            }

            const formEvents = data.form_events || { ordinations: [], consecrations: [] };
            const ordainedConsecrated = data.ordained_consecrated || [];

            const grouped = groupOrdainedConsecratedByRange(formEvents, ordainedConsecrated);

            renderRightPanel(
                {
                    clergy: data.clergy || null,
                    ranges: grouped.ranges,
                    groups: grouped.groups
                },
                {
                    previousSnapshot: lastSnapshotByClergyId
                }
            );

            lastSnapshotByClergyId = grouped.snapshotByClergyId;
        } catch (error) {
            if (typeof window !== 'undefined' && window.EDITOR_DEBUG && typeof console !== 'undefined' && console.error) {
                console.error('Right panel ordained/consecrated: failed to load data', error);
            }
            renderEmpty();
        }
    }

    /**
     * Handle a validity-change notification by recomputing the right panel.
     * This intentionally does not parse the event details yet; it simply
     * recomputes using the latest backend data for the current clergy.
     *
     * @param {CustomEvent} event
     */
    function handleValidityChanged(event) {
        const detail = event && event.detail ? event.detail : {};
        const explicitId = detail && detail.clergyId != null ? detail.clergyId : null;
        const currentId = explicitId != null ? explicitId : (typeof window !== 'undefined' ? window.currentSelectedClergyId : null);
        if (currentId == null) {
            return;
        }
        loadAndRenderForClergy(currentId);
    }

    /**
     * Wire global event listeners once the DOM is ready.
     */
    function initGlobalListeners() {
        if (typeof document === 'undefined' || !document.body) {
            return;
        }

        document.body.addEventListener('clergySelected', function (event) {
            const detail = event && event.detail ? event.detail : {};
            const clergyId = detail.clergyId != null ? detail.clergyId : null;
            loadAndRenderForClergy(clergyId);
        });

        document.body.addEventListener('htmx:afterSwap', function (event) {
            const detail = event.detail || {};
            const target = detail.target || event.target;
            if (!target) {
                return;
            }
            const panelRight = document.getElementById('editor-panel-right');
            const panelCenter = document.getElementById('editor-panel-center');
            const affectedRight = panelRight && (target === panelRight || panelRight.contains(target));
            const affectedCenter = panelCenter && (target === panelCenter || panelCenter.contains(target));
            if (!(affectedRight || affectedCenter)) {
                return;
            }

            const currentId = typeof window !== 'undefined' && window.currentSelectedClergyId != null
                ? window.currentSelectedClergyId
                : lastClergyId;
            if (currentId != null) {
                loadAndRenderForClergy(currentId);
            }
        });

        document.body.addEventListener('editor:validityChanged', function (event) {
            handleValidityChanged(event);
        });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initGlobalListeners);
        } else {
            initGlobalListeners();
        }
    }

    if (typeof window !== 'undefined') {
        window.EditorRightPanelOrdained = {
            groupOrdainedConsecratedByRange: groupOrdainedConsecratedByRange,
            renderRightPanel: renderRightPanel,
            loadForClergy: loadAndRenderForClergy,
            handleValidityChanged: handleValidityChanged
        };
    }
})();

