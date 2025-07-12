# UI/UX Styling Standards
## Ecclesiastical Lineage Website

### Table of Contents
1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Layout & Spacing](#layout--spacing)
4. [Components](#components)
5. [Interactive Elements](#interactive-elements)
6. [Responsive Design](#responsive-design)
7. [Accessibility](#accessibility)
8. [Animation & Transitions](#animation--transitions)
9. [Form Design](#form-design)
10. [Navigation](#navigation)
11. [Feedback & Notifications](#feedback--notifications)

---

## Color Palette

### Primary Colors
- **Primary Gradient**: `linear-gradient(135deg, #2c3e50 0%, #34495e 100%)`
- **Primary Hover**: `linear-gradient(45deg, #1a252f, #2c3e50)`
- **Primary Text**: `#2c3e50`

### Secondary Colors
- **Success**: `#27ae60` (darker green)
- **Warning**: `#f39c12` (darker orange)
- **Danger**: `#e74c3c` (darker red)
- **Info**: `#3498db` (darker blue)

### Neutral Colors
- **Background**: `linear-gradient(135deg, #2c3e50 0%, #34495e 100%)`
- **Card Background**: `rgba(252, 250, 245, 0.92)` (cream with transparency)
- **Text Primary**: `#2c3e50` (dark grey)
- **Text Secondary**: `#5d6d7e` (medium grey)
- **Border**: `#bdc3c7` (light grey)

### Paper & Cream Colors
- **Paper White**: `#fdfbf7` (pure paper white)
- **Cream**: `#f8f6f0` (warm cream)
- **Off-White**: `#f5f3ed` (slightly darker cream)
- **Grain Overlay**: `rgba(139, 69, 19, 0.03)` (subtle brown grain)

### Semantic Colors
- **Logout Link**: `#e74c3c` (danger)
- **Logout Hover**: `#c0392b` (darker red)
- **Admin Badge**: `#2c3e50` (dark grey)

---

## Typography

### Font Family
```css
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
```

### Font Sizes
- **Display**: `display-4` (Bootstrap)
- **Headings**: `h1`, `h2`, `h3`, `h4` (Bootstrap classes)
- **Body**: Default Bootstrap (16px)
- **Small**: `text-muted` for secondary information

### Font Weights
- **Bold**: `fw-bold` for important text
- **Normal**: Default weight for body text
- **Light**: For subtle information

---

## Layout & Spacing

### Container System
- Use Bootstrap's container system
- **Main Container**: `.container` for centered content
- **Full Width**: `.container-fluid` when needed

### Spacing
- **Section Spacing**: `mt-4`, `mb-4` (1.5rem)
- **Card Padding**: `p-4` (1.5rem)
- **Form Spacing**: `mb-3` (1rem)
- **Button Spacing**: `gap-2` (0.5rem)
- **Border Radius**: `6px` for most elements, `8px` for cards

### Grid System
- Use Bootstrap's 12-column grid
- **Mobile First**: Start with mobile layouts
- **Breakpoints**: Follow Bootstrap's responsive breakpoints

---

## Components

### Cards
```css
.card {
    border: 1px solid rgba(189, 195, 199, 0.3);
    border-radius: 8px;
    box-shadow: 
        0 4px 20px rgba(44, 62, 80, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.92) 0%, 
        rgba(248, 246, 240, 0.88) 100%);
    backdrop-filter: blur(12px);
    position: relative;
}

.card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
        radial-gradient(circle at 20% 80%, rgba(139, 69, 19, 0.02) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(139, 69, 19, 0.02) 0%, transparent 50%);
    border-radius: 8px;
    pointer-events: none;
}
```

### Navigation Bar
```css
.navbar {
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.95) 0%, 
        rgba(248, 246, 240, 0.92) 100%) !important;
    backdrop-filter: blur(15px);
    border-bottom: 1px solid rgba(189, 195, 199, 0.4);
    box-shadow: 
        0 2px 15px rgba(44, 62, 80, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
```

### Alerts
```css
.alert {
    border-radius: 6px;
    border: 1px solid rgba(189, 195, 199, 0.3);
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.95) 0%, 
        rgba(248, 246, 240, 0.9) 100%);
    backdrop-filter: blur(8px);
}
```

---

## Interactive Elements

### Buttons

#### Primary Button
```css
.btn-primary {
    background: linear-gradient(45deg, #2c3e50, #34495e);
    border: 1px solid rgba(44, 62, 80, 0.3);
    border-radius: 6px;
    padding: 10px 24px;
    box-shadow: 
        0 2px 8px rgba(44, 62, 80, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
}

.btn-primary::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
        radial-gradient(circle at 30% 70%, rgba(139, 69, 19, 0.1) 0%, transparent 50%);
    pointer-events: none;
}

.btn-primary:hover {
    background: linear-gradient(45deg, #1a252f, #2c3e50);
    transform: translateY(-1px);
    box-shadow: 
        0 4px 12px rgba(44, 62, 80, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

#### Secondary Button
```css
.btn-outline-secondary {
    border: 1px solid rgba(189, 195, 199, 0.6);
    border-radius: 6px;
    padding: 8px 20px;
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.8) 0%, 
        rgba(248, 246, 240, 0.7) 100%);
    backdrop-filter: blur(8px);
}

.btn-outline-secondary:hover {
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.95) 0%, 
        rgba(248, 246, 240, 0.9) 100%);
    border-color: rgba(189, 195, 199, 0.8);
    transform: translateY(-1px);
}
```

#### Danger Button
```css
.btn-outline-danger {
    border: 1px solid rgba(231, 76, 60, 0.6);
    border-radius: 6px;
    padding: 8px 20px;
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.8) 0%, 
        rgba(248, 246, 240, 0.7) 100%);
    backdrop-filter: blur(8px);
}

.btn-outline-danger:hover {
    background: linear-gradient(135deg, 
        rgba(231, 76, 60, 0.1) 0%, 
        rgba(192, 57, 43, 0.08) 100%);
    border-color: rgba(231, 76, 60, 0.8);
    transform: translateY(-1px);
}
```

### Links
- **Logout Link**: Red color with underline
- **Navigation Links**: Primary color
- **Hover Effects**: Subtle color changes

---

## Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 992px
- **Desktop**: > 992px

### Mobile Considerations
- Stack columns on mobile
- Increase touch targets (minimum 44px)
- Simplify navigation for mobile

### Tablet Considerations
- Maintain readability
- Optimize form layouts
- Ensure proper spacing

---

## Accessibility

### Color Contrast
- Ensure WCAG AA compliance (4.5:1 ratio)
- Test with color blindness simulators
- Provide alternative indicators beyond color

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Visible focus indicators
- Logical tab order

### Screen Readers
- Proper ARIA labels
- Semantic HTML structure
- Descriptive alt text for images

### Form Accessibility
- Clear labels for all form fields
- Error messages associated with fields
- Required field indicators

---

## Animation & Transitions

### Button Hover Effects
```css
transform: translateY(-1px);
transition: all 0.2s ease;
box-shadow: 
    0 4px 12px rgba(44, 62, 80, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
```

### Card Hover Effects
```css
.card:hover {
    transform: translateY(-2px);
    box-shadow: 
        0 6px 25px rgba(44, 62, 80, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.7);
    transition: all 0.3s ease;
}
```

### Glass Morphism Effects
```css
/* Base glass morphism class */
.glass-morphism {
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.9) 0%, 
        rgba(248, 246, 240, 0.85) 100%);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(189, 195, 199, 0.3);
    box-shadow: 
        0 4px 20px rgba(44, 62, 80, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Beveled border effect */
.beveled-border {
    position: relative;
}

.beveled-border::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.4) 0%, 
        transparent 50%, 
        rgba(44, 62, 80, 0.1) 100%);
    pointer-events: none;
}
```

### Loading States
- HTMX loading indicators
- Skeleton screens for content loading

### Flash Messages
- Auto-dismiss after 5 seconds
- Smooth fade in/out animations

---

## Form Design

### Input Fields
```css
.form-control {
    border-radius: 6px;
    border: 1px solid rgba(189, 195, 199, 0.5);
    padding: 12px 15px;
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.9) 0%, 
        rgba(248, 246, 240, 0.85) 100%);
    backdrop-filter: blur(8px);
    box-shadow: 
        inset 0 1px 3px rgba(44, 62, 80, 0.05),
        0 1px 0 rgba(255, 255, 255, 0.8);
}

