
// --- Initial Data ---
const INITIAL_PAGES = {
    'Main Page': {
        title: 'Main Page',
        content: `# Welcome to WikiLite

Welcome to **WikiLite**, a lightweight, markdown-based encyclopedia clone. 

This project demonstrates how to build a knowledge graph using **WikiLinks** and **Citations**.

## Features
- **Internal Linking**: Use double brackets like [[Alan Turing]] or [[Ada Lovelace]] to link to other pages.
- **Citations**: Add sources using caret syntax like this[^1].
- **Live Editing**: Click the "Edit" button to change this text and see how it works!

## Featured Articles
- [[Alan Turing]] - Father of theoretical computer science.
- [[Ada Lovelace]] - Often considered the first computer programmer.
- [[Grace Hopper]] - Pioneer of machine-independent programming languages.

[^1]: This is a sample endnote citation demonstrating the reference system.
`
    },
    'Alan Turing': {
        title: 'Alan Turing',
        content: `# Alan Turing

**Alan Mathison Turing** (1912–1954) was an English mathematician, computer scientist, logician, cryptanalyst, philosopher, and theoretical biologist.

## Contributions
Turing was highly influential in the development of theoretical computer science, providing a formalisation of the concepts of algorithm and computation with the Turing machine, which can be considered a model of a general-purpose computer[^1].

During the Second World War, he worked for the Government Code and Cypher School (GC&CS) at [[Bletchley Park]]. He devised a number of techniques for speeding the breaking of German ciphers, including improvements to the pre-war Polish bombe method and an electromechanical machine that could find settings for the [[Enigma Machine]].

## Legacy
He is widely considered to be the father of theoretical computer science and artificial intelligence[^2].

[^1]: "Alan Turing: The Enigma", Andrew Hodges, 1983.
[^2]: "Turing's Legacy: A History of Computing", IEEE Annals, 2012.
`
    },
    'Ada Lovelace': {
        title: 'Ada Lovelace',
        content: `# Ada Lovelace

**Augusta Ada King, Countess of Lovelace** (1815–1852) was an English mathematician and writer, chiefly known for her work on Charles Babbage's proposed mechanical general-purpose computer, the [[Analytical Engine]].

## First Programmer?
She was the first to recognise that the machine had applications beyond pure calculation, and to have published the first algorithm intended to be carried out by such a machine. As a result, she is often regarded as the first computer programmer[^1].

## Connection to Babbage
Lovelace first met [[Charles Babbage]] in June 1833, through their mutual friend Mary Somerville.

[^1]: "Ada, the Enchantress of Numbers", Betty Alexandra Toole, 1992.
`
    },
    'Bletchley Park': {
        title: 'Bletchley Park',
        content: `# Bletchley Park

**Bletchley Park** was the central site for British codebreakers during World War II. It housed the Government Code and Cypher School (GC&CS), where [[Alan Turing]] and others worked to break the [[Enigma Machine]] codes.

It is now a museum and heritage attraction.

[^1]: Bletchley Park Trust, "History of the Park".
`
    },
    'Enigma Machine': {
        title: 'Enigma Machine',
        content: `# Enigma Machine

The **Enigma machine** was a cipher device used in the early- to mid-20th century to protect commercial, diplomatic, and military communication. It was employed extensively by Nazi Germany during World War II, in all branches of the German military.

The code was famously cracked by [[Alan Turing]] and his team at [[Bletchley Park]].
`
    },
    'Charles Babbage': {
        title: 'Charles Babbage',
        content: `# Charles Babbage

**Charles Babbage** (1791–1871) was an English polymath. A mathematician, philosopher, inventor and mechanical engineer, Babbage originated the concept of a digital programmable computer[^1].

He worked closely with [[Ada Lovelace]] on the design of the [[Analytical Engine]].

[^1]: "The Cogwheel Brain", Doron Swade, 2000.
`
    },
    'Analytical Engine': {
        title: 'Analytical Engine',
        content: `# Analytical Engine

The **Analytical Engine** was a proposed mechanical general-purpose computer designed by English mathematician and computer pioneer [[Charles Babbage]].

It was first described in 1837 as the successor to Babbage's difference engine. The input of data and programs was to be provided to the machine via punched cards.
`
    },
    'Grace Hopper': {
        title: 'Grace Hopper',
        content: `# Grace Hopper

**Grace Brewster Murray Hopper** (1906–1992) was an American computer scientist and United States Navy rear admiral. One of the first programmers of the Harvard Mark I computer, she was a pioneer of computer programming.

She popularized the idea of machine-independent programming languages, which led to the development of COBOL.
`
    }
};

