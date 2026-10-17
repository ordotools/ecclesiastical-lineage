#!/usr/bin/env python3
"""
Saving the clergy form keeps ordination/consecration IDs (upsert, not delete-and-recreate).
Evidence will hang off these IDs, so they must survive edits.

Runs against the configured DB inside a transaction that is rolled back.

    env/bin/python -m tests.test_event_upsert
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    from werkzeug.datastructures import MultiDict
    from app import app
    from models import db, Clergy
    from services.clergy import sync_events_from_form

    with app.app_context():
        try:
            subject = Clergy(name='__upsert_subject__', rank='Bishop')
            bishop = Clergy(name='__upsert_bishop__', rank='Bishop')
            co = Clergy(name='__upsert_co__', rank='Bishop')
            db.session.add_all([subject, bishop, co])
            db.session.flush()

            # New record: rows without an id are created.
            sync_events_from_form(subject, MultiDict({
                'ordinations[0][date]': '1950-01-01',
                'ordinations[0][ordaining_bishop_id]': str(bishop.id),
                'ordinations[1][year]': '1955',
                'ordinations[1][date_unknown]': '1',
                'consecrations[0][date]': '1960-05-05',
                'consecrations[0][consecrator_id]': str(bishop.id),
                'consecrations[0][co_consecrators][0][id]': str(co.id),
            }))
            db.session.flush()
            ord_a, ord_b = sorted(subject.ordinations, key=lambda o: o.id)
            cons = subject.consecrations[0]
            assert [c.id for c in cons.co_consecrators] == [co.id]

            # Edit: row a changes in place, row b is removed, a new row is added,
            # co-consecrator cleared. A foreign id is treated as a new row.
            sync_events_from_form(subject, MultiDict({
                'ordinations[0][id]': str(ord_a.id),
                'ordinations[0][date]': '1951-02-02',
                'ordinations[0][validity]': 'invalid',
                'ordinations[1][details_unknown]': 'on',
                'ordinations[1][id]': '999999999',
                'consecrations[0][id]': str(cons.id),
                'consecrations[0][date]': '1960-05-05',
                'consecrations[0][consecrator_id]': str(bishop.id),
            }))
            db.session.flush()
            db.session.expire_all()

            ords = sorted(subject.ordinations, key=lambda o: o.id)
            assert len(ords) == 2, ords
            assert ords[0].id == ord_a.id, 'edited ordination kept its id'
            assert str(ords[0].date) == '1951-02-02' and ords[0].is_invalid
            assert ords[0].ordaining_bishop_id is None, 'cleared bishop is cleared'
            assert ords[1].id not in (ord_a.id, ord_b.id) and ords[1].details_unknown
            assert subject.consecrations[0].id == cons.id, 'consecration kept its id'
            assert subject.consecrations[0].co_consecrators == []
            assert db.session.get(type(ord_b), ord_b.id) is None, 'removed row deleted'
        finally:
            db.session.rollback()

    print('ok')
    return 0


if __name__ == '__main__':
    sys.exit(main())
