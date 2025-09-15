/**
 * Professional Image Editor
 * A comprehensive, modular image editing system for clergy photos
 */

class ImageEditor {
    constructor() {
        this.cropper = null;
        this.originalImageData = null;
        this.originalImageFile = null;
        this.currentImageData = null;
        this.isProcessing = false;
        this.quality = 95;
        this.outputSizes = {
            lineage: true,
            detail: true,
            original: true
        };
        
        this.initializeEventListeners();
        this.initializeSettings();
    }
    
    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Toolbar buttons
        document.getElementById('zoomInBtn')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('resetZoomBtn')?.addEventListener('click', () => this.resetZoom());
        document.getElementById('rotateLeftBtn')?.addEventListener('click', () => this.rotateLeft());
        document.getElementById('rotateRightBtn')?.addEventListener('click', () => this.rotateRight());
        document.getElementById('flipHorizontalBtn')?.addEventListener('click', () => this.flipHorizontal());
        document.getElementById('flipVerticalBtn')?.addEventListener('click', () => this.flipVertical());
        
        // Footer buttons
        document.getElementById('resetImageBtn')?.addEventListener('click', () => this.resetImage());
        document.getElementById('previewBtn')?.addEventListener('click', () => this.showPreview());
        document.getElementById('applyChangesBtn')?.addEventListener('click', () => this.applyChanges());
        
        // Settings
        document.getElementById('aspectRatio')?.addEventListener('change', (e) => this.setAspectRatio(e.target.value));
        document.getElementById('outputQuality')?.addEventListener('input', (e) => this.updateQuality(e.target.value));
        
        // Output size checkboxes
        document.getElementById('sizeLineage')?.addEventListener('change', (e) => this.updateOutputSizes('lineage', e.target.checked));
        document.getElementById('sizeDetail')?.addEventListener('change', (e) => this.updateOutputSizes('detail', e.target.checked));
        document.getElementById('sizeOriginal')?.addEventListener('click', (e) => this.updateOutputSizes('original', e.target.checked));
        
