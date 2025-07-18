# Ecclesiastical Lineage

A Flask web application for tracking and visualizing ecclesiastical lineages and ordination relationships.

## Features

- User authentication and authorization
- Clergy record management
- Lineage visualization with D3.js
- Metadata management for ranks and organizations
- Admin user management with invite system

## Local Development

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv env
   source env/bin/activate  # On Windows: env\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables (copy from `env.example`):
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```
5. Run the application:
   ```bash
   python app.py
   ```
6. Visit `http://localhost:5000`

## Deployment on Render

### Quick Deploy (Recommended)

1. Fork or push this repository to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New +" and select "Web Service"
4. Connect your GitHub repository
5. Configure the service:
   - **Name**: `ecclesiastical-lineage` (or your preferred name)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Plan**: Free (for testing)

### Environment Variables

The following environment variables will be automatically set by Render:
- `SECRET_KEY`: Automatically generated
- `DATABASE_URL`: Uses SQLite by default

### Manual Deploy

If you prefer to use the `render.yaml` file:

1. Push your code to GitHub
2. In Render Dashboard, click "New +" and select "Blueprint"
3. Connect your repository
4. Render will automatically detect and use the `render.yaml` configuration

## Database

The application uses SQLite by default, which is suitable for testing and small deployments. For production use, consider:

1. **PostgreSQL on Render**: Add a PostgreSQL service in Render and update the `DATABASE_URL`
2. **External Database**: Use a managed database service and update the connection string

### Setting Up Persistent Database on Render

This application is configured to use a persistent PostgreSQL database on Render.com:

1. **Automatic Setup**: The `render.yaml` file is configured to automatically create a PostgreSQL database service
2. **Database Initialization**: The `init_db.py` script will automatically create all necessary tables
3. **Sample Data**: Set `ADD_SAMPLE_DATA=true` in environment variables to include sample data

**Manual Setup (if not using render.yaml):**
1. In Render Dashboard, create a new PostgreSQL database service
2. Copy the database connection string
3. Add it as an environment variable: `DATABASE_URL`
4. Deploy your application

**Database Migration:**
- The application automatically handles database schema creation
- No manual migration steps required
- Data persists between deployments

## Testing with Real Users

1. Deploy to Render using the instructions above
2. Share the Render URL with your test users
3. Monitor the application logs in the Render dashboard
4. Use the admin features to manage users and data

## Security Notes

- Change the default secret key in production
- Consider using HTTPS (handled automatically by Render)
- Review and update security settings as needed for your use case

## Support

For issues or questions, please check the application logs in the Render dashboard or create an issue in the repository.
