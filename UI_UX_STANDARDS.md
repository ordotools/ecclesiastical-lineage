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
- **Primary Gradient**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Primary Hover**: `linear-gradient(45deg, #5a6fd8, #6a4190)`
- **Primary Text**: `#667eea`

### Secondary Colors
- **Success**: `#28a745` (Bootstrap success)
- **Warning**: `#ffc107` (Bootstrap warning)
- **Danger**: `#dc3545` (Bootstrap danger)
- **Info**: `#17a2b8` (Bootstrap info)

### Neutral Colors
- **Background**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Card Background**: `rgba(255, 255, 255, 0.95)`
- **Text Primary**: `#212529`
- **Text Secondary**: `#6c757d`
- **Border**: `#e9ecef`

### Semantic Colors
- **Logout Link**: `#dc3545` (danger)
- **Logout Hover**: `#a71d2a`
- **Admin Badge**: `#667eea` (primary)

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

### Grid System
- Use Bootstrap's 12-column grid
- **Mobile First**: Start with mobile layouts
- **Breakpoints**: Follow Bootstrap's responsive breakpoints

---

## Components

### Cards
```css
.card {
    border: none;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
}
```

### Navigation Bar
```css
.navbar {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
}
```

### Alerts
```css
.alert {
    border-radius: 10px;
    border: none;
}
```

---

## Interactive Elements

### Buttons

#### Primary Button
```css
.btn-primary {
    background: linear-gradient(45deg, #667eea, #764ba2);
    border: none;
    border-radius: 25px;
    padding: 10px 30px;
}

.btn-primary:hover {
    background: linear-gradient(45deg, #5a6fd8, #6a4190);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}
```

#### Secondary Button
```css
.btn-outline-secondary {
    border-radius: 25px;
    padding: 8px 20px;
}
```

#### Danger Button
```css
.btn-outline-danger {
    border-radius: 25px;
    padding: 8px 20px;
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
transform: translateY(-2px);
transition: all 0.2s ease;
```

### Card Hover Effects
- Subtle shadow changes
- Smooth transitions

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
    border-radius: 10px;
    border: 2px solid #e9ecef;
    padding: 12px 15px;
}

.form-control:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
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