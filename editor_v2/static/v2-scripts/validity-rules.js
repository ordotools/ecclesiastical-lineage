/**
 * Editor v2 validity rules (Tables A–C, rules 1–8).
 * Spec: docs/VALIDITY_RULES.md. No dependency on static/js/ or previous editor scripts.
 */
(() => {
    'use strict';

    // --- Table A: Effective status (priority worse = higher) ---
    const STATUS_PRIORITY = {
        invalid: 4,
        doubtfully_valid: 3,
        doubtful_event: 2,
        sub_conditione: 1,
        valid: 0
    };

    const ALL_EFFECTIVE_STATUSES = [
        'valid',
        'sub_conditione',
        'doubtfully_valid',
        'doubtful_event',
        'invalid'
    ];

    /** Validity dropdown values (UI) */
    const VALIDITY_VALUES = ['valid', 'doubtfully_valid', 'invalid'];

    /** Effective statuses that count as "valid" for giving orders (rules 1–5, 7) */
    const EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS = ['valid', 'sub_conditione'];

    /**
     * Effective status from a record (DB/UI fields).
     * @param {object} record - { validity?, is_invalid?, is_doubtfully_valid?, is_sub_conditione?, is_doubtful_event? }
     * @returns {string} One of ALL_EFFECTIVE_STATUSES
     */
    function getEffectiveStatus(record) {
        if (!record) {
            return 'valid';
        }
        const validity = record.validity
            || (record.is_invalid ? 'invalid' : (record.is_doubtfully_valid ? 'doubtfully_valid' : 'valid'));
        const isSubConditione = !!record.is_sub_conditione;
        const isDoubtfulEvent = !!record.is_doubtful_event;

        if (validity === 'invalid') {
            return 'invalid';
        }
        if (validity === 'doubtfully_valid') {
            return 'doubtfully_valid';
        }
        if (isDoubtfulEvent) {
            return 'doubtful_event';
        }
        if (isSubConditione) {
            return 'sub_conditione';
        }
        return 'valid';
    }

    /**
     * True if this effective status counts as "valid" for giving orders (rules 1–5, 7).
     * @param {string} effective - One of ALL_EFFECTIVE_STATUSES
     * @returns {boolean}
     */
    function isValidForGivingOrders(effective) {
        return EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS.includes(effective);
    }

    /**
     * Worst (lowest validity) among statuses by Table A priority.
     * @param {string[]} statuses - Effective statuses
     * @returns {string} One of ALL_EFFECTIVE_STATUSES
     */
    function getWorstStatus(statuses) {
        if (!statuses || statuses.length === 0) {
            return 'invalid';
        }
        return statuses.reduce((worst, current) => {
            if (!worst) {
                return current;
            }
            return STATUS_PRIORITY[current] > STATUS_PRIORITY[worst] ? current : worst;
        }, null);
    }

    /**
     * Human-readable label for an effective status.
     * @param {string} status
     * @returns {string}
     */
    function getStatusLabel(status) {
        switch (status) {
            case 'invalid': return 'Invalid';
            case 'doubtfully_valid': return 'Doubtfully valid';
            case 'doubtful_event': return 'Doubtful event';
            case 'sub_conditione': return 'Sub conditione';
            case 'valid': return 'Valid';
            default: return status || 'Valid';
        }
    }

    // --- Table B: Can give orders validly in a range (rules 1, 1a, 1b, 2, 5) ---
    // Input: date-ordered list of { type: 'ordination'|'consecration', record }.
    // "Prior" = indices < rangeIndex. Require at least one prior valid ordination and one prior
    // valid consecration, with ordination before consecration in time.

    /**
     * Whether clergy can give orders validly at the given range index (rules 1, 1a, 1b, 2, 5).
     * Prior = orders with index < rangeIndex. Requires at least one prior valid ordination and
     * one prior valid consecration, with the first valid ordination before the first valid
     * consecration in time (implicit in date-ordered list).
     * @param {{ type: string, record: object }[]} orders - Date-ordered ordination/consecration entries
     * @param {number} rangeIndex - Range index (0 = before first event; orders.length = after last)
     * @returns {{ canValidlyOrdain: boolean, canValidlyConsecrate: boolean }}
     */
    function canGiveOrdersValidlyInRange(orders, rangeIndex) {
        if (!orders || rangeIndex <= 0) {
            return { canValidlyOrdain: false, canValidlyConsecrate: false };
        }
        const prior = orders.slice(0, rangeIndex);
        let firstValidOrdinationIndex = -1;
        let firstValidConsecrationIndex = -1;
        for (let i = 0; i < prior.length; i++) {
            const entry = prior[i];
            const effective = getEffectiveStatus(entry.record);
            if (entry.type === 'ordination' && isValidForGivingOrders(effective)) {
                if (firstValidOrdinationIndex === -1) {
                    firstValidOrdinationIndex = i;
                }
            } else if (entry.type === 'consecration' && isValidForGivingOrders(effective)) {
                if (firstValidConsecrationIndex === -1) {
                    firstValidConsecrationIndex = i;
                }
            }
        }
        const can = firstValidOrdinationIndex !== -1
            && firstValidConsecrationIndex !== -1
            && firstValidOrdinationIndex < firstValidConsecrationIndex;
        return { canValidlyOrdain: can, canValidlyConsecrate: can };
    }

    /**
     * Computes whether clergy can give orders validly at each range index (0..orders.length).
     * @param {{ type: string, record: object }[]} orders - Date-ordered ordination/consecration entries
     * @returns {Array<{ index: number, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }>}
     */
    function computeValidityPerRangeFromRecords(orders) {
        if (!orders) {
            return [];
        }
        const result = [];
        for (let i = 0; i <= orders.length; i++) {
            const v = canGiveOrdersValidlyInRange(orders, i);
            result.push({
                index: i,
                canValidlyOrdain: v.canValidlyOrdain,
                canValidlyConsecrate: v.canValidlyConsecrate
            });
        }
        return result;
    }

    // --- Ranges helpers (from editor-ranges-validity.js) ---

    function toArray(value) {
        if (!value) {
            return [];
        }
        return Array.isArray(value) ? value : Array.from(value);
    }

    /**
     * Get date info from a clergy-list ordination/consecration record (date, date_unknown, year).
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
        const y = record.year != null ? parseInt(record.year, 10) : NaN;
        const yearNum = Number.isFinite(y) ? y : null;
        if (isUnknown) {
            return {
                date: null,
                year: yearNum,
                dateUnknown: true
            };
        }
        if (yearNum != null) {
            return { date: null, year: yearNum, dateUnknown: true };
        }
        return { date: null, year: null, dateUnknown: true };
    }

    /**
     * Sortable value for an event date for range comparison. Unknown dates map to Infinity.
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
     * Sortable value for a range boundary (start or end).
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
     * Place a descendant event (by date) into a bishop's timeline; return the range index and line type.
     * @param {object} record Ordination or consecration record (with date, date_unknown, year)
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
     * Sort key for ordering bishop orders by date. Unknown dates (no year) sort first; same date uses type order.
     * @param {{ date: string|null, year: number|null, dateUnknown: boolean }} dateInfo
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
            return { t: -Infinity, typeOrder };
        }
        const t = new Date(dateInfo.date).getTime();
        return { t: Number.isFinite(t) ? t : Infinity, typeOrder };
    }

    /**
     * Build date-ordered orders array from a clergy record.
     * @param {object} clergy
     * @returns {Array<{ type: 'ordination'|'consecration', record: object, dateInfo: object, sortKey: object }>}
     */
    function buildOrdersFromClergy(clergy) {
        const orders = [];
        if (!clergy) {
            return orders;
        }
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
            /* typeOrder: ordination 0, consecration 1 — same-t events sort ordination before consecration */
            return a.sortKey.typeOrder - b.sortKey.typeOrder;
        });
        return orders;
    }

    /**
     * Build raw ranges (without validity) from date-ordered orders. N orders -> N+1 ranges.
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
            if (order.dateInfo.dateUnknown) {
                return order.dateInfo.year != null ? String(order.dateInfo.year) : 'unknown';
            }
            return order.dateInfo.date;
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
     * Build ranges with validity for a clergy ID from clergy-list data (no DOM).
     * Uses local Table B computeValidityPerRangeFromRecords.
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
     * Uses local Table B computeValidityPerRangeFromRecords.
     * @param {{ clergyId?: number, clergyById?: Map<number, object>, orders?: Array<{ type: 'ordination'|'consecration', record: object, dateInfo?: object }> }} source
     * @returns {{ orders: Array, ranges: Array<{ index: number, start: string|null, end: string|null, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }> }}
     */
    function buildRangesWithValidity(source) {
        const clergyId = source && source.clergyId;
        const clergyById = source && source.clergyById;
        const explicitOrders = source && source.orders;

        if (explicitOrders && explicitOrders.length) {
            const orders = explicitOrders.map(o => {
                const dateInfo = o.dateInfo || getDateFromRecord(o.record);
                return {
                    type: o.type,
                    record: o.record,
                    dateInfo,
                    sortKey: getOrderSortKey(dateInfo, o.type)
                };
            }).sort((a, b) => {
                if (a.sortKey.t !== b.sortKey.t) {
                    return a.sortKey.t - b.sortKey.t;
                }
                /* typeOrder: ordination 0, consecration 1 — same-t events sort ordination before consecration */
                return a.sortKey.typeOrder - b.sortKey.typeOrder;
            });

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

    // --- Table C: Presumed validity when bishop is invalid (rules 6, 8) ---
    /**
     * Allowed effective statuses for orders given by a bishop with this worst status (Table C).
     * invalid → [invalid]; doubtfully_valid / doubtful_event → [doubtfully_valid]; valid / sub_conditione → all.
     * @param {string} worstStatus - Bishop's worst effective status
     * @returns {string[]} Subset of ALL_EFFECTIVE_STATUSES
     */
    function mapWorstStatusToAllowedEffective(worstStatus) {
        switch (worstStatus) {
            case 'invalid':
                return ['invalid'];
            case 'doubtfully_valid':
                return ['doubtfully_valid'];
            case 'doubtful_event':
                return ['doubtfully_valid'];
            default:
                return ALL_EFFECTIVE_STATUSES.slice();
        }
    }

    /**
     * Bishop's overall worst effective status (worst of ordination and consecration).
     * @param {{ worst_ordination_status?: string, worst_consecration_status?: string }} bishopSummary
     * @returns {string}
     */
    function getBishopWorstStatus(bishopSummary) {
        if (!bishopSummary) {
            return 'valid';
        }
        const ord = bishopSummary.worst_ordination_status || 'valid';
        const cons = bishopSummary.worst_consecration_status || 'valid';
        return getWorstStatus([ord, cons]);
    }

    /**
     * Allowed effective statuses for an ordination performed by this bishop (rules 6–8).
     * All if bishop has valid ordination and valid consecration; else Table C.
     * @param {{ has_valid_ordination?: boolean, has_valid_consecration?: boolean, worst_ordination_status?: string, worst_consecration_status?: string }} bishopSummary
     * @returns {string[]}
     */
    function getAllowedEffectiveOrdinationStatuses(bishopSummary) {
        if (!bishopSummary) {
            return ALL_EFFECTIVE_STATUSES.slice();
        }
        if (bishopSummary.has_valid_ordination && bishopSummary.has_valid_consecration) {
            return ALL_EFFECTIVE_STATUSES.slice();
        }
        return mapWorstStatusToAllowedEffective(getBishopWorstStatus(bishopSummary));
    }

    /**
     * Allowed effective statuses for a consecration performed by this bishop (rules 6–8).
     * All if bishop has valid ordination and valid consecration; else Table C.
     * @param {{ has_valid_ordination?: boolean, has_valid_consecration?: boolean, worst_ordination_status?: string, worst_consecration_status?: string }} bishopSummary
     * @returns {string[]}
     */
    function getAllowedEffectiveConsecrationStatuses(bishopSummary) {
        if (!bishopSummary) {
            return ALL_EFFECTIVE_STATUSES.slice();
        }
        if (bishopSummary.has_valid_ordination && bishopSummary.has_valid_consecration) {
            return ALL_EFFECTIVE_STATUSES.slice();
        }
        return mapWorstStatusToAllowedEffective(getBishopWorstStatus(bishopSummary));
    }

    /**
     * Validity dropdown values allowed given allowed effective statuses (Table A dropdown).
     * Maps: invalid→invalid, doubtfully_valid→doubtfully_valid, valid/sub_conditione/doubtful_event→valid.
     * @param {string[]} allowedEffectiveStatuses
     * @returns {string[]} Subset of VALIDITY_VALUES
     */
    function getAllowedValidityValues(allowedEffectiveStatuses) {
        const allowed = new Set();
        (allowedEffectiveStatuses || []).forEach(status => {
            if (status === 'invalid') {
                allowed.add('invalid');
            } else if (status === 'doubtfully_valid') {
                allowed.add('doubtfully_valid');
            } else if (status === 'valid' || status === 'sub_conditione' || status === 'doubtful_event') {
                allowed.add('valid');
            }
        });
        return VALIDITY_VALUES.filter(value => allowed.has(value));
    }

    const EditorV2Validity = {
        STATUS_PRIORITY,
        ALL_EFFECTIVE_STATUSES,
        VALIDITY_VALUES,
        EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS,
        getEffectiveStatus,
        isValidForGivingOrders,
        getWorstStatus,
        getStatusLabel,
        canGiveOrdersValidlyInRange,
        computeValidityPerRangeFromRecords,
        mapWorstStatusToAllowedEffective,
        getBishopWorstStatus,
        getAllowedEffectiveOrdinationStatuses,
        getAllowedEffectiveConsecrationStatuses,
        getAllowedValidityValues
    };

    const EditorRangesValidity = {
        getDateFromRecord,
        getEventDateSortValue,
        getBoundarySortValue,
        placeEventInRange,
        buildRangesWithValidityFromClergy,
        buildRangesWithValidity
    };

    if (typeof window !== 'undefined') {
        window.EditorV2Validity = EditorV2Validity;
        window.EditorRangesValidity = EditorRangesValidity;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EditorV2Validity;
    }
})();
