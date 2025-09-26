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
from .backblaze_config import get_backblaze_config


class ImageUploadService:
    """Service for handling image uploads to Backblaze B2"""
    
    def __init__(self):
        self.config = get_backblaze_config()
        self.s3_client = self.config.s3_client
        self.bucket_name = self.config.bucket_name
        
        # Image size configurations
        self.image_sizes = {
            'lineage': (48, 48),
            'detail': (320, 320),
            'thumbnail': (150, 150),
            'original': None  # Keep original size
        }
    
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
