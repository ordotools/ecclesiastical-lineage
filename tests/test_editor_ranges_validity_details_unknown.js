#!/usr/bin/env node
'use strict';

/**
 * Targeted tests for EditorRangesValidity details-unknown ordering
 * and right-panel grouping behaviour.
 *
 * Run from project root:
 *   node tests/test_editor_ranges_validity_details_unknown.js
 */

const assert = require('assert');

// Provide a minimal window/ValidityRules stub for the shared JS modules.
global.window = {};

// Simple validity rules stub: treat all ranges as valid when there is at
// least one ordination and one consecration in the history; otherwise all
// ranges are invalid. This is sufficient for verifying that ranges are built
// and consumed consistently in tests below without re-implementing the full
// cascade.
window.ValidityRules = {
    computeValidityPerRangeFromRecords(orders) {
        const hasOrd = orders.some(o => o && o.type === 'ordination');
        const hasCons = orders.some(o => o && o.type === 'consecration');
        const canGive = hasOrd && hasCons;
        const result = [];
        const count = Array.isArray(orders) ? orders.length : 0;
        for (let i = 0; i <= count; i++) {
            result.push({
                index: i,
                canValidlyOrdain: canGive,
                canValidlyConsecrate: canGive
            });
        }
        return result;
    }
};

const EditorRangesValidity = require('../static/js/editor-ranges-validity.js');
window.EditorRangesValidity = EditorRangesValidity;

// Load right-panel grouping helpers into window.EditorRightPanelOrdained.
require('../static/js/editor-right-panel-ordained.js');

const RightPanel = window.EditorRightPanelOrdained;

function makeDetailsUnknown(kind) {
    return {
        kind: kind,
        date: null,
        year: null,
        date_unknown: true,
        details_unknown: true
    };
}

function makeYearOnly(kind, year) {
    return {
        kind: kind,
        date: null,
        year: year,
        date_unknown: true,
        details_unknown: false
    };
}

function makeDated(kind, isoDate) {
    return {
        kind: kind,
        date: isoDate,
        year: null,
        date_unknown: false,
        details_unknown: false
    };
}

function assertOrdersTypes(result, expectedTypes, message) {
    const types = result.orders.map(o => o.type);
    assert.deepStrictEqual(types, expectedTypes, message);
}

function testSingleDetailsUnknownOrdination() {
    const orders = [
        { type: 'ordination', record: makeDetailsUnknown('ordination') }
    ];

    const result = EditorRangesValidity.buildRangesWithValidity({ orders });

    assert.strictEqual(result.orders.length, 1, 'single details-unknown ordination: one order expected');
    assertOrdersTypes(result, ['ordination'], 'single details-unknown ordination should stay ordination');

    const ranges = result.ranges;
    assert.strictEqual(ranges.length, 2, 'single order must yield two ranges');

    const simple = ranges.map(r => ({ index: r.index, start: r.start, end: r.end }));
    assert.deepStrictEqual(
        simple,
        [
            { index: 0, start: null, end: 'unknown' },
            { index: 1, start: 'unknown', end: null }
        ],
        'ranges for details-unknown ordination should use unknown boundary'
    );
}

function testDetailsUnknownOrdinationAndConsecrationPinnedFirstSecond() {
    const ord = makeDetailsUnknown('ordination');
    const cons = makeDetailsUnknown('consecration');

    // Intentionally provide in consecration-then-ordination order; helper
    // should still pin ordination first and consecration second.
    const orders = [
        { type: 'consecration', record: cons },
        { type: 'ordination', record: ord }
    ];

    const result = EditorRangesValidity.buildRangesWithValidity({ orders });
    assert.strictEqual(result.orders.length, 2, 'two details-unknown orders expected');

    assertOrdersTypes(
        result,
        ['ordination', 'consecration'],
        'details-unknown ordination must be index 0 and consecration index 1'
    );

    const ranges = result.ranges;
    assert.strictEqual(ranges.length, 3, 'two orders must yield three ranges');
}

function testPinnedUnknownEventsBeforeDatedEvents() {
    const ordUnknown = makeDetailsUnknown('ordination');
    const consUnknown = makeDetailsUnknown('consecration');
    const ordYear = makeYearOnly('ordination', 1990);
    const consYear = makeYearOnly('consecration', 2000);

    const orders = [
        { type: 'consecration', record: consUnknown },
        { type: 'ordination', record: ordYear },
        { type: 'ordination', record: ordUnknown },
        { type: 'consecration', record: consYear }
    ];

    const result = EditorRangesValidity.buildRangesWithValidity({ orders });

    assertOrdersTypes(
        result,
        ['ordination', 'consecration', 'ordination', 'consecration'],
        'details-unknown ordination/consecration must occupy first two slots before dated events'
    );

    const consecrationIndices = [];
    result.orders.forEach((o, idx) => {
        if (o.type === 'consecration') {
            consecrationIndices.push(idx);
        }
    });
    assert.ok(consecrationIndices.length === 2, 'expected two consecrations in combined history');
    assert.ok(
        consecrationIndices[0] < consecrationIndices[1],
        'details-unknown consecration must come before later consecration'
    );
}