.form-control:focus {
    border-color: rgba(44, 62, 80, 0.6);
    box-shadow: 
        0 0 0 0.2rem rgba(44, 62, 80, 0.15),
        inset 0 1px 3px rgba(44, 62, 80, 0.05),
        0 1px 0 rgba(255, 255, 255, 0.8);
    background: linear-gradient(135deg, 
        rgba(252, 250, 245, 0.95) 0%, 
        rgba(248, 246, 240, 0.9) 100%);
}
```

### Form Layout
- Group related fields
- Use clear section headers
- Provide helpful placeholder text
- Show validation errors clearly

### Required Fields
- Mark with asterisk (*)
- Provide clear error messages
- Use color coding for validation states

---

## Navigation

### Main Navigation
- Fixed top navigation bar
- Brand name prominently displayed
- User information and logout on the right

### Breadcrumbs
- Show current page location
- Provide easy navigation back

### Secondary Navigation
- Use cards for main actions
- Clear call-to-action buttons
- Consistent icon usage

---

## Feedback & Notifications

### Flash Messages
- Auto-dismiss after 5 seconds
- Color-coded by type (success, error, warning, info)
- Dismissible with close button

### Loading States
- Show loading indicators for async operations
- Disable buttons during processing
- Provide progress feedback

### Error Handling
- Clear error messages
- Suggest solutions when possible
- Maintain user context

---

## Icon Usage

### Font Awesome Icons
- Use Font Awesome 6.0.0
- Consistent icon sizing
- Meaningful icon choices

### Common Icons
- **Users**: `fas fa-users` for clergy management
- **Chart**: `fas fa-chart-line` for analytics
- **Arrow**: `fas fa-arrow-right` for navigation
- **Save**: `fas fa-save` for form submission
- **Clock**: `fas fa-clock` for coming soon features

---

## Code Standards

### CSS Organization
- Group related styles together
- Use consistent naming conventions
- Comment complex CSS rules

### JavaScript
- Use event delegation where appropriate
- Handle HTMX events properly
- Provide fallbacks for JavaScript-disabled users

### HTML Structure
- Semantic HTML elements
- Proper heading hierarchy
- Clean, readable markup

---

## Performance Considerations

### Loading
- Minimize CSS and JavaScript
- Use CDN for external libraries
- Optimize images

### Caching
- Cache static assets
- Use appropriate cache headers
- Minimize server requests

---

## Browser Support

### Target Browsers
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### Progressive Enhancement
- Core functionality works without JavaScript
- Enhance with JavaScript when available
- Graceful degradation for older browsers

---

## Testing Guidelines

### Visual Testing
- Test on multiple screen sizes
- Verify color contrast ratios
- Check for visual consistency

### Functional Testing
- Test all interactive elements
- Verify form validation
- Test accessibility features

### Performance Testing
- Measure page load times
- Test with slow connections
- Verify mobile performance

---

## Implementation Notes

### Bootstrap Integration
- Use Bootstrap 5.1.3 classes
- Extend with custom CSS when needed
- Maintain Bootstrap's responsive behavior

### HTMX Integration
- Use HTMX for dynamic content
- Provide fallbacks for non-HTMX users
- Handle loading states properly

### Custom CSS
- Keep custom CSS minimal
- Use CSS custom properties for theming
- Document any deviations from standards

---

*This document should be updated as the application evolves and new patterns emerge.* 