#!/usr/bin/env python3
"""
Web scraper to find additional ecclesiastical lineage data
"""

import requests
from bs4 import BeautifulSoup
import json
import time
from urllib.parse import urljoin, urlparse
import re
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LineageDataScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.found_relationships = []
        
    def scrape_catholicdata_org(self):
        """Scrape CatholicData.org for bishop information"""
        logger.info("Scraping CatholicData.org...")
        
        try:
            # Try to access their data endpoints
            base_url = "https://catholicdata.org"
            
            # Check if they have API endpoints
            api_endpoints = [
                "/api/people.json",
                "/api/bishops.json", 
                "/api/lineage.json",
                "/data/people.json",
                "/data/bishops.json"
            ]
            
            for endpoint in api_endpoints:
                try:
                    url = urljoin(base_url, endpoint)
                    response = self.session.get(url, timeout=10)
                    if response.status_code == 200:
                        logger.info(f"Found API endpoint: {url}")
                        data = response.json()
                        self.process_catholicdata_api(data, endpoint)
                        return
                except Exception as e:
                    logger.debug(f"Endpoint {endpoint} not available: {e}")
                    continue
            
            # If no API, try scraping the main site
            response = self.session.get(base_url, timeout=10)
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                self.process_catholicdata_html(soup)
                
        except Exception as e:
            logger.error(f"Error scraping CatholicData.org: {e}")
    
    def process_catholicdata_api(self, data, endpoint):
        """Process API data from CatholicData"""
        logger.info(f"Processing API data from {endpoint}")
        
        if isinstance(data, list):
            for item in data:
                self.extract_relationships_from_record(item)
        elif isinstance(data, dict):
            self.extract_relationships_from_record(data)
    
    def process_catholicdata_html(self, soup):
        """Process HTML content from CatholicData"""
        logger.info("Processing HTML content from CatholicData")
        
        # Look for bishop information in various formats
        bishop_links = soup.find_all('a', href=re.compile(r'bishop|episcopal|consecration'))
        
        for link in bishop_links:
            try:
                bishop_url = urljoin("https://catholicdata.org", link['href'])
                self.scrape_bishop_page(bishop_url)
                time.sleep(1)  # Be respectful
            except Exception as e:
                logger.debug(f"Error processing bishop link: {e}")
    
    def scrape_bishop_page(self, url):
        """Scrape individual bishop page for lineage information"""
        try:
            response = self.session.get(url, timeout=10)
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for consecration/ordination information
                text_content = soup.get_text().lower()
                
                # Common patterns for lineage information
                patterns = [
                    r'consecrated by (.+?) on (.+?)',
                    r'ordained by (.+?) on (.+?)',
                    r'consecrator: (.+?)',
                    r'ordaining bishop: (.+?)',
                    r'principal consecrator: (.+?)'
                ]
                
                for pattern in patterns:
                    matches = re.finditer(pattern, text_content, re.IGNORECASE)
                    for match in matches:
                        self.found_relationships.append({
                            'source_url': url,
                            'relationship_type': 'consecration' if 'consecrat' in match.group(0) else 'ordination',
                            'details': match.group(0),
                            'extracted_at': datetime.now().isoformat()
                        })
                        
        except Exception as e:
            logger.debug(f"Error scraping bishop page {url}: {e}")
    
    def scrape_apostolic_succession_blog(self):
        """Scrape the apostolic succession blog"""
        logger.info("Scraping Apostolic Succession blog...")
        
        try:
            base_url = "https://apostolicsuccession-episcopallineages.blogspot.com"
            response = self.session.get(base_url, timeout=10)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for lineage information
                posts = soup.find_all('div', class_='post-body')
                
                for post in posts:
                    text_content = post.get_text()
                    
                    # Look for bishop lineage patterns
                    lineage_patterns = [
                        r'(.+?) consecrated (.+?) on (.+?)',
                        r'(.+?) ordained (.+?) on (.+?)',
                        r'Episcopal lineage of (.+?)',
                        r'Lineage: (.+?)'
                    ]
                    
                    for pattern in lineage_patterns:
                        matches = re.finditer(pattern, text_content, re.IGNORECASE | re.MULTILINE)
                        for match in matches:
                            self.found_relationships.append({
                                'source_url': base_url,
                                'relationship_type': 'lineage_info',
                                'details': match.group(0),
                                'extracted_at': datetime.now().isoformat()
                            })
                            
        except Exception as e:
            logger.error(f"Error scraping apostolic succession blog: {e}")
    
    def extract_relationships_from_record(self, record):
        """Extract relationship information from a data record"""
        if not isinstance(record, dict):
            return
            
        # Look for common field names that might contain lineage info
        lineage_fields = ['consecrator', 'ordaining_bishop', 'principal_consecrator', 
                         'episcopal_lineage', 'consecration', 'ordination']
        
        for field in lineage_fields:
            if field in record:
                self.found_relationships.append({
                    'source_field': field,
                    'relationship_type': 'consecration' if 'consecrat' in field else 'ordination',
                    'details': record[field],
                    'extracted_at': datetime.now().isoformat()
                })
    
    def save_results(self, filename='scraped_lineage_data.json'):
        """Save scraped results to file"""
        with open(filename, 'w') as f:
            json.dump(self.found_relationships, f, indent=2)
        
        logger.info(f"Saved {len(self.found_relationships)} relationships to {filename}")
    
    def run_scraping(self):
        """Run all scraping methods"""
        logger.info("Starting lineage data scraping...")
        
        # Scrape different sources
        self.scrape_catholicdata_org()
        self.scrape_apostolic_succession_blog()
        
        # Save results
        self.save_results()
        
        logger.info(f"Scraping completed. Found {len(self.found_relationships)} potential relationships.")
        
        return self.found_relationships

if __name__ == "__main__":
    scraper = LineageDataScraper()
    results = scraper.run_scraping()
    
    print(f"\nScraping Results:")
    print(f"Found {len(results)} potential relationships")
    
    # Show sample results
    for i, result in enumerate(results[:5]):
        print(f"\n{i+1}. {result['relationship_type']}: {result['details'][:100]}...")
