# Editor-Only Access Implementation Plan

## Overview
This document outlines the plan to ensure that when users are logged in, they can only access the editor view. All management functionality (settings, user management, metadata, etc.) will be integrated into the editor interface.

## Current State Analysis

### Authentication Flow
- **Login**: Users are redirected to `/dashboard` after successful login
- **Dashboard**: Shows various management options including editor, clergy management, settings, etc.
- **Editor**: Comprehensive 4-panel interface at `/editor` with clergy list, visualization, forms, and audit tools
- **Public Routes**: Lineage visualization accessible to non-logged-in users
- **Admin Routes**: Settings, user management, metadata management, comments management, audit logs

### Current Routes Structure
- `/` - Redirects to dashboard if logged in, login if not
- `/dashboard` - Main dashboard with management options
- `/editor` - 4-panel editor interface
- `/lineage_visualization` - Public lineage view
- `/settings` - User settings and admin functions
- `/user_management` - User account management
- `/metadata` - Metadata management
- `/comments_management` - Comments management
- `/audit_logs` - Audit logs viewing

## Implementation Plan

### Phase 1: Authentication Flow Changes

#### 1.1 Modify Login Redirect ✅ COMPLETED
- **File**: `services/auth.py`
- **Change**: Update login handler to redirect to editor instead of dashboard
- **Current**: `return user, redirect(url_for('auth.dashboard'))`
- **New**: `return user, redirect(url_for('editor.editor'))`
- **Status**: ✅ Implemented - Login now redirects to editor interface

#### 1.2 Update Dashboard Route ✅ COMPLETED
- **File**: `routes/auth.py`
- **Change**: Make dashboard route redirect to editor for logged-in users
- **Action**: Add redirect logic to dashboard function
- **Status**: ✅ Implemented - Dashboard and index routes now redirect to editor

#### 1.3 Restrict Lineage Visualization ✅ COMPLETED
- **File**: `routes/main.py`
- **Change**: Make lineage visualization only accessible to non-logged-in users
- **Action**: Add authentication check to redirect logged-in users to editor
- **Status**: ✅ Implemented - Logged-in users are redirected from lineage visualization to editor

#### 1.4 Update Logout Flow ✅ COMPLETED
- **File**: `services/auth.py`
- **Change**: Ensure logout redirects to public lineage visualization
- **Current**: `return user, redirect(url_for('clergy.lineage_visualization'))`
- **Verify**: This should redirect to public lineage view
- **Status**: ✅ Implemented - Logout now redirects to public lineage visualization

#### 1.5 Add Logout Button to Editor ✅ COMPLETED
- **File**: `templates/editor.html`
- **Change**: Add logout button to editor interface
- **Action**: Add floating logout button with username display
- **Status**: ✅ Implemented - Editor now has logout functionality with user info

### Phase 2: Integrate Management Features into Editor

#### 2.1 Settings Integration
- **Current Location**: `routes/settings.py` - `/settings` route
- **Integration**: Add settings panel to editor interface
- **Implementation**: 
  - Create settings panel in editor template
  - Move settings functionality to editor routes
  - Add HTMX endpoints for settings management

#### 2.2 User Management Integration
- **Current Location**: `routes/settings.py` - `/user_management` route
- **Integration**: Add user management panel to editor interface
- **Implementation**:
  - Create user management panel in editor template
  - Move user management functionality to editor routes
  - Add HTMX endpoints for user management

#### 2.3 Metadata Management Integration
- **Current Location**: `routes/settings.py` - `/metadata` route
- **Integration**: Add metadata management panel to editor interface
- **Implementation**:
  - Create metadata management panel in editor template
  - Move metadata functionality to editor routes
  - Add HTMX endpoints for metadata management

#### 2.4 Comments Management Integration
- **Current Location**: `routes/settings.py` - `/comments_management` route
- **Integration**: Add comments management panel to editor interface
- **Implementation**:
  - Create comments management panel in editor template
  - Move comments functionality to editor routes
  - Add HTMX endpoints for comments management

