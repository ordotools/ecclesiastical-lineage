# Audit Trail System

## Overview

The Ecclesiastical Lineage application now includes a comprehensive audit trail system that tracks all changes, actions, and activities within the system. This provides complete transparency and accountability for all user actions.

## Features

### What Gets Tracked

The audit system logs the following activities:

#### User Actions
- **Login/Logout**: Every user login and logout event
- **Password Changes**: When users change their passwords
- **User Management**: Creation, updates, and deletion of user accounts
- **Admin Invites**: Generation and usage of admin invitation tokens

#### Clergy Records
- **Creation**: When new clergy records are added
- **Updates**: Any modifications to existing clergy records
- **Deletion**: When clergy records are removed from the system

#### Comments System
- **Comment Creation**: When comments are added to clergy records
- **Comment Resolution**: When comments are marked as resolved

#### Metadata Management
- **Ranks**: Creation, updates, and deletion of clergy ranks
- **Organizations**: Creation, updates, and deletion of organizations

### Audit Log Details

Each audit log entry includes:

- **Timestamp**: Exact date and time of the action
- **User**: Who performed the action
- **Action Type**: What type of action was performed
- **Entity Type**: What type of record was affected
- **Entity Name**: Name or description of the affected record
- **Entity ID**: Database ID of the affected record
- **Details**: JSON-formatted additional information about the action
- **IP Address**: IP address of the user who performed the action
- **User Agent**: Browser/device information

## Database Schema

### AuditLog Model

```python
class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=True)
    entity_name = db.Column(db.String(200), nullable=True)
    details = db.Column(db.Text, nullable=True)  # JSON string
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to user
    user = db.relationship('User', backref='audit_logs')
```

## Access Control

### Permissions

- **view_audit_logs**: Required permission to view audit logs
- Only Super Admins and users with this permission can access audit logs
- Regular users cannot view audit logs

### User Interface

- Audit logs are accessible from the dashboard for authorized users
- Comprehensive filtering and search capabilities
- Pagination for large datasets
- Detailed view of each audit entry

## Usage

### Viewing Audit Logs

1. **Access**: Navigate to Dashboard → Audit Logs (for authorized users)
2. **Filter**: Use the filter panel to narrow down results by:
   - Action type (create, update, delete, login, etc.)
   - Entity type (clergy, user, rank, organization, etc.)
   - User who performed the action
   - Date range
3. **View Details**: Click "View Details" to see the full JSON details of any action
4. **Navigate**: Use pagination to browse through large datasets

### Filtering Options

- **Action**: Filter by specific action types
- **Entity Type**: Filter by the type of record affected
- **User**: Filter by the user who performed the action
- **Date Range**: Filter by date range (from/to)

### Audit Log Interface

The audit logs page provides:

- **Table View**: Clean, sortable table of all audit entries
- **Color-coded Actions**: Different colors for different action types
- **Expandable Details**: Click to view full JSON details
- **Pagination**: Navigate through large datasets
- **Summary**: Shows total count and current page information

## Technical Implementation

### Logging Function

```python
def log_audit_event(action, entity_type, entity_id=None, entity_name=None, 
                   details=None, user_id=None):
    """Helper function to log audit events"""
    # Automatically captures user_id from session if not provided
    # Captures IP address and user agent from request
    # Converts details dict to JSON string
    # Handles errors gracefully without breaking main functionality
```

### Integration Points

The audit system is integrated into all major operations:

- **Clergy Operations**: add_clergy, edit_clergy, delete_clergy
- **User Operations**: login, logout, user management, password changes
- **Comment Operations**: add_comment, resolve_comment
- **Metadata Operations**: rank and organization management
- **Admin Operations**: invite generation and usage

### Error Handling

- Audit logging failures do not break main application functionality
- Errors are logged to console but don't affect user experience
- Graceful degradation if audit system is unavailable

## Security Considerations

### Data Protection

- Audit logs contain sensitive information and are protected by permissions
- Only authorized users can view audit logs
- IP addresses and user agents are logged for security purposes

### Privacy

- Audit logs are retained indefinitely for compliance and security
- Users cannot delete or modify audit logs
- All actions are permanently recorded

### Performance

- Audit logging is asynchronous and doesn't block main operations
- Database indexes optimize query performance
- Pagination prevents large result sets from impacting performance

## Testing

### Test Script

Run the test script to verify the audit system:

```bash
python test_audit_system.py
```

This script tests:
- Database table creation
- Audit event logging
- Different action types
- Data retrieval and display

### Manual Testing

1. **Create a clergy record** and check audit logs
2. **Edit a clergy record** and verify the update is logged
3. **Delete a clergy record** and confirm deletion is tracked
4. **Add a comment** and verify comment creation is logged
5. **Login/logout** and check authentication events
6. **Change password** and verify password change is tracked

## Monitoring and Maintenance

### Regular Tasks

- **Review Audit Logs**: Regularly review audit logs for suspicious activity
- **Database Maintenance**: Monitor audit log table size and performance
- **Permission Review**: Ensure only authorized users have audit log access

### Troubleshooting

- **Missing Logs**: Check if audit logging is enabled and working
- **Performance Issues**: Consider archiving old audit logs if table becomes too large
- **Permission Issues**: Verify user has 'view_audit_logs' permission

## Future Enhancements

Potential improvements to the audit system:

- **Export Functionality**: Export audit logs to CSV/PDF
- **Real-time Notifications**: Alert admins to suspicious activities
- **Advanced Analytics**: Dashboard with audit statistics and trends
- **Data Retention Policies**: Automatic archiving of old audit logs
- **Integration**: Connect with external logging systems

## Compliance

The audit trail system helps meet various compliance requirements:

- **Data Integrity**: Complete record of all changes
- **Accountability**: Track who made what changes and when
- **Security**: Monitor for unauthorized access or suspicious activity
- **Audit Requirements**: Provide evidence for external audits

---

*This audit trail system provides complete transparency and accountability for all activities within the Ecclesiastical Lineage application, ensuring data integrity and security.* 