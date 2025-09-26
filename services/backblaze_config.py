"""
Backblaze B2 Cloud Storage Configuration Service

This service handles configuration and connection to Backblaze B2 Cloud Storage
using the S3-compatible API through boto3.
"""

import os
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from flask import current_app


class BackblazeConfig:
    """Configuration and connection management for Backblaze B2"""
    
    def __init__(self):
        self.bucket_name = os.getenv('BACKBLAZE_BUCKET_NAME')
        self.endpoint_url = os.getenv('BACKBLAZE_ENDPOINT_URL')
        self.access_key_id = os.getenv('BACKBLAZE_ACCESS_KEY_ID')
        self.secret_access_key = os.getenv('BACKBLAZE_SECRET_ACCESS_KEY')
        self.region_name = os.getenv('BACKBLAZE_REGION', 'us-west-004')
        
        # Validate required configuration
        self._validate_config()
        
        # Initialize S3 client
        self.s3_client = self._create_s3_client()
    
    def _validate_config(self):
        """Validate that all required configuration is present"""
        required_vars = [
            'BACKBLAZE_BUCKET_NAME',
            'BACKBLAZE_ENDPOINT_URL', 
            'BACKBLAZE_ACCESS_KEY_ID',
            'BACKBLAZE_SECRET_ACCESS_KEY'
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            raise ValueError(f"Missing required Backblaze B2 environment variables: {', '.join(missing_vars)}")
    
    def _create_s3_client(self):
        """Create and configure the S3 client for Backblaze B2"""
        try:
            client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                region_name=self.region_name
            )
            
            # Test the connection
            client.head_bucket(Bucket=self.bucket_name)
            current_app.logger.info(f"Successfully connected to Backblaze B2 bucket: {self.bucket_name}")
            
            return client
            
        except NoCredentialsError:
            current_app.logger.error("Backblaze B2 credentials not found")
            raise
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                current_app.logger.error(f"Backblaze B2 bucket '{self.bucket_name}' not found")
            elif error_code == '403':
                current_app.logger.error("Backblaze B2 access denied - check credentials and permissions")
            else:
                current_app.logger.error(f"Backblaze B2 error: {e}")
            raise
        except Exception as e:
            current_app.logger.error(f"Failed to connect to Backblaze B2: {e}")
            raise
    
    def get_bucket_name(self):
        """Get the configured bucket name"""
        return self.bucket_name
    
    def get_endpoint_url(self):
        """Get the configured endpoint URL"""
        return self.endpoint_url
    
    def get_public_url(self, object_key):
        """Generate a public URL for an object in the bucket"""
        if not object_key:
            return None
        
        # Backblaze B2 public URL format: https://<bucket-name>.<endpoint>/<object-key>
        endpoint_domain = self.endpoint_url.replace('https://', '').replace('http://', '')
        return f"https://{self.bucket_name}.{endpoint_domain}/{object_key}"
    
    def is_configured(self):
        """Check if Backblaze B2 is properly configured"""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            return True
        except:
            return False


# Global instance
backblaze_config = None


def get_backblaze_config():
    """Get the global Backblaze B2 configuration instance"""
    global backblaze_config
    if backblaze_config is None:
        backblaze_config = BackblazeConfig()
    return backblaze_config


def init_backblaze_config():
    """Initialize Backblaze B2 configuration (call this in app startup)"""
    try:
        global backblaze_config
        backblaze_config = BackblazeConfig()
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to initialize Backblaze B2: {e}")
        return False
