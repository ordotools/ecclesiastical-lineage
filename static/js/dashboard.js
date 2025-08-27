// Handle logout redirect
document.body.addEventListener('htmx:afterRequest', function(evt) {
    if (evt.detail.xhr.status === 200) {
        const response = evt.detail.xhr.responseText;
        if (response.includes('logout')) {
            const redirectDiv = evt.detail.target.querySelector('#redirect');
            if (redirectDiv) {
                const url = redirectDiv.getAttribute('data-url');
                setTimeout(function() {
                    window.location.href = url;
                }, 1000);
            }
        }
    }
});
