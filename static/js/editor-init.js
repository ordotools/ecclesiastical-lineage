/**
 * Editor page initialization: bottom panel, clergy selection, status bar, modals, chapel toggle.
 * Moved from inline scripts in editor.html.
 */
(function () {
    'use strict';

    // Feature flags for resizable UI (resizable-panes.js is currently not loaded in editor.html).
    // ENABLE_EDITOR_RESIZING: legacy master switch; resizable-panes.js and clergy_list.html use it as fallback.
    // ENABLE_EDITOR_PANEL_RESIZING: main editor split panes (resizable-panes.js).
    // ENABLE_CLERGY_INTERNAL_RESIZING: resizable sections inside the clergy list panel (clergy_list.html).
    // To enable panel resizing: set the desired flag(s) to true and uncomment the resizable-panes.js script in editor.html.
    window.ENABLE_EDITOR_RESIZING = false;
    window.ENABLE_EDITOR_PANEL_RESIZING = false;
    window.ENABLE_CLERGY_INTERNAL_RESIZING = false;

    // Bottom panel tab switching and expand/collapse (values from CSS :root)
    function getBottomStripHeightPx() {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--editor-bottom-strip-height').trim();
        return v ? parseInt(v, 10) : 40;
    }
    function getBottomExpandedHeightPx() {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--editor-bottom-expanded-height').trim();
        return v ? parseInt(v, 10) : 250;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const bottomTabs = document.querySelectorAll('.bottom-tab');
        const bottomTabContents = document.querySelectorAll('.bottom-tab-content');
        const container = document.querySelector('.editor-container');
        const toggleBtn = document.getElementById('bottom-panel-toggle');

        bottomTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                const targetTab = this.dataset.tab;

                bottomTabs.forEach(t => t.classList.remove('active'));
                bottomTabContents.forEach(content => content.classList.remove('active'));

                this.classList.add('active');
                const targetContent = document.getElementById(targetTab + '-content');
                if (targetContent) {
                    targetContent.classList.add('active');
                    if (targetContent.getAttribute('hx-trigger') === 'revealed') {
                        htmx.trigger(targetContent, 'revealed');
                    }
                }
            });
        });

        function getEditorLayout() {
            try {
                const raw = localStorage.getItem('editorLayout');
                return raw ? JSON.parse(raw) : {};
            } catch (_) {
                return {};
            }
        }

        function saveBottomHeight(height) {
            const layout = getEditorLayout();
            layout.bottomHeight = height;
            localStorage.setItem('editorLayout', JSON.stringify(layout));
        }

        toggleBtn.addEventListener('click', function () {
            const isCollapsed = container.classList.contains('bottom-panel-collapsed');
            if (isCollapsed) {
                container.classList.remove('bottom-panel-collapsed');
                const layout = getEditorLayout();
                const h = Math.max(150, Math.min(500, layout.bottomHeight || getBottomExpandedHeightPx()));
                container.style.gridTemplateRows = `1fr ${h}px`;
                toggleBtn.setAttribute('aria-expanded', 'true');
                toggleBtn.setAttribute('title', 'Collapse bottom panel');
                toggleBtn.querySelector('i').className = 'fas fa-chevron-down';
                toggleBtn.querySelector('span').textContent = 'Collapse';
                requestAnimationFrame(function () {
                    window.dispatchEvent(new CustomEvent('editor-bottom-panel-expanded'));
                });
            } else {
                const bottomPanel = document.querySelector('.bottom-panel');
                if (bottomPanel && bottomPanel.offsetHeight > getBottomStripHeightPx()) {
                    saveBottomHeight(bottomPanel.offsetHeight);
                }
                container.classList.add('bottom-panel-collapsed');
                container.style.gridTemplateRows = '';
                toggleBtn.setAttribute('aria-expanded', 'false');
                toggleBtn.setAttribute('title', 'Expand bottom panel');
                toggleBtn.querySelector('i').className = 'fas fa-chevron-up';
                toggleBtn.querySelector('span').textContent = 'Expand';
            }
        });
    });

    // Returns 'clergy-api' | 'clergy-selection' | 'other' from htmx request URL
    function getRequestType(evt) {
        const url = evt.detail?.xhr?.responseURL;
        if (!url) return 'other';
        const isClergyAPI = url.includes('/clergy/add') || url.includes('/clergy/edit') || url.includes('/clergy/delete');
        if (isClergyAPI) return 'clergy-api';
        const isClergySelection = (url.includes('/editor/clergy-form/') || url.includes('/editor/clergy-form-content/') ||
            url === window.location.origin + '/editor/clergy-form' || url === window.location.origin + '/editor/clergy-form-content');
        return isClergySelection ? 'clergy-selection' : 'other';
    }
    window.getRequestType = getRequestType;

    document.body.addEventListener('htmx:afterRequest', function (evt) {
        const requestType = getRequestType(evt);

        if (requestType === 'clergy-api') {
            if (typeof window.refreshEditorAfterClergySave === 'function') {
                window.refreshEditorAfterClergySave();
            }
        } else if (requestType === 'clergy-selection') {
            if (window.currentSelectedClergyId) {
                setTimeout(() => {
                    highlightClergyInList(window.currentSelectedClergyId);
                    highlightClergyInVisualization(window.currentSelectedClergyId);
                }, 100);
            }
        }
    });

    document.body.addEventListener('clergyUpdated', function (evt) {
        if (evt.detail && evt.detail.action && (evt.detail.action === 'updated' || evt.detail.action === 'created' || evt.detail.action === 'deleted')) {
            const centerPanelContent = document.getElementById('visualization-panel-content');
            if (typeof htmx !== 'undefined' && centerPanelContent) {
                htmx.ajax('GET', '/editor/lineage-menu', { target: centerPanelContent, swap: 'innerHTML' });
            }
        }
    });

    document.body.addEventListener('click', function (e) {
        if (e.target.closest('#viz-reload-btn')) {
            e.preventDefault();
            const centerPanelContent = document.getElementById('visualization-panel-content');
            if (typeof htmx !== 'undefined' && centerPanelContent) {
                htmx.ajax('GET', '/editor/lineage-menu', { target: centerPanelContent, swap: 'innerHTML' });
            }
        }
    });

    let selectClergyTimeout = null;
    window.currentSelectedClergyId = null;

    function clearGlobalFormState() {
        window.clergyFormGlobals?.clear();
        const fileInput = document.getElementById('clergyImage');
        if (fileInput) {
            fileInput.value = '';
        }
    }

    function getClergyFormSwapTarget() {
        const loader = document.querySelector('#clergyFormContainer .form-content-loader');
        if (loader) return loader;
        return document.querySelector('.right-panel .panel-content');
    }

    function selectClergy(clergyId) {
        if (selectClergyTimeout) {
            clearTimeout(selectClergyTimeout);
        }

        clearGlobalFormState();

        const existingForm = document.querySelector('.right-panel .panel-content #clergyForm');
        if (existingForm && typeof window.clearFormState === 'function') {
            window.clearFormState();
        }

        clearClergyHighlights();
        window.currentSelectedClergyId = clergyId;

        return new Promise((resolve, reject) => {
            selectClergyTimeout = setTimeout(() => {
                highlightClergyInList(clergyId);
                highlightClergyInVisualization(clergyId);

                const swapTarget = getClergyFormSwapTarget();
                if (!swapTarget) {
                    reject(new Error('Clergy form swap target not found'));
                    return;
                }
                const isLoader = swapTarget.classList.contains('form-content-loader');
                if (isLoader) {
                    const existingFormEl = swapTarget.querySelector('#clergyForm');
                    if (existingFormEl) {
                        const ordinationsContainer = swapTarget.querySelector('#ordinationsContainer');
                        const consecrationsContainer = swapTarget.querySelector('#consecrationsContainer');
                        if (ordinationsContainer) ordinationsContainer.innerHTML = '';
                        if (consecrationsContainer) consecrationsContainer.innerHTML = '';
                        const ordinationInputs = existingFormEl.querySelectorAll('input[name*="ordinations[0]"], textarea[name*="ordinations[0]"]');
                        ordinationInputs.forEach(input => {
                            if (input.type === 'checkbox') input.checked = false;
                            else input.value = '';
                        });
                        const consecrationInputs = existingFormEl.querySelectorAll('input[name*="consecrations[0]"], textarea[name*="consecrations[0]"]');
                        consecrationInputs.forEach(input => {
                            if (input.type === 'checkbox') input.checked = false;
                            else input.value = '';
                        });
                    }
                    swapTarget.innerHTML = '<div class="loading-placeholder"><div class="loading-spinner"></div>Loading form...</div>';
                    const contentUrl = clergyId ? `/editor/clergy-form-content/${clergyId}` : '/editor/clergy-form-content';
                    htmx.ajax('GET', contentUrl, {
                        target: swapTarget,
                        swap: 'innerHTML'
                    }).then(() => {
                        if (clergyId) {
                            highlightClergyInList(clergyId);
                            highlightClergyInVisualization(clergyId);
                        }
                        resolve();
                    }).catch(error => reject(error));
                } else {
                    swapTarget.innerHTML = '<div class="loading-placeholder"><div class="loading-spinner"></div>Loading form...</div>';
                    const formPanelUrl = clergyId ? `/editor/clergy-form/${clergyId}` : '/editor/clergy-form';
                    htmx.ajax('GET', formPanelUrl, {
                        target: swapTarget,
                        swap: 'innerHTML'
                    }).then(() => {
                        if (clergyId) {
                            highlightClergyInList(clergyId);
                            highlightClergyInVisualization(clergyId);
                        }
                        resolve();
                    }).catch(error => reject(error));
                }

                document.body.dispatchEvent(new CustomEvent('clergySelected', {
                    detail: { clergyId: clergyId }
                }));
            }, 50);
        });
    }

    function highlightClergyInList(clergyId) {
        document.querySelectorAll('.clergy-item-card').forEach(item => {
            item.classList.remove('selected');
        });
        if (clergyId) {
            const selectedItem = document.querySelector(`[data-clergy-id="${clergyId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
        }
    }

    function highlightClergyInVisualization(clergyId) {
        if (!clergyId || !window.editorVisualization) return;

        const viz = window.editorVisualization;
        if (!viz.isInitialized) {
            setTimeout(() => highlightClergyInVisualization(clergyId), 500);
            return;
        }

        if (typeof viz.highlightNode === 'function') {
            viz.highlightNode(clergyId);
        } else {
            if (!viz.node) return;
            const outerRadius = window.OUTER_RADIUS || 28;
            viz.node.selectAll('circle').each(function (d) {
                const circle = d3.select(this);
                const r = parseFloat(circle.attr('r'));
                if (Math.abs(r - outerRadius) < 1) {
                    circle.attr('stroke-width', 3).attr('stroke', d => d.rank_color);
                }
            });
            viz.node.filter(d => d.id === clergyId).selectAll('circle').each(function (d) {
                const circle = d3.select(this);
                const r = parseFloat(circle.attr('r'));
                if (Math.abs(r - outerRadius) < 1) {
                    circle.attr('stroke-width', 6).attr('stroke', '#ffd700');
                }
            });
        }
    }

    function clearClergyHighlights() {
        document.querySelectorAll('.clergy-item-card').forEach(item => {
            item.classList.remove('selected');
        });
        if (window.editorVisualization) {
            const viz = window.editorVisualization;
            if (typeof viz.clearHighlights === 'function') {
                viz.clearHighlights();
            } else if (viz.node) {
                const outerRadius = window.OUTER_RADIUS || 28;
                viz.node.selectAll('circle').each(function (d) {
                    const circle = d3.select(this);
                    const r = parseFloat(circle.attr('r'));
                    if (Math.abs(r - outerRadius) < 1) {
                        circle.attr('stroke-width', 3).attr('stroke', d => d.rank_color);
                    }
                });
            }
        }
    }

    window.highlightClergyInList = highlightClergyInList;
    window.highlightClergyInVisualization = highlightClergyInVisualization;
    window.clearClergyHighlights = clearClergyHighlights;

    async function softRefreshVisualization() {
        if (!window.editorVisualization || !window.editorVisualization.isInitialized) {
            return;
        }
        try {
            const response = await fetch('/api/visualization/data');
            const data = await response.json();
            if (data.success && data.nodes && data.links) {
                window.editorVisualization.updateData(data.nodes, data.links);
                if (window.currentSelectedClergyId) {
                    setTimeout(() => {
                        highlightClergyInVisualization(window.currentSelectedClergyId);
                    }, 500);
                }
            }
        } catch (error) {
            if (window.EDITOR_DEBUG) console.error('Error refreshing visualization:', error);
        }
    }

    window.selectClergy = selectClergy;
    window.clearGlobalFormState = clearGlobalFormState;
    window.getClergyFormSwapTarget = getClergyFormSwapTarget;
    window.softRefreshVisualization = softRefreshVisualization;

    function updateStatusBar() {
        fetch('/api/stats/clergy-count')
            .then(response => response.json())
            .then(data => {
                document.getElementById('clergy-count').textContent = data.count || 0;
            })
            .catch(() => {
                document.getElementById('clergy-count').textContent = '-';
            });

        fetch('/api/stats/records-count')
            .then(response => response.json())
            .then(data => {
                document.getElementById('records-count').textContent = data.count || 0;
            })
            .catch(() => {
                document.getElementById('records-count').textContent = '-';
            });

        fetch('/api/stats/db-status')
            .then(response => response.json())
            .then(data => {
                const statusDot = document.getElementById('db-status-dot');
                const statusText = document.getElementById('db-status-text');
                const statusTitle = document.getElementById('db-status-title');
                const statusDetails = document.getElementById('db-status-details');

                if (data.status === 'connected') {
                    statusDot.className = 'status-dot green';
                    statusText.textContent = 'Connected';
                    statusTitle.textContent = 'Database Connected';
                    statusDetails.textContent = data.details || 'All systems operational';
                } else if (data.status === 'warning') {
                    statusDot.className = 'status-dot orange';
                    statusText.textContent = 'Warning';
                    statusTitle.textContent = 'Database Warning';
                    statusDetails.textContent = data.details || 'Connection issues detected';
                } else {
                    statusDot.className = 'status-dot red';
                    statusText.textContent = 'Error';
                    statusTitle.textContent = 'Database Error';
                    statusDetails.textContent = data.details || 'Connection failed';
                }
            })
            .catch(() => {
                const statusDot = document.getElementById('db-status-dot');
                const statusText = document.getElementById('db-status-text');
                const statusTitle = document.getElementById('db-status-title');
                const statusDetails = document.getElementById('db-status-details');
                statusDot.className = 'status-dot red';
                statusText.textContent = 'Error';
                statusTitle.textContent = 'Database Error';
                statusDetails.textContent = 'Failed to check status';
            });
    }

    function refreshEditorAfterClergySave(clergyId) {
        const id = clergyId != null ? clergyId : window.currentSelectedClergyId;
        const leftPanelContent = document.querySelector('.left-panel .panel-content');
        const centerPanelContent = document.getElementById('visualization-panel-content');

        updateStatusBar();

        const listPromise = leftPanelContent && typeof htmx !== 'undefined'
            ? htmx.ajax('GET', '/editor/clergy-list', { target: leftPanelContent, swap: 'innerHTML' })
            : Promise.resolve();

        Promise.all([listPromise]).then(() => {
            const menuPromise = centerPanelContent && typeof htmx !== 'undefined'
                ? htmx.ajax('GET', '/editor/lineage-menu', { target: centerPanelContent, swap: 'innerHTML' })
                : Promise.resolve();
            return menuPromise;
        }).then(() => {
            window.__validationImpactGraphCache = undefined;
            window.__validationImpactRangesCache = undefined;
            if (typeof window.ValidationImpactPanel !== 'undefined' && typeof window.ValidationImpactPanel.init === 'function') {
                window.ValidationImpactPanel.init(id);
            }
            if (typeof window.softRefreshVisualization === 'function') {
                window.softRefreshVisualization();
            }
            if (id && typeof window.highlightClergyInList === 'function') {
                window.highlightClergyInList(id);
            }
            if (id && typeof window.highlightClergyInVisualization === 'function') {
                window.highlightClergyInVisualization(id);
            }
            const auditEl = document.getElementById('clergy-audit-logs-content');
            if (auditEl && auditEl.classList.contains('active') && typeof htmx !== 'undefined') {
                htmx.ajax('GET', '/editor/audit-logs', { target: '#clergy-audit-logs-content', swap: 'innerHTML' });
            }
        }).catch(err => { if (window.EDITOR_DEBUG) console.error('refreshEditorAfterClergySave:', err); });
    }
    window.refreshEditorAfterClergySave = refreshEditorAfterClergySave;

    document.addEventListener('DOMContentLoaded', function () {
        updateStatusBar();
        setInterval(updateStatusBar, 30000);

        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('clergySearchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
        });
    });

    // Modal management
    function openUserManagementModal() {
        const modal = document.getElementById('user-management-modal');
        const content = document.getElementById('user-management-content');
        modal.style.display = 'flex';
        content.innerHTML = '<div class="loading-placeholder"><div class="loading-spinner"></div>Loading user management...</div>';
        htmx.ajax('GET', '/editor/user-management', { target: content, swap: 'innerHTML' });
    }

    function closeUserManagementModal() {
        document.getElementById('user-management-modal').style.display = 'none';
    }

    window.openMetadataManagementModal = function () {
        const modal = document.getElementById('metadata-management-modal');
        const content = document.getElementById('metadata-management-content');
        modal.style.display = 'flex';
        content.innerHTML = '<div class="loading-placeholder"><div class="loading-spinner"></div>Loading metadata management...</div>';
        htmx.ajax('GET', '/editor/metadata-management', { target: content, swap: 'innerHTML' });
    };

    function closeMetadataManagementModal() {
        document.getElementById('metadata-management-modal').style.display = 'none';
    }

    function openCommentsManagementModal() {
        const modal = document.getElementById('comments-management-modal');
        const content = document.getElementById('comments-management-content');
        modal.style.display = 'flex';
        content.innerHTML = '<div class="loading-placeholder"><div class="loading-spinner"></div>Loading comments management...</div>';
        htmx.ajax('GET', '/editor/comments-management', { target: content, swap: 'innerHTML' });
    }

    function closeCommentsManagementModal() {
        document.getElementById('comments-management-modal').style.display = 'none';
    }

    function openAuditLogsModal() {
        const modal = document.getElementById('audit-logs-modal');
        const content = document.getElementById('audit-logs-content');
        modal.style.display = 'flex';
        content.innerHTML = '<div class="loading-placeholder"><div class="loading-spinner"></div>Loading audit logs...</div>';
        htmx.ajax('GET', '/editor/audit-logs-management', { target: content, swap: 'innerHTML' });
    }

    function closeAuditLogsModal() {
        document.getElementById('audit-logs-modal').style.display = 'none';
    }

    window.openUserManagementModal = openUserManagementModal;
    window.closeUserManagementModal = closeUserManagementModal;
    window.closeMetadataManagementModal = closeMetadataManagementModal;
    window.openCommentsManagementModal = openCommentsManagementModal;
    window.closeCommentsManagementModal = closeCommentsManagementModal;
    window.openAuditLogsModal = openAuditLogsModal;
    window.closeAuditLogsModal = closeAuditLogsModal;

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeUserManagementModal();
            closeMetadataManagementModal();
            closeCommentsManagementModal();
            closeAuditLogsModal();
        }
    });

    // Chapel list toggle
    let isChapelListVisible = false;
    let isGlobeViewVisible = false;

    function toggleChapelList() {
        const leftPanel = document.querySelector('.left-panel .panel-content');
        const centerPanel = document.querySelector('#visualization-panel-content');
        const rightPanel = document.querySelector('.right-panel .panel-content');
        const rightPanelHeader = document.querySelector('.right-panel .panel-header');

        if (!leftPanel || !centerPanel || !rightPanel) {
            return;
        }

        const panelHeader = document.querySelector('.left-panel .panel-header');
        const toggleButton = document.getElementById('chapelListToggle');

        if (!isChapelListVisible && !isGlobeViewVisible) {
            if (panelHeader) {
                panelHeader.innerHTML = '<i class="fas fa-church"></i> Chapel List';
            }
            if (rightPanelHeader) {
                rightPanelHeader.innerHTML = '<i class="fas fa-church"></i> Chapel Form';
            }
            if (toggleButton) {
                toggleButton.innerHTML = '<i class="fas fa-list"></i> Back to List';
                toggleButton.title = 'Return to Clergy List';
            }

            htmx.ajax('GET', '/editor/chapel-list', { target: leftPanel, swap: 'innerHTML' })
                .then(() => { isChapelListVisible = true; })
                .catch(err => { if (window.EDITOR_DEBUG) console.error('Error switching to chapel list:', err); });

            htmx.ajax('GET', '/editor/chapel-form', { target: rightPanel, swap: 'innerHTML' })
                .then(() => {
                    rightPanel.removeAttribute('hx-trigger');
                    rightPanel.removeAttribute('hx-get');
                    setTimeout(function () {
                        if (typeof initializeLocationForm === 'function') {
                            initializeLocationForm() || (typeof checkForLocationForms === 'function' && checkForLocationForms());
                        } else {
                            let retries = 0;
                            const maxRetries = 10;
                            const retryInterval = setInterval(function () {
                                retries++;
                                if (typeof initializeLocationForm === 'function') {
                                    if (initializeLocationForm() || (typeof checkForLocationForms === 'function' && checkForLocationForms())) {
                                        clearInterval(retryInterval);
                                    }
                                } else if (retries >= maxRetries) {
                                    clearInterval(retryInterval);
                                }
                            }, 100);
                        }
                    }, 500);
                })
                .catch(err => { if (window.EDITOR_DEBUG) console.error('Error switching to chapel form:', err); });

            htmx.ajax('GET', '/editor/globe-view', { target: centerPanel, swap: 'innerHTML' })
                .then(() => { isGlobeViewVisible = true; })
                .catch(err => { if (window.EDITOR_DEBUG) console.error('Error switching to globe view:', err); });
        } else {
            if (panelHeader) {
                panelHeader.innerHTML = '<i class="fas fa-users"></i> Clergy List';
            }
            if (rightPanelHeader) {
                rightPanelHeader.innerHTML = '<i class="fas fa-edit"></i> Clergy Form';
            }
            if (toggleButton) {
                toggleButton.innerHTML = '<i class="fas fa-church"></i> Chapel';
                toggleButton.title = 'Toggle Chapel List';
            }

            htmx.ajax('GET', '/editor/clergy-list', { target: leftPanel, swap: 'innerHTML' })
                .then(() => { isChapelListVisible = false; })
                .catch(err => { if (window.EDITOR_DEBUG) console.error('Error switching back to clergy list:', err); });

            htmx.ajax('GET', '/editor/clergy-form', { target: rightPanel, swap: 'innerHTML' })
                .then(() => {
                    rightPanel.setAttribute('hx-trigger', 'load');
                    rightPanel.setAttribute('hx-get', '/editor/clergy-form');
                })
                .catch(err => { if (window.EDITOR_DEBUG) console.error('Error switching back to clergy form:', err); });

            htmx.ajax('GET', '/editor/lineage-menu', { target: centerPanel, swap: 'innerHTML' })
                .then(() => { isGlobeViewVisible = false; })
                .catch(err => { if (window.EDITOR_DEBUG) console.error('Error switching back to lineage menu:', err); });
        }
    }
    window.toggleChapelList = toggleChapelList;
})();
