/**
 * Auto-tags from validity for Editor v2.
 *
 * Keeps the **tag picker selection** in sync with validity-related fields on the
 * clergy form. Latest-wins: priest tags from last ordination; bishop/Valid from
 * last consecration only when a valid-like ordination precedes it (Rule 3 gate).
 *
 * Depends on:
 * - window.EditorV2Validity (from validity-rules.js)
 * - window.EDITOR_V2_TAGS (from tag-picker.js)
 * - #clergyForm with optional data-clergy-id attribute.
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
        'input[name^="consecrations["][name*="is_doubtful_event"]',
        'input[name^="ordinations["][name$="[date]"]',
        'input[name^="ordinations["][name$="[year]"]',
        'input[name^="ordinations["][name*="details_unknown"]',
        'input[name^="consecrations["][name$="[date]"]',
        'input[name^="consecrations["][name$="[year]"]',
        'input[name^="consecrations["][name*="details_unknown"]'
    ].join(', ');

    const TAG_ORDER = [
        'invalid_priest',
        'invalid_bishop',
        'doubtful_priest',
        'doubtful_bishop',
        'valid'
    ];

    const VALID_LIKE = ['valid', 'sub_conditione'];
    const DOUBTFUL_LIKE = ['doubtfully_valid', 'doubtful_event'];

    function toArray(value) {
        if (!value) {
            return [];
        }
        return Array.isArray(value) ? value : Array.from(value);
    }

    /**
     * Sort key matching backend _event_sort_key / _chronological_sort_key.
     * Returns { t: number|null, known: boolean } then chronological key for sort.
     */
    function eventSortKeyFromEntry(entry) {
        if (!entry) {
            return { chrono: [0, Number.NEGATIVE_INFINITY], t: null, known: false };
        }
        const dateEl = entry.querySelector('input[type="date"][name$="[date]"]');
        const yearEl = entry.querySelector('input[name$="[year]"]');
        const detailsEl = entry.querySelector('input[type="checkbox"][name*="[details_unknown]"]');

        const dateVal = dateEl && (dateEl.value || '').trim();
        if (dateVal) {
            const t = new Date(dateVal).getTime();
            if (Number.isFinite(t)) {
                return { chrono: [1, t], t: t, known: true };
            }
        }

        const yearRaw = yearEl && (yearEl.value || '').trim();
        if (yearRaw) {
            const y = parseInt(yearRaw, 10);
            if (Number.isFinite(y)) {
                const t = new Date(y, 0, 1).getTime();
                return { chrono: [1, t], t: t, known: true };
            }
        }

        if (detailsEl && detailsEl.checked) {
            return { chrono: [0, Number.NEGATIVE_INFINITY], t: Number.NEGATIVE_INFINITY, known: true };
        }

        return { chrono: [0, Number.NEGATIVE_INFINITY], t: null, known: false };
    }

    function strictlyBefore(ordKey, consKey) {
        if (!consKey.known) {
            return true;
        }
        if (!ordKey.known || ordKey.t == null) {
            return false;
        }
        return ordKey.t < consKey.t;
    }

    function collectEvents(form, entrySelector, type) {
        const validityApi = window.EditorV2Validity;
        const events = [];
        toArray(form.querySelectorAll(entrySelector)).forEach(entry => {
            const selectEl = entry.querySelector('select[name$="[validity]"]');
            if (!selectEl) {
                return;
            }
            const subCondEl = entry.querySelector('input[type="checkbox"][name*="[is_sub_conditione]"]');
            const doubtEvtEl = entry.querySelector('input[type="checkbox"][name*="[is_doubtful_event]"]');
            const record = {
                validity: (selectEl.value || '').trim() || null,
                is_sub_conditione: !!(subCondEl && subCondEl.checked),
                is_doubtful_event: !!(doubtEvtEl && doubtEvtEl.checked)
            };
            const status = validityApi.getEffectiveStatus(record);
            if (!status) {
                return;
            }
            const sortKey = eventSortKeyFromEntry(entry);
            events.push({ type, status, sortKey });
        });
        events.sort((a, b) => {
            if (a.sortKey.chrono[0] !== b.sortKey.chrono[0]) {
                return a.sortKey.chrono[0] - b.sortKey.chrono[0];
            }
            return a.sortKey.chrono[1] - b.sortKey.chrono[1];
        });
        return events;
    }

    /**
     * Computes the list of **system tag names** that should be applied based on
     * the ordinations / consecrations validity fields on the form.
     *
     * Latest-wins (mirrors services/validation_cascade.compute_system_tag_names_for_clergy):
     *   - priest tags from chronologically last ordination
     *   - bishop tags from chronologically last consecration
     *   - valid-like consecration counts only with prior valid-like ordination
     */
    function computeTagsFromForm(form) {
        const validityApi = window.EditorV2Validity;
        if (!validityApi || typeof validityApi.getEffectiveStatus !== 'function') {
            return [];
        }

        const ords = collectEvents(form, '.ordination-entry', 'ordination');
        const cons = collectEvents(form, '.consecration-entry', 'consecration');

        if (ords.length === 0 && cons.length === 0) {
            return [];
        }

        const tags = [];

        let hasValidOrdination = false;
        if (ords.length > 0) {
            const lastOrd = ords[ords.length - 1];
            const lastOrdStatus = lastOrd.status;
            const hasSubsequentCons = cons.some(c =>
                strictlyBefore(lastOrd.sortKey, c.sortKey)
            );
            if (lastOrdStatus === 'invalid') {
                tags.push('invalid_priest');
                if (hasSubsequentCons) {
                    tags.push('invalid_bishop');
                }
            } else if (DOUBTFUL_LIKE.indexOf(lastOrdStatus) !== -1) {
                tags.push('doubtful_priest');
                if (hasSubsequentCons) {
                    tags.push('doubtful_bishop');
                }
            }
            hasValidOrdination = VALID_LIKE.indexOf(lastOrdStatus) !== -1;
        }

        let hasValidConsecration = true;
        if (cons.length > 0) {
            const latestCons = cons[cons.length - 1];
            const lastConsStatus = latestCons.status;
            const consKey = latestCons.sortKey;
            const gate = ords.some(o =>
                VALID_LIKE.indexOf(o.status) !== -1 && strictlyBefore(o.sortKey, consKey)
            );

            if (lastConsStatus === 'invalid') {
                if (tags.indexOf('invalid_bishop') === -1) {
                    tags.push('invalid_bishop');
                }
            } else if (DOUBTFUL_LIKE.indexOf(lastConsStatus) !== -1) {
                if (tags.indexOf('doubtful_bishop') === -1) {
                    tags.push('doubtful_bishop');
                }
            }

            hasValidConsecration = gate && VALID_LIKE.indexOf(lastConsStatus) !== -1;
        }

        if (hasValidOrdination && hasValidConsecration) {
            tags.push('valid');
        }

        if (tags.indexOf('invalid_bishop') !== -1 && tags.indexOf('doubtful_bishop') !== -1) {
            const idx = tags.indexOf('doubtful_bishop');
            tags.splice(idx, 1);
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

    function syncTagsToForm(form) {
        if (!form) {
            return;
        }
        const tagApi = window.EDITOR_V2_TAGS;
        if (!tagApi || typeof tagApi.setSelectedByNames !== 'function') {
            return;
        }

        // Only auto-apply validity-based tags for existing clergy records,
        // matching the previous behaviour that gated on data-clergy-id.
        if (!form.hasAttribute('data-clergy-id')) {
            return;
        }

        const computedTags = computeTagsFromForm(form);
        // Always sync system tags (including clearing when none apply) so
        // tags_selected matches validity on first save.
        try {
            tagApi.setSelectedByNames(computedTags || [], {
                append: true,
                replaceSystem: true
            });
        } catch (e) {
            // Fail silently; auto-tagging is a progressive enhancement.
        }
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
        document.body.addEventListener('editor:tagPickerReady', function () {
            var form = document.getElementById('clergyForm');
            if (form) {
                syncTagsToForm(form);
            }
        }, false);

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

            syncTagsToForm(form);
        }, false);
    }

    document.addEventListener('submit', handleFormSubmit, false);

    const initialForm = document.getElementById('clergyForm');
    if (initialForm) {
        syncTagsToForm(initialForm);
    }
})();
