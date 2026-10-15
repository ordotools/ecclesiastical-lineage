#!/usr/bin/env node
'use strict';

/**
 * Table C dropdown restriction: orders given can be no better than the giver,
 * and a side with no recorded events must not count as invalid.
 *
 * Run from project root:
 *   node tests/test_bishop_allowed_validity.js
 */

const assert = require('assert');

global.window = {};
require('../editor_v2/static/v2-scripts/validity-rules.js');
const V = window.EditorV2Validity;

function dropdown(summary) {
    return V.getAllowedValidityValues(V.getAllowedEffectiveOrdinationStatuses(summary));
}

// Valid ordination + doubtful consecration
assert.deepStrictEqual(dropdown({
    has_valid_ordination: true, has_valid_consecration: false,
    worst_ordination_status: 'valid', worst_consecration_status: 'doubtfully_valid'
}), ['doubtfully_valid', 'invalid']);

// Doubtful event behaves like doubtfully valid
assert.deepStrictEqual(dropdown({
    has_valid_ordination: true, has_valid_consecration: false,
    worst_ordination_status: 'valid', worst_consecration_status: 'doubtful_event'
}), ['doubtfully_valid', 'invalid']);

// Invalid bishop
assert.deepStrictEqual(dropdown({
    has_valid_ordination: false, has_valid_consecration: true,
    worst_ordination_status: 'invalid', worst_consecration_status: 'valid'
}), ['invalid']);

// Not a valid bishop but nothing doubtful recorded (e.g. never consecrated) → invalid only
assert.deepStrictEqual(dropdown({
    has_valid_ordination: true, has_valid_consecration: false,
    worst_ordination_status: 'valid', worst_consecration_status: 'valid'
}), ['invalid']);

// Valid bishop: everything
assert.deepStrictEqual(dropdown({
    has_valid_ordination: true, has_valid_consecration: true,
    worst_ordination_status: 'valid', worst_consecration_status: 'valid'
}), ['valid', 'doubtfully_valid', 'invalid']);

// Empty side is neutral
assert.strictEqual(V.getWorstStatus([]), 'valid');
assert.strictEqual(V.getWorstStatus(['doubtfully_valid']), 'doubtfully_valid');

console.log('test_bishop_allowed_validity: ok');
