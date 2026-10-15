(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const PHOTO_STATE = {
    cropper: null,
    originalImageFile: null,
    originalImageDataUrl: null,
    clergyId: null,
    overlayInited: false
  };

  function getClergyForm(root) {
    if (root && root.getElementById) {
      const scoped = root.getElementById('clergyForm');
      if (scoped) {
        return scoped;
      }
    }
    return document.getElementById('clergyForm');
  }

  function getClergyIdFromFormOrWindow(form) {
    if (form) {
      const dataId = form.getAttribute('data-clergy-id');
      if (dataId != null && dataId !== '') {
        const parsed = parseInt(dataId, 10);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    if (typeof window.currentSelectedClergyId === 'number' && Number.isFinite(window.currentSelectedClergyId)) {
      return window.currentSelectedClergyId;
    }
    return null;
  }

  function getProxyUrl(url) {
    if (!url || typeof url !== 'string') {
      return url;
    }
    if (url.indexOf('/proxy-image?') !== -1) {
      return url;
    }
    if (url.indexOf('backblazeb2.com') !== -1 || url.indexOf('s3.us-east-005.backblazeb2.com') !== -1) {
      const encoded = encodeURIComponent(url);
      return '/proxy-image?url=' + encoded;
    }
    return url;
  }

  function ensureHiddenInput(form, name, value) {
    if (!form) {
      return null;
    }
    let existing = form.querySelector('input[name="' + name + '"]');
    if (!existing) {
      existing = document.createElement('input');
      existing.type = 'hidden';
      existing.name = name;
      form.appendChild(existing);
    }
    existing.value = value;
    return existing;
  }

  function removeHiddenInput(form, name) {
    if (!form) {
      return;
    }
    const el = form.querySelector('input[name="' + name + '"]');
    if (el) {
      el.remove();
    }
  }

  function updatePreviewImage(form, imageData) {
    if (!form) {
      return;
    }
    const imagePreview = form.querySelector('#imagePreview');
    if (!imagePreview) {
      return;
    }

    let detailSrc = null;
    let originalSrc = null;
    let clergyId = PHOTO_STATE.clergyId;
    let objectKey = null;

    if (imageData && typeof imageData === 'object') {
      detailSrc = imageData.detail || imageData.lineage || imageData.cropped || null;
      originalSrc = imageData.original || detailSrc;
      if (imageData.metadata && typeof imageData.metadata === 'object') {
        if (imageData.metadata.clergy_id != null) {
          const parsed = parseInt(String(imageData.metadata.clergy_id), 10);
          if (Number.isFinite(parsed)) {
            clergyId = parsed;
          }
        }
        if (imageData.metadata.object_key) {
          objectKey = imageData.metadata.object_key;
        }
      }
    } else if (typeof imageData === 'string') {
      detailSrc = imageData;
      originalSrc = imageData;
    }

    if (!detailSrc) {
      return;
    }

    imagePreview.textContent = '';

    const img = document.createElement('img');
    img.id = 'previewImage';
    img.src = detailSrc;
    img.alt = 'Preview';
    img.className = 'has-image';
    img.setAttribute('data-original-image', originalSrc || '');
    if (clergyId != null) {
      img.setAttribute('data-clergy-id', String(clergyId));
    }
    if (objectKey) {
      img.setAttribute('data-object-key', objectKey);
    }

    imagePreview.appendChild(img);
  }

  function showPlaceholder(form) {
    if (!form) {
      return;
    }
    const imagePreview = form.querySelector('#imagePreview');
    if (!imagePreview) {
      return;
    }
    imagePreview.textContent = '';
    const span = document.createElement('span');
    span.className = 'image-preview-placeholder';
    span.textContent = 'No photo';
    imagePreview.appendChild(span);
  }

  function destroyCropper() {
    if (PHOTO_STATE.cropper && typeof PHOTO_STATE.cropper.destroy === 'function') {
      PHOTO_STATE.cropper.destroy();
    }
    PHOTO_STATE.cropper = null;
  }

  function hideOverlay() {
    const overlay = document.getElementById('editorV2PhotoOverlay');
    if (overlay) {
      overlay.classList.add('editor-photo-overlay--hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
    destroyCropper();
  }

  function initOverlayOnce() {
    if (PHOTO_STATE.overlayInited) {
      return;
    }
    const overlay = document.getElementById('editorV2PhotoOverlay');
    const editorImage = document.getElementById('editorV2EditorImage');
    if (!overlay || !editorImage) {
      return;
    }

    const resetButton = document.getElementById('editorV2PhotoReset');
    const cancelButton = document.getElementById('editorV2PhotoCancel');
    const applyButton = document.getElementById('editorV2PhotoApply');

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        if (PHOTO_STATE.cropper && typeof PHOTO_STATE.cropper.reset === 'function') {
          PHOTO_STATE.cropper.reset();
        }
      });
    }

    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        hideOverlay();
      });
    }

    if (applyButton) {
      applyButton.addEventListener('click', () => {
        applyCrop(getClergyForm());
      });
    }

    PHOTO_STATE.overlayInited = true;
  }

  function openCropOverlayWithSource(form, imageSrc, opts) {
    if (typeof Cropper === 'undefined') {
      return;
    }
    initOverlayOnce();

    const overlay = document.getElementById('editorV2PhotoOverlay');
    const editorImage = document.getElementById('editorV2EditorImage');
    if (!overlay || !editorImage) {
      return;
    }

    destroyCropper();

    PHOTO_STATE.clergyId = (opts && opts.clergyId != null) ? opts.clergyId : getClergyIdFromFormOrWindow(form);

    editorImage.onload = () => {
      destroyCropper();
      PHOTO_STATE.cropper = new Cropper(editorImage, {
        aspectRatio: 1,
        viewMode: 2,
        autoCropArea: 0.8,
        background: false,
        movable: true,
        zoomable: true,
        scalable: false,
        rotatable: false
      });
    };

    editorImage.onerror = () => {
      hideOverlay();
    };

    editorImage.src = imageSrc;
    overlay.classList.remove('editor-photo-overlay--hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  // The crop rides along with the form and is processed on save (with the newly chosen file, if
  // any, as the original). Uploading nothing until then means an abandoned edit leaves no files.
  function applyCrop(form) {
    if (!form || !PHOTO_STATE.cropper || typeof PHOTO_STATE.cropper.getCroppedCanvas !== 'function') {
      return;
    }
    // The largest stored size is 320px; 960 leaves room without a multi-MB request.
    const croppedCanvas = PHOTO_STATE.cropper.getCroppedCanvas({
      maxWidth: 960,
      maxHeight: 960,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
    if (!croppedCanvas) {
      return;
    }
    const croppedData = croppedCanvas.toDataURL('image/jpeg', 0.92);
    const previewImg = form.querySelector('#imagePreview img');
    const originalSrc = PHOTO_STATE.originalImageDataUrl
      || (previewImg && previewImg.getAttribute('data-original-image')) || croppedData;

    ensureHiddenInput(form, 'cropped_image_data', croppedData);
    removeHiddenInput(form, 'image_removed');
    updatePreviewImage(form, { detail: croppedData, original: originalSrc });
    hideOverlay();
  }

  function handleFileSelected(form, file) {
    if (!form || !file) {
      return;
    }
    if (!file.type || file.type.indexOf('image/') !== 0) {
      return;
    }
    PHOTO_STATE.originalImageFile = file;
    PHOTO_STATE.clergyId = getClergyIdFromFormOrWindow(form);
    // Saved as-is (auto square crop) unless the user crops it; a crop of the previous photo no longer applies.
    removeHiddenInput(form, 'cropped_image_data');
    removeHiddenInput(form, 'image_removed');

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event && event.target ? event.target.result : null;
      if (!result || typeof result !== 'string') {
        return;
      }
      PHOTO_STATE.originalImageDataUrl = result;
      updatePreviewImage(form, {
        detail: result,
        original: result
      });
    };
    reader.readAsDataURL(file);
  }

  function wireUploadControls(form) {
    if (!form) {
      return;
    }
    const fileInput = form.querySelector('#clergyImage');
    const uploadButton = form.querySelector('.photo-controls .photo-upload');
    const cropButton = form.querySelector('.photo-controls .photo-crop');
    const removeButton = form.querySelector('.photo-controls .photo-remove');
    const photoContainer = form.querySelector('#photoContainer');

    if (fileInput && !fileInput._editorV2PhotoBound) {
      fileInput._editorV2PhotoBound = true;
      fileInput.addEventListener('change', (event) => {
        const input = event.target;
        if (!input || !input.files || !input.files.length) {
          return;
        }
        const file = input.files[0];
        handleFileSelected(form, file);
      });
    }

    if (uploadButton && !uploadButton._editorV2PhotoBound) {
      uploadButton._editorV2PhotoBound = true;
      uploadButton.addEventListener('click', () => {
        if (fileInput) {
          fileInput.click();
        }
      });
    }

    if (cropButton && !cropButton._editorV2PhotoBound) {
      cropButton._editorV2PhotoBound = true;
      cropButton.addEventListener('click', () => {
        const imagePreview = form.querySelector('#imagePreview');
        const previewImg = imagePreview ? imagePreview.querySelector('img') : null;

        if (PHOTO_STATE.originalImageDataUrl) {
          openCropOverlayWithSource(form, PHOTO_STATE.originalImageDataUrl, {
            clergyId: getClergyIdFromFormOrWindow(form)
          });
          return;
        }

        if (!previewImg) {
          return;
        }

        const originalAttr = previewImg.getAttribute('data-original-image');
        const src = originalAttr || previewImg.getAttribute('src') || '';
        if (!src) {
          return;
        }
        const proxied = getProxyUrl(src);
        openCropOverlayWithSource(form, proxied, {
          clergyId: getClergyIdFromFormOrWindow(form)
        });
      });
    }

    if (removeButton && !removeButton._editorV2PhotoBound) {
      removeButton._editorV2PhotoBound = true;
      removeButton.addEventListener('click', () => {
        if (fileInput) {
          fileInput.value = '';
        }
        PHOTO_STATE.originalImageFile = null;
        PHOTO_STATE.originalImageDataUrl = null;
        const formEl = form;
        removeHiddenInput(formEl, 'image_data_json');
        removeHiddenInput(formEl, 'cropped_image_data');
        ensureHiddenInput(formEl, 'image_removed', 'true');
        showPlaceholder(formEl);
      });
    }

    if (photoContainer && !photoContainer._editorV2PhotoDragBound) {
      photoContainer._editorV2PhotoDragBound = true;

      const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        photoContainer.classList.add('drag-over');
      };

      const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };

      const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        photoContainer.classList.remove('drag-over');
      };

      const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        photoContainer.classList.remove('drag-over');
        const dt = event.dataTransfer;
        if (!dt || !dt.files || !dt.files.length) {
          return;
        }
        const file = dt.files[0];
        if (fileInput) {
          try {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
          } catch (e) {
          }
        }
        handleFileSelected(form, file);
      };

      photoContainer.addEventListener('dragenter', handleDragEnter);
      photoContainer.addEventListener('dragover', handleDragOver);
      photoContainer.addEventListener('dragleave', handleDragLeave);
      photoContainer.addEventListener('drop', handleDrop);
    }
  }

  function initEditorV2Photo(root) {
    const form = getClergyForm(root);
    if (!form) {
      return;
    }
    if (!form._editorV2PhotoInit) {
      // A freshly rendered form (another clergy, or after a save): forget the last file picked.
      form._editorV2PhotoInit = true;
      PHOTO_STATE.originalImageFile = null;
      PHOTO_STATE.originalImageDataUrl = null;
    }
    wireUploadControls(form);
  }

  window.EDITOR_V2_PHOTO = window.EDITOR_V2_PHOTO || {};
  window.EDITOR_V2_PHOTO.initEditorV2Photo = initEditorV2Photo;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initEditorV2Photo(document);
    });
  } else {
    initEditorV2Photo(document);
  }
})();

