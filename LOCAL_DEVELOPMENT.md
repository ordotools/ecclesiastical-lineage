# Local Development Setup

This guide will help you set up the Ecclesiastical Lineage application for local development.

## Prerequisites

1. **Python 3.8+** - Make sure you have Python installed
2. **PostgreSQL** - Install PostgreSQL locally
3. **Git** - For version control

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd ecclesiastical-lineage

# Create virtual environment
python3 -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Database Setup

#### Option A: Use the development script (Recommended)
```bash
# This will sync your local database with the remote database
./start_dev.sh
```

#### Option B: Manual setup
```bash
# Start PostgreSQL (if not already running)
brew services start postgresql@16  # macOS
# or
sudo systemctl start postgresql    # Linux

# Create local database
createdb ecclesiastical_lineage_dev

# Create .env file
cp env.example .env
# Edit .env with your database URL:
# DATABASE_URL=postgresql://localhost:5432/ecclesiastical_lineage_dev
```

### 3. Run the Application

#### Option A: Using the simple runner
```bash
python run_local.py
```

#### Option B: Direct execution
```bash
python app.py
```

#### Option C: Using Flask CLI
```bash
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
```

## Access the Application

- **URL**: http://127.0.0.1:5000
- **Default Admin Login** (if using start_dev.sh):
  - Username: `admin`
  - Password: `admin123`

## Environment Variables

Create a `.env` file in the project root with:

```env
# Flask configuration
SECRET_KEY=your-secret-key-here

# Database configuration
DATABASE_URL=postgresql://localhost:5432/ecclesiastical_lineage_dev

# Optional: Remote database for syncing
RENDER_PG_URL=postgresql://user:pass@host:port/dbname
```

## Troubleshooting

### Database Connection Issues

1. **SSL Error**: The app automatically detects local development and disables SSL
2. **Connection Refused**: Make sure PostgreSQL is running
3. **Database Not Found**: Create the database with `createdb ecclesiastical_lineage_dev`

### Port Already in Use

If port 5000 is busy, you can specify a different port:
```bash
python app.py --port 5001
```

### Virtual Environment Issues

If you get import errors, make sure your virtual environment is activated:
```bash
source env/bin/activate  # macOS/Linux
# or
env\Scripts\activate     # Windows
```

## Development Workflow

1. **Start PostgreSQL**: `brew services start postgresql@16`
2. **Activate environment**: `source env/bin/activate`
3. **Run the app**: `python run_local.py`
4. **Access**: http://127.0.0.1:5000

## Sync with Production Data

To sync your local database with production data:
```bash
./start_dev.sh
```

This will:
- Export data from the remote database
- Import it into your local database
- Update your `.env` file for local development
- Start the development server

## File Structure

- `app.py` - Main Flask application
- `run_local.py` - Simple development runner
- `start_dev.sh` - Complete development setup script
- `.env` - Environment variables (create from env.example)
- `requirements.txt` - Python dependencies 