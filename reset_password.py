import sys
print("Script starting...")
try:
    from app import app
    from models import db, User
    print("Imports successful")

    def reset_admin_password():
        print("Entering app context...")
        with app.app_context():
            # Check if admin user exists
            print("Querying for admin user...")
            admin = User.query.filter_by(username='admin').first()
            if admin:
                print(f"Found user 'admin' (ID: {admin.id})")
                admin.set_password('admin123')
                db.session.commit()
                print("Successfully reset password for 'admin' to 'admin123'")
            else:
                print("User 'admin' not found!")
                users = User.query.all()
                print(f"Existing users: {[u.username for u in users]}")

    if __name__ == '__main__':
        reset_admin_password()
except Exception as e:
    print(f"An error occurred: {e}")
    import traceback
    traceback.print_exc()
