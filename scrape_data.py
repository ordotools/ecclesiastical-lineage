#!/usr/bin/env python3
"""
Script to scrape data from the live ecclesiastical lineage site
"""
import requests
import json
import time
from datetime import datetime

def scrape_lineage_data():
    """Scrape all clergy data from the live site"""
    base_url = "https://ecclesiastical-lineage.onrender.com"
    
    # First, let's try to get the API endpoints
    api_endpoints = [
        "/api/clergy",
        "/api/ranks", 
        "/api/organizations",
        "/api/lineage_data",
        "/api/lineage_visualization_data"
    ]
    
    scraped_data = {
        "clergy": [],
        "ranks": [],
        "organizations": [],
        "lineage_data": {},
        "scraped_at": datetime.utcnow().isoformat(),
        "source_url": base_url
    }
    
    print("Starting data scraping from live site...")
    
    for endpoint in api_endpoints:
        url = base_url + endpoint
        print(f"Trying endpoint: {url}")
        
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                data = response.json()
                endpoint_name = endpoint.split('/')[-1]
                scraped_data[endpoint_name] = data
                print(f"✓ Successfully scraped {endpoint_name}: {len(data) if isinstance(data, list) else 'object'}")
            else:
                print(f"✗ Failed to get {endpoint}: {response.status_code}")
        except Exception as e:
            print(f"✗ Error scraping {endpoint}: {str(e)}")
        
        time.sleep(1)  # Be respectful to the server
    
    # Try alternative approaches
    print("\nTrying alternative data extraction methods...")
    
    # Try to get the main page and extract any embedded data
    try:
        main_response = requests.get(f"{base_url}/lineage_visualization", timeout=30)
        if main_response.status_code == 200:
            print("✓ Got main visualization page")
            # Look for any embedded JSON data in the HTML
            content = main_response.text
            if 'clergy' in content.lower() or 'lineage' in content.lower():
                print("✓ Found potential data in HTML content")
        else:
            print(f"✗ Failed to get main page: {main_response.status_code}")
    except Exception as e:
        print(f"✗ Error getting main page: {str(e)}")
    
    return scraped_data

def save_scraped_data(data, filename="scraped_data.json"):
    """Save scraped data to a JSON file"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    print(f"✓ Data saved to {filename}")

if __name__ == "__main__":
    print("Ecclesiastical Lineage Data Scraper")
    print("=" * 40)
    
    data = scrape_lineage_data()
    save_scraped_data(data)
    
    print(f"\nScraping complete!")
    print(f"Total data points scraped:")
    for key, value in data.items():
        if isinstance(value, list):
            print(f"  {key}: {len(value)} items")
        elif isinstance(value, dict):
            print(f"  {key}: {len(value)} keys")
        else:
            print(f"  {key}: {type(value).__name__}")
