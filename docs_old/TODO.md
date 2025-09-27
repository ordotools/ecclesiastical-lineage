# TODO.md - Ecclesiastical Lineage Project

## 🎯 Project Overview
**Goal:** Track and visualize ecclesiastical lineages and consecration relationships between clergy members.

## 📋 Current Sprint / Active Tasks

### ✅ **COMPLETED** 
- [x] Fix the dynamic forms so that someone who is a "bishop" has consecrator and consecration date.
- [x] Add an edit button to the clergy on the lineage view.
- [x] Clergy form on lineage has to have the filtering for ordaining and consecrating bishops.
- [x] ⚡ Remove all of the Javascript from the HTML files and have them stand alone
- [x] 🔥 Change the d3 graph so that all the nodes stay together and the bishops repulse other bishops more strongly
- [x] Check for any database migration issues

### 🔥 **HIGH PRIORITY - IN PROGRESS**
- [ ] **CURRENT:** Get rid of the alert when we save an edit to the clergy
- [ ] We need to get some sort of a progress bar when saving records.
- [ ] Add a drag and drop feature to the photo upload input on the form.

### ⚡ **MEDIUM PRIORITY**
- [ ] Review and test lineage visualization functionality
- [ ] Verify clergy modal functionality works properly
- [ ] 🔥 Test fuzzy search implementation

### 🚀 **FUTURE PRIORITY**
- [ ] 🔥 **TOP PRIORITY:** Refactor routes.py into multiple blueprints/modules for maintainability and efficiency

## 🚀 Upcoming Features
- [ ] **Enhanced Lineage Visualization**
  - [ ] Add interactive family tree view
  - [ ] Implement zoom and pan controls
  - [ ] Add export functionality (PNG/PDF)
  - [ ] Color-code different types of relationships
  - [ ] **Image Management System**
    - [ ] Add image cropping modal with Cropper.js
    - [ ] Implement multiple image sizes (small for nodes, large for detail pages)
    - [ ] Add image compression and optimization
    - [ ] Create detail page for clergy with full-size images

- [ ] **Data Management Improvements**
  - [ ] Data validation and error handling
  - [ ] Search and filter improvements
  - [ ] Advanced clergy search (by diocese, date range, etc.)

- [ ] **User Experience Enhancements**
  - [ ] Mobile-responsive design improvements
  - [ ] Dark mode toggle
  - [ ] Keyboard shortcuts for power users
  - [ ] Loading states and better error messages

- [ ] **Administrative Features**
  - [ ] User role management (admin, editor, viewer)
  - [ ] Audit trail for data changes
  - [ ] Backup and restore functionality
  - [ ] System health monitoring

## 🐛 Known Issues & Bugs
- [ ] Investigate any performance issues with large lineage trees
- [ ] Check for edge cases in consecration date validation
- [ ] Verify proper handling of missing clergy data
- [ ] Test edge cases in fuzzy search

## 🔧 Technical Debt & Improvements
- [ ] **Code Quality**
  - [ ] Add comprehensive unit tests
  - [ ] Implement integration tests
  - [ ] Code documentation improvements
  - [ ] Refactor complex functions

- [ ] **Performance**
  - [ ] Optimize database queries
  - [ ] Implement caching for frequently accessed data
  - [ ] Optimize lineage calculation algorithms
  - [ ] Add database indexing where needed

- [ ] **Security**
  - [ ] Security audit of authentication system
  - [ ] Input validation improvements
  - [ ] SQL injection prevention review
  - [ ] Session management improvements

## 📊 Data & Content
- [ ] **Data Quality**
  - [ ] Validate existing clergy data
  - [ ] Add missing consecration dates
  - [ ] Standardize diocese names
  - [ ] Add biographical information where available

- [ ] **Data Sources**
  - [ ] Research additional historical sources
  - [ ] Implement data import from external sources
  - [ ] Add citation tracking for data sources
  - [ ] Create data update procedures

## 🎨 UI/UX Improvements
- [ ] **Design System**
  - [ ] Create consistent color palette
  - [ ] Standardize component styling
  - [ ] Improve typography hierarchy
  - [ ] Add micro-interactions

- [ ] **Accessibility**
  - [ ] WCAG 2.1 compliance audit
  - [ ] Screen reader optimization
  - [ ] Keyboard navigation improvements
  - [ ] Color contrast improvements

## 📚 Documentation
- [ ] **User Documentation**
  - [ ] Add tooltips and help text
  - [ ] FAQ section

## 🚀 Future Enhancements
- [ ] **Advanced Features**
  - [ ] Timeline view of consecrations
  - [ ] Statistical analysis of lineages
  - [ ] Geographic mapping of dioceses
  - [ ] Integration with external databases

- [ ] **Mobile App**
  - [ ] React Native or Flutter app
  - [ ] Offline functionality
  - [ ] Push notifications for updates

## 📝 Notes & Ideas
- Consider adding a "verified" flag for data accuracy
- Explore partnerships with theological institutions
- Consider adding photo uploads for clergy members
- Research integration with existing church management systems

## 🏷️ Priority Legend
- 🔥 **High Priority** - Critical for core functionality
- ⚡ **Medium Priority** - Important for user experience
- 💡 **Low Priority** - Nice to have features
- 🐛 **Bug Fix** - Issues that need resolution

---

## 📅 Last Updated
*Created: [Current Date]*
*Last Modified: [Current Date]*

## 👥 Assignments
*Add team member assignments here as needed*

---

**💡 Tips for using this TODO:**
1. Update priorities regularly based on user feedback
2. Break down large tasks into smaller, manageable items
3. Add estimated time/complexity to tasks
4. Link to relevant issues or pull requests
5. Use the priority legend to mark importance
6. Review and update this list weekly 

- [ ] Update all queries that fetch clergy to exclude soft-deleted records (is_deleted=False or deleted_at is None)
- [ ] Create a testing script for the migration to verify on the remote testing server before pushing to production 
- [ ] Integrate Flask-Migrate into development workflow:
    - [ ] Add 'flask db upgrade' to start_dev.sh after database sync and before starting the server
    - [ ] Optionally add automated tests after migration
    - [ ] Continue to generate migration scripts manually with 'flask db migrate' when models change 