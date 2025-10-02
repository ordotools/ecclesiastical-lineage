"""
Geocoding Service
Provides coordinate lookup from addresses using OpenCage API
"""

import requests
import os
from typing import Dict, Optional, Tuple
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

class GeocodingService:
    def __init__(self):
        # Load environment variables if not already loaded
        load_dotenv()
        self.api_key = os.getenv('OPENCAGE_API_KEY')
        self.base_url = 'https://api.opencagedata.com/geocode/v1/json'
        
    def geocode_address(self, address: str) -> Optional[Dict]:
        """
        Get coordinates for an address
        
        Args:
            address (str): The address to geocode
            
        Returns:
            Optional[Dict]: Dictionary with lat, lng, and formatted_address, or None if failed
        """
        if not self.api_key:
            logger.warning("OpenCage API key not configured")
            return None
            
        if not address or not address.strip():
            return None
            
        try:
            params = {
                'q': address.strip(),
                'key': self.api_key,
                'limit': 1,
                'no_annotations': 1
            }
            
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('results') and len(data['results']) > 0:
                result = data['results'][0]
                geometry = result.get('geometry', {})
                components = result.get('components', {})
                
                return {
                    'latitude': geometry.get('lat'),
                    'longitude': geometry.get('lng'),
                    'formatted_address': result.get('formatted'),
                    'city': components.get('city') or components.get('town') or components.get('village'),
                    'state': components.get('state'),
                    'country': components.get('country'),
                    'postcode': components.get('postcode'),
                    'confidence': result.get('confidence', 0)
                }
            else:
                logger.warning(f"No results found for address: {address}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Geocoding API request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Geocoding failed: {e}")
            return None
    
    def reverse_geocode(self, latitude: float, longitude: float) -> Optional[Dict]:
        """
        Get address from coordinates
        
        Args:
            latitude (float): Latitude coordinate
            longitude (float): Longitude coordinate
            
        Returns:
            Optional[Dict]: Dictionary with formatted address and components, or None if failed
        """
        if not self.api_key:
            logger.warning("OpenCage API key not configured")
            return None
            
        try:
            params = {
                'q': f"{latitude},{longitude}",
                'key': self.api_key,
                'limit': 1,
                'no_annotations': 1
            }
            
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('results') and len(data['results']) > 0:
                result = data['results'][0]
                components = result.get('components', {})
                
                return {
                    'formatted_address': result.get('formatted'),
                    'city': components.get('city') or components.get('town') or components.get('village'),
                    'state': components.get('state'),
                    'country': components.get('country'),
                    'postcode': components.get('postcode'),
                    'confidence': result.get('confidence', 0)
                }
            else:
                logger.warning(f"No results found for coordinates: {latitude}, {longitude}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Reverse geocoding API request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Reverse geocoding failed: {e}")
            return None
    
    def is_configured(self) -> bool:
        """Check if the geocoding service is properly configured"""
        return bool(self.api_key)

# Global instance
geocoding_service = GeocodingService()
