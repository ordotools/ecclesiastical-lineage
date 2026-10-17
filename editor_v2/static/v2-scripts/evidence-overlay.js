/**
 * Editor v2 — evidence for one decision, as an overlay on the right (lineage) panel.
 *
 * An Evidence button in the form (or ⌘⇧E in the focused field) opens it: the items already
 * attached, then Add → Photo / PDF / Link / Text. Each item saves on its own through
 * /editor/api/evidence; the clergy form is not involved. Esc closes the innermost thing.
 */
(() => {
    'use strict';

    const API = '/editor/api/evidence';
    const JSON_HEADERS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
    const KIND_LABELS = { photo: 'Photo', pdf: 'PDF', link: 'Link', text: 'Text' };
    const ACCEPT = { photo: 'image/jpeg,image/png,image/gif,image/webp', pdf: 'application/pdf,.pdf' };

    /** { clergy_id, field, event_kind?, event_id? } of the open overlay; null when closed. */
    let slot = null;
    let items = [];
    /** Kind being added; null while the add form is closed. */
    let kind = null;
    let returnFocus = null;
    let previewUrl = null;
    let busy = false;

    function els() {
        const overlay = document.getElementById('evidence-overlay');
        const q = function (sel) { return overlay.querySelector(sel); };
        return overlay && {
            overlay: overlay,
            title: q('[data-evidence-title]'),
            list: q('[data-evidence-list]'),
            empty: q('[data-evidence-empty]'),
            add: q('.evidence-add'),
            form: q('[data-evidence-form]'),
            file: q('#evidence_file'),
            url: q('#evidence_url'),
            text: q('#evidence_text'),
            textLabel: q('[data-evidence-text-label]'),
            preview: q('[data-evidence-preview]'),
            status: q('[data-evidence-status]'),
            save: q('[data-evidence-save]')
        };
    }

    function isOpen() {
        const e = els();
        return !!(e && !e.overlay.hidden);
    }

    function isDirty() {
        const e = els();
        return !!(e && isOpen() && kind && (e.file.files.length || e.url.value.trim() || e.text.value.trim()));
    }

    function setStatusbar(message) {
        const state = document.getElementById('editor-status-save-state');
        if (state) {
            state.textContent = message;
        }
    }

    // --- Form buttons and counts -----------------------------------------

    /** The Evidence button for the field containing `el` (inputs sit in nested .form-field blocks). */
    function buttonForElement(el) {
        let field = el && el.closest ? el.closest('#clergyForm .form-field') : null;
        while (field) {
            const button = field.querySelector(':scope > [data-evidence-field]');
            if (button) {
                return button;
            }
            field = field.parentElement && field.parentElement.closest('#clergyForm .form-field');
        }
        return null;
    }

    function buttonsForSlot(s) {
        const field = '[data-evidence-field="' + s.field + '"]';
        const selector = s.event_kind
            ? field + '[data-event-kind="' + s.event_kind + '"][data-event-id="' + s.event_id + '"]'
            : field + ':not([data-event-kind])';
        return document.querySelectorAll('#clergyForm ' + selector);
    }

    function setCount(n) {
        buttonsForSlot(slot).forEach(function (button) {
            button.classList.toggle('has-evidence', n > 0);
            const count = button.querySelector('[data-evidence-count]');
            if (count) {
                count.textContent = n ? String(n) : '';
            }
        });
    }

    /** "Validity · Consecration 1960-05-05" so several events are told apart. */
    function titleFor(button) {
        const label = button.getAttribute('data-evidence-label') || '';
        const kindName = button.getAttribute('data-event-kind');
        if (!kindName) {
            return label;
        }
        const entry = button.closest('.' + kindName + '-entry');
        const date = entry && (entry.querySelector('input[name$="[date]"]').value ||
            entry.querySelector('input[name$="[year]"]').value);
        const name = kindName.charAt(0).toUpperCase() + kindName.slice(1);
        return label + ' · ' + name + (date ? ' ' + date : '');
    }

    // --- List ----------------------------------------------------------------

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text) {
            node.textContent = text;
        }
        return node;
    }

    function itemElement(item) {
        const li = el('li', 'evidence-item evidence-item--' + item.kind);

        const preview = el(item.url ? 'a' : 'span', 'evidence-item__preview');
        if (item.url) {
            preview.href = item.url;
            preview.target = '_blank';
            preview.rel = 'noopener noreferrer';
            preview.setAttribute('aria-label', 'Open ' + (item.file_name || item.url));
        }
        if (item.thumb_url) {
            const img = el('img');
            img.src = item.thumb_url;
            img.alt = '';
            img.loading = 'lazy';
            preview.appendChild(img);
        } else {
            preview.textContent = KIND_LABELS[item.kind] || item.kind;
        }
        li.appendChild(preview);

        const body = el('div', 'evidence-item__body');
        const title = item.kind === 'link' ? item.url : item.file_name;
        if (title) {
            body.appendChild(el('div', 'evidence-item__title', title));
        }
        if (item.text) {
            body.appendChild(el('div', 'evidence-item__text', item.text));
        }
        const meta = [KIND_LABELS[item.kind], item.created_at, item.created_by].filter(Boolean).join(' · ');
        body.appendChild(el('div', 'evidence-item__meta', meta));
        li.appendChild(body);

        const remove = el('button', 'link-button evidence-item__delete', 'Delete');
        remove.type = 'button';
        remove.setAttribute('data-evidence-delete', String(item.id));
        remove.setAttribute('aria-label', 'Delete ' + (KIND_LABELS[item.kind] || '').toLowerCase() + ' evidence');
        li.appendChild(remove);
        return li;
    }

    function renderItems(e) {
        e.list.textContent = '';
        items.forEach(function (item) {
            e.list.appendChild(itemElement(item));
        });
        e.empty.hidden = items.length > 0;
        setCount(items.length);
    }

    // --- Add form ------------------------------------------------------------

    function clearPreview(e) {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
        e.preview.hidden = true;
        e.preview.removeAttribute('src');
    }

    function updatePreview(e) {
        clearPreview(e);
        const file = e.file.files[0];
        if (kind === 'photo' && file && file.type.indexOf('image/') === 0) {
            previewUrl = URL.createObjectURL(file);
            e.preview.src = previewUrl;
            e.preview.hidden = false;
        }
    }

    function closeForm(e) {
        kind = null;
        e.form.reset();
        clearPreview(e);
        e.status.textContent = '';
        e.form.hidden = true;
        e.add.hidden = false;
    }

    function openForm(e, newKind, file) {
        closeForm(e);
        kind = newKind;
        e.form.querySelectorAll('[data-evidence-for]').forEach(function (block) {
            block.hidden = block.getAttribute('data-evidence-for').split(' ').indexOf(kind) === -1;
        });
        e.file.accept = ACCEPT[kind] || '';
        e.textLabel.textContent = kind === 'text' ? 'Text' : 'Caption (optional)';
        e.text.rows = kind === 'text' ? 10 : 3;
        e.save.textContent = 'Save ' + KIND_LABELS[kind].toLowerCase();
        e.add.hidden = true;
        e.form.hidden = false;
        if (file) {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            e.file.files = transfer.files;
            updatePreview(e);
            e.text.focus();
        } else if (kind === 'link') {
            e.url.focus();
        } else if (kind === 'text') {
            e.text.focus();
        } else {
            e.file.focus();
            e.file.click(); // still inside the click/keypress that chose the kind
        }
    }

    /** Close the add form, asking first if it has input. True if it closed. */
    function cancelForm(e) {
        if (isDirty() && !window.confirm('Discard this evidence?')) {
            return false;
        }
        closeForm(e);
        const first = e.add.querySelector('[data-evidence-kind]');
        if (first) {
            first.focus();
        }
        return true;
    }

    function missingInput(e) {
        if ((kind === 'photo' || kind === 'pdf') && !e.file.files.length) {
            return [e.file, 'Choose a file.'];
        }
        if (kind === 'link' && !e.url.value.trim()) {
            return [e.url, 'Enter the link.'];
        }
        if (kind === 'text' && !e.text.value.trim()) {
            return [e.text, 'Write the text.'];
        }
        return null;
    }

    function save() {
        const e = els();
        if (!e || !slot || !kind || busy) {
            return;
        }
        const missing = missingInput(e);
        if (missing) {
            e.status.textContent = missing[1];
            missing[0].focus();
            return;
        }
        const data = new FormData();
        Object.keys(slot).forEach(function (key) {
            data.append(key, slot[key]);
        });
        data.append('kind', kind);
        data.append('text', e.text.value);
        if (kind === 'link') {
            const link = e.url.value.trim();
            // "example.org/page" → "https://example.org/page"; the server still checks it.
            data.append('url', /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : 'https://' + link);
        }
        if ((kind === 'photo' || kind === 'pdf') && e.file.files[0]) {
            data.append('file', e.file.files[0]);
        }

        const savingFor = slot;
        busy = true;
        e.save.disabled = true;
        e.status.textContent = kind === 'photo' || kind === 'pdf' ? 'Uploading…' : 'Saving…';
        fetch(API, { method: 'POST', headers: JSON_HEADERS, body: data })
            .then(function (response) {
                return response.json().then(function (body) {
                    return { ok: !!(response.ok && body && body.success), body: body || {} };
                });
            })
            .catch(function () {
                return { ok: false, body: {} };
            })
            .then(function (result) {
                busy = false;
                e.save.disabled = false;
                if (slot !== savingFor) {
                    return; // overlay closed or moved on; the item is saved and shows next time
                }
                if (!result.ok) {
                    e.status.textContent = result.body.message || 'Evidence not saved. Try again.';
                    return;
                }
                items.unshift(result.body.item);
                renderItems(e);
                closeForm(e);
                e.add.querySelector('[data-evidence-kind]').focus();
                setStatusbar('Evidence saved');
            });
    }

    function removeItem(id) {
        const e = els();
        if (!e || !window.confirm('Delete this evidence? Files are removed from storage.')) {
            return;
        }
        fetch(API + '/' + encodeURIComponent(id), { method: 'DELETE', headers: JSON_HEADERS })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('delete failed');
                }
                items = items.filter(function (item) { return item.id !== id; });
                renderItems(e);
                e.add.querySelector('[data-evidence-kind]').focus();
                setStatusbar('Evidence deleted');
            })
            .catch(function () {
                setStatusbar('Evidence not deleted. Try again.');
            });
    }

    // --- Open / close --------------------------------------------------------

    function close() {
        const e = els();
        if (!e || e.overlay.hidden) {
            return;
        }
        const hadFocus = e.overlay.contains(document.activeElement);
        closeForm(e);
        e.overlay.hidden = true;
        slot = null;
        items = [];
        if (hadFocus && returnFocus && returnFocus.isConnected) {
            returnFocus.focus();
        }
        returnFocus = null;
    }

    /** Close, asking first if the add form has input. True if it closed (or was not open). */
    function cancel() {
        if (isDirty() && !window.confirm('Discard this evidence?')) {
            return false;
        }
        close();
        return true;
    }

    function open(button) {
        const e = els();
        const form = document.getElementById('clergyForm');
        const clergyId = form && form.getAttribute('data-clergy-id');
        if (!e || !button || !clergyId) {
            return;
        }
        const wiki = window.EDITOR_V2_WIKI;
        if (!cancel() || (wiki && !wiki.cancel())) {
            return;
        }
        const next = { clergy_id: clergyId, field: button.getAttribute('data-evidence-field') };
        if (button.hasAttribute('data-event-kind')) {
            next.event_kind = button.getAttribute('data-event-kind');
            next.event_id = button.getAttribute('data-event-id');
        }
        slot = next;
        items = [];
        returnFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : button;
        e.title.textContent = titleFor(button);
        e.list.textContent = '';
        e.empty.hidden = false;
        e.empty.textContent = 'Loading…';
        e.add.hidden = false;
        e.overlay.hidden = false;
        e.overlay.scrollTop = 0;
        e.add.querySelector('[data-evidence-kind]').focus();

        const loadingFor = slot;
        fetch(API + '?' + new URLSearchParams(slot).toString(), { headers: JSON_HEADERS })
            .then(function (response) {
                return response.json().then(function (body) {
                    if (!response.ok || !body.success) {
                        throw new Error(body.message || 'Evidence failed to load.');
                    }
                    return body.items || [];
                });
            })
            .then(function (loaded) {
                if (slot !== loadingFor) {
                    return;
                }
                items = loaded;
                e.empty.textContent = 'No evidence yet.';
                renderItems(e);
            })
            .catch(function (err) {
                if (slot === loadingFor) {
                    e.empty.textContent = err.message || 'Evidence failed to load.';
                }
            });
    }

    function kindForFile(file) {
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
            return 'pdf';
        }
        return file.type.indexOf('image/') === 0 ? 'photo' : null;
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
            const e = els();
            const opener = t.closest('[data-evidence-field]');
            if (opener) {
                open(opener);
            } else if (!e || !e.overlay.contains(t)) {
                return;
            } else if (t.closest('[data-evidence-close]')) {
                cancel();
            } else if (t.closest('[data-evidence-cancel]')) {
                cancelForm(e);
            } else if (t.closest('[data-evidence-kind]')) {
                openForm(e, t.closest('[data-evidence-kind]').getAttribute('data-evidence-kind'));
            } else if (t.closest('[data-evidence-delete]')) {
                removeItem(Number(t.closest('[data-evidence-delete]').getAttribute('data-evidence-delete')));
            }
        });

        document.addEventListener('submit', function (event) {
            if (event.target.matches && event.target.matches('[data-evidence-form]')) {
                event.preventDefault();
                save();
            }
        });

        document.addEventListener('change', function (event) {
            if (event.target.id === 'evidence_file') {
                updatePreview(els());
            }
        });

        // Drop a photo or PDF anywhere on the overlay to start adding it.
        document.addEventListener('dragover', function (event) {
            const e = els();
            if (e && isOpen() && e.overlay.contains(event.target)) {
                event.preventDefault();
                e.overlay.classList.add('is-drop-target');
            }
        });
        document.addEventListener('dragleave', function (event) {
            const e = els();
            if (e && !e.overlay.contains(event.relatedTarget)) {
                e.overlay.classList.remove('is-drop-target');
            }
        });
        document.addEventListener('drop', function (event) {
            const e = els();
            if (!e || !isOpen() || !e.overlay.contains(event.target)) {
                return;
            }
            event.preventDefault();
            e.overlay.classList.remove('is-drop-target');
            const file = event.dataTransfer && event.dataTransfer.files[0];
            const fileKind = file && kindForFile(file);
            if (!fileKind) {
                setStatusbar('Drop a photo (JPEG, PNG, GIF, WebP) or a PDF.');
            } else if (kind && kind !== fileKind && !cancelForm(e)) {
                return;
            } else if (kind === fileKind) {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                e.file.files = transfer.files;
                updatePreview(e);
            } else {
                openForm(e, fileKind, file);
            }
        });

        document.addEventListener('keydown', function (event) {
            if (isMod(event) && event.shiftKey && event.key.toLowerCase() === 'e') {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (isOpen()) {
                    cancel();
                    return;
                }
                const button = buttonForElement(document.activeElement);
                if (button) {
                    open(button);
                } else {
                    setStatusbar('No evidence for this field');
                }
                return;
            }
            const e = els();
            if (!e || !isOpen() || !e.overlay.contains(event.target)) {
                return;
            }
            // Keys inside the overlay belong to the evidence, not the form or search.
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (kind) {
                    cancelForm(e);
                } else {
                    cancel();
                }
            } else if (isMod(event) && (event.key === 's' || event.key === 'Enter')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                save();
            }
        }, true);

        // Another clergy was opened: the evidence belongs to the previous one.
        document.body.addEventListener('clergySelected', function (event) {
            const id = event.detail ? event.detail.clergyId : null;
            if (isOpen() && slot && String(id) !== String(slot.clergy_id)) {
                close();
            }
        });
    }

    window.EDITOR_V2_EVIDENCE = {
        open: open,
        close: close,
        cancel: cancel,
        isDirty: isDirty,
        clergyId: function () { return slot ? Number(slot.clergy_id) : null; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
