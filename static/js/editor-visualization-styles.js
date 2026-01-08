/**
 * Visualization Style Panel Controller
 * Handles UI for style customization panel and persistence to database
 */

// Prevent duplicate execution when script is reloaded via HTMX
// Wrap everything in an IIFE that checks first - this prevents class hoisting issues
(function() {
    'use strict';
    
    // Check if class already exists - if so, skip everything
    if (window.VisualizationStyleController) {
        console.log('VisualizationStyleController already exists, skipping script execution...');
        // Still need to initialize/reinitialize the controller
        function initializeStyleController() {
            // Clean up existing controller if panel was reloaded
            if (window.vizStyleController) {
                // Remove old event listeners by creating a new instance
                window.vizStyleController = null;
            }
            
            if (!window.vizStyleController && typeof window.VisualizationStyleController !== 'undefined') {
                window.vizStyleController = new window.VisualizationStyleController();
            }
        }
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeStyleController);
        } else {
            initializeStyleController();
        }
        return; // Exit early - don't declare class again
    }
    
    // Check if already executed
    if (window._editorVizStylesLoaded) {
        console.log('Editor visualization styles script already loaded, skipping...');
        return;
    }
    window._editorVizStylesLoaded = true;

class VisualizationStyleController {
    constructor() {
        this.styles = null;
        this.isPanelOpen = false;
        this.init();
    }
    
    async init() {
        // Wait for panel elements to be available before initializing
        const checkElements = () => {
            const panel = document.getElementById('viz-style-panel');
            if (!panel) {
                setTimeout(checkElements, 100);
                return;
            }
            
            // Elements are ready, proceed with initialization
            this.loadStyles().then(() => {
                this.setupEventListeners();
                this.applyStylesToVisualization();
            });
        };
        
        checkElements();
    }
    
    async loadStyles() {
        try {
            const response = await fetch('/api/visualization/styles');
            const data = await response.json();
            
            if (data.success && data.styles) {
                this.styles = data.styles;
                // Wait for elements to be ready before updating UI
                this.updateUIFromStyles();
            } else {
                console.warn('Failed to load styles, using defaults');
                this.loadDefaultStyles();
            }
        } catch (error) {
            console.error('Error loading styles:', error);
            this.loadDefaultStyles();
        }
    }
    
    loadDefaultStyles() {
        this.styles = {
            node: {
                outer_radius: 30,
                inner_radius: 24,
                image_size: 48,
                stroke_width: 3
            },
            link: {
                ordination_color: '#1c1c1c',
                consecration_color: '#11451e',
                invalid_ordination_color: '#f39c12',
                invalid_consecration_color: '#e74c3c',
                stroke_width: 2
            },
            label: {
                font_size: 12,
                color: '#ffffff',
                dy: 35
            }
        };
        // Wait for elements to be ready before updating UI
        this.updateUIFromStyles();
    }
    
    updateUIFromStyles(retryCount = 0) {
        if (!this.styles) return;
        
        // Check if all required elements exist before proceeding
        const requiredElements = [
            'outer-radius', 'outer-radius-value',
            'inner-radius', 'inner-radius-value',
            'image-size', 'image-size-value',
            'node-stroke-width', 'node-stroke-width-value',
            'link-ordination-color', 'link-consecration-color', 'link-invalid-ordination-color', 'link-invalid-consecration-color',
            'link-stroke-width', 'link-stroke-width-value',
            'label-font-size', 'label-font-size-value',
            'label-color', 'label-dy', 'label-dy-value'
        ];
        
        const allElementsExist = requiredElements.every(id => document.getElementById(id) !== null);
        if (!allElementsExist) {
            // Elements not ready yet, retry after a short delay (max 10 retries = 1 second)
            if (retryCount < 10) {
                setTimeout(() => this.updateUIFromStyles(retryCount + 1), 100);
            } else {
                console.warn('Style panel elements not found after retries');
            }
            return;
        }
        
        // Helper function to safely set element value
        const setValue = (id, value) => {
            try {
                const el = document.getElementById(id);
                if (!el) {
                    return false;
                }
                if (el.type === 'range' || el.type === 'color') {
                    el.value = value;
                } else {
                    el.textContent = value;
                }
                return true;
            } catch (e) {
                console.error(`Error setting value for ${id}:`, e);
                return false;
            }
        };
        
        // Node styles
        const nodeStyles = this.styles.node || {};
        setValue('outer-radius', nodeStyles.outer_radius || 30);
        setValue('outer-radius-value', nodeStyles.outer_radius || 30);
        setValue('inner-radius', nodeStyles.inner_radius || 24);
        setValue('inner-radius-value', nodeStyles.inner_radius || 24);
        setValue('image-size', nodeStyles.image_size || 48);
        setValue('image-size-value', nodeStyles.image_size || 48);
        setValue('node-stroke-width', nodeStyles.stroke_width || 3);
        setValue('node-stroke-width-value', nodeStyles.stroke_width || 3);
        
        // Link styles
        const linkStyles = this.styles.link || {};
        setValue('link-ordination-color', linkStyles.ordination_color || '#1c1c1c');
        setValue('link-consecration-color', linkStyles.consecration_color || '#11451e');
        setValue('link-invalid-ordination-color', linkStyles.invalid_ordination_color || '#f39c12');
        setValue('link-invalid-consecration-color', linkStyles.invalid_consecration_color || '#e74c3c');
        setValue('link-stroke-width', linkStyles.stroke_width || 2);
        setValue('link-stroke-width-value', linkStyles.stroke_width || 2);
        
        // Label styles
        const labelStyles = this.styles.label || {};
        setValue('label-font-size', labelStyles.font_size || 12);
        setValue('label-font-size-value', labelStyles.font_size || 12);
        setValue('label-color', labelStyles.color || '#ffffff');
        setValue('label-dy', labelStyles.dy || 35);
        setValue('label-dy-value', labelStyles.dy || 35);
    }
    