#### 2.5 Audit Logs Integration
- **Current Location**: `routes/settings.py` - `/audit_logs` route
- **Integration**: Add audit logs panel to editor interface
- **Implementation**:
  - Create audit logs panel in editor template
  - Move audit logs functionality to editor routes
  - Add HTMX endpoints for audit logs

### Phase 3: Editor Interface Enhancements

#### 3.1 Settings Panel
- **Location**: `templates/editor.html`
- **Features**:
  - User profile information
  - Password change functionality
  - Account preferences
  - Role and permission display

#### 3.2 Admin Panel
- **Location**: `templates/editor.html`
- **Features**:
  - User management (add, edit, delete users)
  - Metadata management (ranks, organizations)
  - Comments management
  - Audit logs viewing
  - System administration tools

#### 3.3 Panel Navigation
- **Implementation**: Add tabbed or collapsible navigation within editor
- **Panels**:
  - Clergy List (existing)
  - Lineage Visualization (existing)
  - Clergy Form (existing)
  - Metadata & Statistics (existing)
  - Settings (new)
  - Admin Panel (new)

### Phase 4: Route Access Control

#### 4.1 Restrict Standalone Routes
- **Routes to Restrict**:
  - `/settings` - Redirect to editor
  - `/user_management` - Redirect to editor
  - `/metadata` - Redirect to editor
  - `/comments_management` - Redirect to editor
  - `/audit_logs` - Redirect to editor
  - `/clergy` - Redirect to editor
  - Any other management routes

#### 4.2 Update Navigation Links
- **Files**: All templates with navigation
- **Action**: Update all links to point to editor interface
- **Examples**:
  - Dashboard links → Editor links
  - Settings links → Editor settings panel
  - Management links → Editor admin panel

### Phase 5: Testing and Validation

#### 5.1 Access Control Testing
- **Test Cases**:
  - Logged-in user tries to access `/lineage_visualization` → Should redirect to editor
  - Logged-in user tries to access `/settings` → Should redirect to editor
  - Logged-in user tries to access `/user_management` → Should redirect to editor
  - Non-logged-in user accesses `/lineage_visualization` → Should work normally
  - Non-logged-in user tries to access `/editor` → Should redirect to login

#### 5.2 Functionality Testing
- **Test Cases**:
  - All settings functionality works within editor
  - All user management functionality works within editor
  - All metadata management functionality works within editor
  - All comments management functionality works within editor
  - All audit logs functionality works within editor

## Implementation Order

### Priority 1 (Immediate)
1. Modify login redirect to editor
2. Update dashboard to redirect to editor
3. Restrict lineage visualization to non-logged-in users
4. Test basic access control

### Priority 2 (Core Integration)
1. Integrate settings into editor
2. Integrate user management into editor
3. Update navigation links
4. Test integrated functionality

### Priority 3 (Complete Integration)
1. Integrate metadata management into editor
2. Integrate comments management into editor
3. Integrate audit logs into editor
4. Restrict all standalone management routes

### Priority 4 (Polish)
1. Enhance editor UI for new panels
2. Add proper navigation between panels
3. Comprehensive testing
4. Documentation updates

## Files to Modify

### Core Authentication
- `services/auth.py` - Login/logout redirects
- `routes/auth.py` - Dashboard redirect
- `routes/main.py` - Lineage visualization access control

### Editor Integration
- `routes/editor.py` - Add new panel routes
- `templates/editor.html` - Add new panels
- `static/js/editor-*.js` - Add panel functionality

### Route Restrictions
- `routes/settings.py` - Add redirects to editor
- `routes/metadata.py` - Add redirects to editor
- `routes/clergy.py` - Add redirects to editor

### Templates
- All templates with navigation links
- Editor template for new panels

## Success Criteria

1. **Logged-in users can only access the editor interface**
2. **All management functionality is available within the editor**
3. **Non-logged-in users can only access public lineage visualization**
4. **No standalone management routes are accessible to logged-in users**
5. **All existing functionality is preserved and accessible through editor**

## Notes

- The editor already has a sophisticated 4-panel layout that can accommodate additional panels
- HTMX is used throughout the application, making it easy to add new panels
- The existing permission system can be leveraged for panel access control
- This approach maintains all existing functionality while centralizing the interface
