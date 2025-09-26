#!/usr/bin/env python3
"""
Backblaze B2 Setup Script

This script helps you set up Backblaze B2 Cloud Storage for your application.
It will guide you through the process of creating a bucket and application key.
"""

import os
import sys
from dotenv import load_dotenv

def main():
    print("🚀 Backblaze B2 Setup for Ecclesiastical Lineage")
    print("=" * 50)
    
    # Load existing environment variables
    load_dotenv()
    
    print("\n📋 Prerequisites:")
    print("1. You need a Backblaze B2 Cloud Storage account")
    print("2. You need to create a bucket")
    print("3. You need to create an application key")
    print("\nLet's get started!")
    
    # Check if already configured
    if all([
        os.getenv('BACKBLAZE_BUCKET_NAME'),
        os.getenv('BACKBLAZE_ENDPOINT_URL'),
        os.getenv('BACKBLAZE_ACCESS_KEY_ID'),
        os.getenv('BACKBLAZE_SECRET_ACCESS_KEY')
    ]):
        print("\n✅ Backblaze B2 is already configured!")
        print("Current configuration:")
        print(f"  Bucket: {os.getenv('BACKBLAZE_BUCKET_NAME')}")
        print(f"  Endpoint: {os.getenv('BACKBLAZE_ENDPOINT_URL')}")
        print(f"  Access Key: {os.getenv('BACKBLAZE_ACCESS_KEY_ID')[:8]}...")
        
        reconfigure = input("\nDo you want to reconfigure? (y/N): ").lower().strip()
        if reconfigure != 'y':
            print("Configuration unchanged.")
            return
    
    print("\n🔧 Step 1: Create a Backblaze B2 Bucket")
    print("1. Go to https://secure.backblaze.com/user_signin.htm")
    print("2. Sign in to your Backblaze account")
    print("3. Navigate to 'B2 Cloud Storage' in the left menu")
    print("4. Click 'Create a Bucket'")
    print("5. Choose a bucket name (must be globally unique)")
    print("6. Select 'Public' for the privacy setting")
    print("7. Click 'Create a Bucket'")
    print("8. Copy the 'Endpoint' URL (it looks like: https://s3.us-west-004.backblazeb2.com)")
    
    bucket_name = input("\nEnter your bucket name: ").strip()
    endpoint_url = input("Enter your endpoint URL: ").strip()
    
    if not bucket_name or not endpoint_url:
        print("❌ Bucket name and endpoint URL are required!")
        return
    
    print("\n🔑 Step 2: Create an Application Key")
    print("1. In the Backblaze B2 console, go to 'Application Keys'")
    print("2. Click 'Add a New Application Key'")
    print("3. Enter a name for your key (e.g., 'ecclesiastical-lineage')")
    print("4. Select 'All' for bucket access")
    print("5. Select 'Read and Write' for access type")
    print("6. Click 'Create New Key'")
    print("7. IMPORTANT: Copy both the 'keyID' and 'applicationKey' - you won't see the applicationKey again!")
    
    access_key_id = input("\nEnter your Access Key ID: ").strip()
    secret_access_key = input("Enter your Secret Access Key: ").strip()
    
    if not access_key_id or not secret_access_key:
        print("❌ Access Key ID and Secret Access Key are required!")
        return
    
    # Determine region from endpoint
    region = "us-west-004"  # Default
    if "us-west-004" in endpoint_url:
        region = "us-west-004"
    elif "us-west-003" in endpoint_url:
        region = "us-west-003"
    elif "us-west-002" in endpoint_url:
        region = "us-west-002"
    elif "us-west-001" in endpoint_url:
        region = "us-west-001"
    elif "eu-central-003" in endpoint_url:
        region = "eu-central-003"
    elif "eu-central-002" in endpoint_url:
        region = "eu-central-002"
    elif "eu-central-001" in endpoint_url:
        region = "eu-central-001"
    elif "ap-southeast-002" in endpoint_url:
        region = "ap-southeast-002"
    elif "ap-southeast-001" in endpoint_url:
        region = "ap-southeast-001"
    
    print(f"\n🌍 Detected region: {region}")
    
    # Update .env file
    env_file = '.env'
    if not os.path.exists(env_file):
        print(f"\n📝 Creating {env_file} file...")
        with open(env_file, 'w') as f:
            f.write("# Environment Configuration\n")
    else:
        print(f"\n📝 Updating {env_file} file...")
    
    # Read existing .env content
    env_content = []
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            env_content = f.readlines()
    
    # Remove existing Backblaze B2 entries
    env_content = [line for line in env_content if not line.startswith('BACKBLAZE_')]
    
    # Add new Backblaze B2 entries
    backblaze_config = [
        "\n# Backblaze B2 Cloud Storage Configuration\n",
        f"BACKBLAZE_BUCKET_NAME={bucket_name}\n",
        f"BACKBLAZE_ENDPOINT_URL={endpoint_url}\n",
        f"BACKBLAZE_ACCESS_KEY_ID={access_key_id}\n",
        f"BACKBLAZE_SECRET_ACCESS_KEY={secret_access_key}\n",
        f"BACKBLAZE_REGION={region}\n"
    ]
    
    env_content.extend(backblaze_config)
    
    # Write updated .env file
    with open(env_file, 'w') as f:
        f.writelines(env_content)
    
    print(f"✅ Configuration saved to {env_file}")
    
    # Test the configuration
    print("\n🧪 Testing Backblaze B2 configuration...")
    try:
        from services.backblaze_config import init_backblaze_config
        if init_backblaze_config():
            print("✅ Backblaze B2 configuration test successful!")
        else:
            print("❌ Backblaze B2 configuration test failed!")
            print("Please check your credentials and try again.")
            return
    except Exception as e:
        print(f"❌ Error testing configuration: {e}")
        return
    
    print("\n🎉 Setup Complete!")
    print("\nNext steps:")
    print("1. Install dependencies: pip install -r requirements.txt")
    print("2. Start your application: python app.py")
    print("3. Test image uploads in the clergy form")
    
    print(f"\n📊 Your configuration:")
    print(f"  Bucket: {bucket_name}")
    print(f"  Endpoint: {endpoint_url}")
    print(f"  Region: {region}")
    print(f"  Access Key: {access_key_id[:8]}...")

if __name__ == "__main__":
    main()
