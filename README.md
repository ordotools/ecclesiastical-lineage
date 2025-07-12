# Ecclesiastical Lineage - Flask Application

A Flask web application with admin user management. The first user to sign up becomes the admin, and subsequent users can only log in.

## Features

- **First User Admin**: The first user to sign up automatically becomes an admin
- **Secure Authentication**: Password hashing and session management
- **Modern UI**: Beautiful, responsive interface with Bootstrap 5
- **HTMX Integration**: Dynamic interactions without full page reloads
- **SQLite Database**: Simple file-based database for user storage

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application**:
   ```bash
   python app.py
   ```

3. **Access the Application**:
   - Open your browser and go to `http://localhost:5000`
   - If no users exist, you'll be redirected to the signup page
   - Create your admin account with username and password
   - After signup, you'll be redirected to login
   - Log in to access the dashboard

## Application Flow

1. **First Visit**: If no users exist in the database, you'll see the signup page
2. **Admin Creation**: The first user becomes an admin automatically
3. **Subsequent Visits**: After the first user is created, only login is available
4. **Dashboard**: Logged-in users see a personalized dashboard with their name

## File Structure

```
ecclesiastical-lineage/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── templates/            # HTML templates
│   ├── base.html         # Base template with styling
│   ├── signup.html       # Admin signup page
│   ├── login.html        # Login page
│   └── dashboard.html    # User dashboard
└── ecclesiastical_lineage.db  # SQLite database (created automatically)
```

## Security Features

- Password hashing using Werkzeug
- Session-based authentication
- CSRF protection (built into Flask)
- Secure password confirmation during signup

## HTMX Features

- **Dynamic Form Submission**: Forms submit without page reloads
- **Loading Indicators**: Visual feedback during requests
- **Flash Message Handling**: Automatic display and dismissal of messages
- **Smart Redirects**: Seamless navigation after form submissions
- **Error Handling**: Graceful error display and recovery

## Customization

- Modify `app.py` to add new routes and functionality
- Update templates in the `templates/` directory
- Add new database models in the `User` class or create new models
- Customize styling in the template files