class WikiApp {
    constructor(initialSlug = 'Main Page') {
        // State
        this.pages = {}; // Cache
        this.history = [initialSlug];
        this.currentSlug = initialSlug;
        this.isEditing = false;
        this.searchQuery = '';
        this.isSidebarOpen = true;
        this.isLoading = false;
        this.isLoading = false;
        this.selectedClergyId = null; // Track selected clergy ID
        this.selectedClergyId = null; // Track selected clergy ID
        this.allClergy = []; // Store all clergy for client-side search
        this.editorSlug = null; // Track which page is currently loaded in the editor

        // Elements
        this.els = {
            sidebar: document.querySelector('.wiki-sidebar'),
            searchInput: document.querySelector('.wiki-search-input'),
            pagesList: document.getElementById('wiki-pages-list'),
            backlinksSection: document.getElementById('wiki-backlinks-section'),
            backlinksList: document.getElementById('wiki-backlinks-list'),
            mainTitle: document.getElementById('wiki-main-title'),
            contentArea: document.getElementById('wiki-content-area'),
            backBtn: document.getElementById('wiki-back-btn'),
            toggleSidebarBtn: document.getElementById('wiki-toggle-sidebar'),
            editBtn: document.getElementById('wiki-edit-btn'),
            saveBtn: document.getElementById('wiki-save-btn'),
            cancelBtn: document.getElementById('wiki-cancel-btn'),
            newBtn: document.getElementById('wiki-new-page-btn'), // Updated ID
            randomBtn: document.getElementById('wiki-random-btn'),
            editContainer: document.getElementById('wiki-edit-container'),
            editorContainer: document.querySelector('.wiki-editor-container'),
            viewContainer: document.getElementById('wiki-view-container'),
            textarea: document.getElementById('wiki-textarea'),
            titleInput: document.getElementById('wiki-edit-title-input'),
            clergyDropdown: document.getElementById('wiki-clergy-dropdown'),
            homeBtn: document.getElementById('wiki-home-btn'),
            authorSelect: document.getElementById('wiki-author-select'),
            visibleToggle: document.getElementById('wiki-visible-toggle'),
            deletedToggle: document.getElementById('wiki-deleted-toggle'),
            backdrop: document.getElementById('wiki-backdrop') // Backdrop for syntax highlighting
        };

        this.init();

        // Initialize Syntax Highlighter
        if (window.WikiSyntaxHighlighter && this.els.textarea && this.els.backdrop) {
            this.highlighter = new WikiSyntaxHighlighter(this.els.textarea, this.els.backdrop);
        }
    }

    async init() {
        this.bindEvents();
        this.bindToolbar();
        this.bindKeyboardShortcuts();
        this.bindImageDrop();
        await Promise.all([
            this.fetchPageList(),
            this.fetchAllClergy(),
            this.fetchUsers() // New: fetch users for author select
        ]);

        // Initial load
        // Get slug from URL if it exists
        const pathParts = window.location.pathname.split('/');
        // /wiki/Something => ["", "wiki", "Something"]
        if (pathParts.length > 2 && pathParts[1] === 'wiki') {
            const slug = decodeURIComponent(pathParts.slice(2).join('/'));
            if (slug) {
                this.currentSlug = slug;
                this.history = [slug];
            }
        }

        this.navigate(this.currentSlug, false);
    }

