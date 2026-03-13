---
name: Editor v2 photo crop display
overview: Add drag-and-drop, cropping, saving, and display of clergy photos in editor v2, reusing /api/process-cropped-image and form image handling, while adhering to RULES (no Bootstrap, no inline CSS/JS, no animations/hover/transitions, black/white 10px).
todos:
  - id: photo-markup
    content: Replace photo block in clergy_form_fields.html with photoContainer, imagePreview (existing img or placeholder), hidden clergyImage input, and Upload/Crop/Remove controls (text labels, always visible)
    status: pending
  - id: photo-edit-display
    content: In snippet, when edit_mode and clergy with image_data/image_url, render preview img with detail URL and data-original-image, data-clergy-id, data-object-key for crop API
    status: completed
  - id: photo-css
    content: Add in editor.css styles for .photo-container, .drag-over,
    status: completed
  - id: crop-overlay-markup
    content: Add v2 crop overlay markup (fixed div with editorV2EditorImage, Reset/Cancel/Apply buttons) in base or new snippet; no Bootstrap
    status: completed
  - id: crop-overlay-css
    content: Style crop overlay and buttons in editor.css (black/white, no animations)
    status: completed
  - id: editor-photo-js
    content: Create editor_v2/static/v2-scripts/editor-photo.js with drag-drop, file input change, crop open/apply/cancel/reset, remove image, and initEditorV2Photo for form/HTMX
    status: completed
  - id: cropper-load
    content: Add Cropper.js (and its CSS) to v2 base template; wire editor-photo.js in base
    status: completed
  - id: photo-init-wire
    content: Call initEditorV2Photo from initClergyFormV2 and on htmx:afterSwap when center panel contains clergyForm
    status: completed
isProject: false
---

# Editor v2: Photo cropping and display

## To-dos

- **photo-markup**: Replace photo block in [clergy_form_fields.html](editor_v2/templates/editor_v2/snippets/clergy_form_fields.html) with photoContainer, imagePreview (existing img or placeholder), hidden clergyImage input, and Upload/Crop/Remove controls (text labels, always visible).
- **photo-edit-display**: In snippet, when edit_mode and clergy with image_data/image_url, render preview img with detail URL and data-original-image, data-clergy-id, data-object-key for crop API.
- **photo-css**: Add in [editor.css](editor_v2/static/v2-styles/editor.css) styles for .photo-container, .drag-over, #imagePreview, .has-image, and image controls (10px, black/white, no transition/animation).
- **crop-overlay-markup**: Add v2 crop overlay markup (fixed div with editorV2EditorImage, Reset/Cancel/Apply buttons) in base or new snippet; no Bootstrap.
- **crop-overlay-css**: Style crop overlay and buttons in editor.css (black/white, no animations).
- **editor-photo-js**: Create [editor_v2/static/v2-scripts/editor-photo.js](editor_v2/static/v2-scripts/editor-photo.js) with drag-drop, file input change, crop open/apply/cancel/reset, remove image, and initEditorV2Photo for form/HTMX.
- **cropper-load**: Add Cropper.js (and its CSS) to v2 base template; wire editor-photo.js in base.
- **photo-init-wire**: Call initEditorV2Photo from initClergyFormV2 and on htmx:afterSwap when center panel contains clergyForm.

## Reference vs constraints

- **Reference:** [templates/clergy_form_content.html](templates/clergy_form_content.html) (photo container, preview, overlay controls) and [static/js/imageEditor.js](static/js/imageEditor.js) (Cropper.js, applyChanges → /api/process-cropped-image → storeProcessedImages). Old modal: [templates/_image_editor_modal.html](templates/_image_editor_modal.html) (Bootstrap).
- **Editor v2 RULES:** [editor_v2/RULES.md](editor_v2/RULES.md) — no Bootstrap; all CSS in v2-styles, all JS in v2-scripts; black/white, 10px; no animations, no hover events, no transitions.

## Backend

No backend changes. Editor v2 POSTs with multipart/form-data; [services/clergy.py](services/clergy.py) and [routes/main_api.py](routes/main_api.py) handle clergy_image, image_data_json, image_removed, and POST /api/process-cropped-image. [app.js](editor_v2/static/v2-scripts/app.js) uses FormData(form), so file and hidden inputs are included.

## Data flow

- File input or drag-drop → set file on #clergyImage → preview in #imagePreview.
- Crop → open overlay, init Cropper on #editorV2EditorImage → Apply → getCroppedCanvas, POST /api/process-cropped-image → add/update input[name="image_data_json"], updateFormPreview(detail URL), hide overlay.
- Remove → clear preview, add input[name="image_removed"] value "true", remove image_data_json input.

## File summary


| Area         | File                                                                |
| ------------ | ------------------------------------------------------------------- |
| Markup       | editor_v2/templates/editor_v2/snippets/clergy_form_fields.html      |
| CSS          | editor_v2/static/v2-styles/editor.css                               |
| Crop overlay | New snippet or block in v2 base                                     |
| JS           | editor_v2/static/v2-scripts/editor-photo.js                         |
| Load         | editor_v2/templates/editor_v2/base.html (Cropper + editor-photo.js) |


