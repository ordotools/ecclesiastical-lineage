/**
 * Clergy Form Submission Handler
 * Handles form submission with automatic bishop creation for missing ordainers, consecrators, and co-consecrators
 */

// Global functions for form submission
window.collectBishopNames = function(form) {
    const bishopNames = new Set();
    
    console.log('Collecting bishop names...');
    
    // Collect ordaining bishops
    const ordainingBishopInputs = form.querySelectorAll('input[name*="ordaining_bishop_input"]');
    console.log('Found ordaining bishop inputs:', ordainingBishopInputs.length);
    ordainingBishopInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="ordaining_bishop_id"]');
        const id = idInput ? idInput.value : '';
        console.log(`Ordaining bishop: "${name}", ID: "${id}"`);
        if (name && !id) {
            bishopNames.add(name);
            console.log(`Added to bishop names: "${name}"`);
        }
    });
    
    // Collect consecrators
    const consecratorInputs = form.querySelectorAll('input[name*="consecrator_input"]');
    console.log('Found consecrator inputs:', consecratorInputs.length);
    consecratorInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="consecrator_id"]');
        const id = idInput ? idInput.value : '';
        console.log(`Consecrator: "${name}", ID: "${id}"`);
        if (name && !id) {
            bishopNames.add(name);
            console.log(`Added to bishop names: "${name}"`);
        }
    });
    
    // Collect co-consecrators
    const coConsecratorInputs = form.querySelectorAll('input[name*="co_consecrators"][name*="input"]');
    console.log('Found co-consecrator inputs:', coConsecratorInputs.length);
    coConsecratorInputs.forEach(input => {
        const name = input.value.trim();
        const idInput = input.parentElement.querySelector('input[name*="id"]');
        const id = idInput ? idInput.value : '';
        console.log(`Co-consecrator: "${name}", ID: "${id}"`);
        if (name && !id) {
            bishopNames.add(name);
            console.log(`Added to bishop names: "${name}"`);
        }
    });
    
    const result = Array.from(bishopNames);
    console.log('Final bishop names to check:', result);
    return result;
};

window.checkAndCreateBishops = function(bishopNames) {
        return new Promise((resolve, reject) => {
            // Send AJAX request to check and create bishops
            fetch('/api/check-and-create-bishops', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    bishop_names: bishopNames
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update form with the created bishop IDs
                    updateFormWithBishopIds(data.bishop_mapping);
                    resolve();
                } else {
                    reject(new Error(data.message || 'Failed to create bishops'));
                }
            })
            .catch(error => {
                reject(error);
            });
        });
};

window.updateFormWithBishopIds = function(bishopMapping) {
    const form = document.getElementById('clergyForm');
    if (!form) return;
    
    // Update ordaining bishops
    const ordainingBishopInputs = form.querySelectorAll('input[name*="ordaining_bishop_input"]');
        ordainingBishopInputs.forEach(input => {
            const name = input.value.trim();
            if (bishopMapping[name]) {
                const idInput = input.parentElement.querySelector('input[name*="ordaining_bishop_id"]');
                idInput.value = bishopMapping[name];
            }
        });
        
        // Update consecrators
        const consecratorInputs = form.querySelectorAll('input[name*="consecrator_input"]');
        consecratorInputs.forEach(input => {
            const name = input.value.trim();
            if (bishopMapping[name]) {
                const idInput = input.parentElement.querySelector('input[name*="consecrator_id"]');
                idInput.value = bishopMapping[name];
            }
        });
        
        // Update co-consecrators
        const coConsecratorInputs = form.querySelectorAll('input[name*="co_consecrators"][name*="input"]');
        coConsecratorInputs.forEach(input => {
            const name = input.value.trim();
            if (bishopMapping[name]) {
                const idInput = input.parentElement.querySelector('input[name*="id"]');
                idInput.value = bishopMapping[name];
            }
        });
};

window.submitForm = function() {
    const form = document.getElementById('clergyForm');
    if (!form) return;
    
    // Create FormData from the form
    const formData = new FormData(form);
    
    // Check for globally stored dropped file
    if (window.droppedFile) {
        console.log('Adding globally stored file to FormData:', window.droppedFile);
        formData.append('clergy_image', window.droppedFile);
        // Clear the global file after adding to form data
        delete window.droppedFile;
    }
        
        // Submit the form
        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            if (response.ok) {
                return response.json();
            } else {
                throw new Error(`Form submission failed with status ${response.status}`);
            }
        })
        .then(data => {
            console.log('Response data:', data);
            if (data.success) {
                // Show success message
                alert(data.message || 'Clergy record created successfully!');
                // Redirect to success page
                window.location.href = data.redirect || '/';
            } else {
                throw new Error(data.message || 'Form submission failed');
            }
        })
        .catch(error => {
            console.error('Form submission error:', error);
            alert('Error submitting form: ' + error.message);
            resetSubmitButton(form.querySelector('button[type="submit"]'), 'Save Clergy Record');
        });
};

window.resetSubmitButton = function(button, originalText) {
    button.textContent = originalText;
    button.disabled = false;
};

// Initialize form submission handler when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('clergyForm');
    if (!form) return;

    // Override form submission to handle bishop creation
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;

        // Collect all bishop names that need to be checked
        const bishopNames = window.collectBishopNames(form);
        
        if (bishopNames.length > 0) {
            // Check and create missing bishops
            window.checkAndCreateBishops(bishopNames)
                .then(() => {
                    // Submit the form after bishops are created
                    window.submitForm();
                })
                .catch(error => {
                    console.error('Error creating bishops:', error);
                    alert('Error creating missing bishops: ' + error.message);
                    window.resetSubmitButton(submitBtn, originalText);
                });
        } else {
            // No bishops to check, submit directly
            window.submitForm();
        }
    });
});
