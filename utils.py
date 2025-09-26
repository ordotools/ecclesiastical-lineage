from functools import wraps
import re
import json
from flask import request, redirect, url_for, flash, session, jsonify
from models import db, AuditLog, User


def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                flash('Please log in to access this feature.', 'error')
                return redirect(url_for('auth.login'))
            user = User.query.get(session['user_id'])
            if not user or not user.is_active:
                session.clear()
                flash('User not found or inactive. Please log in again.', 'error')
                return redirect(url_for('auth.login'))
            if not user.has_permission(permission):
                flash('You do not have permission to access this feature.', 'error')
                return redirect(url_for('auth.dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_permission_api(permission):
    """API version of require_permission that returns JSON errors instead of redirects"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'success': False, 'error': 'Authentication required'}), 401
            user = User.query.get(session['user_id'])
            if not user or not user.is_active:
                session.clear()
                return jsonify({'success': False, 'error': 'User not found or inactive'}), 401
            if not user.has_permission(permission):
                return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def audit_log(action, entity_type, get_entity_id=None, get_entity_name=None, get_details=None):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            result = f(*args, **kwargs)
            clergy = result[0] if isinstance(result, tuple) else None
            try:
                if clergy is not None:
                    entity_id = get_entity_id(clergy) if get_entity_id else None
                    entity_name = get_entity_name(clergy) if get_entity_name else None
                    details = get_details(clergy) if get_details else None
                    log_audit_event(
                        action=action,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        entity_name=entity_name,
                        details=details
                    )
            except Exception as e:
                print(f"Audit log decorator error: {e}")
            if isinstance(result, tuple):
                if len(result) == 3:
                    return result[1], result[2]
                return result[1]
            return result
        return wrapped
    return decorator

def getContrastColor(hexColor):
    if not hexColor or not hexColor.startswith('#'):
        return 'black'
    hex = hexColor.replace('#', '')
    if len(hex) != 6:
        return 'black'
    try:
        r = int(hex[0:2], 16)
        g = int(hex[2:4], 16)
        b = int(hex[4:6], 16)
        luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return 'white' if luminance <= 0.5 else 'black'
    except (ValueError, IndexError):
        return 'black'

def getBorderStyle(hexColor):
    if not hexColor or not hexColor.startswith('#'):
        return ''
    hex = hexColor.replace('#', '')
    if len(hex) != 6:
        return ''
    try:
        r = int(hex[0:2], 16)
        g = int(hex[2:4], 16)
        b = int(hex[4:6], 16)
        luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        if luminance > 0.8:
            return '; border: 1px solid #ccc'
        return ''
    except (ValueError, IndexError):
        return ''

def from_json(value):
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return value


def log_audit_event(action, entity_type, entity_id=None, entity_name=None, details=None, user_id=None):
    try:
        if user_id is None and 'user_id' in session:
            user_id = session['user_id']
        ip_address = request.remote_addr if request else None
        user_agent = request.headers.get('User-Agent') if request else None
        if isinstance(details, dict):
            details = json.dumps(details)
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(audit_log)
        db.session.commit()
    except Exception as e:
        print(f"Warning: Failed to log audit event: {e}")
        db.session.rollback()

def validate_password(password):
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)"
    return True, "Password meets all requirements"