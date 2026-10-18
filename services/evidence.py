"""Evidence: sources attached to a clergy date or one field of an ordination/consecration.

Each item is saved on its own (not with the clergy form). Files go to the photo bucket under
evidence/<clergy_id>/, outside clergy/<id>/ so photo pruning never touches them.
"""
import uuid
from io import BytesIO
from urllib.parse import urlparse

from flask import current_app, session
from PIL import Image, ImageOps
from sqlalchemy import func

from models import db, Clergy, Ordination, Consecration, Evidence
from services.image_upload import get_image_upload_service

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_TEXT_CHARS = 20000
THUMB_SIZE = (320, 320)
# PIL format -> (extension, content type). The type we serve comes from here, never from the client.
PHOTO_FORMATS = {
    'JPEG': ('jpg', 'image/jpeg'),
    'PNG': ('png', 'image/png'),
    'GIF': ('gif', 'image/gif'),
    'WEBP': ('webp', 'image/webp'),
}
EVENT_MODELS = {'ordination': Ordination, 'consecration': Consecration}


class EvidenceError(ValueError):
    """Shown to the user as-is (HTTP 400)."""


def _int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def resolve_slot(values):
    """The decision a piece of evidence backs, validated. `values` is request.args or request.form:
    clergy_id, field, and for event fields event_kind (ordination|consecration) + event_id."""
    clergy = Clergy.query.filter(
        Clergy.id == _int(values.get('clergy_id')),
        Clergy.is_deleted != True,  # noqa: E712
    ).first()
    if not clergy:
        raise EvidenceError('Clergy not found.')
    field = values.get('field') or ''
    slot = {'clergy_id': clergy.id, 'ordination_id': None, 'consecration_id': None, 'field': field}
    event_kind = values.get('event_kind') or ''
    if not event_kind:
        if field not in Evidence.CLERGY_FIELDS:
            raise EvidenceError('Unknown field.')
        return slot
    model = EVENT_MODELS.get(event_kind)
    event = db.session.get(model, _int(values.get('event_id'))) if model else None
    if not event or event.clergy_id != clergy.id:
        raise EvidenceError('Event not found. Save the record first.')
    if field not in Evidence.EVENT_FIELDS or (field == 'co_consecrators' and event_kind != 'consecration'):
        raise EvidenceError('Unknown field.')
    slot[event_kind + '_id'] = event.id
    return slot


def list_for_slot(slot):
    return Evidence.query.filter_by(**slot).order_by(Evidence.id.desc()).all()


def slot_key(ordination_id, consecration_id, field):
    """Key used by the form to show counts: 'date_of_birth', 'ordination:12:date', ..."""
    if ordination_id:
        return f'ordination:{ordination_id}:{field}'
    if consecration_id:
        return f'consecration:{consecration_id}:{field}'
    return field


def counts_for_clergy(clergy_id):
    rows = (
        db.session.query(Evidence.ordination_id, Evidence.consecration_id, Evidence.field, func.count(Evidence.id))
        .filter(Evidence.clergy_id == clergy_id)
        .group_by(Evidence.ordination_id, Evidence.consecration_id, Evidence.field)
        .all()
    )
    return {slot_key(o, c, f): n for o, c, f, n in rows}


def serialize(ev):
    user = ev.created_by
    return {
        'id': ev.id,
        'kind': ev.kind,
        'url': ev.url,
        'thumb_url': ev.thumb_url,
        'file_name': ev.file_name,
        'text': ev.text,
        'created_at': ev.created_at.strftime('%Y-%m-%d') if ev.created_at else None,
        'created_by': (user.full_name or user.username) if user else None,
    }


def public_items_for_clergy(clergy_id):
    """All evidence for one clergy for the public grid, with its slot; editor names left out."""
    items = []
    for ev in Evidence.query.filter_by(clergy_id=clergy_id).order_by(Evidence.id).all():
        item = serialize(ev)
        del item['created_by']
        item.update(ordination_id=ev.ordination_id, consecration_id=ev.consecration_id, field=ev.field)
        items.append(item)
    return items


