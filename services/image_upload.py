"""
Image Upload Service for Backblaze B2 Cloud Storage

This service handles uploading, resizing, and managing images in Backblaze B2.
It replaces the current base64 storage system with cloud storage.
"""

import os
import uuid
import base64
import json
from io import BytesIO
from PIL import Image
from flask import current_app
from botocore.exceptions import ClientError
from datetime import datetime
from .backblaze_config import get_backblaze_config


class ImageUploadService:
    """Service for handling image uploads to Backblaze B2"""
    
    def __init__(self):
        try:
            self.config = get_backblaze_config()
            self.s3_client = self.config.s3_client
            self.bucket_name = self.config.bucket_name
            self.backblaze_configured = True
            try:
                current_app.logger.info("ImageUploadService initialized with Backblaze B2")
            except RuntimeError:
                print("ImageUploadService initialized with Backblaze B2")
        except Exception as e:
            try:
                current_app.logger.warning(f"Backblaze B2 not configured: {e}")
            except RuntimeError:
                print(f"Backblaze B2 not configured: {e}")
            self.config = None
            self.s3_client = None
            self.bucket_name = None
            self.backblaze_configured = False
        
        # Image size configurations
        self.image_sizes = {
            'lineage': (48, 48),      # Small version for visualization
            'detail': (320, 320),     # Large version for detail view
            'original': None          # Keep original size (max 25MB)
        }
        
        # Maximum file size for original images (25MB)
        self.max_original_size = 25 * 1024 * 1024  # 25MB in bytes
    
    def upload_image_from_base64(self, base64_data, clergy_id, image_type='original'):
        """
        Upload a base64-encoded image to Backblaze B2
        
        Args:
            base64_data (str): Base64-encoded image data
            clergy_id (int): ID of the clergy member
            image_type (str): Type of image (lineage, detail, thumbnail, original)
            
        Returns:
            str: Public URL of the uploaded image, or None if failed
        """
        try:
            # Decode base64 data
            if base64_data.startswith('data:'):
                # Remove data URL prefix
                header, data = base64_data.split(',', 1)
                image_data = base64.b64decode(data)
            else:
                image_data = base64.b64decode(base64_data)
            
            # Generate unique filename
            file_extension = self._get_file_extension_from_base64(base64_data)
            object_key = self._generate_object_key(clergy_id, image_type, file_extension)
            
            # Upload to Backblaze B2
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=image_data,
                ContentType=self._get_content_type(file_extension)
            )
            
            # Return public URL
            public_url = self.config.get_public_url(object_key)
            current_app.logger.info(f"Uploaded {image_type} image for clergy {clergy_id}: {public_url}")
            
            return public_url
            
        except Exception as e:
            current_app.logger.error(f"Failed to upload {image_type} image for clergy {clergy_id}: {e}")
            return None

    def upload_original_image(self, file_data, clergy_id):
        """
        Upload and store the original image with size validation
        
        Args:
            file_data: File data (either File object or base64 string)
            clergy_id (int): ID of the clergy member
            
        Returns:
            dict: Contains 'success', 'url', 'size', 'error' keys
        """
        try:
            # Handle different input types
            if hasattr(file_data, 'read'):  # File object
                image_data = file_data.read()
                file_size = len(image_data)
                file_type = getattr(file_data, 'content_type', 'image/jpeg')
                filename = getattr(file_data, 'filename', 'image.jpg')
            else:  # Base64 string
                if file_data.startswith('data:'):
                    header, data = file_data.split(',', 1)
                    image_data = base64.b64decode(data)
                    file_type = header.split(';')[0].split(':')[1] if ':' in header else 'image/jpeg'
                else:
                    image_data = base64.b64decode(file_data)
                    file_type = 'image/jpeg'
                file_size = len(image_data)
                filename = 'image.jpg'
            
            # Validate file size
            if file_size > self.max_original_size:
                return {
                    'success': False,
                    'error': f'File size ({file_size / (1024*1024):.1f}MB) exceeds maximum allowed size (25MB)',
                    'size': file_size
                }
            
            # Validate file type
            if not file_type.startswith('image/'):
                return {
                    'success': False,
                    'error': 'File must be an image',
                    'size': file_size
                }
            
            # Generate unique filename for original
            file_extension = self._get_file_extension_from_filename(filename)
            object_key = self._generate_object_key(clergy_id, 'original', file_extension)
            
            # Upload to Backblaze B2
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=image_data,
                ContentType=file_type
            )
            
            # Return public URL
            public_url = self.config.get_public_url(object_key)
            current_app.logger.info(f"Uploaded original image for clergy {clergy_id}: {public_url} ({file_size} bytes)")
            
            return {
                'success': True,
                'url': public_url,
                'size': file_size,
                'object_key': object_key,
                'image_data': {
                    'original': public_url,
                    'metadata': {
                        'original_size': file_size,
                        'object_key': object_key,
                        'uploaded_at': datetime.now().isoformat()
                    }
                }
            }
            
        except Exception as e:
            current_app.logger.error(f"Failed to upload original image for clergy {clergy_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'size': 0
            }

    def process_cropped_image(self, cropped_image_data, clergy_id, original_object_key=None):
        """
        Process a cropped image and generate small (lineage) and large (detail) versions
        
        Args:
            cropped_image_data (str): Base64-encoded cropped image data
            clergy_id (int): ID of the clergy member
            original_object_key (str): Object key of the original image to delete previous edits
            
        Returns:
            dict: Contains 'success', 'urls', 'error' keys
        """
        try:
            current_app.logger.info(f"=== PROCESS_CROPPED_IMAGE SERVICE CALLED ===")
            current_app.logger.info(f"clergy_id: {clergy_id}")
            current_app.logger.info(f"original_object_key: {original_object_key}")
            current_app.logger.info(f"cropped_image_data length: {len(cropped_image_data) if cropped_image_data else 'None'}")
            current_app.logger.info(f"cropped_image_data starts with: {cropped_image_data[:50] if cropped_image_data else 'None'}")
            current_app.logger.info(f"Backblaze configured: {self.backblaze_configured}")
            
            # Check if Backblaze is configured
            if not self.backblaze_configured:
                current_app.logger.error("Backblaze B2 not configured - cannot process images")
                return {
                    'success': False,
                    'error': 'Image storage not configured. Please set up Backblaze B2 environment variables.'
                }
            
            # Delete previous cropped versions if editing
            if original_object_key:
                current_app.logger.info("Deleting previous cropped versions")
                self._delete_previous_cropped_versions(clergy_id)
            
            # Decode cropped image
            current_app.logger.info("Decoding cropped image data")
            if cropped_image_data.startswith('data:'):
                header, data = cropped_image_data.split(',', 1)
                image_data = base64.b64decode(data)
                current_app.logger.info(f"Decoded data URL, header: {header}")
            else:
                image_data = base64.b64decode(cropped_image_data)
                current_app.logger.info("Decoded raw base64 data")
            
            current_app.logger.info(f"Decoded image data size: {len(image_data)} bytes")
            
            # Open image with PIL
            current_app.logger.info("Opening image with PIL")
            image = Image.open(BytesIO(image_data))
            current_app.logger.info(f"Image opened successfully: {image.width}x{image.height}, mode: {image.mode}")
            
            # Get current image data to preserve original URL
            from models import Clergy
            current_app.logger.info("Getting current image data to preserve original URL")
            clergy = Clergy.query.get(clergy_id)
            original_url = None
            if clergy and clergy.image_data:
                try:
                    import json
                    current_image_data = json.loads(clergy.image_data)
                    original_url = current_image_data.get('original')
                    current_app.logger.info(f"Found original URL in current data: {original_url}")
                except (json.JSONDecodeError, AttributeError) as e:
                    current_app.logger.warning(f"Could not parse current image data: {e}")
            
            # If no original URL found in image_data, try to get it from clergy.image_url
            if not original_url and clergy and clergy.image_url:
                # Check if the image_url points to an original image (contains 'original_')
                if 'original_' in clergy.image_url:
                    original_url = clergy.image_url
                    current_app.logger.info(f"Using clergy.image_url as original URL: {original_url}")
                else:
                    # Try to find the original image in Backblaze storage
                    try:
                        response = self.s3_client.list_objects_v2(
                            Bucket=self.bucket_name,
                            Prefix=f"clergy/{clergy_id}/"
                        )
                        
                        # Look for original image
                        for obj in response.get('Contents', []):
                            key = obj['Key']
                            if 'original_' in key:
                                original_url = self.config.get_public_url(key)
                                current_app.logger.info(f"Found original image in storage: {original_url}")
                                break
                    except Exception as e:
                        current_app.logger.warning(f"Could not search for original image in storage: {e}")
            
            # Generate URLs for both sizes
            urls = {}
            
            # Preserve original URL if it exists
            if original_url:
                urls['original'] = original_url
                current_app.logger.info(f"Preserved original URL: {original_url}")
            else:
                current_app.logger.warning("No original URL found - this will result in loss of original image quality")
            
            # Create small version (lineage) - as small as possible for quick loading
            current_app.logger.info("Creating lineage version")
            lineage_url = self._create_resized_version(image, clergy_id, 'lineage', self.image_sizes['lineage'])
            if lineage_url:
                urls['lineage'] = lineage_url
                current_app.logger.info(f"Lineage URL created: {lineage_url}")
            else:
                current_app.logger.error("Failed to create lineage version")
            
            # Create large version (detail) - full resolution of the crop
            current_app.logger.info("Creating detail version")
            detail_url = self._create_resized_version(image, clergy_id, 'detail', self.image_sizes['detail'])
            if detail_url:
                urls['detail'] = detail_url
                current_app.logger.info(f"Detail URL created: {detail_url}")
            else:
                current_app.logger.error("Failed to create detail version")
            
            if not urls:
                current_app.logger.error("No URLs created")
                return {
                    'success': False,
                    'error': 'Failed to create any image versions'
                }
            
            # Store metadata
            from datetime import datetime
            urls['metadata'] = {
                'original_size': len(image_data),
                'cropped_dimensions': f"{image.width}x{image.height}",
                'timestamp': datetime.now().isoformat(),
                'quality': 95
            }
            
            current_app.logger.info(f"Processed cropped image for clergy {clergy_id}: {list(urls.keys())}")
            
            return {
                'success': True,
                'urls': urls
            }
            
        except Exception as e:
            current_app.logger.error(f"Failed to process cropped image for clergy {clergy_id}: {e}")
            import traceback
            current_app.logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e)
            }

    def _create_resized_version(self, image, clergy_id, size_type, target_size):
        """Create a resized version of the image"""
        try:
            current_app.logger.info(f"Creating {size_type} version with target size {target_size}")
            
            # Check if Backblaze is configured
            if not self.backblaze_configured:
                current_app.logger.error("Backblaze B2 not configured - cannot create resized version")
                return None
            
            # Resize image
            resized_image = image.resize(target_size, Image.Resampling.LANCZOS)
            current_app.logger.info(f"Image resized to {resized_image.width}x{resized_image.height}")
            
            # Convert to bytes with high quality
            output = BytesIO()
            resized_image.save(output, format='JPEG', quality=95, optimize=True)
            resized_data = output.getvalue()
            current_app.logger.info(f"Resized image data size: {len(resized_data)} bytes")
            
            # Generate unique filename
            object_key = self._generate_object_key(clergy_id, size_type, '.jpg')
            current_app.logger.info(f"Generated object key: {object_key}")
            
            # Upload to Backblaze B2
            current_app.logger.info(f"Uploading to Backblaze B2 bucket: {self.bucket_name}")
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=resized_data,
                ContentType='image/jpeg'
            )
            current_app.logger.info("Upload successful")
            
            # Return public URL
            public_url = self.config.get_public_url(object_key)
            current_app.logger.info(f"Generated public URL: {public_url}")
            return public_url
            
        except Exception as e:
            current_app.logger.error(f"Failed to create {size_type} version for clergy {clergy_id}: {e}")
            import traceback
            current_app.logger.error(f"Traceback: {traceback.format_exc()}")
            return None

    def _delete_previous_cropped_versions(self, clergy_id):
        """Delete previous lineage and detail versions when editing"""
        try:
            # List objects with the clergy ID prefix
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"clergy/{clergy_id}/"
            )
            
            # Delete lineage and detail versions (keep original)
            for obj in response.get('Contents', []):
                key = obj['Key']
                if 'lineage_' in key or 'detail_' in key:
                    self.s3_client.delete_object(
                        Bucket=self.bucket_name,
                        Key=key
                    )
                    current_app.logger.info(f"Deleted previous cropped version: {key}")
                    
        except Exception as e:
            current_app.logger.error(f"Failed to delete previous cropped versions for clergy {clergy_id}: {e}")
    
    def upload_image_from_file(self, file_data, clergy_id, image_type='original'):
        """
        Upload a file object to Backblaze B2
        
        Args:
            file_data: File object from Flask request
            clergy_id (int): ID of the clergy member
            image_type (str): Type of image (lineage, detail, thumbnail, original)
            
        Returns:
            str: Public URL of the uploaded image, or None if failed
        """
        try:
            # Generate unique filename
            file_extension = self._get_file_extension_from_filename(file_data.filename)
            object_key = self._generate_object_key(clergy_id, image_type, file_extension)
            
            # Reset file pointer
            file_data.seek(0)
            
            # Upload to Backblaze B2
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=file_data.read(),
                ContentType=file_data.content_type or self._get_content_type(file_extension)
            )
            
            # Return public URL
            public_url = self.config.get_public_url(object_key)
            current_app.logger.info(f"Uploaded {image_type} image for clergy {clergy_id}: {public_url}")
            
            return public_url
            
        except Exception as e:
            current_app.logger.error(f"Failed to upload {image_type} image for clergy {clergy_id}: {e}")
            return None
    
    def process_and_upload_comprehensive_image(self, image_data_json, clergy_id):
        """
        Process comprehensive image data and upload all sizes to Backblaze B2
        
        Args:
            image_data_json (str): JSON string containing multiple image sizes
            clergy_id (int): ID of the clergy member
            
        Returns:
            dict: Dictionary with URLs for each image size, or None if failed
        """
        try:
            image_data = json.loads(image_data_json)
            result = {}
            
            # Upload each image size
            for size_name, base64_data in image_data.items():
                if base64_data and size_name != 'metadata':
                    url = self.upload_image_from_base64(base64_data, clergy_id, size_name)
                    if url:
                        result[size_name] = url
                    else:
                        current_app.logger.warning(f"Failed to upload {size_name} image for clergy {clergy_id}")
            
            # Add metadata if available
            if 'metadata' in image_data:
                result['metadata'] = image_data['metadata']
            
            current_app.logger.info(f"Processed comprehensive image upload for clergy {clergy_id}: {list(result.keys())}")
            return result
            
        except json.JSONDecodeError as e:
            current_app.logger.error(f"Failed to parse image data JSON for clergy {clergy_id}: {e}")
            return None
        except Exception as e:
            current_app.logger.error(f"Failed to process comprehensive image for clergy {clergy_id}: {e}")
            return None
    
    def resize_and_upload_image(self, base64_data, clergy_id, target_size, image_type):
        """
        Resize an image and upload to Backblaze B2
        
        Args:
            base64_data (str): Base64-encoded image data
            clergy_id (int): ID of the clergy member
            target_size (tuple): Target size as (width, height)
            image_type (str): Type of image
            
        Returns:
            str: Public URL of the uploaded image, or None if failed
        """
        try:
            # Decode base64 data
            if base64_data.startswith('data:'):
                header, data = base64_data.split(',', 1)
                image_data = base64.b64decode(data)
            else:
                image_data = base64.b64decode(base64_data)
            
            # Open image with PIL
            image = Image.open(BytesIO(image_data))
            
            # Resize image
            resized_image = image.resize(target_size, Image.Resampling.LANCZOS)
            
            # Convert back to bytes
            output = BytesIO()
            resized_image.save(output, format='JPEG', quality=85, optimize=True)
            resized_data = output.getvalue()
            
            # Generate unique filename
            object_key = self._generate_object_key(clergy_id, image_type, '.jpg')
            
            # Upload to Backblaze B2
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=resized_data,
                ContentType='image/jpeg'
            )
            
            # Return public URL
            public_url = self.config.get_public_url(object_key)
            current_app.logger.info(f"Uploaded resized {image_type} image for clergy {clergy_id}: {public_url}")
            
            return public_url
            
        except Exception as e:
            current_app.logger.error(f"Failed to resize and upload {image_type} image for clergy {clergy_id}: {e}")
            return None
    
    def delete_image(self, object_key):
        """
        Delete an image from Backblaze B2
        
        Args:
            object_key (str): The object key to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_key)
            current_app.logger.info(f"Deleted image: {object_key}")
            return True
        except ClientError as e:
            current_app.logger.error(f"Failed to delete image {object_key}: {e}")
            return False
    
    def delete_clergy_images(self, clergy_id):
        """
        Delete all images for a clergy member
        
        Args:
            clergy_id (int): ID of the clergy member
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # List all objects with the clergy ID prefix
            prefix = f"clergy/{clergy_id}/"
            response = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
            
            if 'Contents' in response:
                # Delete all objects
                for obj in response['Contents']:
                    self.delete_image(obj['Key'])
                
                current_app.logger.info(f"Deleted all images for clergy {clergy_id}")
                return True
            else:
                current_app.logger.info(f"No images found for clergy {clergy_id}")
                return True
                
        except Exception as e:
            current_app.logger.error(f"Failed to delete images for clergy {clergy_id}: {e}")
            return False
    
    def _generate_object_key(self, clergy_id, image_type, file_extension):
        """Generate a unique object key for the image"""
        unique_id = str(uuid.uuid4())[:8]
        return f"clergy/{clergy_id}/{image_type}_{unique_id}{file_extension}"
    
    def _get_file_extension_from_base64(self, base64_data):
        """Extract file extension from base64 data URL"""
        if base64_data.startswith('data:'):
            header = base64_data.split(',')[0]
            if 'image/png' in header:
                return '.png'
            elif 'image/jpeg' in header or 'image/jpg' in header:
                return '.jpg'
            elif 'image/gif' in header:
                return '.gif'
            elif 'image/webp' in header:
                return '.webp'
        return '.jpg'  # Default to jpg
    
    def _get_file_extension_from_filename(self, filename):
        """Extract file extension from filename"""
        if filename:
            return os.path.splitext(filename)[1].lower()
        return '.jpg'  # Default to jpg
    
    def _get_content_type(self, file_extension):
        """Get content type from file extension"""
        content_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        return content_types.get(file_extension.lower(), 'image/jpeg')


# Global instance
image_upload_service = None


def get_image_upload_service():
    """Get the global image upload service instance"""
    global image_upload_service
    if image_upload_service is None:
        image_upload_service = ImageUploadService()
    return image_upload_service
