/**
 * Restricts the validity dropdown of an ordination/consecration to what the
 * chosen ordainer/consecrator can validly give (Table C), using
 * /api/bishop-validity/<id> and EditorV2Validity.
 */
(() => {
    'use strict';

    const V = window.EditorV2Validity;
    if (!V) {
        return;
    }
    const BISHOP_ID = 'input[name$="[consecrator_id]"], input[name$="[ordaining_bishop_id]"]';
    const cache = new Map();

    function summaryFor(id) {
        if (!cache.has(id)) {
            cache.set(id, fetch('/editor/api/bishop-validity/' + id)
                .then(r => (r.ok ? r.json() : null))
                .catch(() => null));
        }
        return cache.get(id);
    }

    async function applyToEntry(entry) {
        const select = entry.querySelector('select[name$="[validity]"]');
        const idEl = entry.querySelector(BISHOP_ID);
        if (!select || !idEl) {
            return;
        }
        const summary = idEl.value ? await summaryFor(idEl.value) : null;
        const allowed = summary
            ? V.getAllowedValidityValues(V.getAllowedEffectiveOrdinationStatuses(summary))
            : V.VALIDITY_VALUES;
        Array.from(select.options).forEach(o => { o.disabled = !allowed.includes(o.value); });
        if (!allowed.includes(select.value)) {
            select.value = allowed[0] || 'valid';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function applyAll(root) {
        (root || document).querySelectorAll('.ordination-entry, .consecration-entry').forEach(applyToEntry);
    }

    document.addEventListener('change', e => {
        if (e.target.matches && e.target.matches(BISHOP_ID)) {
            applyToEntry(e.target.closest('.ordination-entry, .consecration-entry'));
        }
    });
    document.addEventListener('DOMContentLoaded', () => applyAll());
    document.body.addEventListener('htmx:afterSwap', e => applyAll(e.detail && e.detail.target));
})();
