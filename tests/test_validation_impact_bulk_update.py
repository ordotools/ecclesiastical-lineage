#!/usr/bin/env python3
"""
Verify validation-impact bulk-update API accepts integer root_clergy_id (coerced from client).

Run from project root: python -m tests.test_validation_impact_bulk_update
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    from app import app
    from models import User

    failures = []
    with app.app_context():
        user = User.query.filter_by(username='admin').first()
        if not user:
            failures.append("No admin user in DB (run app once to create default admin)")
            for f in failures:
                print("FAIL:", f)
            return 1

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess['user_id'] = user.id

        # Request with integer root_clergy_id (as sent by JS after coercion) must succeed (200).
        r = client.post(
            '/editor/api/validation-impact/bulk-update',
            json={'root_clergy_id': 1, 'changes': []},
            headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
        )
        if r.status_code != 200:
            failures.append(
                f"POST bulk-update with integer root_clergy_id: expected 200, got {r.status_code} {r.get_data(as_text=True)}"
            )
        else:
            data = r.get_json() or {}
            if data.get('root_clergy_id') != 1:
                failures.append(
                    f"POST bulk-update: expected response root_clergy_id=1, got {data.get('root_clergy_id')}"
                )
            else:
                print("OK: bulk-update accepts integer root_clergy_id and returns 200 with root_clergy_id in response.")

        # Request with string root_clergy_id must be rejected (400).
        r2 = client.post(
            '/editor/api/validation-impact/bulk-update',
            json={'root_clergy_id': '1', 'changes': []},
            headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
        )
        if r2.status_code != 400:
            failures.append(
                f"POST bulk-update with string root_clergy_id: expected 400, got {r2.status_code}"
            )
        else:
            print("OK: bulk-update rejects non-integer root_clergy_id with 400.")

    if failures:
        for f in failures:
            print("FAIL:", f)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
