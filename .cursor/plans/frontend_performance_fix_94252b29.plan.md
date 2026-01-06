---
name: Frontend Performance Fix
overview: Add HTTP compression, defer non-critical JS, and configure caching headers to address the slow server response and render-blocking resources.
todos:
  - id: add-compress
    content: Add Flask-Compress to requirements.txt and initialize in app.py
    status: completed
  - id: defer-scripts
    content: Add defer attribute to non-critical scripts in editor.html and base.html
    status: completed
  - id: cache-headers
    content: Add Cache-Control headers for static files in app.py
    status: completed
---

# Frontend Performance Optimization

## Issues Found

1. **No text compression** - Flask-Compress not installed
2. **Render-blocking JS** - Scripts in `<head>` without `defer` attribute in [`templates/editor.html`](templates/editor.html)
3. **No static file caching** - Missing Cache-Control headers

## Changes

### 1. Add Flask-Compress for gzip compression

Add to [`requirements.txt`](requirements.txt):
```
Flask-Compress==1.14
```

Add to [`app.py`](app.py):
```python
from flask_compress import Compress
compress = Compress()
compress.init_app(app)
```

### 2. Defer non-critical JS in editor.html

Add `defer` to scripts in [`templates/editor.html`](templates/editor.html) lines 15-27:

```html
<script src="https://unpkg.com/htmx.org@1.9.6" defer></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" defer></script>
<!-- etc for other scripts -->
```

Keep module scripts and inline scripts as-is (they're deferred by default or needed immediately).

### 3. Add static file caching headers

Add to [`app.py`](app.py):
```python
@app.after_request
def add_cache_headers(response):
    if request.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'public, max-age=31536000'
    return response
```

## Expected Impact

- **Text compression**: ~70% reduction in transfer size for CSS/JS/HTML
- **Deferred scripts**: Initial render no longer blocked by JS parsing
- **Caching**: Repeat visits load static assets from cache