        // Modal close events
        const imageEditorModal = document.getElementById('imageEditorModal');
        if (imageEditorModal) {
            imageEditorModal.addEventListener('hidden.bs.modal', () => {
                this.cleanup();
                console.log('Image editor modal closed, cleaned up resources');
            });
        }
    }
    
    /**
     * Initialize editor settings
     */
    initializeSettings() {
        this.updateQuality(this.quality);
        this.updateOutputSizes('lineage', true);
        this.updateOutputSizes('detail', true);
        this.updateOutputSizes('original', true);
    }
    
    /**
     * Open the image editor with an image
     */
    openEditor(imageData, originalFile = null) {
        console.log('Opening image editor with data length:', imageData ? imageData.length : 0);
        
        // Clear any existing processed data to prevent conflicts
        this.clearProcessedData();
        
        // Add a unique timestamp to prevent caching issues
        const timestamp = Date.now();
        this.sessionId = timestamp;
        
        this.originalImageData = imageData;
        this.originalImageFile = originalFile;
        this.currentImageData = imageData;

        // Store imageData for use in onload callback
        this.currentEditorImageData = imageData;

        // Check if modal is already open
        const existingModal = bootstrap.Modal.getInstance(document.getElementById('imageEditorModal'));
        if (existingModal) {
            // Modal is already open, just update the image
            console.log('Modal already open, updating image');
            this.initializeEditor();
            this.reattachModalEventListeners();
        } else {
            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('imageEditorModal'));
            modal.show();

            // Wait for modal to be shown, then initialize
            document.getElementById('imageEditorModal').addEventListener('shown.bs.modal', () => {
                this.initializeEditor();
                // Reattach event listeners after modal is shown to ensure they work with the new modal instance
                this.reattachModalEventListeners();
            }, { once: true });
        }
    }
    
    /**
     * Initialize the cropper and editor
     */
    initializeEditor() {
        const editorImage = document.getElementById('editorImage');
        if (!editorImage) return;
        
        // Validate and prepare image source
        let imageSrc = this.currentImageData;
        
        // Validate data URL format
        if (imageSrc && imageSrc.startsWith('data:')) {
            // Check if it's a valid data URL format
            if (!imageSrc.includes(';base64,') && !imageSrc.includes(';charset=')) {
                console.error('Invalid data URL format:', imageSrc.substring(0, 100) + '...');
                this.showNotification('Invalid image data format. Please try uploading again.', 'error');
                return;
            }
        }
        
        // Add cache-busting parameter to prevent browser caching issues (only for non-data URLs)
        if (imageSrc && !imageSrc.includes('?') && !imageSrc.startsWith('data:')) {
            imageSrc += `?t=${this.sessionId || Date.now()}`;
        }
        
        // Set image source
        console.log('Setting image source:', imageSrc.substring(0, 100) + '...');
        editorImage.src = imageSrc;
        
        // Wait for image to load
        editorImage.onload = () => {
            console.log('Editor image loaded with dimensions:', editorImage.naturalWidth, '×', editorImage.naturalHeight);
            console.log('Image source type check:', this.currentEditorImageData.substring(0, 50));
            console.log('Session ID:', this.sessionId);

            // Additional validation
            if (editorImage.naturalWidth <= 48 || editorImage.naturalHeight <= 48) {
                console.warn('WARNING: Image dimensions are very small! This might be the 48x48 lineage image instead of full resolution.');
                console.warn('Image source starts with:', this.currentEditorImageData.substring(0, 100));
            } else {
                console.log('SUCCESS: Full resolution image loaded correctly!');
            }

            this.updateImageInfo();
            this.initializeCropper();
        };
        
        // Handle image load errors
        editorImage.onerror = (error) => {
            console.error('Failed to load image in editor');
            console.error('Image source that failed:', imageSrc.substring(0, 100) + '...');
            console.error('Error details:', error);
            this.showNotification('Failed to load image. Please try again.', 'error');
        };
    }
    
    /**
     * Initialize Cropper.js
     */
    initializeCropper() {
        const editorImage = document.getElementById('editorImage');
        console.log('Initializing cropper with image:', !!editorImage);
        
        if (!editorImage) {
            console.error('Editor image element not found');
            return;
        }
        
        // Destroy existing cropper
        if (this.cropper) {
            console.log('Destroying existing cropper');
            this.cropper.destroy();
        }
        
        // Initialize new cropper
        console.log('Creating new cropper instance');
        this.cropper = new Cropper(editorImage, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: true,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            background: true,
            modal: true,
            zoomable: true,
            zoomOnWheel: true,
            wheelZoomRatio: 0.1,
            ready: () => {
                console.log('Cropper ready callback triggered');
                this.updateCropDimensions();
            },
            crop: () => {
                this.updateCropDimensions();
            }
        });
    }
    
    /**
     * Update image information display
     */
    updateImageInfo() {
        const editorImage = document.getElementById('editorImage');
        if (!editorImage) return;

        // Original size
        const originalSizeElement = document.getElementById('originalSize');
        const fileTypeElement = document.getElementById('fileType');
        const currentSizeElement = document.getElementById('currentSize');

        if (this.originalImageFile) {
            if (originalSizeElement) originalSizeElement.textContent = this.formatFileSize(this.originalImageFile.size);
            if (fileTypeElement) fileTypeElement.textContent = this.originalImageFile.type || 'Unknown';
        } else {
            if (originalSizeElement) originalSizeElement.textContent = 'Unknown';
            if (fileTypeElement) fileTypeElement.textContent = 'Unknown';
        }

        // Current size
        if (currentSizeElement) currentSizeElement.textContent = `${editorImage.naturalWidth} × ${editorImage.naturalHeight}`;
    }
    
    /**
     * Update crop dimensions display
     */
    updateCropDimensions() {
        if (!this.cropper) return;

        const cropData = this.cropper.getData();
        const cropWidthElement = document.getElementById('cropWidth');
        const cropHeightElement = document.getElementById('cropHeight');

        if (cropWidthElement) cropWidthElement.value = Math.round(cropData.width);
        if (cropHeightElement) cropHeightElement.value = Math.round(cropData.height);
    }
    
    /**
     * Set aspect ratio
     */
    setAspectRatio(ratio) {
        if (!this.cropper) return;
        
        if (ratio === 'free') {
            this.cropper.setAspectRatio(NaN);
        } else {
            this.cropper.setAspectRatio(eval(ratio));
        }
    }
    
    /**
     * Update quality setting
     */
    updateQuality(value) {
        this.quality = parseInt(value);
        const qualityElement = document.getElementById('qualityValue');
        if (qualityElement) {
            qualityElement.textContent = `${this.quality}%`;
        }
    }
    
    /**
     * Update output size settings
     */
    updateOutputSizes(size, enabled) {
        this.outputSizes[size] = enabled;
    }
    
    /**
     * Zoom controls
     */
    zoomIn() {
        if (this.cropper) {
            this.cropper.zoom(0.1);
        }
    }
    
    zoomOut() {
        if (this.cropper) {
            this.cropper.zoom(-0.1);
        }
    }
    
    resetZoom() {
        if (this.cropper) {
            this.cropper.reset();
        }
    }
    
    /**
     * Rotation controls
     */
    rotateLeft() {
        if (this.cropper) {
            this.cropper.rotate(-90);
        }
    }
    
    rotateRight() {
        if (this.cropper) {
            this.cropper.rotate(90);
        }
    }
    
    /**
     * Flip controls
     */
    flipHorizontal() {
        if (this.cropper) {
            this.cropper.scaleX(-this.cropper.getData().scaleX || -1);
        }
    }
    
    flipVertical() {
        if (this.cropper) {
            this.cropper.scaleY(-this.cropper.getData().scaleY || -1);
        }
    }
    
    /**
     * Reset image to original state
     */
    resetImage() {
        if (this.cropper) {
            this.cropper.reset();
        }
        this.currentImageData = this.originalImageData;
        this.clearProcessedData();
        this.initializeEditor();
        this.showNotification('Image reset to original', 'info');
    }
    
    /**
     * Show preview of processed images
     */
    async showPreview() {
        if (!this.cropper) return;
        
        try {
            this.showProcessingStatus('Generating preview...', 25);
            
            // Get cropped canvas
            const croppedCanvas = this.cropper.getCroppedCanvas({
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });
            
            this.showProcessingStatus('Creating preview sizes...', 50);
            
            // Create preview images
            const lineagePreview = await this.createResizedImage(croppedCanvas, 64, 64, this.quality / 100);
            const detailPreview = await this.createResizedImage(croppedCanvas, 320, 320, this.quality / 100);
            
            this.showProcessingStatus('Finalizing preview...', 75);
            
            // Update preview modal
            document.getElementById('previewLineage').src = lineagePreview;
            document.getElementById('previewDetail').src = detailPreview;
            document.getElementById('previewOriginal').src = croppedCanvas.toDataURL('image/jpeg', this.quality / 100);
            
            this.hideProcessingStatus();
            
            // Show preview modal
            const previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
            previewModal.show();
            
        } catch (error) {
            console.error('Error generating preview:', error);
            this.hideProcessingStatus();
            this.showNotification('Error generating preview. Please try again.', 'error');
        }
    }
    
    /**
     * Apply changes and process images
     */
    async applyChanges() {
        console.log('Apply changes called');
        console.log('Cropper instance:', !!this.cropper);
        console.log('Is processing:', this.isProcessing);
        console.log('Current session ID:', this.sessionId);
        
        if (!this.cropper || this.isProcessing) {
            console.warn('Cannot apply changes: cropper not available or already processing');
            this.showNotification('Cannot process image at this time. Please try again.', 'warning');
            return;
        }
        
        // Validate that we have valid image data
        if (!this.originalImageData || !this.currentImageData) {
            console.error('No valid image data available for processing');
            this.showNotification('No valid image data available. Please try uploading again.', 'error');
            return;
        }
        
        this.isProcessing = true;
        this.showProcessingStatus('Processing image...', 10);
        
        try {
            // Get cropped canvas
            const croppedCanvas = this.cropper.getCroppedCanvas({
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });
            
            if (!croppedCanvas) {
                throw new Error('Failed to create cropped canvas');
            }
            
            this.showProcessingStatus('Creating output sizes...', 30);
            
            // Process images based on selected sizes
            const processedImages = {};
            
            if (this.outputSizes.lineage) {
                this.showProcessingStatus('Creating lineage size...', 50);
                processedImages.lineage = await this.createResizedImage(croppedCanvas, 48, 48, this.quality / 100);
            }
            
            if (this.outputSizes.detail) {
                this.showProcessingStatus('Creating detail size...', 70);
                processedImages.detail = await this.createResizedImage(croppedCanvas, 320, 320, this.quality / 100);
            }
            
            if (this.outputSizes.original) {
                this.showProcessingStatus('Processing original size...', 90);
                // Use higher quality (98%) for the cropped version to preserve maximum quality
                processedImages.cropped = croppedCanvas.toDataURL('image/jpeg', 0.98);
            }
            
            // Add metadata
            processedImages.original = this.originalImageData;
            processedImages.metadata = {
                originalSize: this.originalImageFile ? this.originalImageFile.size : 0,
                originalType: this.originalImageFile ? this.originalImageFile.type : '',
                quality: this.quality,
                croppedQuality: 98, // Higher quality used for cropped version
                timestamp: new Date().toISOString(),
                outputSizes: this.outputSizes
            };
            
            this.showProcessingStatus('Finalizing...', 100);
            
            // Store processed images
            this.storeProcessedImages(processedImages);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('imageEditorModal'));
            if (modal) {
                modal.hide();
                
                // Clean up any backdrop that might be left behind
                setTimeout(() => {
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    backdrops.forEach(backdrop => backdrop.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.paddingRight = '';
                    
                    // Ensure the parent modal is still accessible
                    const parentModal = document.getElementById('clergyFormModal');
                    if (parentModal) {
                        // Re-enable the parent modal if it exists
                        parentModal.style.pointerEvents = 'auto';
                        parentModal.style.zIndex = '1055';
                    }
                }, 100);
            } else {
                console.warn('Image editor modal instance not found');
            }
            
            this.hideProcessingStatus();
            this.isProcessing = false;
            
            // Show success message
            this.showNotification('Images processed successfully!', 'success');
            
        } catch (error) {
            console.error('Error processing images:', error);
            this.hideProcessingStatus();
            this.isProcessing = false;
            this.showNotification('Error processing images. Please try again.', 'error');
        }
    }
    
    /**
     * Create resized image from canvas
     */
    createResizedImage(canvas, width, height, quality) {
        return new Promise((resolve) => {
            const resizedCanvas = document.createElement('canvas');
            const ctx = resizedCanvas.getContext('2d');
            
            resizedCanvas.width = width;
            resizedCanvas.height = height;
            
            // Enable high-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Calculate scaling to maintain aspect ratio
            const scale = Math.min(width / canvas.width, height / canvas.height);
            const scaledWidth = canvas.width * scale;
            const scaledHeight = canvas.height * scale;
            
            // Center the image
            const x = (width - scaledWidth) / 2;
            const y = (height - scaledHeight) / 2;
            
            // Draw resized image
            ctx.drawImage(canvas, x, y, scaledWidth, scaledHeight);
            
            // Convert to data URL
            const resizedData = resizedCanvas.toDataURL('image/jpeg', quality);
            resolve(resizedData);
        });
    }
    
    /**
     * Store processed images for form submission
     */
    storeProcessedImages(processedImages) {
        // Store in global variable for form access
        window.processedImageData = processedImages;
        
        // Create hidden input for form
        const form = document.getElementById('clergyForm');
        if (form) {
            // Remove existing input
            const existingInput = form.querySelector('input[name="image_data_json"]');
            if (existingInput) {
                existingInput.remove();
            }
            
            // Create new input
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'image_data_json';
            hiddenInput.value = JSON.stringify(processedImages);
            
            form.appendChild(hiddenInput);
        }
        
        // Update preview in main form
        const lineageImage = processedImages.lineage || processedImages.detail || processedImages.cropped;
        if (lineageImage) {
            this.updateFormPreview(lineageImage);
        }
    }
    
    /**
     * Update the main form preview
     */
    updateFormPreview(imageData) {
        const imagePreview = document.getElementById('imagePreview');
        if (!imagePreview) return;
        
        imagePreview.innerHTML = `
            <img src="${imageData}" alt="Preview" class="preview-image" id="previewImage">
            <div class="image-tools-overlay">
                <input type="file" class="form-control" id="clergyImage" name="clergy_image" accept="image/*" style="display: none;">
                <button type="button" class="btn btn-icon btn-upload" id="uploadBtn" title="Upload Image">
                    <i class="fas fa-upload"></i>
                </button>
                <button type="button" class="btn btn-icon btn-crop" id="cropExistingBtn" title="Edit Image">
                    <i class="fas fa-crop"></i>
                </button>
                <button type="button" class="btn btn-icon btn-remove" id="removeImageBtn" title="Remove Image">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Re-attach event listeners
        this.reattachFormEventListeners();
    }
    
    /**
     * Re-attach event listeners to form elements
     */
    reattachFormEventListeners() {
        const newImageInput = document.getElementById('clergyImage');
        const newUploadBtn = document.getElementById('uploadBtn');
        const newCropBtn = document.getElementById('cropExistingBtn');
        const newRemoveBtn = document.getElementById('removeImageBtn');
        
        // Remove existing listeners first to prevent duplication
        if (newImageInput) {
            newImageInput.removeEventListener('change', this.handleFormImageUpload);
            newImageInput.addEventListener('change', (e) => this.handleFormImageUpload(e));
        }
        
        if (newUploadBtn) {
            // Remove any existing click listeners
            const newUploadBtnClone = newUploadBtn.cloneNode(true);
            newUploadBtn.parentNode.replaceChild(newUploadBtnClone, newUploadBtn);
            newUploadBtnClone.addEventListener('click', () => document.getElementById('clergyImage').click());
        }
        
        if (newCropBtn) {
            // Remove any existing click listeners
            const newCropBtnClone = newCropBtn.cloneNode(true);
            newCropBtn.parentNode.replaceChild(newCropBtnClone, newCropBtn);
            newCropBtnClone.addEventListener('click', () => this.editExistingImage());
        }
        
        if (newRemoveBtn) {
            // Remove any existing click listeners
            const newRemoveBtnClone = newRemoveBtn.cloneNode(true);
            newRemoveBtn.parentNode.replaceChild(newRemoveBtnClone, newRemoveBtn);
            newRemoveBtnClone.addEventListener('click', () => this.removeFormImage());
        }
    }
    
    /**
     * Re-attach event listeners to modal elements (for when modal is reopened with new image)
     */
    reattachModalEventListeners() {
        console.log('Reattaching modal event listeners');
        
        // Toolbar buttons
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        const rotateLeftBtn = document.getElementById('rotateLeftBtn');
        const rotateRightBtn = document.getElementById('rotateRightBtn');
        const flipHorizontalBtn = document.getElementById('flipHorizontalBtn');
        const flipVerticalBtn = document.getElementById('flipVerticalBtn');
        
        // Footer buttons
        const resetImageBtn = document.getElementById('resetImageBtn');
        const previewBtn = document.getElementById('previewBtn');
        const applyChangesBtn = document.getElementById('applyChangesBtn');
        
        // Settings
        const aspectRatio = document.getElementById('aspectRatio');
        const outputQuality = document.getElementById('outputQuality');
        const sizeLineage = document.getElementById('sizeLineage');
        const sizeDetail = document.getElementById('sizeDetail');
        const sizeOriginal = document.getElementById('sizeOriginal');
        
        // Remove existing listeners and reattach to prevent duplication
        if (zoomInBtn) {
            const newBtn = zoomInBtn.cloneNode(true);
            zoomInBtn.parentNode.replaceChild(newBtn, zoomInBtn);
            newBtn.addEventListener('click', () => this.zoomIn());
        }
        
        if (zoomOutBtn) {
            const newBtn = zoomOutBtn.cloneNode(true);
            zoomOutBtn.parentNode.replaceChild(newBtn, zoomOutBtn);
            newBtn.addEventListener('click', () => this.zoomOut());
        }
        
        if (resetZoomBtn) {
            const newBtn = resetZoomBtn.cloneNode(true);
            resetZoomBtn.parentNode.replaceChild(newBtn, resetZoomBtn);
            newBtn.addEventListener('click', () => this.resetZoom());
        }
        
        if (rotateLeftBtn) {
            const newBtn = rotateLeftBtn.cloneNode(true);
            rotateLeftBtn.parentNode.replaceChild(newBtn, rotateLeftBtn);
            newBtn.addEventListener('click', () => this.rotateLeft());
        }
        
        if (rotateRightBtn) {
            const newBtn = rotateRightBtn.cloneNode(true);
            rotateRightBtn.parentNode.replaceChild(newBtn, rotateRightBtn);
            newBtn.addEventListener('click', () => this.rotateRight());
        }
        
        if (flipHorizontalBtn) {
            const newBtn = flipHorizontalBtn.cloneNode(true);
            flipHorizontalBtn.parentNode.replaceChild(newBtn, flipHorizontalBtn);
            newBtn.addEventListener('click', () => this.flipHorizontal());
        }
        
        if (flipVerticalBtn) {
            const newBtn = flipVerticalBtn.cloneNode(true);
            flipVerticalBtn.parentNode.replaceChild(newBtn, flipVerticalBtn);
            newBtn.addEventListener('click', () => this.flipVertical());
        }
        
        if (resetImageBtn) {
            const newBtn = resetImageBtn.cloneNode(true);
            resetImageBtn.parentNode.replaceChild(newBtn, resetImageBtn);
            newBtn.addEventListener('click', () => this.resetImage());
        }
        
        if (previewBtn) {
            const newBtn = previewBtn.cloneNode(true);
            previewBtn.parentNode.replaceChild(newBtn, previewBtn);
            newBtn.addEventListener('click', () => this.showPreview());
        }
        
        if (applyChangesBtn) {
            const newBtn = applyChangesBtn.cloneNode(true);
            applyChangesBtn.parentNode.replaceChild(newBtn, applyChangesBtn);
            newBtn.addEventListener('click', () => this.applyChanges());
        }
        
        if (aspectRatio) {
            const newSelect = aspectRatio.cloneNode(true);
            aspectRatio.parentNode.replaceChild(newSelect, aspectRatio);
            newSelect.addEventListener('change', (e) => this.setAspectRatio(e.target.value));
        }
        
        if (outputQuality) {
            const newRange = outputQuality.cloneNode(true);
            outputQuality.parentNode.replaceChild(newRange, outputQuality);
            newRange.addEventListener('input', (e) => this.updateQuality(e.target.value));
        }
        
        if (sizeLineage) {
            const newCheckbox = sizeLineage.cloneNode(true);
            sizeLineage.parentNode.replaceChild(newCheckbox, sizeLineage);
            newCheckbox.addEventListener('change', (e) => this.updateOutputSizes('lineage', e.target.checked));
        }
        
        if (sizeDetail) {
            const newCheckbox = sizeDetail.cloneNode(true);
            sizeDetail.parentNode.replaceChild(newCheckbox, sizeDetail);
            newCheckbox.addEventListener('change', (e) => this.updateOutputSizes('detail', e.target.checked));
        }
        
        if (sizeOriginal) {
            const newCheckbox = sizeOriginal.cloneNode(true);
            sizeOriginal.parentNode.replaceChild(newCheckbox, sizeOriginal);
            newCheckbox.addEventListener('click', (e) => this.updateOutputSizes('original', e.target.checked));
        }
        
        console.log('Modal event listeners reattached successfully');
    }
    
    /**
     * Handle image upload from form
     */
    handleFormImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Clear any existing processed data
        this.clearProcessedData();
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select a valid image file.', 'error');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            this.showNotification('Image file size must be less than 10MB.', 'error');
            return;
        }
        
        // Show upload progress
        this.showNotification('Processing image...', 'info');
        
        // Process and open editor
        this.processAndOpenEditor(file);
    }
    
    /**
     * Process uploaded file and open editor
     */
    async processAndOpenEditor(file) {
        try {
            this.showNotification('Optimizing image for editing...', 'info');
            
            // Check and adjust quality if needed for 1MB limit
            const processedFile = await this.optimizeImageForStorage(file);

            this.showNotification('Loading image into editor...', 'info');
            
            // Load original file directly without compression for high-res cropping
            const originalDataUrl = await this.loadOriginalImage(processedFile);
            this.openEditor(originalDataUrl, processedFile);
            
            this.showNotification('Image loaded successfully!', 'success');
        } catch (error) {
            console.error('Error processing file:', error);
            this.showNotification('Error processing the selected file. Please try again.', 'error');
        }
    }
    
    /**
     * Edit existing image
     */
    editExistingImage() {
        const previewImage = document.getElementById('previewImage');
        
        if (!previewImage || !previewImage.src) {
            this.showNotification('No existing image found to edit.', 'warning');
            return;
        }

        console.log('Edit existing image called');
        console.log('Preview image src:', previewImage.src.substring(0, 50) + '...');
        
        // Clear any existing processed data to prevent conflicts
        this.clearProcessedData();

        // Priority 1: Use current session processed data (highest quality)
        const processedData = window.processedImageData;
        if (processedData && processedData.original) {
            console.log('Using current session processed data');
            this.openEditor(processedData.original);
            return;
        }

        // Priority 2: Use full resolution data from database (stored in data attribute)
        const fullImageData = previewImage.getAttribute('data-full-image');
        if (fullImageData && fullImageData.length > 10) {
            console.log('Using full image data from database');
            try {
                // Check if data starts and ends with quotes (indicates JSON string)
                const startsWithQuote = fullImageData.startsWith('"');
                const endsWithQuote = fullImageData.endsWith('"');

                // If it's double-encoded, parse it twice
                let jsonString = fullImageData;
                if (startsWithQuote && endsWithQuote) {
                    jsonString = JSON.parse(fullImageData);
                }

                const imageData = JSON.parse(jsonString);
                console.log('Parsed image data keys:', Object.keys(imageData));

                if (imageData.cropped) {
                    console.log('Using cropped image data');
                    this.openEditor(imageData.cropped);
                    return;
                } else if (imageData.detail) {
                    console.log('Using detail image data as fallback');
                    this.openEditor(imageData.detail);
                    return;
                } else if (imageData.original) {
                    console.log('Using original image data as fallback');
                    this.openEditor(imageData.original);
                    return;
                }
            } catch (e) {
                console.error('Failed to parse full image data:', e);
            }
        }

        // Priority 3: Fallback to preview image (48x48 lineage image)
        console.log('Using preview image as fallback');
        this.openEditor(previewImage.src);
    }
    
    /**
     * Remove image from form
     */
    removeFormImage() {
        const imagePreview = document.getElementById('imagePreview');
        if (!imagePreview) return;

        // Clear processed data first
        this.clearProcessedData();

        // Reset to placeholder
        imagePreview.innerHTML = `
            <div class="placeholder-silhouette">
                <i class="fas fa-user"></i>
            </div>
            <div class="image-tools-overlay">
                <input type="file" class="form-control" id="clergyImage" name="clergy_image" accept="image/*" style="display: none;">
                <button type="button" class="btn btn-icon btn-upload" id="uploadBtn" title="Upload Image">
                    <i class="fas fa-upload"></i>
                </button>
            </div>
        `;

        // Re-attach event listeners
        this.reattachFormEventListeners();

        // Remove any existing image data input and add image_removed flag
        const form = document.getElementById('clergyForm');
        if (form) {
            // Remove existing image data input
            const existingInput = form.querySelector('input[name="image_data_json"]');
            if (existingInput) {
                existingInput.remove();
            }

            // Remove any existing image_removed input
            const existingRemovedInput = form.querySelector('input[name="image_removed"]');
            if (existingRemovedInput) {
                existingRemovedInput.remove();
            }

            // Add hidden input to indicate image has been removed
            const removedInput = document.createElement('input');
            removedInput.type = 'hidden';
            removedInput.name = 'image_removed';
            removedInput.value = 'true';
            form.appendChild(removedInput);
        }
        
        this.showNotification('Image removed successfully', 'success');
    }
    
    /**
     * Optimize image for storage by reducing quality if over 1MB limit
     */
    optimizeImageForStorage(file) {
        return new Promise((resolve) => {
            const MAX_SIZE_MB = 1; // 1MB limit for full-size storage
            const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

            // If file is already under 1MB, return as-is
            if (file.size <= MAX_SIZE_BYTES) {
                resolve(file);
                return;
            }

            // File is over 1MB, need to reduce quality
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // Start with 90% quality and reduce until under 1MB
                let quality = 0.9;
                let attempts = 0;
                const maxAttempts = 10;

                const tryCompress = () => {
                    canvas.toBlob((blob) => {
                        if (blob.size <= MAX_SIZE_BYTES || attempts >= maxAttempts) {
                            // Create a new file-like object with the compressed data
                            const compressedFile = new File([blob], file.name, {
                                type: file.type,
                                lastModified: file.lastModified
                            });
                            resolve(compressedFile);
                        } else {
                            // Try lower quality
                            quality -= 0.1;
                            attempts++;
                            canvas.toBlob(tryCompress, 'image/jpeg', Math.max(quality, 0.1));
                        }
                    }, 'image/jpeg', quality);
                };

                tryCompress();
            };

            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Load original image file directly without compression for high-resolution cropping
     */
    loadOriginalImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = function(e) {
                resolve(e.target.result);
            };

            reader.onerror = function() {
                reject(new Error('Failed to read image file'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Strip image metadata (used only for final export, not for cropping)
     */
    stripImageMetadata(file) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        resolve(e.target.result);
                    };
                    reader.readAsDataURL(blob);
                }, 'image/jpeg', this.quality / 100);
            }.bind(this);

            img.src = URL.createObjectURL(file);
        });
    }
    
    /**
     * Show processing status
     */
    showProcessingStatus(text, progress) {
        const statusElement = document.getElementById('processingStatus');
        const progressBar = statusElement?.querySelector('.progress-bar');
        const statusText = document.getElementById('statusText');
        
        if (statusElement) {
            statusElement.style.display = 'block';
        }
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
    }
    
    /**
     * Hide processing status
     */
    hideProcessingStatus() {
        const statusElement = document.getElementById('processingStatus');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }
    
    /**
     * Clear processed image data to prevent conflicts
     */
    clearProcessedData() {
        window.processedImageData = null;
        console.log('Cleared processed image data');
    }
    
    /**
     * Clean up resources when modal is closed
     */
    cleanup() {
        // Clear processed data
        this.clearProcessedData();
        
        // Destroy cropper instance
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
            console.log('Destroyed cropper instance');
        }
        
        // Clear image data
        this.originalImageData = null;
        this.originalImageFile = null;
        this.currentImageData = null;
        this.currentEditorImageData = null;
        
        // Reset processing state
        this.isProcessing = false;
        
        console.log('Image editor cleanup completed');
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Map error type to Bootstrap alert class
        const alertClass = type === 'error' ? 'danger' : type;
        
        const notification = document.createElement('div');
        notification.className = `alert alert-${alertClass} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 1200; max-width: 400px;';
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.alert.position-fixed[style*="top: 20px"]');
        existingNotifications.forEach(n => n.remove());
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * Get icon for notification type
     */
    getNotificationIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'error': 'exclamation-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize image editor when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if image editor modal exists on the page
    if (document.getElementById('imageEditorModal')) {
        // Create global instance
        window.imageEditor = new ImageEditor();

        // Initialize form event listeners if form exists
        if (document.getElementById('clergyForm')) {
            window.imageEditor.reattachFormEventListeners();
        }
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageEditor;
}