    setupEventListeners() {
        // Toggle panel
        const toggleBtn = document.getElementById('viz-style-toggle');
        const closeBtn = document.getElementById('viz-style-close');
        const panel = document.getElementById('viz-style-panel');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.togglePanel());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
        }
        
        // Color pickers
        const colorPickers = document.querySelectorAll('.viz-color-picker');
        colorPickers.forEach(picker => {
            picker.addEventListener('change', () => this.handleStyleChange());
        });
        
        // Sliders
        const sliders = document.querySelectorAll('.viz-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', () => {
                // Update value display
                const valueSpan = document.getElementById(slider.id + '-value');
                if (valueSpan) {
                    valueSpan.textContent = slider.value;
                }
                this.handleStyleChange();
            });
        });
        
        // Save button
        const saveBtn = document.getElementById('viz-style-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveStylesNow());
        }
        
        // Reset button
        const resetBtn = document.getElementById('viz-style-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetStyles());
        }
    }
    
    togglePanel() {
        const panel = document.getElementById('viz-style-panel');
        const toggleBtn = document.getElementById('viz-style-toggle');
        if (!panel || !toggleBtn) return;
        
        this.isPanelOpen = !this.isPanelOpen;
        
        if (this.isPanelOpen) {
            // Move button up when panel opens
            toggleBtn.style.bottom = 'calc(40% + 12px)';
            panel.classList.remove('hidden');
        } else {
            // Move button back down when panel closes
            toggleBtn.style.bottom = '12px';
            panel.classList.add('hidden');
        }
    }
    
    closePanel() {
        this.isPanelOpen = false;
        const panel = document.getElementById('viz-style-panel');
        const toggleBtn = document.getElementById('viz-style-toggle');
        if (panel) {
            panel.classList.add('hidden');
            // Move button back down when panel closes
            if (toggleBtn) {
                toggleBtn.style.bottom = '12px';
            }
        }
    }
    
    handleStyleChange() {
        // Collect current values from UI
        const styles = {
            node: {
                outer_radius: parseInt(document.getElementById('outer-radius').value),
                inner_radius: parseInt(document.getElementById('inner-radius').value),
                image_size: parseInt(document.getElementById('image-size').value),
                stroke_width: parseInt(document.getElementById('node-stroke-width').value)
            },
            link: {
                ordination_color: document.getElementById('link-ordination-color').value,
                consecration_color: document.getElementById('link-consecration-color').value,
                invalid_ordination_color: document.getElementById('link-invalid-ordination-color').value,
                invalid_consecration_color: document.getElementById('link-invalid-consecration-color').value,
                stroke_width: parseInt(document.getElementById('link-stroke-width').value)
            },
            label: {
                font_size: parseInt(document.getElementById('label-font-size').value),
                color: document.getElementById('label-color').value,
                dy: parseInt(document.getElementById('label-dy').value)
            }
        };
        
        this.styles = styles;
        
        // Apply styles immediately to visualization
        this.applyStylesToVisualization();
        
        // Save to database (debounced)
        this.debouncedSave();
    }
    
    async saveStylesNow() {
        /** Explicit save method - can be called manually */
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        await this.saveStyles();
    }
    
    debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveStyles();
        }, 500);
    }
    
    async saveStyles() {
        try {
            const saveBtn = document.getElementById('viz-style-save');
            const originalText = saveBtn ? saveBtn.textContent : 'Save Styles';
            
            // Show saving state
            if (saveBtn) {
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;
            }
            
            const response = await fetch('/api/visualization/styles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    styles: this.styles
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('Styles saved successfully');
                if (saveBtn) {
                    saveBtn.textContent = 'Saved!';
                    setTimeout(() => {
                        saveBtn.textContent = originalText;
                        saveBtn.disabled = false;
                    }, 1500);
                }
            } else {
                console.error('Failed to save styles:', data.error);
                if (saveBtn) {
                    saveBtn.textContent = 'Error - Retry';
                    setTimeout(() => {
                        saveBtn.textContent = originalText;
                        saveBtn.disabled = false;
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Error saving styles:', error);
            const saveBtn = document.getElementById('viz-style-save');
            if (saveBtn) {
                saveBtn.textContent = 'Error - Retry';
                setTimeout(() => {
                    saveBtn.textContent = 'Save Styles';
                    saveBtn.disabled = false;
                }, 2000);
            }
        }
    }
    
    updateCSSVariables() {
        /** Update CSS custom properties to match current styles */
        if (!this.styles) return;
        
        const root = document.documentElement;
        
        // Update node CSS variables
        if (this.styles.node) {
            root.style.setProperty('--viz-node-outer-radius', `${this.styles.node.outer_radius || 30}px`);
            root.style.setProperty('--viz-node-inner-radius', `${this.styles.node.inner_radius || 24}px`);
            root.style.setProperty('--viz-node-image-size', `${this.styles.node.image_size || 48}px`);
            root.style.setProperty('--viz-node-stroke-width', `${this.styles.node.stroke_width || 3}px`);
        }
        
        // Update link CSS variables
        if (this.styles.link) {
            const ordinationColor = this.styles.link.ordination_color || '#1c1c1c';
            const consecrationColor = this.styles.link.consecration_color || '#11451e';
            const invalidOrdinationColor = this.styles.link.invalid_ordination_color || '#f39c12';
            const invalidConsecrationColor = this.styles.link.invalid_consecration_color || '#e74c3c';
            
            root.style.setProperty('--viz-link-ordination-color', ordinationColor);
            root.style.setProperty('--viz-link-consecration-color', consecrationColor);
            root.style.setProperty('--viz-link-invalid-ordination-color', invalidOrdinationColor);
            root.style.setProperty('--viz-link-invalid-consecration-color', invalidConsecrationColor);
            root.style.setProperty('--viz-link-stroke-width', `${this.styles.link.stroke_width || 2}px`);
            
            // Arrow markers use the same colors as links
            root.style.setProperty('--viz-arrow-ordination-color', ordinationColor);
            root.style.setProperty('--viz-arrow-consecration-color', consecrationColor);
            root.style.setProperty('--viz-arrow-invalid-ordination-color', invalidOrdinationColor);
            root.style.setProperty('--viz-arrow-invalid-consecration-color', invalidConsecrationColor);
        }
        
        // Update label CSS variables
        if (this.styles.label) {
            root.style.setProperty('--viz-label-font-size', `${this.styles.label.font_size || 12}px`);
            root.style.setProperty('--viz-label-color', this.styles.label.color || '#ffffff');
            root.style.setProperty('--viz-label-dy', `${this.styles.label.dy || 35}px`);
        }
    }
    
    applyStylesToVisualization() {
        if (!this.styles || !window.editorVisualization) return;
        
        // Update CSS variables for any CSS-based styling
        this.updateCSSVariables();
        
        // Apply styles using the visualization's applyStyles method (for JavaScript/D3 attributes)
        if (typeof window.editorVisualization.applyStyles === 'function') {
            window.editorVisualization.applyStyles(this.styles);
        }
    }
    
    async resetStyles() {
        // Load default styles
        this.loadDefaultStyles();
        
        // Apply immediately
        this.applyStylesToVisualization();
        
        // Save to database
        await this.saveStyles();
    }
    
    getStyles() {
        return this.styles;
    }
}

// Make class globally available
window.VisualizationStyleController = VisualizationStyleController;

// Initialize when DOM is ready
let styleController = null;

function initializeStyleController() {
    // Clean up existing controller if panel was reloaded
    if (styleController && window.vizStyleController) {
        // Remove old event listeners by creating a new instance
        styleController = null;
        window.vizStyleController = null;
    }
    
    if (!styleController && typeof VisualizationStyleController !== 'undefined') {
        styleController = new VisualizationStyleController();
        window.vizStyleController = styleController;
    }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStyleController);
} else {
    initializeStyleController();
}

})(); // End of IIFE - wraps entire script to prevent duplicate class declaration