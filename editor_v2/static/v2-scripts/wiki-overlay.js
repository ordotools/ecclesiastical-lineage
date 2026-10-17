/**
 * Editor v2 — wiki editor as an overlay on the right (lineage) panel.
 *
 * The form's "Edit wiki" button (or ⌘E) opens it for the clergy in the form.
 * Save writes only the wiki, then closes so the lineage view shows again.
 * The wiki is never saved if it failed to load, so a bad load cannot wipe a page.
 */
(() => {
    'use strict';

    const JSON_HEADERS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };

    let clergyId = null;
    /** What was loaded ({ content, is_visible }); null until loaded. */
    let initial = null;

    function els() {
        const overlay = document.getElementById('wiki-overlay');
        return overlay && {
            overlay: overlay,
            text: overlay.querySelector('#wiki_markdown'),
            visible: overlay.querySelector('#wiki_is_visible'),
            title: overlay.querySelector('[data-wiki-title]'),
            status: overlay.querySelector('[data-wiki-status]'),
            save: overlay.querySelector('[data-wiki-save]')
        };
    }

    function current(e) {
        return { content: e.text.value, is_visible: e.visible.checked };
    }

    function isOpen() {
        const e = els();
        return !!(e && !e.overlay.hidden);
    }

    function isDirty() {
        const e = els();
        if (!isOpen() || !initial) {
            return false;
        }
        const now = current(e);
        return now.content !== initial.content || now.is_visible !== initial.is_visible;
    }

    function setStatus(e, message) {
        e.status.textContent = message || '';
    }

    function close() {
        const e = els();
        if (!e || e.overlay.hidden) {
            return;
        }
        const hadFocus = e.overlay.contains(document.activeElement);
        e.overlay.hidden = true;
        clergyId = null;
        initial = null;
        const button = document.querySelector('[data-wiki-open]');
        if (hadFocus && button) {
            button.focus();
        }
    }

    function open() {
        const e = els();
        const form = document.getElementById('clergyForm');
        const id = form ? parseInt(form.getAttribute('data-clergy-id'), 10) : NaN;
        if (!e || !Number.isFinite(id)) {
            return;
        }
        clergyId = id;
        initial = null;
        const name = form.querySelector('#name');
        e.title.textContent = name ? name.value : '';
        e.text.value = '';
        e.text.disabled = true;
        e.save.disabled = true;
        setStatus(e, 'Loading…');
        e.overlay.hidden = false;
        if (e.overlay.parentElement) {
            e.overlay.parentElement.scrollTop = 0;
        }

        fetch('/editor/api/wiki/' + encodeURIComponent(id), { headers: JSON_HEADERS })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Failed to load wiki page.');
                }
                return response.json();
            })
            .then(function (data) {
                if (clergyId !== id) {
                    return; // closed or switched while loading
                }
                const wiki = (data && data.wiki) || {};
                initial = {
                    content: typeof wiki.content === 'string' ? wiki.content : '',
                    is_visible: typeof wiki.is_visible === 'boolean' ? wiki.is_visible : true
                };
                e.text.value = initial.content;
                e.visible.checked = initial.is_visible;
                e.text.disabled = false;
                e.save.disabled = false;
                setStatus(e, '');
                e.text.focus();
            })
            .catch(function () {
                if (clergyId === id) {
                    setStatus(e, 'Wiki failed to load; nothing will be saved.');
                }
            });
    }

    function cancel() {
        if (isDirty() && !window.confirm('Discard wiki changes?')) {
            return;
        }
        close();
    }

    function save() {
        const e = els();
        if (!e || !initial || clergyId == null) {
            return;
        }
        if (!isDirty()) {
            close();
            return;
        }
        const payload = Object.assign({ clergy_id: clergyId }, current(e));
        e.save.disabled = true;
        setStatus(e, 'Saving…');
        fetch('/editor/api/wiki/save', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, JSON_HEADERS),
            body: JSON.stringify(payload)
        })
            .then(function (response) {
                return response.json().then(function (body) {
                    return !!(response.ok && body && body.success === true);
                });
            })
            .catch(function () {
                return false;
            })
            .then(function (ok) {
                if (!ok) {
                    e.save.disabled = false;
                    setStatus(e, 'Wiki not saved. Try again.');
                    return;
                }
                initial = null;
                close();
                const state = document.getElementById('editor-status-save-state');
                if (state) {
                    state.textContent = 'Wiki saved';
                }
            });
    }

    function isMod(event) {
        return event.metaKey || event.ctrlKey;
    }

    function init() {
        document.addEventListener('click', function (event) {
            const t = event.target;
            if (!t || !t.closest) {
                return;
            }
            if (t.closest('[data-wiki-open]')) {
                open();
            } else if (t.closest('[data-wiki-save]')) {
                save();
            } else if (t.closest('[data-wiki-cancel]')) {
                cancel();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (isMod(event) && event.key === 'e') {
                event.preventDefault();
                if (isOpen()) {
                    cancel();
                } else {
                    open();
                }
                return;
            }
            if (!isOpen() || !event.target.closest || !event.target.closest('#wiki-overlay')) {
                return;
            }
            // Keys inside the overlay belong to the wiki, not the form or search.
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                cancel();
            } else if (isMod(event) && (event.key === 's' || event.key === 'Enter')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                save();
            }
        }, true);

        // Another clergy was opened: the wiki belongs to the previous one.
        document.body.addEventListener('clergySelected', function (event) {
            const id = event.detail ? event.detail.clergyId : null;
            if (isOpen() && id !== clergyId) {
                initial = null;
                close();
            }
        });

        // No overlay on the page (e.g. a host without it): hide the button.
        document.body.addEventListener('htmx:afterSwap', function () {
            const available = !!els();
            document.querySelectorAll('[data-wiki-open]').forEach(function (b) {
                b.hidden = !available;
            });
        });
    }

    window.EDITOR_V2_WIKI = {
        open: open,
        close: close,
        isDirty: isDirty,
        clergyId: function () { return clergyId; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
