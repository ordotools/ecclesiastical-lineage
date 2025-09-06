// Visualization constants - UPDATED for standardized image sizes (25% smaller for better quality)
export const LINK_DISTANCE = 150; // Reduced from 200 for smaller nodes
export const CHARGE_STRENGTH = -400;
export const COLLISION_RADIUS = 60; // Reduced from 80 for smaller nodes
export const OUTER_RADIUS = 30; // Organization ring - reduced from 40 to surround 48×48 images
export const INNER_RADIUS = 24; // Rank ring - reduced from 32 to be visible around images
export const IMAGE_SIZE = 48; // Reduced from 64 to 48×48 for better image quality
export const LABEL_DY = 35; // Reduced from 50 for smaller nodes
export const ARROWHEAD_LENGTH = 16; // Reduced from 18 for smaller nodes

// Get color constants from CSS variables
export const GREEN_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-green').trim() || '#27ae60';
export const BLACK_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--lineage-black').trim() || '#000000';

// Viewport dimensions
export const width = window.innerWidth;
export const height = window.innerHeight - 76;
