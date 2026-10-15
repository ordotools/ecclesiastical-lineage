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
from PIL import Image, ImageFilter, ImageDraw, ImageOps
from flask import current_app
from botocore.exceptions import ClientError
from datetime import datetime
from .backblaze_config import get_backblaze_config


# Where the automatic square crop sits on a non-square upload (x, y; 0 = left/top). Portraits put
# faces high, so a tall photo keeps more of its top. Tune here if heads get clipped.
AUTO_CROP_CENTERING = (0.5, 0.35)


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
                filename = 'image' + self._get_file_extension_from_base64(file_data)

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
                'bytes': image_data,
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

    def save_clergy_image(self, clergy_id, original=None, cropped_image_data=None):
        """
        Store a clergy photo: the original plus the lineage and detail sizes, which come from the
        user's square crop if there is one, else from an automatic square crop of the original.

        Called when the clergy form is saved (or by the legacy crop endpoint). Nothing is deleted
        here; the edit handler prunes the replaced files once the row is committed.

        Args:
            clergy_id (int): ID of the clergy member
            original: a newly chosen original (FileStorage or base64 data URL); None keeps the stored one
            cropped_image_data (str): base64 data URL of the user's square crop; None to auto-crop

        Returns:
            dict: {'success', 'urls'} where urls holds only bucket URLs (original, lineage, detail) and metadata
        """
        try:
            if not self.backblaze_configured:
                return {
                    'success': False,
                    'error': 'Image storage not configured. Please set up Backblaze B2 environment variables.'
                }
            if original is None and not cropped_image_data:
                return {'success': False, 'error': 'No image given'}

            original_bytes = None
            if original is not None:
                result = self.upload_original_image(original, clergy_id)
                if not result['success']:
                    return {'success': False, 'error': result['error']}
                original_url, original_bytes = result['url'], result['bytes']
            else:
                original_url = self._current_original_url(clergy_id)
                if not original_url:
                    # No original anywhere: the crop is the best we have, and re-cropping needs one.
                    original_url = self.upload_image_from_base64(cropped_image_data, clergy_id, 'original')

            if cropped_image_data:
                image = Image.open(BytesIO(_decode_data_url(cropped_image_data)))
            else:
                # Phone photos store rotation in EXIF; the browser cropper applies it, PIL doesn't.
                image = ImageOps.exif_transpose(Image.open(BytesIO(original_bytes)))
                side = min(image.size)
                image = ImageOps.fit(image, (side, side), centering=AUTO_CROP_CENTERING)

            urls = {'original': original_url} if original_url else {}
            for size_type in ('lineage', 'detail'):
                url = self._create_resized_version(image, clergy_id, size_type, self.image_sizes[size_type])
                if not url:
                    return {'success': False, 'error': f'Failed to create {size_type} version'}
                urls[size_type] = url

            urls['metadata'] = {
                'cropped_dimensions': f"{image.width}x{image.height}",
                'auto_cropped': not cropped_image_data,
                'timestamp': datetime.now().isoformat(),
            }
            current_app.logger.info(f"Saved image for clergy {clergy_id}: {urls}")
            return {'success': True, 'urls': urls}

        except Exception as e:
            current_app.logger.exception(f"Failed to save image for clergy {clergy_id}")
            return {'success': False, 'error': str(e)}

    def _current_original_url(self, clergy_id):
        """The bucket URL of the original the clergy row points at, else the newest original_ in the bucket."""
        from models import Clergy
        clergy = Clergy.query.get(clergy_id)
        if clergy:
            try:
                saved = (json.loads(clergy.image_data) if clergy.image_data else {}).get('original')
            except (json.JSONDecodeError, AttributeError):
                saved = None
            for url in (saved, clergy.image_url):
                key = self.config.get_object_key(url)
                if key and '/original_' in key:
                    return url
        try:
            objects = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=self._clergy_prefix(clergy_id)).get('Contents', [])
            originals = sorted((o['LastModified'], o['Key']) for o in objects if '/original_' in o['Key'])
            if originals:
                return self.config.get_public_url(originals[-1][1])
        except Exception as e:
            current_app.logger.warning(f"Could not search storage for clergy {clergy_id}'s original: {e}")
        return None

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
        """Delete every image this app stored for a clergy member. Returns True on success."""
        return self.prune_clergy_images(clergy_id, keep_urls=())

    def prune_clergy_images(self, clergy_id, keep_urls):
        """
        Delete the clergy member's bucket files that keep_urls doesn't reference: sizes replaced
        by a saved re-crop, and crops whose form was never saved. Call only after the row is committed.
        """
        keep = {self.config.get_object_key(u) for u in keep_urls}
        try:
            objects = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=self._clergy_prefix(clergy_id)).get('Contents', [])
            # ponytail: one list page (1000 keys) per clergy is plenty; paginate if that ever stops holding
            stale = [{'Key': o['Key']} for o in objects if o['Key'] not in keep]
            if stale:
                self.s3_client.delete_objects(Bucket=self.bucket_name, Delete={'Objects': stale, 'Quiet': True})
                current_app.logger.info(f"Pruned {len(stale)} unreferenced image(s) for clergy {clergy_id}")
            return True
        except Exception as e:
            current_app.logger.error(f"Failed to prune images for clergy {clergy_id}: {e}")
            return False

    WIKI_ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

    def upload_wiki_image(self, file):
        """
        Upload a wiki image to Backblaze B2.

        Args:
            file: Werkzeug FileStorage from request.files

        Returns:
            str: Public URL of the uploaded image, or None if failed/not configured
        """
        if not self.backblaze_configured:
            return None
        if not file or not file.filename:
            return None
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if ext not in self.WIKI_ALLOWED_EXTENSIONS:
            return None
        base = ''.join(c for c in (file.filename.rsplit('.', 1)[0][:50] or 'img') if c.isalnum() or c in '-_') or 'img'
        object_key = f"{self.config.key_prefix}wiki/img/{base}_{uuid.uuid4().hex[:8]}.{ext}"
        content_type = file.content_type or self._get_content_type(f'.{ext}')
        try:
            file.seek(0)
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=file.read(),
                ContentType=content_type
            )
            public_url = self.config.get_public_url(object_key)
            current_app.logger.info(f"Uploaded wiki image: {public_url}")
            return public_url
        except Exception as e:
            current_app.logger.error(f"Failed to upload wiki image: {e}")
            return None

    def _generate_object_key(self, clergy_id, image_type, file_extension):
        """Generate a unique object key for the image"""
        unique_id = str(uuid.uuid4())[:8]
        return f"{self._clergy_prefix(clergy_id)}{image_type}_{unique_id}{file_extension}"

    def _clergy_prefix(self, clergy_id):
        return f"{self.config.key_prefix}clergy/{clergy_id}/"
    
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
    
    def create_sprite_sheet(self, clergy_list, images_per_row=20, thumbnail_size=48, hires_size=160):
        """
        Create an optimized sprite sheet from clergy thumbnail images
        
        Args:
            clergy_list: List of Clergy objects with image_data or image_url
            images_per_row (int): Number of thumbnails per row in sprite sheet
            thumbnail_size (int): Size of each thumbnail in pixels
            hires_size (int): Tile size of the high-res sheet the grid swaps in when zoomed;
                same layout as the main sheet, so the mapping works for both
            
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
                image_data = {}
                if clergy.image_data:
                    try:
                        image_data = json.loads(clergy.image_data) or {}
                    except (json.JSONDecodeError, AttributeError):
                        pass
                # Tried in order until one loads (bucket files can go missing; some records only
                # hold base64). Cropped 320px detail first: it feeds both sheets. Original is uncropped, so last.
                sources = [image_data.get(k) for k in ('detail', 'lineage', 'cropped', 'original')] + [clergy.image_url]
                sources = list(dict.fromkeys(u for u in sources if isinstance(u, str) and u))

                if sources:
                    clergy_with_images.append((clergy.id, sources))
                else:
                    clergy_without_images.append(clergy.id)

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

            def load_image(source):
                if source.startswith('data:'):
                    return Image.open(BytesIO(_decode_data_url(source)))
                response = requests.get(source, timeout=10)
                response.raise_for_status()
                return Image.open(BytesIO(response.content))

            for clergy_id, sources in clergy_with_images:
                failures = []
                for source in sources:
                    try:
                        img = load_image(source)
                        if img.mode != 'RGB':
                            img = img.convert('RGB')
                        if img.size != (hires_size, hires_size):  # bounds memory; both sheets resize from here
                            img = img.resize((hires_size, hires_size), Image.Resampling.LANCZOS)
                        successfully_processed_images.append((clergy_id, img))
                        break
                    except Exception as e:
                        failures.append(f"{source[:80]}: {e}")
                else:
                    current_app.logger.warning(f"Failed to process thumbnail for clergy {clergy_id}; tried {failures}")
                    clergy_without_images.append(clergy_id)
                    placeholder_count += 1
                    continue
                if failures:
                    current_app.logger.warning(f"Clergy {clergy_id} sprite used a fallback image; broken: {failures}")

            num_images_in_sprite = len(successfully_processed_images) + 1
            rows = (num_images_in_sprite + images_per_row - 1) // images_per_row
            sprite_width = images_per_row * thumbnail_size
            sprite_height = rows * thumbnail_size

            def tile_sheet(size, placeholder):
                sheet = Image.new('RGB', (images_per_row * size, rows * size), (255, 255, 255))
                sheet.paste(placeholder, (0, 0))
                for idx, (_, img) in enumerate(successfully_processed_images, start=1):
                    tile = img if img.size == (size, size) else img.resize((size, size), Image.Resampling.LANCZOS)
                    sheet.paste(tile, ((idx % images_per_row) * size, (idx // images_per_row) * size))
                return sheet

            def upload_sheet(sheet, object_key, **save_opts):
                output = BytesIO()
                sheet.save(output, 'JPEG', optimize=True, progressive=True, **save_opts)
                data = output.getvalue()
                self.s3_client.put_object(Bucket=self.bucket_name, Key=object_key, Body=data, ContentType='image/jpeg')
                return self.config.get_public_url(object_key), len(data)

            sprite = tile_sheet(thumbnail_size, placeholder_img)
            for idx, (clergy_id, _) in enumerate(successfully_processed_images, start=1):
                position_mapping[clergy_id] = (
                    (idx % images_per_row) * thumbnail_size,
                    (idx // images_per_row) * thumbnail_size,
                )

            for clergy_id in clergy_without_images:
                position_mapping[clergy_id] = placeholder_position

            num_images = len(clergy_list)
            sprite = sprite.filter(ImageFilter.SMOOTH)
            sprite = sprite.convert('P', palette=Image.ADAPTIVE, colors=128)
            sprite = sprite.convert('RGB')
            object_key = f"{self.config.key_prefix}sprites/clergy_sprite_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.jpg"
            # quality 90 / 4:4:4 avoids pixelation at this tiny tile size
            sprite_url, sprite_bytes = upload_sheet(sprite, object_key, quality=90, subsampling='4:4:4')
            num_actual_in_sprite = len(clergy_with_images) - (placeholder_count - len(clergy_without_images))
            current_app.logger.info(f"Created optimized sprite sheet: {sprite_url} ({sprite_bytes} bytes, {num_images_in_sprite} tiles in sprite [{num_actual_in_sprite} images + 1 placeholder], {num_images} total clergy, {placeholder_count} using placeholder)")

            # ponytail: one sheet for everyone; at ~1000 photos it reaches 3200x8000 (heavy decode on phones), split into pages then.
            hires_url = None
            try:
                hires = tile_sheet(hires_size, self._create_placeholder_silhouette(hires_size))
                hires_url, hires_bytes = upload_sheet(hires, object_key.replace('.jpg', f'@{hires_size}.jpg'), quality=82)
                current_app.logger.info(f"Created high-res sprite sheet: {hires_url} ({hires_bytes} bytes)")
            except Exception as e:
                current_app.logger.warning(f"High-res sprite sheet failed; grid stays on the {thumbnail_size}px sheet: {e}")

            from models import SpriteSheet, ClergySpritePosition, db
            SpriteSheet.query.update({SpriteSheet.is_current: False})
            sprite_sheet = SpriteSheet(
                url=sprite_url,
                hires_url=hires_url,
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
            self.prune_sprite_sheets()
            
            return {
                'success': True,
                'url': sprite_url,
                'hires_url': hires_url,
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

    def prune_sprite_sheets(self, keep=2):
        """Drop all but the newest `keep` sheets (rows, positions, bucket files); open pages may still use the previous one."""
        from models import SpriteSheet, ClergySpritePosition, db
        try:
            stale = SpriteSheet.query.order_by(SpriteSheet.id.desc()).offset(keep).all()
            if not stale:
                return
            ids = [sheet.id for sheet in stale]
            # Only our own prefix: a dev DB holds prod's sheet rows, but must not delete prod's files.
            keys = [key for sheet in stale for key in map(self.config.get_object_key, (sheet.url, sheet.hires_url))
                    if key and key.startswith(f"{self.config.key_prefix}sprites/")]
            ClergySpritePosition.query.filter(ClergySpritePosition.sprite_sheet_id.in_(ids)).delete(synchronize_session=False)
            SpriteSheet.query.filter(SpriteSheet.id.in_(ids)).delete(synchronize_session=False)
            db.session.commit()
            for i in range(0, len(keys), 1000):  # DeleteObjects takes at most 1000 keys
                self.s3_client.delete_objects(Bucket=self.bucket_name, Delete={'Objects': [{'Key': k} for k in keys[i:i + 1000]], 'Quiet': True})
            current_app.logger.info(f"Pruned {len(ids)} old sprite sheet(s), {len(keys)} file(s)")
        except Exception as e:
            db.session.rollback()
            current_app.logger.warning(f"Old sprite sheet cleanup failed (harmless, retried next build): {e}")


def _decode_data_url(data):
    """Bytes from a base64 data URL (or bare base64)."""
    return base64.b64decode(data.split(',', 1)[1] if data.startswith('data:') else data)


# Global instance
image_upload_service = None


def get_image_upload_service():
    """Get the global image upload service instance"""
    global image_upload_service
    if image_upload_service is None:
        image_upload_service = ImageUploadService()
    return image_upload_service
