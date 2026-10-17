#!/usr/bin/env python3
"""
Evidence API (editor v2): create/list/delete per decision, validation, bucket uploads, cascade.

Uses the configured DB with throwaway clergy (removed at the end) and a fake bucket.

    env/bin/python -m tests.test_evidence_api
"""

import os
import sys
from io import BytesIO
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE = 'https://bucket.example/'


class FakeBucket:
    def __init__(self):
        self.puts, self.deleted = {}, []
        self.backblaze_configured = True
        self.bucket_name = 'bucket'
        self.config = SimpleNamespace(
            key_prefix='',
            get_public_url=lambda key: BASE + key,
            get_object_key=lambda url: url[len(BASE):] if url.startswith(BASE) else None,
        )
        self.s3_client = SimpleNamespace(put_object=self._put)

    def _put(self, Bucket, Key, Body, ContentType):
        self.puts[Key] = ContentType

    def delete_image(self, key):
        self.deleted.append(key)


def _png():
    from PIL import Image
    out = BytesIO()
    Image.new('RGBA', (800, 400), (200, 0, 0, 128)).save(out, format='PNG')
    return out.getvalue()


def main():
    from werkzeug.datastructures import MultiDict
    from app import app
    from models import db, Clergy, Evidence, User
    import routes.editor_v2 as editor_routes
    import services.evidence as evidence_service
    from services.clergy import sync_events_from_form

    bucket = FakeBucket()
    evidence_service.get_image_upload_service = lambda: bucket
    editor_routes.log_audit_event = lambda *a, **k: None

    with app.app_context():
        subject = Clergy(name='__evidence_subject__', rank='Bishop')
        other = Clergy(name='__evidence_other__', rank='Bishop')
        db.session.add_all([subject, other])
        db.session.flush()
        sync_events_from_form(subject, MultiDict({'ordinations[0][date]': '1950-01-01'}))
        sync_events_from_form(other, MultiDict({'ordinations[0][date]': '1951-01-01'}))
        db.session.commit()
        sid, oid = subject.id, other.id
        ord_id, other_ord_id = subject.ordinations[0].id, other.ordinations[0].id
        admin_id = User.query.first().id

    client = app.test_client()
    with client.session_transaction() as s:
        s['user_id'] = admin_id

    def post(data, file=None):
        payload = dict(data)
        if file:
            payload['file'] = file
        r = client.post('/editor/api/evidence', data=payload, content_type='multipart/form-data')
        return r.status_code, r.get_json()

    dob = {'clergy_id': sid, 'field': 'date_of_birth'}
    ord_date = {'clergy_id': sid, 'field': 'date', 'event_kind': 'ordination', 'event_id': ord_id}
    try:
        # Validation
        assert post({**dob, 'kind': 'text'})[0] == 400, 'empty text rejected'
        assert post({**dob, 'kind': 'link', 'url': 'javascript:alert(1)'})[0] == 400, 'non-http link rejected'
        assert post({**dob, 'kind': 'text', 'field': 'notes', 'text': 'x'})[0] == 400, 'unknown field rejected'
        assert post({**ord_date, 'event_id': other_ord_id, 'kind': 'text', 'text': 'x'})[0] == 400, \
            "another clergy's event rejected"
        assert post({**ord_date, 'field': 'co_consecrators', 'kind': 'text', 'text': 'x'})[0] == 400, \
            'co_consecrators only on consecrations'
        assert post({**dob, 'kind': 'pdf'}, (BytesIO(b'not a pdf'), 'x.pdf'))[0] == 400, 'fake PDF rejected'
        assert post({**dob, 'kind': 'photo'}, (BytesIO(b'GIF89a junk'), 'x.gif'))[0] == 400, 'broken image rejected'

        # Create
        code, body = post({**dob, 'kind': 'text', 'text': 'Baptismal register, p. 12'})
        assert code == 200, body
        code, body = post({**dob, 'kind': 'link', 'url': 'https://example.org/record'})
        assert code == 200, body
        code, body = post({**ord_date, 'kind': 'photo', 'text': 'certificate'}, (BytesIO(_png()), 'cert.png'))
        assert code == 200, body
        photo = body['item']
        assert photo['file_name'] == 'cert.png' and photo['thumb_url'].endswith('_thumb.jpg')
        assert sorted(bucket.puts.values()) == ['image/jpeg', 'image/png']
        assert all(k.startswith(f'evidence/{sid}/') for k in bucket.puts)
        code, body = post({**ord_date, 'kind': 'pdf'}, (BytesIO(b'%PDF-1.4 ...'), 'letter.pdf'))
        assert code == 200 and bucket.puts[body['item']['url'][len(BASE):]] == 'application/pdf'

        # List is per decision, newest first
        r = client.get('/editor/api/evidence', query_string=dob).get_json()
        assert [i['kind'] for i in r['items']] == ['link', 'text'], r
        r = client.get('/editor/api/evidence', query_string=ord_date).get_json()
        assert [i['kind'] for i in r['items']] == ['pdf', 'photo'], r

        # The form shows counts on the saved fields
        html = client.get('/editor/panel/center', query_string={'clergy_id': sid}).get_data(as_text=True)
        assert 'data-evidence-field="date_of_birth"' in html
        assert f'data-event-id="{ord_id}"' in html
        assert html.count('<span class="evidence-count" data-evidence-count>2</span>') == 2, 'dob and ordination date'

        # Delete removes the row and both bucket files
        assert client.delete(f"/editor/api/evidence/{photo['id']}").status_code == 200
        assert sorted(bucket.deleted) == sorted(u[len(BASE):] for u in (photo['url'], photo['thumb_url']))

        # Removing the event (form save without it) cascades its evidence
        with app.app_context():
            subject = db.session.get(Clergy, sid)
            sync_events_from_form(subject, MultiDict({}))
            db.session.commit()
            assert Evidence.query.filter_by(ordination_id=ord_id).count() == 0
            assert Evidence.query.filter_by(clergy_id=sid).count() == 2, 'dob evidence stays'
    finally:
        with app.app_context():
            for cid in (sid, oid):
                clergy = db.session.get(Clergy, cid)
                for ev in clergy.ordinations:
                    db.session.delete(ev)
                db.session.delete(clergy)
            db.session.commit()
            assert Evidence.query.filter_by(clergy_id=sid).count() == 0, 'clergy delete cascades'

    print('ok')
    return 0


if __name__ == '__main__':
    sys.exit(main())
