(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const TAG_PICKER_STATE = {
    tags: [],
    selectedIds: new Set(),
    container: null,
    hiddenInput: null,
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
    return fetch('/editor-v2/api/tags', {
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

  function renderTagPills() {
    const container = TAG_PICKER_STATE.container;
    if (!container) {
      return;
    }

    container.textContent = '';

    if (!TAG_PICKER_STATE.tags || TAG_PICKER_STATE.tags.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tag-picker-empty';
      empty.textContent = 'No tags available.';
      container.appendChild(empty);
      return;
    }

    TAG_PICKER_STATE.tags.forEach((tag) => {
      if (!tag || tag.id == null) {
        return;
      }
      const label = (tag.label || tag.name || '').trim() || String(tag.id);
      const colorHex = (tag.color_hex || '').trim() || '#000000';

      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'tag-pill';
      pill.setAttribute('data-tag-id', String(tag.id));
      pill.style.backgroundColor = colorHex;
      pill.style.color = textColorForBg(colorHex);

      const textSpan = document.createElement('span');
      textSpan.className = 'tag-pill__label';
      textSpan.textContent = label;
      pill.appendChild(textSpan);

      if (TAG_PICKER_STATE.selectedIds.has(tag.id)) {
        pill.classList.add('tag-pill--selected');
      }

      if (tag.is_system) {
        pill.classList.add('tag-pill--system');
      }

      container.appendChild(pill);
    });
  }

  function toggleTagSelectionById(id) {
    if (id == null) {
      return;
    }
    const numericId = Number(id);
    const hasNumeric = TAG_PICKER_STATE.selectedIds.has(numericId);
    const hasString = TAG_PICKER_STATE.selectedIds.has(String(id));

    if (hasNumeric || hasString) {
      TAG_PICKER_STATE.selectedIds.delete(numericId);
      TAG_PICKER_STATE.selectedIds.delete(String(id));
    } else {
      TAG_PICKER_STATE.selectedIds.add(numericId);
    }

    syncHiddenInput();
    renderTagPills();
  }

  function handleTagPickerClick(event) {
    const target = event.target;
    if (!target || !TAG_PICKER_STATE.container) {
      return;
    }

    const pill = target.closest && target.closest('.tag-pill');
    if (!pill || !TAG_PICKER_STATE.container.contains(pill)) {
      return;
    }

    const id = pill.getAttribute('data-tag-id');
    if (!id) {
      return;
    }

    toggleTagSelectionById(id);
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
    const hiddenInput = form.querySelector('#tags_selected');

    if (!container || !hiddenInput) {
      return;
    }

    TAG_PICKER_STATE.container = container;
    TAG_PICKER_STATE.hiddenInput = hiddenInput;

    form.setAttribute('data-tag-picker-inited', 'true');

    if (!container._editorV2TagPickerBound) {
      container._editorV2TagPickerBound = true;
      container.addEventListener('click', handleTagPickerClick);
    }

    fetchTagsForPicker().then((tags) => {
      if (!Array.isArray(tags)) {
        TAG_PICKER_STATE.tags = [];
      } else {
        TAG_PICKER_STATE.tags = tags;
      }
      preselectFromFormAttributes(form);
      renderTagPills();
      TAG_PICKER_STATE.initialized = true;
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
    const lowerRequested = new Set(
      names
        .filter((n) => typeof n === 'string')
        .map((n) => n.trim().toLowerCase())
        .filter((n) => n.length > 0)
    );

    if (!append) {
      TAG_PICKER_STATE.selectedIds.clear();
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

