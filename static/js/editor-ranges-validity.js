(() => {
    'use strict';

    /**
     * Shared range / validity helpers for ordination & consecration timelines.
     *
     * This module is intentionally DOM-agnostic and operates on plain records
     * and clergy-list data so it can be reused by:
     *  - The Validation Impact panel (`editor-validation-impact.js`)
     *  - The Editor v2 right panel (ordained / consecrated view)
     *
     * Canonical rules: `docs/VALIDITY_RULES.md` and `static/js/validity-rules.js`.
     */

    const ValidityRules = (typeof window !== 'undefined' && window.ValidityRules) ? window.ValidityRules : null;

    function toArray(value) {
        if (!value) {
            return [];
        }
        return Array.isArray(value) ? value : Array.from(value);
    }

    /**
     * Get date info from a clergy-list ordination/consecration record (date, date_unknown, year, details_unknown).
     *
     * @param {object} record Ordination or consecration record from clergyListData
     * @returns {{ date: string|null, year: number|null, dateUnknown: boolean, detailsUnknownNoDate: boolean }}
     */
    function getDateFromRecord(record) {
        if (!record) {
            return { date: null, year: null, dateUnknown: true, detailsUnknownNoDate: false };
        }
        const detailsUnknown = record.details_unknown === true || record.details_unknown === 1 || record.details_unknown === '1' || record.details_unknown === 'on';
        const dateVal = record.date && String(record.date).trim();
        if (dateVal) {
            return { date: dateVal, year: null, dateUnknown: false, detailsUnknownNoDate: false };
        }
        const isUnknown = record.date_unknown === true || record.date_unknown === 1 || record.date_unknown === '1' || record.date_unknown === 'on';
        if (isUnknown) {
            const y = record.year != null ? parseInt(record.year, 10) : NaN;
            const year = Number.isFinite(y) ? y : null;
            return {
                date: null,
                year,
                dateUnknown: true,
                detailsUnknownNoDate: !!detailsUnknown && year == null
            };
        }
        return { date: null, year: null, dateUnknown: true, detailsUnknownNoDate: !!detailsUnknown };
    }

    /**
     * Sortable value for an event date for range comparison.
     * Unknown dates map to Infinity. Details-unknown with no date/year map to -Infinity (earliest; ordination before consecration).
     *
     * @param {object} record Ordination/consecration record with date, date_unknown, year, details_unknown
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
        if (dateInfo.detailsUnknownNoDate) {
            return { t: -Infinity, unknown: false };
        }
        return { t: Infinity, unknown: true };
    }

    /**
     * Sortable value for a range boundary (start or end).
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
            return asEnd ? Infinity : -Infinity;
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
     * Place a descendant event (by date) into a bishop's timeline; return the range index and line type.
     * Events with unknown date are placed in the last range. When a range boundary is 'unknown', only
     * unknown-dated events are placed in that range; known-dated events are compared numerically
     * against boundaries (including legacy 'unknown' boundaries treated as -Infinity/+Infinity).
     *
     * @param {object} record Ordination or consecration record (with date, date_unknown, year, details_unknown)
     * @param {Array<{ index: number, start: string|null, end: string|null }>} ranges
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
            const startVal = getBoundarySortValue(r.start, false);
            const endVal = getBoundarySortValue(r.end, true);
            if (eventT >= startVal && eventT < endVal) {
                return { rangeIndex: r.index, lineType: lineType };
            }
        }
        return { rangeIndex: rangeList[rangeList.length - 1].index, lineType: lineType };
    }

    /**
     * Sort key for ordering bishop orders by date.
     * Unknown dates sort last; details-unknown with no date/year sort earliest (ordination before consecration); same date uses type order.
     * @param {{ date: string|null, year: number|null, dateUnknown: boolean, detailsUnknownNoDate?: boolean }} dateInfo
     * @param {'ordination'|'consecration'} type
     * @returns {{ t: number, typeOrder: number }}
     */
    function getOrderSortKey(dateInfo, type) {
        const typeOrder = type === 'consecration' ? 1 : 0;
        if (dateInfo.dateUnknown) {
            if (dateInfo.year != null) {
                const t = new Date(dateInfo.year, 0, 1).getTime();
                return { t, typeOrder };
            }
            if (dateInfo.detailsUnknownNoDate) {
                return { t: -Infinity, typeOrder };
            }
            return { t: Infinity, typeOrder };
        }
        const t = new Date(dateInfo.date).getTime();
        return { t: Number.isFinite(t) ? t : Infinity, typeOrder };
    }

    /**
     * Internal: apply canonical ordering for a bishop's orders history.
     *
     * - A details-unknown ordination with no date/year is pinned as the very first record.
     * - A details-unknown consecration with no date/year is pinned as:
     *   - The second record when there is at least one ordination in the history.
     *   - The first record when there are no ordinations.
     * - All remaining records follow the existing date/type sort order.
     *
     * When multiple details-unknown ordinations or consecrations exist, the first in input order
     * is chosen for the pinned slot to keep behavior deterministic.
     *
     * @param {Array<{ type: 'ordination'|'consecration', record: object, dateInfo?: object }>} orders
     * @returns {Array<{ type: 'ordination'|'consecration', record: object, dateInfo: object, sortKey: object }>}
     */
    function buildOrderedOrders(orders) {
        const list = toArray(orders || []).map((o, index) => {
            const dateInfo = o.dateInfo || getDateFromRecord(o.record);
            return {
                type: o.type,
                record: o.record,
                dateInfo,
                originalIndex: index
            };
        });

        if (list.length === 0) {
            return [];
        }

        const hasAnyOrdination = list.some(o => o.type === 'ordination');

        const detailsUnknownOrdinations = list.filter(
            o => o.type === 'ordination' && o.dateInfo && o.dateInfo.detailsUnknownNoDate
        );
        const detailsUnknownConsecrations = list.filter(
            o => o.type === 'consecration' && o.dateInfo && o.dateInfo.detailsUnknownNoDate
        );

        const pinnedOrdination = detailsUnknownOrdinations.length ? detailsUnknownOrdinations[0] : null;
        const pinnedConsecration = detailsUnknownConsecrations.length ? detailsUnknownConsecrations[0] : null;

        const withSortKey = (order) => {
            order.sortKey = getOrderSortKey(order.dateInfo, order.type);
            return order;
        };

        // Baseline date/type ordering for all records.
        const baselineSorted = list.map(withSortKey).slice().sort((a, b) => {
            if (a.sortKey.t !== b.sortKey.t) {
                return a.sortKey.t - b.sortKey.t;
            }
            return a.sortKey.typeOrder - b.sortKey.typeOrder;
        });

        const removeByOriginalIndex = (items, target) => {
            if (!target) {
                return items;
            }
            return items.filter(o => o.originalIndex !== target.originalIndex);
        };

        // Start from the baseline ordering, then pull out any pinned records.
        let tail = baselineSorted;
        if (pinnedOrdination) {
            tail = removeByOriginalIndex(tail, pinnedOrdination);
        }
        if (pinnedConsecration) {
            tail = removeByOriginalIndex(tail, pinnedConsecration);
        }

        const result = [];

        if (hasAnyOrdination) {
            // First record: the details-unknown ordination if present, otherwise the earliest ordination.
            let firstOrdination = pinnedOrdination;
            if (!firstOrdination) {
                firstOrdination = baselineSorted.find(o => o.type === 'ordination') || null;
            }
            if (firstOrdination) {
                result.push(firstOrdination);
                tail = removeByOriginalIndex(tail, firstOrdination);
            }

            // Second record: the details-unknown consecration when present.
            if (pinnedConsecration) {
                result.push(pinnedConsecration);
            }
        } else {
            // No ordinations at all: details-unknown consecration (if any) becomes the first record.
            if (pinnedConsecration) {
                result.push(pinnedConsecration);
            }
        }

        // Append the rest of the baseline ordering unchanged.
        result.push(...tail);

        // Strip internal fields and ensure sortKey is present for downstream callers.
        return result.map(o => ({
            type: o.type,
            record: o.record,
            dateInfo: o.dateInfo,
            sortKey: getOrderSortKey(o.dateInfo, o.type)
        }));
    }

    /**
     * Internal: build date-ordered orders array from a clergy record.
     * Applies canonical details-unknown ordering via buildOrderedOrders.
     *
     * @param {object} clergy
     * @returns {Array<{ type: 'ordination'|'consecration', record: object, dateInfo: object, sortKey: object }>}
     */
    function buildOrdersFromClergy(clergy) {
        if (!clergy) {
            return [];
        }
        const unsorted = [];
        toArray(clergy.ordinations || []).forEach(record => {
            const dateInfo = getDateFromRecord(record);
            unsorted.push({
                type: 'ordination',
                record,
                dateInfo
            });
        });
        toArray(clergy.consecrations || []).forEach(record => {
            const dateInfo = getDateFromRecord(record);
            unsorted.push({
                type: 'consecration',
                record,
                dateInfo
            });
        });

        return buildOrderedOrders(unsorted);
    }

    /**
     * Internal: build raw ranges (without validity) from date-ordered orders.
     * N orders -> N+1 ranges.
     *
     * @param {Array<{ dateInfo: object }>} orders
     * @returns {Array<{ index: number, start: string|null, end: string|null }>}
     */
    function buildRangesFromOrders(orders) {
        const list = toArray(orders || []);
        const ranges = [];
        if (list.length === 0) {
            ranges.push({ index: 0, start: null, end: null });
            return ranges;
        }

        const boundary = (order) => {
            const dateInfo = order.dateInfo || getDateFromRecord(order.record);
            if (dateInfo.detailsUnknownNoDate) {
                return null;
            }
            if (dateInfo.dateUnknown) {
                return dateInfo.year != null ? String(dateInfo.year) : 'unknown';
            }
            return dateInfo.date;
        };

        ranges.push({
            index: 0,
            start: null,
            end: boundary(list[0])
        });
        for (let i = 0; i < list.length - 1; i++) {
            ranges.push({
                index: i + 1,
                start: boundary(list[i]),
                end: boundary(list[i + 1])
            });
        }
        ranges.push({
            index: list.length,
            start: boundary(list[list.length - 1]),
            end: null
        });
        return ranges;
    }

    /**
     * Compute validity per range from records (Table B). Prefer ValidityRules implementation when available.
     *
     * @param {Array<{ type: 'ordination'|'consecration', record: object }>} orders
     * @returns {Array<{ index: number, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }>}
     */
    function computeValidityPerRangeFromRecords(orders) {
        const orderList = toArray(orders || []);

        if (ValidityRules && typeof ValidityRules.computeValidityPerRangeFromRecords === 'function') {
            return ValidityRules.computeValidityPerRangeFromRecords(orderList);
        }

        if (ValidityRules && typeof ValidityRules.canGiveOrdersValidlyInRange === 'function') {
            const result = [];
            for (let rangeIndex = 0; rangeIndex <= orderList.length; rangeIndex++) {
                const v = ValidityRules.canGiveOrdersValidlyInRange(orderList, rangeIndex);
                result.push({
                    index: rangeIndex,
                    canValidlyOrdain: v.canValidlyOrdain,
                    canValidlyConsecrate: v.canValidlyConsecrate
                });
            }
            return result;
        }

        // Fallback: treat all ranges as invalid if ValidityRules is unavailable.
        const fallback = [];
        for (let rangeIndex = 0; rangeIndex <= orderList.length; rangeIndex++) {
            fallback.push({
                index: rangeIndex,
                canValidlyOrdain: false,
                canValidlyConsecrate: false
            });
        }
        return fallback;
    }

    /**
     * Build ranges with validity for a clergy ID from clergy-list data (no DOM).
     *
     * @param {number} clergyId
     * @param {Map<number, object>} clergyById
     * @returns {{ orders: Array<{ type: string, record: object, dateInfo: object }>, ranges: Array<{ index: number, start: string|null, end: string|null, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }> }}
     */
    function buildRangesWithValidityFromClergy(clergyId, clergyById) {
        const clergy = clergyById && typeof clergyById.get === 'function' ? clergyById.get(clergyId) : null;
        const defaultRanges = [{ index: 0, start: null, end: null, canValidlyOrdain: false, canValidlyConsecrate: false }];
        if (!clergy) {
            return { orders: [], ranges: defaultRanges };
        }

        const orders = buildOrdersFromClergy(clergy);
        if (orders.length === 0) {
            return { orders: [], ranges: defaultRanges };
        }

        const ranges = buildRangesFromOrders(orders);
        const ordersForValidity = orders.map(o => ({ type: o.type, record: o.record }));
        const validityPerRange = computeValidityPerRangeFromRecords(ordersForValidity);
        const validityByIndex = new Map(validityPerRange.map(v => [v.index, v]));
        const enrichedRanges = ranges.map(r => ({
            ...r,
            canValidlyOrdain: validityByIndex.get(r.index)?.canValidlyOrdain ?? false,
            canValidlyConsecrate: validityByIndex.get(r.index)?.canValidlyConsecrate ?? false
        }));

        return { orders, ranges: enrichedRanges };
    }

    /**
     * Generic entry point: build ranges with validity from clergy-list data.
     *
     * @param {{ clergyId?: number, clergyById?: Map<number, object>, orders?: Array<{ type: 'ordination'|'consecration', record: object, dateInfo?: object }> }} source
     * @returns {{ orders: Array, ranges: Array<{ index: number, start: string|null, end: string|null, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }> }}
     */
    function buildRangesWithValidity(source) {
        const clergyId = source && source.clergyId;
        const clergyById = source && source.clergyById;
        const explicitOrders = source && source.orders;

        if (explicitOrders && explicitOrders.length) {
            const orders = buildOrderedOrders(explicitOrders);
            if (orders.length === 0) {
                return { orders: [], ranges: [{ index: 0, start: null, end: null, canValidlyOrdain: false, canValidlyConsecrate: false }] };
            }

            const ranges = buildRangesFromOrders(orders);
            const ordersForValidity = orders.map(o => ({ type: o.type, record: o.record }));
            const validityPerRange = computeValidityPerRangeFromRecords(ordersForValidity);
            const validityByIndex = new Map(validityPerRange.map(v => [v.index, v]));
            const enrichedRanges = ranges.map(r => ({
                ...r,
                canValidlyOrdain: validityByIndex.get(r.index)?.canValidlyOrdain ?? false,
                canValidlyConsecrate: validityByIndex.get(r.index)?.canValidlyConsecrate ?? false
            }));

            return { orders, ranges: enrichedRanges };
        }

        if (clergyId != null && clergyById) {
            return buildRangesWithValidityFromClergy(clergyId, clergyById);
        }

        return {
            orders: [],
            ranges: [{ index: 0, start: null, end: null, canValidlyOrdain: false, canValidlyConsecrate: false }]
        };
    }

    const api = {
        getDateFromRecord,
        getEventDateSortValue,
        getBoundarySortValue,
        placeEventInRange,
        buildRangesWithValidityFromClergy,
        buildRangesWithValidity
    };

    if (typeof window !== 'undefined') {
        window.EditorRangesValidity = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();