function testDetailsUnknownConsecrationOnly() {
    const consUnknown = makeDetailsUnknown('consecration');
    const orders = [
        { type: 'consecration', record: consUnknown }
    ];

    const result = EditorRangesValidity.buildRangesWithValidity({ orders });

    assertOrdersTypes(
        result,
        ['consecration'],
        'single details-unknown consecration should be the first and only order'
    );
}

function testMultipleDetailsUnknownEdgeCases() {
    const ord1 = makeDetailsUnknown('ordination');
    const ord2 = makeDetailsUnknown('ordination');
    const cons1 = makeDetailsUnknown('consecration');
    const cons2 = makeDetailsUnknown('consecration');

    const orders = [
        { type: 'ordination', record: ord1 },
        { type: 'ordination', record: ord2 },
        { type: 'consecration', record: cons1 },
        { type: 'consecration', record: cons2 }
    ];

    const result = EditorRangesValidity.buildRangesWithValidity({ orders });

    assert.strictEqual(result.orders[0].record, ord1, 'first details-unknown ordination should occupy first slot');
    assert.strictEqual(result.orders[1].record, cons1, 'first details-unknown consecration should occupy second slot');

    const seen = new Set(result.orders.map(o => o.record));
    assert.ok(seen.has(ord2), 'second details-unknown ordination should still appear in history');
    assert.ok(seen.has(cons2), 'second details-unknown consecration should still appear in history');
}

function testRightPanelGroupingUsesUpdatedOrdering() {
    if (!RightPanel || typeof RightPanel.groupOrdainedConsecratedByRange !== 'function') {
        throw new Error('Right panel API not available on window');
    }

    const formEvents = {
        ordinations: [makeDetailsUnknown('ordination')],
        consecrations: [makeDetailsUnknown('consecration')]
    };

    const childClergy = { id: 42, name: 'Child Bishop' };
    const childEvent = makeDated('ordination', '2000-01-01');

    const ordainedConsecrated = [
        {
            clergy: childClergy,
            event: childEvent,
            role: 'ordination',
            descendants: []
        }
    ];

    const grouped = RightPanel.groupOrdainedConsecratedByRange(formEvents, ordainedConsecrated);

    assert.ok(Array.isArray(grouped.ranges), 'ranges array should be present from right-panel grouping');
    assert.ok(Array.isArray(grouped.groups), 'groups array should be present from right-panel grouping');
    assert.ok(grouped.groups.length >= 1, 'at least one group expected when there is a descendant');

    const firstGroup = grouped.groups[0];
    assert.ok(
        firstGroup.ordained.length === 1 && firstGroup.consecrated.length === 0,
        'child ordination should appear in ordained bucket of its range group'
    );

    const snapshot = grouped.snapshotByClergyId;
    const snap = snapshot.get(42);
    assert.ok(snap, 'snapshot entry for child clergy ID should be recorded');
    assert.strictEqual(
        typeof snap.rangeIndex,
        'number',
        'snapshot for child clergy should include a numeric rangeIndex'
    );
}

function testPatrickTaylorStyleRangesAndValidity() {
    const ordUnknown = makeDetailsUnknown('ordination');
    const consUnknown = makeDetailsUnknown('consecration');

    const orders = [
        { type: 'ordination', record: ordUnknown },
        { type: 'consecration', record: consUnknown }
    ];

    const result = EditorRangesValidity.buildRangesWithValidity({ orders });

    assertOrdersTypes(
        result,
        ['ordination', 'consecration'],
        'Taylor-style: details-unknown ordination and consecration should be the first two orders'
    );

    const ranges = result.ranges;
    assert.strictEqual(ranges.length, 3, 'Taylor-style: two parent orders should yield three ranges');

    const simple = ranges.map(r => ({ index: r.index, start: r.start, end: r.end }));
    assert.deepStrictEqual(
        simple,
        [
            { index: 0, start: null, end: null },
            { index: 1, start: null, end: null },
            { index: 2, start: null, end: null }
        ],
        'Taylor-style: ranges should use null boundaries for details-unknown parent orders'
    );

    ranges.forEach((r, idx) => {
        assert.strictEqual(
            r.canValidlyOrdain,
            true,
            `Taylor-style: range ${idx} should be valid for ordination with stub ValidityRules`
        );
        assert.strictEqual(
            r.canValidlyConsecrate,
            true,
            `Taylor-style: range ${idx} should be valid for consecration with stub ValidityRules`
        );
    });
}

