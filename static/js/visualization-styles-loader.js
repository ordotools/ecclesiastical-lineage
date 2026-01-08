/**
 * Shared Visualization Styles Loader
 * 
 * Loads visualization styles from database and sets CSS variables.
 * Used by both lineage and editor visualizations to ensure consistent styling.
 */

/**
 * Load styles from database and set CSS variables
 * @returns {Promise<Object>} The loaded styles object
 */
export async function loadVisualizationStyles() {
    try {
        const response = await fetch('/api/visualization/styles');
        const data = await response.json();
        
        if (data.success && data.styles) {
            setCSSVariables(data.styles);
            return data.styles;
        } else {
            console.warn('Failed to load styles from database, using defaults');
            const defaultStyles = getDefaultStyles();
            setCSSVariables(defaultStyles);
            return defaultStyles;
        }
    } catch (error) {
        console.error('Error loading visualization styles:', error);
        const defaultStyles = getDefaultStyles();
        setCSSVariables(defaultStyles);
        return defaultStyles;
    }
}

/**
 * Set CSS variables from styles object
 * @param {Object} styles - Styles object with node, link, and label properties
 */
export function setCSSVariables(styles) {
    const root = document.documentElement;
    
    // Update node CSS variables
    if (styles.node) {
        root.style.setProperty('--viz-node-outer-radius', `${styles.node.outer_radius || 30}px`);
        root.style.setProperty('--viz-node-inner-radius', `${styles.node.inner_radius || 24}px`);
        root.style.setProperty('--viz-node-image-size', `${styles.node.image_size || 48}px`);
        root.style.setProperty('--viz-node-stroke-width', `${styles.node.stroke_width || 3}px`);
    }
    
    // Update link CSS variables
    if (styles.link) {
        const ordinationColor = styles.link.ordination_color || '#1c1c1c';
        const consecrationColor = styles.link.consecration_color || '#11451e';
        const invalidOrdinationColor = styles.link.invalid_ordination_color || '#f39c12';
        const invalidConsecrationColor = styles.link.invalid_consecration_color || '#e74c3c';
        
        root.style.setProperty('--viz-link-ordination-color', ordinationColor);
        root.style.setProperty('--viz-link-consecration-color', consecrationColor);
        root.style.setProperty('--viz-link-invalid-ordination-color', invalidOrdinationColor);
        root.style.setProperty('--viz-link-invalid-consecration-color', invalidConsecrationColor);
        root.style.setProperty('--viz-link-stroke-width', `${styles.link.stroke_width || 2}px`);
        
        // Arrow markers use the same colors as links
        root.style.setProperty('--viz-arrow-ordination-color', ordinationColor);
        root.style.setProperty('--viz-arrow-consecration-color', consecrationColor);
        root.style.setProperty('--viz-arrow-invalid-ordination-color', invalidOrdinationColor);
        root.style.setProperty('--viz-arrow-invalid-consecration-color', invalidConsecrationColor);
    }
    
    // Update arrow CSS variables
    if (styles.arrow) {
        root.style.setProperty('--viz-arrow-size', styles.arrow.size || 8);
        root.style.setProperty('--viz-arrow-style', styles.arrow.style || 'triangle');
    }
    
    // Update label CSS variables
    if (styles.label) {
        root.style.setProperty('--viz-label-font-size', `${styles.label.font_size || 12}px`);
        root.style.setProperty('--viz-label-color', styles.label.color || '#ffffff');
        root.style.setProperty('--viz-label-dy', `${styles.label.dy || 35}px`);
    }
}

/**
 * Get default styles
 * @returns {Object} Default styles object
 */
function getDefaultStyles() {
    return {
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
}

/**
 * Get CSS variable value
 * @param {string} variableName - CSS variable name (with or without -- prefix)
 * @returns {string} The CSS variable value
 */
export function getCSSVariable(variableName) {
    const name = variableName.startsWith('--') ? variableName : `--${variableName}`;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Reload styles from database and update CSS variables
 * Useful for refreshing styles after they've been updated
 * @returns {Promise<Object>} The reloaded styles object
 */
export async function reloadVisualizationStyles() {
    return await loadVisualizationStyles();
}
