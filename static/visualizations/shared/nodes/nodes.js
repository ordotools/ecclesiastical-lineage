/**
 * Shared node creation for visualizations.
 * Builds the D3 node group: outer ring, inner ring, image, label, title.
 * Dimensions are read from CSS variables (--viz-node-*, --viz-label-dy) with fallbacks.
 * Used by force-directed and editor visualizations.
 */

const DEFAULT_OUTER_RADIUS = 28;
const DEFAULT_INNER_RADIUS = 1; // rank indicator ring
const DEFAULT_IMAGE_SIZE = 48;
const DEFAULT_STROKE_WIDTH = 3;
const DEFAULT_LABEL_DY = 35;

/**
 * Read node/label dimensions from CSS variables on document root.
 * @returns {{ outerRadius: number, innerRadius: number, imageSize: number, strokeWidth: number, labelDy: number }}
 */
export function getNodeDimensions() {
  const root = document.documentElement;
  const s = root.style;
  const computed = getComputedStyle(root);
  const getPx = (varName, fallback) => {
    const val = computed.getPropertyValue(varName).trim();
    if (!val) return fallback;
    const num = parseFloat(val);
    return Number.isFinite(num) ? num : fallback;
  };
  return {
    outerRadius: getPx('--viz-node-outer-radius', DEFAULT_OUTER_RADIUS),
    innerRadius: getPx('--viz-node-inner-radius', DEFAULT_INNER_RADIUS),
    imageSize: getPx('--viz-node-image-size', DEFAULT_IMAGE_SIZE),
    strokeWidth: getPx('--viz-node-stroke-width', DEFAULT_STROKE_WIDTH),
    labelDy: getPx('--viz-label-dy', DEFAULT_LABEL_DY)
  };
}

/**
 * Create the node group structure on a D3 selection of g.viz-node elements.
 * Appends: outer ring (circle + rect), inner ring (circle + rect), image bg/border, image, label, title.
 * CSS-driven dimensions are applied via getNodeDimensions().
 *
 * @param {d3.Selection} selection - D3 selection of g elements with class 'viz-node' (data-bound).
 * @param {Object} options
 * @param {(d: any) => boolean} options.useSquareNode - When true, show rect variants; when false, show circle variants.
 * @param {Object|null} [options.spriteSheetData] - If present and success, use sprite image + clipPath; else use single image per node.
 * @param {(d: any) => string} [options.getLabelText] - Label text (default: d => d.name).
 * @param {(d: any) => string} [options.getTitleText] - Title/tooltip text (default: name, rank, organization).
 * @param {boolean} [options.showPlaceholderIcon] - If true, append placeholder text when no image (default: false).
 * @param {string} [options.imageFilter] - Optional filter attribute for images (e.g. 'url(#image-inset-shadow)').
 * @returns {d3.Selection} The same selection for chaining.
 */
