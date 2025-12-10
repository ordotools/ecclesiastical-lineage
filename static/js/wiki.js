
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
        this.pages = JSON.parse(localStorage.getItem('wiki_pages')) || INITIAL_PAGES;
        this.history = [initialSlug];
        this.currentSlug = initialSlug;
        this.isEditing = false;
        this.searchQuery = '';
        this.isSidebarOpen = true;

        // Elements
        this.els = {
            sidebar: document.querySelector('.wiki-sidebar'),
            searchInput: document.querySelector('.wiki-search-input'),
            pagesList: document.getElementById('wiki-pages-list'),
            mainTitle: document.getElementById('wiki-main-title'),
            contentArea: document.getElementById('wiki-content-area'),
            backBtn: document.getElementById('wiki-back-btn'),
            toggleSidebarBtn: document.getElementById('wiki-toggle-sidebar'),
            editBtn: document.getElementById('wiki-edit-btn'),
            saveBtn: document.getElementById('wiki-save-btn'),
            cancelBtn: document.getElementById('wiki-cancel-btn'),
            newBtn: document.getElementById('wiki-new-btn'),
            randomBtn: document.getElementById('wiki-random-btn'),
            editContainer: document.getElementById('wiki-edit-container'),
            viewContainer: document.getElementById('wiki-view-container'),
            textarea: document.getElementById('wiki-textarea'),
            homeBtn: document.getElementById('wiki-home-btn')
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        // Navigation
        this.els.startTime = Date.now();

        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.slug) {
                this.navigate(e.state.slug, false);
            }
        });

        this.els.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderSidebarList();
        });

        this.els.toggleSidebarBtn.addEventListener('click', () => {
            this.isSidebarOpen = !this.isSidebarOpen;
            this.els.sidebar.classList.toggle('closed', !this.isSidebarOpen);
            // Update icon
            const icon = this.els.toggleSidebarBtn.querySelector('i');
            if (this.isSidebarOpen) {
                icon.className = 'fas fa-arrow-left'; // assuming fontawesome exists
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

        this.els.editBtn.addEventListener('click', () => {
            this.isEditing = true;
            this.els.textarea.value = this.getCurrentPage().content;
            this.render();
        });

        this.els.cancelBtn.addEventListener('click', () => {
            this.isEditing = false;
            this.render();
        });

        this.els.saveBtn.addEventListener('click', () => {
            this.savePage();
        });

        this.els.newBtn.addEventListener('click', () => this.handleCreateNew());
        this.els.randomBtn.addEventListener('click', () => this.handleRandom());
        this.els.homeBtn.addEventListener('click', () => this.navigate('Main Page'));
    }

    getCurrentPage() {
        return this.pages[this.currentSlug] || {
            title: this.currentSlug,
            content: `# ${this.currentSlug}\n\nThis page does not exist yet. Click Edit to create it!`
        };
    }

    navigate(slug, pushHistory = true) {
        if (slug === this.currentSlug) return;

        if (pushHistory) {
            this.history.push(slug);
            // Optional: update URL
            // history.pushState({ slug }, '', `/wiki/${slug}`); 
        }

        this.currentSlug = slug;
        this.isEditing = false;
        this.render();

        // Scroll to top
        this.els.contentArea.scrollTop = 0;
    }

    handleBack() {
        if (this.history.length > 1) {
            this.history.pop();
            const prev = this.history[this.history.length - 1];
            this.currentSlug = prev;
            this.isEditing = false;
            this.render();
        }
    }

    handleCreateNew() {
        const title = prompt("Enter title for new page:");
        if (title) {
            if (!this.pages[title]) {
                const newPage = {
                    title,
                    content: `# ${title}\n\nStart writing your article here...`
                };
                this.pages[title] = newPage;
                // Don't save to localStorage yet until they actually edit/save? 
                // Or maybe just navigating to it is enough context.
            }
            this.navigate(title);
            this.isEditing = true;
            this.els.textarea.value = this.pages[title].content;
            this.render();
        }
    }

    handleRandom() {
        const keys = Object.keys(this.pages);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        this.navigate(randomKey);
    }

    savePage() {
        const content = this.els.textarea.value;
        this.pages[this.currentSlug] = {
            title: this.currentSlug,
            content: content
        };

        // Persist
        localStorage.setItem('wiki_pages', JSON.stringify(this.pages));

        this.isEditing = false;
        this.render();
    }

    parseWikiText(text) {
        const lines = text.split('\n');
        const definitions = {};
        const contentLines = [];

        // 1. First pass: Extract citation definitions [^1]: ...
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

    renderContent(content) {
        const { contentLines, definitions } = this.parseWikiText(content);
        let html = '';

        const processText = (text) => {
            // Split by tokens: [[...]], **...**, [^...]
            // Regex logic from React code
            const parts = text.split(/(\[\[.*?\]\])|(\*{2}.*?\*{2})|(\[\^\d+\])/g).filter(Boolean);

            return parts.map(part => {
                if (part.startsWith('[[') && part.endsWith(']]')) {
                    const raw = part.slice(2, -2);
                    const [target, label] = raw.split('|');
                    const displayLabel = label || target;
                    const exists = !!this.pages[target];
                    const className = exists ? 'wiki-link exists' : 'wiki-link';
                    const title = exists ? `Go to ${target}` : 'Page does not exist yet';
                    // Use data attribute for event delegation
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
        };

        const renderedLines = contentLines.map(line => {
            if (line.startsWith('# ')) return `<h1>${processText(line.substring(2))}</h1>`;
            if (line.startsWith('## ')) return `<h2>${processText(line.substring(3))}</h2>`;
            if (line.startsWith('### ')) return `<h3>${processText(line.substring(4))}</h3>`;
            if (line.startsWith('- ')) return `<li>${processText(line.substring(2))}</li>`;
            if (line.trim() === '') return '<div style="height: 1rem;"></div>';
            return `<p>${processText(line)}</p>`;
        }).join('');

        // Wrap list items if needed? For simplicity, we just output them. 
        // A smarter parser would wrap them in <ul>, but the React code didn't actually wrap them in <ul>, 
        // it just rendered <li> elements! Wait, that's invalid HTML. `<li>` must be in `<ul>` or `<ol>`.
        // The React code: `return <li ...></li>`. It returned `li` directly inside the div.
        // Browsers handle this by showing bullets anyway, usually. I will loosely follow or wrap.
        // Let's just output them.

        html += renderedLines;

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

    renderSidebarList() {
        const filtered = Object.keys(this.pages).filter(p =>
            p.toLowerCase().includes(this.searchQuery.toLowerCase())
        );

        this.els.pagesList.innerHTML = filtered.map(slug => {
            const active = this.currentSlug === slug ? 'active' : '';
            return `<button class="wiki-page-link ${active}" data-slug="${slug}">${slug}</button>`;
        }).join('');
    }

    render() {
        const page = this.getCurrentPage();

        // Sidebar
        this.renderSidebarList();

        // Header State
        this.els.mainTitle.textContent = page.title;
        this.els.backBtn.disabled = this.history.length <= 1;
        this.els.backBtn.style.opacity = this.history.length <= 1 ? '0.3' : '1';

        // Content
        if (this.isEditing) {
            this.els.viewContainer.style.display = 'none';
            this.els.editContainer.style.display = 'flex';
            this.els.editBtn.style.display = 'none';
            this.els.saveBtn.style.display = 'inline-flex';
            this.els.cancelBtn.style.display = 'inline-block';
        } else {
            this.els.viewContainer.style.display = 'block';
            this.els.editContainer.style.display = 'none';
            this.els.viewContainer.innerHTML = this.renderContent(page.content);
            this.els.editBtn.style.display = 'inline-flex';
            this.els.saveBtn.style.display = 'none';
            this.els.cancelBtn.style.display = 'none';

            // Re-bind dynamic links
            this.els.viewContainer.querySelectorAll('.wiki-link').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const target = e.target.dataset.target;
                    this.navigate(target);
                });
            });
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

    // Handle "Last updated" and other static text
    const footer = document.querySelector('.wiki-footer span');
    if (footer) footer.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
});
