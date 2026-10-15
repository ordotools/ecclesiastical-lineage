#!/usr/bin/env python3
"""
Unit tests for the descendant validity cascade (_propagate_validity).

Run from project root:

    env/bin/python -m tests.test_validation_cascade
"""

import itertools
import os
import sys
from datetime import date
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_ids = itertools.count(1)


def _event(year, validity='valid', inherited=False):
    return SimpleNamespace(
        id=next(_ids),
        date=date(year, 1, 1),
        year=None,
        details_unknown=False,
        is_invalid=validity == 'invalid',
        is_doubtfully_valid=validity == 'doubtfully_valid',
        is_sub_conditione=False,
        is_doubtful_event=False,
        is_inherited=inherited,
    )


def _bishop(ord_validity='valid', cons_validity='valid'):
    return SimpleNamespace(
        ordinations=[_event(1940, ord_validity)],
        consecrations=[_event(1950, cons_validity)],
    )


def _run(events, bishops):
    from services.validation_cascade import _propagate_validity
    return {c['id']: c['new_validity'] for c in _propagate_validity(events, bishops)}


def test_invalid_root_reaches_grandchildren():
    """Root invalid → child's orders invalid → orders the child gives invalid, in one run."""
    root = _bishop(cons_validity='invalid')
    child = SimpleNamespace(ordinations=[_event(1960)], consecrations=[_event(1965)])
    grandchild_ord = _event(1970)
    events = [
        ('ordination', grandchild_ord, 'child'),  # listed first: must still see the child's new status
        ('ordination', child.ordinations[0], 'root'),
        ('consecration', child.consecrations[0], 'root'),
    ]
    changes = _run(events, {'root': root, 'child': child})
    assert changes == {
        grandchild_ord.id: 'invalid',
        child.ordinations[0].id: 'invalid',
        child.consecrations[0].id: 'invalid',
    }, changes


def test_restored_root_clears_inherited_grandchildren():
    """Root valid again → inherited invalidity cleared through every generation."""
    root = _bishop()
    child = SimpleNamespace(
        ordinations=[_event(1960, 'invalid', inherited=True)],
        consecrations=[_event(1965, 'invalid', inherited=True)],
    )
    grandchild_ord = _event(1970, 'invalid', inherited=True)
    events = [
        ('ordination', grandchild_ord, 'child'),
        ('ordination', child.ordinations[0], 'root'),
        ('consecration', child.consecrations[0], 'root'),
    ]
    changes = _run(events, {'root': root, 'child': child})
    assert changes == {
        grandchild_ord.id: 'valid',
        child.ordinations[0].id: 'valid',
        child.consecrations[0].id: 'valid',
    }, changes


def test_valid_bishop_keeps_explicit_invalid():
    """Valid bishop does not clear a status set explicitly (not inherited)."""
    explicit = _event(1960, 'invalid')
    assert _run([('ordination', explicit, 'b')], {'b': _bishop()}) == {}


def test_doubtful_bishop_never_upgrades_explicit_invalid():
    """Doubtful bishop: explicit invalid stays invalid; valid child capped to doubtful."""
    explicit = _event(1960, 'invalid')
    plain = _event(1961)
    changes = _run(
        [('ordination', explicit, 'b'), ('ordination', plain, 'b')],
        {'b': _bishop(cons_validity='doubtfully_valid')},
    )
    assert changes == {plain.id: 'doubtfully_valid'}, changes


def test_invalid_bishop_caps_explicit_doubtful():
    """Invalid bishop: explicit doubtful is pushed down to invalid."""
    explicit = _event(1960, 'doubtfully_valid')
    changes = _run([('ordination', explicit, 'b')], {'b': _bishop(ord_validity='invalid')})
    assert changes == {explicit.id: 'invalid'}, changes


def _summary(bishop, year=None):
    from services.validation_cascade import _bishop_summary_at_date, event_date_key
    s = _bishop_summary_at_date(bishop, event_date_key(None, year))
    return s['has_valid_ordination'] and s['has_valid_consecration']


def test_root_without_records_presumed_valid():
    """Lineage root entered without his own orders → presumed valid bishop."""
    root = SimpleNamespace(ordinations=[], consecrations=[])
    assert _summary(root, 1960)
    assert _run([('ordination', _event(1960), 'r')], {'r': root}) == {}


def test_priest_without_consecration_gives_invalid_orders():
    """Ordination recorded but no consecration → orders he gives are invalid."""
    priest = SimpleNamespace(ordinations=[_event(1940)], consecrations=[])
    child = _event(1960)
    assert _run([('ordination', child, 'p')], {'p': priest}) == {child.id: 'invalid'}


def test_consecrated_before_ordained_is_not_valid():
    """Rule 1a: consecration dated before the only valid ordination does not count."""
    b = SimpleNamespace(ordinations=[_event(1960)], consecrations=[_event(1950)])
    assert not _summary(b, 1970)
    assert _summary(_bishop(), 1970)


def test_undated_consecration_presumed_before():
    """Consecration with no date/year counts as received before a dated event."""
    cons = _event(1950)
    cons.date = None
    b = SimpleNamespace(ordinations=[_event(1940)], consecrations=[cons])
    assert _summary(b, 1960)


def test_undated_child_event_sees_all_bishop_events():
    """Child event with no date/year (details unknown) under a valid bishop stays valid."""
    child = _event(1960)
    child.date, child.details_unknown = None, True
    assert _run([('ordination', child, 'b')], {'b': _bishop()}) == {}


def test_summary_is_date_aware():
    """Invalid 1950 consecration, valid 1970 re-consecration: invalid in 1960, valid in 1980."""
    b = SimpleNamespace(ordinations=[_event(1940)], consecrations=[_event(1950, 'invalid'), _event(1970)])
    assert not _summary(b, 1960)
    assert _summary(b, 1980)



def test_year_only_event_after_same_year_consecration():
    """Ordination known only as '1991' by a bishop consecrated 1991-09-24 → valid."""
    b = SimpleNamespace(ordinations=[_event(1985)], consecrations=[_event(1991)])
    b.consecrations[0].date = date(1991, 9, 24)
    assert _summary(b, 1991)


def main():
    tests = [
        test_invalid_root_reaches_grandchildren,
        test_restored_root_clears_inherited_grandchildren,
        test_valid_bishop_keeps_explicit_invalid,
        test_doubtful_bishop_never_upgrades_explicit_invalid,
        test_invalid_bishop_caps_explicit_doubtful,
        test_root_without_records_presumed_valid,
        test_priest_without_consecration_gives_invalid_orders,
        test_consecrated_before_ordained_is_not_valid,
        test_undated_consecration_presumed_before,
        test_undated_child_event_sees_all_bishop_events,
        test_summary_is_date_aware,
        test_year_only_event_after_same_year_consecration,
    ]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f'PASS: {fn.__name__}')
        except AssertionError as e:
            failed += 1
            print(f'FAIL: {fn.__name__}: {e}')
        except Exception as e:
            failed += 1
            print(f'ERROR: {fn.__name__}: {e!r}')
    if failed:
        print(f'{failed} failed')
        return 1
    print(f'{len(tests)} passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
