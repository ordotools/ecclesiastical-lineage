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
        const expanded = this.expandShortcodes(markdown);
        const { contentLines, definitions } = this.parseWikiText(expanded);
        const html = this.processLines(contentLines, definitions, pages);
        return html;
    }

    /**
     * Stub for shortcode expansion. Clergy and lineage shortcodes implemented in later phases.
     * @param {string} text
     * @returns {string}
     */
    expandShortcodes(text) {
        return text;
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

    processText(text, pages) {
        const parts = text.split(/(\[\[.*?\]\])|(\*{2}.*?\*{2})|(\[\^\d+\])/g).filter(Boolean);

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
            return part;
        }).join('');
    }

    processLines(contentLines, definitions, pages) {
        const processText = (t) => this.processText(t, pages);

        const renderedLines = contentLines.map(line => {
            if (line.startsWith('# ')) return `<h1>${processText(line.substring(2))}</h1>`;
            if (line.startsWith('## ')) return `<h2>${processText(line.substring(3))}</h2>`;
            if (line.startsWith('### ')) return `<h3>${processText(line.substring(4))}</h3>`;
            if (line.startsWith('- ')) return `<li>${processText(line.substring(2))}</li>`;
            if (line.trim() === '') return '<div style="height: 1rem;"></div>';
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
