#!/usr/bin/env python3
"""
Image Migration Script

This script migrates existing base64-encoded images in the database to Backblaze B2 Cloud Storage.
It processes both image_url and image_data fields and uploads them to Backblaze B2.
"""

import os
import sys
import json
import base64
from dotenv import load_dotenv
from flask import Flask
from models import db, Clergy
from services.backblaze_config import init_backblaze_config
from services.image_upload import get_image_upload_service

def create_app():
    """Create Flask app for migration"""
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'migration-key')
    
    # Database configuration
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is required")
    
    # Fix SSL connection issues for Render PostgreSQL
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    return app

def migrate_images():
    """Migrate all base64 images to Backblaze B2"""
    app = create_app()
    
    with app.app_context():
        # Initialize Backblaze B2
        print("🔧 Initializing Backblaze B2...")
        if not init_backblaze_config():
            print("❌ Failed to initialize Backblaze B2. Please check your configuration.")
            return False
        
        # Get image upload service
        image_upload_service = get_image_upload_service()
        
        # Find all clergy with base64 images
        clergy_with_images = Clergy.query.filter(
            db.or_(
                Clergy.image_url.like('data:%'),
                Clergy.image_data.isnot(None)
            )
        ).all()
        
        print(f"📊 Found {len(clergy_with_images)} clergy records with images to migrate")
        
        if not clergy_with_images:
            print("✅ No images to migrate!")
            return True
        
        migrated_count = 0
        failed_count = 0
        
        for clergy in clergy_with_images:
            print(f"\n🔄 Processing clergy {clergy.id}: {clergy.name}")
            
            try:
                # Process image_data (comprehensive images)
                if clergy.image_data:
                    try:
                        image_data = json.loads(clergy.image_data)
                        
                        # Check if it's already migrated (contains URLs instead of base64)
                        if any(isinstance(v, str) and v.startswith('http') for v in image_data.values() if isinstance(v, str)):
                            print(f"  ⏭️  Already migrated (contains URLs)")
                            continue
                        
                        # Upload comprehensive images
                        print(f"  📤 Uploading comprehensive images...")
                        image_urls = image_upload_service.process_and_upload_comprehensive_image(
                            clergy.image_data, clergy.id
                        )
                        
                        if image_urls:
                            # Update database with URLs
                            clergy.image_url = image_urls.get('lineage', '')
                            clergy.image_data = json.dumps(image_urls)
                            db.session.commit()
                            
                            print(f"  ✅ Migrated comprehensive images")
                            migrated_count += 1
                        else:
                            print(f"  ❌ Failed to upload comprehensive images")
                            failed_count += 1
                            
                    except json.JSONDecodeError:
                        print(f"  ⚠️  Invalid JSON in image_data, skipping")
                        continue
                
                # Process image_url (single image)
                elif clergy.image_url and clergy.image_url.startswith('data:'):
                    print(f"  📤 Uploading single image...")
                    image_url = image_upload_service.upload_image_from_base64(
                        clergy.image_url, clergy.id, 'original'
                    )
                    
                    if image_url:
                        # Update database with URL
                        clergy.image_url = image_url
                        db.session.commit()
                        
                        print(f"  ✅ Migrated single image: {image_url}")
                        migrated_count += 1
                    else:
                        print(f"  ❌ Failed to upload single image")
                        failed_count += 1
                
                else:
                    print(f"  ⏭️  No base64 images to migrate")
                    
            except Exception as e:
                print(f"  ❌ Error processing clergy {clergy.id}: {e}")
                failed_count += 1
                db.session.rollback()
        
        print(f"\n📊 Migration Summary:")
        print(f"  ✅ Successfully migrated: {migrated_count}")
        print(f"  ❌ Failed: {failed_count}")
        print(f"  📊 Total processed: {len(clergy_with_images)}")
        
        return failed_count == 0

def main():
    print("🚀 Image Migration to Backblaze B2")
    print("=" * 40)
    
    # Load environment variables
    load_dotenv()
    
    # Check if Backblaze B2 is configured
    required_vars = [
        'BACKBLAZE_BUCKET_NAME',
        'BACKBLAZE_ENDPOINT_URL',
        'BACKBLAZE_ACCESS_KEY_ID',
        'BACKBLAZE_SECRET_ACCESS_KEY'
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("Please run setup_backblaze.py first to configure Backblaze B2")
        return False
    
    # Confirm migration
    print("\n⚠️  This will migrate all base64-encoded images to Backblaze B2 Cloud Storage.")
    print("Make sure you have:")
    print("1. A backup of your database")
    print("2. Backblaze B2 properly configured")
    print("3. Sufficient storage space in your Backblaze B2 bucket")
    
    confirm = input("\nDo you want to proceed? (y/N): ").lower().strip()
    if confirm != 'y':
        print("Migration cancelled.")
        return False
    
    # Run migration
    success = migrate_images()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        print("\nNext steps:")
        print("1. Test your application to ensure images load correctly")
        print("2. Monitor your Backblaze B2 usage and costs")
        print("3. Consider setting up lifecycle rules for old images")
    else:
        print("\n❌ Migration completed with errors.")
        print("Please check the logs above and retry if necessary.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
