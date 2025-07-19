# Ecclesiastical Lineage

A Flask web application for tracking and visualizing ecclesiastical lineages and ordination relationships.

## Features

- User authentication and authorization
- Clergy record management
- Lineage visualization with D3.js
- Metadata management for ranks and organizations
- Admin user management with invite system

## Local Development

### Prerequisites

1. **PostgreSQL**: Install and start PostgreSQL locally
   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   ```

2. **Python**: Ensure you have Python 3.8+ installed

### Setup

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
4. Set up environment variables:
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```
5. Start the development server:
   ```bash
   ./start_dev.sh
   ```
7. Visit `http://localhost:5001`

### Database Management

- **Complete development setup**: `./start_dev.sh` - Syncs remote database, sets up environment, and starts server
- **Sync database only**: `./sync_dev_db.sh` - Syncs remote database to local without starting server

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
- `DATABASE_URL`: Uses PostgreSQL by default

### Manual Deploy

If you prefer to use the `render.yaml` file:

1. Push your code to GitHub
2. In Render Dashboard, click "New +" and select "Blueprint"
3. Connect your repository
4. Render will automatically detect and use the `render.yaml` configuration

## Database

The application uses PostgreSQL for all environments, which provides:

- Better performance and concurrent access
- ACID compliance for data integrity
- Advanced features like JSON support and full-text search
- Production-ready scalability

### Setting Up Persistent Database on Render

This application is configured to use a persistent PostgreSQL database on Render.com:

1. **Automatic Setup**: The `render.yaml` file is configured to automatically create a PostgreSQL database service
2. **Database Initialization**: The `init_postgres_db.py` script will automatically create all necessary tables


**Manual Setup (if not using render.yaml):**
1. In Render Dashboard, create a new PostgreSQL database service
2. Copy the database connection string
3. Add it as an environment variable: `DATABASE_URL`
4. Deploy your application

**Database Migration:**
- The application automatically handles database schema creation
- No manual migration steps required
- Data persists between deployments

### Local Development Database

For local development, the application uses a local PostgreSQL database:

- **Database Name**: `ecclesiastical_lineage_dev`
- **Connection**: `postgresql://localhost:5432/ecclesiastical_lineage_dev`
- **Sync from Remote**: Use `./sync_dev_db.sh` to copy production data locally


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
