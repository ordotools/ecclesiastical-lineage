/**
 * Editor v2 — entry script (HTMX glue).
 *
 * Responsibilities here:
 *  - Keep window.currentSelectedClergyId in sync and dispatch the shared
 *    `clergySelected` event other modules listen to (right panel, tag picker…).
 *  - Save the clergy form (and its wiki) via fetch, then refresh the panels.
 *  - Unsaved-changes guard and statusbar record/save-state slots.
 */

(() => {
    'use strict';

    const CENTER = '#editor-panel-center';
    const LEFT = '#editor-panel-left';
    const JSON_HEADERS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };

    /** Message to show at the top of the form after the next center swap. */
    let pendingFormStatus = null;

    function parseId(raw) {
        const n = raw != null && raw !== '' ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) ? n : null;
    }

    function clergyIdFromUrl(url) {
        try {
            return new URL(url || '', location.origin).searchParams.get('clergy_id');
        } catch (e) {
            return null;
        }
    }

    function getForm() {
        const form = document.getElementById('clergyForm');
        return form && form.matches('[data-editor-v2-clergy-form="true"]') ? form : null;
    }

    function isDirty() {
        const form = getForm();
        return !!(form && form.dataset.dirty === 'true');
    }

    // --- Statusbar -------------------------------------------------------

    function setStatusText(id, text) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text || '';
        }
    }

    function setSaveState(text) {
        setStatusText('editor-status-save-state', text);
    }

    function setDirty(form, dirty) {
        if (!form) {
            return;
        }
        form.dataset.dirty = dirty ? 'true' : 'false';
        setSaveState(dirty ? 'Unsaved changes' : '');
    }

    // --- Selection -------------------------------------------------------

    function setCurrentClergyId(clergyId) {
        const numericId = parseId(clergyId);
        window.currentSelectedClergyId = numericId;
        document.body.dispatchEvent(new CustomEvent('clergySelected', {
            detail: { clergyId: numericId }
        }));
    }

    function updateLeftPanelSelection(clergyId) {
        const root = document.querySelector(LEFT);
        if (!root) {
            return;
        }
        root.querySelectorAll('.panel-left-clergy-item[data-clergy-id]').forEach(function (el) {
            const isMatch = clergyId != null && parseId(el.getAttribute('data-clergy-id')) === clergyId;
            el.classList.toggle('panel-left-clergy-item--selected', isMatch);
        });
    }

    /**
     * Reload center (blank or clergyId) and left panels. Keeps left-panel
     * filters and scroll; skips panels that are not on the page (embed mode).
     */
    function refreshPanels(clergyId) {
        if (!window.htmx) {
            return;
        }
        if (document.querySelector(CENTER)) {
            const url = clergyId != null ? '/editor/panel/center?clergy_id=' + clergyId : '/editor/panel/center';
            window.htmx.ajax('GET', url, { target: CENTER, swap: 'innerHTML' });
        }
        const left = document.querySelector(LEFT);
        if (left) {
            const filters = left.querySelector('.panel-left-filters-form');
            const query = filters ? new URLSearchParams(new FormData(filters)).toString() : '';
            const scrollTop = left.scrollTop;
            const done = window.htmx.ajax('GET', '/editor/panel/left' + (query ? '?' + query : ''), {
                target: LEFT,
                swap: 'innerHTML'
            });
            if (done && typeof done.then === 'function') {
                done.then(function () { left.scrollTop = scrollTop; });
            }
        }
    }

    // --- Form status messages -------------------------------------------

    function renderFormStatus(form, kind, message) {
        let statusEl = form.querySelector('[data-role="clergy-form-status"]');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.setAttribute('data-role', 'clergy-form-status');
            statusEl.className = 'clergy-form-status';
            form.insertBefore(statusEl, form.firstChild);
        }
        statusEl.textContent = message;
        statusEl.setAttribute('data-status', kind);
    }

    function renderWikiStatus(form, kind, message) {
        const statusEl = form.querySelector('[data-wiki-save-status]');
        if (!statusEl) {
            return;
        }
        statusEl.textContent = message;
        statusEl.setAttribute('data-status', kind);
        statusEl.hidden = !message;
    }

    // --- Wiki ------------------------------------------------------------

    function getWikiFields(form) {
        const markdown = form.querySelector('#wiki_markdown');
        const visibility = form.querySelector('#wiki_is_visible');
        return markdown || visibility ? { markdown: markdown, visibility: visibility } : null;
    }

    function readWiki(fields) {
        return {
            content: fields.markdown ? String(fields.markdown.value || '') : '',
            is_visible: fields.visibility ? !!fields.visibility.checked : true
        };
    }

    function writeWiki(fields, wiki) {
        if (fields.markdown) {
            fields.markdown.value = wiki.content;
        }
        if (fields.visibility) {
            fields.visibility.checked = wiki.is_visible;
        }
    }

    /**
     * Load the wiki into the form and remember what was loaded in
     * form._wikiInitial. If loading fails, _wikiInitial stays unset and the
     * wiki is never saved, so a failed load cannot overwrite the page.
     */
    function initWikiSection(form) {
        const fields = getWikiFields(form);
        if (!fields) {
            return;
        }
        const clergyId = parseId(form.getAttribute('data-clergy-id'));
        if (clergyId == null) {
            form._wikiInitial = { content: '', is_visible: true };
            writeWiki(fields, form._wikiInitial);
            return;
        }
        fetch('/editor/api/wiki/' + encodeURIComponent(clergyId), { headers: JSON_HEADERS })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Failed to load wiki page.');
                }
                return response.json();
            })
            .then(function (data) {
                const wiki = (data && data.wiki) || {};
                form._wikiInitial = {
                    content: typeof wiki.content === 'string' ? wiki.content : '',
                    is_visible: typeof wiki.is_visible === 'boolean' ? wiki.is_visible : true
                };
                writeWiki(fields, form._wikiInitial);
            })
            .catch(function () {
                if (fields.markdown) {
                    fields.markdown.disabled = true;
                }
                renderWikiStatus(form, 'error', 'Wiki failed to load; it will not be saved. Saving clergy still works.');
            });
    }

    /** Payload to save, or null when the wiki did not load or is unchanged. */
    function collectWikiPayload(form, clergyId) {
        const fields = getWikiFields(form);
        const initial = form._wikiInitial;
        if (!fields || !initial || clergyId == null) {
            return null;
        }
        const current = readWiki(fields);
        if (current.content === initial.content && current.is_visible === initial.is_visible) {
            return null;
        }
        return { clergy_id: clergyId, content: current.content, is_visible: current.is_visible };
    }

    function saveWikiPayload(payload) {
        return fetch('/editor/api/wiki/save', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, JSON_HEADERS),
            body: JSON.stringify(payload)
        })
            .then(function (response) {
                return response.json().then(function (body) {
                    return !!(response.ok && body && body.success === true);
                });
            })
            .catch(function () {
                return false;
            });
    }

    // --- Save ------------------------------------------------------------

    function readSaveResponse(response) {
        const fallback = response.ok
            ? 'Unexpected response while saving clergy record.'
            : 'Failed to save clergy record.';
        return response.json()
            .then(function (body) {
                if (!body || typeof body !== 'object') {
                    return { success: false, message: fallback };
                }
                if (!response.ok) {
                    return { success: false, message: typeof body.message === 'string' ? body.message : fallback };
                }
                return body;
            })
            .catch(function () {
                return { success: false, message: fallback };
            });
    }

    function handleSubmit(event) {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || !form.matches('#clergyForm[data-editor-v2-clergy-form="true"]')) {
            return;
        }
        event.preventDefault();

        // Prevent accidental double-submits.
        const action = form.getAttribute('action') || '';
        if (form.dataset.submitting === 'true' || !action) {
            return;
        }
        form.dataset.submitting = 'true';
        setSaveState('Saving…');

        const formData = new FormData(form);
        const submitter = event.submitter;
        if (submitter && submitter.getAttribute('name') === 'update_descendants') {
            formData.append('update_descendants', submitter.getAttribute('value') || '1');
        }

        fetch(action, { method: 'POST', body: formData, headers: JSON_HEADERS })
            .then(readSaveResponse)
            .then(function (data) {
                const success = data && data.success === true;
                let message = typeof data.message === 'string' && data.message
                    ? data.message
                    : (success ? 'Clergy record saved.' : 'Failed to save clergy record.');
                if (success && typeof data.updated_descendants_count === 'number') {
                    message = 'Saved. ' + data.updated_descendants_count + ' descendant records updated.';
                }

                if (!success) {
                    renderFormStatus(form, 'error', message);
                    setSaveState('Save failed');
                    return null;
                }

                const clergyId = parseId(data.clergy_id) != null
                    ? parseId(data.clergy_id)
                    : parseId(form.getAttribute('data-clergy-id'));
                const isDeleted = data.is_deleted === true;
                const wikiPayload = isDeleted ? null : collectWikiPayload(form, clergyId);
                const wikiSaved = wikiPayload ? saveWikiPayload(wikiPayload) : Promise.resolve(true);

                return wikiSaved.then(function (wikiOk) {
                    const finalMessage = wikiOk ? message : message + ' Wiki not saved.';
                    setDirty(form, false);
                    setSaveState(wikiOk ? 'Saved' : 'Saved (wiki failed)');
                    pendingFormStatus = { kind: wikiOk ? 'success' : 'error', message: finalMessage };
                    refreshPanels(isDeleted ? null : clergyId);
                    if (clergyId != null && !isDeleted) {
                        document.body.dispatchEvent(new CustomEvent('editor:validityChanged', {
                            detail: { clergyId: clergyId }
                        }));
                    }
                });
            })
            .catch(function (error) {
                if (window.EDITOR_DEBUG) {
                    console.error('Editor v2: failed to submit clergy form', error);
                }
                renderFormStatus(form, 'error', 'Failed to save clergy record.');
                setSaveState('Save failed');
            })
            .finally(function () {
                form.dataset.submitting = 'false';
            });
    }

    // --- Permanent delete ------------------------------------------------

    function initPermanentDeleteButton(form) {
        const btn = document.getElementById('permanentDeleteClergyBtn');
        if (!btn) {
            return;
        }
        btn.addEventListener('click', function () {
            const deleteUrl = btn.getAttribute('data-permanent-delete-url') || '';
            const clergyName = btn.getAttribute('data-clergy-name') || 'this clergy record';
            if (!deleteUrl || !window.confirm(
                'Permanently delete "' + clergyName + '"?\n\n'
                + 'This removes the record and all related ordination/consecration links. '
                + 'This cannot be undone.'
            )) {
                return;
            }

            btn.disabled = true;
            fetch(deleteUrl, { method: 'POST', headers: JSON_HEADERS })
                .then(function (response) {
                    return response.json()
                        .then(function (body) { return { ok: response.ok, body: body }; })
                        .catch(function () { return { ok: false, body: null }; });
                })
                .then(function (result) {
                    const body = result.body;
                    if (!(result.ok && body && body.success === true)) {
                        const message = body && typeof body.message === 'string'
                            ? body.message
                            : 'Failed to permanently delete clergy record.';
                        renderFormStatus(form, 'error', message);
                        btn.disabled = false;
                        return;
                    }
                    setDirty(form, false);
                    pendingFormStatus = { kind: 'success', message: body.message || 'Clergy record permanently deleted.' };
                    setSaveState('Deleted');
                    refreshPanels(null);
                })
                .catch(function () {
                    renderFormStatus(form, 'error', 'Failed to permanently delete clergy record.');
                    btn.disabled = false;
                });
        });
    }

    // --- Validity snapshot / update-descendants --------------------------

    /**
     * Snapshot current ordination/consecration validity values from the form
     * (ordered: ordinations by index, then consecrations by index).
     */
    function getValiditySnapshot(form) {
        function orderedValues(prefix) {
            return Array.from(form.querySelectorAll('select[name^="' + prefix + '"][name$="[validity]"]'))
                .map(function (el) { return { name: el.getAttribute('name') || '', value: (el.value || '').trim() }; })
                .sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); })
                .map(function (o) { return o.value; });
        }
        return orderedValues('ordinations[').concat(orderedValues('consecrations['));
    }

    /**
     * Build a formEvents snapshot from the current ordination / consecration
     * fields in the clergy form. The shape mirrors the backend
     * _serialize_event() / ordained_consecrated_data endpoint enough for
     * EditorRangesValidity and right-panel grouping logic.
     */
    function buildFormEventsFromForm(form) {
        function collectEvents(prefix, kind) {
            const selector = 'input[name^="' + prefix + '"], select[name^="' + prefix + '"], textarea[name^="' + prefix + '"]';
            const byIndex = new Map();
            const re = new RegExp('^' + prefix + '\\[(\\d+)\\]\\[([^\\]]+)\\]');

            form.querySelectorAll(selector).forEach(function (el) {
                const match = (el.getAttribute('name') || '').match(re);
                if (!match) {
                    return;
                }
                const idx = parseInt(match[1], 10);
                const fieldKey = match[2];
                // Co-consecrators do not participate in the bishop's own formEvents.
                if (!fieldKey || fieldKey.indexOf('co_consecrators') === 0) {
                    return;
                }

                let record = byIndex.get(idx);
                if (!record) {
                    record = {
                        id: null,
                        kind: kind,
                        date: null,
                        year: null,
                        date_unknown: false,
                        display_date: null,
                        is_sub_conditione: false,
                        is_doubtfully_valid: false,
                        is_doubtful_event: false,
                        is_invalid: false,
                        is_inherited: false,
                        is_other: false,
                        optional_notes: null,
                        notes: null
                    };
                    byIndex.set(idx, record);
                }

                const value = (el.value || '').trim();
                if (fieldKey === 'date') {
                    record.date = value || null;
                } else if (fieldKey === 'year') {
                    record.year = parseId(value);
                } else if (fieldKey === 'date_unknown') {
                    record.date_unknown = ['1', 'true', 'on'].indexOf(value.toLowerCase()) !== -1;
                } else if (fieldKey === 'validity') {
                    const v = value.toLowerCase() || 'valid';
                    record.validity = v;
                    record.is_invalid = v === 'invalid';
                    record.is_doubtfully_valid = v === 'doubtfully_valid';
                } else if (['is_sub_conditione', 'is_doubtfully_valid', 'is_doubtful_event', 'is_inherited', 'is_other'].indexOf(fieldKey) !== -1) {
                    record[fieldKey] = !!el.checked;
                } else if (fieldKey === 'optional_notes' || fieldKey === 'notes') {
                    record[fieldKey] = value || null;
                }
            });

            // Finalize display_date from date/year, roughly mirroring backend behaviour.
            return Array.from(byIndex.keys())
                .sort(function (a, b) { return a - b; })
                .map(function (idx) {
                    const evt = byIndex.get(idx);
                    evt.display_date = evt.date || (evt.year != null ? String(evt.year) : null);
                    return evt;
                });
        }

        return {
            ordinations: collectEvents('ordinations', 'ordination'),
            consecrations: collectEvents('consecrations', 'consecration')
        };
    }

    /**
     * Enable "Save and update descendants" only when has_descendants and
     * current validity snapshot differs from initial.
     */
    function initUpdateDescendantsButtonLogic(form) {
        const btn = form.querySelector('.editor-button--update-descendants');
        if (!btn) {
            return;
        }
        const hasDescendants = form.getAttribute('data-has-descendants') === 'true';
        const initial = getValiditySnapshot(form);

        function update() {
            const current = getValiditySnapshot(form);
            const changed = initial.length !== current.length || current.some(function (v, i) { return initial[i] !== v; });
            btn.disabled = !(hasDescendants && changed);

            const clergyId = parseId(form.getAttribute('data-clergy-id'));
            if (hasDescendants && clergyId != null) {
                document.body.dispatchEvent(new CustomEvent('editor:pendingValidityChanged', {
                    detail: { clergyId: clergyId, formEvents: buildFormEventsFromForm(form) }
                }));
            }
        }

        form.addEventListener('change', function (e) {
            const name = (e.target && e.target.getAttribute && e.target.getAttribute('name')) || '';
            if (name.indexOf('[validity]') !== -1) {
                update();
            }
        });
        ['#ordinationsContainer', '#consecrationsContainer'].forEach(function (sel) {
            const container = form.querySelector(sel);
            if (container) {
                new MutationObserver(update).observe(container, { childList: true, subtree: true });
            }
        });
        btn.disabled = true;
    }

    // --- Unsaved-changes tracking ----------------------------------------

    // Trusted (user) events only: scripts that normalise the form on load
    // (validity restrictions, tag sync) dispatch untrusted change events.
    const DIRTY_CLICK = 'button[type="button"]:not(#permanentDeleteClergyBtn), .date-unknown-link, .specify-date-link, #tagPicker *';

    function markDirtyFromEvent(event) {
        if (!event.isTrusted || !event.target || !event.target.closest) {
            return;
        }
        const form = event.target.closest('#clergyForm');
        if (!form || form.dataset.dirty === 'true') {
            return;
        }
        if (event.type === 'click' && !event.target.closest(DIRTY_CLICK)) {
            return;
        }
        setDirty(form, true);
    }

    function guardCenterRequest(event) {
        const target = event.detail && event.detail.target;
        if (!target || target.id !== 'editor-panel-center' || !isDirty()) {
            return;
        }
        if (window.confirm('Discard unsaved changes?')) {
            setDirty(getForm(), false);
        } else {
            event.preventDefault();
        }
    }

    // --- Center panel lifecycle ------------------------------------------

    function showCurrentRecord() {
        const form = getForm();
        const nameInput = form && form.querySelector('#name');
        let text = '';
        if (form) {
            text = form.getAttribute('data-clergy-id') ? (nameInput && nameInput.value) || '' : 'New clergy';
        }
        setStatusText('editor-status-current-record', text);
    }

    function initCenter(requestPath) {
        const id = clergyIdFromUrl(requestPath);
        setCurrentClergyId(id);

        const form = getForm();
        showCurrentRecord();
        if (!form) {
            return;
        }
        if (window.EDITOR_V2_FORM && typeof window.EDITOR_V2_FORM.initClergyFormV2 === 'function') {
            window.EDITOR_V2_FORM.initClergyFormV2();
        }
        initWikiSection(form);
        initUpdateDescendantsButtonLogic(form);
        initPermanentDeleteButton(form);
        form.dataset.dirty = 'false';
        if (pendingFormStatus) {
            renderFormStatus(form, pendingFormStatus.kind, pendingFormStatus.message);
            pendingFormStatus = null;
        }
    }

    function init() {
        const body = document.body;
        body.addEventListener('submit', handleSubmit);
        body.addEventListener('input', markDirtyFromEvent);
        body.addEventListener('change', markDirtyFromEvent);
        body.addEventListener('click', markDirtyFromEvent);
        body.addEventListener('htmx:beforeRequest', guardCenterRequest);
        window.addEventListener('beforeunload', function (e) {
            if (isDirty()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        body.addEventListener('clergySelected', function (event) {
            updateLeftPanelSelection(event.detail ? event.detail.clergyId : null);
        });

        body.addEventListener('htmx:afterSwap', function (event) {
            const target = (event.detail && event.detail.target) || event.target;
            if (!target) {
                return;
            }
            if (target.id === 'editor-panel-center') {
                const config = event.detail.requestConfig || {};
                initCenter(config.path || '');
            } else if (target.id === 'editor-panel-left') {
                updateLeftPanelSelection(window.currentSelectedClergyId);
            } else if (target.classList && target.classList.contains('editor-statusbar')) {
                showCurrentRecord();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
