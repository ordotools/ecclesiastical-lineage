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
     * Convert Backblaze B2 URL to proxy URL to avoid CORS issues
     */
    getProxyUrl(originalUrl) {
        if (!originalUrl) return originalUrl;
        
        // Check if it's already a proxy URL
        if (originalUrl.includes('/proxy-image')) {
            return originalUrl;
        }
        
        // Check if it's a Backblaze B2 URL
        if (originalUrl.includes('backblazeb2.com') || originalUrl.includes('s3.us-east-005.backblazeb2.com')) {
            // Encode the URL for use as a query parameter
            const encodedUrl = encodeURIComponent(originalUrl);
            return `/proxy-image?url=${encodedUrl}`;
        }
        
        // Return original URL if it's not a Backblaze URL (e.g., data URLs, local URLs)
        return originalUrl;
    }
    
    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Footer buttons
        document.getElementById('resetImageBtn')?.addEventListener('click', () => this.resetImage());
        document.getElementById('previewBtn')?.addEventListener('click', () => this.showPreview());
        document.getElementById('applyChangesBtn')?.addEventListener('click', () => this.applyChanges());
        
        // Modal close events
        const imageEditorModal = document.getElementById('imageEditorModal');
        if (imageEditorModal) {
            imageEditorModal.addEventListener('hidden.bs.modal', () => {
                this.cleanup();
                console.log('Image editor modal closed, cleaned up resources');
            });
        }
        
        // Cancel button event listener
        const cancelBtn = document.querySelector('#imageEditorModal .btn-secondary[data-bs-dismiss="modal"]');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
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
    async openEditor(imageData, originalFile = null) {
        console.log('Opening image editor with data length:', imageData ? imageData.length : 0);
        console.log('Original file provided:', !!originalFile);
        
        // Clear any existing processed data to prevent conflicts
        this.clearProcessedData();
        
        // Add a unique timestamp to prevent caching issues
        const timestamp = Date.now();
        this.sessionId = timestamp;
        
        // If we have an original file, use loadOriginalImage() for high-quality editing
        if (originalFile) {
            console.log('Using loadOriginalImage() for high-quality editing from file');
            try {
                const originalImageData = await this.loadOriginalImage(originalFile);
                this.originalImageData = originalImageData;
                this.originalImageFile = originalFile;
                this.currentImageData = originalImageData;
                this.currentEditorImageData = originalImageData;
                console.log('Original image loaded successfully via loadOriginalImage()');
            } catch (error) {
                console.error('Error loading original image from file:', error);
                // Fallback to provided imageData
                this.originalImageData = imageData;
                this.originalImageFile = originalFile;
                this.currentImageData = imageData;
                this.currentEditorImageData = imageData;
            }
        } else {
            // No original file, use provided imageData
            this.originalImageData = imageData;
            this.originalImageFile = originalFile;
            this.currentImageData = imageData;
            this.currentEditorImageData = imageData;
        }

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
        
        // If we already have the original image loaded, don't override it
        if (editorImage.src && editorImage.src.includes('original_')) {
            console.log('Original image already loaded, skipping source override');
            // Just initialize the cropper with the existing image
            this.initializeCropper();
            return;
        }
        
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
        
        // Set image source using proxy URL to avoid CORS issues
        const proxyUrl = this.getProxyUrl(imageSrc);
        console.log('Setting image source:', proxyUrl.substring(0, 100) + '...');
        editorImage.src = proxyUrl;
        
        // Wait for image to load
        editorImage.onload = () => {
            console.log('Editor image loaded with dimensions:', editorImage.naturalWidth, '×', editorImage.naturalHeight);
            console.log('Image source type check:', this.currentEditorImageData.substring(0, 50));
            console.log('Session ID:', this.sessionId);
            console.log('Image src attribute:', editorImage.src);
            console.log('Image currentSrc:', editorImage.currentSrc);

            // Additional validation
            if (editorImage.naturalWidth <= 48 || editorImage.naturalHeight <= 48) {
                console.warn('WARNING: Image dimensions are very small! This might be the 48x48 lineage image instead of full resolution.');
                console.warn('Image source starts with:', this.currentEditorImageData.substring(0, 100));
            } else if (editorImage.naturalWidth <= 320 && editorImage.naturalHeight <= 320) {
                console.warn('WARNING: Image dimensions are 320x320 or smaller! This might be the detail image instead of the original.');
                console.warn('Expected original image to be larger than 320x320');
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
        
        // Initialize new cropper - ENFORCE SQUARE CROPPING ONLY
        console.log('Creating new cropper instance with square-only cropping');
        this.cropper = new Cropper(editorImage, {
            aspectRatio: 1, // LOCKED to square - cannot be changed
            viewMode: 2, // Ensure the entire image is visible
            dragMode: 'crop',
            autoCropArea: 0.7, // Smaller initial crop area
            restore: false,
            guides: true,
            center: true,
            highlight: true,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            background: false, // Remove background overlay
            modal: false, // Remove modal overlay
            zoomable: true,
            zoomOnWheel: true,
            wheelZoomRatio: 0.1,
            minCropBoxWidth: 50,
            minCropBoxHeight: 50,
            maxCropBoxWidth: 2000, // Much larger maximum crop box size
            maxCropBoxHeight: 2000,
            // Force square aspect ratio - disable aspect ratio changes
            aspectRatio: 1,
            cropBoxResizable: true,
            cropBoxMovable: true,
            ready: () => {
                console.log('Cropper ready callback triggered');
                this.updateCropDimensions();
                // Ensure image fits within viewport
                this.cropper.reset();
                // Set constraints to prevent crop box from extending beyond container
                this.setCropConstraints();
                // Crop initialization complete
            },
            crop: () => {
                this.updateCropDimensions();
                // Apply constraints during cropping to prevent extending beyond boundaries
                this.enforceCropConstraints();
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
        // No longer needed since sidebar was removed
    }
    
    /**
     * Set crop constraints to prevent extending beyond container
     */
    setCropConstraints() {
        if (!this.cropper) return;
        
        const containerData = this.cropper.getContainerData();
        const canvasData = this.cropper.getCanvasData();
        
        // Calculate maximum crop box size based on container (no 400px limit)
        const maxSize = Math.min(containerData.width * 0.95, containerData.height * 0.95);
        
        // Update cropper with new constraints
        this.cropper.setCropBoxData({
            width: Math.min(this.cropper.getData().width, maxSize),
            height: Math.min(this.cropper.getData().height, maxSize),
            left: Math.max(0, Math.min(this.cropper.getData().left, containerData.width - maxSize)),
            top: Math.max(0, Math.min(this.cropper.getData().top, containerData.height - maxSize))
        });
    }
    
    /**
     * Enforce crop constraints during cropping operations
     */
    enforceCropConstraints() {
        if (!this.cropper) return;
        
        const containerData = this.cropper.getContainerData();
        const cropData = this.cropper.getData();
        
        // Calculate maximum allowed size and position (no 400px limit)
        const maxSize = Math.min(containerData.width * 0.95, containerData.height * 0.95);
        const maxLeft = containerData.width - cropData.width;
        const maxTop = containerData.height - cropData.height;
        
        // Check if crop box extends beyond boundaries
        let needsAdjustment = false;
        const newCropData = { ...cropData };
        
        if (cropData.width > maxSize) {
            newCropData.width = maxSize;
            needsAdjustment = true;
        }
        
        if (cropData.height > maxSize) {
            newCropData.height = maxSize;
            needsAdjustment = true;
        }
        
        if (cropData.left < 0) {
            newCropData.left = 0;
            needsAdjustment = true;
        } else if (cropData.left > maxLeft) {
            newCropData.left = maxLeft;
            needsAdjustment = true;
        }
        
        if (cropData.top < 0) {
            newCropData.top = 0;
            needsAdjustment = true;
        } else if (cropData.top > maxTop) {
            newCropData.top = maxTop;
            needsAdjustment = true;
        }
        
        // Apply adjustments if needed
        if (needsAdjustment) {
            this.cropper.setData(newCropData);
        }
    }
    
    /**
     * Set aspect ratio (locked to square)
     */
    setAspectRatio(ratio) {
        // Aspect ratio is locked to 1:1 (square) for this application
        if (!this.cropper) return;
        this.cropper.setAspectRatio(1);
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
     * Apply changes and process images - NEW WORKFLOW
     * Only creates small (lineage) and large (detail) versions from cropped image
     */
    async applyChanges() {
        console.log('Apply changes called - NEW WORKFLOW');
        console.log('Cropper instance:', !!this.cropper);
        console.log('Is processing:', this.isProcessing);
        
        if (!this.cropper || this.isProcessing) {
            console.warn('Cannot apply changes: cropper not available or already processing');
            this.showNotification('Cannot process image at this time. Please try again.', 'warning');
            return;
        }
        
        // Validate that we have valid image data
        if (!this.originalImageData) {
            console.error('No valid original image data available for processing');
            this.showNotification('No valid original image data available. Please try uploading again.', 'error');
            return;
        }
        
        this.isProcessing = true;
        this.showProcessingStatus('Processing cropped image...', 10);
        
        try {
            // Get cropped canvas - MUST BE SQUARE
            const croppedCanvas = this.cropper.getCroppedCanvas({
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });
            
            if (!croppedCanvas) {
                throw new Error('Failed to create cropped canvas');
            }
            
            // Validate that the crop is square
            if (croppedCanvas.width !== croppedCanvas.height) {
                throw new Error('Cropped image must be square');
            }
            
            this.showProcessingStatus('Creating small version (lineage)...', 30);
            
            // Create small version (lineage) - as small as possible for quick loading
            const lineageCanvas = await this.createResizedImage(croppedCanvas, 48, 48, 0.95);
            
            this.showProcessingStatus('Creating large version (detail)...', 60);
            
            // Create large version (detail) - full resolution of the crop
            const detailCanvas = await this.createResizedImage(croppedCanvas, 320, 320, 0.95);
            
            this.showProcessingStatus('Uploading to server...', 80);
            
            // Send cropped image to server for processing
            const croppedImageData = croppedCanvas.toDataURL('image/jpeg', 0.98);
            
            // Final validation: Ensure we have a clergy ID
            if (!this.clergyId) {
                throw new Error('Clergy ID is required for image processing');
            }
            
            console.log('Sending cropped image to server:', {
                clergy_id: this.clergyId,
                original_object_key: this.originalObjectKey,
                cropped_image_data_length: croppedImageData.length
            });
            
            const response = await fetch('/api/process-cropped-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    cropped_image_data: croppedImageData,
                    clergy_id: this.clergyId,
                    original_object_key: this.originalObjectKey
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to process image on server');
            }
            
            this.showProcessingStatus('Finalizing...', 100);
            
            // Store the server-processed images
            const processedImages = {
                ...result.image_data,
                cropped: croppedImageData, // Keep local cropped version for preview
                original: this.originalImageData, // Keep reference to original
                metadata: {
                    originalSize: this.originalImageFile ? this.originalImageFile.size : 0,
                    originalType: this.originalImageFile ? this.originalImageFile.type : '',
                    croppedDimensions: `${croppedCanvas.width}x${croppedCanvas.height}`,
                    quality: 95,
                    timestamp: new Date().toISOString(),
                    workflow: 'new_square_crop_only',
                    server_processed: true
                }
            };
            
            // Store processed images for form submission
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
            this.showNotification('Square cropped image processed successfully!', 'success');
            
            // Refresh visualization to show the updated image
            this.refreshVisualization();
            
        } catch (error) {
            console.error('Error processing cropped image:', error);
            this.hideProcessingStatus();
            this.isProcessing = false;
            this.showNotification('Error processing image: ' + error.message, 'error');
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
     * Extract clergy ID from current form or URL
     */
    extractClergyId() {
        console.log('Extracting clergy ID...');
        console.log('Current URL:', window.location.pathname);
        console.log('Current URL search:', window.location.search);
        console.log('Current URL hash:', window.location.hash);
        
        // Try multiple URL patterns
        let urlMatch = window.location.pathname.match(/\/editor\/clergy-form-content\/(\d+)/);
        if (urlMatch) {
            this.clergyId = urlMatch[1];
            console.log('Extracted clergy ID from URL:', this.clergyId);
            return;
        }
        
        // Try other patterns
        urlMatch = window.location.pathname.match(/\/editor\/clergy-form\/(\d+)/);
        if (urlMatch) {
            this.clergyId = urlMatch[1];
            console.log('Extracted clergy ID from clergy-form URL:', this.clergyId);
            return;
        }
        
        // Try to get from the form action URL
        const form = document.getElementById('clergyForm');
        if (form && form.action) {
            console.log('Form action:', form.action);
            const actionMatch = form.action.match(/\/clergy\/(\d+)/);
            if (actionMatch) {
                this.clergyId = actionMatch[1];
                console.log('Extracted clergy ID from form action:', this.clergyId);
                return;
            }
        }
        
        // If still no clergy ID found, try to extract from any URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const clergyIdParam = urlParams.get('clergy_id') || urlParams.get('id');
        if (clergyIdParam) {
            this.clergyId = clergyIdParam;
            console.log('Extracted clergy ID from URL parameter:', this.clergyId);
            return;
        }
        
        // Try to get from HTMX data attributes or global variables
        const htmxData = document.querySelector('[hx-get*="clergy-form"]');
        if (htmxData) {
            console.log('HTMX element found:', htmxData);
            const htmxUrl = htmxData.getAttribute('hx-get');
            console.log('HTMX URL:', htmxUrl);
            if (htmxUrl) {
                const htmxMatch = htmxUrl.match(/\/clergy-form\/(\d+)/);
                if (htmxMatch) {
                    this.clergyId = htmxMatch[1];
                    console.log('Extracted clergy ID from HTMX URL:', this.clergyId);
                    return;
                }
            }
        }
        
        // Try to get from any data attributes on the body or main container
        const body = document.body;
        const clergyIdFromData = body.getAttribute('data-clergy-id') || 
                                body.querySelector('[data-clergy-id]')?.getAttribute('data-clergy-id');
        if (clergyIdFromData) {
            this.clergyId = clergyIdFromData;
            console.log('Extracted clergy ID from data attribute:', this.clergyId);
            return;
        }
        
        console.warn('Could not extract clergy ID from URL or form');
        console.log('Available form elements:', document.querySelectorAll('form'));
        console.log('Available HTMX elements:', document.querySelectorAll('[hx-get]'));
    }

    /**
     * Load original image for editing - always works from original
     */
    async loadOriginalImageForEditing(imageUrl, clergyId) {
        console.log('Loading original image for editing:', imageUrl);
        console.log('Clergy ID received:', clergyId);
        
        // Reset any existing data
        this.clearProcessedData();
        
        // Store the original image URL and clergy ID
        this.originalImageUrl = imageUrl;
        this.clergyId = clergyId;
        
        // Fallback: Extract clergy ID from URL if not provided
        if (!this.clergyId) {
            console.log('Clergy ID not provided, extracting from URL...');
            this.extractClergyId();
        }
        
        console.log('Final stored clergy ID:', this.clergyId);
        
        try {
            // Fetch the original image as a blob to maintain full quality
            console.log('Fetching original image as blob for high-quality editing...');
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            console.log('Original image blob size:', blob.size, 'bytes');
            
            // Create a File object from the blob
            const file = new File([blob], 'original_image.jpg', { type: blob.type });
            console.log('Created file object from blob:', file.name, file.size, 'bytes');
            
            // Use the loadOriginalImage function to load the file
            console.log('Using loadOriginalImage() to load the original file...');
            const imageData = await this.loadOriginalImage(file);
            console.log('Original image loaded successfully via loadOriginalImage()');
            
            // Store the original file and image data
            this.originalImageFile = file;
            this.originalImageData = imageData;
            this.currentImageData = imageData;
            this.currentEditorImageData = imageData;
            
            // Set the editor image source
            const editorImage = document.getElementById('editorImage');
            if (editorImage) {
                editorImage.src = imageData;
                
                // Initialize the editor after image loads
                editorImage.onload = () => {
                    console.log('Original image loaded for editing with full resolution');
                    this.initializeEditor();
                };
            }
            
        } catch (error) {
            console.error('Error loading original image:', error);
            // Fallback to proxy URL loading if blob loading fails
            console.log('Falling back to proxy URL loading...');
            const editorImage = document.getElementById('editorImage');
            if (editorImage) {
                // Use proxy URL to avoid CORS issues
                const proxyUrl = this.getProxyUrl(imageUrl);
                console.log('Using proxy URL for fallback:', proxyUrl);
                editorImage.src = proxyUrl;
                
                // Initialize the editor after image loads
                editorImage.onload = () => {
                    console.log('Original image loaded for editing (fallback method via proxy)');
                    console.log('Fallback image dimensions:', editorImage.naturalWidth, '×', editorImage.naturalHeight);
                    console.log('Fallback image src:', editorImage.src);
                    
                    // Update the current image data to reflect the original image
                    this.currentImageData = editorImage.src;
                    this.currentEditorImageData = editorImage.src;
                    
                    this.initializeEditor();
                };
            }
        }
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
            newCropBtnClone.addEventListener('click', async () => await this.editExistingImage());
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
        
        // Toolbar buttons (only rotate)
        const rotateLeftBtn = document.getElementById('rotateLeftBtn');
        const rotateRightBtn = document.getElementById('rotateRightBtn');
        
        // Footer buttons
        const resetImageBtn = document.getElementById('resetImageBtn');
        const previewBtn = document.getElementById('previewBtn');
        const applyChangesBtn = document.getElementById('applyChangesBtn');
        
        // Settings
        const outputQuality = document.getElementById('outputQuality');
        const sizeLineage = document.getElementById('sizeLineage');
        const sizeDetail = document.getElementById('sizeDetail');
        const sizeOriginal = document.getElementById('sizeOriginal');
        
        // Remove existing listeners and reattach to prevent duplication
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
        
        // Reattach cancel button event listener
        const cancelBtn = document.querySelector('#imageEditorModal .btn-secondary[data-bs-dismiss="modal"]');
        if (cancelBtn) {
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
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
            });
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
            
            // Extract clergy ID from the current form or URL
            this.extractClergyId();
            
            // Load original file directly without compression for high-res cropping
            const originalDataUrl = await this.loadOriginalImage(processedFile);
            await this.openEditor(originalDataUrl, processedFile);
            
            this.showNotification('Image loaded successfully!', 'success');
        } catch (error) {
            console.error('Error processing file:', error);
            this.showNotification('Error processing the selected file. Please try again.', 'error');
        }
    }
    
    /**
     * Edit existing image
     */
    async editExistingImage() {
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
            await this.openEditor(processedData.original);
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
                    await this.openEditor(imageData.cropped);
                    return;
                } else if (imageData.detail) {
                    console.log('Using detail image data as fallback');
                    await this.openEditor(imageData.detail);
                    return;
                } else if (imageData.original) {
                    console.log('Using original image data as fallback');
                    await this.openEditor(imageData.original);
                    return;
                }
            } catch (e) {
                console.error('Failed to parse full image data:', e);
            }
        }

        // Priority 3: Fallback to preview image (48x48 lineage image)
        console.log('Using preview image as fallback');
        await this.openEditor(previewImage.src);
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
     * Refresh the visualization to show updated images
     */
    refreshVisualization() {
        console.log('Refreshing visualization after image processing...');
        
        // Try to refresh the visualization panel
        const visualizationTarget = document.getElementById('visualization-panel-content');
        if (visualizationTarget && typeof htmx !== 'undefined') {
            htmx.ajax('GET', '/editor/visualization', {
                target: visualizationTarget,
                swap: 'innerHTML'
            }).then(() => {
                console.log('Visualization refreshed after image processing');
            }).catch(error => {
                console.error('Visualization refresh failed after image processing:', error);
            });
        } else {
            console.warn('Visualization target not found or HTMX not available for refresh');
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
