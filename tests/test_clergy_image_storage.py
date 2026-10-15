#!/usr/bin/env python3
"""
Regression checks: clergy rows keep only bucket URLs, and pruning deletes only unreferenced files.

Run from project root:

    python -m tests.test_clergy_image_storage
"""

import base64
import io
import json
import os
import sys
from types import SimpleNamespace

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class FakeS3:
    def __init__(self, keys=()):
        self.keys, self.deleted, self.bodies = list(keys), [], {}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.bodies[Key] = Body

    def list_objects_v2(self, Bucket, Prefix):
        return {'Contents': [{'Key': k} for k in self.keys if k.startswith(Prefix)]}

    def delete_objects(self, Bucket, Delete):
        self.deleted += [o['Key'] for o in Delete['Objects']]


def main():
    from app import app
    from services.clergy import _apply_image_data_json
    from services.image_upload import get_image_upload_service

    with app.app_context():
        svc = get_image_upload_service()
        if not svc.backblaze_configured:
            print("SKIP: Backblaze not configured")
            return 0
        url = svc.config.get_public_url
        p = svc._clergy_prefix(9)

        # Base64 from older editor code is dropped; bucket URLs and metadata are kept.
        clergy = SimpleNamespace(id=9, image_data=None, image_url=None)
        _apply_image_data_json(clergy, json.dumps({
            'original': 'data:image/jpeg;base64,AAAA', 'cropped': 'data:image/jpeg;base64,BBBB',
            'detail': url(p + 'detail_1.jpg'), 'lineage': url(p + 'lineage_1.jpg'), 'metadata': {'a': 1},
        }))
        saved = json.loads(clergy.image_data)
        assert set(saved) == {'detail', 'lineage', 'metadata'}, saved
        assert clergy.image_url == url(p + 'detail_1.jpg'), clergy.image_url

        # No bucket detail URL: the row is left alone.
        untouched = SimpleNamespace(id=9, image_data='{"x": 1}', image_url='keep')
        _apply_image_data_json(untouched, json.dumps({'detail': 'data:image/jpeg;base64,AAAA'}))
        assert (untouched.image_data, untouched.image_url) == ('{"x": 1}', 'keep')

        # Prune deletes only this clergy's unreferenced files.
        real_s3 = svc.s3_client
        svc.s3_client = FakeS3([p + 'detail_1.jpg', p + 'detail_old.jpg', p + 'original_1.jpg',
                                svc._clergy_prefix(90) + 'detail_x.jpg'])
        try:
            assert svc.prune_clergy_images(9, [url(p + 'detail_1.jpg'), url(p + 'original_1.jpg'), {'meta': 1}, None])
            assert svc.s3_client.deleted == [p + 'detail_old.jpg'], svc.s3_client.deleted
        finally:
            svc.s3_client = real_s3

        # Upload without cropping: phone portrait stored sideways with EXIF "rotate 90" (orientation 6).
        photo = Image.new('RGB', (600, 300), 'white')
        photo.paste((255, 0, 0), (0, 0, 200, 300))  # left third = top third of the upright photo
        exif = Image.Exif()
        exif[0x0112] = 6
        buf = io.BytesIO()
        photo.save(buf, 'JPEG', exif=exif)
        svc.s3_client = FakeS3()
        try:
            result = svc.save_clergy_image(9, 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode())
            assert result['success'], result
            urls = result['urls']
            assert {'original', 'detail', 'lineage'} <= set(urls) and urls['metadata']['auto_cropped'], urls
            detail = Image.open(io.BytesIO(svc.s3_client.bodies[svc.config.get_object_key(urls['detail'])]))
            assert detail.size == (320, 320), detail.size
            r, g, b = detail.getpixel((160, 5))
            assert r > 200 and g < 80, ('top of upright portrait should be the red band', (r, g, b))
        finally:
            svc.s3_client = real_s3

    print("OK")
    return 0


if __name__ == '__main__':
    sys.exit(main())
