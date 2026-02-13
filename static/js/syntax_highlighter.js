/**
 * WikiSyntaxHighlighter
 *
 * Implements the "Backdrop" trick for syntax highlighting in a textarea.
 * A transparent textarea sits on top of a "backdrop" div that displays
 * the same text but with HTML highlighting.
 */
class WikiSyntaxHighlighter {
    constructor(textarea, backdrop) {
        this.textarea = textarea;
        this.backdrop = backdrop;

        this.init();
    }

    init() {
        if (!this.textarea || !this.backdrop) return;

        // Ensure initial sync
        this.sync();

        // Bind events
        this.textarea.addEventListener('input', () => this.sync());
        this.textarea.addEventListener('scroll', () => this.syncScroll());

        // Resize observer to keep dimensions in sync
        const resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        resizeObserver.observe(this.textarea);

        // Initial resize sync
        this.handleResize();
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    applyHighlights(text) {
        let highlighted = this.escapeHtml(text);

        // Markdown Highlighting Rules

        // 1. Headers - match most-specific first (h3, h2, h1)
        highlighted = highlighted.replace(/^(###+\s+.*)$/gm, '<span class="h-h3">$1</span>');
        highlighted = highlighted.replace(/^(##\s+.*)$/gm, '<span class="h-h2">$1</span>');
        highlighted = highlighted.replace(/^(#\s+.*)$/gm, '<span class="h-h1">$1</span>');

        // 2. Bold (**text**) -> .h-bold
        highlighted = highlighted.replace(/(\*\*.+?\*\*)/g, '<span class="h-bold">$1</span>');

        // 3. Italic (*text* or _text_) -> .h-italic
        highlighted = highlighted.replace(/(\*[^*]+?\*)|(\_[^_]+?\_)/g, '<span class="h-italic">$&</span>');

        // 4. Wiki Links ([[Link]]) -> .h-link
        highlighted = highlighted.replace(/(\[\[.+?\]\])/g, '<span class="h-link">$1</span>');

        // 5. Citations ([^1]) -> .h-citation
        highlighted = highlighted.replace(/(\[\^.+?\])/g, '<span class="h-citation">$1</span>');

        // 6. Lists (- item, * item, 1. item) -> .h-list
        highlighted = highlighted.replace(/^(\s*(\-|\*|\d+\.)\s+.*)$/gm, '<span class="h-list">$1</span>');

        // 7. Blockquotes (> quote) -> .h-quote
        highlighted = highlighted.replace(/^(\s*&gt;\s+.*)$/gm, '<span class="h-quote">$1</span>');

        // 8. Horizontal Rule (---) -> .h-hr
        highlighted = highlighted.replace(/^(\s*\-{3,}\s*)$/gm, '<span class="h-hr">$1</span>');

        // 9. Inline Code (`code`) -> .h-code-inline
        highlighted = highlighted.replace(/(`[^`]+`)/g, '<span class="h-code-inline">$1</span>');

        // 10. Code Blocks (``` ... ```) -> .h-code-block
        // Note: This simple regex might struggle with multiline if not careful, applying basic span
        // For full block highlighting, we need more complex parsing, but this covers the wrapper.
        highlighted = highlighted.replace(/(```[\s\S]*?```)/g, '<span class="h-code-block">$1</span>');

        return highlighted;
    }

    sync() {
        const text = this.textarea.value;
        const highlightedHTML = this.applyHighlights(text);

        // Final character check:
        // If text ends with a newline, the browser textarea adds a visual line,
        // but the div might not. We need to append a break or space to match.
        // A common trick is to add a <br> if the last char is \n

        this.backdrop.innerHTML = highlightedHTML + (text.endsWith('\n') ? '<br>&nbsp;' : '');

        this.syncScroll();
    }

    syncScroll() {
        this.backdrop.scrollTop = this.textarea.scrollTop;
        this.backdrop.scrollLeft = this.textarea.scrollLeft;
    }

    handleResize() {
        const style = window.getComputedStyle(this.textarea);

        // Copy relevant styles to backdrop to ensure perfect alignment
        // (Though ideally this is done in CSS, setting width/height explicitly helps)
        this.backdrop.style.width = this.textarea.clientWidth + 'px';
        this.backdrop.style.height = this.textarea.clientHeight + 'px';
    }
}

// Global export
window.WikiSyntaxHighlighter = WikiSyntaxHighlighter;
