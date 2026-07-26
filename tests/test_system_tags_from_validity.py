#!/usr/bin/env python3
"""
Unit tests for compute_system_tag_names_for_clergy (latest-wins + cons gate).

Run from project root:

    .venv/bin/python -m tests.test_system_tags_from_validity
"""

import os
import sys
from datetime import date
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _ord(d, *, invalid=False, doubtful=False, sub_cond=False, doubtful_event=False,
         year=None, details_unknown=False):
    return SimpleNamespace(
        date=d,
        year=year,
        details_unknown=details_unknown,
        is_invalid=invalid,
        is_doubtfully_valid=doubtful,
        is_sub_conditione=sub_cond,
        is_doubtful_event=doubtful_event,
    )


def _cons(d, *, invalid=False, doubtful=False, sub_cond=False, doubtful_event=False,
          year=None, details_unknown=False):
    return _ord(
        d,
        invalid=invalid,
        doubtful=doubtful,
        sub_cond=sub_cond,
        doubtful_event=doubtful_event,
        year=year,
        details_unknown=details_unknown,
    )


def _clergy(ordinations=None, consecrations=None):
    return SimpleNamespace(
        ordinations=ordinations or [],
        consecrations=consecrations or [],
    )


def _names(clergy):
    from services.validation_cascade import compute_system_tag_names_for_clergy
    return compute_system_tag_names_for_clergy(clergy)


def test_invalid_then_valid_ord():
    """Earlier invalid + later valid ord → valid only (no invalid_priest)."""
    c = _clergy(ordinations=[
        _ord(date(2000, 1, 1), invalid=True),
        _ord(date(2010, 1, 1)),
    ])
    assert _names(c) == {'valid'}, _names(c)


def test_valid_then_invalid_ord():
    """Earlier valid + later invalid ord → invalid_priest only (no valid)."""
    c = _clergy(ordinations=[
        _ord(date(2000, 1, 1)),
        _ord(date(2010, 1, 1), invalid=True),
    ])
    assert _names(c) == {'invalid_priest'}, _names(c)


def test_doubtful_then_valid_ord():
    """Earlier doubtful + later valid ord → valid only."""
    c = _clergy(ordinations=[
        _ord(date(2000, 1, 1), doubtful=True),
        _ord(date(2010, 1, 1)),
    ])
    assert _names(c) == {'valid'}, _names(c)


def test_valid_cons_without_prior_valid_ord():
    """Valid cons with no prior valid-like ord → invalid_priest + invalid_bishop."""
    c = _clergy(
        ordinations=[_ord(date(2010, 1, 1), invalid=True)],
        consecrations=[_cons(date(2015, 1, 1))],
    )
    assert _names(c) == {'invalid_priest', 'invalid_bishop'}, _names(c)


def test_doubtful_ord_then_cons_adds_doubtful_bishop():
    """Doubtful ord + later cons → doubtful_priest + doubtful_bishop."""
    c = _clergy(
        ordinations=[_ord(date(2010, 1, 1), doubtful=True)],
        consecrations=[_cons(date(2015, 1, 1))],
    )
    assert _names(c) == {'doubtful_priest', 'doubtful_bishop'}, _names(c)


def test_invalid_ord_without_subsequent_cons_no_bishop_tag():
    """Invalid ord alone → invalid_priest only (no bishop tag)."""
    c = _clergy(ordinations=[_ord(date(2010, 1, 1), invalid=True)])
    assert _names(c) == {'invalid_priest'}, _names(c)


def test_valid_cons_after_prior_valid_ord_clears_earlier_invalid_cons():
    """Valid cons after prior valid ord (earlier cons invalid) → valid, no invalid_bishop."""
    c = _clergy(
        ordinations=[_ord(date(2000, 1, 1))],
        consecrations=[
            _cons(date(2005, 1, 1), invalid=True),
            _cons(date(2010, 1, 1)),
        ],
    )
    assert _names(c) == {'valid'}, _names(c)


def test_valid_cons_before_valid_ord_fails_gate():
    """Valid cons before any valid ord → gate fails; no valid from cons."""
    c = _clergy(
        ordinations=[_ord(date(2010, 1, 1))],
        consecrations=[_cons(date(2005, 1, 1))],
    )
    assert _names(c) == set(), _names(c)


def test_latest_invalid_cons_applies_even_if_gate_fails():
    """Gate fail + latest cons invalid → invalid_bishop still."""
    c = _clergy(
        ordinations=[],
        consecrations=[_cons(date(2010, 1, 1), invalid=True)],
    )
    assert _names(c) == {'invalid_bishop'}, _names(c)


def test_ord_only_valid():
    """Valid ordination, no consecrations → valid."""
    c = _clergy(ordinations=[_ord(date(2000, 1, 1))])
    assert _names(c) == {'valid'}, _names(c)


def main():
    tests = [
        test_invalid_then_valid_ord,
        test_valid_then_invalid_ord,
        test_doubtful_then_valid_ord,
        test_valid_cons_without_prior_valid_ord,
        test_doubtful_ord_then_cons_adds_doubtful_bishop,
        test_invalid_ord_without_subsequent_cons_no_bishop_tag,
        test_valid_cons_after_prior_valid_ord_clears_earlier_invalid_cons,
        test_valid_cons_before_valid_ord_fails_gate,
        test_latest_invalid_cons_applies_even_if_gate_fails,
        test_ord_only_valid,
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
            print(f'ERROR: {fn.__name__}: {e}')
    if failed:
        print(f'{failed} failed')
        return 1
    print(f'{len(tests)} passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
