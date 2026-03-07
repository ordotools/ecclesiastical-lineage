/**
 * Validity rules (single source of truth).
 * Canonical spec: docs/VALIDITY_RULES.md. Tables A–C, rules 1–8.
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

    // --- Table C: Presumed validity when bishop is invalid (rules 6, 8) ---
    /**
     * Allowed effective statuses for orders given by a bishop with this worst status (Table C, rules 6, 8).
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
     * Used when applying Table C (rules 6, 8) for dropdown restriction and presumed validity.
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
     * Rule 7: all options only if bishop has valid ordination and valid consecration; else Table C.
     * @param {{ has_valid_ordination: boolean, has_valid_consecration?: boolean, worst_ordination_status: string, worst_consecration_status: string }} bishopSummary
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
     * Rule 7: all options only if bishop has valid ordination and valid consecration; else Table C.
     * @param {{ has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string }} bishopSummary
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
     * Validity dropdown values allowed given allowed effective statuses (Table A dropdown column).
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

    // --- Table B: Can give orders validly in a range (rules 1, 1a, 1b, 2, 5) ---
    /**
     * For a date-ordered list of orders, whether the clergy can validly ordain and validly consecrate
     * in the range ending at rangeIndex (i.e. using only orders strictly before rangeIndex).
     * Requires at least one prior valid ordination and one prior valid consecration (ordination before consecration in time).
     *
     * @param {Array<{ type: 'ordination'|'consecration', record: object }>} orders - Date-ordered
     * @param {number} rangeIndex - Range index 0..orders.length (prior = indices < rangeIndex)
     * @returns {{ canValidlyOrdain: boolean, canValidlyConsecrate: boolean }}
     */
    function canGiveOrdersValidlyInRange(orders, rangeIndex) {
        const orderList = Array.isArray(orders) ? orders : [];
        let hasValidOrdination = false;
        let hasValidConsecration = false;

        for (let i = 0; i < rangeIndex && i < orderList.length; i++) {
            const order = orderList[i];
            if (!order || !order.record) {
                continue;
            }
            const effective = getEffectiveStatus(order.record);
            const valid = isValidForGivingOrders(effective);

            if (order.type === 'ordination' && valid) {
                hasValidOrdination = true;
            }
            if (order.type === 'consecration' && valid) {
                hasValidConsecration = true;
            }
        }

        const can = hasValidOrdination && hasValidConsecration;
        return {
            canValidlyOrdain: can,
            canValidlyConsecrate: can
        };
    }

    /**
     * Compute validity per range for date-ordered orders (Table B). One entry per range index 0..orders.length.
     *
     * @param {Array<{ type: 'ordination'|'consecration', record: object }>} orders
     * @returns {Array<{ index: number, canValidlyOrdain: boolean, canValidlyConsecrate: boolean }>}
     */
    function computeValidityPerRangeFromRecords(orders) {
        const orderList = Array.isArray(orders) ? orders : [];
        const result = [];
        for (let rangeIndex = 0; rangeIndex <= orderList.length; rangeIndex++) {
            const v = canGiveOrdersValidlyInRange(orderList, rangeIndex);
            result.push({
                index: rangeIndex,
                canValidlyOrdain: v.canValidlyOrdain,
                canValidlyConsecrate: v.canValidlyConsecrate
            });
        }
        return result;
    }

    const api = {
        STATUS_PRIORITY,
        ALL_EFFECTIVE_STATUSES,
        VALIDITY_VALUES,
        EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS,
        getEffectiveStatus,
        isValidForGivingOrders,
        getWorstStatus,
        getStatusLabel,
        getBishopWorstStatus,
        mapWorstStatusToAllowedEffective,
        getAllowedEffectiveOrdinationStatuses,
        getAllowedEffectiveConsecrationStatuses,
        getAllowedValidityValues,
        canGiveOrdersValidlyInRange,
        computeValidityPerRangeFromRecords
    };

    if (typeof window !== 'undefined') {
        window.ValidityRules = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
