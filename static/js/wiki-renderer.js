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
        const defFirstRe = /^\[\^(\d+)\]:\s*(.*)/;
        const continuationRe = /^(    |\t)(.*)$/;
        const defLineRe = /^\[\^(\d+)\]:/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const defMatch = line.match(defFirstRe);
            if (defMatch) {
                if (!(defMatch[1] in definitions)) { // first-wins for duplicate defs
                    let content = defMatch[2] ?? '';
                    let j = i + 1;
                    while (j < lines.length) {
                        const cont = lines[j].match(continuationRe);
                        if (cont && !defLineRe.test(lines[j])) {
                            content += '\n' + lines[j];
                            j++;
                        } else {
                            break;
                        }
                    }
                    definitions[defMatch[1]] = content;
                }
                let k = i + 1;
                while (k < lines.length) {
                    const c = lines[k].match(continuationRe);
                    if (c && !defLineRe.test(lines[k])) k++;
                    else break;
                }
                i = k - 1;
            } else {
                contentLines.push(line);
            }
        }

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

    processText(text, pages, ctx = {}) {
        const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        if (!ctx.citeOccurrence) ctx.citeOccurrence = {};
        const parts = text.split(/(\[\[.*?\]\])|(\*{2}.*?\*{2})|(\*[^*]+?\*)|(\[\^\d+\])|(!\[[^\]]*\]\([^)]+\))|(\[[^\]]+\]\([^)]+\))|(~~.+?~~)|(`[^`]+`)/g).filter(Boolean);

        return parts.map(part => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const raw = part.slice(2, -2);
                const [target, label] = raw.split('|');
                const displayLabel = label || target;
                const exists = !!pages[target];
                const className = exists ? 'wiki-link exists' : 'wiki-link';
                const title = exists ? `Go to ${target}` : 'Page does not exist yet';
                return `<button class="${className}" data-target="${esc(target)}" title="${esc(title)}">${esc(displayLabel)}</button>`;
            }
            if (part.startsWith('**') && part.endsWith('**')) {
                return `<strong>${this.processText(part.slice(2, -2), pages, ctx)}</strong>`;
            }
            if (part.startsWith('*') && part.endsWith('*') && part.length > 1) {
                return `<em>${this.processText(part.slice(1, -1), pages, ctx)}</em>`;
            }
            if (part.startsWith('~~') && part.endsWith('~~')) {
                return `<del>${esc(part.slice(2, -2))}</del>`;
            }
            if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
                return `<code>${esc(part.slice(1, -1))}</code>`;
            }
            if (part.match(/^\[\^\d+\]$/)) {
                const id = part.slice(2, -1);
                const occ = ctx.citeOccurrence[id] ?? 0;
                ctx.citeOccurrence[id] = occ + 1;
                const citeId = `cite-${esc(id)}-${occ}`;
                return `<sup class="wiki-cit-sup"><a href="#ref-${esc(id)}" id="${citeId}" title="Jump to reference">[${esc(id)}]</a></sup>`;
            }
            const img = this.parseImage(part);
            if (img) return this.renderImage(img.alt, img.url, img.title);
            // External link [text](url)
            const extLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (extLink) {
                return `<a href="${esc(extLink[2])}" target="_blank" rel="noopener noreferrer">${this.processText(extLink[1], pages, ctx)}</a>`;
            }
            return part;
        }).join('');
    }

    processLines(contentLines, definitions, pages) {
        const ctx = { citeOccurrence: {} };
        const processText = (t, useCtx = true) => this.processText(t, pages, useCtx ? ctx : {});
        const imgBlockRe = /^\s*!\[[^\]]*\]\([^)]+\)\s*$/;
        const lineageBlockRe = /^\s*<div class="wiki-lineage-chart-wrapper"><div class="wiki-lineage-chart" data-lineage-(?:id|name)="[^"]*"><\/div><\/div>\s*$/;

        // Handle fenced code blocks (``` ... ```) before line-by-line processing
        let processed = contentLines;
        const codeBlockRe = /^```(\w*)\s*$/;
        let inCodeBlock = false;
        let codeBlockLang = '';
        let codeBlockLines = [];
        const outLines = [];

        for (let i = 0; i < processed.length; i++) {
            const line = processed[i];
            const cbMatch = line.match(codeBlockRe);
            if (cbMatch) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    codeBlockLang = cbMatch[1] || '';
                    codeBlockLines = [];
                } else {
                    const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    outLines.push(`<pre class="wiki-code-block"><code${codeBlockLang ? ` class="language-${codeBlockLang}"` : ''}>${esc(codeBlockLines.join('\n'))}</code></pre>`);
                    inCodeBlock = false;
                }
                continue;
            }
            if (inCodeBlock) {
                codeBlockLines.push(line);
                continue;
            }

            if (line.startsWith('# ')) { outLines.push(`<h1>${processText(line.substring(2))}</h1>`); continue; }
            if (line.startsWith('## ')) { outLines.push(`<h2>${processText(line.substring(3))}</h2>`); continue; }
            if (line.startsWith('### ')) { outLines.push(`<h3>${processText(line.substring(4))}</h3>`); continue; }
            if (line.startsWith('#### ')) { outLines.push(`<h4>${processText(line.substring(5))}</h4>`); continue; }
            if (line.startsWith('##### ')) { outLines.push(`<h5>${processText(line.substring(6))}</h5>`); continue; }
            if (line.startsWith('###### ')) { outLines.push(`<h6>${processText(line.substring(7))}</h6>`); continue; }
            if (line.startsWith('- ') || line.startsWith('* ')) { outLines.push(`<li>${processText(line.substring(2))}</li>`); continue; }
            if (/^\d+\.\s+/.test(line)) { outLines.push(`<li>${processText(line.replace(/^\d+\.\s+/, ''))}</li>`); continue; }
            if (line.trim() === '') { outLines.push('<div style="height: 1rem;"></div>'); continue; }
            if (/^-{3,}\s*$/.test(line.trim())) { outLines.push('<hr class="wiki-hr" />'); continue; }
            if (line.startsWith('> ')) { outLines.push(`<blockquote class="wiki-blockquote">${processText(line.substring(2))}</blockquote>`); continue; }
            if (imgBlockRe.test(line)) { outLines.push(processText(line.trim())); continue; }
            if (lineageBlockRe.test(line)) { outLines.push(line.trim()); continue; }
            outLines.push(`<p>${processText(line)}</p>`);
        }
        if (inCodeBlock) {
            const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            outLines.push(`<pre class="wiki-code-block"><code>${esc(codeBlockLines.join('\n'))}</code></pre>`);
        }

        let html = outLines.join('');

        if (Object.keys(definitions).length > 0) {
            const esc = x => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            html += `<div class="wiki-references">
                <h3><i class="fas fa-book-open"></i> References</h3>
                <ol>
                    ${Object.entries(definitions).map(([id, text]) => {
                        const defHtml = processText(text, false);
                        const backLink = (ctx.citeOccurrence[id] !== undefined && ctx.citeOccurrence[id] > 0)
                            ? ` <a href="#cite-${esc(id)}-0" class="wiki-cite-back" title="Back to citation">↩</a>`
                            : '';
                        return `<li id="ref-${esc(id)}">${defHtml}${backLink}</li>`;
                    }).join('')}
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
