(() => {
    'use strict';

    const ValidityRules = (typeof window !== 'undefined' && window.ValidityRules) ? window.ValidityRules : null;

    function getRulesRef(StatusInheritanceRef) {
        return ValidityRules || StatusInheritanceRef || (typeof window !== 'undefined' ? window.StatusInheritance : null);
    }

    /**
     * Lightweight graph utilities for the Validation Impact panel.
     *
     * Responsibilities for this file (js-graph-cascade task):
     * - Build ordination / consecration adjacency from window.clergyListData.
     * - Provide BFS / DFS-style descendant traversal for a given root clergy ID.
     *
     * Higher-level panel rendering, synthetic summaries, and wiring are handled
     * in follow-on tasks; this module focuses purely on data structures.
     */

    /**
     * Normalize an array-like value to a plain array.
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
     * Build adjacency lists for ordinations and consecrations from clergyListData.
     *
     * Input shape (from /editor/clergy-list in routes/editor.py):
     *   clergyListData: [
     *     {
     *       id: <int>,
     *       ordinations: [
     *         {
     *           ordaining_bishop_id: <int|null>,
     *           date, date_unknown, year,
     *           validity,
     *           is_sub_conditione, is_doubtful_event,
     *           is_invalid, is_doubtfully_valid
     *         },
     *         ...
     *       ],
     *       consecrations: [
     *         {
     *           consecrator_id: <int|null>,
     *           date, date_unknown, year,
     *           validity,
     *           is_sub_conditione, is_doubtful_event,
     *           is_invalid, is_doubtfully_valid
     *         },
     *         ...
     *       ]
     *     },
     *     ...
     *   ]
     *
     * Output shape:
     *   {
     *     clergyById: Map<number, ClergyRecord>,
     *     adjacency: Map<number, Array<{
     *       childId: number,
     *       ordinations: Array<{ index: number, record: object }>,
     *       consecrations: Array<{ index: number, record: object }>
     *     }>>
     *   }
     *
     * Where adjacency has an entry for each parent (bishop) ID that appears as:
     *   - ordination.ordaining_bishop_id
     *   - consecration.consecrator_id
     */
    function buildAdjacencyFromClergyList(clergyListData) {
        const data = toArray(clergyListData || (typeof window !== 'undefined' ? window.clergyListData : []) || []);

        const clergyById = new Map();
        const adjacency = new Map();

        data.forEach(clergy => {
            if (!clergy || typeof clergy.id !== 'number') {
                return;
            }
            clergyById.set(clergy.id, clergy);
        });

        data.forEach(clergy => {
            if (!clergy || typeof clergy.id !== 'number') {
                return;
            }
            const childId = clergy.id;

            toArray(clergy.ordinations).forEach((ordination, index) => {
                const parentId = ordination && ordination.ordaining_bishop_id;
                if (!parentId || typeof parentId !== 'number') {
                    return;
                }
                ensureEdge(adjacency, parentId, childId).ordinations.push({
                    index,
                    record: ordination
                });
            });

            toArray(clergy.consecrations).forEach((consecration, index) => {
                const parentId = consecration && consecration.consecrator_id;
                if (!parentId || typeof parentId !== 'number') {
                    return;
                }
                ensureEdge(adjacency, parentId, childId).consecrations.push({
                    index,
                    record: consecration
                });
            });
        });

        return { clergyById, adjacency };
    }

    /**
     * Ensure an edge entry exists for (parentId -> childId) in the adjacency map.
     * @param {Map<number, Array>} adjacency
     * @param {number} parentId
     * @param {number} childId
     * @returns {{ childId: number, ordinations: Array, consecrations: Array }}
     */
    function ensureEdge(adjacency, parentId, childId) {
        if (!adjacency.has(parentId)) {
            adjacency.set(parentId, []);
        }
        const edges = adjacency.get(parentId);
        let edge = edges.find(e => e.childId === childId);
        if (!edge) {
            edge = {
                childId,
                ordinations: [],
                consecrations: []
            };
            edges.push(edge);
        }
        return edge;
    }

    /**
     * Compute the full descendant closure for a given root clergy ID using BFS.
     *
     * Returns an array of:
     *   {
     *     id: number,
     *     distance: number,                // number of hops from root (1 for direct children)
     *     parents: Array<number>,          // immediate parents within this cascade
+     *     via: Array<{
     *       parentId: number,
     *       ordinations: Array<{ index: number, record: object }>,
     *       consecrations: Array<{ index: number, record: object }>
     *     }>
     *   }
     *
     * The root itself is excluded from the result set.
     *
     * @param {number} rootId
     * @param {Map<number, Array>} adjacency
     * @returns {Array<object>}
     */
    function getDescendantsBFS(rootId, adjacency) {
        if (!rootId || typeof rootId !== 'number' || !adjacency || typeof adjacency.get !== 'function') {
            return [];
        }

        const visited = new Set();
        const results = new Map(); // childId -> descriptor
        const queue = [];

        visited.add(rootId);
        queue.push({ id: rootId, distance: 0 });

        while (queue.length > 0) {
            const current = queue.shift();
            const { id, distance } = current;
            const edges = adjacency.get(id) || [];
            const nextDistance = distance + 1;

            edges.forEach(edge => {
                const childId = edge.childId;
                if (!childId || typeof childId !== 'number') {
                    return;
                }

                let descriptor = results.get(childId);
                if (!descriptor) {
                    descriptor = {
                        id: childId,
                        distance: nextDistance,
                        parents: [],
                        via: []
                    };
                    results.set(childId, descriptor);
                } else if (nextDistance < descriptor.distance) {
                    descriptor.distance = nextDistance;
                }

                descriptor.parents.push(id);
                descriptor.via.push({
                    parentId: id,
                    ordinations: toArray(edge.ordinations),
                    consecrations: toArray(edge.consecrations)
                });

                if (!visited.has(childId)) {
                    visited.add(childId);
                    queue.push({ id: childId, distance: nextDistance });
                }
            });
        }

        return Array.from(results.values()).sort((a, b) => {
            if (a.distance !== b.distance) {
                return a.distance - b.distance;
            }
            return a.id - b.id;
        });
    }

    /**
     * Simple DFS variant that returns the same descriptor shape as BFS but
     * with depth-first ordering. Mostly useful for alternative UI presentations.
     *
     * @param {number} rootId
     * @param {Map<number, Array>} adjacency
     * @returns {Array<object>}
     */
    function getDescendantsDFS(rootId, adjacency) {
        if (!rootId || typeof rootId !== 'number' || !adjacency || typeof adjacency.get !== 'function') {
            return [];
        }

        const visited = new Set();
        const results = new Map();

        function visit(nodeId, distance, parentId, edge) {
            if (nodeId === null || typeof nodeId !== 'number') {
                return;
            }

            if (parentId === null && distance === 0) {
                visited.add(nodeId);
            }

            if (!visited.has(nodeId)) {
                visited.add(nodeId);
            }

            if (nodeId !== rootId) {
                let descriptor = results.get(nodeId);
                if (!descriptor) {
                    descriptor = {
                        id: nodeId,
                        distance,
                        parents: [],
                        via: []
                    };
                    results.set(nodeId, descriptor);
                } else if (distance < descriptor.distance) {
                    descriptor.distance = distance;
                }

                if (parentId !== null) {
                    descriptor.parents.push(parentId);
                    if (edge) {
                        descriptor.via.push({
                            parentId,
                            ordinations: toArray(edge.ordinations),
                            consecrations: toArray(edge.consecrations)
                        });
                    }
                }
            }

            const edges = adjacency.get(nodeId) || [];
            const nextDistance = distance + 1;
            edges.forEach(nextEdge => {
                if (!nextEdge || typeof nextEdge.childId !== 'number') {
                    return;
                }
                if (!visited.has(nextEdge.childId)) {
                    visit(nextEdge.childId, nextDistance, nodeId, nextEdge);
                }
            });
        }

        visit(rootId, 0, null, null);

        return Array.from(results.values()).sort((a, b) => {
            if (a.distance !== b.distance) {
                return a.distance - b.distance;
            }
            return a.id - b.id;
        });
    }

    /**
     * Helper that lazily builds and caches adjacency on window for reuse.
     * This allows other parts of the Validation Impact panel to share
     * the same underlying graph representation.
     */
    function getOrBuildCachedAdjacency() {
        if (typeof window === 'undefined') {
            return buildAdjacencyFromClergyList([]);
        }
        const cache = window.__validationImpactGraphCache || {};
        const currentData = window.clergyListData || [];

        if (cache._dataRef === currentData && cache.clergyById && cache.adjacency) {
            return cache;
        }

        const built = buildAdjacencyFromClergyList(currentData);
        built._dataRef = currentData;
        window.__validationImpactGraphCache = built;
        return built;
    }

    /**
     * Build a lightweight record object for a form entry that can be consumed
     * by ValidityRules.getEffectiveStatus. This mirrors the shape used by
     * status-inheritance.js#getEntryRecord.
     *
     * @param {Element} entryElement
     * @returns {{ validity: string, is_sub_conditione: boolean, is_doubtful_event: boolean, is_invalid: boolean, is_doubtfully_valid: boolean }}
     */
    function getEntryRecordFromDom(entryElement) {
        if (!entryElement || typeof document === 'undefined') {
            return {
                validity: 'valid',
                is_sub_conditione: false,
                is_doubtful_event: false,
                is_invalid: false,
                is_doubtfully_valid: false
            };
        }

        const validitySelect = entryElement.querySelector('select[name*="[validity]"]');
        const subConditioneInput = entryElement.querySelector('input[name*="[is_sub_conditione]"]');
        const doubtfulEventInput = entryElement.querySelector('input[name*="[is_doubtful_event]"]');

        const validity = validitySelect && validitySelect.value ? validitySelect.value : 'valid';

        return {
            validity: validity,
            is_sub_conditione: !!(subConditioneInput && subConditioneInput.checked),
            is_doubtful_event: !!(doubtfulEventInput && doubtfulEventInput.checked),
            is_invalid: validity === 'invalid',
            is_doubtfully_valid: validity === 'doubtfully_valid'
        };
    }

    /**
     * Get date (or year/unknown) from a single ordination or consecration form entry.
     * Looks for .ordination-date-block / .consecration-date-block and inputs [date], [date_unknown], [year].
     *
     * @param {Element} entryElement .ordination-entry or .consecration-entry
     * @returns {{ date: string|null, year: number|null, dateUnknown: boolean }} dateUnknown true when date is not set; date YYYY-MM-DD when known; year when dateUnknown and year given.
     */
    function getDateFromFormEntry(entryElement) {
        if (!entryElement || typeof entryElement.querySelector !== 'function') {
            return { date: null, year: null, dateUnknown: true };
        }
        const dateBlock = entryElement.querySelector('.ordination-date-block') || entryElement.querySelector('.consecration-date-block');
        if (!dateBlock) {
            return { date: null, year: null, dateUnknown: true };
        }
        const dateInput = dateBlock.querySelector('input[name*="[date]"]');
        const dateUnknownInput = dateBlock.querySelector('input[name*="[date_unknown]"]');
        const yearInput = dateBlock.querySelector('input[name*="[year]"]');

        const dateVal = dateInput && dateInput.value ? dateInput.value.trim() : '';
        if (dateVal) {
            return { date: dateVal, year: null, dateUnknown: false };
        }
        const isUnknown = dateUnknownInput && (dateUnknownInput.value === '1' || dateUnknownInput.value === 'on' || String(dateUnknownInput.value).trim() !== '');
        if (isUnknown) {
            const yearVal = yearInput && yearInput.value ? parseInt(yearInput.value.trim(), 10) : NaN;
            return {
                date: null,
                year: Number.isFinite(yearVal) ? yearVal : null,
                dateUnknown: true
            };
        }
        return { date: null, year: null, dateUnknown: true };
    }

    /**
     * Get date info from a clergy-list ordination/consecration record (date, date_unknown, year).
     *
     * @param {object} record Ordination or consecration record from clergyListData
     * @returns {{ date: string|null, year: number|null, dateUnknown: boolean }}
     */
    function getDateFromRecord(record) {
        if (!record) {
            return { date: null, year: null, dateUnknown: true };
        }
        const dateVal = record.date && String(record.date).trim();
        if (dateVal) {
            return { date: dateVal, year: null, dateUnknown: false };
        }
        const isUnknown = record.date_unknown === true || record.date_unknown === 1 || record.date_unknown === '1' || record.date_unknown === 'on';
        if (isUnknown) {
            const y = record.year != null ? parseInt(record.year, 10) : NaN;
            return {
                date: null,
                year: Number.isFinite(y) ? y : null,
                dateUnknown: true
            };
        }
        return { date: null, year: null, dateUnknown: true };
    }

    /**
     * Sortable value for an event date for range comparison. Unknown dates map to Infinity so they sort into the last range.
     *
     * @param {object} record Ordination/consecration record with date, date_unknown, year
     * @returns {{ t: number, unknown: boolean }}
     */
    function getEventDateSortValue(record) {
        const dateInfo = getDateFromRecord(record);
        if (dateInfo.date) {
            const t = new Date(dateInfo.date).getTime();
            return { t: Number.isFinite(t) ? t : Infinity, unknown: false };
        }
        if (dateInfo.dateUnknown && dateInfo.year != null) {
            return { t: new Date(dateInfo.year, 0, 1).getTime(), unknown: false };
        }
        return { t: Infinity, unknown: true };
    }

    /**
     * Sortable value for a range boundary (start or end). null start => -Infinity; null end => +Infinity; 'unknown' => +Infinity so unknown-dated events fall in last range.
     *
     * @param {string|null} boundary ISO date, year string, 'unknown', or null
     * @param {boolean} asEnd True for range end (null => +Infinity), false for start (null => -Infinity)
     * @returns {number}
     */
    function getBoundarySortValue(boundary, asEnd) {
        if (boundary == null) {
            return asEnd ? Infinity : -Infinity;
        }
        if (boundary === 'unknown') {
            return Infinity;
        }
        const parsed = new Date(boundary);
        if (Number.isFinite(parsed.getTime())) {
            return parsed.getTime();
        }
        const year = parseInt(boundary, 10);
        if (Number.isFinite(year)) {
            return new Date(year, 0, 1).getTime();
        }
        return asEnd ? Infinity : -Infinity;
    }

    /**
     * Place a descendant event (by date) into the form bishop's timeline; return the range index and line type.
     * Events with unknown date are placed in the last range. When a range boundary is 'unknown', only
     * unknown-dated events are placed in that range; known-dated events skip to the next range.
     *
     * @param {object} record Ordination or consecration record (with date, date_unknown, year)
     * @param {Array<{ index: number, start: string|null, end: string|null }>} ranges Form bishop ranges from buildFormBishopRanges
     * @param {'ordination'|'consecration'} lineType
     * @param {boolean} [eventUnknown] True when the event has unknown date (from getEventDateSortValue(record).unknown)
     * @returns {{ rangeIndex: number, lineType: 'ordination'|'consecration' }}
     */
    function placeEventInRange(record, ranges, lineType, eventUnknown) {
        const rangeList = toArray(ranges || []);
        if (rangeList.length === 0) {
            return { rangeIndex: 0, lineType: lineType };
        }
        const { t: eventT, unknown: evtUnknown } = getEventDateSortValue(record);
        const isUnknown = eventUnknown !== undefined ? !!eventUnknown : !!evtUnknown;
        for (let i = 0; i < rangeList.length; i++) {
            const r = rangeList[i];
            if (r.end === 'unknown' || r.start === 'unknown') {
                if (!isUnknown) {
                    continue;
                }
            }
            const startVal = getBoundarySortValue(r.start, false);
            const endVal = getBoundarySortValue(r.end, true);
            if (eventT >= startVal && eventT < endVal) {
                return { rangeIndex: r.index, lineType: lineType };
            }
        }
        return { rangeIndex: rangeList[rangeList.length - 1].index, lineType: lineType };
    }

    /**
     * Sort key for ordering form bishop orders by date. Unknown dates sort last; same date uses type order (ordination before consecration).
     * @param {{ date: string|null, year: number|null, dateUnknown: boolean }} dateInfo
     * @param {'ordination'|'consecration'} type
     * @returns {{ t: number, typeOrder: number }} t is timestamp (Infinity for unknown), typeOrder 0 = ordination, 1 = consecration
     */
    function getOrderSortKey(dateInfo, type) {
        const typeOrder = type === 'consecration' ? 1 : 0;
        if (dateInfo.dateUnknown) {
            if (dateInfo.year != null) {
                const t = new Date(dateInfo.year, 0, 1).getTime();
                return { t, typeOrder };
            }
            return { t: Infinity, typeOrder };
        }
        const t = new Date(dateInfo.date).getTime();
        return { t: Number.isFinite(t) ? t : Infinity, typeOrder };
    }

    /**
     * Build the form bishop's timeline (ranges) from form ordination and consecration entries, ordered by date.
     * N orders (lines) yield N+1 ranges. Range 0 = before first order, range N = after last order.
     * Boundaries are either an ISO date string (YYYY-MM-DD) or 'unknown' when the boundary event has no known date.
     *
     * @param {Element} [root] Optional root (default document) to query .ordination-entry and .consecration-entry
     * @returns {{ orders: Array<{ type: 'ordination'|'consecration', entry: Element, dateInfo: object, sortKey: object }>, ranges: Array<{ index: number, start: string|null, end: string|null }> }} ranges[].start/end are ISO date or 'unknown' or null (start null = beginning; end null = open end)
     */
    function buildFormBishopRanges(root) {
        const scope = root || (typeof document !== 'undefined' ? document : null);
        const orders = [];
        if (!scope || typeof scope.querySelectorAll !== 'function') {
            return { orders: [], ranges: [{ index: 0, start: null, end: null }] };
        }

        const ordinationEntries = scope.querySelectorAll('.ordination-entry');
        const consecrationEntries = scope.querySelectorAll('.consecration-entry');

        toArray(ordinationEntries).forEach(entry => {
            const dateInfo = getDateFromFormEntry(entry);
            orders.push({
                type: 'ordination',
                entry,
                dateInfo,
                sortKey: getOrderSortKey(dateInfo, 'ordination')
            });
        });
        toArray(consecrationEntries).forEach(entry => {
            const dateInfo = getDateFromFormEntry(entry);
            orders.push({
                type: 'consecration',
                entry,
                dateInfo,
                sortKey: getOrderSortKey(dateInfo, 'consecration')
            });
        });

        orders.sort((a, b) => {
            if (a.sortKey.t !== b.sortKey.t) {
                return a.sortKey.t - b.sortKey.t;
            }
            return a.sortKey.typeOrder - b.sortKey.typeOrder;
        });

        const ranges = [];
        if (orders.length === 0) {
            ranges.push({ index: 0, start: null, end: null });
            return { orders: [], ranges };
        }

        const boundary = (order) => {
            if (order.dateInfo.dateUnknown) {
                return order.dateInfo.year != null ? String(order.dateInfo.year) : 'unknown';
            }
            return order.dateInfo.date;
        };

        ranges.push({
            index: 0,
            start: null,
            end: boundary(orders[0])
        });
        for (let i = 0; i < orders.length - 1; i++) {
            ranges.push({
                index: i + 1,
                start: boundary(orders[i]),
                end: boundary(orders[i + 1])
            });
        }
        ranges.push({
            index: orders.length,
            start: boundary(orders[orders.length - 1]),
            end: null
        });

        return { orders, ranges };
    }

    /**
     * Compute validity per range: for each range, whether the form bishop could
     * validly ordain and validly consecrate during that period (rules 1a, 1b, 2).
     * Uses validity-rules.js when available; requires at least one prior valid
     * ordination and one prior valid consecration (ordination before consecration).
     *
     * @param {Array<{ type: 'ordination'|'consecration', entry: Element }>} orders Ordered list of ordination/consecration entries (e.g. from buildFormBishopRanges)
     * @param {object|null} StatusInheritanceRef Optional rules ref (defaults to ValidityRules / window.StatusInheritance)
     * @returns {Array<{ index: number, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }>} One entry per range index 0..orders.length
     */
    function computeValidityPerRange(orders, StatusInheritanceRef) {
        const orderList = toArray(orders || []);

        if (ValidityRules && typeof ValidityRules.canGiveOrdersValidlyInRange === 'function') {
            const ordersWithRecords = orderList.map(order => ({
                type: order.type,
                record: order.entry ? getEntryRecordFromDom(order.entry) : {}
            }));
            const result = [];
            for (let rangeIndex = 0; rangeIndex <= ordersWithRecords.length; rangeIndex++) {
                const v = ValidityRules.canGiveOrdersValidlyInRange(ordersWithRecords, rangeIndex);
                result.push({
                    index: rangeIndex,
                    canValidlyOrdain: v.canValidlyOrdain,
                    canValidlyConsecrate: v.canValidlyConsecrate
                });
            }
            return result;
        }

        const Rules = getRulesRef(StatusInheritanceRef);
        const getEffective = Rules && typeof Rules.getEffectiveStatus === 'function'
            ? Rules.getEffectiveStatus.bind(Rules)
            : null;
        const isValidForOrders = ValidityRules && typeof ValidityRules.isValidForGivingOrders === 'function'
            ? ValidityRules.isValidForGivingOrders.bind(ValidityRules)
            : (eff) => eff === 'valid' || eff === 'sub_conditione';

        const result = [];
        for (let rangeIndex = 0; rangeIndex <= orderList.length; rangeIndex++) {
            let hasValidOrdination = false;
            let hasValidConsecration = false;

            for (let i = 0; i < rangeIndex; i++) {
                const order = orderList[i];
                if (!order || !order.entry) {
                    continue;
                }
                const record = getEntryRecordFromDom(order.entry);
                const effective = getEffective ? getEffective(record) : 'valid';
                const valid = isValidForOrders(effective);

                if (order.type === 'ordination' && valid) {
                    hasValidOrdination = true;
                }
                if (order.type === 'consecration' && valid) {
                    hasValidConsecration = true;
                }
            }

            const can = hasValidOrdination && hasValidConsecration;
            result.push({
                index: rangeIndex,
                canValidlyOrdain: can,
                canValidlyConsecrate: can
            });
        }

        return result;
    }

    /**
     * Compute validity per range from orders that have .record (e.g. from clergy list).
     * Aligned with rules 1a, 1b, 2 (validity-rules.js). Uses ValidityRules when available.
     *
     * @param {Array<{ type: 'ordination'|'consecration', record: object }>} orders Ordered list with record (no DOM entry)
     * @param {object|null} StatusInheritanceRef
     * @returns {Array<{ index: number, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }>}
     */
    function computeValidityPerRangeFromRecords(orders, StatusInheritanceRef) {
        const orderList = toArray(orders || []);

        if (ValidityRules && typeof ValidityRules.computeValidityPerRangeFromRecords === 'function') {
            return ValidityRules.computeValidityPerRangeFromRecords(orderList);
        }

        const Rules = getRulesRef(StatusInheritanceRef);
        const getEffective = Rules && typeof Rules.getEffectiveStatus === 'function'
            ? Rules.getEffectiveStatus.bind(Rules)
            : null;
        const isValidForOrders = ValidityRules && typeof ValidityRules.isValidForGivingOrders === 'function'
            ? ValidityRules.isValidForGivingOrders.bind(ValidityRules)
            : (eff) => eff === 'valid' || eff === 'sub_conditione';

        const result = [];
        for (let rangeIndex = 0; rangeIndex <= orderList.length; rangeIndex++) {
            let hasValidOrdination = false;
            let hasValidConsecration = false;

            for (let i = 0; i < rangeIndex; i++) {
                const order = orderList[i];
                if (!order || !order.record) {
                    continue;
                }
                const effective = getEffective ? getEffective(order.record) : 'valid';
                const valid = isValidForOrders(effective);

                if (order.type === 'ordination' && valid) {
                    hasValidOrdination = true;
                }
                if (order.type === 'consecration' && valid) {
                    hasValidConsecration = true;
                }
            }

            const can = hasValidOrdination && hasValidConsecration;
            result.push({
                index: rangeIndex,
                canValidlyOrdain: can,
                canValidlyConsecrate: can
            });
        }

        return result;
    }

    /**
     * Build grouped (rangeIndex only) entries for the validation panel: each group has a label,
     * validity flag, and list of { desc, events } — one entry per clergy per range, with all their
     * ordination/consecration events in that range merged.
     *
     * @param {Array<object>} descendants Result of evaluateCascadeImpact with events enriched with rangeIndex, lineType
     * @param {Array<{ index: number, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }>} rangesWithValidity From buildFormBishopRangesWithValidity
     * @returns {Array<{ rangeIndex: number, rangeLabel: string, isValid: boolean, items: Array<{ desc: object, events: Array<object> }> }>}
     */
    function buildDescendantGroupsByRange(descendants, rangesWithValidity) {
        const rangeMap = new Map((rangesWithValidity || []).map(r => [r.index, r]));
        /** @type {Map<number, Map<number, { desc: object, events: Array<object> }>>} rangeIndex -> descId -> { desc, events } */
        const rangeToClergy = new Map();

        toArray(descendants || []).forEach(desc => {
            toArray(desc.events || []).forEach(evt => {
                const ri = evt.rangeIndex;
                const lt = evt.lineType;
                if (ri == null || !lt) {
                    return;
                }
                if (!rangeToClergy.has(ri)) {
                    rangeToClergy.set(ri, new Map());
                }
                const clergyInRange = rangeToClergy.get(ri);
                const descId = desc.id;
                if (!clergyInRange.has(descId)) {
                    clergyInRange.set(descId, { desc, events: [] });
                }
                clergyInRange.get(descId).events.push(evt);
            });
        });

        const groups = [];
        rangeToClergy.forEach((clergyMap, rangeIndex) => {
            const range = rangeMap.get(rangeIndex);
            const items = Array.from(clergyMap.values());

            let hasOrdination = false;
            let hasConsecration = false;
            items.forEach(({ events }) => {
                events.forEach(evt => {
                    if (evt.lineType === 'ordination') {
                        hasOrdination = true;
                    } else if (evt.lineType === 'consecration') {
                        hasConsecration = true;
                    }
                });
            });

            const canValidlyOrdain = range ? range.canValidlyOrdain : false;
            const canValidlyConsecrate = range ? range.canValidlyConsecrate : false;
            const isValid = items.length === 0 ||
                ((!hasOrdination || canValidlyOrdain) && (!hasConsecration || canValidlyConsecrate));
            const rangeLabel = `Range ${rangeIndex} (${isValid ? 'Valid' : 'Invalid'})`;

            groups.push({
                rangeIndex,
                rangeLabel,
                isValid: !!isValid,
                items
            });
        });

        groups.sort((a, b) => a.rangeIndex - b.rangeIndex);
        return groups;
    }

    /**
     * Build form bishop ranges and compute validity per range. Convenience
     * that returns ranges enriched with canValidlyOrdain and canValidlyConsecrate.
     *
     * @param {Element} [root] Optional root for form query (default document)
     * @returns {{ orders: Array, ranges: Array<{ index: number, start: string|null, end: string|null, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }> }}
     */
    function buildFormBishopRangesWithValidity(root) {
        const { orders, ranges } = buildFormBishopRanges(root);
        const validityPerRange = computeValidityPerRange(orders);
        const validityByIndex = new Map(validityPerRange.map(v => [v.index, v]));
        const enrichedRanges = ranges.map(r => ({
            ...r,
            canValidlyOrdain: validityByIndex.get(r.index)?.canValidlyOrdain ?? false,
            canValidlyConsecrate: validityByIndex.get(r.index)?.canValidlyConsecrate ?? false
        }));
        return { orders, ranges: enrichedRanges };
    }

    /**
     * Build ranges and range validity from clergy list data for a given clergy ID.
     * Same timeline/validity semantics as buildFormBishopRangesWithValidity but
     * uses ordination/consecration records from clergyById (no DOM).
     *
     * @param {number} clergyId
     * @param {Map<number, object>} clergyById Map from clergy list (e.g. getOrBuildCachedAdjacency().clergyById)
     * @param {object|null} StatusInheritanceRef Optional StatusInheritance (defaults to window.StatusInheritance)
     * @returns {{ orders: Array<{ type: string, record: object, dateInfo: object }>, ranges: Array<{ index: number, start: string|null, end: string|null, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }> }}
     */
    function buildRangesWithValidityFromClergy(clergyId, clergyById, StatusInheritanceRef) {
        const clergy = clergyById && typeof clergyById.get === 'function' ? clergyById.get(clergyId) : null;
        const defaultRanges = [{ index: 0, start: null, end: null, canValidlyOrdain: false, canValidlyConsecrate: false }];
        if (!clergy) {
            return { orders: [], ranges: defaultRanges };
        }

        const orders = [];
        toArray(clergy.ordinations || []).forEach(record => {
            const dateInfo = getDateFromRecord(record);
            orders.push({
                type: 'ordination',
                record,
                dateInfo,
                sortKey: getOrderSortKey(dateInfo, 'ordination')
            });
        });
        toArray(clergy.consecrations || []).forEach(record => {
            const dateInfo = getDateFromRecord(record);
            orders.push({
                type: 'consecration',
                record,
                dateInfo,
                sortKey: getOrderSortKey(dateInfo, 'consecration')
            });
        });

        orders.sort((a, b) => {
            if (a.sortKey.t !== b.sortKey.t) {
                return a.sortKey.t - b.sortKey.t;
            }
            return a.sortKey.typeOrder - b.sortKey.typeOrder;
        });

        if (orders.length === 0) {
            return { orders: [], ranges: defaultRanges };
        }

        const boundary = (order) => {
            if (order.dateInfo.dateUnknown) {
                return order.dateInfo.year != null ? String(order.dateInfo.year) : 'unknown';
            }
            return order.dateInfo.date;
        };

        const ranges = [];
        ranges.push({ index: 0, start: null, end: boundary(orders[0]) });
        for (let i = 0; i < orders.length - 1; i++) {
            ranges.push({
                index: i + 1,
                start: boundary(orders[i]),
                end: boundary(orders[i + 1])
            });
        }
        ranges.push({
            index: orders.length,
            start: boundary(orders[orders.length - 1]),
            end: null
        });

        const validityPerRange = computeValidityPerRangeFromRecords(orders, StatusInheritanceRef);
        const validityByIndex = new Map(validityPerRange.map(v => [v.index, v]));
        const enrichedRanges = ranges.map(r => ({
            ...r,
            canValidlyOrdain: validityByIndex.get(r.index)?.canValidlyOrdain ?? false,
            canValidlyConsecrate: validityByIndex.get(r.index)?.canValidlyConsecrate ?? false
        }));

        return { orders, ranges: enrichedRanges };
    }

    /**
     * Shared helper: build ranges and range validity from form DOM or clergy list data.
     * Use this for the validation panel and for inline hints so both use the same model.
     *
     * @param {{ root?: Element, clergyId?: number, clergyById?: Map<number, object> }} source
     *   - root: optional form root (document or #clergyForm) to build from form DOM.
     *   - clergyId + clergyById: to build from clergy list when form is not available.
     * @returns {{ orders: Array, ranges: Array<{ index: number, start: string|null, end: string|null, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }> }}
     */
    function buildRangesWithValidity(source) {
        const root = source && source.root;
        const clergyId = source && source.clergyId;
        const clergyById = source && source.clergyById;

        if (root && typeof root.querySelectorAll === 'function') {
            return buildFormBishopRangesWithValidity(root);
        }
        if (clergyId != null && clergyById) {
            return buildRangesWithValidityFromClergy(clergyId, clergyById);
        }
        return { orders: [], ranges: [{ index: 0, start: null, end: null, canValidlyOrdain: false, canValidlyConsecrate: false }] };
    }

    /**
     * Return true if the given clergy has at least one range where they can validly ordain.
     * Uses clergy list data (getOrBuildCachedAdjacency). If list data is not yet loaded, returns true as safe default.
     * @param {number} clergyId
     * @returns {boolean}
     */
    function canClergyValidlyOrdain(clergyId) {
        const { clergyById } = getOrBuildCachedAdjacency();
        if (!clergyById) {
            return true;
        }
        const { ranges } = buildRangesWithValidityFromClergy(clergyId, clergyById);
        return ranges.some(r => r.canValidlyOrdain === true);
    }

    /**
     * Return true if the given clergy has at least one range where they can validly consecrate.
     * Uses clergy list data (getOrBuildCachedAdjacency). If list data is not yet loaded, returns true as safe default.
     * @param {number} clergyId
     * @returns {boolean}
     */
    function canClergyValidlyConsecrate(clergyId) {
        const { clergyById } = getOrBuildCachedAdjacency();
        if (!clergyById) {
            return true;
        }
        const { ranges } = buildRangesWithValidityFromClergy(clergyId, clergyById);
        return ranges.some(r => r.canValidlyConsecrate === true);
    }

    /** Cached result of last buildRangesWithValidity for panel and hints. Cleared when form/selection changes. */
    let cachedRangesWithValidity = null;

    /**
     * Get the current form bishop ranges with validity, building from form DOM or clergy list as appropriate.
     * On form load and on form change we build and cache here so the panel and hints can reuse.
     *
     * @param {Element} [formRoot] Optional form root (defaults to document)
     * @param {number|null} [optionalRootId] Optional clergy ID for clergy-list fallback when form has 0 orders
     * @returns {{ orders: Array, ranges: Array }}
     */
    function getFormBishopRangesWithValidityForPanel(formRoot, optionalRootId) {
        const root = formRoot || (typeof document !== 'undefined' ? document : null);
        const cache = typeof window !== 'undefined' ? window.__validationImpactRangesCache : null;
        const rootId = optionalRootId ?? (typeof window !== 'undefined' ? window.currentSelectedClergyId : undefined) ?? currentRootClergyId;

        const hasForm = root && (root.id === 'clergyForm' || (root.querySelector && root.querySelector('#clergyForm')));
        if (hasForm) {
            const result = buildFormBishopRangesWithValidity(root);
            if (result.orders.length === 0 && rootId != null) {
                const { clergyById } = getOrBuildCachedAdjacency();
                const fallbackResult = buildRangesWithValidity({ clergyId: rootId, clergyById });
                cachedRangesWithValidity = fallbackResult;
                if (typeof window !== 'undefined') {
                    window.__validationImpactRangesCache = fallbackResult;
                }
                return fallbackResult;
            }
            cachedRangesWithValidity = result;
            if (typeof window !== 'undefined') {
                window.__validationImpactRangesCache = result;
            }
            return result;
        }
        if (rootId != null) {
            const { clergyById } = getOrBuildCachedAdjacency();
            const result = buildRangesWithValidity({ clergyId: rootId, clergyById });
            cachedRangesWithValidity = result;
            if (typeof window !== 'undefined') {
                window.__validationImpactRangesCache = result;
            }
            return result;
        }
        if (cache && cache.ranges) {
            return cache;
        }
        const fallback = { orders: [], ranges: [{ index: 0, start: null, end: null, canValidlyOrdain: false, canValidlyConsecrate: false }] };
        cachedRangesWithValidity = fallback;
        return fallback;
    }

    /**
     * Return the last built ranges with validity (for hints / panel without re-querying).
     *
     * @returns {{ orders: Array, ranges: Array }|null}
     */
    function getCachedRangesWithValidity() {
        if (cachedRangesWithValidity) {
            return cachedRangesWithValidity;
        }
        if (typeof window !== 'undefined' && window.__validationImpactRangesCache) {
            return window.__validationImpactRangesCache;
        }
        return null;
    }

    /**
     * Compute a synthetic bishop summary for the currently edited clergy based
     * on the live contents of the clergy form.
     *
     * This mirrors routes.editor._get_bishop_summary on the server. Uses
     * validity-rules.js (getEffectiveStatus, getWorstStatus, isValidForGivingOrders).
     *
     * @param {Element} [root] Optional root element for the form (defaults to document)
     * @returns {{ has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string }}
     */
    function buildSyntheticBishopSummaryFromForm(root) {
        const scope = root || (typeof document !== 'undefined' ? document : null);
        if (!scope) {
            return {
                has_valid_ordination: true,
                has_valid_consecration: true,
                worst_ordination_status: 'valid',
                worst_consecration_status: 'valid'
            };
        }

        const Rules = getRulesRef(null);
        const getEffective = Rules && typeof Rules.getEffectiveStatus === 'function' ? Rules.getEffectiveStatus.bind(Rules) : null;
        const getWorst = Rules && typeof Rules.getWorstStatus === 'function' ? Rules.getWorstStatus.bind(Rules) : null;
        const isValid = ValidityRules && typeof ValidityRules.isValidForGivingOrders === 'function'
            ? ValidityRules.isValidForGivingOrders.bind(ValidityRules)
            : (eff) => eff === 'valid' || eff === 'sub_conditione';

        const ordinationEntries = scope.querySelectorAll ? scope.querySelectorAll('.ordination-entry') : [];
        const consecrationEntries = scope.querySelectorAll ? scope.querySelectorAll('.consecration-entry') : [];

        const ordinationStatuses = [];
        let hasValidOrdination = false;

        toArray(ordinationEntries).forEach(entry => {
            const record = getEntryRecordFromDom(entry);
            const status = getEffective ? getEffective(record) : 'valid';
            ordinationStatuses.push(status);
            if (isValid(status)) {
                hasValidOrdination = true;
            }
        });

        const consecrationStatuses = [];
        let hasValidConsecration = false;

        toArray(consecrationEntries).forEach(entry => {
            const record = getEntryRecordFromDom(entry);
            const status = getEffective ? getEffective(record) : 'valid';
            consecrationStatuses.push(status);
            if (isValid(status)) {
                hasValidConsecration = true;
            }
        });

        const hasAnyOrdinations = ordinationStatuses.length > 0;
        const hasAnyConsecrations = consecrationStatuses.length > 0;

        const worstOrdinationStatus = hasAnyOrdinations && getWorst ? getWorst(ordinationStatuses) : 'valid';
        const worstConsecrationStatus = hasAnyConsecrations && getWorst ? getWorst(consecrationStatuses) : 'valid';

        return {
            has_valid_ordination: hasAnyOrdinations ? hasValidOrdination : true,
            has_valid_consecration: hasAnyConsecrations ? hasValidConsecration : true,
            worst_ordination_status: worstOrdinationStatus || 'valid',
            worst_consecration_status: worstConsecrationStatus || 'valid'
        };
    }

    /**
     * Map an effective status to a validity dropdown value.
     * Matches the mapping in validity-rules.js (Table A validity dropdown):
     *   - valid / sub_conditione / doubtful_event -> 'valid'
     *   - doubtfully_valid -> 'doubtfully_valid'
     *   - invalid -> 'invalid'
     *
     * @param {string} effectiveStatus
     * @returns {'valid'|'doubtfully_valid'|'invalid'}
     */
    function mapEffectiveToValidity(effectiveStatus) {
        if (effectiveStatus === 'invalid') {
            return 'invalid';
        }
        if (effectiveStatus === 'doubtfully_valid') {
            return 'doubtfully_valid';
        }
        return 'valid';
    }

    /**
     * Compute how a single ordination / consecration record's effective status
     * would be treated under a given bishop summary (rules 6–8, validity-rules.js).
     *
     * Returns both the original and adjusted effective statuses along with a
     * flag indicating whether the current status is already allowed or would
     * need to be downgraded.
     *
     * @param {object} record
     * @param {object|null} bishopSummary
     * @param {'ordination'|'consecration'} type
     * @param {object|null} StatusInheritanceRef
     * @returns {{
     *   effectiveBefore: string,
     *   effectiveAfter: string,
     *   isAllowed: boolean,
     *   targetValidity: ('valid'|'doubtfully_valid'|'invalid')|null
     * }}
     */
    function computeAdjustedEffectiveStatus(record, bishopSummary, type, StatusInheritanceRef) {
        const Rules = getRulesRef(StatusInheritanceRef);
        if (!Rules || typeof Rules.getEffectiveStatus !== 'function') {
            return {
                effectiveBefore: 'valid',
                effectiveAfter: 'valid',
                isAllowed: true,
                targetValidity: null
            };
        }

        const effectiveBefore = Rules.getEffectiveStatus(record);

        if (!bishopSummary) {
            return {
                effectiveBefore: effectiveBefore,
                effectiveAfter: effectiveBefore,
                isAllowed: true,
                targetValidity: null
            };
        }

        const getAllowed =
            type === 'consecration'
                ? (Rules.getAllowedConsecrationStatuses || Rules.getAllowedEffectiveConsecrationStatuses)
                : (Rules.getAllowedOrdinationStatuses || Rules.getAllowedEffectiveOrdinationStatuses);

        const allowedEffective = typeof getAllowed === 'function'
            ? (getAllowed(bishopSummary) || [])
            : [];

        const isAllowed = allowedEffective.indexOf(effectiveBefore) !== -1;
        if (isAllowed || allowedEffective.length === 0) {
            return {
                effectiveBefore: effectiveBefore,
                effectiveAfter: effectiveBefore,
                isAllowed: true,
                targetValidity: null
            };
        }

        const effectiveAfter = (Rules.getWorstStatus && typeof Rules.getWorstStatus === 'function')
            ? Rules.getWorstStatus(allowedEffective)
            : (allowedEffective[allowedEffective.length - 1] || effectiveBefore);
        const targetValidity = mapEffectiveToValidity(effectiveAfter);

        return {
            effectiveBefore: effectiveBefore,
            effectiveAfter: effectiveAfter,
            isAllowed: false,
            targetValidity: targetValidity
        };
    }

    /**
     * Compute a synthetic bishop summary for a clergy ID based on clergy list
     * data and synthetic summaries of its ordaining / consecrating bishops.
     *
     * While building this summary we also record per-event impact information
     * for any ordinations / consecrations received from a bishop that already
     * has a synthetic summary in the cascade (typically the root or its
     * ancestors).
     *
     * @param {number} clergyId
     * @param {Map<number, object>} summaryById
     * @param {Map<number, Array<object>>} eventImpactsByChildId
     * @param {Map<number, object>} clergyById
     * @param {object|null} StatusInheritanceRef
     * @param {boolean} isRoot
     * @returns {{ has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string }}
     */
    function buildSyntheticSummaryForClergyId(clergyId, summaryById, eventImpactsByChildId, clergyById, StatusInheritanceRef, isRoot) {
        const Rules = getRulesRef(StatusInheritanceRef);
        const clergy = clergyById.get(clergyId);
        const isValid = ValidityRules && typeof ValidityRules.isValidForGivingOrders === 'function'
            ? ValidityRules.isValidForGivingOrders.bind(ValidityRules)
            : (eff) => eff === 'valid' || eff === 'sub_conditione';

        if (!Rules || !clergy) {
            return {
                has_valid_ordination: true,
                has_valid_consecration: true,
                worst_ordination_status: 'valid',
                worst_consecration_status: 'valid'
            };
        }

        const isRootWithSynthetic = isRoot && summaryById.has(clergyId);

        const ordinationStatuses = [];
        let hasValidOrdination = false;

        (clergy.ordinations || []).forEach(ordination => {
            const bishopId = ordination && ordination.ordaining_bishop_id;
            const parentSummary = bishopId != null ? summaryById.get(bishopId) : null;
            let effectiveStatus;

            if (parentSummary) {
                const adjusted = computeAdjustedEffectiveStatus(ordination, parentSummary, 'ordination', StatusInheritanceRef);
                effectiveStatus = adjusted.effectiveAfter;

                let impacts = eventImpactsByChildId.get(clergyId);
                if (!impacts) {
                    impacts = [];
                    eventImpactsByChildId.set(clergyId, impacts);
                }
                impacts.push({
                    type: 'ordination',
                    parentId: bishopId,
                    record: ordination,
                    effectiveBefore: adjusted.effectiveBefore,
                    effectiveAfter: adjusted.effectiveAfter,
                    isAllowed: adjusted.isAllowed,
                    targetValidity: adjusted.targetValidity
                });
            } else {
                effectiveStatus = Rules.getEffectiveStatus(ordination);
            }

            ordinationStatuses.push(effectiveStatus);
            if (isValid(effectiveStatus)) {
                hasValidOrdination = true;
            }
        });

        const consecrationStatuses = [];
        let hasValidConsecration = false;

        (clergy.consecrations || []).forEach(consecration => {
            const bishopId = consecration && consecration.consecrator_id;
            const parentSummary = bishopId != null ? summaryById.get(bishopId) : null;
            let effectiveStatus;

            if (parentSummary) {
                const adjusted = computeAdjustedEffectiveStatus(consecration, parentSummary, 'consecration', StatusInheritanceRef);
                effectiveStatus = adjusted.effectiveAfter;

                let impacts = eventImpactsByChildId.get(clergyId);
                if (!impacts) {
                    impacts = [];
                    eventImpactsByChildId.set(clergyId, impacts);
                }
                impacts.push({
                    type: 'consecration',
                    parentId: bishopId,
                    record: consecration,
                    effectiveBefore: adjusted.effectiveBefore,
                    effectiveAfter: adjusted.effectiveAfter,
                    isAllowed: adjusted.isAllowed,
                    targetValidity: adjusted.targetValidity
                });
            } else {
                effectiveStatus = Rules.getEffectiveStatus(consecration);
            }

            consecrationStatuses.push(effectiveStatus);
            if (isValid(effectiveStatus)) {
                hasValidConsecration = true;
            }
        });

        const hasAnyOrdinations = ordinationStatuses.length > 0;
        const hasAnyConsecrations = consecrationStatuses.length > 0;

        const worstOrdinationStatus = hasAnyOrdinations && Rules.getWorstStatus
            ? Rules.getWorstStatus(ordinationStatuses)
            : 'valid';
        const worstConsecrationStatus = hasAnyConsecrations && Rules.getWorstStatus
            ? Rules.getWorstStatus(consecrationStatuses)
            : 'valid';

        if (isRootWithSynthetic) {
            return summaryById.get(clergyId);
        }
        return {
            has_valid_ordination: hasAnyOrdinations ? hasValidOrdination : true,
            has_valid_consecration: hasAnyConsecrations ? hasValidConsecration : true,
            worst_ordination_status: worstOrdinationStatus || 'valid',
            worst_consecration_status: worstConsecrationStatus || 'valid'
        };
    }

    /**
     * Evaluate the full-cascade inheritance impact for a given root clergy ID.
     *
     * For each descendant reachable via ordination / consecration edges, this
     * simulates how their incoming events would be constrained under the
     * synthetic bishop summaries of the root and all intervening ancestors.
     *
     * The result can be used by the Validation Impact panel to highlight which
     * descendant events would need to be downgraded and to drive bulk actions.
     *
     * @param {number} rootId
     * @param {{ has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string }} syntheticRootSummary
     * @returns {{
     *   rootId: number,
     *   descendants: Array<{
     *     id: number,
     *     distance: number,
     *     parents: Array<number>,
     *     via: Array<object>,
     *     events: Array<{
     *       type: 'ordination'|'consecration',
     *       parentId: number,
     *       record: object,
     *       effectiveBefore: string,
     *       effectiveAfter: string,
     *       isAllowed: boolean,
     *       targetValidity: ('valid'|'doubtfully_valid'|'invalid')|null
     *     }>,
     *     hasViolation: boolean
     *   }>,
     *   rootEvents: Array<{
     *     type: 'ordination'|'consecration',
     *     parentId: number,
     *     record: object,
     *     effectiveBefore: string,
     *     effectiveAfter: string,
     *     isAllowed: boolean,
     *     targetValidity: ('valid'|'doubtfully_valid'|'invalid')|null
     *   }>,
     *   summariesById: { [id: number]: { has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string } }
     * }}
     */
    function evaluateCascadeImpact(rootId, syntheticRootSummary) {
        if (!rootId || typeof rootId !== 'number') {
            return {
                rootId: rootId,
                descendants: [],
                rootEvents: [],
                summariesById: {}
            };
        }

        const Rules = getRulesRef(null);
        const cache = getOrBuildCachedAdjacency();
        const clergyById = cache.clergyById || new Map();
        const adjacency = cache.adjacency || new Map();

        if (!Rules || !clergyById.has(rootId)) {
            return {
                rootId: rootId,
                descendants: [],
                rootEvents: [],
                summariesById: {}
            };
        }

        const summaryById = new Map();
        const eventImpactsByChildId = new Map();

        if (syntheticRootSummary) {
            summaryById.set(rootId, syntheticRootSummary);
        }

        // Pre-populate summaries for the root's ordaining bishops/consecrators so root's own
        // events get impacts in eventImpactsByChildId (and can be exposed as rootEvents).
        const rootClergy = clergyById.get(rootId);
        if (rootClergy) {
            const rootBishopIds = new Set();
            toArray(rootClergy.ordinations).forEach(o => {
                const id = o && o.ordaining_bishop_id;
                if (id != null && typeof id === 'number') rootBishopIds.add(id);
            });
            toArray(rootClergy.consecrations).forEach(c => {
                const id = c && c.consecrator_id;
                if (id != null && typeof id === 'number') rootBishopIds.add(id);
            });
            rootBishopIds.forEach(bishopId => {
                if (!summaryById.has(bishopId)) {
                    const summary = buildSyntheticSummaryForClergyId(
                        bishopId,
                        summaryById,
                        eventImpactsByChildId,
                        clergyById,
                        Rules,
                        false
                    );
                    summaryById.set(bishopId, summary);
                }
            });
        }

        const descendantDescriptors = getDescendantsBFS(rootId, adjacency);
        const processingOrder = [rootId].concat(descendantDescriptors.map(d => d.id));

        processingOrder.forEach(id => {
            const isRoot = id === rootId;
            const summary = buildSyntheticSummaryForClergyId(
                id,
                summaryById,
                eventImpactsByChildId,
                clergyById,
                Rules,
                isRoot
            );
            summaryById.set(id, summary);
        });

        const { ranges: formBishopRanges } = getFormBishopRangesWithValidityForPanel(document, rootId);

        const descendants = descendantDescriptors.map(desc => {
            const events = eventImpactsByChildId.get(desc.id) || [];
            const enrichedEvents = events.map(evt => {
                if (!evt || evt.parentId !== rootId) {
                    return evt;
                }
                const { unknown } = getEventDateSortValue(evt.record);
                const { rangeIndex, lineType } = placeEventInRange(evt.record, formBishopRanges, evt.type, unknown);
                return Object.assign({}, evt, { rangeIndex, lineType });
            });
            const hasViolation = enrichedEvents.some(evt => evt && evt.isAllowed === false);
            return Object.assign({}, desc, {
                events: enrichedEvents,
                hasViolation: hasViolation
            });
        });

        const rootEventsRaw = eventImpactsByChildId.get(rootId) || [];
        const rootEvents = rootEventsRaw.map(evt => {
            if (!evt) return evt;
            const { unknown } = getEventDateSortValue(evt.record);
            const { rangeIndex, lineType } = placeEventInRange(evt.record, formBishopRanges, evt.type, unknown);
            return Object.assign({}, evt, { rangeIndex, lineType });
        });

        const summariesPlain = {};
        summaryById.forEach((summary, id) => {
            summariesPlain[id] = summary;
        });

        return {
            rootId: rootId,
            descendants: descendants,
            rootEvents: rootEvents,
            summariesById: summariesPlain
        };
    }

    /**
     * Keep track of the last computed cascade impact so that bulk actions
     * can use the same data that was rendered into the panel.
     * @type {{ rootId: number, descendants: Array<object>, summariesById: object }|null}
     */
    let lastImpactResult = null;

    /**
     * Track the currently selected root clergy ID for the Validation Impact
     * panel. This is set via init() when a clergy is selected from the editor.
     * @type {number|null}
     */
    let currentRootClergyId = null;

    /** @type {MutationObserver|null} Observer for ordination/consecration containers so panel re-renders when entries are injected. */
    let entriesObserver = null;
    /** @type {number|null} Debounce timer for entries-observer callback. */
    let entriesObserverDebounceTimer = null;
    const ENTRIES_OBSERVER_DEBOUNCE_MS = 100;

    /**
     * Set up a MutationObserver on #ordinationsContainer and #consecrationsContainer.
     * When entries are added (e.g. by initializeFormFromRank), re-run the panel from form data
     * so it switches from list-based to form-based ranges.
     */
    function setupEntriesObserver() {
        if (typeof document === 'undefined') {
            return;
        }
        if (entriesObserver) {
            entriesObserver.disconnect();
            entriesObserver = null;
        }
        if (entriesObserverDebounceTimer != null) {
            clearTimeout(entriesObserverDebounceTimer);
            entriesObserverDebounceTimer = null;
        }
        const form = document.getElementById('clergyForm');
        const root = form || document;
        const ordinationsContainer = root.querySelector('#ordinationsContainer');
        const consecrationsContainer = root.querySelector('#consecrationsContainer');
        if (!ordinationsContainer && !consecrationsContainer) {
            return;
        }
        entriesObserver = new MutationObserver(function (mutations) {
            const hasAdditions = mutations.some(function (m) {
                return m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0;
            });
            if (!hasAdditions) {
                return;
            }
            if (entriesObserverDebounceTimer != null) {
                clearTimeout(entriesObserverDebounceTimer);
            }
            entriesObserverDebounceTimer = window.setTimeout(function () {
                entriesObserverDebounceTimer = null;
                if (currentRootClergyId != null && Number.isFinite(currentRootClergyId)) {
                    handleFormChanged();
                }
            }, ENTRIES_OBSERVER_DEBOUNCE_MS);
        });
        const observerOpts = { childList: true, subtree: true };
        if (ordinationsContainer) {
            entriesObserver.observe(ordinationsContainer, observerOpts);
        }
        if (consecrationsContainer) {
            entriesObserver.observe(consecrationsContainer, observerOpts);
        }
    }

    /**
     * Render an explicit "no selection" empty state into the Validation
     * Impact panel. Safe to call whenever there is no active clergy.
     */
    function renderValidationImpactEmpty() {
        if (typeof document === 'undefined') {
            return;
        }

        const panel = document.getElementById('validationImpactPanel');
        if (!panel) {
            return;
        }

        panel.innerHTML = '';

        const empty = document.createElement('div');
        empty.className = 'validation-impact-empty';
        empty.textContent = 'Select a clergy record to preview validation impact on its descendants.';
        panel.appendChild(empty);
    }

    /**
     * Render a lightweight loading state into the Validation Impact panel.
     * This can be used while cascade data is being recomputed.
     *
     * @param {string} [message]
     */
    function renderValidationImpactLoading(message) {
        if (typeof document === 'undefined') {
            return;
        }

        const panel = document.getElementById('validationImpactPanel');
        if (!panel) {
            return;
        }

        panel.innerHTML = '';

        const loading = document.createElement('div');
        loading.className = 'validation-impact-loading';
        loading.textContent = message || 'Computing validation impact...';
        panel.appendChild(loading);
    }

    /**
     * Render the Validation Impact panel DOM for a given cascade impact result.
     *
     * This focuses purely on DOM structure and visual state:
     *  - Descendant list with truncated name.
     *  - Relation badges (Ord. / Cons.).
     *  - Current status badge (worst effective status across relevant events).
     *  - Affected marker (when any event would be downgraded).
     *  - Per-row checkbox and "Update this clergy" button scaffolding.
     *
     * Behavioural wiring (select all, bulk apply, per-row actions) is handled
     * by follow-on tasks; this function only controls markup and basic state.
     *
     * @param {{ rootId: number, descendants: Array<object> }} impactResult
     */
    function renderValidationImpactPanel(impactResult) {
        if (typeof document === 'undefined') {
            return;
        }

        const panel = document.getElementById('validationImpactPanel');
        if (!panel) {
            return;
        }

        lastImpactResult = impactResult || null;

        panel.innerHTML = '';

        if (!impactResult || !impactResult.rootId) {
            renderValidationImpactEmpty();
            return;
        }

        const descendants = Array.isArray(impactResult.descendants) ? impactResult.descendants : [];
        const unsaved = typeof window !== 'undefined' && typeof window.isClergyFormDirty === 'function' && window.isClergyFormDirty();

        if (descendants.length === 0) {
            const stateIndicator = document.createElement('div');
            stateIndicator.className = 'validation-impact-state-indicator validation-impact-state-indicator--' + (unsaved ? 'unsaved' : 'saved');
            stateIndicator.setAttribute('aria-live', 'polite');
            stateIndicator.textContent = unsaved ? 'Showing: unsaved form' : 'Showing: saved record';
            panel.appendChild(stateIndicator);
            const empty = document.createElement('div');
            empty.className = 'validation-impact-empty';
            empty.textContent = 'No descendant clergy found for this bishop in the current graph.';
            panel.appendChild(empty);
            return;
        }

        const cache = getOrBuildCachedAdjacency();
        const clergyById = cache.clergyById || new Map();

        const affectedCount = descendants.reduce((count, desc) => desc && desc.hasViolation ? count + 1 : count, 0);

        const stateIndicator = document.createElement('div');
        stateIndicator.className = 'validation-impact-state-indicator validation-impact-state-indicator--' + (unsaved ? 'unsaved' : 'saved');
        stateIndicator.setAttribute('aria-live', 'polite');
        stateIndicator.textContent = unsaved ? 'Showing: unsaved form' : 'Showing: saved record';

        const actions = document.createElement('div');
        actions.className = 'validation-impact-actions';

        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.className = 'validation-impact-btn-apply';
        applyButton.disabled = affectedCount === 0;
        applyButton.setAttribute('data-role', 'validation-impact-apply-all');
        applyButton.innerHTML = '<i class="fas fa-balance-scale-right" aria-hidden="true"></i><span>Apply to all affected</span>';

        const metaLine = document.createElement('div');
        metaLine.className = 'editor-text-xs editor-text-tertiary';
        metaLine.textContent = affectedCount > 0
            ? `${affectedCount} descendant${affectedCount === 1 ? '' : 's'} will need status adjustment.`
            : 'All descendant clergy are currently consistent with this bishop\'s validity.';

        const selectAllWrapper = document.createElement('label');
        selectAllWrapper.className = 'editor-text-xs editor-text-muted';
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.id = 'validationImpactSelectAll';
        selectAllCheckbox.setAttribute('data-role', 'validation-impact-select-all');
        selectAllCheckbox.checked = affectedCount > 0;
        selectAllCheckbox.style.marginRight = '0.35em';
        selectAllWrapper.appendChild(selectAllCheckbox);
        selectAllWrapper.appendChild(document.createTextNode('Include all affected descendants'));

        actions.appendChild(applyButton);
        actions.appendChild(metaLine);
        actions.appendChild(selectAllWrapper);

        panel.appendChild(stateIndicator);
        panel.appendChild(actions);

        const Rules = getRulesRef(null);
        const { ranges: rangesWithValidity } = getFormBishopRangesWithValidityForPanel(typeof document !== 'undefined' ? document : null, impactResult.rootId);
        const groups = buildDescendantGroupsByRange(descendants, rangesWithValidity);

        function buildDescendantRow(desc, events, clergyByIdRef, RulesRef) {
            const eventList = Array.isArray(events) ? events : [];
            const hasViolation = eventList.some(evt => evt && evt.isAllowed === false);

            const row = document.createElement('li');
            row.className = 'validation-impact-descendant-row';
            row.setAttribute('data-clergy-id', String(desc.id));
            if (hasViolation) {
                row.classList.add('affected');
                row.setAttribute('data-affected', 'true');
            }

            const clergy = clergyByIdRef.get(desc.id) || {};
            const fullName = clergy.name || clergy.display_name || `Clergy #${desc.id}`;
            const VALIDATION_IMPACT_NAME_MAX_LEN = 25;
            const displayName = fullName.length > VALIDATION_IMPACT_NAME_MAX_LEN
                ? fullName.slice(0, VALIDATION_IMPACT_NAME_MAX_LEN - 3) + '...'
                : fullName;

            const nameEl = document.createElement('span');
            nameEl.className = 'validation-impact-descendant-name';
            nameEl.textContent = displayName;
            nameEl.title = fullName;

            const relationBadges = document.createElement('span');
            relationBadges.className = 'validation-impact-relation-badges';
            eventList.forEach(evt => {
                if (!evt) {
                    return;
                }
                const typeShort = evt.lineType === 'consecration' ? 'Cons.' : 'Ord.';
                const statusForBadge = evt.effectiveAfter || evt.effectiveBefore;
                const statusLabel = (RulesRef && typeof RulesRef.getStatusLabel === 'function')
                    ? RulesRef.getStatusLabel(statusForBadge)
                    : (statusForBadge || 'Valid');
                const chip = document.createElement('span');
                chip.className = 'validation-impact-relation-chip';
                chip.textContent = `${typeShort} ${statusLabel}`;
                relationBadges.appendChild(chip);
            });

            const statusContainer = document.createElement('span');
            statusContainer.className = 'validation-impact-status-badges';

            const effectiveStatuses = eventList
                .map(evt => evt && (evt.effectiveBefore || evt.effectiveAfter))
                .filter(Boolean);
            const worstStatus = (effectiveStatuses.length > 0 && RulesRef && typeof RulesRef.getWorstStatus === 'function')
                ? RulesRef.getWorstStatus(effectiveStatuses)
                : null;

            if (worstStatus) {
                const statusBadge = document.createElement('span');
                statusBadge.className = 'validation-impact-badge validation-impact-badge--' + worstStatus;
                statusBadge.textContent = (RulesRef && typeof RulesRef.getStatusLabel === 'function')
                    ? RulesRef.getStatusLabel(worstStatus)
                    : (worstStatus || 'Valid');
                statusContainer.appendChild(statusBadge);
            }

            if (hasViolation) {
                const impactBadge = document.createElement('span');
                impactBadge.className = 'validation-impact-badge validation-impact-badge--doubtfully_valid';
                impactBadge.textContent = 'Will downgrade';
                statusContainer.appendChild(impactBadge);
            }

            const actionsCell = document.createElement('span');
            actionsCell.className = 'validation-impact-row-actions';

            const rowCheckbox = document.createElement('input');
            rowCheckbox.type = 'checkbox';
            rowCheckbox.className = 'validation-impact-row-select';
            rowCheckbox.setAttribute('data-clergy-id', String(desc.id));
            rowCheckbox.checked = !!desc.hasViolation;

            const rowButton = document.createElement('button');
            rowButton.type = 'button';
            rowButton.className = 'validation-impact-btn-row';
            rowButton.setAttribute('data-clergy-id', String(desc.id));
            rowButton.textContent = 'Update this clergy';

            actionsCell.appendChild(rowCheckbox);
            actionsCell.appendChild(rowButton);

            row.appendChild(nameEl);
            row.appendChild(relationBadges);
            row.appendChild(statusContainer);
            row.appendChild(actionsCell);

            return row;
        }

        const visibleGroups = (groups || []).filter(
            grp => grp.rangeIndex > 1 || (grp.items && grp.items.length > 0)
        );
        if (groups.length === 0) {
            const emptyGroupsNote = document.createElement('div');
            emptyGroupsNote.className = 'validation-impact-empty editor-text-xs editor-text-tertiary';
            emptyGroupsNote.textContent = 'No ordination or consecration events by this bishop in the current graph.';
            panel.appendChild(emptyGroupsNote);
        } else {
            visibleGroups.forEach(grp => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'validation-impact-group';

                const groupHeader = document.createElement('div');
                groupHeader.className = 'validation-impact-group-header';
                groupHeader.setAttribute('data-range-index', String(grp.rangeIndex));
                const headerLabel = document.createElement('span');
                headerLabel.className = 'validation-impact-group-title';
                headerLabel.textContent = grp.rangeLabel;
                const headerValidity = document.createElement('span');
                headerValidity.className = grp.isValid ? 'validation-impact-group-valid' : 'validation-impact-group-invalid';
                headerValidity.textContent = grp.isValid ? 'valid' : 'invalid';
                groupHeader.appendChild(headerLabel);
                groupHeader.appendChild(headerValidity);

                const list = document.createElement('ul');
                list.className = 'validation-impact-descendant-list';

                grp.items.forEach(({ desc, events: itemEvents }) => {
                    const row = buildDescendantRow(desc, itemEvents, clergyById, Rules);
                    list.appendChild(row);
                });

                groupDiv.appendChild(groupHeader);
                groupDiv.appendChild(list);
                panel.appendChild(groupDiv);
            });
        }

        function getRowCheckboxes() {
            return Array.prototype.slice.call(
                panel.querySelectorAll('.validation-impact-row-select')
            );
        }

        function getAffectedRowCheckboxes() {
            return getRowCheckboxes().filter(function (checkbox) {
                const row = checkbox.closest('.validation-impact-descendant-row');
                return row && row.getAttribute('data-affected') === 'true';
            });
        }

        function updateApplyButtonState() {
            const affectedCheckboxes = getAffectedRowCheckboxes();
            const anySelected = affectedCheckboxes.some(function (checkbox) {
                return checkbox.checked;
            });
            applyButton.disabled = !anySelected;

            if (selectAllCheckbox) {
                const allSelected = affectedCheckboxes.length > 0 && affectedCheckboxes.every(function (checkbox) {
                    return checkbox.checked;
                });
                selectAllCheckbox.checked = allSelected && anySelected;
            }
        }

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function () {
                const checked = !!this.checked;
                getAffectedRowCheckboxes().forEach(function (checkbox) {
                    checkbox.checked = checked;
                });
                updateApplyButtonState();
            });
        }

        getRowCheckboxes().forEach(function (checkbox) {
            checkbox.addEventListener('change', function () {
                updateApplyButtonState();
            });
        });

        const rowButtons = panel.querySelectorAll('.validation-impact-btn-row');
        Array.prototype.forEach.call(rowButtons, function (button) {
            button.addEventListener('click', function () {
                const clergyId = this.getAttribute('data-clergy-id');
                if (!clergyId) {
                    return;
                }
                const row = panel.querySelector('.validation-impact-descendant-row[data-clergy-id="' + clergyId + '"]');
                if (!row) {
                    return;
                }
                const checkbox = row.querySelector('.validation-impact-row-select');
                if (!checkbox) {
                    return;
                }
                checkbox.checked = !checkbox.checked;
                updateApplyButtonState();
            });
        });

        applyButton.addEventListener('click', function () {
            const api = (typeof window !== 'undefined' && window.ValidationImpactPanel) ? window.ValidationImpactPanel : null;
            if (api && typeof api.applyBulkChanges === 'function') {
                api.applyBulkChanges();
            } else if (window.EDITOR_DEBUG && typeof console !== 'undefined' && console.warn) {
                console.warn('ValidationImpactPanel.applyBulkChanges is not defined yet.');
            }
        });

        updateApplyButtonState();
    }

    /**
     * Build and submit a bulk changes payload for all selected descendant
     * rows in the Validation Impact panel. On success, triggers soft
     * refreshes for the visualization, clergy list, and clergy form.
     */
    async function applyBulkChanges() {
        if (typeof document === 'undefined' || typeof fetch === 'undefined') {
            return;
        }

        const panel = document.getElementById('validationImpactPanel');
        if (!panel) {
            return;
        }

        // Derive the current root clergy ID from the last impact result or
        // fall back to the globally-tracked selected clergy.
        const parsedImpact = lastImpactResult && lastImpactResult.rootId != null
            ? parseInt(lastImpactResult.rootId, 10)
            : NaN;
        const rootIdFromImpact = Number.isFinite(parsedImpact) ? parsedImpact : null;
        const globalParsed = (typeof window !== 'undefined' && window.currentSelectedClergyId != null)
            ? parseInt(window.currentSelectedClergyId, 10)
            : NaN;
        const globalRootId = Number.isFinite(globalParsed) ? globalParsed : null;
        const rootClergyId = rootIdFromImpact ?? globalRootId;

        if (!rootClergyId) {
            if (window.EDITOR_DEBUG && typeof console !== 'undefined' && console.warn) {
                console.warn('ValidationImpactPanel.applyBulkChanges: no root clergy ID available.');
            }
            if (typeof window !== 'undefined' && typeof window.showNotification === 'function') {
                window.showNotification('No clergy selected. Select a clergy member first, then run validation impact.', 'warning');
            } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('No clergy selected. Select a clergy member first, then run validation impact.');
            }
            return;
        }

        // Collect selected descendant IDs from the current panel DOM.
        const checkboxes = Array.prototype.slice.call(
            panel.querySelectorAll('.validation-impact-row-select')
        );
        const selectedIds = checkboxes
            .filter(function (checkbox) {
                if (!checkbox.checked) {
                    return false;
                }
                const row = checkbox.closest('.validation-impact-descendant-row');
                return row && row.getAttribute('data-affected') === 'true';
            })
            .map(function (checkbox) {
                const idStr = checkbox.getAttribute('data-clergy-id');
                const idNum = idStr ? parseInt(idStr, 10) : NaN;
                return Number.isFinite(idNum) ? idNum : null;
            })
            .filter(function (id) { return id !== null; });

        if (selectedIds.length === 0) {
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert("No descendants selected. Check 'Update this clergy' for the ones to update.");
            }
            return;
        }

        // Recompute cascade impact using the latest form state so that
        // targetValidity values match the user's current edits.
        const syntheticRootSummary = buildSyntheticBishopSummaryFromForm(
            typeof document !== 'undefined' ? document : null
        );
        const impact = evaluateCascadeImpact(rootClergyId, syntheticRootSummary);
        lastImpactResult = impact;

        // Build the changes payload from all violating events for the
        // selected descendants, plus the root's own violating events.
        const changes = [];
        const descendants = Array.isArray(impact.descendants) ? impact.descendants : [];
        descendants.forEach(function (desc) {
            if (!desc || typeof desc.id !== 'number') {
                return;
            }
            if (selectedIds.indexOf(desc.id) === -1) {
                return;
            }

            const events = Array.isArray(desc.events) ? desc.events : [];
            events.forEach(function (evt) {
                if (!evt || evt.isAllowed !== false || !evt.targetValidity) {
                    return;
                }

                const record = evt.record || {};
                const rawId = record.id;
                const eventId = typeof rawId === 'number' ? rawId : parseInt(rawId, 10);
                if (!Number.isFinite(eventId)) {
                    return;
                }

                const type = evt.type === 'consecration' ? 'consecration' : 'ordination';
                changes.push({
                    type: type,
                    id: eventId,
                    new_validity: evt.targetValidity
                });
            });
        });

        // Include root's own violating events so the root form can show updated validity and "Inherited".
        const rootEvents = Array.isArray(impact.rootEvents) ? impact.rootEvents : [];
        rootEvents.forEach(function (evt) {
            if (!evt || evt.isAllowed !== false || !evt.targetValidity) {
                return;
            }
            const record = evt.record || {};
            const rawId = record.id;
            const eventId = typeof rawId === 'number' ? rawId : parseInt(rawId, 10);
            if (!Number.isFinite(eventId)) {
                return;
            }
            const type = evt.type === 'consecration' ? 'consecration' : 'ordination';
            changes.push({
                type: type,
                id: eventId,
                new_validity: evt.targetValidity
            });
        });

        if (changes.length === 0) {
            if (typeof window !== 'undefined' && typeof window.showNotification === 'function') {
                window.showNotification('No validity changes to apply for the selected descendants.', 'warning');
            } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('No validity changes to apply for the selected descendants.');
            }
            return;
        }

        const applyButton = panel.querySelector('[data-role="validation-impact-apply-all"]');
        let originalHtml = null;
        if (applyButton) {
            originalHtml = applyButton.innerHTML;
            applyButton.disabled = true;
            applyButton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Applying...</span>';
        }

        try {
            const response = await fetch('/editor/api/validation-impact/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    root_clergy_id: Math.floor(rootClergyId),
                    changes: changes
                })
            });

            const data = await response.json().catch(function () { return {}; });

            if (!response.ok || data.error) {
                if (window.EDITOR_DEBUG && typeof console !== 'undefined' && console.error) {
                    console.error('Validation impact bulk update failed:', data.error || response.statusText);
                }
                if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                    window.alert('Failed to apply bulk validation updates. Please try again.');
                }
                return;
            }

            // Invalidate caches so subsequent panel operations use fresh data.
            if (typeof window !== 'undefined') {
                window.__validationImpactGraphCache = undefined;
                window.__validationImpactRangesCache = undefined;
            }

            // Soft refresh the visualization so its link colours / statuses
            // reflect the newly applied validity changes.
            if (typeof window !== 'undefined' && typeof window.softRefreshVisualization === 'function') {
                window.softRefreshVisualization();
            }

            // Soft-update clergy list items for all affected clergy, falling
            // back to a full list refresh if the helper is unavailable.
            const affectedIds = Array.isArray(data.affected_clergy_ids) ? data.affected_clergy_ids : [];
            if (affectedIds.length > 0) {
                if (typeof window !== 'undefined' && typeof window.softUpdateClergyListItem === 'function') {
                    affectedIds.forEach(function (id) {
                        if (id) {
                            window.softUpdateClergyListItem(id);
                        }
                    });
                } else if (typeof window !== 'undefined' && typeof window.refreshClergyListImages === 'function') {
                    window.refreshClergyListImages();
                }
            }

            // Refresh the clergy form for the root clergy if available so the
            // editor sees updated validity flags immediately.
            const refreshedRootId = data.root_clergy_id || rootClergyId;
            if (typeof window !== 'undefined') {
                if (typeof window.refreshClergyFormSmooth === 'function') {
                    window.refreshClergyFormSmooth(refreshedRootId);
                } else if (typeof window.refreshClergyForm === 'function') {
                    window.refreshClergyForm(refreshedRootId);
                }
            }

            // After the backend has applied changes, re-evaluate the cascade
            // based on the current (possibly reloaded) form state to update
            // the panel UI.
            const newSyntheticSummary = buildSyntheticBishopSummaryFromForm(
                typeof document !== 'undefined' ? document : null
            );
            const newImpact = evaluateCascadeImpact(refreshedRootId, newSyntheticSummary);
            lastImpactResult = newImpact;
            renderValidationImpactPanel(newImpact);
        } catch (error) {
            if (window.EDITOR_DEBUG && typeof console !== 'undefined' && console.error) {
                console.error('Error during validation impact bulk update:', error);
            }
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('An unexpected error occurred while applying bulk validation updates.');
            }
        } finally {
            if (applyButton) {
                applyButton.disabled = false;
                if (originalHtml !== null) {
                    applyButton.innerHTML = originalHtml;
                }
            }
        }
    }

    /**
     * Internal helper to attach change listeners to the clergy form so that
     * the Validation Impact panel can react to live edits to validity
     * dropdowns and status checkboxes.
     * Validation panel updates are intentionally synchronous so changes are instant.
     *
     * @param {Element} root
     */
    function wireFormChangeListeners(root) {
        if (typeof document === 'undefined') {
            return;
        }
        const scope = root || document;
        const form = scope.querySelector ? (scope.querySelector('#clergyForm') || (scope.closest && scope.closest('#clergyForm'))) : document.getElementById('clergyForm');
        if (!form) {
            return;
        }
        if (form.getAttribute('data-validation-impact-wired') === 'true') {
            return;
        }
        form.setAttribute('data-validation-impact-wired', 'true');

        form.addEventListener('change', function (event) {
            const target = event.target;
            if (!target || !target.name) {
                return;
            }
            if (
                target.matches('select[name*="[validity]"]') ||
                target.matches('input[name*="[is_sub_conditione]"]') ||
                target.matches('input[name*="[is_doubtful_event]"]')
            ) {
                if (typeof window !== 'undefined' && window.ValidationImpactPanel && typeof window.ValidationImpactPanel.onFormChanged === 'function') {
                    window.ValidationImpactPanel.onFormChanged();
                }
            }
        });
    }

    /**
     * Initialise the Validation Impact panel for a given root clergy ID.
     * This computes a synthetic bishop summary from the live form, then
     * evaluates the cascade impact and renders the panel.
     *
     * @param {number|null} rootClergyId
     */
    function initValidationImpact(rootClergyId) {
        if (typeof document === 'undefined') {
            return;
        }

        const numericId = rootClergyId != null ? parseInt(rootClergyId, 10) : NaN;
        if (!Number.isFinite(numericId)) {
            currentRootClergyId = null;
            renderValidationImpactEmpty();
            return;
        }

        currentRootClergyId = numericId;
        renderValidationImpactLoading('Computing validation impact...');

        const formRoot = document.getElementById('clergyForm') || document;
        getFormBishopRangesWithValidityForPanel(formRoot, currentRootClergyId);

        const syntheticSummary = buildSyntheticBishopSummaryFromForm(formRoot);
        const impact = evaluateCascadeImpact(currentRootClergyId, syntheticSummary);
        lastImpactResult = impact;
        renderValidationImpactPanel(impact);

        wireFormChangeListeners(document.getElementById('clergyForm') || document);
        setupEntriesObserver();
    }

    /**
     * Recompute the cascade impact when the clergy form changes. This uses
     * the current root clergy ID and the latest synthetic bishop summary.
     * Validation panel updates are intentionally synchronous so changes are instant.
     */
    function handleFormChanged() {
        if (typeof document === 'undefined') {
            return;
        }
        if (!currentRootClergyId || !Number.isFinite(currentRootClergyId)) {
            return;
        }
        const formRoot = document.getElementById('clergyForm') || document;
        getFormBishopRangesWithValidityForPanel(formRoot, currentRootClergyId);
        const syntheticSummary = buildSyntheticBishopSummaryFromForm(formRoot);
        const impact = evaluateCascadeImpact(currentRootClergyId, syntheticSummary);
        lastImpactResult = impact;
        renderValidationImpactPanel(impact);
    }

    /**
     * Public API surface for this module.
     */
    const exported = {
        buildAdjacencyFromClergyList,
        getDescendantsBFS,
        getDescendantsDFS,
        getOrBuildCachedAdjacency,
        getDateFromFormEntry,
        getDateFromRecord,
        getEventDateSortValue,
        getBoundarySortValue,
        placeEventInRange,
        buildFormBishopRanges,
        computeValidityPerRange,
        computeValidityPerRangeFromRecords,
        buildFormBishopRangesWithValidity,
        buildRangesWithValidityFromClergy,
        buildRangesWithValidity,
        canClergyValidlyOrdain,
        canClergyValidlyConsecrate,
        getFormBishopRangesWithValidityForPanel,
        getCachedRangesWithValidity,
        buildDescendantGroupsByRange,
        buildSyntheticBishopSummaryFromForm,
        evaluateCascadeImpact,
        renderValidationImpactPanel,
        renderValidationImpactEmpty,
        renderValidationImpactLoading,
        applyBulkChanges,
        init: initValidationImpact,
        onFormChanged: handleFormChanged
    };

    if (typeof window !== 'undefined') {
        const existing = window.ValidationImpactPanel || {};
        window.ValidationImpactPanel = Object.assign(existing, exported);

        // Wire global events: clergySelected and HTMX afterSwap
        document.body.addEventListener('clergySelected', function (event) {
            const detail = event && event.detail ? event.detail : {};
            const clergyId = detail.clergyId;
            if (clergyId == null) {
                renderValidationImpactEmpty();
                currentRootClergyId = null;
                return;
            }
            if (typeof window.ValidationImpactPanel.init === 'function') {
                window.ValidationImpactPanel.init(clergyId);
            }
        });

        document.body.addEventListener('htmx:afterSwap', function (event) {
            const target = (event.detail && event.detail.target) || event.target;
            if (!target) {
                return;
            }
            const containsForm = target.querySelector && target.querySelector('#clergyForm');
            const isForm = target.id === 'clergyForm';
            if (!(containsForm || isForm)) {
                return;
            }
            const formElement = containsForm || (isForm ? target : null) || document.getElementById('clergyForm');
            wireFormChangeListeners(formElement || document);
            // Observe ordination/consecration containers so when entries are injected we re-render the panel
            window.setTimeout(setupEntriesObserver, 0);

            // Defer panel init until form entries are populated (clergyFormEntriesPopulated event)
            // so panel uses form-based data after switchToEditMode / save
        });

        document.body.addEventListener('clergyFormEntriesPopulated', function (event) {
            const rootId = (event.detail && event.detail.rootId != null) ? event.detail.rootId : (typeof window.currentSelectedClergyId === 'number' ? window.currentSelectedClergyId : currentRootClergyId);
            if (rootId && typeof window.ValidationImpactPanel.init === 'function') {
                window.ValidationImpactPanel.init(rootId);
            } else if (!rootId) {
                renderValidationImpactEmpty();
            }
        });
    } else if (typeof globalThis !== 'undefined') {
        const existing = globalThis.ValidationImpactPanel || {};
        globalThis.ValidationImpactPanel = Object.assign(existing, exported);
    }
})();

