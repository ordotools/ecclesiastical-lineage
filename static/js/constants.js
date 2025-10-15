// Visualization constants 
export const LINK_DISTANCE = 150;
export const CHARGE_STRENGTH = -400;
export const COLLISION_RADIUS = 60; // Reduced from 80 for smaller nodes
export const OUTER_RADIUS = 30; // Organization ring - reduced from 40 to surround 48×48 images
export const INNER_RADIUS = 1; // Rank ring - reduced from 32 to be visible around images
export const IMAGE_SIZE = 48; // Reduced from 64 to 48×48 for better image quality
export const LABEL_DY = 35; // Reduced from 50 for smaller nodes
export const ARROWHEAD_LENGTH = 16; // Reduced from 18 for smaller nodes

// ============================================================================
// COLOR CONSTANTS - SINGLE SOURCE OF TRUTH FOR FRONTEND
// ============================================================================
// To change colors across the entire application:
// 1. Update these values here
// 2. Update matching values in constants.py (Python backend)
// 3. Restart server and hard refresh browser
//
// These colors are used for:
// - Link/arrow colors in visualizations
// - Arrowhead marker colors
// - CSS variables (set dynamically on page load)
// ============================================================================
export const GREEN_COLOR = '#056c1f';  // Dark green for consecration links
export const BLACK_COLOR = '#0d0d0d';  // Dark gray/black for ordination links

// Viewport dimensions
export const width = window.innerWidth;
export const height = window.innerHeight - 76;

// View zoom levels - these are zoom scale factors, not distances
export const ZOOM_LEVEL_LARGE = 0.5; // Zoomed out - shows more of the graph
export const ZOOM_LEVEL_MEDIUM = 1.0; // Default zoom level
export const ZOOM_LEVEL_SMALL = 1.5; // Zoomed in - closer view
