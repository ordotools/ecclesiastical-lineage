// Two-pass contour layout on a cell grid, site bus style: each node is one card spanning
// `cardRows` rows; its bus (trunk) runs along the card's middle row to its last child's column.
// Child j sits in column parentCol+1+j, alternating above/below the trunk, with its near edge
// `busOffset` rows from the trunk. measure() computes each subtree's per-column row extent and
// stacks sibling blocks nearest-first (later siblings hug the trunk, earlier ones sit further
// out), so cards, trunks and stubs can never collide and no shifting or retrying is needed.
// Separate lineages (a forest) are skyline-packed side by side, largest first, into a canvas
// whose width targets `packAspect` (pixel width / height; `cellAspect` = column pitch / row
// pitch converts cells to pixels), keeping `lineageGap` empty cells between lineages.
export class MatrixBuilder {
  constructor(forest, {
    cardRows = 3, busOffset = 1, lineageGap = 1, packAspect = 1.6, cellAspect = 1,
  } = {}) {
    this.trees = Array.isArray(forest) ? forest : [forest];
    this.tree = this.trees[0];
    this.cardRows = Math.max(1, Math.floor(cardRows));
    this.busOffset = Math.max(1, Math.floor(busOffset));
    this.lineageGap = Math.max(0, Math.floor(lineageGap));
    this.packAspect = packAspect;
    this.cellAspect = cellAspect;
    this.reset();
  }

  reset() {
    this.matrix = new Map();
    this.steps = [];
    this.nodePositions = new Map();
    this.nodeParents = new Map();
    this.busRowMap = new Map();
    this.positions = new Map();
    this.buses = [];
    this.bounds = { minRow: Infinity, maxRow: -Infinity, minCol: 0, maxCol: 0 };
  }

