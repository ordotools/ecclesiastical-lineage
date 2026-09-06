#!/usr/bin/env node
/**
 * Layout tests for timeline-packing grid (client-side).
 *
 * Run from project root:
 *   node tests/test_lineage_grid_layout.js
 */

import assert from 'node:assert/strict';
import {
  computeLineageGridLayout,
  GRID_METRICS,
} from '../static/js/lineage-grid-layout.js';

const {
  CARD_H,
  CARD_W,
  DATE_SCALE,
  GAP_X,
  GAP_Y,
  MIN_CHILD_GAP,
  MIN_BRANCH_GAP,
  MULTI_STUB_GAP,
  PAD,
} = {
  ...GRID_METRICS,
  MIN_CHILD_GAP: GRID_METRICS.CARD_W + GRID_METRICS.GAP_X,
};

const FIXTURE_NODES = [
  { id: 1, name: 'Root Alpha', consecration_date: '1950-01-01', is_lineage_root: true, is_bishop: true },
  { id: 2, name: 'Root Beta', consecration_date: '1952-01-01', is_lineage_root: true, is_bishop: true },
  { id: 3, name: 'Child One', consecration_date: '1970-06-01', is_bishop: true },
  { id: 4, name: 'Child Two', consecration_date: '1971-03-15', is_bishop: true },
  { id: 5, name: 'Grandchild', consecration_date: '1990-09-20', is_bishop: true },
  { id: 6, name: 'Priest Only', rank: 'Priest', ordination_date: '1985-01-01' },
];

const FIXTURE_LINKS = [
  {
    source: 1, target: 3, type: 'consecration',
    event_sort_key: 19700601, is_sub_conditione: false, is_invalid: false,
  },
  {
    source: 1, target: 4, type: 'consecration',
    event_sort_key: 19710315, is_sub_conditione: false, is_invalid: false,
  },
  {
    source: 2, target: 4, type: 'consecration',
    event_sort_key: 19710315, is_sub_conditione: true, is_invalid: false,
  },
  {
    source: 3, target: 5, type: 'consecration',
    event_sort_key: 19900920, is_sub_conditione: false, is_invalid: false,
  },
  {
    source: 1, target: 6, type: 'ordination',
    event_sort_key: 19850101, is_sub_conditione: false, is_invalid: false,
  },
];

function positionsSnapshot(layout) {
  const snap = {};
  Object.entries(layout.positions).forEach(([nodeId, pos]) => {
    snap[Number(nodeId)] = [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10];
  });
  return snap;
}

function cardRect(pos) {
  return {
    left: pos.x,
    top: pos.y,
    right: pos.x + CARD_W,
    bottom: pos.y + CARD_H,
  };
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function assertNoCardOverlap(layout) {
  const rects = Object.values(layout.positions).map(cardRect);
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      assert.ok(!rectsOverlap(rects[i], rects[j]), `cards ${i} and ${j} overlap`);
    }
  }
}

function testFixturePrimaryEdgesAndMetrics() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });

  assert.ok(!(6 in layout.positions), 'priests excluded by default');
  assert.equal(layout.metrics[1].total_descendants, 3);
  assert.equal(layout.metrics[2].total_descendants, 0);
  assert.deepEqual(layout.primary_edges, [
    { source: 1, target: 3 },
    { source: 1, target: 4 },
    { source: 3, target: 5 },
  ]);
}

function testLargestDescendantTreeFirst() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const pos = layout.positions;

  assert.ok(pos[1].y < pos[2].y, 'larger tree (node 1) should sit above smaller root (node 2)');
}

function testShowPriestsIncludesNonConsecrated() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: true });
  assert.ok(6 in layout.positions);
}

function testDeterministicRepeat() {
  const first = positionsSnapshot(computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS));
  const second = positionsSnapshot(computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS));
  assert.deepEqual(first, second);
}

function testCycleBreakingIsStable() {
  const cyclicNodes = [
    { id: 10, name: 'A' },
    { id: 11, name: 'B' },
    { id: 12, name: 'C' },
  ];
  const cyclicLinks = [
    { source: 10, target: 11, type: 'consecration', event_sort_key: 20000101 },
    { source: 11, target: 12, type: 'consecration', event_sort_key: 20010101 },
    { source: 12, target: 10, type: 'consecration', event_sort_key: 20020101 },
  ];
  const layout = computeLineageGridLayout(cyclicNodes, cyclicLinks);
  assert.equal(Object.keys(layout.positions).length, 3);
  assert.deepEqual(
    positionsSnapshot(layout),
    positionsSnapshot(computeLineageGridLayout(cyclicNodes, cyclicLinks)),
  );
}

