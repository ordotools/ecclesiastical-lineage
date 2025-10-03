/**
 * Geocoding Frontend Service
 * Provides client-side geocoding functionality
 */

class GeocodingService {
    constructor() {
        this.isConfigured = false;
        this.checkStatus();
    }
    
    async checkStatus() {
        try {
            const response = await fetch('/api/geocoding-status');
            const data = await response.json();
            this.isConfigured = data.configured;
            console.log('Geocoding service status:', data);
        } catch (error) {
            console.warn('Could not check geocoding status:', error);
            this.isConfigured = false;
        }
    }
    
    async geocodeAddress(address) {
        if (!this.isConfigured) {
            throw new Error('Geocoding service not configured');
        }
        
        try {
            const response = await fetch('/api/geocode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: address })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Geocoding failed');
            }
            
            return data;
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    }
    
    async reverseGeocode(latitude, longitude) {
        if (!this.isConfigured) {
            throw new Error('Geocoding service not configured');
        }
        
        try {
            const response = await fetch('/api/reverse-geocode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    latitude: parseFloat(latitude), 
                    longitude: parseFloat(longitude) 
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Reverse geocoding failed');
            }
            
            return data;
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            throw error;
        }
    }
    
    // Helper method to add geocoding button to address inputs
    addGeocodingButton(inputElement, latInput, lngInput) {
        if (!this.isConfigured) {
            return; // Don't add button if service not configured
        }
        
        // Create geocoding button
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-primary btn-sm geocoding-btn';
        button.innerHTML = '<i class="fas fa-map-marker-alt me-1"></i>Get Coordinates';
        button.style.marginLeft = '8px';
        
        // Add click handler
        button.addEventListener('click', async () => {
            const address = inputElement.value.trim();
            if (!address) {
                alert('Please enter an address first');
                return;
            }
            
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Getting coordinates...';
            
            try {
                const result = await this.geocodeAddress(address);
                
                // Fill in the coordinate fields
                if (latInput) latInput.value = result.latitude;
                if (lngInput) lngInput.value = result.longitude;
                
                // Show success message
                this.showNotification('Coordinates found successfully!', 'success');
                
            } catch (error) {
                this.showNotification(`Geocoding failed: ${error.message}`, 'error');
            } finally {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-map-marker-alt me-1"></i>Get Coordinates';
            }
        });
        
        // Insert button after the input
        inputElement.parentNode.insertBefore(button, inputElement.nextSibling);
    }
    
    // Helper method to add reverse geocoding button to coordinate inputs
    addReverseGeocodingButton(latInput, lngInput, addressInput) {
        if (!this.isConfigured) {
            return; // Don't add button if service not configured
        }
        
        // Create reverse geocoding button
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-secondary btn-sm reverse-geocoding-btn';
        button.innerHTML = '<i class="fas fa-search me-1"></i>Get Address';
        button.style.marginLeft = '8px';
        
        // Add click handler
        button.addEventListener('click', async () => {
            const lat = latInput.value.trim();
            const lng = lngInput.value.trim();
            
            if (!lat || !lng) {
                alert('Please enter both latitude and longitude');
                return;
            }
            
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Getting address...';
            
            try {
                const result = await this.reverseGeocode(lat, lng);
                
                // Fill in the address field
                if (addressInput) addressInput.value = result.formatted_address;
                
                // Show success message
                this.showNotification('Address found successfully!', 'success');
                
            } catch (error) {
                this.showNotification(`Reverse geocoding failed: ${error.message}`, 'error');
            } finally {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-search me-1"></i>Get Address';
            }
        });
        
        // Insert button after the longitude input
        lngInput.parentNode.insertBefore(button, lngInput.nextSibling);
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.style.minWidth = '300px';
        
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    // Initialize geocoding for all address forms on the page
    initializeGeocoding() {
        if (!this.isConfigured) {
            console.log('Geocoding service not configured, skipping initialization');
            return;
        }
        
        // Find all address input fields and add geocoding buttons
        const addressInputs = document.querySelectorAll('input[name="address"], input[id*="address"], input[placeholder*="address"]');
        
        addressInputs.forEach(addressInput => {
            // Find corresponding latitude and longitude inputs
            const form = addressInput.closest('form');
            if (!form) return;
            
            const latInput = form.querySelector('input[name="latitude"], input[id*="latitude"]');
            const lngInput = form.querySelector('input[name="longitude"], input[id*="longitude"]');
            
            if (latInput && lngInput) {
                this.addGeocodingButton(addressInput, latInput, lngInput);
                this.addReverseGeocodingButton(latInput, lngInput, addressInput);
            }
        });
    }
}

// Global instance
window.geocodingService = new GeocodingService();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the service to check its status
    setTimeout(() => {
        window.geocodingService.initializeGeocoding();
    }, 1000);
});
