/**
 * Sprite Sheet Cache Utility
 * 
 * Caches sprite sheet data in sessionStorage to avoid redundant API calls.
 * The cache is keyed by sprite URL, so it automatically invalidates when a new sprite is generated.
 */

const SPRITE_SHEET_CACHE_KEY = 'spriteSheetData';
const SPRITE_SHEET_URL_KEY = 'spriteSheetUrl';

/**
 * Get sprite sheet data from cache or fetch from API
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data
 * @returns {Promise<Object|null>} Sprite sheet data or null if unavailable
 */
async function getSpriteSheetData(forceRefresh = false) {
    try {
        // Check if we have cached data (unless forcing refresh)
        if (!forceRefresh) {
            const cachedData = sessionStorage.getItem(SPRITE_SHEET_CACHE_KEY);
            const cachedUrl = sessionStorage.getItem(SPRITE_SHEET_URL_KEY);
            
            if (cachedData && cachedUrl) {
                try {
                    const parsed = JSON.parse(cachedData);
                    // Use cached data directly - cache invalidation happens when sprite is updated
                    console.log('Using cached sprite sheet data');
                    return parsed;
                } catch (e) {
                    console.warn('Error parsing cached sprite sheet data:', e);
                    // Clear corrupted cache
                    sessionStorage.removeItem(SPRITE_SHEET_CACHE_KEY);
                    sessionStorage.removeItem(SPRITE_SHEET_URL_KEY);
                }
            }
        }
        
        // Fetch fresh data
        console.log('Fetching sprite sheet data from API');
        const response = await fetch('/api/sprite-sheet', {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.warn('Sprite sheet API returned non-OK status:', response.status);
            return null;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.warn('Sprite sheet endpoint returned non-JSON response:', contentType, text.substring(0, 200));
            return null;
        }
        
        const spriteSheetData = await response.json();
        
        // Cache the data
        if (spriteSheetData && spriteSheetData.success) {
            sessionStorage.setItem(SPRITE_SHEET_CACHE_KEY, JSON.stringify(spriteSheetData));
            sessionStorage.setItem(SPRITE_SHEET_URL_KEY, spriteSheetData.url || '');
        }
        
        return spriteSheetData;
        
    } catch (error) {
        console.error('Error fetching sprite sheet data:', error);
        return null;
    }
}

/**
 * Invalidate sprite sheet cache
 * Call this when a new sprite sheet is generated
 */
function invalidateSpriteSheetCache() {
    sessionStorage.removeItem(SPRITE_SHEET_CACHE_KEY);
    sessionStorage.removeItem(SPRITE_SHEET_URL_KEY);
    console.log('Sprite sheet cache invalidated');
}

/**
 * Force refresh sprite sheet data (bypass cache)
 * @returns {Promise<Object|null>} Fresh sprite sheet data
 */
async function refreshSpriteSheetData() {
    invalidateSpriteSheetCache();
    return await getSpriteSheetData(true);
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.getSpriteSheetData = getSpriteSheetData;
    window.invalidateSpriteSheetCache = invalidateSpriteSheetCache;
    window.refreshSpriteSheetData = refreshSpriteSheetData;
}
