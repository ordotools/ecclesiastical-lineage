/**
 * Restricts the validity dropdown of an ordination/consecration to what the
 * chosen ordainer/consecrator can validly give at the event's date (Table C),
 * using /api/bishop-validity/<id>?date=|year= and EditorV2Validity.
 */
(() => {
    'use strict';

    const V = window.EditorV2Validity;
    if (!V) {
        return;
    }
    const BISHOP_ID = 'input[name$="[consecrator_id]"], input[name$="[ordaining_bishop_id]"]';
    const DATE = 'input[name$="[date]"], input[name$="[year]"]';
    const ENTRY = '.ordination-entry, .consecration-entry';
    const cache = new Map();

    function summaryFor(id, date, year) {
        const params = new URLSearchParams();
        if (date) {
            params.set('date', date);
        } else if (year) {
            params.set('year', year);
        }
        const url = '/editor/api/bishop-validity/' + id + '?' + params;
        if (!cache.has(url)) {
            cache.set(url, fetch(url)
                .then(r => (r.ok ? r.json() : null))
                .catch(() => null));
        }
        return cache.get(url);
    }

    /**
     * Disable options the bishop cannot give. Only change the selected value when the
     * user changed the bishop or date (fix); on load, a saved value is left as is.
     */
    async function applyToEntry(entry, fix) {
        const select = entry && entry.querySelector('select[name$="[validity]"]');
        const idEl = entry && entry.querySelector(BISHOP_ID);
        if (!select || !idEl) {
            return;
        }
        const dateEl = entry.querySelector('input[name$="[date]"]');
        const yearEl = entry.querySelector('input[name$="[year]"]');
        const summary = idEl.value
            ? await summaryFor(idEl.value, dateEl && dateEl.value, yearEl && yearEl.value)
            : null;
        const allowed = summary
            ? V.getAllowedValidityValues(V.getAllowedEffectiveOrdinationStatuses(summary))
            : V.VALIDITY_VALUES;
        Array.from(select.options).forEach(o => { o.disabled = !allowed.includes(o.value); });
        if (fix && !allowed.includes(select.value)) {
            select.value = allowed[0] || 'valid';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function applyAll(root) {
        (root || document).querySelectorAll(ENTRY).forEach(entry => applyToEntry(entry, false));
    }

    document.addEventListener('change', e => {
        if (e.target.matches && (e.target.matches(BISHOP_ID) || e.target.matches(DATE))) {
            applyToEntry(e.target.closest(ENTRY), true);
        }
    });
    document.addEventListener('DOMContentLoaded', () => applyAll());
    document.body.addEventListener('htmx:afterSwap', e => applyAll(e.detail && e.detail.target));
})();
