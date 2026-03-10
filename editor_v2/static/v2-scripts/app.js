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
        // using the most recent request path (if available).
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

            // Only update when we can recover an explicit clergy_id; "Add clergy"
            // and initial load keep the current selection as-is.
            if (idFromPath != null) {
                setCurrentClergyId(idFromPath);
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
                    const message = data && typeof data.message === 'string'
                        ? data.message
                        : (success ? 'Clergy record saved.' : 'Failed to save clergy record.');

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

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                initSelectionWiring();
                initClergyFormInterceptor();
            });
        } else {
            initSelectionWiring();
            initClergyFormInterceptor();
        }
    }
})();

