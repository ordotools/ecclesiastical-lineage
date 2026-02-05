"""
Image Upload Service for Backblaze B2 Cloud Storage

This service handles uploading, resizing, and managing images in Backblaze B2.
It replaces the current base64 storage system with cloud storage.
"""

import os
import uuid
import base64
import json
import requests
from io import BytesIO
from PIL import Image, ImageFilter, ImageDraw
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
                pass  # No app context during init
        except Exception as e:
            try:
                current_app.logger.warning("Backblaze B2 not configured: %s", e)
            except RuntimeError:
                pass  # No app context during init
            self.config = None
            self.s3_client = None
            self.bucket_name = None
            self.backblaze_configured = False
        
        # Image size configurations
        self.image_sizes = {
            'lineage': (64, 64),      # Small version for visualization (increased from 48x48)
            'detail': (320, 320),     # Large version for detail view
            'original': None          # Keep original size (max 25MB)
        }
        
        # Quality settings for different image types
        self.quality_settings = {
            'lineage': 95,    # Lower quality for small images
            'detail': 90,     # High quality for detail view
            'original': 95    # Highest quality for original
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
            if base64_data.startswith('data:'):
                header, data = base64_data.split(',', 1)
                image_data = base64.b64decode(data)
            else:
                image_data = base64.b64decode(base64_data)

            file_extension = self._get_file_extension_from_base64(base64_data)
            object_key = self._generate_object_key(clergy_id, image_type, file_extension)

            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=image_data,
                ContentType=self._get_content_type(file_extension)
            )

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

            if file_size > self.max_original_size:
                return {
                    'success': False,
                    'error': f'File size ({file_size / (1024*1024):.1f}MB) exceeds maximum allowed size (25MB)',
                    'size': file_size
                }
            
            if not file_type.startswith('image/'):
                return {
                    'success': False,
                    'error': 'File must be an image',
                    'size': file_size
                }

            file_extension = self._get_file_extension_from_filename(filename)
            object_key = self._generate_object_key(clergy_id, 'original', file_extension)

            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=image_data,
                ContentType=file_type
            )

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

            if not self.backblaze_configured:
                current_app.logger.error("Backblaze B2 not configured - cannot process images")
                return {
                    'success': False,
                    'error': 'Image storage not configured. Please set up Backblaze B2 environment variables.'
                }

            if original_object_key:
                current_app.logger.info("Deleting previous cropped versions")
                self._delete_previous_cropped_versions(clergy_id)

            current_app.logger.info("Decoding cropped image data")
            if cropped_image_data.startswith('data:'):
                header, data = cropped_image_data.split(',', 1)
                image_data = base64.b64decode(data)
                current_app.logger.info(f"Decoded data URL, header: {header}")
            else:
                image_data = base64.b64decode(cropped_image_data)
                current_app.logger.info("Decoded raw base64 data")
            
            current_app.logger.info(f"Decoded image data size: {len(image_data)} bytes")

            current_app.logger.info("Opening image with PIL")
            image = Image.open(BytesIO(image_data))
            current_app.logger.info(f"Image opened successfully: {image.width}x{image.height}, mode: {image.mode}")

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
            
            if not original_url and clergy and clergy.image_url:
                if 'original_' in clergy.image_url:
                    original_url = clergy.image_url
                    current_app.logger.info(f"Using clergy.image_url as original URL: {original_url}")
                else:
                    try:
                        response = self.s3_client.list_objects_v2(
                            Bucket=self.bucket_name,
                            Prefix=f"clergy/{clergy_id}/"
                        )
                        for obj in response.get('Contents', []):
                            key = obj['Key']
                            if 'original_' in key and not 'lineage_' in key and not 'detail_' in key:
                                original_url = self.config.get_public_url(key)
                                current_app.logger.info(f"Found original image in storage: {original_url}")
                                break
                    except Exception as e:
                        current_app.logger.warning(f"Could not search for original image in storage: {e}")

            urls = {}

            if not original_url:
                current_app.logger.warning("No original URL found in image_data - searching storage")
                try:
                    response = self.s3_client.list_objects_v2(
                        Bucket=self.bucket_name,
                        Prefix=f"clergy/{clergy_id}/"
                    )
                    original_objects = []
                    for obj in response.get('Contents', []):
                        key = obj['Key']
                        if 'original_' in key and 'lineage_' not in key and 'detail_' not in key:
                            original_objects.append((obj['LastModified'], key))
                    
                    if original_objects:
                        original_objects.sort(key=lambda x: x[0], reverse=True)
                        most_recent_key = original_objects[0][1]
                        original_url = self.config.get_public_url(most_recent_key)
                        current_app.logger.info(f"Found original image in storage: {original_url}")
                except Exception as e:
                    current_app.logger.warning(f"Could not find original image in storage: {e}")

            if not original_url:
                current_app.logger.warning("No original URL found - uploading cropped image as new original")
                try:
                    output = BytesIO()
                    image.save(output, format='JPEG', quality=95, optimize=True)
                    cropped_bytes = output.getvalue()
                    object_key = self._generate_object_key(clergy_id, 'original', '.jpg')
                    self.s3_client.put_object(
                        Bucket=self.bucket_name,
                        Key=object_key,
                        Body=cropped_bytes,
                        ContentType='image/jpeg'
                    )
                    
                    original_url = self.config.get_public_url(object_key)
                    current_app.logger.info(f"Uploaded cropped image as new original: {original_url}")
                except Exception as e:
                    current_app.logger.error(f"Failed to upload cropped image as original: {e}")

            if original_url:
                urls['original'] = original_url
                current_app.logger.info(f"Using original URL: {original_url}")
            else:
                current_app.logger.error("CRITICAL: Failed to establish original URL - future edits may fail!")

            current_app.logger.info("Creating lineage version")
            lineage_url = self._create_resized_version(image, clergy_id, 'lineage', self.image_sizes['lineage'])
            if lineage_url:
                urls['lineage'] = lineage_url
                current_app.logger.info(f"Lineage URL created: {lineage_url}")
            else:
                current_app.logger.error("Failed to create lineage version")

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

            from datetime import datetime
            urls['metadata'] = {
                'original_size': len(image_data),
                'cropped_dimensions': f"{image.width}x{image.height}",
                'timestamp': datetime.now().isoformat(),
                'quality_settings': self.quality_settings,
                'compression_optimized': True,
                'progressive_jpeg': True
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
        """Create a resized version of the image with optimized compression"""
        try:
            current_app.logger.info(f"Creating {size_type} version with target size {target_size}")

            if not self.backblaze_configured:
                current_app.logger.error("Backblaze B2 not configured - cannot create resized version")
                return None

            if image.mode in ('RGBA', 'LA', 'P'):
                # Create a white background for transparent images
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')

            resized_image = image.resize(target_size, Image.Resampling.LANCZOS)
            current_app.logger.info(f"Image resized to {resized_image.width}x{resized_image.height}")
            quality = self.quality_settings.get(size_type, 100)
            output = BytesIO()
            resized_image.save(
                output, 
                format='JPEG', 
                quality=quality, 
                optimize=True,
                progressive=True
            )
            resized_data = output.getvalue()
            current_app.logger.info(f"Resized image data size: {len(resized_data)} bytes (quality: {quality})")
            max_size = 500 * 1024
            if size_type == 'detail':
                max_size = 1024 * 1024  # 1MB for detail images
                
            if len(resized_data) > max_size and quality > 60:
                current_app.logger.info(f"Image too large ({len(resized_data)} bytes), reducing quality")
                quality = max(60, quality - 15)
                output = BytesIO()
                resized_image.save(
                    output, 
                    format='JPEG', 
                    quality=quality, 
                    optimize=True,
                    progressive=True
                )
                resized_data = output.getvalue()
                current_app.logger.info(f"Reduced quality to {quality}, new size: {len(resized_data)} bytes")

            object_key = self._generate_object_key(clergy_id, size_type, '.jpg')
            current_app.logger.info(f"Generated object key: {object_key}")
            current_app.logger.info(f"Uploading to Backblaze B2 bucket: {self.bucket_name}")
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=resized_data,
                ContentType='image/jpeg'
            )
            current_app.logger.info("Upload successful")
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
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"clergy/{clergy_id}/"
            )
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
            
            file_data.seek(0)
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=file_data.read(),
                ContentType=file_data.content_type or self._get_content_type(file_extension)
            )
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

            for size_name, base64_data in image_data.items():
                if base64_data and size_name != 'metadata':
                    url = self.upload_image_from_base64(base64_data, clergy_id, size_name)
                    if url:
                        result[size_name] = url
                    else:
                        current_app.logger.warning(f"Failed to upload {size_name} image for clergy {clergy_id}")

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
            if base64_data.startswith('data:'):
                header, data = base64_data.split(',', 1)
                image_data = base64.b64decode(data)
            else:
                image_data = base64.b64decode(base64_data)

            image = Image.open(BytesIO(image_data))
            resized_image = image.resize(target_size, Image.Resampling.LANCZOS)
            output = BytesIO()
            resized_image.save(output, format='JPEG', quality=85, optimize=True)
            resized_data = output.getvalue()
            object_key = self._generate_object_key(clergy_id, image_type, '.jpg')
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=resized_data,
                ContentType='image/jpeg'
            )
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
            prefix = f"clergy/{clergy_id}/"
            response = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
            
            if 'Contents' in response:
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
    
    def _create_placeholder_silhouette(self, size=48):
        """
        Create a placeholder silhouette image (person icon)

        Args:
            size (int): Size of the placeholder image in pixels

        Returns:
            PIL.Image: Placeholder silhouette image
        """
        img = Image.new('RGB', (size, size), (255, 255, 255))
        draw = ImageDraw.Draw(img)
        center_x = size // 2
        center_y = size // 2
        head_radius = int(size * 0.22)
        head_y = int(size * 0.375)
        head_bbox = [
            center_x - head_radius,
            head_y - head_radius,
            center_x + head_radius,
            head_y + head_radius
        ]
        draw.ellipse(head_bbox, fill='#bdc3c7')
        body_width = int(size * 0.625)
        body_height = int(size * 0.1875)
        body_y = int(size * 0.78125)
        body_bbox = [
            center_x - body_width // 2,
            body_y - body_height // 2,
            center_x + body_width // 2,
            body_y + body_height // 2
        ]
        draw.ellipse(body_bbox, fill='#bdc3c7')
        
        return img
    
    def create_sprite_sheet(self, clergy_list, images_per_row=20, thumbnail_size=48):
        """
        Create an optimized sprite sheet from clergy thumbnail images
        
        Args:
            clergy_list: List of Clergy objects with image_data or image_url
            images_per_row (int): Number of thumbnails per row in sprite sheet
            thumbnail_size (int): Size of each thumbnail in pixels
            
        Returns:
            dict: Contains 'success', 'url', 'error', 'mapping' keys
                  mapping is a dict of {clergy_id: (x, y)} positions in sprite
        """
        try:
            if not self.backblaze_configured:
                return {
                    'success': False,
                    'error': 'Backblaze B2 not configured'
                }

            clergy_with_images = []
            clergy_without_images = []

            for clergy in clergy_list:
                thumbnail_url = None
                if clergy.image_data:
                    try:
                        image_data = json.loads(clergy.image_data)
                        thumbnail_url = image_data.get('lineage', image_data.get('detail', image_data.get('original', '')))
                        if thumbnail_url == '':
                            thumbnail_url = None
                    except (json.JSONDecodeError, AttributeError):
                        pass

                if not thumbnail_url:
                    thumbnail_url = clergy.image_url if clergy.image_url else None
                    if thumbnail_url == '':
                        thumbnail_url = None

                if thumbnail_url is None or thumbnail_url == '':
                    clergy_without_images.append(clergy.id)
                else:
                    clergy_with_images.append((clergy.id, thumbnail_url))

            if not clergy_list:
                return {
                    'success': False,
                    'error': 'No clergy found to create sprite sheet'
                }

            placeholder_img = self._create_placeholder_silhouette(thumbnail_size)
            placeholder_position = (0, 0)
            position_mapping = {}
            placeholder_count = len(clergy_without_images)
            successfully_processed_images = []

            for clergy_id, thumbnail_url in clergy_with_images:
                try:
                    response = requests.get(thumbnail_url, timeout=10)
                    response.raise_for_status()
                    img = Image.open(BytesIO(response.content))
                    if img.size != (thumbnail_size, thumbnail_size):
                        img = img.resize((thumbnail_size, thumbnail_size), Image.Resampling.LANCZOS)
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    successfully_processed_images.append((clergy_id, img))
                except Exception as e:
                    current_app.logger.warning(f"Failed to process thumbnail for clergy {clergy_id} ({thumbnail_url}): {e}")
                    clergy_without_images.append(clergy_id)
                    placeholder_count += 1

            num_images_in_sprite = len(successfully_processed_images) + 1
            rows = (num_images_in_sprite + images_per_row - 1) // images_per_row
            sprite_width = images_per_row * thumbnail_size
            sprite_height = rows * thumbnail_size
            sprite = Image.new('RGB', (sprite_width, sprite_height), (255, 255, 255))
            sprite.paste(placeholder_img, placeholder_position)

            for idx, (clergy_id, img) in enumerate(successfully_processed_images):
                sprite_idx = idx + 1
                x = (sprite_idx % images_per_row) * thumbnail_size
                y = (sprite_idx // images_per_row) * thumbnail_size
                sprite.paste(img, (x, y))
                position_mapping[clergy_id] = (x, y)

            for clergy_id in clergy_without_images:
                position_mapping[clergy_id] = placeholder_position

            num_images = len(clergy_list)
            sprite = sprite.filter(ImageFilter.SMOOTH)
            sprite = sprite.convert('P', palette=Image.ADAPTIVE, colors=128)
            sprite = sprite.convert('RGB')
            output = BytesIO()
            sprite.save(
                output,
                'JPEG',
                quality=65,
                optimize=True,
                progressive=True,  # Progressive JPEG
                subsampling='4:2:0'  # Aggressive chroma subsampling
            )
            sprite_data = output.getvalue()
            object_key = f"sprites/clergy_sprite_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=sprite_data,
                ContentType='image/jpeg'
            )
            sprite_url = self.config.get_public_url(object_key)
            num_actual_in_sprite = len(clergy_with_images) - (placeholder_count - len(clergy_without_images))
            current_app.logger.info(f"Created optimized sprite sheet: {sprite_url} ({len(sprite_data)} bytes, {num_images_in_sprite} tiles in sprite [{num_actual_in_sprite} images + 1 placeholder], {num_images} total clergy, {placeholder_count} using placeholder)")

            from models import SpriteSheet, ClergySpritePosition, db
            SpriteSheet.query.update({SpriteSheet.is_current: False})
            sprite_sheet = SpriteSheet(
                url=sprite_url,
                object_key=object_key,
                thumbnail_size=thumbnail_size,
                images_per_row=images_per_row,
                sprite_width=sprite_width,
                sprite_height=sprite_height,
                num_images=num_images,  # Total clergy entries (for tracking)
                is_current=True
            )
            db.session.add(sprite_sheet)
            db.session.flush()

            for clergy_id, (x, y) in position_mapping.items():
                position = ClergySpritePosition(
                    clergy_id=clergy_id,
                    sprite_sheet_id=sprite_sheet.id,
                    x_position=x,
                    y_position=y
                )
                db.session.add(position)
            
            db.session.commit()
            
            current_app.logger.info(f"Saved sprite sheet {sprite_sheet.id} with {len(position_mapping)} positions to database")
            
            return {
                'success': True,
                'url': sprite_url,
                'mapping': position_mapping,
                'object_key': object_key,
                'sprite_width': sprite_width,
                'sprite_height': sprite_height,
                'thumbnail_size': thumbnail_size,
                'images_per_row': images_per_row,
                'num_images': num_images,
                'sprite_sheet_id': sprite_sheet.id
            }
            
        except Exception as e:
            current_app.logger.error(f"Failed to create sprite sheet: {e}")
            import traceback
            current_app.logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e)
            }


# Global instance
image_upload_service = None


def get_image_upload_service():
    """Get the global image upload service instance"""
    global image_upload_service
    if image_upload_service is None:
        image_upload_service = ImageUploadService()
    return image_upload_service