    bindEvents() {
        // Navigation
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.slug) {
                this.navigate(e.state.slug, false);
            }
        });

        this.els.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderSidebarList();
        });

        // Clergy Autocomplete on Title Input
        if (this.els.titleInput) {
            this.els.titleInput.addEventListener('input', (e) => {
                const query = e.target.value;
                // Client-side fuzzy search
                this.selectedClergyId = null;
                this.performClergySearch(query);
            });

            // Hide dropdown on blur / click outside
            document.addEventListener('click', (e) => {
                if (this.els.clergyDropdown && !this.els.titleInput.contains(e.target) && !this.els.clergyDropdown.contains(e.target)) {
                    this.els.clergyDropdown.style.display = 'none';
                }
            });
        }

        this.els.toggleSidebarBtn.addEventListener('click', () => {
            this.isSidebarOpen = !this.isSidebarOpen;
            this.els.sidebar.classList.toggle('closed', !this.isSidebarOpen);
            // Update icon
            const icon = this.els.toggleSidebarBtn.querySelector('i');
            if (this.isSidebarOpen) {
                icon.className = 'fas fa-arrow-left';
            } else {
                icon.className = 'fas fa-bars';
            }
        });

        // Dropdown Logic
        const wikiTitleBtn = document.getElementById('wikiTitleBtn');
        const wikiDropdown = document.getElementById('wikiDropdown');
        if (wikiTitleBtn && wikiDropdown) {
            wikiTitleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isVisible = wikiDropdown.style.display === 'block';
                wikiDropdown.style.display = isVisible ? 'none' : 'block';
            });

            document.addEventListener('click', (e) => {
                if (!wikiTitleBtn.contains(e.target) && !wikiDropdown.contains(e.target)) {
                    wikiDropdown.style.display = 'none';
                }
            });
        }

        this.els.backBtn.addEventListener('click', () => this.handleBack());

        if (this.els.editBtn) {
            this.els.editBtn.addEventListener('click', () => {
                if (this.isLoading) return;
                const isNewPage = this.currentSlug === null;
                if (!isNewPage && this.pages[this.currentSlug]?.content === null) return;
                this.isEditing = true;
                this.render();
            });
        }

        this.els.cancelBtn.addEventListener('click', () => {
            this.isEditing = false;
            this.render();
        });

        this.els.saveBtn.addEventListener('click', () => {
            this.savePage();
        });

        if (this.els.newBtn) {
            this.els.newBtn.addEventListener('click', () => this.handleCreateNew());
        }

        this.els.randomBtn.addEventListener('click', () => {
            const keys = Object.keys(this.pages);
            if (keys.length > 0) {
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                this.navigate(randomKey);
            }
        });

        this.els.homeBtn.addEventListener('click', () => this.navigate('Main Page'));

        // Article Autocomplete Logic
        this.els.articleDropdown = document.getElementById('wiki-article-dropdown');
        if (this.els.textarea && this.els.articleDropdown) {
            this.els.textarea.addEventListener('input', (e) => {
                const cursor = this.els.textarea.selectionStart;
                const text = this.els.textarea.value;
                const sub = text.substring(0, cursor);
                const match = sub.match(/\[\[([^\]]*)$/);

                if (match) {
                    const query = match[1];
                    this.performArticleSearch(query);
                } else {
                    this.els.articleDropdown.style.display = 'none';
                }
            });

            // Hide on click outside
            document.addEventListener('click', (e) => {
                if (!this.els.articleDropdown.contains(e.target) && e.target !== this.els.textarea) {
                    this.els.articleDropdown.style.display = 'none';
                }
            });
        }
    }

    performArticleSearch(query) {
        if (!window.fuzzySearch) return;

        // Ensure we have a flat list of titles
        const titles = Object.keys(this.pages);

        let results;
        if (!query) {
            // Show all if query is empty
            results = titles.map(t => ({ item: t, score: 0 }));
        } else {
            results = window.fuzzySearch(titles, query);
        }

        const topResults = results.slice(0, 10).map(r => r.item);

        // Calculate caret coordinates
        const coords = getCaretCoordinates(this.els.textarea, this.els.textarea.selectionStart);

        // Since .wiki-autocomplete-dropdown is position: absolute relative to the textarea's container,
        // we just need the local coordinates relative to the top-left of the textarea content area.
        // We subtract scrollTop/scrollLeft to account for the textarea being scrolled.

        const pos = {
            top: coords.top - this.els.textarea.scrollTop,
            left: coords.left - this.els.textarea.scrollLeft
        };

        // Debug
        // console.log('Dropdown Pos (Local):', pos, 'Coords:', coords);

        this.renderArticleDropdown(topResults, query, pos);
    }

    renderArticleDropdown(results, query, pos) {
        if (results.length === 0) {
            if (this.els.articleDropdown) this.els.articleDropdown.style.display = 'none';
            return;
        }

        this.els.articleDropdown.innerHTML = results.map(title => `
            <div class="wiki-autocomplete-item" data-title="${title}">
                <i class="fas fa-file-alt" style="margin-right: 8px; color: #9ca3af;"></i>${title}
            </div>
        `).join('');

        this.els.articleDropdown.style.display = 'block';

        if (pos) {
            // Add a buffer for line height (~20px)
            const lineHeight = 24;
            if (this.els.articleDropdown) {
                this.els.articleDropdown.style.top = (pos.top + lineHeight) + 'px';
                this.els.articleDropdown.style.left = pos.left + 'px';
            }

            // Basic viewport boundary check could go here
        }

        // Add click listeners
        this.els.articleDropdown.querySelectorAll('.wiki-autocomplete-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.insertArticleLink(item.dataset.title, query);
            });
        });
    }

    insertArticleLink(title, query) {
        const cursor = this.els.textarea.selectionStart;
        const text = this.els.textarea.value;
        const before = text.substring(0, cursor - query.length - 2); // -2 for [[
        const after = text.substring(cursor);

        this.els.textarea.value = `${before}[[${title}]]${after}`;
        this.els.articleDropdown.style.display = 'none';

        // Reset cursor position
        const newCursorPos = before.length + title.length + 4; // +4 for [[ ]]
        this.els.textarea.setSelectionRange(newCursorPos, newCursorPos);
        this.els.textarea.focus();

        // Prevent sync glitch (invisible text) by forcing highlighter update
        if (this.highlighter) this.highlighter.sync();
    }

    insertAtCursor(text) {
        const ta = this.els.textarea;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = ta.value.substring(0, start);
        const after = ta.value.substring(end);
        ta.value = before + text + after;
        const newPos = start + text.length;
        ta.setSelectionRange(newPos, newPos);
        ta.focus();
        if (this.highlighter) this.highlighter.sync();
    }

    /**
     * Wrap selection with before/after. If no selection, insert both and place cursor between.
     */
    wrapSelection(before, after) {
        const ta = this.els.textarea;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = ta.value.substring(start, end);
        ta.value = ta.value.substring(0, start) + before + sel + after + ta.value.substring(end);
        const newEnd = start + before.length + sel.length;
        ta.setSelectionRange(start + before.length, newEnd);
        ta.focus();
        if (this.highlighter) this.highlighter.sync();
    }

    bindImageDrop() {
        const container = this.els.editorContainer;
        if (!container || !this.els.textarea) return;
        if (container.hasAttribute('data-wiki-drop-bound')) return;
        container.setAttribute('data-wiki-drop-bound', 'true');

        ['dragenter', 'dragover'].forEach(ev => {
            container.addEventListener(ev, (e) => {
                if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                    container.classList.add('wiki-drag-over');
                }
            });
        });
        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) container.classList.remove('wiki-drag-over');
        });
        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.classList.remove('wiki-drag-over');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length === 0) return;
            this.els.textarea.focus();
            for (const file of files) {
                const fd = new FormData();
                fd.append('file', file);
                try {
                    const res = await fetch('/api/wiki/upload', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.url) {
                        const alt = file.name.replace(/\.[^.]*$/, '');
                        this.insertAtCursor(`\n![${alt}](${data.url})\n`);
                    }
                } catch (err) {
                    console.error('Image upload failed', err);
                }
            }
        });
    }

    bindToolbar() {
        const toolbar = document.querySelector('.wiki-toolbar');
        if (!toolbar || !this.els.textarea) return;
        toolbar.querySelectorAll('.wiki-toolbar-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.els.textarea.focus();
                const action = btn.dataset.action;
                if (action === 'bold') this.wrapSelection('**', '**');
                else if (action === 'italic') this.wrapSelection('*', '*');
                else if (action === 'h1') this.wrapSelection('\n# ', '\n');
                else if (action === 'h2') this.wrapSelection('\n## ', '\n');
                else if (action === 'h3') this.wrapSelection('\n### ', '\n');
                else if (action === 'link') {
                    this.insertAtCursor('[[');
                    this.performArticleSearch('');
                } else if (action === 'citation') this.insertAtCursor('[^1]');
            });
        });
    }

    bindKeyboardShortcuts() {
        if (!this.els.textarea) return;
        this.els.textarea.addEventListener('keydown', (e) => {
            const isMod = e.ctrlKey || e.metaKey;
            if (!isMod) return;
            if (e.key === 'b') {
                e.preventDefault();
                this.wrapSelection('**', '**');
            } else if (e.key === 'i') {
                e.preventDefault();
                this.wrapSelection('*', '*');
            } else if (e.key === 'k') {
                e.preventDefault();
                this.insertAtCursor('[[');
                this.performArticleSearch('');
            } else if (e.key === 's') {
                e.preventDefault();
                if (this.isEditing) this.savePage();
            }
        });
    }

    getCurrentPage() {
        return this.pages[this.currentSlug] || {
            title: this.currentSlug,
            content: null // Content managed by remote fetch now
        };
    }

    async fetchPageList() {
        try {
            const res = await fetch('/api/wiki/pages');
            const pageList = await res.json();
            // Rebuild pages cache or merge
            pageList.forEach(pageData => {
                if (!this.pages[pageData.title]) {
                    this.pages[pageData.title] = {
                        title: pageData.title,
                        content: null,
                        is_visible: pageData.is_visible,
                        is_deleted: pageData.is_deleted
                    };
                } else {
                    // Update metadata if exists
                    this.pages[pageData.title].is_visible = pageData.is_visible;
                    this.pages[pageData.title].is_deleted = pageData.is_deleted;
                }
            });
            this.renderSidebarList();
        } catch (err) {
            console.error('Failed to fetch page list', err);
        }
    }

    async fetchBacklinks(slug) {
        if (!this.els.backlinksSection || !this.els.backlinksList) return;
        try {
            const res = await fetch(`/api/wiki/backlinks/${encodeURIComponent(slug)}`);
            const list = res.ok ? await res.json() : [];
            this.renderBacklinks(list, slug);
        } catch (err) {
            console.error('Failed to fetch backlinks', err);
            this.renderBacklinks([], slug);
        }
    }

    renderBacklinks(list, currentSlug) {
        if (!this.els.backlinksSection || !this.els.backlinksList) return;
        if (this.isEditing) {
            this.els.backlinksSection.style.display = 'none';
            return;
        }
        this.els.backlinksSection.style.display = 'block';
        const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        this.els.backlinksList.innerHTML = list
            .filter(p => p.slug !== currentSlug)
            .map(p => `<button type="button" class="wiki-page-link wiki-backlink" data-slug="${esc(p.slug)}">${esc(p.title)}</button>`)
            .join('');
        if (this.els.backlinksList.innerHTML === '') {
            this.els.backlinksList.innerHTML = '<span class="wiki-backlinks-empty">None</span>';
        }
        this.els.backlinksList.querySelectorAll('.wiki-backlink').forEach(btn => {
            btn.addEventListener('click', () => this.navigate(btn.dataset.slug));
        });
    }

    extractClergyShortcodeIds(content) {
        if (!content) return [];
        const ids = new Set();
        content.replace(/\{\{clergy:(\d+)(?::\w+)?\}\}/g, (_, id) => { ids.add(parseInt(id, 10)); return ''; });
        return [...ids];
    }

    async fetchClergySummaries(ids) {
        if (ids.length === 0) return {};
        if (ids.length === 1) {
            try {
                const res = await fetch(`/api/wiki/clergy/${ids[0]}/summary`);
                if (res.ok) return { [ids[0]]: await res.json() };
            } catch (e) { /* ignore */ }
            return {};
        }
        try {
            const res = await fetch(`/api/wiki/clergy/summaries?ids=${ids.join(',')}`);
            if (res.ok) return await res.json();
        } catch (e) { /* ignore */ }
        return {};
    }

    async renderViewContent(slugForRender, content) {
        const ids = this.extractClergyShortcodeIds(content);
        const clergySummaries = await this.fetchClergySummaries(ids);
        if (slugForRender !== this.currentSlug || this.isEditing) return;
        const renderer = window.wikiRenderer || new WikiRenderer();
        this.els.viewContainer.innerHTML = renderer.render(content, { pages: this.pages, clergySummaries });
        this.els.viewContainer.querySelectorAll('.wiki-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.target;
                this.navigate(target);
            });
        });
        this.initLineageCharts();
        this.fetchBacklinks(slugForRender);
    }

    async initLineageCharts() {
        if (!this.els.viewContainer || typeof window.renderStaticLineageChart !== 'function') return;
        const charts = this.els.viewContainer.querySelectorAll('.wiki-lineage-chart[data-lineage-id], .wiki-lineage-chart[data-lineage-name]');
        for (const el of charts) {
            const id = el.dataset.lineageId;
            const name = el.dataset.lineageName;
            const ident = id || name;
            if (!ident) continue;
            try {
                const res = await fetch(`/api/wiki/lineage/${encodeURIComponent(ident)}`);
                if (res.ok) {
                    const { nodes, links } = await res.json();
                    window.renderStaticLineageChart(nodes, links, el);
                } else {
                    el.innerHTML = '<p class="wiki-lineage-error">Lineage not found.</p>';
                }
            } catch (err) {
                console.error('Lineage chart failed', err);
                el.innerHTML = '<p class="wiki-lineage-error">Failed to load lineage.</p>';
            }
        }
    }

    async fetchPage(slug) {
        this.isLoading = true;
        this.render(); // Show loading state

        try {
            const res = await fetch(`/api/wiki/page/${encodeURIComponent(slug)}`);
            if (res.ok) {
                const data = await res.json();
                this.pages[slug] = data; // { title, content, updated_at, editor }
                if (data.clergy_id) {
                    this.selectedClergyId = data.clergy_id;
                }
            } else if (res.status === 404) {
                // Page doesn't exist yet
                this.pages[slug] = {
                    title: slug,
                    content: null, // Indicates New Page
                    exists: false
                };
            }
        } catch (err) {
            console.error('Failed to fetch page', err);
        } finally {
            this.isLoading = false;
            this.render();
        }
    }

    navigate(slug, pushHistory = true) {
        if (!slug) return;

        // Capture current edit state
        const wasEditing = this.isEditing;

        if (pushHistory && slug !== this.currentSlug) {
            this.history.push(slug);
            history.pushState({ slug }, '', `/wiki/${slug}`);
        }

        this.currentSlug = slug;

        // Maintain edit mode if we were editing AND we effectively can edit (e.g. not logged out)
        // We can check if editBtn or saveBtn exists in DOM as a proxy for permissions
        const canEdit = !!(this.els.editBtn || this.els.saveBtn);
        this.isEditing = wasEditing && canEdit;

        // Check if we have content, if not fetch it
        this.selectedClergyId = null; // Reset selection on nav
        if (!this.pages[slug] || this.pages[slug].content === null) {
            this.fetchPage(slug);
        } else {
            // If we are maintaining edit mode for a page we already have, 
            // we need to ensure the textarea is populated correctly in render()
            // render() handles this by grabbing content from this.pages[slug]
            this.render();
        }

        // Scroll to top
        if (this.els.contentArea) this.els.contentArea.scrollTop = 0;
    }

    handleBack() {
        if (this.history.length > 1) {
            this.history.pop();
            const prev = this.history[this.history.length - 1];
            this.currentSlug = prev;
            this.isEditing = false;
            // Update URL
            history.pushState({ slug: prev }, '', `/wiki/${prev}`);

            if (!this.pages[prev] || this.pages[prev].content === null) {
                this.fetchPage(prev);
            } else {
                this.render();
            }
        }
    }


    handleCreateNew() {
        this.currentSlug = null; // Indicates new page mode
        this.isEditing = true;

        // Reset inputs
        this.els.titleInput.value = '';
        this.selectedClergyId = null;

        this.render();
        this.els.titleInput.focus();
    }

    async savePage() {
        const content = this.els.textarea.value;
        let slug = this.currentSlug;

        // If new page, get slug from title input
        if (!slug) {
            const titleVal = this.els.titleInput.value.trim();
            if (!titleVal) {
                if (window.showNotification) {
                    window.showNotification("Please enter a page title.", "error");
                } else {
                    alert("Please enter a page title.");
                }
                this.els.titleInput.focus();
                return;
            }
            slug = titleVal;
        }

        const payload = {
            title: slug,
            content: content,
            clergy_id: this.selectedClergyId,
            is_visible: this.els.visibleToggle ? this.els.visibleToggle.checked : true,
            is_deleted: this.els.deletedToggle ? this.els.deletedToggle.checked : false,
            author_id: this.els.authorSelect ? this.els.authorSelect.value : null
        };

        try {
            const res = await fetch('/api/wiki/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
                    return;
                }
                const errText = await res.text();
                if (window.showNotification) {
                    window.showNotification('Failed to save page: ' + errText, 'error');
                } else {
                    alert('Failed to save page: ' + errText);
                }
                console.error('Save failed', errText);
            } else {
                // Success
                this.isEditing = false;
                // Fetch the fresh data (including new timestamp)
                await this.fetchPage(slug);
                this.navigate(slug, false);
                if (window.showNotification) {
                    window.showNotification('Page saved successfully!', 'success');
                }
            }
        } catch (err) {
            if (window.showNotification) {
                window.showNotification('Error saving page: ' + err.message, 'error');
            } else {
                alert('Error saving page: ' + err.message);
            }
        }
    }


    async fetchAllClergy() {
        try {
            const res = await fetch('/api/wiki/all-clergy');
            if (res.ok) {
                this.allClergy = await res.json();
            } else {
                console.error('Failed to fetch clergy:', res.status);
            }
        } catch (err) {
            console.error('Failed to fetch all clergy', err);
        }
    }

    performClergySearch(query) {
        if (!query || query.length < 2) {
            this.els.clergyDropdown.style.display = 'none';
            return;
        }

        if (!window.fuzzySearch) {
            console.error('fuzzySearch not loaded');
            return;
        }

        // Use the shared fuzzySearch function
        // fuzzySearch(list, query, keyFn) returns [{item, score}, ...]
        const results = window.fuzzySearch(this.allClergy, query, item => item.name);

        // Take top 10 results
        const topResults = results.slice(0, 10).map(r => r.item);

        this.renderClergyDropdown(topResults);
    }

    renderClergyDropdown(results) {
        if (results.length === 0) {
            this.els.clergyDropdown.style.display = 'none';
            return;
        }

        this.els.clergyDropdown.innerHTML = results.map(c => `
            <div class="wiki-clergy-item" data-id="${c.id}" data-name="${c.name}">
                <span class="wiki-clergy-name">${c.name}</span>
                <span class="wiki-clergy-rank">${c.rank}</span>
            </div>
        `).join('');

        this.els.clergyDropdown.style.display = 'block';

        // Add click listeners
        this.els.clergyDropdown.querySelectorAll('.wiki-clergy-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedClergyId = item.dataset.id;
                this.els.titleInput.value = item.dataset.name;
                this.els.clergyDropdown.style.display = 'none';
            });
        });
    }

    async fetchUsers() {
        try {
            const res = await fetch('/api/wiki/users');
            if (res.ok) {
                const users = await res.json();
                this.renderAuthorSelect(users);
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    }

    renderAuthorSelect(users) {
        if (!this.els.authorSelect) return;
        const currentVal = this.els.authorSelect.value;
        this.els.authorSelect.innerHTML = '<option value="">Select Author...</option>' +
            users.map(u => `<option value="${u.id}">${u.full_name || u.username}</option>`).join('');
        this.els.authorSelect.value = currentVal; // Restore if any (though render usually overwrites)
    }

    renderSidebarList() {
        // Check if logged in by presence of auth-only elements (e.g. New Page button or Edit button)
        // newBtn is good proxy as it's for auth users
        const isLoggedIn = !!this.els.newBtn;

        const filtered = Object.values(this.pages).filter(p => {
            // Filter by search
            const matchesSearch = p.title.toLowerCase().includes(this.searchQuery.toLowerCase());

            // Visibility Logic:
            let isVisible = true;

            // Deleted pages: Only show if actively editing
            if (p.is_deleted && !this.isEditing) {
                isVisible = false;
            }

            // Hidden (invisible) pages:
            // Show if editing OR if logged in
            // Hide if anonymous AND not visible
            if (!p.is_visible) {
                if (!this.isEditing && !isLoggedIn) {
                    isVisible = false;
                }
            }

            return matchesSearch && isVisible;
        });

        // Sort alphabetically
        filtered.sort((a, b) => a.title.localeCompare(b.title));

        this.els.pagesList.innerHTML = filtered.map(page => {
            const slug = page.title;
            const active = this.currentSlug === slug ? 'active' : '';
            // Icon for hidden pages
            const iconHtml = !page.is_visible ? '<i class="fas fa-eye-slash" style="margin-right: 6px; font-size: 0.75rem; opacity: 0.7;"></i>' : '';

            return `<button class="wiki-page-link ${active}" data-slug="${slug}" style="display: flex; align-items: center;">
                ${iconHtml}
                <span class="truncate-text" style="flex: 1; text-align: left; pointer-events: none;">${slug}</span>
            </button>`;
        }).join('');
    }

    render() {
        if (this.isLoading) {
            this.els.mainTitle.textContent = "Loading...";
            this.els.viewContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            if (this.els.editBtn) this.els.editBtn.disabled = true;
            return;
        }

        // Handle new page case where currentSlug might be null
        const isNewPage = this.currentSlug === null;
        const page = isNewPage ? { title: 'New Page', content: '' } : this.getCurrentPage();

        // Sidebar
        this.renderSidebarList();

        // Header State
        this.els.mainTitle.textContent = page.title;
        // Disable back button if history is short OR if we are in 'new page' mode and history is 1 (just initial)
        this.els.backBtn.disabled = this.history.length <= 1;
        this.els.backBtn.style.opacity = this.els.backBtn.disabled ? '0.3' : '1';

        // Content
        if (this.isEditing) {
            if (this.els.backlinksSection) this.els.backlinksSection.style.display = 'none';
            if (this.els.contentArea) this.els.contentArea.classList.add('wiki-editing-mode');
            this.els.viewContainer.style.display = 'none';
            this.els.editContainer.style.display = 'flex';
            if (this.els.editBtn) this.els.editBtn.style.display = 'none';
            if (this.els.saveBtn) this.els.saveBtn.style.display = 'inline-flex';
            if (this.els.cancelBtn) this.els.cancelBtn.style.display = 'inline-block';

            // Populate/Manage Template Input
            if (isNewPage) {
                this.els.titleInput.disabled = false;
                // If it was already populated (by user typing before re-render?), keep it
                // But generally render shouldn't wipe user input unless switching pages
                // Simple check: if active element is input, don't overwrite? 
                // Alternatively, only set value if it's empty to avoid fighting?
                // For safety in this simple app, we can just set it if matches our expectations
                // BUT, handleCreateNew cleared it.
            } else {
                this.els.titleInput.value = page.title;
                this.els.titleInput.disabled = true; // Cannot edit title of existing page for now (simplification)
            }

            // Populate Textarea if we switched pages (or entered edit mode)
            // We use editorSlug to track what is currently in the textarea so we don't overwrite user typing
            // if render() is called for other reasons (though currently it shouldn't be called mid-edit).
            const effectiveSlug = isNewPage ? '__NEW_PAGE__' : this.currentSlug;

            if (this.editorSlug !== effectiveSlug) {
                if (isNewPage) {
                    this.els.textarea.value = `## Introduction\n\nStart writing your article here...`;
                    this.editorSlug = effectiveSlug;
                } else if (page.content !== null) {
                    this.els.textarea.value = page.content || `# ${page.title}\n\nStart writing...`;
                    this.editorSlug = effectiveSlug;
                }
                // Trigger syntax highlighter sync
                if (this.highlighter) this.highlighter.sync();
            }

            // Populate Metadata Controls
            if (this.els.visibleToggle) this.els.visibleToggle.checked = page.is_visible !== false; // Default true
            if (this.els.deletedToggle) this.els.deletedToggle.checked = page.is_deleted === true;
            if (this.els.authorSelect) this.els.authorSelect.value = page.author_id || '';

        } else {
            this.editorSlug = null;
            if (this.els.contentArea) this.els.contentArea.classList.remove('wiki-editing-mode');
            this.els.viewContainer.style.display = 'block';
            this.els.editContainer.style.display = 'none';
            const slugForRender = this.currentSlug;
            this.renderViewContent(slugForRender, page.content);
            if (this.els.editBtn) {
                this.els.editBtn.style.display = 'inline-flex';
                this.els.editBtn.disabled = !isNewPage && page.content === null;
            }
            if (this.els.saveBtn) this.els.saveBtn.style.display = 'none';
            if (this.els.cancelBtn) this.els.cancelBtn.style.display = 'none';

            // Update Footer Timestamp
            const footer = document.querySelector('.wiki-footer span');
            if (footer) {
                if (page.updated_at) {
                    const date = new Date(page.updated_at);
                    footer.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                } else {
                    footer.textContent = '';
                }
            }
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get initial slug from URL if present (simple check)
    // For now defaults to 'Main Page' handled in class
    window.wikiApp = new WikiApp();

    // Global delegation for sidebar list items
    document.getElementById('wiki-pages-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('wiki-page-link')) {
            window.wikiApp.navigate(e.target.dataset.slug);
        }
    });

});

