(function () {
    const DROPDOWN_LIMIT = 8;

    function parseDatasetJSON(root, key) {
        if (!root || !root.dataset || !root.dataset[key]) {
            return [];
        }
        try {
            return JSON.parse(root.dataset[key]);
        } catch (error) {
            console.warn(`Failed to parse data-${key}:`, error);
            return [];
        }
    }

    function renderMarkdownNotes(container) {
        const targets = (container || document).querySelectorAll('.event-notes-markdown');
        if (!targets.length) {
            return;
        }
        targets.forEach(target => {
            const raw = target.dataset.markdown || '';
            if (!raw.trim()) {
                target.innerHTML = '<span style="opacity: 0.6;">No additional details</span>';
                return;
            }
            if (window.marked) {
                target.innerHTML = window.marked.parse(raw, {
                    mangle: false,
                    headerIds: false,
                    breaks: true
                });
            } else {
                // Minimal fallback: escape HTML and replace newlines
                const escaped = raw
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>');
                target.innerHTML = escaped;
            }
        });
    }

    function formatClergyLabel(item) {
        if (!item) {
            return '';
        }
        const fragments = [item.name];
        if (item.rank) {
            fragments.push(item.rank);
        }
        if (item.organization) {
            fragments.push(item.organization);
        }
        return fragments.filter(Boolean).join(' • ');
    }

    function initEventsPanel(panelRoot) {
        if (!panelRoot || panelRoot.dataset.eventsInitialized === 'true') {
            return;
        }

        const clergyData = parseDatasetJSON(panelRoot, 'clergy');
        const eventTypeOptions = parseDatasetJSON(panelRoot, 'eventTypes');
        const form = panelRoot.querySelector('#clergy-event-form');
        const clergyInput = panelRoot.querySelector('#clergySearchInput');
        const clergyHidden = panelRoot.querySelector('#eventClergyId');
        const clergyDropdown = panelRoot.querySelector('#clergySearchDropdown');
        const eventTypeInput = panelRoot.querySelector('#eventTypeInput');
        const eventTypeDropdown = panelRoot.querySelector('#eventTypeDropdown');
        const startDateInput = panelRoot.querySelector('#eventStartDate');
        const endDateInput = panelRoot.querySelector('#eventEndDate');
        const startYearInput = panelRoot.querySelector('#eventStartYear');
        const endYearInput = panelRoot.querySelector('#eventEndYear');
        const tableContainer = panelRoot.querySelector('#clergy-events-table');
        const messageBox = panelRoot.querySelector('#events-message');
        const refreshButton = panelRoot.querySelector('#refreshEventsButton');
        const rangeWarning = panelRoot.querySelector('#eventRangeWarning');
        const selectedFromDataset = panelRoot.dataset.selectedClergyId;
        const selectedName = panelRoot.dataset.selectedClergyName;

        if (!clergyHidden.value && selectedFromDataset) {
            clergyHidden.value = selectedFromDataset;
        }
        if (!clergyInput.value && selectedName) {
            clergyInput.value = selectedName;
        }

        const normalizedEventTypes = eventTypeOptions.filter(Boolean).map(type => type.trim()).filter(Boolean);

        const showMessage = (text, type = 'info', timeout = 5000) => {
            if (!messageBox) {
                return;
            }
            if (!text) {
                messageBox.style.display = 'none';
                messageBox.textContent = '';
                messageBox.style.border = 'none';
                return;
            }
            const palette = {
                success: { bg: 'rgba(76, 175, 80, 0.15)', border: '1px solid rgba(76, 175, 80, 0.4)', color: '#ecf9ec' },
                error: { bg: 'rgba(244, 67, 54, 0.15)', border: '1px solid rgba(244, 67, 54, 0.4)', color: '#ffeaea' },
                warning: { bg: 'rgba(241, 196, 15, 0.15)', border: '1px solid rgba(241, 196, 15, 0.4)', color: '#fff7d6' },
                info: { bg: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#f0f0f0' }
            };
            const colors = palette[type] || palette.info;
            messageBox.textContent = text;
            messageBox.style.background = colors.bg;
            messageBox.style.border = colors.border;
            messageBox.style.color = colors.color;
            messageBox.style.display = 'block';
            if (timeout) {
                setTimeout(() => {
                    if (messageBox.textContent === text) {
                        showMessage('');
                    }
                }, timeout);
            }
        };

        const setFormBusy = (isBusy) => {
            if (!form) {
                return;
            }
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = isBusy;
                if (isBusy) {
                    submitButton.dataset.originalLabel = submitButton.dataset.originalLabel || submitButton.innerHTML;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.35em;"></i>Saving...';
                } else if (submitButton.dataset.originalLabel) {
                    submitButton.innerHTML = submitButton.dataset.originalLabel;
                }
            }
        };

        const validateRange = () => {
            if (!rangeWarning) {
                return true;
            }
            let warningMsg = '';
            const startYear = startYearInput && startYearInput.value ? parseInt(startYearInput.value, 10) : null;
            const endYear = endYearInput && endYearInput.value ? parseInt(endYearInput.value, 10) : null;
            const startDate = startDateInput && startDateInput.value ? new Date(startDateInput.value) : null;
            const endDate = endDateInput && endDateInput.value ? new Date(endDateInput.value) : null;

            if (startYear && endYear && endYear < startYear) {
                warningMsg = 'End year cannot be before the start year.';
            } else if (startDate && endDate && endDate < startDate) {
                warningMsg = 'End date cannot be before the start date.';
            }

            if (warningMsg) {
                rangeWarning.textContent = warningMsg;
                rangeWarning.style.display = 'inline';
                return false;
            }
            rangeWarning.textContent = '';
            rangeWarning.style.display = 'none';
            return true;
        };

        const attachClergyAutocomplete = () => {
            if (!clergyInput || !clergyDropdown) {
                return;
            }
            clergyInput.setAttribute('autocomplete', 'off');
            clergyInput.addEventListener('input', () => {
                const query = clergyInput.value.trim();
                clergyDropdown.innerHTML = '';
                if (!query) {
                    clergyDropdown.style.display = 'none';
                    if (clergyHidden) clergyHidden.value = '';
                    return;
                }
                const results = (window.fuzzySearch ? window.fuzzySearch(clergyData, query, item => item.name) : [])
                    .slice(0, DROPDOWN_LIMIT);
                if (!results.length) {
                    clergyDropdown.style.display = 'none';
                    return;
                }
                results.forEach(result => {
                    const item = result.item;
                    const option = document.createElement('div');
                    option.className = 'autocomplete-item';
                    option.style.padding = '0.45em 0.6em';
                    option.style.cursor = 'pointer';
                    option.innerHTML = `<strong>${item.name}</strong><br><span style="font-size:0.75em; color:rgba(0,0,0,0.6);">${item.rank || '—'}${item.organization ? ' • ' + item.organization : ''}</span>`;
                    option.addEventListener('mousedown', (event) => {
                        event.preventDefault();
                        if (clergyHidden) clergyHidden.value = item.id;
                        clergyInput.value = item.name;
                        clergyDropdown.style.display = 'none';
                        if (typeof window.selectClergy === 'function') {
                            window.selectClergy(item.id);
                        }
                        loadEvents(item.id);
                    });
                    clergyDropdown.appendChild(option);
                });
                clergyDropdown.style.display = 'block';
            });
            clergyInput.addEventListener('focus', () => {
                if (clergyInput.value.trim()) {
                    clergyInput.dispatchEvent(new Event('input'));
                }
            });
            clergyInput.addEventListener('blur', () => {
                setTimeout(() => (clergyDropdown.style.display = 'none'), 150);
            });
        };

        const attachEventTypeAutocomplete = () => {
            if (!eventTypeInput || !eventTypeDropdown) {
                return;
            }
            eventTypeInput.setAttribute('autocomplete', 'off');
            eventTypeInput.addEventListener('input', () => {
                const query = eventTypeInput.value.trim();
                eventTypeDropdown.innerHTML = '';
                if (!query) {
                    eventTypeDropdown.style.display = 'none';
                    return;
                }
                const matches = normalizedEventTypes
                    .filter(type => type.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, DROPDOWN_LIMIT);

                matches.forEach(type => {
                    const option = document.createElement('div');
                    option.className = 'autocomplete-item';
                    option.style.padding = '0.4em 0.6em';
                    option.style.cursor = 'pointer';
                    option.textContent = type;
                    option.addEventListener('mousedown', (event) => {
                        event.preventDefault();
                        eventTypeInput.value = type;
                        eventTypeDropdown.style.display = 'none';
                    });
                    eventTypeDropdown.appendChild(option);
                });

                if (!matches.length) {
                    const addOption = document.createElement('div');
                    addOption.className = 'autocomplete-item';
                    addOption.style.padding = '0.4em 0.6em';
                    addOption.style.cursor = 'pointer';
                    addOption.innerHTML = `<i class="fas fa-plus-circle" style="margin-right:0.35em;"></i>Add "${query}"`;
                    addOption.addEventListener('mousedown', (event) => {
                        event.preventDefault();
                        if (!normalizedEventTypes.includes(query)) {
                            normalizedEventTypes.push(query);
                        }
                        eventTypeInput.value = query;
                        eventTypeDropdown.style.display = 'none';
                    });
                    eventTypeDropdown.appendChild(addOption);
                }

                eventTypeDropdown.style.display = 'block';
            });
            eventTypeInput.addEventListener('blur', () => {
                setTimeout(() => (eventTypeDropdown.style.display = 'none'), 150);
            });
        };

        const loadEvents = async (clergyId, silent = false) => {
            if (!clergyId || !tableContainer) {
                return;
            }
            if (!silent) {
                tableContainer.innerHTML = `
                    <div style="padding: 1em; text-align: center; color: rgba(255, 255, 255, 0.6);">
                        <div class="loading-spinner" style="margin: 0 auto 0.5em;"></div>
                        Loading events...
                    </div>
                `;
            }
            try {
                const response = await fetch(`/editor/events/${clergyId}/table`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                if (!response.ok) {
                    throw new Error('Unable to load events.');
                }
                const html = await response.text();
                tableContainer.innerHTML = html;
                renderMarkdownNotes(tableContainer);
            } catch (error) {
                console.error(error);
                showMessage(error.message, 'error');
            }
        };

        const handleClergySelectionEvent = (clergyId) => {
            if (!clergyId) {
                return;
            }
            if (clergyHidden) {
                clergyHidden.value = clergyId;
            }
            const knownClergy = clergyData.find(c => String(c.id) === String(clergyId));
            if (knownClergy && clergyInput) {
                clergyInput.value = knownClergy.name;
            } else if (clergyInput) {
                const domNode = document.querySelector(`.clergy-item[data-clergy-id="${clergyId}"]`);
                if (domNode) {
                    const label = domNode.dataset.name || domNode.querySelector('.clergy-name')?.textContent;
                    clergyInput.value = label || clergyInput.value;
                }
            }
            loadEvents(clergyId);
        };

        if (document.body) {
            document.body.addEventListener('clergySeleced', (event) => {
                const clergyId = event.detail ? event.detail.clergyId : null;
                handleClergySelectionEvent(clergyId);
            });
        }

        const syncYearFromDate = (dateInput, yearInput) => {
            if (!dateInput || !yearInput) {
                return;
            }
            dateInput.addEventListener('change', () => {
                if (dateInput.value) {
                    const year = dateInput.value.split('-')[0];
                    if (!yearInput.value) {
                        yearInput.value = year;
                    }
                }
                validateRange();
            });
        };

        if (startDateInput && startYearInput) {
            syncYearFromDate(startDateInput, startYearInput);
        }
        if (endDateInput && endYearInput) {
            syncYearFromDate(endDateInput, endYearInput);
        }
        if (startYearInput) startYearInput.addEventListener('input', validateRange);
        if (endYearInput) endYearInput.addEventListener('input', validateRange);

        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                if (clergyHidden && clergyHidden.value) {
                    showMessage('Refreshing events...', 'info', 2000);
                    loadEvents(clergyHidden.value, true);
                } else {
                    showMessage('Select a clergy member first.', 'warning', 3000);
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!clergyHidden || !clergyHidden.value) {
                    showMessage('Please select a clergy member first.', 'error');
                    return;
                }
                if (!validateRange()) {
                    showMessage('Fix the date or year range before saving.', 'error');
                    return;
                }
                const formData = new FormData(form);
                formData.set('clergy_id', clergyHidden.value);
                setFormBusy(true);
                showMessage('');
                try {
                    const response = await fetch(form.action || '/editor/events/add', {
                        method: 'POST',
                        body: formData,
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    const payload = await response.json();
                    if (!response.ok || !payload.success) {
                        throw new Error(payload.message || 'Unable to save event.');
                    }
                    const currentClergy = clergyHidden.value;
                    form.reset();
                    clergyHidden.value = currentClergy;
                    if (clergyInput && currentClergy) {
                        const knownClergy = clergyData.find(c => String(c.id) === String(currentClergy));
                        clergyInput.value = knownClergy ? knownClergy.name : clergyInput.value;
                    }
                    showMessage(payload.message || 'Event saved successfully.', 'success');
                    if (window.showNotification) {
                        window.showNotification(payload.message || 'Event saved.', 'success');
                    }
                    if (eventTypeInput && eventTypeInput.value) {
                        const trimmedType = eventTypeInput.value.trim();
                        if (trimmedType && !normalizedEventTypes.includes(trimmedType)) {
                            normalizedEventTypes.push(trimmedType);
                        }
                    }
                    loadEvents(currentClergy, true);
                } catch (error) {
                    console.error(error);
                    showMessage(error.message, 'error');
                } finally {
                    setFormBusy(false);
                }
            });
        }

        attachClergyAutocomplete();
        attachEventTypeAutocomplete();
        renderMarkdownNotes(tableContainer);
        panelRoot.dataset.eventsInitialized = 'true';
    }

    const tryInit = () => {
        const panelRoot = document.querySelector('#events-content #clergyEventsPanel');
        if (panelRoot) {
            initEventsPanel(panelRoot);
        }
    };

    document.addEventListener('DOMContentLoaded', tryInit);
    document.body.addEventListener('htmx:afterSwap', (event) => {
        if (event.target && event.target.id === 'events-content') {
            tryInit();
        }
    });
})();