export function createNodeGroup(selection, options) {
  const {
    useSquareNode,
    spriteSheetData = null,
    getLabelText = (d) => d.name,
    getTitleText = (d) => `${d.name}\nRank: ${d.rank}\nOrganization: ${d.organization}`,
    showPlaceholderIcon = false,
    imageFilter = null
  } = options;

  const dim = getNodeDimensions();
  const r = dim.outerRadius;
  const ir = dim.innerRadius;
  const imgSize = dim.imageSize;
  const stroke = dim.strokeWidth;
  const labelDy = dim.labelDy;

  const showCircle = (d) => !useSquareNode(d);
  const showRect = (d) => useSquareNode(d);

  // Outer ring
  selection.append('circle')
    .attr('class', 'viz-node-outer viz-node-outer-circle')
    .attr('r', r)
    .attr('fill', (d) => d.org_color)
    .attr('stroke', (d) => d.rank_color)
    .attr('stroke-width', stroke)
    .style('display', (d) => showCircle(d) ? null : 'none');

  selection.append('rect')
    .attr('class', 'viz-node-outer viz-node-outer-rect')
    .attr('width', r * 2)
    .attr('height', r * 2)
    .attr('x', -r)
    .attr('y', -r)
    .attr('fill', (d) => d.org_color)
    .attr('stroke', (d) => d.rank_color)
    .attr('stroke-width', stroke)
    .style('display', (d) => showRect(d) ? null : 'none');

  // Inner ring (rank indicator)
  selection.append('circle')
    .attr('class', 'viz-node-inner viz-node-inner-circle')
    .attr('r', ir)
    .attr('fill', (d) => d.rank_color)
    .attr('cx', 0)
    .attr('cy', 0)
    .style('display', (d) => showCircle(d) ? null : 'none');

  selection.append('rect')
    .attr('class', 'viz-node-inner viz-node-inner-rect')
    .attr('width', ir * 2)
    .attr('height', ir * 2)
    .attr('x', -ir)
    .attr('y', -ir)
    .attr('fill', (d) => d.rank_color)
    .style('display', (d) => showRect(d) ? null : 'none');

  // Image background
  selection.append('circle')
    .attr('class', 'viz-node-image-bg viz-node-image-bg-circle')
    .attr('r', imgSize / 2)
    .attr('fill', 'rgba(255, 255, 255, 1)')
    .attr('cx', 0)
    .attr('cy', 0)
    .style('opacity', (d) => (d.image_url ? 1 : 0))
    .style('display', (d) => showCircle(d) ? null : 'none');

  selection.append('rect')
    .attr('class', 'viz-node-image-bg viz-node-image-bg-rect')
    .attr('width', imgSize)
    .attr('height', imgSize)
    .attr('x', -imgSize / 2)
    .attr('y', -imgSize / 2)
    .attr('fill', 'rgba(255, 255, 255, 1)')
    .style('opacity', (d) => (d.image_url ? 1 : 0))
    .style('display', (d) => showRect(d) ? null : 'none');

  // Image border
  selection.append('circle')
    .attr('class', 'viz-node-image-border viz-node-image-border-circle')
    .attr('r', imgSize / 2)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(0, 0, 0, 1)')
    .attr('stroke-width', '0.5px')
    .attr('cx', 0)
    .attr('cy', 0)
    .style('opacity', (d) => (d.image_url ? 1 : 0))
    .style('display', (d) => showCircle(d) ? null : 'none');

  selection.append('rect')
    .attr('class', 'viz-node-image-border viz-node-image-border-rect')
    .attr('width', imgSize)
    .attr('height', imgSize)
    .attr('x', -imgSize / 2)
    .attr('y', -imgSize / 2)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(0, 0, 0, 1)')
    .attr('stroke-width', '0.5px')
    .style('opacity', (d) => (d.image_url ? 1 : 0))
    .style('display', (d) => showRect(d) ? null : 'none');

  const getSpritePosition = (d, mapping) =>
    mapping[d.id] ?? mapping[String(d.id)] ?? mapping[Number(d.id)];

  if (spriteSheetData && spriteSheetData.success && spriteSheetData.mapping) {
    const mapping = spriteSheetData.mapping;
    const spriteUrl = spriteSheetData.url;
    const sw = spriteSheetData.sprite_width;
    const sh = spriteSheetData.sprite_height;

    selection.append('image')
      .attr('xlink:href', (d) => (getSpritePosition(d, mapping) && Array.isArray(getSpritePosition(d, mapping)) && getSpritePosition(d, mapping).length >= 2 ? spriteUrl : ''))
      .attr('x', (d) => {
        const pos = getSpritePosition(d, mapping);
        if (pos && Array.isArray(pos) && pos.length >= 2) return -pos[0] - imgSize / 2;
        return 0;
      })
      .attr('y', (d) => {
        const pos = getSpritePosition(d, mapping);
        if (pos && Array.isArray(pos) && pos.length >= 2) return -pos[1] - imgSize / 2;
        return 0;
      })
      .attr('width', sw)
      .attr('height', sh)
      .attr('clip-path', (d) => {
        const pos = getSpritePosition(d, mapping);
        if (pos && Array.isArray(pos) && pos.length >= 2) return `url(#clip-avatar-${d.id})`;
        return 'none';
      })
      .attr('preserveAspectRatio', 'none')
      .style('pointer-events', 'none')
      .style('opacity', (d) => {
        const pos = getSpritePosition(d, mapping);
        if (pos && Array.isArray(pos) && pos.length >= 2) {
          selection.filter((n) => n.id === d.id).selectAll('.viz-node-image-bg').style('opacity', 1);
          selection.filter((n) => n.id === d.id).selectAll('.viz-node-image-border').style('opacity', 1);
          return 1;
        }
        return 0;
      });
  } else {
    const img = selection.append('image')
      .attr('xlink:href', (d) => d.image_url || '')
      .attr('x', -imgSize / 2)
      .attr('y', -imgSize / 2)
      .attr('width', imgSize)
      .attr('height', imgSize)
      .attr('clip-path', (d) =>
        useSquareNode(d) ? 'none' : `circle(${imgSize / 2}px at ${imgSize / 2}px ${imgSize / 2}px)`)
      .style('pointer-events', 'none')
      .style('opacity', (d) => (d.image_url ? 1 : 0))
      .on('error', function () {
        if (typeof d3 !== 'undefined') d3.select(this).style('opacity', 0);
      });
    if (imageFilter) img.attr('filter', imageFilter);
  }

  if (showPlaceholderIcon) {
    selection.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .style('pointer-events', 'none')
      .style('opacity', (d) => (d.image_url ? 0 : 1))
      .text('👤');
  }

  selection.append('text')
    .attr('class', 'viz-node-label')
    .attr('dy', labelDy)
    .text(getLabelText);

  selection.append('title')
    .text(getTitleText);

  return selection;
}
