/**
 * Modular Drag and Drop Photo Upload Component
 * 
 * This module provides reusable drag and drop functionality for photo uploads.
 * It can be easily integrated into any form or component that needs photo upload capabilities.
 * 
 * Usage:
 * const uploader = new DragDropUpload({
 *   container: '#photo-container',
 *   fileInput: '#clergyImage',
 *   uploadButton: '#uploadBtn',
 *   onFileSelect: callbackFunction,
 *   onDragEnter: dragEnterCallback,
 *   onDragLeave: dragLeaveCallback,
 *   onDrop: dropCallback
 * });
 */

class DragDropUpload {
    constructor(options = {}) {
        this.container = document.querySelector(options.container);
        this.fileInput = document.querySelector(options.fileInput);
        this.uploadButton = document.querySelector(options.uploadButton);
        
        // Callbacks
        this.onFileSelect = options.onFileSelect || (() => {});
        this.onDragEnter = options.onDragEnter || (() => {});
        this.onDragLeave = options.onDragLeave || (() => {});
        this.onDrop = options.onDrop || (() => {});
        
        // Configuration
        this.acceptedTypes = options.acceptedTypes || ['image/*'];
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
        this.showVisualFeedback = options.showVisualFeedback !== false; // true by default
        
        // State
        this.isDragOver = false;
        this.dragCounter = 0;
        
        this.init();
    }
    
    init() {
        if (!this.container) {
            console.error('DragDropUpload: Container element not found');
            return;
        }
        
        this.setupEventListeners();
        this.addDragDropStyles();
    }
    
    setupEventListeners() {
        // Container drag events with Chrome-specific handling
        this.container.addEventListener('dragenter', this.handleDragEnter.bind(this), true);
        this.container.addEventListener('dragover', this.handleDragOver.bind(this), true);
        this.container.addEventListener('dragleave', this.handleDragLeave.bind(this), true);
        this.container.addEventListener('drop', this.handleDrop.bind(this), true);
        
        // Additional Chrome-specific event handling
        this.container.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        }, true);
        
        // Prevent context menu on drag
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        }, true);
        
        // Add a more specific document-level handler that only prevents when not over our container
        document.addEventListener('dragover', (e) => {
            // Only prevent default if we're not over our container
            if (!this.container.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true);
        
        document.addEventListener('drop', (e) => {
            // Only prevent default if we're not over our container
            if (!this.container.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true);
        
        // File input change event
        if (this.fileInput) {
            this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
        
        // Upload button click event
        if (this.uploadButton) {
            this.uploadButton.addEventListener('click', () => {
                if (this.fileInput) {
                    this.fileInput.click();
                }
            });
        }
        
        // Click on container to trigger file input
        this.container.addEventListener('click', (e) => {
            // Only trigger if clicking on the container itself, not buttons or images
            if (e.target === this.container && this.fileInput && !this.isDragOver) {
                e.preventDefault();
                e.stopPropagation();
                this.fileInput.click();
            }
        });
    }
    
    handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.dragCounter++;
        
        if (this.dragCounter === 1) {
            this.isDragOver = true;
            this.addDragOverClass();
            this.onDragEnter();
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        return false;
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.dragCounter--;
        
        if (this.dragCounter === 0) {
            this.isDragOver = false;
            this.removeDragOverClass();
            this.onDragLeave();
        }
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        
        this.dragCounter = 0;
        this.isDragOver = false;
        this.removeDragOverClass();
        
        const files = e.dataTransfer.files;
        
        if (files.length > 0) {
            const file = files[0];
            this.processFile(file);
        }
        
        return false;
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }
    
    processFile(file) {
        
        // Validate file type
        if (!this.isValidFileType(file)) {
            this.showError('Please select a valid image file.');
            return;
        }
        
        // Validate file size
        if (!this.isValidFileSize(file)) {
            this.showError(`File size must be less than ${this.formatFileSize(this.maxFileSize)}.`);
            return;
        }
        
        
        // Set the file in the input element for form submission
        if (this.fileInput) {
            try {
                // Create a new DataTransfer object
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                this.fileInput.files = dataTransfer.files;
            } catch (error) {
                // Fallback for older browsers
                this.fileInput.value = '';
            }
        }
        
        // Call the file selection callback
        this.onFileSelect(file);
        this.onDrop(file);
    }
    
    isValidFileType(file) {
        return this.acceptedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.slice(0, -1));
            }
            return file.type === type;
        });
    }
    
    isValidFileSize(file) {
        return file.size <= this.maxFileSize;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    addDragOverClass() {
        if (this.showVisualFeedback) {
            this.container.classList.add('drag-over');
        }
    }
    
    removeDragOverClass() {
        if (this.showVisualFeedback) {
            this.container.classList.remove('drag-over');
        }
    }
    
    addDragDropStyles() {
        // Add CSS classes for styling
        this.container.classList.add('drag-drop-container');
        
        // Add hover effect class
        this.container.classList.add('drag-drop-hover');
    }
    
    showError(message) {
        // You can customize this to show errors in your preferred way
        console.error('DragDropUpload Error:', message);
        
        // If there's a global notification system, use it
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else if (window.alert) {
            alert(message);
        }
    }
    
    // Public methods for external control
    destroy() {
        // Remove event listeners
        document.removeEventListener('dragover', (e) => e.preventDefault());
        document.removeEventListener('drop', (e) => e.preventDefault());
        
        this.container.removeEventListener('dragenter', this.handleDragEnter.bind(this));
        this.container.removeEventListener('dragover', this.handleDragOver.bind(this));
        this.container.removeEventListener('dragleave', this.handleDragLeave.bind(this));
        this.container.removeEventListener('drop', this.handleDrop.bind(this));
        
        if (this.fileInput) {
            this.fileInput.removeEventListener('change', this.handleFileSelect.bind(this));
        }
        
        if (this.uploadButton) {
            this.uploadButton.removeEventListener('click', () => {
                if (this.fileInput) {
                    this.fileInput.click();
                }
            });
        }
        
        this.container.removeEventListener('click', (e) => {
            if (e.target === this.container && this.fileInput) {
                this.fileInput.click();
            }
        });
        
        // Remove CSS classes
        this.container.classList.remove('drag-drop-container', 'drag-drop-hover', 'drag-over');
    }
    
    // Method to programmatically trigger file selection
    triggerFileSelect() {
        if (this.fileInput) {
            this.fileInput.click();
        }
    }
    
    // Method to check if drag and drop is supported
    static isSupported() {
        const div = document.createElement('div');
        return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 
               'FormData' in window && 'FileReader' in window;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragDropUpload;
} else if (typeof window !== 'undefined') {
    window.DragDropUpload = DragDropUpload;
}
