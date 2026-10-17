(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const TAG_PICKER_STATE = {
    tags: [],
    selectedIds: new Set(),
    container: null,
    input: null,
    list: null,
    hiddenInput: null,
    matches: [],
    active: -1,
    initialized: false
  };

  function textColorForBg(hex) {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#' || (hex.length !== 7 && hex.length !== 4)) {
      return '#000000';
    }

    let r;
    let g;
    let b;

    if (hex.length === 4) {
      const rHex = hex[1] + hex[1];
      const gHex = hex[2] + hex[2];
      const bHex = hex[3] + hex[3];
      r = parseInt(rHex, 16) / 255;
      g = parseInt(gHex, 16) / 255;
      b = parseInt(bHex, 16) / 255;
    } else {
      r = parseInt(hex.slice(1, 3), 16) / 255;
      g = parseInt(hex.slice(3, 5), 16) / 255;
      b = parseInt(hex.slice(5, 7), 16) / 255;
    }

    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
      return '#000000';
    }

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  function fetchTagsForPicker() {
    return fetch('/editor/api/tags', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
      .then((response) => {
        if (!response || !response.ok) {
          return [];
        }
        return response.json().catch(() => []);
      })
      .catch(() => []);
  }

  function syncHiddenInput() {
    if (!TAG_PICKER_STATE.hiddenInput) {
      return;
    }
    const ids = Array.from(TAG_PICKER_STATE.selectedIds);
    TAG_PICKER_STATE.hiddenInput.value = ids.join(',');
  }

  function tagLabel(tag) {
    return (tag.label || tag.name || '').trim() || String(tag.id);
  }

  function isSelected(tag) {
    return TAG_PICKER_STATE.selectedIds.has(tag.id);
  }

  /** Selected tags as chips in front of the search input. */
  function renderTagPills() {
    const container = TAG_PICKER_STATE.container;
    const input = TAG_PICKER_STATE.input;
    if (!container || !input) {
      return;
    }

    container.querySelectorAll('.tag-pill').forEach((el) => el.remove());

    TAG_PICKER_STATE.tags.forEach((tag) => {
      if (!tag || tag.id == null || !isSelected(tag)) {
        return;
      }
      const label = tagLabel(tag);
      const colorHex = (tag.color_hex || '').trim() || '#000000';

      const pill = document.createElement('span');
      pill.className = 'tag-pill tag-pill--selected' + (tag.is_system ? ' tag-pill--system' : '');
      pill.style.backgroundColor = colorHex;
      pill.style.color = textColorForBg(colorHex);

      const textSpan = document.createElement('span');
      textSpan.className = 'tag-pill__label';
      textSpan.textContent = label;
      pill.appendChild(textSpan);

      // Not a tab stop: Backspace in the search box removes chips from the keyboard.
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tag-pill__remove';
      remove.tabIndex = -1;
      remove.setAttribute('data-tag-id', String(tag.id));
      remove.setAttribute('aria-label', 'Remove ' + label);
      remove.textContent = '×';
      pill.appendChild(remove);

      container.insertBefore(pill, input);
    });

    input.placeholder = TAG_PICKER_STATE.tags.length ? 'Add tag…' : 'No tags available';
  }

  // --- Search suggestions ------------------------------------------------

  function matchingTags() {
    const query = TAG_PICKER_STATE.input.value.trim().toLowerCase();
    return TAG_PICKER_STATE.tags.filter((tag) => (
      tag && tag.id != null && !isSelected(tag) && tagLabel(tag).toLowerCase().includes(query)
    ));
  }

  function closeSuggestions() {
    const list = TAG_PICKER_STATE.list;
    if (list) {
      list.hidden = true;
      list.textContent = '';
    }
    TAG_PICKER_STATE.matches = [];
    TAG_PICKER_STATE.active = -1;
    if (TAG_PICKER_STATE.input) {
      TAG_PICKER_STATE.input.setAttribute('aria-expanded', 'false');
    }
  }

  function renderSuggestions() {
    const list = TAG_PICKER_STATE.list;
    const matches = matchingTags();
    TAG_PICKER_STATE.matches = matches;
    if (TAG_PICKER_STATE.active >= matches.length) {
      TAG_PICKER_STATE.active = matches.length - 1;
    }
    if (!list || !matches.length) {
      closeSuggestions();
      return;
    }
    list.textContent = '';
    matches.forEach((tag, i) => {
      const option = document.createElement('div');
      option.className = 'tag-suggestion' + (i === TAG_PICKER_STATE.active ? ' is-active' : '');
      option.setAttribute('role', 'option');
      option.setAttribute('data-index', String(i));
      const swatch = document.createElement('span');
      swatch.className = 'tag-suggestion__swatch';
      swatch.style.backgroundColor = (tag.color_hex || '').trim() || '#000000';
      option.appendChild(swatch);
      option.appendChild(document.createTextNode(tagLabel(tag)));
      list.appendChild(option);
    });
    list.hidden = false;
    TAG_PICKER_STATE.input.setAttribute('aria-expanded', 'true');
  }

  /** A change made by the user (not auto-tagging): update chips and mark the form edited. */
  function userSetSelected(id, selected) {
    if (selected) {
      TAG_PICKER_STATE.selectedIds.add(id);
    } else {
      TAG_PICKER_STATE.selectedIds.delete(id);
    }
    syncHiddenInput();
    renderTagPills();
    document.body.dispatchEvent(new CustomEvent('editor:formEdited'));
  }

  function pick(index) {
    const tag = TAG_PICKER_STATE.matches[index];
    if (!tag) {
      return;
    }
    userSetSelected(tag.id, true);
    TAG_PICKER_STATE.input.value = '';
    TAG_PICKER_STATE.active = 0;
    renderSuggestions();
  }

  function handleSearchKeydown(event) {
    const count = TAG_PICKER_STATE.matches.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (TAG_PICKER_STATE.list.hidden) {
        TAG_PICKER_STATE.active = 0;
        renderSuggestions();
        return;
      }
      if (!count) {
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      TAG_PICKER_STATE.active = (TAG_PICKER_STATE.active + step + count) % count;
      renderSuggestions();
    } else if (event.key === 'Enter') {
      event.preventDefault(); // never submit the form from the tag box
      if (!TAG_PICKER_STATE.list.hidden && TAG_PICKER_STATE.active >= 0) {
        pick(TAG_PICKER_STATE.active);
      }
    } else if (event.key === 'Escape') {
      if (!TAG_PICKER_STATE.list.hidden) {
        event.stopPropagation();
        closeSuggestions();
      }
    } else if (event.key === 'Backspace' && !TAG_PICKER_STATE.input.value) {
      const ids = Array.from(TAG_PICKER_STATE.selectedIds);
      if (ids.length) {
        userSetSelected(ids[ids.length - 1], false);
      }
    } else if (event.key === 'Tab') {
      closeSuggestions();
    }
  }

  function bindSearch() {
    const { container, input, list } = TAG_PICKER_STATE;
    input.addEventListener('input', () => {
      TAG_PICKER_STATE.active = 0;
      renderSuggestions();
    });
    input.addEventListener('focus', () => {
      TAG_PICKER_STATE.active = 0;
      renderSuggestions();
    });
    input.addEventListener('blur', closeSuggestions);
    input.addEventListener('keydown', handleSearchKeydown);
    // mousedown + preventDefault keeps focus in the input, so blur does not close the list first.
    list.addEventListener('mousedown', (event) => {
      const option = event.target.closest('.tag-suggestion');
      event.preventDefault();
      if (option) {
        pick(Number(option.getAttribute('data-index')));
      }
    });
    container.addEventListener('click', (event) => {
      const remove = event.target.closest('.tag-pill__remove');
      if (remove) {
        userSetSelected(Number(remove.getAttribute('data-tag-id')), false);
      }
      input.focus();
    });
  }

  function parseCommaSeparated(value) {
    if (!value) {
      return [];
    }
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  function buildTagIndexes(tags) {
    const byId = new Map();
    const byLabel = new Map();
    const byName = new Map();

    tags.forEach((tag) => {
      if (!tag || tag.id == null) {
        return;
      }
      byId.set(tag.id, tag);

      const label = (tag.label || '').trim();
      const name = (tag.name || '').trim();

      if (label) {
        byLabel.set(label.toLowerCase(), tag);
      }
      if (name) {
        byName.set(name.toLowerCase(), tag);
      }
    });

    return { byId, byLabel, byName };
  }

  function preselectFromFormAttributes(form) {
    const hidden = TAG_PICKER_STATE.hiddenInput;
    const tags = TAG_PICKER_STATE.tags || [];

    TAG_PICKER_STATE.selectedIds.clear();

    const { byId, byLabel, byName } = buildTagIndexes(tags);

    if (hidden && hidden.value) {
      const rawIds = parseCommaSeparated(hidden.value);
      rawIds.forEach((raw) => {
        const num = Number(raw);
        if (byId.has(num)) {
          TAG_PICKER_STATE.selectedIds.add(num);
        }
      });
    } else {
      const initialLabelsRaw = (form.getAttribute('data-initial-tags') || '').trim();
      const labels = parseCommaSeparated(initialLabelsRaw);
      labels.forEach((label) => {
        const lower = label.toLowerCase();
        const byLabelTag = byLabel.get(lower);
        const byNameTag = byName.get(lower);
        const tag = byLabelTag || byNameTag;
        if (tag && tag.id != null) {
          TAG_PICKER_STATE.selectedIds.add(tag.id);
        }
      });
    }

    syncHiddenInput();
  }

  function initializeTagPickerForForm(form) {
    if (!form || form.getAttribute('data-tag-picker-inited') === 'true') {
      return;
    }

    const container = form.querySelector('#tagPicker');
    const input = form.querySelector('#tagSearch');
    const list = form.querySelector('#tagSuggestions');
    const hiddenInput = form.querySelector('#tags_selected');

    if (!container || !input || !list || !hiddenInput) {
      return;
    }

    TAG_PICKER_STATE.container = container;
    TAG_PICKER_STATE.input = input;
    TAG_PICKER_STATE.list = list;
    TAG_PICKER_STATE.hiddenInput = hiddenInput;
    closeSuggestions();

    form.setAttribute('data-tag-picker-inited', 'true');
    bindSearch();

    fetchTagsForPicker().then((tags) => {
      if (!Array.isArray(tags)) {
        TAG_PICKER_STATE.tags = [];
      } else {
        TAG_PICKER_STATE.tags = tags;
      }
      preselectFromFormAttributes(form);
      renderTagPills();
      TAG_PICKER_STATE.initialized = true;
      document.body.dispatchEvent(new CustomEvent('editor:tagPickerReady'));
    });
  }

  function initTagPickerFromDom() {
    const form = document.getElementById('clergyForm');
    if (!form) {
      return;
    }
    initializeTagPickerForForm(form);
  }

  function setSelectedByIds(ids, options) {
    if (!Array.isArray(ids) || !TAG_PICKER_STATE.container) {
      return;
    }
    const opts = options || {};
    const append = !!opts.append;

    if (!append) {
      TAG_PICKER_STATE.selectedIds.clear();
    }

    ids.forEach((raw) => {
      const num = Number(raw);
      if (Number.isFinite(num)) {
        TAG_PICKER_STATE.selectedIds.add(num);
      }
    });

    syncHiddenInput();
    renderTagPills();
  }

  function setSelectedByNames(names, options) {
    if (!Array.isArray(names) || !TAG_PICKER_STATE.tags || !TAG_PICKER_STATE.tags.length) {
      return;
    }
    const opts = options || {};
    const append = !!opts.append;
    const replaceSystem = !!opts.replaceSystem;
    const lowerRequested = new Set(
      names
        .filter((n) => typeof n === 'string')
        .map((n) => n.trim().toLowerCase())
        .filter((n) => n.length > 0)
    );

    if (!append) {
      TAG_PICKER_STATE.selectedIds.clear();
    } else if (replaceSystem) {
      TAG_PICKER_STATE.tags.forEach((tag) => {
        if (tag && tag.is_system && tag.id != null) {
          TAG_PICKER_STATE.selectedIds.delete(tag.id);
        }
      });
    }

    TAG_PICKER_STATE.tags.forEach((tag) => {
      if (!tag || tag.id == null) {
        return;
      }
      const label = (tag.label || '').trim().toLowerCase();
      const name = (tag.name || '').trim().toLowerCase();
      if (lowerRequested.has(label) || lowerRequested.has(name)) {
        TAG_PICKER_STATE.selectedIds.add(tag.id);
      }
    });

    syncHiddenInput();
    renderTagPills();
  }

  function getSelectedIds() {
    return Array.from(TAG_PICKER_STATE.selectedIds);
  }

  window.EDITOR_V2_TAGS = window.EDITOR_V2_TAGS || {};
  window.EDITOR_V2_TAGS.initTagPicker = initTagPickerFromDom;
  window.EDITOR_V2_TAGS.setSelectedByIds = setSelectedByIds;
  window.EDITOR_V2_TAGS.setSelectedByNames = setSelectedByNames;
  window.EDITOR_V2_TAGS.getSelectedIds = getSelectedIds;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTagPickerFromDom();
    });
  } else {
    initTagPickerFromDom();
  }

  if (document.body && typeof document.body.addEventListener === 'function') {
    document.body.addEventListener('htmx:afterSwap', () => {
      initTagPickerFromDom();
    });
  }
})();