def _clean_link(raw):
    url = (raw or '').strip()
    parsed = urlparse(url)
    # Only http(s): the link is rendered as an href, so javascript:/data: must never get through.
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or len(url) > 2000:
        raise EvidenceError('Enter a full link starting with http:// or https://.')
    return url


def _read_file(file):
    if not file or not file.filename:
        raise EvidenceError('Choose a file.')
    data = file.read(MAX_FILE_BYTES + 1)
    if not data:
        raise EvidenceError('The file is empty.')
    if len(data) > MAX_FILE_BYTES:
        raise EvidenceError('Files can be at most 25 MB.')
    return data


def _photo_files(data):
    """[(bytes, ext, content_type)] for the original and a JPEG preview."""
    try:
        image = Image.open(BytesIO(data))
        fmt = image.format
        image.load()
    except Exception:
        raise EvidenceError('That file is not a readable image.')
    if fmt not in PHOTO_FORMATS:
        raise EvidenceError('Photos must be JPEG, PNG, GIF or WebP.')
    thumb = ImageOps.exif_transpose(image)
    thumb.thumbnail(THUMB_SIZE)
    if thumb.mode != 'RGB':
        background = Image.new('RGB', thumb.size, (255, 255, 255))
        rgba = thumb.convert('RGBA')
        background.paste(rgba, mask=rgba.split()[-1])
        thumb = background
    out = BytesIO()
    thumb.save(out, format='JPEG', quality=85, optimize=True)
    ext, content_type = PHOTO_FORMATS[fmt]
    return [(data, ext, content_type), (out.getvalue(), 'jpg', 'image/jpeg')]


def _upload(clergy_id, files):
    """Upload each (bytes, ext, content_type); returns their public URLs."""
    service = get_image_upload_service()
    if not service.backblaze_configured:
        raise EvidenceError('File storage is not configured.')
    stem = f"{service.config.key_prefix}evidence/{clergy_id}/{uuid.uuid4().hex}"
    urls = []
    for i, (body, ext, content_type) in enumerate(files):
        key = f"{stem}{'_thumb' if i else ''}.{ext}"
        service.s3_client.put_object(Bucket=service.bucket_name, Key=key, Body=body, ContentType=content_type)
        urls.append(service.config.get_public_url(key))
    return urls


def create(slot, kind, text=None, link=None, file=None):
    text = (text or '').strip()
    if len(text) > MAX_TEXT_CHARS:
        raise EvidenceError('Text can be at most 20,000 characters.')
    ev = Evidence(kind=kind, text=text or None, created_by_id=session.get('user_id'), **slot)
    if kind == 'text':
        if not text:
            raise EvidenceError('Write the text.')
    elif kind == 'link':
        ev.url = _clean_link(link)
    elif kind == 'photo':
        data = _read_file(file)
        ev.url, ev.thumb_url = _upload(slot['clergy_id'], _photo_files(data))
    elif kind == 'pdf':
        data = _read_file(file)
        if not data.startswith(b'%PDF-'):
            raise EvidenceError('That file is not a PDF.')
        (ev.url,) = _upload(slot['clergy_id'], [(data, 'pdf', 'application/pdf')])
    else:
        raise EvidenceError('Unknown evidence type.')
    if file is not None and file.filename:
        ev.file_name = file.filename.rsplit('/', 1)[-1].rsplit('\\', 1)[-1][:255]
    # ponytail: a failed commit after upload leaves the file in the bucket; sweep evidence/ if that matters
    db.session.add(ev)
    db.session.commit()
    return ev


def delete(ev):
    """Delete the row, then its bucket files. Rows removed by cascade (event or clergy deleted)
    leave their files behind."""
    # ponytail: cascade-deleted rows orphan files under evidence/<clergy_id>/; sweep that prefix if storage matters
    urls = [u for u in (ev.url, ev.thumb_url) if u] if ev.kind in ('photo', 'pdf') else []
    db.session.delete(ev)
    db.session.commit()
    service = get_image_upload_service()
    for url in urls:
        key = service.config.get_object_key(url) if service.backblaze_configured else None
        if key:
            service.delete_image(key)
        else:
            current_app.logger.warning('Evidence file not in bucket, left alone: %s', url)
