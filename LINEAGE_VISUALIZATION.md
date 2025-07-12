# Lineage Visualization Feature

## Overview

The Ecclesiastical Lineage application now includes a full-page interactive visualization of clergy lineage relationships using D3.js. This feature allows users to visualize the apostolic succession and ecclesiastical relationships between clergy members.

## Features

### Visual Elements

- **Nodes**: Each clergy member is represented as a circular node with their name displayed below
- **Arrows**: Different types of relationships are shown with different arrow styles:
  - **Black arrows**: Ordination relationships (clergy who ordained another)
  - **Green arrows**: Consecration relationships (clergy who consecrated another)
  - **Dotted green arrows**: Co-consecration relationships (clergy who co-consecrated another)

### Interactive Features

- **Zoom and Pan**: Users can zoom in/out and pan around the visualization
- **Hover Tooltips**: Hovering over nodes shows detailed information about the clergy member
- **Date Labels**: Each arrow displays the date of the ordination, consecration, or co-consecration
- **Reset Controls**: Buttons to reset zoom and center the graph
- **Responsive Design**: The visualization adapts to different screen sizes

### Navigation

- **Legend**: Shows the different types of relationships with visual examples
- **Controls**: Reset zoom and center graph buttons
- **Full-page Layout**: Takes up the entire viewport (excluding navigation bar)

## Technical Implementation

### Backend (Flask)

The `/lineage` route in `app.py` processes clergy data and creates:

1. **Nodes**: Array of clergy objects with id, name, rank, and organization
2. **Links**: Array of relationship objects with:
   - `source`: ID of the clergy who performed the action
   - `target`: ID of the clergy who received the action
   - `type`: Type of relationship (ordination, consecration, co-consecration)
   - `date`: Date of the action
   - `color`: Arrow color
   - `dashed`: Boolean for dotted lines

### Frontend (D3.js)

The visualization uses D3.js v7 with:

- **Force-directed layout**: Automatic positioning of nodes using physics simulation
- **SVG rendering**: Scalable vector graphics for crisp display at any zoom level
- **Event handling**: Mouse interactions for tooltips and controls
- **Responsive design**: Adapts to window resizing

### Data Structure

```javascript
// Nodes
{
  id: 1,
  name: "Clergy Name",
  rank: "Bishop",
  organization: "Organization Name"
}

// Links
{
  source: 1,
  target: 2,
  type: "consecration",
  date: "2023-01-15",
  color: "#27ae60",
  dashed: false
}
```

## Usage

1. **Access**: Click "View Lineage" from the dashboard or clergy list page
2. **Navigate**: Use mouse wheel to zoom, drag to pan
3. **Explore**: Hover over nodes to see clergy details
4. **Reset**: Use control buttons to reset view or center the graph

## Styling

The visualization follows the application's UI/UX standards:

- **Color Palette**: Uses the defined color scheme from `UI_UX_STANDARDS.md`
- **Typography**: Consistent font family and sizing
- **Glass Morphism**: Semi-transparent overlays for controls and legend
- **Responsive**: Adapts to different screen sizes

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## Performance Considerations

- **Data Loading**: Clergy data is loaded server-side and passed as JSON
- **Rendering**: D3.js handles efficient SVG rendering and updates
- **Memory**: Force simulation is optimized for typical clergy dataset sizes
- **Responsiveness**: Smooth animations and interactions

## Future Enhancements

Potential improvements could include:

- **Filtering**: Filter by date range, organization, or relationship type
- **Search**: Search for specific clergy members
- **Export**: Export visualization as image or PDF
- **Print**: Print-friendly version of the lineage chart
- **Animations**: Animated transitions when data changes
- **Hierarchical Layout**: Tree-like layout for clearer lineage flow 