  build() {
    this.reset();
    // Card rows relative to its trunk row: [-above, +below].
    this.above = Math.floor((this.cardRows - 1) / 2);
    this.below = this.cardRows - 1 - this.above;

    const childRows = new Map();
    this.log('info', 'Step 1: Measure subtrees');
    const shapes = this.trees.map((t) => this.measure(t, childRows));

    this.log('info', 'Step 2: Pack lineages');
    const seeds = this.packLineages(shapes);

    this.log('info', 'Step 3: Place nodes');
    this.trees.forEach((t, i) => this.place(t, seeds[i].row, seeds[i].col, childRows, null, null));
    if (!this.positions.size) this.bounds = { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
    return this.steps;
  }

  // Bottom-left skyline packing on contours: each lineage takes the column where it sits highest
  // (ties go left). Lineages never tuck under one another, so connectors stay inside their own block.
  // ponytail: O(lineages · width · lineage width) search; fine for hundreds of lineages, add a
  // skyline segment index if that ever reaches thousands.
  packLineages(shapes) {
    const g = this.lineageGap;
    const width = (s) => s.lo.length;
    const height = (s) => Math.max(...s.hi) - Math.min(...s.lo) + 1;
    const area = shapes.reduce((sum, s) => sum + (width(s) + g) * (height(s) + g), 0);
    const canvasCols = Math.max(
      Math.max(0, ...shapes.map(width)),
      Math.round(Math.sqrt((area * this.packAspect) / this.cellAspect)),
    );

    const edge = [];
    return shapes.map((s) => {
      const w = width(s);
      let best = null;
      for (let x = 0; x + w <= canvasCols; x++) {
        let r = -Infinity;
        for (let c = 0; c < w; c++) r = Math.max(r, -s.lo[c]);
        for (let c = -g; c < w + g; c++) {
          const k = x + c;
          if (k < 0 || edge[k] === undefined) continue;
          let lo = Infinity;
          for (let d = Math.max(0, c - g); d <= Math.min(w - 1, c + g); d++) lo = Math.min(lo, s.lo[d]);
          r = Math.max(r, edge[k] + g - lo + 1);
        }
        if (!best || r < best.row) best = { row: r, col: x };
      }
      for (let c = 0; c < w; c++) {
        const k = best.col + c;
        edge[k] = Math.max(edge[k] ?? -Infinity, best.row + s.hi[c]);
      }
      return best;
    });
  }

  // Returns { lo, hi }: min/max row (relative to this node's trunk row) used in each relative
  // column, covering the card, the trunk and every descendant block.
  // Records each child's trunk row (relative to this node's trunk) in childRows.
  // ponytail: recursive, overflows past ~1500 generations deep; switch to an explicit stack if lineages get that deep.
  measure(node, childRows) {
    const kids = node.children || [];
    const lo = [-this.above], hi = [this.below];
    for (let j = 0; j < kids.length; j++) lo[1 + j] = hi[1 + j] = 0;
    const downEdge = [], upEdge = [];
    const rows = new Array(kids.length);

    for (let j = kids.length - 1; j >= 0; j--) {
      const s = this.measure(kids[j], childRows);
      const off = 1 + j;
      const isBelow = j % 2 === 1;

      let r = isBelow ? this.busOffset + this.above : -(this.busOffset + this.below);
      for (let c = 0; c < s.lo.length; c++) {
        if (isBelow) r = Math.max(r, (downEdge[off + c] ?? 0) - s.lo[c] + 1);
        else r = Math.min(r, (upEdge[off + c] ?? 0) - s.hi[c] - 1);
      }
      rows[j] = r;

      for (let c = 0; c < s.lo.length; c++) {
        const k = off + c, a = r + s.lo[c], b = r + s.hi[c];
        if (isBelow) downEdge[k] = b; else upEdge[k] = a;
        lo[k] = lo[k] === undefined ? a : Math.min(lo[k], a);
        hi[k] = hi[k] === undefined ? b : Math.max(hi[k], b);
      }
    }

    childRows.set(node.id, rows);
    return { lo, hi };
  }

  place(node, trunkRow, col, childRows, parentId, side) {
    const kids = node.children || [];
    this.placeNode(node.id, trunkRow - this.above, col, parentId, side, trunkRow);
    if (!kids.length) return;

    const rows = childRows.get(node.id);
    this.busRowMap.set(node.id, trunkRow);
    this.buses.push({
      source: node.id,
      row: trunkRow,
      fromCol: col,
      toCol: col + kids.length,
      targets: kids.map((kid, j) => ({ target: kid.id, side: j % 2 === 1 ? 'below' : 'above' })),
    });
    this.log('assign', `${node.id} bus at row ${trunkRow}`);
    kids.forEach((kid, j) => {
      this.place(kid, trunkRow + rows[j], col + 1 + j, childRows, node.id, j % 2 === 1 ? 'below' : 'above');
    });
  }

  placeNode(nodeId, top, col, parentNodeId, side, trunkRow) {
    for (let row = top; row < top + this.cardRows; row++) {
      const key = `${row},${col}`;
      if (this.matrix.has(key)) {
        throw new Error(`Cell (${row}, ${col}) already occupied by ${this.matrix.get(key)}; cannot place ${nodeId}`);
      }
      this.matrix.set(key, nodeId);
    }

    this.nodePositions.set(nodeId, [{ row: top, col }]);
    this.positions.set(nodeId, { row: top, col, rows: this.cardRows, trunkRow, side, parent: parentNodeId });
    this.nodeParents.set(nodeId, parentNodeId);

    this.bounds.minRow = Math.min(this.bounds.minRow, top);
    this.bounds.maxRow = Math.max(this.bounds.maxRow, top + this.cardRows - 1);
    this.bounds.maxCol = Math.max(this.bounds.maxCol, col);

    this.steps.push({ action: 'place', nodeId, row: top, col, message: `Place ${nodeId} at (${top}, ${col})` });
  }

  log(type, msg) {
    this.steps.push({ action: 'log', type, message: msg });
  }

  getMatrixArray() {
    const rows = this.bounds.maxRow - this.bounds.minRow + 1;
    const cols = this.bounds.maxCol - this.bounds.minCol + 1;
    const arr = Array.from({ length: rows }, () => Array(cols).fill(null));

    for (const [key, nodeId] of this.matrix) {
      const [row, col] = key.split(',').map(Number);
      arr[row - this.bounds.minRow][col - this.bounds.minCol] = nodeId;
    }

    return arr;
  }
}
