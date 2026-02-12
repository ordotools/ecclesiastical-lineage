(() => {
    'use strict';

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

    const VALIDITY_VALUES = ['valid', 'doubtfully_valid', 'invalid'];
    const bishopSummaryCache = new Map();

    function normalizeSummary(summary) {
        if (!summary) {
            return null;
        }
        return {
            has_valid_ordination: !!summary.has_valid_ordination,
            has_valid_consecration: !!summary.has_valid_consecration,
            worst_ordination_status: summary.worst_ordination_status || 'invalid',
            worst_consecration_status: summary.worst_consecration_status || 'invalid'
        };
    }

    function defaultSummary() {
        return {
            has_valid_ordination: false,
            has_valid_consecration: false,
            worst_ordination_status: 'invalid',
            worst_consecration_status: 'invalid'
        };
    }

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

    function getAllowedEffectiveOrdinationStatuses(bishopSummary) {
        if (!bishopSummary) {
            return ALL_EFFECTIVE_STATUSES.slice();
        }
        if (bishopSummary.has_valid_ordination) {
            return ALL_EFFECTIVE_STATUSES.slice();
        }
        return mapWorstStatusToAllowedEffective(bishopSummary.worst_ordination_status);
    }

    function getAllowedEffectiveConsecrationStatuses(bishopSummary) {
        if (!bishopSummary) {
            return ALL_EFFECTIVE_STATUSES.slice();
        }
        if (bishopSummary.has_valid_ordination && bishopSummary.has_valid_consecration) {
            return ALL_EFFECTIVE_STATUSES.slice();
        }
        return mapWorstStatusToAllowedEffective(bishopSummary.worst_consecration_status);
    }

    function getAllowedValidityValues(allowedEffectiveStatuses) {
        const allowed = new Set();
        allowedEffectiveStatuses.forEach(status => {
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

    function isOrdinationStatusAllowed(ordinationRecord, bishopSummary) {
        if (!bishopSummary) {
            return true;
        }
        const allowed = getAllowedEffectiveOrdinationStatuses(bishopSummary);
        const effective = getEffectiveStatus(ordinationRecord);
        return allowed.includes(effective);
    }

    function isConsecrationStatusAllowed(consecrationRecord, bishopSummary) {
        if (!bishopSummary) {
            return true;
        }
        const allowed = getAllowedEffectiveConsecrationStatuses(bishopSummary);
        const effective = getEffectiveStatus(consecrationRecord);
        return allowed.includes(effective);
    }

    function clearValidityRestrictions(select) {
        if (!select) {
            return;
        }
        Array.from(select.options).forEach(option => {
            option.disabled = false;
        });
    }

    function setEntryNotice(entryElement, message) {
        if (!entryElement) {
            return;
        }
        let note = entryElement.querySelector('.inheritance-note');
        if (!message) {
            if (note) {
                note.remove();
            }
            return;
        }
        if (!note) {
            note = document.createElement('div');
            note.className = 'inheritance-note';
            note.style.cssText = 'margin-top: 0.35em; font-size: 0.75em; color: rgba(243, 156, 18, 0.9);';
            entryElement.appendChild(note);
        }
        note.textContent = message;
    }

    function applyValidityRestrictions(entryElement, bishopSummary, type) {
        if (!entryElement) {
            return;
        }
        const select = entryElement.querySelector('select[name*="[validity]"]');
        if (!select) {
            return;
        }
        if (!bishopSummary) {
            clearValidityRestrictions(select);
            setEntryNotice(entryElement, '');
            return;
        }

        const allowedEffective = type === 'consecration'
            ? getAllowedEffectiveConsecrationStatuses(bishopSummary)
            : getAllowedEffectiveOrdinationStatuses(bishopSummary);
        const allowedValidity = getAllowedValidityValues(allowedEffective);

        Array.from(select.options).forEach(option => {
            option.disabled = !allowedValidity.includes(option.value);
        });

        if (!allowedValidity.includes(select.value)) {
            select.value = allowedValidity[0] || 'valid';
            setEntryNotice(entryElement, 'Validity adjusted to match bishop status.');
        } else {
            setEntryNotice(entryElement, '');
        }
    }

    function getEntryRecord(entryElement) {
        const validitySelect = entryElement.querySelector('select[name*="[validity]"]');
        const subConditioneInput = entryElement.querySelector('input[name*="[is_sub_conditione]"]');
        const doubtfulEventInput = entryElement.querySelector('input[name*="[is_doubtful_event]"]');
        const validity = validitySelect ? validitySelect.value : 'valid';
        return {
            validity: validity,
            is_sub_conditione: !!(subConditioneInput && subConditioneInput.checked),
            is_doubtful_event: !!(doubtfulEventInput && doubtfulEventInput.checked),
            is_invalid: validity === 'invalid',
            is_doubtfully_valid: validity === 'doubtfully_valid'
        };
    }

    function getEntryBishopId(entryElement, type) {
        const selector = type === 'consecration'
            ? 'input[name*="[consecrator_id]"]'
            : 'input[name*="[ordaining_bishop_id]"]';
        const input = entryElement.querySelector(selector);
        if (!input || !input.value) {
            return null;
        }
        const parsed = parseInt(input.value, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    function getEntryBishopName(entryElement, type) {
        const selector = type === 'consecration'
            ? 'input[name*="[consecrator_input]"]'
            : 'input[name*="[ordaining_bishop_input]"]';
        const input = entryElement.querySelector(selector);
        return input && input.value ? input.value.trim() : '';
    }

    function fetchBishopSummary(bishopId) {
        if (!bishopId) {
            return Promise.resolve(null);
        }
        const key = String(bishopId);
        if (bishopSummaryCache.has(key)) {
            return Promise.resolve(bishopSummaryCache.get(key));
        }
        return fetch(`/api/bishop-validity/${bishopId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load bishop validity: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const summary = normalizeSummary(data);
                bishopSummaryCache.set(key, summary);
                return summary;
            });
    }

    function applyRestrictionsForEntry(entryElement, type, bishopId) {
        if (!bishopId) {
            const select = entryElement.querySelector('select[name*="[validity]"]');
            clearValidityRestrictions(select);
            setEntryNotice(entryElement, '');
            return Promise.resolve();
        }
        return fetchBishopSummary(bishopId)
            .then(summary => {
                applyValidityRestrictions(entryElement, summary, type);
            })
            .catch(error => {
                console.error('Status inheritance: bishop validity fetch failed', error);
            });
    }

    function refreshFormRestrictions(root) {
        const scope = root || document;
        const ordinationEntries = scope.querySelectorAll('.ordination-entry');
        const consecrationEntries = scope.querySelectorAll('.consecration-entry');

        ordinationEntries.forEach(entry => {
            const bishopId = getEntryBishopId(entry, 'ordination');
            applyRestrictionsForEntry(entry, 'ordination', bishopId);
        });
        consecrationEntries.forEach(entry => {
            const bishopId = getEntryBishopId(entry, 'consecration');
            applyRestrictionsForEntry(entry, 'consecration', bishopId);
        });
    }

    function flagClergyListWithViolations(clergyListData, bishopValidityMap, skipBishopIds) {
        if (!Array.isArray(clergyListData)) {
            return;
        }
        const map = bishopValidityMap || {};
        const skipSet = new Set((skipBishopIds || []).map(id => Number(id)));
        clergyListData.forEach(clergy => {
            const clergyElement = document.querySelector(`[data-clergy-id="${clergy.id}"]`);
            if (!clergyElement) {
                return;
            }
            let hasViolation = false;
            (clergy.ordinations || []).forEach(ordination => {
                if (hasViolation) {
                    return;
                }
                const bishopId = ordination.ordaining_bishop_id;
                if (!bishopId || skipSet.has(bishopId)) {
                    return;
                }
                const summary = normalizeSummary(map[String(bishopId)] || map[bishopId]) || defaultSummary();
                if (!isOrdinationStatusAllowed(ordination, summary)) {
                    hasViolation = true;
                }
            });
            (clergy.consecrations || []).forEach(consecration => {
                if (hasViolation) {
                    return;
                }
                const bishopId = consecration.consecrator_id;
                if (!bishopId || skipSet.has(bishopId)) {
                    return;
                }
                const summary = normalizeSummary(map[String(bishopId)] || map[bishopId]) || defaultSummary();
                if (!isConsecrationStatusAllowed(consecration, summary)) {
                    hasViolation = true;
                }
            });

            const statusContainer = clergyElement.querySelector('.clergy-item-status') || clergyElement;
            let icon = clergyElement.querySelector('.inheritance-violation-icon');
            if (hasViolation) {
                clergyElement.setAttribute('data-inheritance-violation', 'true');
                if (!icon) {
                    icon = document.createElement('span');
                    icon.className = 'inheritance-violation-icon';
                    icon.style.cssText = 'margin-left: 0.35em; color: rgba(243, 156, 18, 0.9); font-size: 0.75em;';
                    icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                    icon.title = 'Status inheritance rules not met';
                    statusContainer.appendChild(icon);
                }
            } else {
                clergyElement.removeAttribute('data-inheritance-violation');
                if (icon) {
                    icon.remove();
                }
            }
        });
    }

    function handleBishopInputChange(target) {
        if (!target || !target.name) {
            return;
        }
        if (target.name.includes('[ordaining_bishop_id]')) {
            const entry = target.closest('.ordination-entry');
            if (entry) {
                const bishopId = parseInt(target.value, 10);
                applyRestrictionsForEntry(entry, 'ordination', Number.isNaN(bishopId) ? null : bishopId);
            }
        }
        if (target.name.includes('[consecrator_id]')) {
            const entry = target.closest('.consecration-entry');
            if (entry) {
                const bishopId = parseInt(target.value, 10);
                applyRestrictionsForEntry(entry, 'consecration', Number.isNaN(bishopId) ? null : bishopId);
            }
        }
    }

    function validateFormStatus(form, options) {
        const container = form || document;
        const skipBishopIds = new Set((options?.skipBishopIds || []).map(id => Number(id)));
        const entries = [];
        const ordinationEntries = container.querySelectorAll('.ordination-entry');
        const consecrationEntries = container.querySelectorAll('.consecration-entry');

        ordinationEntries.forEach(entry => {
            const bishopId = getEntryBishopId(entry, 'ordination');
            if (!bishopId || skipBishopIds.has(bishopId)) {
                return;
            }
            entries.push({
                type: 'ordination',
                bishopId,
                bishopName: getEntryBishopName(entry, 'ordination'),
                record: getEntryRecord(entry)
            });
        });
        consecrationEntries.forEach(entry => {
            const bishopId = getEntryBishopId(entry, 'consecration');
            if (!bishopId || skipBishopIds.has(bishopId)) {
                return;
            }
            entries.push({
                type: 'consecration',
                bishopId,
                bishopName: getEntryBishopName(entry, 'consecration'),
                record: getEntryRecord(entry)
            });
        });

        if (entries.length === 0) {
            return Promise.resolve({ valid: true, violations: [] });
        }

        const uniqueBishopIds = Array.from(new Set(entries.map(entry => entry.bishopId)));
        return Promise.all(uniqueBishopIds.map(id => fetchBishopSummary(id).then(summary => [id, summary])))
            .then(results => {
                const summaryMap = new Map(results);
                const violations = [];
                entries.forEach(entry => {
                    const summary = summaryMap.get(entry.bishopId);
                    const isAllowed = entry.type === 'ordination'
                        ? isOrdinationStatusAllowed(entry.record, summary)
                        : isConsecrationStatusAllowed(entry.record, summary);
                    if (!isAllowed) {
                        violations.push(entry);
                    }
                });
                if (violations.length > 0) {
                    const first = violations[0];
                    const typeLabel = first.type === 'ordination' ? 'ordination' : 'consecration';
                    const bishopLabel = first.bishopName ? ` from ${first.bishopName}` : '';
                    return {
                        valid: false,
                        violations,
                        message: `Status inheritance rules not met for ${typeLabel}${bishopLabel}.`
                    };
                }
                return { valid: true, violations: [] };
            });
    }

    function handleNewEntry(entryElement, type) {
        const bishopId = getEntryBishopId(entryElement, type);
        applyRestrictionsForEntry(entryElement, type, bishopId);
    }

    document.addEventListener('change', event => {
        handleBishopInputChange(event.target);
    });

    document.addEventListener('DOMContentLoaded', () => {
        refreshFormRestrictions();
    });

    document.body.addEventListener('htmx:afterSwap', event => {
        const target = (event.detail && event.detail.target) || event.target;
        if (!target) {
            return;
        }
        const containsForm = target.querySelector && target.querySelector('#clergyForm');
        if (containsForm || target.id === 'clergyForm') {
            setTimeout(() => refreshFormRestrictions(target), 150);
        }
        const containsClergyList = target.querySelector && (target.querySelector('.clergy-list-section') || target.querySelector('#clergyListContainer'));
        if (containsClergyList || target.classList?.contains('clergy-list-section')) {
            const skipIds = window._lastNewlyCreatedBishopIds || [];
            let clergyListData = window.clergyListData;
            if (!clergyListData || !Array.isArray(clergyListData)) {
                const jsonEl = target.querySelector && target.querySelector('#clergy-list-data-json');
                if (jsonEl) {
                    try {
                        clergyListData = JSON.parse(jsonEl.textContent || '[]');
                    } catch (_) {}
                }
            }
            if (Array.isArray(clergyListData) && typeof flagClergyListWithViolations === 'function') {
                flagClergyListWithViolations(clergyListData, window.bishopValidityMap, skipIds);
            }
            if (skipIds.length) window._lastNewlyCreatedBishopIds = null;
        }
    });

    window.StatusInheritance = {
        getEffectiveStatus,
        getWorstStatus,
        getAllowedOrdinationStatuses: getAllowedEffectiveOrdinationStatuses,
        getAllowedConsecrationStatuses: getAllowedEffectiveConsecrationStatuses,
        isOrdinationStatusAllowed,
        isConsecrationStatusAllowed,
        applyValidityRestrictions,
        flagClergyListWithViolations,
        validateFormStatus,
        handleNewEntry,
        refreshFormRestrictions
    };
})();
