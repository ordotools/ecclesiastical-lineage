/**
 * Validity-extra block (Inherited/Other) sync and change delegation.
 * Loaded globally so it runs when clergy form content is loaded via HTMX (innerHTML),
 * where inline scripts in the response are not executed.
 */
(function () {
    'use strict';

    function syncValidityExtraForEntry(entry) {
        if (!entry) return;
        const block = entry.querySelector('.validity-extra-block');
        const validitySelect = entry.querySelector('select[name*="[validity]"]');
        const otherCheckbox = entry.querySelector('input[name*="[is_other]"]');
        const optionalNotesInput = entry.querySelector('input[name*="[optional_notes]"]');
        if (!block || !validitySelect) return;
        const showBlock = validitySelect.value !== 'valid';
        block.style.display = showBlock ? 'block' : 'none';
        if (otherCheckbox && optionalNotesInput) {
            optionalNotesInput.disabled = !otherCheckbox.checked;
            if (!otherCheckbox.checked) optionalNotesInput.value = '';
        }
    }

    window.syncValidityExtraForEntry = syncValidityExtraForEntry;

    if (!window.clergyFormValidityExtraDelegationAttached) {
        document.addEventListener('change', function (e) {
            const t = e.target;
            if (!t || !t.closest('#clergyForm')) return;
            const entry = t.closest('.ordination-entry') || t.closest('.consecration-entry');
            if (!entry) return;
            const isValidity = t.matches('select[name*="[validity]"]');
            const isOther = t.matches('input[name*="[is_other]"]');
            if (isValidity || isOther) syncValidityExtraForEntry(entry);
        });
        window.clergyFormValidityExtraDelegationAttached = true;
    }

    if (!window.clergyFormBishopConsecratorDelegationAttached) {
        document.addEventListener('change', function (e) {
            const t = e.target;
            if (!t || !t.closest('#clergyForm')) return;
            if (!t.matches('input[name*="[ordaining_bishop_id]"]') && !t.matches('input[name*="[consecrator_id]"]')) return;
            const idRaw = (t.value || '').trim();
            if (!idRaw) return;
            const id = parseInt(idRaw, 10);
            if (Number.isNaN(id)) return;
            const panel = window.ValidationImpactPanel;
            if (!panel || typeof panel.canClergyValidlyOrdain !== 'function' || typeof panel.canClergyValidlyConsecrate !== 'function') return;

            if (t.matches('input[name*="[ordaining_bishop_id]"]')) {
                const entry = t.closest('.ordination-entry');
                if (!entry || panel.canClergyValidlyOrdain(id)) return;
                const validitySelect = entry.querySelector('select[name*="[validity]"]');
                if (validitySelect && validitySelect.value === 'valid') {
                    validitySelect.value = 'doubtfully_valid';
                    syncValidityExtraForEntry(entry);
                }
                const inheritedCheckbox = entry.querySelector('input[name*="[is_inherited]"]');
                if (inheritedCheckbox) inheritedCheckbox.checked = true;
                return;
            }
            if (t.matches('input[name*="[consecrator_id]"]')) {
                const entry = t.closest('.consecration-entry');
                if (!entry || panel.canClergyValidlyConsecrate(id)) return;
                const validitySelect = entry.querySelector('select[name*="[validity]"]');
                if (validitySelect && validitySelect.value === 'valid') {
                    validitySelect.value = 'doubtfully_valid';
                    syncValidityExtraForEntry(entry);
                }
                const inheritedCheckbox = entry.querySelector('input[name*="[is_inherited]"]');
                if (inheritedCheckbox) inheritedCheckbox.checked = true;
            }
        });
        window.clergyFormBishopConsecratorDelegationAttached = true;
    }
})();
