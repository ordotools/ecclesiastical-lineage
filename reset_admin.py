from app import app, db
from models import User

with app.app_context():
    user = User.query.filter_by(username='admin').first()
    if user:
        user.set_password('admin123')
        db.session.commit()
        print("Password reset for 'admin' to 'admin123'")
    else:
        # Create if missing (fallback)
        print("User 'admin' not found, creating...")
        from models import Role
        role = Role.query.filter_by(name='Super Admin').first()
        if role:
            user = User(username='admin', role=role)
            user.set_password('admin123')
            db.session.add(user)
            db.session.commit()
            print("User 'admin' created with password 'admin123'")
        else:
             print("Super Admin role not found.")
