#!/usr/bin/env python3
"""
Test script for the audit trail system
"""

import os
import sys
from datetime import datetime

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, AuditLog, User, Clergy, log_audit_event

def test_audit_system():
    """Test the audit trail system"""
    print("🧪 Testing Audit Trail System")
    print("=" * 50)
    
    with app.app_context():
        # Test 1: Check if AuditLog table exists
        print("1. Checking AuditLog table...")
        try:
            audit_count = AuditLog.query.count()
            print(f"   ✅ AuditLog table exists with {audit_count} entries")
        except Exception as e:
            print(f"   ❌ Error accessing AuditLog table: {e}")
            return False
        
        # Test 2: Test audit event logging
        print("2. Testing audit event logging...")
        try:
            # Get a test user
            test_user = User.query.first()
            if not test_user:
                print("   ⚠️  No users found, creating test user...")
                from werkzeug.security import generate_password_hash
                test_user = User(
                    username="test_audit_user",
                    password_hash=generate_password_hash("test123"),
                    role_id=1  # Assuming role 1 exists
                )
                db.session.add(test_user)
                db.session.commit()
            
            # Log a test audit event
            log_audit_event(
                action='test',
                entity_type='test',
                entity_id=999,
                entity_name='Test Entity',
                details={'test': True, 'timestamp': datetime.utcnow().isoformat()},
                user_id=test_user.id
            )
            
            # Check if the event was logged
            test_log = AuditLog.query.filter_by(action='test', entity_type='test').first()
            if test_log:
                print(f"   ✅ Test audit event logged successfully (ID: {test_log.id})")
            else:
                print("   ❌ Test audit event not found")
                return False
                
        except Exception as e:
            print(f"   ❌ Error testing audit logging: {e}")
            return False
        
        # Test 3: Check audit log details
        print("3. Checking audit log details...")
        try:
            recent_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(5).all()
            print(f"   📋 Recent audit logs ({len(recent_logs)} entries):")
            for log in recent_logs:
                print(f"      - {log.created_at.strftime('%Y-%m-%d %H:%M:%S')} | "
                      f"{log.user.username if log.user else 'Unknown'} | "
                      f"{log.action} | {log.entity_type} | {log.entity_name}")
        except Exception as e:
            print(f"   ❌ Error checking audit logs: {e}")
            return False
        
        # Test 4: Test different action types
        print("4. Testing different action types...")
        try:
            actions = ['create', 'update', 'delete', 'login', 'logout', 'comment', 'resolve']
            for action in actions:
                log_audit_event(
                    action=action,
                    entity_type='test',
                    entity_id=999,
                    entity_name=f'Test {action}',
                    details={'action_type': action},
                    user_id=test_user.id
                )
            print(f"   ✅ Logged {len(actions)} different action types")
        except Exception as e:
            print(f"   ❌ Error testing action types: {e}")
            return False
        
        print("\n🎉 All audit system tests passed!")
        return True

if __name__ == '__main__':
    success = test_audit_system()
    sys.exit(0 if success else 1) 