# Backblaze B2 Cloud Storage Setup

This document explains how to set up Backblaze B2 Cloud Storage for the Ecclesiastical Lineage application.

## Overview

The application now uses Backblaze B2 Cloud Storage instead of storing images as base64 data in the database. This provides several benefits:

- **Reduced database size**: Images are stored in cloud storage, not in the database
- **Better performance**: Faster page loads without large base64 strings
- **Scalability**: No database size limits for images
- **Cost efficiency**: Backblaze B2 is significantly cheaper than database storage
- **CDN integration**: Images can be served from Backblaze B2's global network

## Quick Setup

### 1. Automated Setup (Recommended)

Run the setup script to configure Backblaze B2:

```bash
python setup_backblaze.py
```

This script will guide you through:
- Creating a Backblaze B2 bucket
- Creating an application key
- Configuring environment variables
- Testing the connection

### 2. Manual Setup

If you prefer to set up manually:

#### Step 1: Create a Backblaze B2 Account

1. Go to [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html)
2. Sign up for a free account (10GB free storage)
3. Verify your email address

#### Step 2: Create a Bucket

1. Sign in to the [Backblaze B2 Console](https://secure.backblaze.com/user_signin.htm)
2. Navigate to "B2 Cloud Storage" → "Buckets"
3. Click "Create a Bucket"
4. Enter a globally unique bucket name (e.g., `ecclesiastical-lineage-images`)
5. Select "Public" for the privacy setting
6. Click "Create a Bucket"
7. Copy the endpoint URL (e.g., `https://s3.us-west-004.backblazeb2.com`)

#### Step 3: Create an Application Key

1. Go to "Application Keys" in the B2 console
2. Click "Add a New Application Key"
3. Enter a name (e.g., `ecclesiastical-lineage`)
4. Select "All" for bucket access
5. Select "Read and Write" for access type
6. Click "Create New Key"
7. **IMPORTANT**: Copy both the `keyID` and `applicationKey` - you won't see the applicationKey again!

#### Step 4: Configure Environment Variables

Add these variables to your `.env` file:

```env
# Backblaze B2 Cloud Storage Configuration
BACKBLAZE_BUCKET_NAME=your-bucket-name
BACKBLAZE_ENDPOINT_URL=https://s3.us-west-004.backblazeb2.com
BACKBLAZE_ACCESS_KEY_ID=your-access-key-id
BACKBLAZE_SECRET_ACCESS_KEY=your-secret-access-key
BACKBLAZE_REGION=us-west-004
```

## Migration from Base64 Storage

If you have existing images stored as base64 data in your database, you can migrate them to Backblaze B2:

```bash
python migrate_images_to_backblaze.py
```

**Important**: 
- Make a database backup before running the migration
- The migration will replace base64 data with Backblaze B2 URLs
- This process cannot be easily reversed

## File Structure

The application stores images in Backblaze B2 with this structure:

```
clergy/
├── {clergy_id}/
│   ├── lineage_{uuid}.jpg      # 48x48px for lineage visualization
│   ├── detail_{uuid}.jpg       # 320x320px for detail views
│   ├── thumbnail_{uuid}.jpg    # 150x150px for thumbnails
│   └── original_{uuid}.jpg     # Original size
```

## Configuration Details

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKBLAZE_BUCKET_NAME` | Your B2 bucket name | `ecclesiastical-lineage-images` |
| `BACKBLAZE_ENDPOINT_URL` | B2 S3-compatible endpoint | `https://s3.us-west-004.backblazeb2.com` |
| `BACKBLAZE_ACCESS_KEY_ID` | Application key ID | `K001abc123def456` |
| `BACKBLAZE_SECRET_ACCESS_KEY` | Application key secret | `K001abc123def456ghi789` |
| `BACKBLAZE_REGION` | B2 region | `us-west-004` |

### Supported Regions

- `us-west-004` (US West - Oregon)
- `us-west-003` (US West - California)
- `us-west-002` (US West - California)
- `us-west-001` (US West - California)
- `eu-central-003` (EU Central - Amsterdam)
- `eu-central-002` (EU Central - Amsterdam)
- `eu-central-001` (EU Central - Amsterdam)
- `ap-southeast-002` (Asia Pacific - Singapore)
- `ap-southeast-001` (Asia Pacific - Singapore)

## Troubleshooting

### Common Issues

1. **"Bucket not found" error**
   - Check that the bucket name is correct
   - Ensure the bucket exists in your Backblaze B2 account
   - Verify the endpoint URL matches your bucket's region

2. **"Access denied" error**
   - Check that your application key has the correct permissions
   - Ensure the key has "Read and Write" access
   - Verify the key is not expired

3. **"Invalid credentials" error**
   - Double-check your access key ID and secret access key
   - Ensure there are no extra spaces or characters
   - Try creating a new application key

4. **Images not loading**
   - Check that your bucket is set to "Public"
   - Verify the image URLs are accessible in a browser
   - Check the application logs for upload errors

### Testing Configuration

Test your Backblaze B2 configuration:

```python
from services.backblaze_config import init_backblaze_config

if init_backblaze_config():
    print("✅ Backblaze B2 is configured correctly")
else:
    print("❌ Backblaze B2 configuration failed")
```

## Cost Considerations

Backblaze B2 pricing (as of 2024):
- **Storage**: $0.005/GB/month
- **Downloads**: $0.01/GB
- **API calls**: $0.004/10,000 Class A operations, $0.0004/10,000 Class B operations

For a typical ecclesiastical lineage application:
- 100 clergy members with images: ~1GB storage = $0.005/month
- 1,000 page views/month: ~10GB downloads = $0.10/month
- **Total estimated cost**: ~$0.11/month

## Security Best Practices

1. **Use application keys** instead of master keys
2. **Limit permissions** to only what's needed
3. **Rotate keys** regularly
4. **Monitor usage** for unexpected activity
5. **Set up alerts** for unusual download patterns

## Support

If you encounter issues:

1. Check the application logs for error messages
2. Verify your Backblaze B2 configuration
3. Test with a simple image upload
4. Check the [Backblaze B2 documentation](https://www.backblaze.com/docs/cloud-storage-developer-quick-start-guide)

## Migration Back to Base64 (Not Recommended)

If you need to migrate back to base64 storage (not recommended due to performance issues):

1. Download all images from Backblaze B2
2. Convert them back to base64
3. Update the database records
4. Remove the Backblaze B2 configuration

This process is complex and not supported by the current codebase.
