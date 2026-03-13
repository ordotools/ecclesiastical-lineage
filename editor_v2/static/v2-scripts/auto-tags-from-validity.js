/**
 * Auto-tags from validity for Editor v2.
 *
 * Keeps the tags input in sync with validity-related fields on the clergy form.
 * Depends on window.EditorV2Validity (from validity-rules.js) and the presence
 * of #clergyForm with optional data-initial-tags and data-clergy-id attributes.
 */
(() => {
    'use strict';

    if (typeof window === 'undefined' || !window.EditorV2Validity) {
        return;
    }

    const VALIDITY_CHANGE_SELECTOR = [
        'select[name$="[validity]"]',
        'input[name^="ordinations["][name*="is_sub_conditione"]',
        'input[name^="ordinations["][name*="is_doubtful_event"]',
        'input[name^="consecrations["][name*="is_sub_conditione"]',
        'input[name^="consecrations["][name*="is_doubtful_event"]'
    ].join(', ');

    const TAG_ORDER = ['invalid', 'doubtful', 'sub_cond', 'valid'];

    function toArray(value) {
        if (!value) {
            return [];
        }
        return Array.isArray(value) ? value : Array.from(value);
    }

    function parseTags(raw) {
        if (!raw) {
            return [];
        }
        return raw.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
    }

    function mergeTagLists(current, required) {
        const result = toArray(current);
        const lowerSet = new Set(result.map(t => t.toLowerCase()));
        toArray(required).forEach(tag => {
            const lower = String(tag).toLowerCase();
            if (!lowerSet.has(lower)) {
                lowerSet.add(lower);
                result.push(tag);
            }
        });
        return result;
    }

    function computeTagsFromForm(form) {
        const validityApi = window.EditorV2Validity;
        if (!validityApi || typeof validityApi.getEffectiveStatus !== 'function' || typeof validityApi.getWorstStatus !== 'function') {
            return [];
        }

        const ordValidity = toArray(form.querySelectorAll('select[name^="ordinations["][name$="[validity]"]'));
        const ordSubCond = toArray(form.querySelectorAll('input[name^="ordinations["][name*="is_sub_conditione"]'));
        const ordDoubtEvt = toArray(form.querySelectorAll('input[name^="ordinations["][name*="is_doubtful_event"]'));

        const consValidity = toArray(form.querySelectorAll('select[name^="consecrations["][name$="[validity]"]'));
        const consSubCond = toArray(form.querySelectorAll('input[name^="consecrations["][name*="is_sub_conditione"]'));
        const consDoubtEvt = toArray(form.querySelectorAll('input[name^="consecrations["][name*="is_doubtful_event"]'));

        const effectiveStatuses = [];
        let hasSubConditione = false;

        const pushRecords = (validityNodes, subCondNodes, doubtEvtNodes) => {
            validityNodes.forEach((selectEl, index) => {
                if (!selectEl) {
                    return;
                }
                const validityValue = (selectEl.value || '').trim() || null;
                const subCondEl = subCondNodes[index];
                const doubtEvtEl = doubtEvtNodes[index];

                const record = {
                    validity: validityValue,
                    is_sub_conditione: !!(subCondEl && subCondEl.checked),
                    is_doubtful_event: !!(doubtEvtEl && doubtEvtEl.checked)
                };

                if (record.is_sub_conditione) {
                    hasSubConditione = true;
                }

                const status = validityApi.getEffectiveStatus(record);
                effectiveStatuses.push(status);
            });
        };

        pushRecords(ordValidity, ordSubCond, ordDoubtEvt);
        pushRecords(consValidity, consSubCond, consDoubtEvt);

        if (effectiveStatuses.length === 0) {
            return [];
        }

        const worstStatus = validityApi.getWorstStatus(effectiveStatuses);

        const hasInvalid = effectiveStatuses.some(s => s === 'invalid');
        const hasDoubtful = effectiveStatuses.some(s => s === 'doubtfully_valid' || s === 'doubtful_event');

        const tags = [];
        if (hasInvalid) {
            tags.push('invalid');
        }
        if (hasDoubtful) {
            tags.push('doubtful');
        }
        if (hasSubConditione) {
            tags.push('sub_cond');
        }
        if (worstStatus === 'valid' || worstStatus === 'sub_conditione') {
            tags.push('valid');
        }

        const normalized = [];
        const seen = new Set();
        TAG_ORDER.forEach(name => {
            if (tags.includes(name) && !seen.has(name)) {
                seen.add(name);
                normalized.push(name);
            }
        });
        return normalized;
    }

    function getTagsInput(form) {
        const inputInForm = form.querySelector && form.querySelector('#tags_input');
        if (inputInForm) {
            return inputInForm;
        }
        return document.querySelector('#tags_input');
    }

    function syncTagsToForm(form) {
        if (!form) {
            return;
        }
        const tagsInput = getTagsInput(form);
        if (!tagsInput) {
            return;
        }

        const initialAttr = (form.getAttribute('data-initial-tags') || '').trim();
        const currentValue = tagsInput.value || '';

        if (initialAttr) {
            const requiredTags = parseTags(initialAttr);
            if (requiredTags.length === 0) {
                return;
            }
            const currentTags = parseTags(currentValue);
            const lowerCurrent = new Set(currentTags.map(t => t.toLowerCase()));
            const allPresent = requiredTags.every(t => lowerCurrent.has(t.toLowerCase()));
            if (allPresent) {
                return;
            }
            const merged = mergeTagLists(currentTags, requiredTags);
            tagsInput.value = merged.join(', ');
            return;
        }

        if (!form.hasAttribute('data-clergy-id')) {
            return;
        }

        const computedTags = computeTagsFromForm(form);
        tagsInput.value = computedTags.join(', ');
    }

    function handleValidityChange(event) {
        const target = event.target;
        if (!target || typeof target.matches !== 'function') {
            return;
        }
        if (!target.matches(VALIDITY_CHANGE_SELECTOR)) {
            return;
        }
        const form = target.closest && target.closest('form');
        if (!form || form.id !== 'clergyForm') {
            return;
        }
        syncTagsToForm(form);
    }

    function handleEditorValidityChanged() {
        const form = document.getElementById('clergyForm');
        if (!form) {
            return;
        }
        syncTagsToForm(form);
    }

    function handleFormSubmit(event) {
        const form = event.target;
        if (!form || form.id !== 'clergyForm') {
            return;
        }
        syncTagsToForm(form);
    }

    document.addEventListener('change', handleValidityChange, false);

    if (document.body && typeof document.body.addEventListener === 'function') {
        document.body.addEventListener('editor:validityChanged', handleEditorValidityChanged, false);
        document.body.addEventListener('htmx:afterSwap', function (ev) {
            var detail = ev && ev.detail;
            var target = (detail && detail.target) || ev.target;
            if (!target) {
                return;
            }

            var form = null;
            if (target.id === 'clergyForm') {
                form = target;
            } else if (typeof target.querySelector === 'function') {
                form = target.querySelector('#clergyForm');
            }
            if (!form) {
                return;
            }

            if (form.getAttribute('data-auto-tags-synced') === 'true') {
                return;
            }

            syncTagsToForm(form);
            form.setAttribute('data-auto-tags-synced', 'true');
        }, false);
    }

    document.addEventListener('submit', handleFormSubmit, false);

    const initialForm = document.getElementById('clergyForm');
    if (initialForm) {
        syncTagsToForm(initialForm);
    }
})();

