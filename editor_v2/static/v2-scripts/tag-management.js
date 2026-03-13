(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const TAG_STATE = {
    tags: [],
    isLoading: false,
    isSubmitting: false,
    overlayInited: false
  };

  function getOverlay() {
    return document.getElementById('editorV2TagOverlay');
  }

  function getTagList() {
    return document.getElementById('editorV2TagList');
  }

  function getForm() {
    return document.getElementById('editorV2TagForm');
  }

  function getLabelInput() {
    return document.getElementById('editorV2TagLabel');
  }

  function getColorInput() {
    return document.getElementById('editorV2TagColor');
  }

  function getPreview() {
    return document.getElementById('editorV2TagPreview');
  }

  function getCancelButton() {
    return document.getElementById('editorV2TagCancel');
  }

  function getAddButton() {
    return document.getElementById('editorV2TagAdd');
  }

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

  function updatePreview() {
    const preview = getPreview();
    const colorInput = getColorInput();
    if (!preview || !colorInput) {
      return;
    }
    const hex = colorInput.value || '#000000';
    preview.style.backgroundColor = hex;
    preview.style.color = textColorForBg(hex);
  }

  function renderTags(tags) {
    const list = getTagList();
    if (!list) {
      return;
    }

    list.textContent = '';

    if (!tags || !tags.length) {
      const empty = document.createElement('div');
      empty.className = 'editor-tag-overlay-empty';
      empty.textContent = 'No tags yet.';
      list.appendChild(empty);
      return;
    }

    tags.forEach((tag) => {
      if (!tag || tag.id == null) {
        return;
      }
      const label = (tag.label || tag.name || '').trim() || String(tag.id);
      const colorHex = (tag.color_hex || '').trim() || '#000000';
      const isSystem = !!tag.is_system;

      const pill = document.createElement('div');
      pill.className = 'editor-tag-pill';
      pill.setAttribute('data-tag-id', String(tag.id));
      pill.style.backgroundColor = colorHex;
      pill.style.color = textColorForBg(colorHex);

      const textSpan = document.createElement('span');
      textSpan.className = 'editor-tag-pill-label';
      textSpan.textContent = label;
      pill.appendChild(textSpan);

      if (isSystem) {
        const systemBadge = document.createElement('span');
        systemBadge.className = 'editor-tag-pill-badge';
        systemBadge.textContent = 'system';
        pill.appendChild(systemBadge);
      } else {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'editor-tag-pill-delete';
        deleteButton.setAttribute('data-tag-id', String(tag.id));
        deleteButton.textContent = 'Delete';
        pill.appendChild(deleteButton);
      }

      list.appendChild(pill);
    });
  }

  function fetchTags() {
    TAG_STATE.isLoading = true;
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
      .catch(() => [])
      .finally(() => {
        TAG_STATE.isLoading = false;
      });
  }

  function reloadTags() {
    return fetchTags().then((tags) => {
      if (!Array.isArray(tags)) {
        TAG_STATE.tags = [];
      } else {
        TAG_STATE.tags = tags;
      }
      renderTags(TAG_STATE.tags);
    });
  }

  function disableFormWhileSubmitting(disabled) {
    const form = getForm();
    const addButton = getAddButton();
    const labelInput = getLabelInput();
    const colorInput = getColorInput();

    if (form) {
      form.classList.toggle('editor-tag-overlay-form--submitting', !!disabled);
    }
    if (addButton) {
      addButton.disabled = !!disabled;
    }
    if (labelInput) {
      labelInput.readOnly = !!disabled;
    }
    if (colorInput) {
      colorInput.disabled = !!disabled;
    }
  }

  function createTag(label, colorHex) {
    const trimmedLabel = (label || '').trim();
    const hex = (colorHex || '').trim() || '#000000';
    if (!trimmedLabel || TAG_STATE.isSubmitting) {
      return;
    }
    TAG_STATE.isSubmitting = true;
    disableFormWhileSubmitting(true);

    const payload = {
      label: trimmedLabel,
      color_hex: hex
    };

    return fetch('/editor-v2/api/tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })
      .catch(() => null)
      .then(() => {
        const labelInput = getLabelInput();
        if (labelInput) {
          labelInput.value = '';
        }
        updatePreview();
        return reloadTags();
      })
      .finally(() => {
        TAG_STATE.isSubmitting = false;
        disableFormWhileSubmitting(false);
      });
  }

  function deleteTag(id) {
    if (!id || TAG_STATE.isSubmitting) {
      return;
    }
    TAG_STATE.isSubmitting = true;

    return fetch('/editor-v2/api/tags/' + encodeURIComponent(String(id)), {
      method: 'DELETE',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
      .catch(() => null)
      .then(() => reloadTags())
      .finally(() => {
        TAG_STATE.isSubmitting = false;
      });
  }

  function openTagModal() {
    const overlay = getOverlay();
    if (!overlay) {
      return;
    }
    if (!TAG_STATE.overlayInited) {
      initOverlayOnce();
    }

    overlay.classList.remove('editor-tag-overlay--hidden');
    overlay.setAttribute('aria-hidden', 'false');

    updatePreview();

    const labelInput = getLabelInput();
    if (labelInput) {
      labelInput.focus();
      labelInput.select();
    }

    if (!TAG_STATE.tags || TAG_STATE.tags.length === 0) {
      reloadTags();
    }
  }

  function closeTagModal() {
    const overlay = getOverlay();
    if (!overlay) {
      return;
    }
    overlay.classList.add('editor-tag-overlay--hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function handleFormSubmit(event) {
    const form = getForm();
    if (!form || event.target !== form) {
      return;
    }
    event.preventDefault();

    const labelInput = getLabelInput();
    const colorInput = getColorInput();
    const label = labelInput ? labelInput.value : '';
    const colorHex = colorInput ? colorInput.value : '#000000';

    createTag(label, colorHex);
  }

  function handleColorInputChange() {
    updatePreview();
  }

  function handleTagListClick(event) {
    const target = event.target;
    if (!target) {
      return;
    }
    const deleteButton = target.closest && target.closest('.editor-tag-pill-delete');
    if (!deleteButton) {
      return;
    }
    event.preventDefault();
    const id = deleteButton.getAttribute('data-tag-id');
    if (!id) {
      return;
    }
    deleteTag(id);
  }

  function initOverlayOnce() {
    if (TAG_STATE.overlayInited) {
      return;
    }

    const overlay = getOverlay();
    const form = getForm();
    const cancelButton = getCancelButton();
    const colorInput = getColorInput();
    const tagList = getTagList();

    if (!overlay || !form) {
      return;
    }

    if (!form._editorV2TagBound) {
      form._editorV2TagBound = true;
      form.addEventListener('submit', handleFormSubmit);
    }

    if (cancelButton && !cancelButton._editorV2TagBound) {
      cancelButton._editorV2TagBound = true;
      cancelButton.addEventListener('click', (event) => {
        event.preventDefault();
        closeTagModal();
      });
    }

    if (colorInput && !colorInput._editorV2TagBound) {
      colorInput._editorV2TagBound = true;
      colorInput.addEventListener('input', handleColorInputChange);
      colorInput.addEventListener('change', handleColorInputChange);
    }

    if (tagList && !tagList._editorV2TagBound) {
      tagList._editorV2TagBound = true;
      tagList.addEventListener('click', handleTagListClick);
    }

    TAG_STATE.overlayInited = true;
    updatePreview();
  }

  function initTagManagement() {
    const overlay = getOverlay();
    if (!overlay) {
      return;
    }
    initOverlayOnce();
    reloadTags();
  }

  window.EDITOR_V2_TAGS = window.EDITOR_V2_TAGS || {};
  window.EDITOR_V2_TAGS.openTagModal = openTagModal;
  window.EDITOR_V2_TAGS.closeTagModal = closeTagModal;
  window.EDITOR_V2_TAGS.reloadTags = reloadTags;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTagManagement();
    });
  } else {
    initTagManagement();
  }
})();

