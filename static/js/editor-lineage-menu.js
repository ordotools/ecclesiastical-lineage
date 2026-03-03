/**
 * Editor Lineage Menu
 *
 * - Renders per-clergy sprite thumbnails in the lineage menu
 * - Bridges lineage menu clicks into editor selection (`window.selectClergy`)
 * - Re-binds behavior whenever the center panel is HTMX-swapped
 */

(function () {
    const CENTER_PANEL_ID = 'visualization-panel-content';
    const MENU_CONTAINER_SELECTOR = `#${CENTER_PANEL_ID}`;
    const SPRITE_THUMB_SELECTOR = '.lineage-sprite-thumb';
    const MENU_LINK_SELECTOR = '.lineage-menu-link';
    const SELECTED_ROW_CLASS = 'lineage-row-selected';

    /**
     * Safely get the lineage menu root element (center panel content)
     */
    function getMenuRoot() {
        const root = document.querySelector(MENU_CONTAINER_SELECTOR);
        if (!root) {
            return null;
        }
        return root;
    }

    /**
     * Apply sprite sheet thumbnails to all `.lineage-sprite-thumb` elements
     * Uses the cached sprite-sheet API helper when available.
     */
    async function applySpriteThumbnails() {
        const root = getMenuRoot();
        if (!root || typeof window === 'undefined') {
            return;
        }

        const thumbEls = root.querySelectorAll(SPRITE_THUMB_SELECTOR);
        if (!thumbEls.length) {
            return;
        }

        let spriteSheetData = null;
        try {
            if (typeof window.getSpriteSheetData === 'function') {
                spriteSheetData = await window.getSpriteSheetData();
            } else {
                const response = await fetch('/api/sprite-sheet', {
                    method: 'GET',
                    headers: { 'Cache-Control': 'no-cache' },
                });
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        const text = await response.text();
                        console.warn(
                            'Sprite sheet endpoint returned non-JSON response for lineage menu:',
                            contentType,
                            text.substring(0, 200)
                        );
                        return;
                    }
                    spriteSheetData = await response.json();
                }
            }
        } catch (err) {
            console.warn('Error fetching sprite sheet data for lineage menu:', err);
            return;
        }

        if (!spriteSheetData || !spriteSheetData.success) {
            // Hide empty thumbnail shells if sprite data is unavailable
            thumbEls.forEach((el) => {
                el.classList.add('lineage-sprite-thumb--empty');
            });
            return;
        }

        const spriteUrl = spriteSheetData.url;
        const mapping = spriteSheetData.mapping || {};
        const spriteWidth = spriteSheetData.sprite_width || spriteSheetData.width || 0;
        const spriteHeight = spriteSheetData.sprite_height || spriteSheetData.height || 0;
        const thumbSize = spriteSheetData.thumbnail_size || 32;

        thumbEls.forEach((el) => {
            const clergyIdAttr = el.getAttribute('data-clergy-id');
            if (!clergyIdAttr) {
                return;
            }

            const numericId = Number(clergyIdAttr);
            const position =
                mapping[clergyIdAttr] ??
                (Number.isFinite(numericId) ? mapping[numericId] : undefined) ??
                mapping[String(numericId)];

            if (!position || !Array.isArray(position) || position.length < 2) {
                el.classList.add('lineage-sprite-thumb--no-sprite');
                return;
            }

            const [x, y] = position;

            const style = el.style;
            style.display = 'inline-block';
            style.width = `${thumbSize}px`;
            style.height = `${thumbSize}px`;
            style.backgroundImage = `url(${spriteUrl})`;
            style.backgroundRepeat = 'no-repeat';
            style.backgroundPosition = `-${x}px -${y}px`;

            if (spriteWidth && spriteHeight) {
                style.backgroundSize = `${spriteWidth}px ${spriteHeight}px`;
            }

            // Subtle rounding to feel like an avatar; can be overridden via CSS
            if (!el.classList.contains('lineage-sprite-thumb--square')) {
                style.borderRadius = '50%';
            }

            el.classList.add('lineage-sprite-thumb--has-sprite');
        });
    }

    /**
     * Highlight the selected row in the menu and optionally scroll it into view.
     */
    function highlightSelectedMenuRow(clergyId, opts) {
        const options = opts || {};
        const root = getMenuRoot();
        if (!root || !clergyId) return;

        root.querySelectorAll(`tr.${SELECTED_ROW_CLASS}`).forEach((row) => {
            row.classList.remove(SELECTED_ROW_CLASS);
        });

        const targetLink = root.querySelector(
            `${MENU_LINK_SELECTOR}[data-clergy-id="${clergyId}"]`
        );
        if (!targetLink) return;

        const row = targetLink.closest('tr');
        if (!row) return;

        row.classList.add(SELECTED_ROW_CLASS);

        if (options.scrollIntoView) {
            try {
                row.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } catch {
                row.scrollIntoView();
            }
        }
    }

    /**
     * Attach delegated click handling for `.lineage-menu-link`
     * so clicks route through the existing `window.selectClergy` flow.
     */
    function bindMenuClickHandlers() {
        const root = getMenuRoot();
        if (!root) return;

        // Avoid binding multiple listeners to the same container
        if (root.__lineageMenuClicksBound) {
            return;
        }
        root.__lineageMenuClicksBound = true;

        root.addEventListener('click', (evt) => {
            const link = evt.target.closest(MENU_LINK_SELECTOR);
            if (!link) return;
            if (!root.contains(link)) return;

            evt.preventDefault();

            const clergyIdAttr = link.getAttribute('data-clergy-id');
            if (!clergyIdAttr) return;

            const clergyId = Number.isFinite(Number(clergyIdAttr))
                ? Number(clergyIdAttr)
                : clergyIdAttr;

            // Bridge into the editor selection logic
            if (typeof window.selectClergy === 'function') {
                window
                    .selectClergy(clergyId)
                    .then?.(() => {
                        highlightSelectedMenuRow(clergyId, { scrollIntoView: false });
                    })
                    .catch?.(() => {
                        highlightSelectedMenuRow(clergyId, { scrollIntoView: false });
                    });
            } else {
                // Fallback: just highlight in menu for now
                highlightSelectedMenuRow(clergyId, { scrollIntoView: false });
            }
        });
    }

    /**
     * Initialize menu behavior:
     * - Apply sprite thumbnails
     * - Bridge row clicks
     * - Re-apply selection from `window.currentSelectedClergyId`
     */
    function initializeEditorLineageMenu() {
        const root = getMenuRoot();
        if (!root) return;

        bindMenuClickHandlers();
        applySpriteThumbnails();

        if (window.currentSelectedClergyId) {
            highlightSelectedMenuRow(window.currentSelectedClergyId, {
                scrollIntoView: false,
            });
        }
    }

    /**
     * Wire into initial DOM load.
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeEditorLineageMenu);
    } else {
        initializeEditorLineageMenu();
    }

    /**
     * Re-run initialization whenever HTMX swaps the center panel content.
     */
    if (typeof document.body !== 'undefined') {
        document.body.addEventListener('htmx:afterSwap', function (evt) {
            const target = evt.detail && evt.detail.target;
            if (!target || target.id !== CENTER_PANEL_ID) {
                return;
            }
            initializeEditorLineageMenu();
        });
    }

    // Expose helpers for debugging / potential reuse
    if (typeof window !== 'undefined') {
        window.initializeEditorLineageMenu = initializeEditorLineageMenu;
        window.applyEditorLineageMenuSprites = applySpriteThumbnails;
        window.highlightEditorLineageMenuRow = highlightSelectedMenuRow;
    }
})();

