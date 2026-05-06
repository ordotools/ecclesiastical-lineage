// Lightweight bridge between the lineage table and the wiki/clergy APIs.

(function () {
    if (typeof window === 'undefined') return;

    document.addEventListener('DOMContentLoaded', () => {
        const layout = document.querySelector('.lineage-wiki-layout');
        const bodyEl = document.getElementById('lineage-wiki-body');
        const asideEl = document.getElementById('lineage-wiki-aside');
        const searchInput = document.getElementById('lineage-search-input');
        const suggestionsEl = document.getElementById('lineage-search-suggestions');
        const searchShellEl = searchInput.closest('.lineage-search-shell') || suggestionsEl.closest('.lineage-search-shell');
        const backBtn = document.getElementById('lineage-back-to-menu-btn');

        if (!bodyEl || !asideEl || !searchInput || !suggestionsEl) return;

        const mobileQuery = window.matchMedia('(max-width: 768px)');
        function showContentView() {
            if (layout) layout.classList.add('mobile-view-content');
        }
        function showMenuView() {
            if (layout) layout.classList.remove('mobile-view-content');
        }
        if (backBtn) {
            backBtn.addEventListener('click', () => showMenuView());
        }

        let v2SearchFns = null;
        let clergyFuse = null;
        let currentSuggestions = [];
        let activeSuggestionIndex = -1;
        const suggestionLimit = 8;

        function setSearchShellOpen(isOpen) {
            if (!searchShellEl) return;
            searchShellEl.classList.toggle('is-open', !!isOpen);
        }

        function clearSuggestions() {
            currentSuggestions = [];
            activeSuggestionIndex = -1;
            suggestionsEl.innerHTML = '';
            suggestionsEl.setAttribute('aria-hidden', 'true');
            searchInput.setAttribute('aria-expanded', 'false');
            searchInput.removeAttribute('aria-activedescendant');
            setSearchShellOpen(false);
        }

        function setActiveSuggestionIndex(index) {
            if (!currentSuggestions.length) {
                activeSuggestionIndex = -1;
                searchInput.removeAttribute('aria-activedescendant');
                return;
            }

            const maxIndex = currentSuggestions.length - 1;
            const nextIndex = Math.max(0, Math.min(index, maxIndex));
            activeSuggestionIndex = nextIndex;

            const items = suggestionsEl.querySelectorAll('.lineage-search-suggestion-item');
            items.forEach((itemEl, itemIndex) => {
                const isActive = itemIndex === activeSuggestionIndex;
                itemEl.classList.toggle('active', isActive);
                itemEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
                if (isActive) {
                    searchInput.setAttribute('aria-activedescendant', itemEl.id);
                    itemEl.scrollIntoView({ block: 'nearest' });
                }
            });
        }

        function renderSuggestions(items) {
            currentSuggestions = Array.isArray(items) ? items : [];
            if (!currentSuggestions.length) {
                clearSuggestions();
                return;
            }

            suggestionsEl.innerHTML = currentSuggestions.map((item, index) => (
                `<button type="button" id="lineage-search-suggestion-${index}" class="lineage-search-suggestion-item" role="option" aria-selected="false" data-index="${index}">` +
                `<span class="lineage-search-suggestion-name">${esc(item.name || 'Unknown')}</span>` +
                `<span class="lineage-search-suggestion-meta">${esc([item.rank, item.organization].filter(Boolean).join(' · '))}</span>` +
                '</button>'
            )).join('');
            suggestionsEl.setAttribute('aria-hidden', 'false');
            searchInput.setAttribute('aria-expanded', 'true');
            setSearchShellOpen(true);
            setActiveSuggestionIndex(0);
        }

        async function loadSearchFns() {
            if (v2SearchFns) return v2SearchFns;
            try {
                const mod = await import('/static/js/fuzzySearchV2.js');
                if (
                    mod &&
                    typeof mod.createClergyFuseIndex === 'function' &&
                    typeof mod.searchClergy === 'function'
                ) {
                    v2SearchFns = mod;
                    return v2SearchFns;
                }
            } catch (err) {
                console.error('Failed to load fuzzySearchV2.js', err);
            }
            v2SearchFns = null;
            return null;
        }

        async function loadClergySearchIndex() {
            if (clergyFuse) return clergyFuse;
            const fns = await loadSearchFns();
            if (!fns) return null;
            try {
                const res = await fetch('/api/wiki/all-clergy');
                if (!res.ok) return null;
                const payload = await res.json();
                const clergyList = Array.isArray(payload) ? payload : [];
                const built = fns.createClergyFuseIndex(clergyList);
                clergyFuse = built && built.fuse ? built.fuse : null;
                return clergyFuse;
            } catch (err) {
                console.error('Failed to load clergy search list', err);
                return null;
            }
        }

        async function getSuggestions(query) {
            const trimmed = String(query || '').trim();
            if (!trimmed) return [];

            const fns = await loadSearchFns();
            if (fns) {
                const fuse = await loadClergySearchIndex();
                if (fuse) {
                    return fns.searchClergy(fuse, trimmed, suggestionLimit) || [];
                }
            }

            return [];
        }

        async function updateSuggestionsFromInput() {
            const query = searchInput.value.trim();
            if (!query) {
                clearSuggestions();
                return;
            }
            const suggestions = await getSuggestions(query);
            renderSuggestions(suggestions);
        }

        searchInput.addEventListener('input', () => {
            updateSuggestionsFromInput();
        });
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) updateSuggestionsFromInput();
        });

        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });

        let activeClergyId = null;
        let activeClergyName = null;
        let activeClergyProfile = null;
        let activeWikiState = { kind: 'empty' };

        function openSelectedClergy(item) {
            if (!item) return;
            const clergyId = item.id ? String(item.id) : null;
            const clergyName = item.name ? String(item.name) : null;
            if (!clergyId && !clergyName) return;
            activeClergyId = clergyId;
            activeClergyName = clergyName;
            if (clergyName) {
                searchInput.value = clergyName;
            }
            clearSuggestions();
            searchInput.blur();
            if (mobileQuery.matches) showContentView();
            loadClergyContext(clergyId, clergyName);
        }

        searchInput.addEventListener('keydown', async (event) => {
            if (event.key === 'Escape') {
                clearSuggestions();
                return;
            }

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!currentSuggestions.length) {
                    const suggestions = await getSuggestions(searchInput.value);
                    renderSuggestions(suggestions);
                    return;
                }
                const nextIndex = event.key === 'ArrowDown'
                    ? (activeSuggestionIndex + 1) % currentSuggestions.length
                    : activeSuggestionIndex <= 0
                    ? currentSuggestions.length - 1
                    : activeSuggestionIndex - 1;
                setActiveSuggestionIndex(nextIndex);
                return;
            }

            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (!currentSuggestions.length) {
                const suggestions = await getSuggestions(searchInput.value);
                if (suggestions.length) {
                    openSelectedClergy(suggestions[0]);
                }
                return;
            }
            const selectedIndex = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
            openSelectedClergy(currentSuggestions[selectedIndex]);
        });

        suggestionsEl.addEventListener('click', (event) => {
            const btn = event.target.closest('.lineage-search-suggestion-item');
            if (!btn) return;
            const index = Number(btn.getAttribute('data-index'));
            if (!Number.isInteger(index) || index < 0 || index >= currentSuggestions.length) return;
            openSelectedClergy(currentSuggestions[index]);
        });

        document.addEventListener('click', (event) => {
            if (event.target === searchInput || suggestionsEl.contains(event.target)) return;
            clearSuggestions();
        });

        // Intercept wiki internal links within the embedded wiki body so navigation
        // happens in-place without leaving the lineage+wiki view.
        bodyEl.addEventListener('click', (event) => {
            const link = event.target.closest('.wiki-link');
            if (!link) return;
            event.preventDefault();

            const target = link.getAttribute('data-target');
            if (!target) {
                console.warn('wiki-link clicked without data-target; ignoring.');
                return;
            }

            loadWikiPageFromTarget(target);
        });

        function setBodyLoading(isLoading) {
            bodyEl.classList.toggle('loading', !!isLoading);
            if (isLoading) {
                bodyEl.innerHTML = '<div class="lineage-wiki-loading">Loading…</div>';
            }
        }

        function formatOrdinal(n) {
            const num = Number(n);
            if (!Number.isFinite(num)) return String(n);
            const s = ['th', 'st', 'nd', 'rd'];
            const v = num % 100;
            const suffix = s[(v - 20) % 10] || s[v] || s[0];
            return `${num}${suffix}`;
        }

        function formatRequestStatusMessage(demand, queuePosition) {
            const hasDemand = typeof demand === 'number' && !Number.isNaN(demand);
            const hasPosition = typeof queuePosition === 'number' && !Number.isNaN(queuePosition);

            if (hasDemand && hasPosition) {
                const timesLabel = demand === 1 ? 'time' : 'times';
                return `This article has been requested ${demand} ${timesLabel} and is ${formatOrdinal(queuePosition)} in the queue.`;
            }

            if (hasDemand) {
                const timesLabel = demand === 1 ? 'time' : 'times';
                return `This article has been requested ${demand} ${timesLabel}.`;
            }

            if (hasPosition) {
                return `This article is currently ${formatOrdinal(queuePosition)} in the request queue.`;
            }

            return 'You have requested this article; status is temporarily unavailable.';
        }

        async function populateRequestStatus(helper, clergyId, msgEl, options) {
            const opts = options || {};
            if (!helper || !msgEl || !clergyId) {
                return;
            }

            let demandFromResult;
            if (opts && typeof opts.demand === 'number') {
                demandFromResult = opts.demand;
            } else if (opts && opts.result && typeof opts.result.demand === 'number') {
                demandFromResult = opts.result.demand;
            }

            const hasGetStatus = typeof helper.getStatus === 'function';
            if (hasGetStatus) {
                try {
                    const status = await helper.getStatus(clergyId);
                    if (status && status.ok) {
                        const demand = typeof status.demand === 'number' ? status.demand : demandFromResult;
                        const queuePosition = typeof status.queuePosition === 'number' ? status.queuePosition : undefined;
                        msgEl.textContent = formatRequestStatusMessage(demand, queuePosition);
                        return;
                    }
                } catch (err) {
                    console.error('Failed to fetch wiki article request status', err);
                    // Fall through to local fallback below.
                }
            }

            const fallbackDemand = typeof demandFromResult === 'number' ? demandFromResult : undefined;
            msgEl.textContent = formatRequestStatusMessage(fallbackDemand, undefined);
        }

        function renderHeadingAndTags() {
            const headingName = (activeClergyProfile && activeClergyProfile.name) || activeClergyName || '';
            if (!headingName) return '';

            const tags = Array.isArray(activeClergyProfile?.tags) ? activeClergyProfile.tags : [];
            const tagsHtml = tags.length
                ? `<div class="lineage-wiki-heading-tags">${tags.map((tag) => {
                    if (!tag || !tag.label) return '';
                    const style = tag.color_hex ? ` style="--lineage-tag-color:${esc(tag.color_hex)}"` : '';
                    const systemClass = tag.is_system ? ' lineage-wiki-tag-system' : '';
                    return `<span class="lineage-wiki-tag${systemClass}"${style}>${esc(tag.label)}</span>`;
                }).join('')}</div>`
                : '';

            return '' +
                '<header class="lineage-wiki-heading-block">' +
                `  <h1>${esc(headingName)}</h1>` +
                `  ${tagsHtml}` +
                '</header>';
        }

        function renderBodyFromState() {
            const headingHtml = renderHeadingAndTags();
            if (activeWikiState.kind === 'content') {
                bodyEl.innerHTML = `${headingHtml}<div class="wiki-article fade-in">${activeWikiState.html}</div>`;
                return;
            }

            bodyEl.innerHTML = '' +
                headingHtml +
                '<div class="lineage-wiki-empty">' +
                '  <p>No article available.</p>' +
                '  <button type="button" class="lineage-wiki-request-btn" disabled>Request article</button>' +
                '  <div class="lineage-wiki-request-message" aria-live="polite"></div>' +
                '</div>';
            wireRequestButton();
        }

        function renderEmptyWiki() {
            activeWikiState = { kind: 'empty' };
            renderBodyFromState();
        }

        function wireRequestButton() {
            const btn = bodyEl.querySelector('.lineage-wiki-request-btn');
            const msgEl = bodyEl.querySelector('.lineage-wiki-request-message');

            if (!msgEl) return;

            const helper = window.WikiArticleRequests;
            const clergyId = activeClergyId;

            if (!helper || typeof helper.requestArticle !== 'function' || !clergyId) {
                if (btn) {
                    btn.disabled = true;
                }
                return;
            }

            const alreadyRequested = typeof helper.hasRequested === 'function' && helper.hasRequested(clergyId);

            if (alreadyRequested) {
                if (btn) {
                    btn.remove();
                }
                populateRequestStatus(helper, clergyId, msgEl, {});
                return;
            }

            if (!btn) {
                // No button in the DOM, but we haven't requested from this browser.
                // Leave the status area empty for now.
                msgEl.textContent = '';
                return;
            }

            btn.disabled = false;
            msgEl.textContent = '';

            btn.addEventListener('click', async () => {
                if (!helper || typeof helper.requestArticle !== 'function') {
                    return;
                }

                btn.disabled = true;
                msgEl.textContent = 'Requesting article…';

                try {
                    const result = await helper.requestArticle(clergyId);

                    if (result && result.duplicate) {
                        if (btn) {
                            btn.remove();
                        }
                        await populateRequestStatus(helper, clergyId, msgEl, { result });
                        return;
                    }

                    if (result && result.ok) {
                        if (btn) {
                            btn.remove();
                        }
                        await populateRequestStatus(helper, clergyId, msgEl, { result });
                    } else {
                        msgEl.textContent = 'Sorry, we could not record your request. Please try again later.';
                        btn.disabled = false;
                    }
                } catch (err) {
                    console.error('Error while requesting wiki article', err);
                    msgEl.textContent = 'Sorry, we could not record your request. Please try again later.';
                    btn.disabled = false;
                }
            });
        }

        function renderWikiBodyFromContent(markdown) {
            try {
                const RendererCtor = window.WikiRenderer;
                const renderer = window.wikiRenderer || (RendererCtor ? new RendererCtor() : null);
                if (!renderer) {
                    // Fallback: plain preformatted block
                    activeWikiState = { kind: 'content', html: '<pre class="lineage-wiki-fallback">' + String(markdown || '') + '</pre>' };
                    renderBodyFromState();
                    return;
                }
                const html = renderer.render(markdown, { pages: {} });
                activeWikiState = { kind: 'content', html };
                renderBodyFromState();
            } catch (err) {
                console.error('Failed to render wiki content', err);
                renderEmptyWiki();
            }
        }

        async function loadWikiPage(clergyName) {
            if (!clergyName) {
                renderEmptyWiki();
                return;
            }
            try {
                const slug = encodeURIComponent(clergyName);
                const res = await fetch(`/api/wiki/page/${slug}`);
                if (!res.ok) {
                    renderEmptyWiki();
                    return;
                }
                const data = await res.json();
                if (!data || !data.content) {
                    renderEmptyWiki();
                    return;
                }
                renderWikiBodyFromContent(data.content);
            } catch (err) {
                console.error('Failed to load wiki page', err);
                renderEmptyWiki();
            }
        }

        // Load a wiki page by its target slug (from data-target on .wiki-link),
        // updating both the wiki body and clergy aside context in-place.
        async function loadWikiPageFromTarget(target) {
            if (!target) {
                renderEmptyWiki();
                await loadClergyAside(null);
                return;
            }

            setBodyLoading(true);
            try {
                const res = await fetch(`/api/wiki/page/${encodeURIComponent(target)}`);
                if (!res.ok) {
                    renderEmptyWiki();
                    await loadClergyAside(null);
                    return;
                }

                const data = await res.json();
                activeClergyId = data && data.clergy_id ? String(data.clergy_id) : null;
                activeClergyName = data && data.title ? String(data.title) : (target ? String(target) : null);
                if (!data || !data.content) {
                    renderEmptyWiki();
                } else {
                    renderWikiBodyFromContent(data.content);
                }

                if (data && data.clergy_id) {
                    await loadClergyAside(data.clergy_id);
                } else {
                    await loadClergyAside(null);
                }
            } catch (err) {
                console.error('Failed to load wiki page for target', err);
                renderEmptyWiki();
                await loadClergyAside(null);
            } finally {
                setBodyLoading(false);
            }
        }

        function esc(s) {
            return String(s ?? '').replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function renderPersonLink(person) {
            if (!person) return esc('Unknown');
            if (person.wiki_slug || person.id || person.name) {
                const attrs = [];
                if (person.wiki_slug) {
                    attrs.push(`data-target="${esc(person.wiki_slug)}"`);
                }
                if (person.id != null) {
                    attrs.push(`data-clergy-id="${esc(person.id)}"`);
                }
                if (person.name) {
                    attrs.push(`data-clergy-name="${esc(person.name)}"`);
                }
                return `<button type="button" class="wiki-profile-link wiki-link" ${attrs.join(' ')}>${esc(person.name || 'Unknown')}</button>`;
            }
            return esc(person.name || 'Unknown');
        }

        async function loadClergyAside(clergyId) {
            if (!clergyId) {
                activeClergyProfile = null;
                renderBodyFromState();
                asideEl.innerHTML = '<div class="lineage-wiki-aside-placeholder">Wiki aside content will appear here.</div>';
                return;
            }
            try {
                const res = await fetch(`/api/wiki/clergy/${clergyId}/profile`);
                if (!res.ok) {
                    activeClergyProfile = null;
                    renderBodyFromState();
                    asideEl.innerHTML = '<div class="lineage-wiki-aside-placeholder">Profile unavailable.</div>';
                    return;
                }
                const p = await res.json();
                activeClergyProfile = p;
                renderBodyFromState();
                const yob = p.date_of_birth ? p.date_of_birth.split('-')[0] : null;
                const yod = p.date_of_death ? p.date_of_death.split('-')[0] : null;
                const datesStr = yob ? `b. ${yob} - ${yod ? 'd. ' + yod : 'present'}` : (yod ? 'd. ' + yod : '');

                let html = `
                    ${p.image_url ? `<img class="wiki-profile-image" src="${esc(p.image_url)}" alt="${esc(p.name)}" />` : ''}
                    ${(p.rank || p.organization) ? `<div class="wiki-profile-rank-org">${p.rank ? `<span class="wiki-profile-rank">${esc(p.rank)}</span>` : ''}${p.rank && p.organization ? ' · ' : ''}${p.organization ? `<span class="wiki-profile-org">${esc(p.organization)}</span>` : ''}</div>` : ''}
                    ${datesStr ? `<div class="wiki-profile-dates">${esc(datesStr)}</div>` : ''}
                `;

                if (p.ordinations?.length) {
                    html += `<div class="wiki-profile-section"><div class="wiki-profile-section-title">Ordination</div><ul class="wiki-profile-list">`;
                    p.ordinations.forEach(o => {
                        html += `<li>${esc(o.display_date)} — ${renderPersonLink(o.ordaining_bishop)}</li>`;
                    });
                    html += `</ul></div>`;
                }
                if (p.consecrations?.length) {
                    html += `<div class="wiki-profile-section"><div class="wiki-profile-section-title">Consecration</div><ul class="wiki-profile-list">`;
                    p.consecrations.forEach(c => {
                        html += `<li>${esc(c.display_date)} — ${renderPersonLink(c.consecrator)}</li>`;
                    });
                    html += `</ul></div>`;
                }
                if (p.ordained?.length) {
                    html += `<div class="wiki-profile-section"><div class="wiki-profile-section-title">Ordained</div><ul class="wiki-profile-list">`;
                    p.ordained.forEach(o => {
                        html += `<li>${esc(o.display_date)} — ${renderPersonLink(o.clergy)}</li>`;
                    });
                    html += `</ul></div>`;
                }
                if (p.consecrated?.length) {
                    html += `<div class="wiki-profile-section"><div class="wiki-profile-section-title">Consecrated</div><ul class="wiki-profile-list">`;
                    p.consecrated.forEach(c => {
                        html += `<li>${esc(c.display_date)} — ${renderPersonLink(c.clergy)}</li>`;
                    });
                    html += `</ul></div>`;
                }

                asideEl.innerHTML = html;
                asideEl.style.display = 'block';
                asideEl.querySelectorAll('.wiki-profile-link').forEach(btn => {
                    btn.addEventListener('click', (event) => {
                        event.preventDefault();
                        const clergyId = btn.getAttribute('data-clergy-id');
                        const clergyName = btn.getAttribute('data-clergy-name') || btn.textContent.trim();
                        if (!clergyId && !clergyName) {
                            console.warn('wiki-profile-link clicked without clergy id or name; ignoring.');
                            return;
                        }
                        activeClergyId = clergyId || null;
                        activeClergyName = clergyName || null;
                        loadClergyContext(clergyId, clergyName);
                    });
                });
            } catch (err) {
                console.error('Failed to fetch clergy profile', err);
                activeClergyProfile = null;
                renderBodyFromState();
                asideEl.innerHTML = '<div class="lineage-wiki-aside-placeholder">Profile unavailable.</div>';
            }
        }

        async function loadClergyContext(clergyId, clergyName) {
            setBodyLoading(true);
            try {
                await Promise.allSettled([
                    loadWikiPage(clergyName),
                    loadClergyAside(clergyId)
                ]);
            } finally {
                setBodyLoading(false);
            }
        }
    });
})();

