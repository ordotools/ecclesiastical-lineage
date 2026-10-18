#!/usr/bin/env node
/**
 * Grid "Sources" dialog: evidence grouped by birth, death, then each order in date order.
 *
 *   node tests/test_lineage_grid_sources.js
 */

import assert from 'node:assert/strict';
import { groupEvidence } from '../static/js/lineage-grid.js';

const node = {
  orders: [
    { kind: 'consecration', id: 7, date: '1980-05-01', sort_key: 19800501, bishop: { name: 'Bp. B' } },
    { kind: 'ordination', id: 3, date: '1975', sort_key: 19750000, bishop: null },
    { kind: 'ordination', id: 4, date: '1976', sort_key: 19760000, bishop: { name: 'Bp. C' } },
  ],
};
const items = [
  { id: 1, kind: 'text', consecration_id: 7, field: 'bishop' },
  { id: 2, kind: 'link', ordination_id: 3, field: 'date' },
  { id: 3, kind: 'text', field: 'date_of_death' },
  { id: 4, kind: 'pdf', consecration_id: 7, field: 'date' },
  { id: 5, kind: 'text', field: 'date_of_birth' },
  { id: 6, kind: 'text', consecration_id: 7, field: 'bishop' },
];

const groups = groupEvidence(node, items);
assert.deepEqual(groups.map((g) => g.title), [
  'Date of birth',
  'Date of death',
  'Ordination · 1975 · unknown bishop',
  'Consecration · 1980-05-01 · Bp. B',
], 'birth, death, then orders by date; orders without evidence left out');
assert.deepEqual(Object.keys(groups[3].fields), ['Bishop', 'Date']);
assert.deepEqual(groups[3].fields.Bishop.map((i) => i.id), [1, 6]);
assert.deepEqual(groups[0].fields, { '': [items[4]] }, 'clergy dates have no sub-label');
assert.deepEqual(groupEvidence({}, []), []);

console.log('ok');
