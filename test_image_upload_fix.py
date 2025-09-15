#!/usr/bin/env python3
"""
Test script to verify image upload fixes
"""

import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

def test_image_upload_flow():
    """Test the complete image upload flow from lineage visualization"""
    
    # Set up Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in headless mode
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    driver = None
    try:
        # Initialize the driver
        driver = webdriver.Chrome(options=chrome_options)
        driver.set_window_size(1920, 1080)
        
        # Navigate to the lineage visualization page
        print("Navigating to lineage visualization...")
        driver.get("http://localhost:5000/lineage")
        
        # Wait for the page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "graph-container"))
        )
        
        print("Page loaded successfully")
        
        # Look for a clergy node to click (assuming there are some clergy members)
        try:
            # Wait for nodes to be rendered
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".node"))
            )
            
            # Find the first clergy node
            clergy_node = driver.find_element(By.CSS_SELECTOR, ".node")
            print("Found clergy node, clicking...")
            clergy_node.click()
            
            # Wait for the aside panel to appear
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.ID, "clergy-aside"))
            )
            
            # Look for the edit button
            edit_button = driver.find_element(By.ID, "edit-clergy-btn")
            print("Found edit button, clicking...")
            edit_button.click()
            
            # Wait for the modal to appear
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.ID, "clergyFormModal"))
            )
            
            print("Edit modal opened successfully")
            
            # Look for the image upload button
            upload_button = driver.find_element(By.ID, "uploadBtn")
            print("Found upload button")
            
            # Test clicking the upload button (this should trigger file dialog)
            upload_button.click()
            print("Upload button clicked - this should open file dialog once")
            
            # Wait a moment to see if there are any console errors
            time.sleep(2)
            
            # Check for any JavaScript errors in the console
            logs = driver.get_log('browser')
            errors = [log for log in logs if log['level'] == 'SEVERE']
            
            if errors:
                print("JavaScript errors found:")
                for error in errors:
                    print(f"  - {error['message']}")
            else:
                print("No JavaScript errors found")
            
            print("Test completed successfully!")
            
        except Exception as e:
            print(f"Error during test: {e}")
            return False
            
    except Exception as e:
        print(f"Failed to initialize driver: {e}")
        return False
    finally:
        if driver:
            driver.quit()
    
    return True

if __name__ == "__main__":
    print("Testing image upload flow fixes...")
    success = test_image_upload_flow()
    
    if success:
        print("✅ Test completed successfully!")
        sys.exit(0)
    else:
        print("❌ Test failed!")
        sys.exit(1)
