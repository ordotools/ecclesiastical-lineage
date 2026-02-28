#!/usr/bin/env python3
"""
Behavior verification: Requested Articles panel (logged-in editor).

Run from project root: python -m tests.wiki_request_panel_verification

Verifies:
- GET /api/wiki/requests returns 401 when not logged in.
- When logged in: GET /api/wiki/requests returns 200 and a JSON list.
- When logged in: POST /api/wiki/requests/mark-handled removes the request from the list.
- Wiki page HTML for logged-in user includes sidebar request section; for logged-out user it does not.
"""
import os
import sys

# Run from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    from app import app
    from models import User, db

    failures = []

    user = None
    with app.app_context():
        user = User.query.filter_by(username='admin').first()
        if not user:
            failures.append("No admin user in DB (run app once to create default admin)")

    with app.test_client() as client:
        # --- 1. Unauthenticated: GET /api/wiki/requests returns 401 ---
        r = client.get('/api/wiki/requests')
        # --- 2. Wiki HTML without session: no request sidebar ---
        r_wiki = client.get('/wiki')
        if r_wiki.status_code != 200:
            failures.append(f"GET /wiki: expected 200, got {r_wiki.status_code}")
        else:
            html = r_wiki.data.decode('utf-8')
            if 'wiki-request-sidebar' in html:
                failures.append("GET /wiki without session should not render wiki-request-sidebar")
            else:
                print("OK: Wiki page without session does not include Requested Articles sidebar")

        if r.status_code != 401:
            failures.append(f"GET /api/wiki/requests without auth: expected 401, got {r.status_code}")
        else:
            print("OK: GET /api/wiki/requests returns 401 when not logged in")

        # --- 2. Logged-in: GET returns 200 and JSON array ---
        if not failures and user:
            with client.session_transaction() as sess:
                sess['user_id'] = user.id
            r = client.get('/api/wiki/requests')
            if r.status_code != 200:
                failures.append(f"GET /api/wiki/requests (logged in): expected 200, got {r.status_code}")
            else:
                print("OK: GET /api/wiki/requests returns 200 when logged in")
            try:
                data = r.get_json()
                if not isinstance(data, list):
                    failures.append(f"GET /api/wiki/requests: expected JSON array, got {type(data)}")
                    data = []
                else:
                    print(f"OK: Response is JSON array (length {len(data)})")
            except Exception as e:
                failures.append(f"GET /api/wiki/requests: invalid JSON: {e}")
                data = []

            # --- 3. Mark-handled: POST then GET again (row removed) ---
            if data and len(data) > 0:
                clergy_id = data[0]['clergy_id']
                r2 = client.post(
                    '/api/wiki/requests/mark-handled',
                    json={'clergy_id': clergy_id},
                    headers={'Content-Type': 'application/json'},
                )
                if r2.status_code != 200:
                    failures.append(f"POST mark-handled: expected 200, got {r2.status_code}")
                else:
                    r3 = client.get('/api/wiki/requests')
                    after = r3.get_json() if r3.status_code == 200 else []
                    if any(x['clergy_id'] == clergy_id for x in after):
                        failures.append("Mark handled: row still in list after POST")
                    else:
                        print("OK: Mark handled removes row; list refreshes")
            else:
                print("OK: Mark handled (skipped - no pending requests)")

        # --- 4. Wiki HTML: logged-in has request sidebar (session already set in step 2) ---
        if not failures and user:
            with client.session_transaction() as sess:
                sess['user_id'] = user.id
            r = client.get('/wiki')
            if r.status_code != 200:
                failures.append(f"GET /wiki (logged in): expected 200, got {r.status_code}")
            else:
                html = r.data.decode('utf-8')
                if 'wiki-request-sidebar' not in html or 'Requested Articles' not in html:
                    failures.append("GET /wiki (logged in) should include Requested Articles sidebar")
                else:
                    print("OK: Wiki page when logged in includes Requested Articles sidebar (edit-mode visibility is JS-controlled)")

    if failures:
        print("\nFailures:")
        for f in failures:
            print("  -", f)
        return 1
    print("\nAll checks passed.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