function testPatrickTaylorStyleRightPanelGrouping() {
    if (!RightPanel || typeof RightPanel.groupOrdainedConsecratedByRange !== 'function') {
        throw new Error('Right panel API not available on window');
    }

    const formEvents = {
        ordinations: [makeDetailsUnknown('ordination')],
        consecrations: [makeDetailsUnknown('consecration')]
    };

    const childOrdClergy = { id: 101, name: 'Child Ordinand' };
    const childConsClergy = { id: 102, name: 'Child Consecrand' };

    const childOrdEvent = {
        kind: 'ordination',
        date: '2000-01-01',
        year: null,
        date_unknown: false,
        details_unknown: false,
        display_date: '1 Jan 2000'
    };
    const childConsEvent = {
        kind: 'consecration',
        date: '2010-06-01',
        year: null,
        date_unknown: false,
        details_unknown: false,
        display_date: '1 Jun 2010'
    };

    const ordainedConsecrated = [
        {
            clergy: childOrdClergy,
            event: childOrdEvent,
            role: 'ordination',
            descendants: []
        },
        {
            clergy: childConsClergy,
            event: childConsEvent,
            role: 'consecration',
            descendants: []
        }
    ];

    const grouped = RightPanel.groupOrdainedConsecratedByRange(formEvents, ordainedConsecrated);

    assert.ok(Array.isArray(grouped.ranges), 'Taylor-style grouping: ranges array should be present');
    assert.strictEqual(grouped.ranges.length, 3, 'Taylor-style grouping: expected three ranges from parent orders');

    const simpleRanges = grouped.ranges.map(r => ({ index: r.index, start: r.start, end: r.end }));
    assert.deepStrictEqual(
        simpleRanges,
        [
            { index: 0, start: null, end: null },
            { index: 1, start: null, end: null },
            { index: 2, start: null, end: null }
        ],
        'Taylor-style grouping: ranges should mirror null-boundary representation from buildRangesWithValidity'
    );

    assert.ok(Array.isArray(grouped.groups), 'Taylor-style grouping: groups array should be present');
    assert.strictEqual(grouped.groups.length, 1, 'Taylor-style grouping: descendants should land in a single populated range group');

    const group = grouped.groups[0];
    assert.strictEqual(group.rangeIndex, 2, 'Taylor-style grouping: dated descendants should be placed in the last range (after unknown consecration)');
    assert.strictEqual(
        group.rangeLabel,
        'Range 2 — Around orders with unknown details (valid)',
        'Taylor-style grouping: range label should describe around-unknown band and validity'
    );

    assert.strictEqual(group.ordained.length, 1, 'Taylor-style grouping: one ordained descendant expected in range 2');
    assert.strictEqual(group.consecrated.length, 1, 'Taylor-style grouping: one consecrated descendant expected in range 2');

    const ordEntry = group.ordained[0];
    const consEntry = group.consecrated[0];
    assert.strictEqual(ordEntry.clergy.id, 101, 'Taylor-style grouping: ordained descendant should preserve clergy ID 101');
    assert.strictEqual(consEntry.clergy.id, 102, 'Taylor-style grouping: consecrated descendant should preserve clergy ID 102');

    const snapshot = grouped.snapshotByClergyId;
    const snapOrd = snapshot.get(101);
    const snapCons = snapshot.get(102);

    assert.ok(snapOrd, 'Taylor-style snapshot: expected entry for ordained descendant clergy ID 101');
    assert.ok(snapCons, 'Taylor-style snapshot: expected entry for consecrated descendant clergy ID 102');
    assert.strictEqual(snapOrd.rangeIndex, 2, 'Taylor-style snapshot: ordained descendant should be recorded in range 2');
    assert.strictEqual(snapCons.rangeIndex, 2, 'Taylor-style snapshot: consecrated descendant should be recorded in range 2');
    assert.strictEqual(snapOrd.isValidForOrders, true, 'Taylor-style snapshot: ordained descendant range should be valid for orders');
    assert.strictEqual(snapCons.isValidForOrders, true, 'Taylor-style snapshot: consecrated descendant range should be valid for orders');
}

function main() {
    const tests = [
        testSingleDetailsUnknownOrdination,
        testDetailsUnknownOrdinationAndConsecrationPinnedFirstSecond,
        testPinnedUnknownEventsBeforeDatedEvents,
        testDetailsUnknownConsecrationOnly,
        testMultipleDetailsUnknownEdgeCases,
        testRightPanelGroupingUsesUpdatedOrdering,
        testPatrickTaylorStyleRangesAndValidity,
        testPatrickTaylorStyleRightPanelGrouping
    ];

    let failed = 0;
    tests.forEach(fn => {
        try {
            fn();
            // eslint-disable-next-line no-console
            console.log('OK:', fn.name);
        } catch (err) {
            failed += 1;
            // eslint-disable-next-line no-console
            console.error('FAIL:', fn.name, '-', err && err.message ? err.message : err);
        }
    });

    if (failed > 0) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

