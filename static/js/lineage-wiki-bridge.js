// Lightweight bridge between the lineage table and the wiki/clergy APIs.

(function () {
    if (typeof window === 'undefined') return;

    document.addEventListener('DOMContentLoaded', () => {
        const tableWrap = document.querySelector('.lineage-table-wrap');
        const bodyEl = document.getElementById('lineage-wiki-body');
        const asideEl = document.getElementById('lineage-wiki-aside');

        if (!tableWrap || !bodyEl || !asideEl) return;

        let activeRow = null;
        let activeClergyId = null;
        let activeClergyName = null;

        tableWrap.addEventListener('click', (event) => {
            const link = event.target.closest('.lineage-menu-link');
            if (!link) return;
            event.preventDefault();

            const clergyId = link.dataset.clergyId;
            const clergyName = link.dataset.clergyName || link.textContent.trim();

            if (!clergyId && !clergyName) return;

            activeClergyId = clergyId || null;
            activeClergyName = clergyName || null;

            const row = link.closest('tr');
            if (activeRow && activeRow !== row) {
                activeRow.classList.remove('lineage-row-active');
            }
            if (row) {
                row.classList.add('lineage-row-active');
                activeRow = row;
            }

            loadClergyContext(clergyId, clergyName);
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
                return `This wiki page has been requested ${demand} ${timesLabel} and is ${formatOrdinal(queuePosition)} in the queue.`;
            }

            if (hasDemand) {
                const timesLabel = demand === 1 ? 'time' : 'times';
                return `This wiki page has been requested ${demand} ${timesLabel}.`;
            }

            if (hasPosition) {
                return `This wiki page is currently ${formatOrdinal(queuePosition)} in the request queue.`;
            }

            return 'You have requested this wiki page; status is temporarily unavailable.';
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

        function renderEmptyWiki() {
            bodyEl.innerHTML = '' +
                '<div class="lineage-wiki-empty">' +
                '  <p>No wiki article is available for this clergy yet.</p>' +
                '  <button type="button" class="lineage-wiki-request-btn" disabled>Request article</button>' +
                '  <div class="lineage-wiki-request-message" aria-live="polite"></div>' +
                '</div>';
            wireRequestButton();
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
                    bodyEl.innerHTML = '<pre class="lineage-wiki-fallback">' + String(markdown || '') + '</pre>';
                    return;
                }
                const html = renderer.render(markdown, { pages: {} });
                bodyEl.innerHTML = '<div class="wiki-article fade-in">' + html + '</div>';
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
                asideEl.innerHTML = '<div class="lineage-wiki-aside-placeholder">Wiki aside content will appear here.</div>';
                return;
            }
            try {
                const res = await fetch(`/api/wiki/clergy/${clergyId}/profile`);
                if (!res.ok) {
                    asideEl.innerHTML = '<div class="lineage-wiki-aside-placeholder">Profile unavailable.</div>';
                    return;
                }
                const p = await res.json();
                const yob = p.date_of_birth ? p.date_of_birth.split('-')[0] : null;
                const yod = p.date_of_death ? p.date_of_death.split('-')[0] : null;
                const datesStr = yob ? `b. ${yob} - ${yod ? 'd. ' + yod : 'present'}` : (yod ? 'd. ' + yod : '');

                let html = `
                    <div class="wiki-profile-name">${esc(p.name)}</div>
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