function testChildrenAlternateAboveAndBelow() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const pos = layout.positions;

  assert.equal(pos[3].side, 'above');
  assert.equal(pos[4].side, 'below');
  assert.ok(pos[3].y < pos[1].y);
  assert.ok(pos[4].y > pos[1].y);
}

function testDateOrderLeftToRight() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const pos = layout.positions;

  assert.ok(pos[3].x < pos[5].x, '1970 child should be left of 1990 grandchild on same rail');
}

function testLargerYearGapWiderX() {
  const nodes = [
    { id: 1, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 2, name: 'Early', consecration_date: '1980-01-01', is_bishop: true },
    { id: 3, name: 'LateBelow', consecration_date: '2000-01-01', is_bishop: true },
    { id: 4, name: 'LateAbove', consecration_date: '2005-01-01', is_bishop: true },
  ];
  const links = [
    { source: 1, target: 2, type: 'consecration', event_sort_key: 19800101 },
    { source: 1, target: 3, type: 'consecration', event_sort_key: 20000101 },
    { source: 1, target: 4, type: 'consecration', event_sort_key: 20050101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  const originEarly = pos[2].x + CARD_W / 2;
  const originLate = pos[4].x + CARD_W / 2;
  assert.ok(originLate > originEarly, 'later child origin should sit right of earlier');
  assert.ok(originLate - originEarly >= MIN_BRANCH_GAP - 0.01,
    'leaf branch origins should respect minimal even pitch');
}

function testNestedChildHubVerticalOffset() {
  const hubId = 10;
  const childHubId = 20;
  const nodes = [
    { id: hubId, name: 'Parent Hub', is_lineage_root: true, is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
  ];
  const links = [];
  for (let i = 0; i < 5; i += 1) {
    const leafId = 100 + i;
    nodes.push({ id: leafId, name: `Leaf ${i}`, is_bishop: true });
    links.push({
      source: childHubId,
      target: leafId,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }
  links.push({
    source: hubId,
    target: childHubId,
    type: 'consecration',
    event_sort_key: 19900101,
  });

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  const timeline = pos[hubId].y + CARD_H / 2;
  const child = pos[childHubId];

  let gap;
  if (child.side === 'above') {
    gap = timeline - (child.y + CARD_H);
  } else {
    gap = child.y - timeline;
  }
  assert.ok(gap >= GAP_Y - 1, 'child hub should clear parent timeline by at least GAP_Y');

  const childHubBus = layout.buses.find((b) => b.source === childHubId);
  assert.equal(childHubBus.targets.length, 5);
  assertNoCardOverlap(layout);
}

function testUnknownDatesAfterKnown() {
  const nodes = [
    { id: 1, name: 'Root', is_lineage_root: true, is_bishop: true },
    { id: 2, name: 'Dated', consecration_date: '1985-01-01', is_bishop: true },
    { id: 3, name: 'Spacer', is_bishop: true },
    { id: 4, name: 'Unknown', is_bishop: true },
  ];
  const links = [
    { source: 1, target: 2, type: 'consecration', event_sort_key: 19850101 },
    { source: 1, target: 3, type: 'consecration', event_sort_key: 19900101 },
    { source: 1, target: 4, type: 'consecration' },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  assert.ok(pos[2].x < pos[4].x, 'unknown-date child should sit right of dated child on same rail');
}

function testUniquePositions() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const coords = Object.values(layout.positions).map((pos) => [
    Math.round(pos.x * 10) / 10,
    Math.round(pos.y * 10) / 10,
  ]);
  assert.equal(new Set(coords.map(JSON.stringify)).size, coords.length);
}

function testGridMetricsMatchFrontend() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS);
  const gm = layout.grid_metrics;
  assert.equal(gm.CARD_W, 168);
  assert.equal(gm.CARD_H, 136);
  assert.equal(gm.GAP_X, 52);
  assert.equal(gm.GAP_Y, 64);
  assert.equal(gm.PAD, 48);
  assert.equal(gm.CARD_INSET, 4);
  assert.equal(gm.LANE_PITCH, 9);
  assert.equal(gm.DATE_SCALE, 8);
  assert.equal(gm.MIN_BRANCH_GAP, 48);
  assert.equal(gm.MULTI_STUB_GAP, 14);
}

function testBusEndAtDirectChildCardsNotNested() {
  const hubId = 100;
  const childHubId = 200;
  const nodes = [
    { id: hubId, name: 'Parent Hub', is_lineage_root: true, is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
  ];
  const links = [];
  for (let i = 0; i < 5; i += 1) {
    const leafId = 300 + i;
    nodes.push({ id: leafId, name: `Leaf ${i}`, is_bishop: true });
    links.push({
      source: childHubId,
      target: leafId,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }
  links.push({
    source: hubId,
    target: childHubId,
    type: 'consecration',
    event_sort_key: 19900101,
  });

  const layout = computeLineageGridLayout(nodes, links);
  const bus = layout.buses.find((b) => b.source === hubId);
  const pos = layout.positions;
  const hubX = pos[hubId].x;
  const childHubRight = pos[childHubId].x + CARD_W;
  const nestedLeafRight = Math.max(...[300, 301, 302, 303, 304].map((id) => pos[id].x + CARD_W));

  assert.ok(bus, 'parent hub should emit a bus');
  assert.equal(bus.timeline_start_x, hubX + CARD_W);
  assert.ok(Math.abs(bus.timeline_end_x - childHubRight) < 0.01,
    'bus end should stop at direct child card, not nested descendants');
  assert.ok(nestedLeafRight > bus.timeline_end_x,
    'nested descendants should extend past parent bus trunk');
}

function testChronologicalOriginsWithMinGap() {
  const hubId = 10;
  const nodes = [
    { id: hubId, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 11, name: 'Above', is_bishop: true },
    { id: 12, name: 'Below', is_bishop: true },
    { id: 13, name: 'Later', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: 11, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: 12, type: 'consecration', event_sort_key: 19810101 },
    { source: hubId, target: 13, type: 'consecration', event_sort_key: 19820101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;

  assert.equal(pos[11].side, 'above');
  assert.equal(pos[12].side, 'below');
  assert.ok(pos[12].x > pos[11].x, 'later event should sit right of earlier event');
  assert.ok(pos[13].x > pos[12].x, 'third event should continue LTR');

  const origins = [11, 12, 13].map((id) => pos[id].x + CARD_W / 2);
  const pitch1 = origins[1] - origins[0];
  assert.ok(Math.abs(pitch1 - MIN_BRANCH_GAP) < 0.01,
    `first two leaf origins should use minimal pitch, got ${pitch1}`);
  assert.ok(origins[2] > origins[1], 'third event should continue LTR');
  assert.ok(origins[2] > origins[0], 'third above-rail origin clears first after same-rail bump');
}

function testLeafBranchUsesMinimalEvenPitch() {
  const hubId = 20;
  const nodes = [
    { id: hubId, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 21, name: 'A', is_bishop: true },
    { id: 22, name: 'B', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: 21, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: 22, type: 'consecration', event_sort_key: 19810101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const origins = [21, 22].map((id) => layout.positions[id].x + CARD_W / 2);
  assert.ok(Math.abs(origins[1] - origins[0] - MIN_BRANCH_GAP) < 0.01);
}

function testBusHubDisplacesOnlyWhenNeeded() {
  const hubId = 30;
  const childHubId = 40;
  const nodes = [
    { id: hubId, name: 'Parent Hub', is_lineage_root: true, is_bishop: true },
    { id: 31, name: 'Leaf A', is_bishop: true },
    { id: 32, name: 'Leaf B', is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: 31, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: 32, type: 'consecration', event_sort_key: 19810101 },
    { source: hubId, target: childHubId, type: 'consecration', event_sort_key: 19820101 },
  ];
  for (let i = 0; i < 5; i += 1) {
    const leafId = 500 + i;
    nodes.push({ id: leafId, name: `Nested ${i}`, is_bishop: true });
    links.push({
      source: childHubId,
      target: leafId,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  const hubX = pos[hubId].x;
  const originA = pos[31].x + CARD_W / 2 - hubX;
  const originB = pos[32].x + CARD_W / 2 - hubX;
  const originHub = pos[childHubId].x + CARD_W / 2 - hubX;

  assert.ok(Math.abs(originB - originA - MIN_BRANCH_GAP) < 0.01,
    'first two leaf origins should stay at minimal pitch');
  assert.ok(originHub > originB + MIN_BRANCH_GAP - 0.01,
    'child hub origin should be pushed right by subtree interference');
}

function testMultiRelationWidensOriginGroup() {
  const nodes = [
    { id: 1, name: 'Hub', is_bishop: true, is_lineage_root: true },
    { id: 2, name: 'Target', is_bishop: true, consecrations_count: 1 },
    { id: 3, name: 'Single', is_bishop: true },
  ];
  const links = [
    { source: 1, target: 2, type: 'ordination', event_sort_key: 19700101 },
    { source: 1, target: 2, type: 'consecration', event_sort_key: 19800101 },
    { source: 1, target: 3, type: 'consecration', event_sort_key: 19900101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;

  assert.ok(pos[2], 'multi-relation target gets one card');
  assert.ok(pos[3], 'third child gets one card');
  const gap12 = (pos[3].x + CARD_W / 2) - (pos[2].x + CARD_W / 2);
  const minPitch = (2 - 1) * MULTI_STUB_GAP + MIN_BRANCH_GAP;
  assert.ok(gap12 >= minPitch - 0.01,
    `gap after multi-relation child should respect multi-relation min pitch, got ${gap12}`);
}

function testBishopIgnoresOrdinationIncoming() {
  const nodes = [
    { id: 1, name: 'Ordainer', is_bishop: true, is_lineage_root: true },
    { id: 2, name: 'Consecrator', is_bishop: true, is_lineage_root: true },
    { id: 3, name: 'Bishop Target', is_bishop: true, consecrations_count: 1 },
  ];
  const links = [
    { source: 1, target: 3, type: 'ordination', event_sort_key: 19700101 },
    {
      source: 2, target: 3, type: 'consecration',
      event_sort_key: 19800101, is_sub_conditione: false, is_invalid: false,
    },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.deepEqual(layout.primary_edges, [{ source: 2, target: 3 }]);
}

function testPrimarySuccessionPicksMostValidThenLatest() {
  const nodes = [
    { id: 1, name: 'A', is_bishop: true, is_lineage_root: true },
    { id: 2, name: 'B', is_bishop: true, is_lineage_root: true },
    { id: 3, name: 'C', is_bishop: true },
  ];
  const links = [
    {
      source: 1, target: 3, type: 'consecration',
      event_sort_key: 19700101, is_invalid: true,
    },
    {
      source: 2, target: 3, type: 'consecration',
      event_sort_key: 19800101, is_doubtfully_valid: true,
    },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.deepEqual(layout.primary_edges, [{ source: 2, target: 3 }]);
}

function testInvalidOnlySuccessionStillCreatesBus() {
  const nodes = [
    { id: 1, name: 'Hub', is_bishop: true, is_lineage_root: true },
    { id: 2, name: 'Child', is_bishop: true },
  ];
  const links = [
    {
      source: 1, target: 2, type: 'consecration',
      event_sort_key: 19800101, is_invalid: true,
    },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.equal(layout.buses.length, 1);
  assert.deepEqual(layout.primary_edges, [{ source: 1, target: 2 }]);
}

function testOrdinationChildUsesBusWhenShowPriests() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: true });
  const bus = layout.buses.find((b) => b.source === 1);
  assert.ok(bus, 'hub with priest child should emit bus');
  assert.ok(bus.targets.some((t) => t.target === 6), 'priest ordination child should be on bus');
  assert.ok(layout.primary_edges.some((e) => e.source === 1 && e.target === 6));
}

function testCoConsecrationNotLayoutParent() {
  const nodes = [
    { id: 2, name: 'Visible Co', consecration_date: '1952-01-01', is_bishop: true },
    { id: 3, name: 'Successor', consecration_date: '1970-06-01', is_bishop: true, consecrations_count: 1 },
  ];
  const links = [
    {
      source: 2, target: 3, type: 'co-consecration',
      event_sort_key: 19700601, is_sub_conditione: false, is_invalid: false,
    },
    {
      source: 2, target: 3, type: 'consecration',
      event_sort_key: 19700601, is_sub_conditione: false, is_invalid: false,
    },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.deepEqual(layout.primary_edges, [{ source: 2, target: 3 }]);
}

function testBusTimelineBounds() {
  const hubId = 100;
  const nodes = [{ id: hubId, name: 'Hub Bishop', is_lineage_root: true, is_bishop: true }];
  const links = [];
  for (let i = 0; i < 3; i += 1) {
    const childId = 200 + i;
    nodes.push({ id: childId, name: `Child ${i}`, is_bishop: true });
    links.push({
      source: hubId,
      target: childId,
      type: 'consecration',
      event_sort_key: 19800101 + i * 10000,
    });
  }

  const layout = computeLineageGridLayout(nodes, links);
  const bus = layout.buses[0];
  const hubX = layout.positions[hubId].x;

  assert.equal(bus.timeline_start_x, hubX + CARD_W);
  assert.ok(bus.timeline_end_x >= bus.timeline_start_x);
  assert.ok(Math.abs(bus.timeline_y - (layout.positions[hubId].y + CARD_H / 2)) < 0.01);
}

function testChildrenStrictlyLtrWithinBus() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const pos = layout.positions;
  const bus = layout.buses.find((b) => b.source === 1);
  const timelineStart = bus.timeline_start_x;

  const childIds = bus.targets.map((entry) => entry.target);
  childIds.forEach((childId) => {
    assert.ok(pos[childId].x >= timelineStart + GAP_X - 0.01);
  });

  for (let i = 0; i < childIds.length - 1; i += 1) {
    const left = childIds[i];
    const right = childIds[i + 1];
    assert.ok(
      pos[right].x + CARD_W / 2 > pos[left].x + CARD_W / 2,
      'bus children should advance chronologically left-to-right by origin',
    );
  }
}

function testHubEmitsBusWithTimelineY() {
  const hubId = 100;
  const nodes = [{ id: hubId, name: 'Hub Bishop', is_lineage_root: true, is_bishop: true }];
  const links = [];
  for (let i = 0; i < 4; i += 1) {
    const childId = 200 + i;
    nodes.push({ id: childId, name: `Child ${i}`, is_bishop: true });
    links.push({
      source: hubId,
      target: childId,
      type: 'consecration',
      event_sort_key: 19800101 + i * 10000,
    });
  }

  const layout = computeLineageGridLayout(nodes, links);
  assert.equal(layout.buses.length, 1);
  const bus = layout.buses[0];
  assert.equal(bus.source, hubId);
  assert.ok('timeline_y' in bus);
  assert.equal(bus.targets.length, 4);
  const expectedTimeline = layout.positions[hubId].y + CARD_H / 2;
  assert.ok(Math.abs(bus.timeline_y - expectedTimeline) < 0.01);
}

function testBoundsPresent() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS);
  assert.ok(layout.bounds.width >= PAD + CARD_W);
  assert.ok(layout.bounds.height >= PAD + CARD_H);
}

function testHiddenParentMakesChildFirstClergy() {
  // Hidden primary consecrator omitted from payload; visible co-consecration only.
  const nodes = [
    { id: 2, name: 'Visible Co', consecration_date: '1952-01-01', is_bishop: true },
    { id: 3, name: 'Successor', consecration_date: '1970-06-01', is_bishop: true, consecrations_count: 1 },
  ];
  const links = [
    {
      source: 2, target: 3, type: 'co-consecration',
      event_sort_key: 19700601, is_sub_conditione: false, is_invalid: false,
    },
  ];

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;

  assert.ok(3 in pos);
  assert.ok(2 in pos);
  assert.equal(pos[3].x, PAD, 'successor with no visible consecration parent sits at left edge');
  assert.ok(
    pos[3].x <= pos[2].x + 1,
    'successor should not hang off visible co-consecrator as layout parent',
  );
  assert.deepEqual(layout.first_clergy_ids, [2, 3]);
  assert.deepEqual(layout.primary_edges, []);
}

function testSharedHiddenAncestorCreatesSeparateLeftSeeds() {
  const nodes = [
    { id: 10, name: 'Visible A', is_bishop: true, consecrations_count: 1 },
    { id: 11, name: 'Orphan C', is_bishop: true, consecrations_count: 1 },
    { id: 12, name: 'Orphan D', is_bishop: true, consecrations_count: 1 },
  ];
  const links = [];

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;

  assert.ok(11 in pos);
  assert.ok(12 in pos);
  assert.equal(pos[11].x, PAD);
  assert.equal(pos[12].x, PAD);
  assert.deepEqual(layout.first_clergy_ids, [10, 11, 12]);
  assert.ok(pos[11].y !== pos[12].y, 'separate first-clergy clusters stack vertically');
}

function testOrphanBishopWithConsecrationsStillAppears() {
  const nodes = [
    {
      id: 20,
      name: 'Orphan Bishop',
      is_bishop: true,
      consecrations_count: 1,
      consecration_date: '1980-01-01',
    },
  ];
  const links = [];

  const layout = computeLineageGridLayout(nodes, links);
  assert.ok(20 in layout.positions);
  assert.deepEqual(layout.first_clergy_ids, [20]);
  assert.equal(layout.positions[20].x, PAD);
}

function testNoCardOverlapOnFixture() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  assertNoCardOverlap(layout);
}

function testTwoTrueRootsStackVertically() {
  const nodes = [
    { id: 1, name: 'Root A', consecration_date: '1950-01-01', is_bishop: true },
    { id: 2, name: 'Root B', consecration_date: '1952-01-01', is_bishop: true },
  ];
  const links = [];
  const layout = computeLineageGridLayout(nodes, links);
  assert.equal(layout.positions[1].x, PAD);
  assert.equal(layout.positions[2].x, PAD);
  assert.ok(layout.positions[1].y !== layout.positions[2].y, 'disjoint roots should stack');
  assert.deepEqual(layout.first_clergy_ids, [1, 2]);
  assertNoCardOverlap(layout);
}

const tests = [
  ['testFixturePrimaryEdgesAndMetrics', testFixturePrimaryEdgesAndMetrics],
  ['testLargestDescendantTreeFirst', testLargestDescendantTreeFirst],
  ['testShowPriestsIncludesNonConsecrated', testShowPriestsIncludesNonConsecrated],
  ['testDeterministicRepeat', testDeterministicRepeat],
  ['testCycleBreakingIsStable', testCycleBreakingIsStable],
  ['testChildrenAlternateAboveAndBelow', testChildrenAlternateAboveAndBelow],
  ['testDateOrderLeftToRight', testDateOrderLeftToRight],
  ['testLargerYearGapWiderX', testLargerYearGapWiderX],
  ['testNestedChildHubVerticalOffset', testNestedChildHubVerticalOffset],
  ['testUnknownDatesAfterKnown', testUnknownDatesAfterKnown],
  ['testUniquePositions', testUniquePositions],
  ['testGridMetricsMatchFrontend', testGridMetricsMatchFrontend],
  ['testBusEndAtDirectChildCardsNotNested', testBusEndAtDirectChildCardsNotNested],
  ['testChronologicalOriginsWithMinGap', testChronologicalOriginsWithMinGap],
  ['testLeafBranchUsesMinimalEvenPitch', testLeafBranchUsesMinimalEvenPitch],
  ['testBusHubDisplacesOnlyWhenNeeded', testBusHubDisplacesOnlyWhenNeeded],
  ['testMultiRelationWidensOriginGroup', testMultiRelationWidensOriginGroup],
  ['testBishopIgnoresOrdinationIncoming', testBishopIgnoresOrdinationIncoming],
  ['testPrimarySuccessionPicksMostValidThenLatest', testPrimarySuccessionPicksMostValidThenLatest],
  ['testInvalidOnlySuccessionStillCreatesBus', testInvalidOnlySuccessionStillCreatesBus],
  ['testOrdinationChildUsesBusWhenShowPriests', testOrdinationChildUsesBusWhenShowPriests],
  ['testCoConsecrationNotLayoutParent', testCoConsecrationNotLayoutParent],
  ['testBusTimelineBounds', testBusTimelineBounds],
  ['testChildrenStrictlyLtrWithinBus', testChildrenStrictlyLtrWithinBus],
  ['testHubEmitsBusWithTimelineY', testHubEmitsBusWithTimelineY],
  ['testBoundsPresent', testBoundsPresent],
  ['testHiddenParentMakesChildFirstClergy', testHiddenParentMakesChildFirstClergy],
  ['testSharedHiddenAncestorCreatesSeparateLeftSeeds', testSharedHiddenAncestorCreatesSeparateLeftSeeds],
  ['testOrphanBishopWithConsecrationsStillAppears', testOrphanBishopWithConsecrationsStillAppears],
  ['testNoCardOverlapOnFixture', testNoCardOverlapOnFixture],
  ['testTwoTrueRootsStackVertically', testTwoTrueRootsStackVertically],
];

let failures = 0;
tests.forEach(([name, fn]) => {
  try {
    fn();
    console.log(`OK  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${name}:`, err.message);
  }
});

if (failures) {
  process.exit(1);
}
console.log('All lineage grid layout tests passed.');
