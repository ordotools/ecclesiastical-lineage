#!/usr/bin/env node
/**
 * Bus routing tests for succession grid edges.
 *
 * Run from project root:
 *   node tests/test_lineage_grid_router.js
 */

import assert from 'node:assert/strict';
import {
  routeAllEdges,
  rectIntersectsSegment,
  inflatedCardRect,
  parseTrunkPath,
  GRID_METRICS,
  positionY,
  stubPathKey,
} from '../static/js/lineage-grid.js';

const { CARD_H, CARD_W } = GRID_METRICS;

function linkEndpoints(link) {
  return { source: link.source, target: link.target };
}

function stubPath(paths, source, target, type = 'consecration', index = 0) {
  return paths.get(stubPathKey(source, target, { type }, index))
    || paths.get(`${source}->${target}`);
}

function parsePathPoints(pathD) {
  const nums = pathD.match(/-?\d+\.?\d*/g).map(Number);
  const points = [];
  for (let i = 0; i < nums.length; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] });
  }
  return points;
}

function pathSegments(points) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push([points[i].x, points[i].y, points[i + 1].x, points[i + 1].y]);
  }
  return segments;
}

function testSegmentMissesCards() {
  const hubY = 48;
  const timelineY = hubY + CARD_H / 2;
  const positions = {
    1: { x: 48, y: hubY },
    2: { x: 268, y: 220, side: 'below' },
  };
  const links = [{ source: 1, target: 2, type: 'consecration' }];
  const layout = {
    positions,
    primary_edges: [{ source: 1, target: 2 }],
    buses: [{
      source: 1,
      timeline_y: timelineY,
      timeline_start_x: 48 + GRID_METRICS.CARD_W,
      timeline_end_x: 268 + GRID_METRICS.CARD_W,
      targets: [{ target: 2, side: 'below' }],
    }],
  };

  const paths = routeAllEdges(links, positions, layout, linkEndpoints);
  const pathD = stubPath(paths, 1, 2);
  assert.ok(pathD, 'expected bus stub path');

  const cardRects = Object.entries(positions).map(([id, pos]) => ({
    id: Number(id),
    rect: inflatedCardRect(pos),
  }));
  pathSegments(parsePathPoints(pathD)).forEach(([x1, y1, x2, y2]) => {
    cardRects.forEach(({ id, rect }) => {
      if (id === 1 || id === 2) return;
      assert.equal(
        rectIntersectsSegment(rect, x1, y1, x2, y2),
        false,
        'segment must not intersect unrelated card',
      );
    });
  });
}

function testStubPathsAreVerticalOnly() {
  const hubY = 48;
  const timelineY = hubY + CARD_H / 2;
  const positions = {
    1: { x: 48, y: hubY },
    2: { x: 268, y: 220, side: 'below' },
    3: { x: 268, y: 40, side: 'above' },
  };
  const links = [
    { source: 1, target: 2, type: 'consecration' },
    { source: 1, target: 3, type: 'consecration' },
  ];
  const layout = {
    positions,
    primary_edges: [{ source: 1, target: 2 }, { source: 1, target: 3 }],
    buses: [{
      source: 1,
      timeline_y: timelineY,
      timeline_start_x: 48 + GRID_METRICS.CARD_W,
      timeline_end_x: 268 + GRID_METRICS.CARD_W,
      targets: [
        { target: 3, side: 'above' },
        { target: 2, side: 'below' },
      ],
    }],
  };

  const paths = routeAllEdges(links, positions, layout, linkEndpoints);
  [stubPath(paths, 1, 2), stubPath(paths, 1, 3)].forEach((pathD) => {
    assert.ok(pathD, 'expected bus stub path');
    const points = parsePathPoints(pathD);
    assert.equal(points.length, 2, 'stub should be one vertical segment');
    assert.equal(points[0].x, points[1].x, 'stub segment should be vertical');
  });
}

function testBusRouting() {
  const hubY = 200;
  const timelineY = hubY + CARD_H / 2;
  const positions = {
    10: { x: 48, y: hubY },
    11: { x: 268, y: 80, side: 'above' },
    12: { x: 488, y: 320, side: 'below' },
  };
  const links = [
    { source: 10, target: 11, type: 'consecration' },
    { source: 10, target: 12, type: 'consecration' },
  ];
  const layout = {
    positions,
    primary_edges: [{ source: 10, target: 11 }, { source: 10, target: 12 }],
    buses: [{
      source: 10,
      timeline_y: timelineY,
      targets: [
        { target: 11, side: 'above' },
        { target: 12, side: 'below' },
      ],
    }],
  };

  const paths = routeAllEdges(links, positions, layout, linkEndpoints);
  assert.ok(stubPath(paths, 10, 11), 'bus child 11 routed');
  assert.ok(stubPath(paths, 10, 12), 'bus child 12 routed');
}