/**
 * Mirror Div Helper to find caret coordinates (Robust Version)
 * Replicates the textarea exactly to find the pixel position of the caret.
 */
function getCaretCoordinates(element, position) {
    const debug = false; // Set to true to see the red overlay

    // The properties that we must copy to ensure the mirror div 
    // renders text exactly the same way as the textarea.
    const properties = [
        'direction',
        'boxSizing',
        'width',
        'height',
        'overflowX',
        'overflowY',

        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderStyle',

        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',

        // Font appearance
        'fontStyle',
        'fontVariant',
        'fontWeight',
        'fontStretch',
        'fontSize',
        'fontSizeAdjust',
        'lineHeight',
        'fontFamily',

        'textAlign',
        'textTransform',
        'textIndent',
        'textDecoration',

        'letterSpacing',
        'wordSpacing',

        'tabSize',
        'MozTabSize'
    ];

    // 1. Create the mirror div if it doesn't exist
    let div = document.getElementById('input-textarea-caret-position-mirror-div');
    if (!div) {
        div = document.createElement('div');
        div.id = 'input-textarea-caret-position-mirror-div';
        document.body.appendChild(div);
    }

    const style = div.style;
    const computed = window.getComputedStyle(element);

    // 2. Apply basic positioning styles
    style.whiteSpace = 'pre-wrap';
    if (element.nodeName !== 'INPUT')
        style.wordWrap = 'break-word';  // only for textarea-like

    // Position off-screen by default, or overlay for debug
    style.position = 'absolute';
    if (!debug) {
        style.visibility = 'hidden';
        // We don't really move it offscreen to avoid layout thrashing impacting scroll?
        // Actually, let's keep it top/left 0 but hidden.
        style.top = '0';
        style.left = '0';
    } else {
        style.visibility = 'visible';
        style.backgroundColor = 'rgba(255,0,0,0.3)';
        style.zIndex = '99999';
        style.pointerEvents = 'none';

        // Match screen position for visual verification
        const rect = element.getBoundingClientRect();
        style.top = (rect.top + window.scrollY) + 'px';
        style.left = (rect.left + window.scrollX) + 'px';
    }

    // 3. Copy all relevant properties
    properties.forEach(prop => {
        style[prop] = computed[prop];
    });

    // 4. Special handling for Firefox and scrollbars
    if (window.mozInnerScreenX != null) {
        // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
        if (element.scrollHeight > parseInt(computed.height))
            style.overflowY = 'scroll';
    } else {
        style.overflow = 'hidden'; // Ensure we don't actually show scrollbars in mirror
    }

    // 5. Content Update
    div.textContent = element.value.substring(0, position);

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    span.style.backgroundColor = debug ? 'lime' : 'transparent';
    div.appendChild(span);

    // 6. Calculate coordinates relative to the div
    const coordinates = {
        top: span.offsetTop + parseInt(computed['borderTopWidth']),
        left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
        height: parseInt(computed['lineHeight'])
    };

    if (debug) {
    }

    return coordinates;
}
