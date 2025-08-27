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

        this.originalImageData = imageData;
        this.originalImageFile = originalFile;
        this.currentImageData = imageData;

        // Store imageData for use in onload callback
        this.currentEditorImageData = imageData;

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('imageEditorModal'));
        modal.show();

        // Wait for modal to be shown, then initialize
        document.getElementById('imageEditorModal').addEventListener('shown.bs.modal', () => {
            this.initializeEditor();
        }, { once: true });
    }
    
    /**
     * Initialize the cropper and editor
     */
    initializeEditor() {
        const editorImage = document.getElementById('editorImage');
        if (!editorImage) return;
        
        // Set image source
        editorImage.src = this.currentImageData;
        
        // Wait for image to load
        editorImage.onload = () => {
            console.log('Editor image loaded with dimensions:', editorImage.naturalWidth, '×', editorImage.naturalHeight);
            console.log('Image source type check:', this.currentEditorImageData.substring(0, 50));

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
    }
    
    /**
     * Initialize Cropper.js
     */
    initializeCropper() {
        const editorImage = document.getElementById('editorImage');
        
        // Destroy existing cropper
        if (this.cropper) {
            this.cropper.destroy();
        }
        
        // Initialize new cropper
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
        this.initializeEditor();
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
            alert('Error generating preview. Please try again.');
        }
    }
    
    /**
     * Apply changes and process images
     */
    async applyChanges() {
        if (!this.cropper || this.isProcessing) return;
        
        this.isProcessing = true;
        this.showProcessingStatus('Processing image...', 10);
        
        try {
            // Get cropped canvas
            const croppedCanvas = this.cropper.getCroppedCanvas({
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });
            
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
            modal.hide();
            
            this.hideProcessingStatus();
            this.isProcessing = false;
            
            // Show success message
            this.showNotification('Images processed successfully!', 'success');
            
        } catch (error) {
            console.error('Error processing images:', error);
            this.hideProcessingStatus();
            this.isProcessing = false;
            alert('Error processing images. Please try again.');
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
        
        if (newImageInput) {
            newImageInput.addEventListener('change', (e) => this.handleFormImageUpload(e));
        }
        
        if (newUploadBtn) {
            newUploadBtn.addEventListener('click', () => document.getElementById('clergyImage').click());
        }
        
        if (newCropBtn) {
            newCropBtn.addEventListener('click', () => this.editExistingImage());
        }
        
        if (newRemoveBtn) {
            newRemoveBtn.addEventListener('click', () => this.removeFormImage());
        }
    }
    
    /**
     * Handle image upload from form
     */
    handleFormImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            alert('Image file size must be less than 10MB.');
            return;
        }
        
        // Process and open editor
        this.processAndOpenEditor(file);
    }
    
    /**
     * Process uploaded file and open editor
     */
    async processAndOpenEditor(file) {
        try {
            // Check and adjust quality if needed for 1MB limit
            const processedFile = await this.optimizeImageForStorage(file);

            // Load original file directly without compression for high-res cropping
            const originalDataUrl = await this.loadOriginalImage(processedFile);
            this.openEditor(originalDataUrl, processedFile);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing the selected file. Please try again.');
        }
    }
    
    /**
     * Edit existing image
     */
    editExistingImage() {
        const previewImage = document.getElementById('previewImage');


        if (previewImage && previewImage.src) {
            // Priority 1: Use current session processed data (highest quality)
            const processedData = window.processedImageData;


            if (processedData && processedData.original) {

                this.openEditor(processedData.original);
                return;
            }

            // Priority 2: Use full resolution data from database (stored in data attribute)
            const fullImageData = previewImage.getAttribute('data-full-image');


            if (fullImageData && fullImageData.length > 10) { // Make sure we have meaningful data
                try {
                    // Check if data starts and ends with quotes (indicates JSON string)
                    // Check if data starts and ends with quotes (indicates JSON string)
                    const startsWithQuote = fullImageData.startsWith('"');
                    const endsWithQuote = fullImageData.endsWith('"');

                    // If it's double-encoded, parse it twice
                    let jsonString = fullImageData;
                    if (startsWithQuote && endsWithQuote) {
                        jsonString = JSON.parse(fullImageData);
                    }

                    const imageData = JSON.parse(jsonString);

                    if (imageData.cropped) {
                        this.openEditor(imageData.cropped);
                        return;
                    } else {
                        console.warn('No cropped image found in stored data');
                        // Try using detail as fallback for now
                        if (imageData.detail) {
                            this.openEditor(imageData.detail);
                            return;
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse full image data:', e);
                }
            }

            // Priority 3: Fallback to preview image (48x48 lineage image)
            this.openEditor(previewImage.src);
        } else {
            alert('No existing image found to edit.');
        }
    }
    
    /**
     * Remove image from form
     */
    removeFormImage() {
        const imagePreview = document.getElementById('imagePreview');
        if (!imagePreview) return;

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

        // Clear processed data
        window.processedImageData = null;

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
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.querySelector('.container') || document.body;
        container.insertBefore(notification, container.firstChild);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
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
