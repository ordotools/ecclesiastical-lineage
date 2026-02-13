/**
 * WikiRenderer - Modular wiki markdown rendering engine.
 * Extracted from wiki.js for swappability and future shortcode expansion.
 *
 * Usage:
 *   const html = (window.wikiRenderer || new WikiRenderer()).render(markdown, { pages: {} });
 * Override: window.wikiRenderer = new CustomRenderer();
 */
class WikiRenderer {
    /**
     * @param {string} markdown - Raw wiki markdown content
     * @param {object} options - { pages: { [title]: { ... } } } for link existence checks
     * @returns {string} HTML
     */
    render(markdown, options = {}) {
        if (!markdown) return '<div class="wiki-empty-state">Page does not exist yet. Click "Edit" to create it.</div>';
        const pages = options.pages || {};
        const clergySummaries = options.clergySummaries || {};
        const expanded = this.expandShortcodes(markdown, { clergySummaries });
        const { contentLines, definitions } = this.parseWikiText(expanded);
        const html = this.processLines(contentLines, definitions, pages);
        return html;
    }

    /**
     * Expand {{clergy:id}}, {{clergy:id:suffix}}, and {{lineage:id_or_name}} shortcodes.
     * Lineage shortcodes emit placeholder divs; initLineageCharts hydrates them client-side.
     * @param {string} text
     * @param {object} ctx - { clergySummaries: { [id]: {...} } }
     * @returns {string}
     */
    expandShortcodes(text, ctx = {}) {
        const summaries = ctx.clergySummaries || {};
        let out = text;
        out = out.replace(/\{\{lineage:([^}]+)\}\}/g, (match, ident) => {
            const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const safe = esc(ident.trim());
            const isNumeric = /^\d+$/.test(ident.trim());
            const attr = isNumeric ? `data-lineage-id="${safe}"` : `data-lineage-name="${safe}"`;
            return `<div class="wiki-lineage-chart-wrapper"><div class="wiki-lineage-chart" ${attr}></div></div>`;
        });
        out = out.replace(/\{\{clergy:(\d+)(?::(\w+))?\}\}/g, (match, id, suffix) => {
            const s = summaries[id];
            if (!s) return `<span class="wiki-clergy-unknown" title="Clergy #${id} not found">[clergy:${id}${suffix ? ':' + suffix : ''}]</span>`;
            const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            if (suffix === 'ordinations') {
                if (!s.ordinations || s.ordinations.length === 0) return `<span class="wiki-clergy-list">${esc(s.name)}: no ordinations</span>`;
                const items = s.ordinations.map(o => `<li>${esc(o.display_date)} — ${esc(o.ordaining_bishop_name || 'Unknown')}</li>`).join('');
                return `<span class="wiki-clergy-list"><strong>${esc(s.name)}</strong> <ul class="wiki-clergy-sublist">${items}</ul></span>`;
            }
            if (suffix === 'consecrations') {
                if (!s.consecrations || s.consecrations.length === 0) return `<span class="wiki-clergy-list">${esc(s.name)}: no consecrations</span>`;
                const items = s.consecrations.map(c => `<li>${esc(c.display_date)} — ${esc(c.consecrator_name || 'Unknown')}</li>`).join('');
                return `<span class="wiki-clergy-list"><strong>${esc(s.name)}</strong> <ul class="wiki-clergy-sublist">${items}</ul></span>`;
            }
            const parts = [esc(s.name)];
            if (s.rank) parts.push(esc(s.rank));
            if (s.organization) parts.push(esc(s.organization));
            const dates = [s.date_of_birth, s.date_of_death].filter(Boolean).map(d => d.split('-')[0]).join('–');
            if (dates) parts.push(`(${dates})`);
            return `<span class="wiki-clergy-summary" title="${esc(s.rank)}${s.organization ? ', ' + esc(s.organization) : ''}">${parts.join(', ')}</span>`;
        });
        return out;
    }

    parseWikiText(text) {
        if (!text) return { contentLines: [], definitions: {} };
        const lines = text.split('\n');
        const definitions = {};
        const contentLines = [];

        lines.forEach(line => {
            const citationMatch = line.match(/^\[\^(\d+)\]:\s*(.*)/);
            if (citationMatch) {
                definitions[citationMatch[1]] = citationMatch[2];
            } else {
                contentLines.push(line);
            }
        });

        return { contentLines, definitions };
    }

    /**
     * Parse ![alt](url) or ![alt](url "title") and return { alt, url, title } or null.
     */
    parseImage(match) {
        const full = match;
        const altMatch = full.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (!altMatch) return null;
        const alt = altMatch[1];
        const inner = altMatch[2];
        const titleMatch = inner.match(/^([^"]+?)\s+"([^"]*)"\s*$/);
        const url = titleMatch ? titleMatch[1].trim() : inner.trim();
        const title = titleMatch ? titleMatch[2] : null;
        return { alt, url, title };
    }

    /**
     * Render image as <figure> with optional <figcaption> when title present.
     * Images: ![alt](url) or ![alt](url "caption"). Use /static/wiki/img/filename.png or full URLs.
     */
    renderImage(alt, url, title) {
        const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const safeAlt = esc(alt);
        const safeUrl = esc(url);
        const safeTitle = esc(title || '');
        if (safeTitle) {
            return `<figure class="wiki-figure"><img src="${safeUrl}" alt="${safeAlt}" title="${safeTitle}" /><figcaption>${safeTitle}</figcaption></figure>`;
        }
        return `<figure class="wiki-figure"><img src="${safeUrl}" alt="${safeAlt}" /></figure>`;
    }

    processText(text, pages) {
        const parts = text.split(/(\[\[.*?\]\])|(\*{2}.*?\*{2})|(\[\^\d+\])|(!\[[^\]]*\]\([^)]+\))/g).filter(Boolean);

        return parts.map(part => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const raw = part.slice(2, -2);
                const [target, label] = raw.split('|');
                const displayLabel = label || target;
                const exists = !!pages[target];
                const className = exists ? 'wiki-link exists' : 'wiki-link';
                const title = exists ? `Go to ${target}` : 'Page does not exist yet';
                return `<button class="${className}" data-target="${target}" title="${title}">${displayLabel}</button>`;
            }
            if (part.startsWith('**') && part.endsWith('**')) {
                return `<strong>${part.slice(2, -2)}</strong>`;
            }
            if (part.match(/^\[\^\d+\]$/)) {
                const id = part.slice(2, -1);
                return `<sup class="wiki-cit-sup"><a href="#ref-${id}">[${id}]</a></sup>`;
            }
            const img = this.parseImage(part);
            if (img) return this.renderImage(img.alt, img.url, img.title);
            return part;
        }).join('');
    }

    processLines(contentLines, definitions, pages) {
        const processText = (t) => this.processText(t, pages);
        const imgBlockRe = /^\s*!\[[^\]]*\]\([^)]+\)\s*$/;
        const lineageBlockRe = /^\s*<div class="wiki-lineage-chart-wrapper"><div class="wiki-lineage-chart" data-lineage-(?:id|name)="[^"]*"><\/div><\/div>\s*$/;

        const renderedLines = contentLines.map(line => {
            if (line.startsWith('# ')) return `<h1>${processText(line.substring(2))}</h1>`;
            if (line.startsWith('## ')) return `<h2>${processText(line.substring(3))}</h2>`;
            if (line.startsWith('### ')) return `<h3>${processText(line.substring(4))}</h3>`;
            if (line.startsWith('- ')) return `<li>${processText(line.substring(2))}</li>`;
            if (line.trim() === '') return '<div style="height: 1rem;"></div>';
            if (imgBlockRe.test(line)) return processText(line.trim());
            if (lineageBlockRe.test(line)) return line.trim();
            return `<p>${processText(line)}</p>`;
        }).join('');

        let html = renderedLines;

        if (Object.keys(definitions).length > 0) {
            html += `<div class="wiki-references">
                <h3><i class="fas fa-book-open"></i> References</h3>
                <ol>
                    ${Object.entries(definitions).map(([id, text]) =>
                `<li id="ref-${id}">${text}</li>`
            ).join('')}
                </ol>
            </div>`;
        }

        return html;
    }
}

// Default instance; can be overridden: window.wikiRenderer = new CustomRenderer()
if (typeof window !== 'undefined') {
    window.WikiRenderer = WikiRenderer;
    window.wikiRenderer = window.wikiRenderer || new WikiRenderer();
}