function testBusTrunkAtParentMidline() {
  const hubY = 150;
  const timelineY = hubY + CARD_H / 2;
  const positions = {
    10: { x: 48, y: hubY },
    11: { x: 268, y: 40, side: 'above' },
  };
  const links = [{ source: 10, target: 11, type: 'consecration' }];
  const layout = {
    positions,
    primary_edges: [{ source: 10, target: 11 }],
    buses: [{
      source: 10,
      timeline_y: timelineY,
      targets: [{ target: 11, side: 'above' }],
    }],
  };

  const paths = routeAllEdges(links, positions, layout, linkEndpoints);
  const trunk = parseTrunkPath(paths.get('bus-trunk:10'));
  assert.ok(trunk, 'bus trunk path should exist');
  assert.ok(Math.abs(trunk.y - timelineY) < 0.01, `trunk Y should be parent midline ${timelineY}`);
}

function testBusStubPathsVerticalOnly() {
  const hubY = 150;
  const timelineY = hubY + CARD_H / 2;
  const positions = {
    10: { x: 48, y: hubY },
    11: { x: 268, y: 40, side: 'above' },
    12: { x: 488, y: 320, side: 'below' },
  };
  const child11Rect = inflatedCardRect(positions[11]);
  const child12Rect = inflatedCardRect(positions[12]);
  const timelineStartX = positions[10].x + GRID_METRICS.CARD_W;
  const timelineEndX = positions[12].x + GRID_METRICS.CARD_W;
  const layout = {
    positions,
    primary_edges: [{ source: 10, target: 11 }, { source: 10, target: 12 }],
    buses: [{
      source: 10,
      timeline_y: timelineY,
      timeline_start_x: timelineStartX,
      timeline_end_x: timelineEndX,
      targets: [
        { target: 11, side: 'above' },
        { target: 12, side: 'below' },
      ],
    }],
  };
  const links = [
    { source: 10, target: 11, type: 'consecration' },
    { source: 10, target: 12, type: 'consecration' },
  ];

  const paths = routeAllEdges(links, positions, layout, linkEndpoints);
  const trunkEndX = timelineEndX;

  assert.ok(paths.get('bus-trunk:10'), 'bus trunk path should be returned');
  ['10->11', '10->12'].forEach((legacyKey) => {
    const [source, target] = legacyKey.split('->').map(Number);
    const pathD = stubPath(paths, source, target);
    assert.ok(pathD, `expected routed path for ${legacyKey}`);
    const points = parsePathPoints(pathD);
    assert.equal(points.length, 2, 'stub path should be a single vertical segment');
    const first = points[0];
    assert.notEqual(first.x, trunkEndX, 'stub path must not start at trunk end (RTL fan)');
    const childRect = legacyKey === '10->11' ? child11Rect : child12Rect;
    const stubX = childRect.x + childRect.w / 2;
    assert.equal(first.x, stubX, 'stub path should start at child center X on trunk');
    assert.equal(points[0].x, points[1].x, 'stub segment should be vertical');
    const side = legacyKey === '10->11' ? 'above' : 'below';
    const expectedEdgeY = side === 'above'
      ? positionY(positions[11]) + CARD_H
      : positionY(positions[12]);
    assert.equal(points[1].y, expectedEdgeY, 'stub should end on real card edge');
  });

  const trunk = parseTrunkPath(paths.get('bus-trunk:10'));
  assert.ok(trunk, 'trunk path should parse');
  assert.ok(Math.abs(trunk.y - timelineY) < 0.01, 'trunk on parent midline');
  assert.ok(trunk.xMin <= timelineStartX + 1, 'trunk starts at card right');
  assert.ok(trunk.xMax >= timelineEndX - 1, 'trunk spans to last child');
}

