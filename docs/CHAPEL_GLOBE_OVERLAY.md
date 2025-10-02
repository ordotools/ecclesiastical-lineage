# Chapel Globe Overlay System

This document describes the new chapel overlay system for the ecclesiastical lineage globe visualization.

## Overview

The `ChapelGlobeOverlay` class provides a clean, focused implementation for overlaying chapel locations on the D3.js globe. It handles positioning, visibility, interactions, and styling of chapel markers.

## Files

- `static/js/chapelGlobeOverlay.js` - Main chapel overlay implementation
- `static/test_chapel_overlay.html` - Test page demonstrating functionality
- `static/js/geographicLineage.js` - Base globe visualization (existing)

## Features

### Core Functionality
- **Precise Positioning**: Uses lat/lng coordinates with D3.js geoOrthographic projection
- **Backface Culling**: Automatically hides markers on the back side of the globe
- **Interactive Markers**: Hover effects, click selection, and detailed tooltips
- **Dynamic Updates**: Responds to globe rotation and zoom changes

### Visual Design
- **Layered Appearance**: Glow effects with core markers for depth
- **State-based Styling**: Different styles for normal, hover, and selected states
- **Color Coding**: Configurable colors for different chapel types
- **Smooth Transitions**: Animated state changes

### Chapel Types Supported
- Cathedral
- Basilica  
- Abbey
- Church
- Chapel

## Usage

### Basic Integration

```javascript
// The chapel overlay automatically initializes when the globe is ready
// It hooks into the existing GeographicLineageVisualization

// Access the overlay instance
const chapelOverlay = window.chapelOverlay;
```

### Adding Chapels

```javascript
const newChapel = {
    id: 'unique-id',
    name: 'Chapel Name',
    type: 'cathedral', // cathedral, basilica, abbey, church, chapel
    lat: 41.9022,      // latitude
    lng: 12.4539,      // longitude
    city: 'Vatican City',
    country: 'Vatican',
    description: 'Optional description',
    yearFounded: 1506  // optional
};

chapelOverlay.addChapel(newChapel);
```

### Managing Chapels

```javascript
// Remove a chapel
chapelOverlay.removeChapel('chapel-id');

// Clear all chapels
chapelOverlay.clearChapels();

// Update all chapel data
chapelOverlay.updateChapelData(newChapelArray);
```

## Data Structure

Each chapel object should have the following structure:

```javascript
{
    id: string,           // Unique identifier
    name: string,         // Display name
    type: string,         // chapel, cathedral, basilica, abbey, church
    lat: number,          // Latitude (-90 to 90)
    lng: number,          // Longitude (-180 to 180)
    city: string,         // City name
    country: string,      // Country name
    description?: string, // Optional description
    yearFounded?: number  // Optional founding year
}
```

## Styling Configuration

The overlay uses a configurable styling system:

```javascript
const styles = {
    chapel: {
        radius: 4,
        fillColor: '#e74c3c',
        strokeColor: '#ffffff',
        strokeWidth: 1.5,
        opacity: 0.9,
        glowRadius: 8,
        glowOpacity: 0.3
    },
    selected: {
        // ... selected state styling
    },
    hover: {
        // ... hover state styling  
    }
};
```

## Test Data

The system includes test data with famous religious sites:
- St. Peter's Basilica (Vatican City)
- Westminster Abbey (London)
- Notre-Dame Cathedral (Paris)
- St. Patrick's Cathedral (New York)
- Sagrada Familia (Barcelona)
- St. Basil's Cathedral (Moscow)
- Hagia Sophia (Istanbul)
- Church of the Holy Sepulchre (Jerusalem)

## Integration with Existing System

The chapel overlay integrates seamlessly with the existing `GeographicLineageVisualization`:

1. **Automatic Initialization**: Detects when the globe is ready
2. **Event Hooking**: Monitors globe rotation and zoom events
3. **Shared Resources**: Uses the same tooltip system and projection
4. **Consistent Styling**: Matches the overall visual design

## Testing

Use the test page (`static/test_chapel_overlay.html`) to:
- View sample chapel data
- Test interaction features
- Add/remove chapels dynamically
- Debug positioning and visibility

## Performance Considerations

- **Efficient Rendering**: Only renders visible markers
- **Event Optimization**: Minimal event listeners per marker
- **Memory Management**: Proper cleanup of DOM elements
- **Update Batching**: Coordinates updated only when necessary

## Browser Compatibility

- Modern browsers with ES6 support
- Requires D3.js v7
- Uses SVG for rendering (good browser support)

## Future Enhancements

Potential improvements for future versions:
- Animation support for marker transitions
- Clustering for dense marker areas
- Custom marker shapes/icons
- Data filtering and search
- Export functionality for chapel data
