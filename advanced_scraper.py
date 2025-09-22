#!/usr/bin/env python3
"""
Advanced scraper to extract data from the ecclesiastical lineage site
"""
import requests
import json
import re
import time
from datetime import datetime
from bs4 import BeautifulSoup

def scrape_with_selenium_approach():
    """Try to get data by examining the page more carefully"""
    base_url = "https://ecclesiastical-lineage.onrender.com"
    
    print("Attempting advanced data extraction...")
    
    # Get the main page
    try:
        response = requests.get(f"{base_url}/lineage_visualization", timeout=30)
        if response.status_code != 200:
            print(f"Failed to get main page: {response.status_code}")
            return {}
        
        print("✓ Got main visualization page")
        content = response.text
        
        # Look for any JavaScript that might contain data
        print("Searching for embedded data in JavaScript...")
        
        # Common patterns for embedded data
        patterns = [
            r'var\s+(\w+Data)\s*=\s*(\[.*?\]);',
            r'const\s+(\w+Data)\s*=\s*(\[.*?\]);',
            r'let\s+(\w+Data)\s*=\s*(\[.*?\]);',
            r'window\.(\w+Data)\s*=\s*(\[.*?\]);',
            r'data:\s*(\[.*?\])',
            r'clergy:\s*(\[.*?\])',
            r'ranks:\s*(\[.*?\])',
            r'organizations:\s*(\[.*?\])'
        ]
        
        found_data = {}
        
        for pattern in patterns:
            matches = re.findall(pattern, content, re.DOTALL)
            for match in matches:
                if isinstance(match, tuple):
                    key, value = match
                    try:
                        # Try to parse as JSON
                        parsed = json.loads(value)
                        found_data[key] = parsed
                        print(f"✓ Found {key}: {len(parsed) if isinstance(parsed, list) else 'object'}")
                    except:
                        print(f"Found {key} but couldn't parse as JSON")
                else:
                    try:
                        parsed = json.loads(match)
                        found_data[f"data_{len(found_data)}"] = parsed
                        print(f"✓ Found data: {len(parsed) if isinstance(parsed, list) else 'object'}")
                    except:
                        pass
        
        # Look for script tags that might contain data
        soup = BeautifulSoup(content, 'html.parser')
        scripts = soup.find_all('script')
        
        print(f"Found {len(scripts)} script tags")
        
        for i, script in enumerate(scripts):
            if script.string:
                script_content = script.string
                # Look for JSON-like structures
                json_matches = re.findall(r'\{[^{}]*"[^"]*"[^{}]*\}', script_content)
                for match in json_matches:
                    try:
                        parsed = json.loads(match)
                        if isinstance(parsed, dict) and len(parsed) > 1:
                            found_data[f"script_{i}_data"] = parsed
                            print(f"✓ Found data in script {i}")
                    except:
                        pass
        
        return found_data
        
    except Exception as e:
        print(f"Error in advanced scraping: {str(e)}")
        return {}

def try_direct_database_approach():
    """Try to find database dumps or export endpoints"""
    base_url = "https://ecclesiastical-lineage.onrender.com"
    
    # Common export/dump endpoints
    export_endpoints = [
        "/export",
        "/dump",
        "/backup",
        "/data/export",
        "/api/export",
        "/api/dump",
        "/api/backup",
        "/admin/export",
        "/admin/dump",
        "/download",
        "/api/download"
    ]
    
    print("Trying export/dump endpoints...")
    
    for endpoint in export_endpoints:
        try:
            url = base_url + endpoint
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'json' in content_type or 'application' in content_type:
                    try:
                        data = response.json()
                        print(f"✓ Found data at {endpoint}")
                        return data
                    except:
                        pass
                elif 'text' in content_type:
                    print(f"✓ Found text data at {endpoint}")
                    return {"raw_data": response.text}
        except:
            pass
    
    return {}

def main():
    print("Advanced Ecclesiastical Lineage Data Scraper")
    print("=" * 50)
    
    # Try different approaches
    approaches = [
        ("Selenium-style HTML parsing", scrape_with_selenium_approach),
        ("Direct database export", try_direct_database_approach)
    ]
    
    all_data = {
        "scraped_at": datetime.utcnow().isoformat(),
        "source_url": "https://ecclesiastical-lineage.onrender.com",
        "approaches": {}
    }
    
    for approach_name, approach_func in approaches:
        print(f"\n--- {approach_name} ---")
        data = approach_func()
        if data:
            all_data["approaches"][approach_name] = data
            print(f"✓ {approach_name} found data")
        else:
            print(f"✗ {approach_name} found no data")
    
    # Save results
    filename = "advanced_scraped_data.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n✓ Results saved to {filename}")
    
    # Summary
    total_items = 0
    for approach, data in all_data["approaches"].items():
        if isinstance(data, dict):
            items = sum(len(v) if isinstance(v, (list, dict)) else 1 for v in data.values())
            total_items += items
            print(f"{approach}: {items} items")
    
    print(f"Total data items found: {total_items}")

if __name__ == "__main__":
    main()
