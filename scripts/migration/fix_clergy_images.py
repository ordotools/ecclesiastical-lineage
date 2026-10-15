#!/usr/bin/env python3
"""
Repair clergy images. Dry run unless --apply.

  - base64 originals in clergy.image_data / clergy.image_url are uploaded to the bucket
  - detail/lineage that are base64 or missing from the bucket are rebuilt from the best surviving
    source: the stored crop, then the detail, then the original centre-cropped to a square
  - 'cropped' and any other base64 is dropped from the row
  - --prune (with --apply) also deletes clergy files no row references and sprite files no sheet row references

Run it against the DB whose rows you want fixed (prod: from a prod shell). Writes and deletes stay
under BACKBLAZE_KEY_PREFIX, so a dev run (prefix dev/) can't touch prod's files.

    python scripts/migration/fix_clergy_images.py [--apply] [--prune]
"""

import argparse
import json
import os
import sys
from io import BytesIO

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import requests
from PIL import Image, ImageOps


def list_keys(svc, prefix):
    keys = set()
    for page in svc.s3_client.get_paginator('list_objects_v2').paginate(Bucket=svc.bucket_name, Prefix=prefix):
        keys |= {o['Key'] for o in page.get('Contents', [])}
    return keys


def row_data(clergy):
    try:
        data = json.loads(clergy.image_data) if clergy.image_data else {}
    except json.JSONDecodeError:
        data = {}
    return data if isinstance(data, dict) else {}


def delete_keys(svc, keys):
    keys = sorted(keys)
    for i in range(0, len(keys), 1000):
        svc.s3_client.delete_objects(Bucket=svc.bucket_name, Delete={'Objects': [{'Key': k} for k in keys[i:i + 1000]], 'Quiet': True})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='write changes (default: dry run)')
    parser.add_argument('--prune', action='store_true', help='with --apply: delete unreferenced clergy and sprite files')
    args = parser.parse_args()

    from app import app
    from models import Clergy, SpriteSheet, db
    from services.image_upload import get_image_upload_service, _decode_data_url

    with app.app_context():
        svc = get_image_upload_service()
        if not svc.backblaze_configured:
            sys.exit('Backblaze not configured')
        cfg = svc.config
        prefix = cfg.key_prefix
        if args.apply and args.prune and not prefix:
            if input("BACKBLAZE_KEY_PREFIX is empty: this deletes prod's files that this DB doesn't reference. Type 'prod' to continue: ") != 'prod':
                sys.exit('aborted')
        existing = list_keys(svc, 'clergy/') | list_keys(svc, f'{prefix}clergy/')
        print(f"prefix={prefix!r} bucket clergy files={len(existing)} mode={'APPLY' if args.apply else 'dry run'}")

        def live(url):
            return cfg.get_object_key(url) in existing

        def is_b64(value):
            return isinstance(value, str) and value.startswith('data:')

        def load(source):
            if is_b64(source):
                return Image.open(BytesIO(_decode_data_url(source)))
            response = requests.get(source, timeout=20)
            response.raise_for_status()
            return Image.open(BytesIO(response.content))

        changed = failed = 0
        for clergy in Clergy.query.order_by(Clergy.id).all():
            data = row_data(clergy)

            original = next((u for u in (data.get('original'), clergy.image_url)
                             if is_b64(u) or (live(u) and '/original_' in cfg.get_object_key(u))), None)
            sizes_ok = live(data.get('detail')) and live(data.get('lineage'))
            clean = not any(is_b64(v) for v in (*data.values(), clergy.image_url)) and 'cropped' not in data
            if sizes_ok and clean:
                continue
            if not (original or data.get('detail') or data.get('cropped')):
                continue  # no image at all

            actions = []
            if is_b64(original):
                actions.append('upload original')
            if not sizes_ok:
                actions.append('rebuild detail+lineage')
            if 'cropped' in data:
                actions.append('drop cropped')
            print(f"clergy {clergy.id} {clergy.name!r}: {', '.join(actions) or 'clean row'}")
            changed += 1
            if not args.apply:
                continue

            try:
                new = {}
                if is_b64(original):
                    original = svc.upload_image_from_base64(original, clergy.id, 'original')
                    if not original:
                        raise RuntimeError('original upload failed')
                if original:
                    new['original'] = original
                if sizes_ok:
                    new['detail'], new['lineage'] = data['detail'], data['lineage']
                else:
                    sources = [s for s in (data.get('cropped'), data.get('detail'), original) if is_b64(s) or live(s)]
                    if not sources:
                        raise RuntimeError('nothing left to rebuild sizes from')
                    image = ImageOps.fit(load(sources[0]).convert('RGB'), (svc.image_sizes['detail'][0],) * 2, Image.Resampling.LANCZOS) \
                        if sources[0] == original else load(sources[0])
                    for size_type in ('detail', 'lineage'):
                        url = svc._create_resized_version(image, clergy.id, size_type, svc.image_sizes[size_type])
                        if not url:
                            raise RuntimeError(f'{size_type} upload failed')
                        new[size_type] = url
                if isinstance(data.get('metadata'), dict):
                    new['metadata'] = data['metadata']
                clergy.image_data = json.dumps(new)
                clergy.image_url = new.get('original', new['detail'])
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                failed += 1
                print(f"  FAILED clergy {clergy.id}: {e}")

        print(f"{changed} row(s) {'fixed' if args.apply else 'to fix'}, {failed} failed")

        if args.apply and args.prune:
            referenced = set()
            for clergy in Clergy.query.all():
                referenced |= {cfg.get_object_key(u) for u in (clergy.image_url, *row_data(clergy).values())}
            stale = list_keys(svc, f'{prefix}clergy/') - referenced
            delete_keys(svc, stale)
            print(f"deleted {len(stale)} unreferenced clergy file(s)")

            svc.prune_sprite_sheets()
            referenced = {cfg.get_object_key(u) for s in SpriteSheet.query.all() for u in (s.url, s.hires_url)}
            stale = list_keys(svc, f'{prefix}sprites/') - referenced
            delete_keys(svc, stale)
            print(f"deleted {len(stale)} unreferenced sprite file(s)")

        if args.apply:
            result = svc.create_sprite_sheet(Clergy.query.filter(Clergy.is_deleted != True).all())  # noqa: E712
            print('sprite rebuilt:', result.get('url') or result.get('error'))


if __name__ == '__main__':
    main()
