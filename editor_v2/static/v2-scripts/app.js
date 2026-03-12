/**
 * Editor v2 — entry script (HTMX glue).
 *
 * Responsibilities here:
 *  - Keep window.currentSelectedClergyId in sync for Editor v2.
 *  - Dispatch the shared `clergySelected` event that other modules listen to
 *    (ValidationImpactPanel, EditorRightPanelOrdained, eventsPanel, etc.).
 *
 * This mirrors the behaviour of the legacy editor's selection wiring in
 * `static/js/editor-init.js`, but is scoped to the v2 shell and routes.
 */

(() => {
    'use strict';

    function setCurrentClergyId(clergyId) {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }
        const normalized = clergyId != null && clergyId !== ''
            ? parseInt(clergyId, 10)
            : null;
        const numericId = Number.isFinite(normalized) ? normalized : null;
        window.currentSelectedClergyId = numericId;

        document.body.dispatchEvent(new CustomEvent('clergySelected', {
            detail: { clergyId: numericId }
        }));
    }

    function updateLeftPanelSelection(clergyId) {
        if (typeof document === 'undefined') {
            return;
        }
        const normalized = clergyId != null && clergyId !== ''
            ? parseInt(clergyId, 10)
            : null;
        const numericId = Number.isFinite(normalized) ? normalized : null;

        const root = document.getElementById('editor-panel-left') || document;
        const items = root.querySelectorAll('.panel-left-clergy-item[data-clergy-id]');
        if (!items || items.length === 0) {
            return;
        }

        items.forEach(function (el) {
            const raw = el.getAttribute('data-clergy-id');
            const value = raw != null && raw !== '' ? parseInt(raw, 10) : NaN;
            const isMatch = numericId != null && Number.isFinite(value) && value === numericId;
            if (isMatch) {
                el.classList.add('panel-left-clergy-item--selected');
            } else {
                el.classList.remove('panel-left-clergy-item--selected');
            }
        });
    }

    function extractClergyIdFromUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }
        const queryIndex = url.indexOf('?');
        const query = queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
        if (!query) {
            return null;
        }
        const params = query.split('&');
        for (let i = 0; i < params.length; i++) {
            const part = params[i];
            const eqIndex = part.indexOf('=');
            if (eqIndex === -1) {
                continue;
            }
            const key = decodeURIComponent(part.slice(0, eqIndex));
            const value = decodeURIComponent(part.slice(eqIndex + 1));
            if (key === 'clergy_id') {
                return value;
            }
        }
        return null;
    }

    function initSelectionWiring() {
        if (typeof document === 'undefined') {
            return;
        }

        // Clicks on any link that HTMX uses to load the v2 center panel.
        document.body.addEventListener('click', function (event) {
            const target = event.target;
            if (!target || typeof target.closest !== 'function') {
                return;
            }

            const link = target.closest('a[hx-get*="/editor-v2/panel/center"]');
            if (!link) {
                return;
            }

            const hxGet = link.getAttribute('hx-get');
            const href = link.getAttribute('href');
            const url = hxGet || href || '';
            const idFromUrl = extractClergyIdFromUrl(url);
            setCurrentClergyId(idFromUrl);
        });

        // Fallback: when HTMX swaps in a new center panel, keep selection in sync
        // using the most recent request path (if available). When loading a blank
        // "Add clergy" form (no clergy_id in the path), clear the selection.
        document.body.addEventListener('htmx:afterSwap', function (event) {
            const detail = event.detail || {};
            const target = detail.target || event.target;
            if (!target) {
                return;
            }

            const panelCenter = document.getElementById('editor-panel-center');
            const affectedCenter = panelCenter && (target === panelCenter || panelCenter.contains(target));
            if (!affectedCenter) {
                return;
            }

            const requestConfig = detail.requestConfig || {};
            const path = requestConfig.path || requestConfig.pathInfo || requestConfig.url || '';
            const idFromPath = extractClergyIdFromUrl(path);

            if (idFromPath != null) {
                setCurrentClergyId(idFromPath);
            } else {
                setCurrentClergyId(null);
            }
        });
    }

    function initLeftPanelSelectionSync() {
        if (typeof document === 'undefined' || !document.body) {
            return;
        }

        document.body.addEventListener('clergySelected', function (event) {
            const detail = event.detail || {};
            const id = detail.clergyId != null ? detail.clergyId : null;
            updateLeftPanelSelection(id);
        });

        document.body.addEventListener('htmx:afterSwap', function (event) {
            const detail = event.detail || {};
            const target = detail.target || event.target;
            const panelLeft = document.getElementById('editor-panel-left');
            const affectedLeft = panelLeft && (target === panelLeft || panelLeft.contains(target));
            if (!affectedLeft) {
                return;
            }

            if (typeof window !== 'undefined') {
                updateLeftPanelSelection(window.currentSelectedClergyId);
            }
        });
    }

    /**
     * Intercept clergy form submissions in the v2 shell so that saves happen
     * via fetch + JSON, keeping the user on /editor-v2 while refreshing the
     * relevant panels.
     */
    function initClergyFormInterceptor() {
        if (typeof document === 'undefined' || !document.body) {
            return;
        }

        /**
         * Lightweight helper to render a status message at the top of the form.
         * @param {HTMLFormElement} form
         * @param {'success'|'error'} kind
         * @param {string} message
         */
        function renderFormStatus(form, kind, message) {
            if (!form) {
                return;
            }
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

        document.body.addEventListener('submit', function (event) {
            const form = event.target;
            if (!form || !(form instanceof HTMLFormElement)) {
                return;
            }
            if (!form.matches('#clergyForm[data-editor-v2-clergy-form="true"]')) {
                return;
            }

            event.preventDefault();

            // Prevent accidental double-submits.
            if (form.dataset.submitting === 'true') {
                return;
            }
            form.dataset.submitting = 'true';

            const action = form.getAttribute('action') || '';
            if (!action) {
                form.dataset.submitting = 'false';
                return;
            }

            const formData = new FormData(form);
            const submitter = event.submitter;
            if (submitter && submitter.getAttribute('name') === 'update_descendants') {
                formData.append('update_descendants', submitter.getAttribute('value') || '1');
            }

            fetch(action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            })
                .then(function (response) {
                    if (!response.ok) {
                        return response.json()
                            .then(function (body) {
                                const message = body && typeof body.message === 'string'
                                    ? body.message
                                    : 'Failed to save clergy record.';
                                return {
                                    success: false,
                                    message: message
                                };
                            })
                            .catch(function () {
                                return {
                                    success: false,
                                    message: 'Failed to save clergy record.'
                                };
                            });
                    }

                    return response.json()
                        .then(function (body) {
                            if (!body || typeof body !== 'object') {
                                return {
                                    success: false,
                                    message: 'Unexpected response while saving clergy record.'
                                };
                            }
                            return body;
                        })
                        .catch(function () {
                            return {
                                success: false,
                                message: 'Unexpected response while saving clergy record.'
                            };
                        });
                })
                .then(function (data) {
                    const success = data && data.success === true;
                    let message = data && typeof data.message === 'string'
                        ? data.message
                        : (success ? 'Clergy record saved.' : 'Failed to save clergy record.');
                    if (success && typeof data.updated_descendants_count === 'number') {
                        message = 'Saved. ' + data.updated_descendants_count + ' descendant records updated.';
                    }

                    if (!success) {
                        renderFormStatus(form, 'error', message);
                        return;
                    }

                    let clergyId = null;
                    if (data && data.clergy_id != null) {
                        clergyId = parseInt(data.clergy_id, 10);
                    }
                    if (!Number.isFinite(clergyId)) {
                        const fromAttr = form.getAttribute('data-clergy-id');
                        const fromWindow = typeof window !== 'undefined' ? window.currentSelectedClergyId : null;
                        const fallback = fromAttr != null ? fromAttr : fromWindow;
                        const parsedFallback = fallback != null ? parseInt(fallback, 10) : NaN;
                        clergyId = Number.isFinite(parsedFallback) ? parsedFallback : null;
                    }

                    if (clergyId != null) {
                        setCurrentClergyId(clergyId);
                    }

                    renderFormStatus(form, 'success', message);

                    if (typeof window !== 'undefined' && typeof window.htmx !== 'undefined' && typeof window.htmx.ajax === 'function') {
                        if (clergyId != null) {
                            window.htmx.ajax('GET', `/editor-v2/panel/center?clergy_id=${clergyId}`, {
                                target: '#editor-panel-center',
                                swap: 'innerHTML'
                            });
                        }
                        window.htmx.ajax('GET', '/editor-v2/panel/left', {
                            target: '#editor-panel-left',
                            swap: 'innerHTML'
                        });
                    }

                    if (typeof document !== 'undefined' && document.body && clergyId != null) {
                        document.body.dispatchEvent(new CustomEvent('editor:validityChanged', {
                            detail: { clergyId: clergyId }
                        }));
                    }
                })
                .catch(function (error) {
                    if (typeof window !== 'undefined' && window.EDITOR_DEBUG && typeof console !== 'undefined' && console.error) {
                        console.error('Editor v2: failed to submit clergy form', error);
                    }
                    renderFormStatus(form, 'error', 'Failed to save clergy record.');
                })
                .finally(function () {
                    form.dataset.submitting = 'false';
                });
        });
    }

    /**
     * Snapshot current ordination/consecration validity values from the form
     * (ordered: ordinations by index, then consecrations by index).
     * @param {HTMLFormElement} form
     * @returns {string[]}
     */
    function getValiditySnapshot(form) {
        if (!form || !form.querySelectorAll) {
            return [];
        }
        function orderedValues(prefix) {
            const selects = form.querySelectorAll('select[name^="' + prefix + '"][name$="[validity]"]');
            const byName = Array.from(selects).map(function (el) {
                return { name: el.getAttribute('name'), value: (el.value || '').trim() };
            });
            byName.sort(function (a, b) {
                return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
            });
            return byName.map(function (o) {
                return o.value;
            });
        }
        return orderedValues('ordinations[').concat(orderedValues('consecrations['));
    }

    /**
     * Build a formEvents snapshot from the current ordination / consecration
     * fields in the clergy form. The shape mirrors the backend
     * _serialize_event() / ordained_consecrated_data endpoint enough for
     * EditorRangesValidity and right-panel grouping logic.
     *
     * @param {HTMLFormElement} form
     * @returns {{ ordinations: Array<object>, consecrations: Array<object> }}
     */
    function buildFormEventsFromForm(form) {
        if (!form || !form.querySelectorAll) {
            return { ordinations: [], consecrations: [] };
        }

        function collectEvents(prefix, kind) {
            const selector = 'input[name^="' + prefix + '"], select[name^="' + prefix + '"], textarea[name^="' + prefix + '"]';
            const fields = form.querySelectorAll(selector);
            /** @type {Map<number, object>} */
            const byIndex = new Map();
            const re = new RegExp('^' + prefix + '\\[(\\d+)\\]\\[([^\\]]+)\\]');

            fields.forEach(function (el) {
                const nameAttr = el.getAttribute('name') || '';
                const match = nameAttr.match(re);
                if (!match) {
                    return;
                }
                const idx = parseInt(match[1], 10);
                if (!Number.isFinite(idx)) {
                    return;
                }
                const fieldKey = match[2];
                // Ignore nested collections like co_consecrators – they do not
                // participate in the primary bishop's own formEvents.
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

                if (fieldKey === 'date') {
                    const value = (el.value || '').trim();
                    record.date = value || null;
                } else if (fieldKey === 'year') {
                    const raw = (el.value || '').trim();
                    const n = raw ? parseInt(raw, 10) : NaN;
                    record.year = Number.isFinite(n) ? n : null;
                } else if (fieldKey === 'date_unknown') {
                    const raw = (el.value || '').trim().toLowerCase();
                    record.date_unknown = raw === '1' || raw === 'true' || raw === 'on';
                } else if (fieldKey === 'validity') {
                    const v = (el.value || '').trim().toLowerCase() || 'valid';
                    record.validity = v;
                    record.is_invalid = v === 'invalid';
                    record.is_doubtfully_valid = v === 'doubtfully_valid';
                } else if (fieldKey === 'is_sub_conditione') {
                    record.is_sub_conditione = !!el.checked;
                } else if (fieldKey === 'is_doubtfully_valid') {
                    record.is_doubtfully_valid = !!el.checked;
                } else if (fieldKey === 'is_doubtful_event') {
                    record.is_doubtful_event = !!el.checked;
                } else if (fieldKey === 'is_inherited') {
                    record.is_inherited = !!el.checked;
                } else if (fieldKey === 'is_other') {
                    record.is_other = !!el.checked;
                } else if (fieldKey === 'optional_notes') {
                    const value = (el.value || '').trim();
                    record.optional_notes = value || null;
                } else if (fieldKey === 'notes') {
                    const value = (el.value || '').trim();
                    record.notes = value || null;
                }
            });

            // Finalize display_date from date/year, roughly mirroring backend behaviour.
            const events = Array.from(byIndex.keys())
                .sort(function (a, b) { return a - b; })
                .map(function (idx) {
                    const evt = byIndex.get(idx);
                    if (!evt) {
                        return null;
                    }
                    if (!evt.display_date) {
                        if (evt.date) {
                            evt.display_date = evt.date;
                        } else if (evt.year != null) {
                            evt.display_date = String(evt.year);
                        } else {
                            evt.display_date = null;
                        }
                    }
                    return evt;
                })
                .filter(function (evt) { return !!evt; });

            return events;
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
    function initUpdateDescendantsButtonLogic() {
        if (typeof document === 'undefined') {
            return;
        }
        const form = document.getElementById('clergyForm');
        if (!form || !form.matches('[data-editor-v2-clergy-form="true"]')) {
            return;
        }
        if (form.getAttribute('data-update-descendants-js-inited') === 'true') {
            return;
        }
        form.setAttribute('data-update-descendants-js-inited', 'true');

        const btn = form.querySelector('.editor-button--update-descendants');
        if (!btn) {
            return;
        }

        form._editorV2InitialValidity = getValiditySnapshot(form);

        function updateButton() {
            const hasDescendants = form.getAttribute('data-has-descendants') === 'true';
            const initial = form._editorV2InitialValidity || [];
            const current = getValiditySnapshot(form);
            const sameLength = initial.length === current.length;
            const sameValues = sameLength && current.every(function (v, i) {
                return initial[i] === v;
            });
            btn.disabled = !(hasDescendants && (!sameLength || !sameValues));
        }

        function dispatchPendingValidityPreview() {
            if (typeof document === 'undefined' || !document.body) {
                return;
            }

            const hasDescendants = form.getAttribute('data-has-descendants') === 'true';
            if (!hasDescendants) {
                return;
            }

            const fromAttr = form.getAttribute('data-clergy-id');
            const fromWindow = (typeof window !== 'undefined' && window.currentSelectedClergyId != null)
                ? window.currentSelectedClergyId
                : null;
            const fallback = (fromAttr != null && fromAttr !== '')
                ? fromAttr
                : fromWindow;
            const parsed = fallback != null ? parseInt(fallback, 10) : NaN;
            const clergyId = Number.isFinite(parsed) ? parsed : null;
            if (clergyId == null) {
                return;
            }

            const formEvents = buildFormEventsFromForm(form);

            document.body.dispatchEvent(new CustomEvent('editor:pendingValidityChanged', {
                detail: {
                    clergyId: clergyId,
                    formEvents: formEvents
                }
            }));
        }

        form.addEventListener('change', function (e) {
            const name = (e.target && e.target.getAttribute && e.target.getAttribute('name')) || '';
            if (name.indexOf('[validity]') === -1) {
                return;
            }
            updateButton();
            dispatchPendingValidityPreview();
        });

        const ordContainer = form.querySelector('#ordinationsContainer');
        const consContainer = form.querySelector('#consecrationsContainer');
        function observeContainer(container) {
            if (!container) {
                return;
            }
            const obs = new MutationObserver(function () {
                updateButton();
                dispatchPendingValidityPreview();
            });
            obs.observe(container, { childList: true, subtree: true });
        }
        observeContainer(ordContainer);
        observeContainer(consContainer);

        updateButton();
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                initSelectionWiring();
                initClergyFormInterceptor();
                initUpdateDescendantsButtonLogic();
                initLeftPanelSelectionSync();
            });
        } else {
            initSelectionWiring();
            initClergyFormInterceptor();
            initUpdateDescendantsButtonLogic();
            initLeftPanelSelectionSync();
        }
    }

    document.body.addEventListener('htmx:afterSwap', function (event) {
        const detail = event.detail || {};
        const target = detail.target || event.target;
        const panelCenter = document.getElementById('editor-panel-center');
        const affectedCenter = panelCenter && (target === panelCenter || panelCenter.contains(target));
        if (affectedCenter) {
            initUpdateDescendantsButtonLogic();
            if (typeof window !== 'undefined' &&
                window.EDITOR_V2_FORM &&
                typeof window.EDITOR_V2_FORM.initClergyFormV2 === 'function') {
                window.EDITOR_V2_FORM.initClergyFormV2();
            }
        }
    });
})();