function testMultiRelationStubPaths() {
  const hubY = 150;
  const timelineY = hubY + CARD_H / 2;
  const positions = {
    10: { x: 48, y: hubY },
    11: { x: 268, y: 40, side: 'above' },
  };
  const links = [
    { source: 10, target: 11, type: 'ordination', event_sort_key: 19700101 },
    { source: 10, target: 11, type: 'consecration', event_sort_key: 19800101 },
  ];
  const layout = {
    positions,
    primary_edges: [{ source: 10, target: 11 }],
    buses: [{
      source: 10,
      timeline_y: timelineY,
      timeline_start_x: 48 + GRID_METRICS.CARD_W,
      timeline_end_x: 268 + GRID_METRICS.CARD_W,
      targets: [{ target: 11, side: 'above' }],
    }],
  };

  const paths = routeAllEdges(links, positions, layout, linkEndpoints);
  const ordPath = paths.get('10->11:ordination:0');
  const consPath = paths.get('10->11:consecration:1');
  assert.ok(ordPath, 'ordination stub path should exist');
  assert.ok(consPath, 'consecration stub path should exist');

  const centerX = positions[11].x + CARD_W / 2;
  const ordPoints = parsePathPoints(ordPath);
  const consPoints = parsePathPoints(consPath);
  assert.ok(ordPoints[0].x < centerX, 'ordination stub should sit left of center');
  assert.ok(consPoints[0].x > centerX, 'consecration stub should sit right of center');
  assert.equal(
    (consPoints[0].x - centerX) + (centerX - ordPoints[0].x),
    GRID_METRICS.MULTI_STUB_GAP,
    'multi-relation stubs should be symmetric about card center',
  );
}

function testSameYDisjointXStraightTrunk() {
  const hubY = 150;
  const timelineY = hubY + CARD_H / 2;
  const positions = {
    10: { x: 48, y: hubY },
    11: { x: 268, y: 40, side: 'above' },
    20: { x: 48, y: 400 },
    21: { x: 268, y: 290, side: 'above' },
  };
  const layout = {
    positions,
    primary_edges: [],
    buses: [
      {
        source: 10,
        timeline_y: timelineY,
        timeline_start_x: 48 + CARD_W,
        timeline_end_x: 268 + CARD_W,
        targets: [{ target: 11, side: 'above' }],
      },
      {
        source: 20,
        timeline_y: timelineY,
        timeline_start_x: 48 + CARD_W,
        timeline_end_x: 268 + CARD_W,
        targets: [{ target: 21, side: 'above' }],
      },
    ],
  };

  const paths = routeAllEdges([], positions, layout, linkEndpoints);
  const trunk10 = paths.get('bus-trunk:10');
  const trunk20 = paths.get('bus-trunk:20');
  assert.ok(trunk10, 'first bus trunk should exist');
  assert.ok(trunk20, 'second bus trunk should exist');

  [trunk10, trunk20].forEach((pathD, idx) => {
    const points = parsePathPoints(pathD);
    assert.equal(points.length, 2, `bus ${idx} trunk should be a single horizontal segment`);
    assert.equal(points[0].y, timelineY, `bus ${idx} trunk should stay on parent midline`);
    assert.equal(points[1].y, timelineY, `bus ${idx} trunk should stay on parent midline`);
    assert.ok(points[1].x > points[0].x, `bus ${idx} trunk should run left-to-right`);
  });
}

function testMissingHubSkipsTrunk() {
  const timelineY = 150 + CARD_H / 2;
  const positions = {
    11: { x: 268, y: 40, side: 'above' },
  };
  const layout = {
    positions,
    primary_edges: [],
    buses: [{
      source: 10,
      timeline_y: timelineY,
      timeline_start_x: 48 + CARD_W,
      timeline_end_x: 268 + CARD_W,
      targets: [{ target: 11, side: 'above' }],
    }],
  };
  const links = [{ source: 10, target: 11, type: 'consecration' }];

  const paths = routeAllEdges(links, positions, layout, linkEndpoints);
  assert.equal(paths.get('bus-trunk:10'), undefined, 'missing hub should not emit bus trunk');
}

const tests = [
  testSegmentMissesCards,
  testStubPathsAreVerticalOnly,
  testBusRouting,
  testBusTrunkAtParentMidline,
  testBusStubPathsVerticalOnly,
  testMultiRelationStubPaths,
  testSameYDisjointXStraightTrunk,
  testMissingHubSkipsTrunk,
];

let failures = 0;
for (const test of tests) {
  try {
    test();
    console.log(`OK  ${test.name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${test.name}: ${err.message}`);
  }
}

if (failures) process.exit(1);
console.log('All lineage grid router tests passed.');
