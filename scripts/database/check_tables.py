"""Dev diagnostic: print whether wiki_page table exists. Run from repo root: python scripts/database/check_tables.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app import app, db
from sqlalchemy import inspect

with app.app_context():
    inspector = inspect(db.engine)
    tables = inspector.get_tables() if hasattr(inspector, 'get_tables') else inspector.get_table_names()
    print(f"Tables found: {tables}")
    if 'wiki_page' in tables:
        print("✅ 'wiki_page' table exists.")
        cols = [c['name'] for c in inspector.get_columns('wiki_page')]
        print(f"Columns: {cols}")
    else:
        print("❌ 'wiki_page' table DOES NOT exist.")
