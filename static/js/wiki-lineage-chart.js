/**
 * Static lineage chart renderer for wiki {{lineage:id}} shortcode.
 * Uses D3 tree layout (deterministic, oldest-left to newest-right, no link crossing).
 * Ordination=black, consecration=green to match main lineage viz.
 */
(function (global) {
    const BLACK = '#0d0d0d';
    const GREEN = '#056c1f';
    const NODE_R = 18;
    const LABEL_DY = 28;
    const PADDING = 28;
    const ROW_GAP = 72;
    const STAGGER_Y = 58;

    function wrapText(str, maxChars) {
        if (!str) return [''];
        const words = str.split(/\s+/);
        const lines = [];
        let line = '';
        words.forEach(w => {
            if (line.length + (line ? 1 : 0) + w.length <= maxChars) {
                line += (line ? ' ' : '') + w;
            } else {
                if (line) lines.push(line);
                line = w;
            }
        });
        if (line) lines.push(line);
        return lines.length ? lines : [str];
    }

    function buildHierarchy(nodes, links) {
        const nodeMap = {};
        nodes.forEach(n => { nodeMap[n.id] = { ...n }; });

        const childrenMap = {};
        const targets = new Set();

        links.forEach(l => {
            const sid = typeof l.source === 'number' ? l.source : (l.source?.id ?? l.source);
            const tid = typeof l.target === 'number' ? l.target : (l.target?.id ?? l.target);
            if (!nodeMap[sid] || !nodeMap[tid]) return;
            targets.add(tid);
            if (!childrenMap[sid]) childrenMap[sid] = [];
            childrenMap[sid].push(nodeMap[tid]);
        });

        const roots = nodes.filter(n => !targets.has(n.id)).map(n => nodeMap[n.id]);
        if (roots.length === 0 && nodes.length > 0) roots.push(nodeMap[nodes[0].id]);
        if (roots.length === 0) return null;

        const children = d => (d.id === '__root__' ? roots : (childrenMap[d.id] || []));
        if (roots.length === 1) return d3.hierarchy(roots[0], children);
        return d3.hierarchy({ id: '__root__', name: '' }, children);
    }

    function renderStaticLineageChart(nodes, links, container) {
        if (!container || !nodes || nodes.length === 0) return;
        if (typeof d3 === 'undefined') {
            container.innerHTML = '<p class="wiki-lineage-error">D3.js required for lineage chart.</p>';
            return;
        }

        const linkData = links
            .filter(l => nodes.some(n => n.id === (typeof l.source === 'number' ? l.source : l.source?.id)))
            .map(l => ({
                source: typeof l.source === 'number' ? l.source : (l.source?.id ?? l.source),
                target: typeof l.target === 'number' ? l.target : (l.target?.id ?? l.target),
                type: l.type || 'consecration',
                color: l.color || (l.type === 'ordination' ? BLACK : GREEN),
            }));

        const linkMap = {};
        linkData.forEach(l => { linkMap[`${l.source}->${l.target}`] = l; });

        const hierarchy = buildHierarchy(nodes, linkData);
        if (!hierarchy) return;

        const treeRoot = hierarchy;

        const h = PADDING * 2 + LABEL_DY * 2 + ROW_GAP + NODE_R * 2 + 20;
        const w = Math.max(container.clientWidth || 960, 400);
        container.style.height = h + 'px';
        container.style.minHeight = h + 'px';

        const layoutW = w - 2 * PADDING;
        const layoutH = h - 2 * PADDING;
        const treeLayout = d3.tree()
            .size([layoutH, layoutW])
            .separation((a, b) => 1);

        treeLayout(treeRoot);

        const allNodes = treeRoot.descendants().filter(d => d.data.id !== '__root__');
        if (allNodes.length === 0) return;

        const baseY = PADDING + LABEL_DY + NODE_R;
        const xPos = d => d.y + PADDING;
        const yPos = d => baseY + (d.depth % 2) * STAGGER_Y;

        const svg = d3.select(container)
            .html('')
            .append('svg')
            .attr('viewBox', `0 0 ${w} ${h}`)
            .attr('width', '100%')
            .attr('height', h)
            .attr('class', 'wiki-lineage-svg');

        const defs = svg.append('defs');
        defs.append('marker')
            .attr('id', 'wiki-arrow-black')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5Z')
            .attr('fill', BLACK);
        defs.append('marker')
            .attr('id', 'wiki-arrow-green')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5Z')
            .attr('fill', GREEN);

        const g = svg.append('g');

        const treeLinks = treeRoot.links().filter(l => l.source.data.id !== '__root__' && l.target.data.id !== '__root__');

        g.selectAll('line')
            .data(treeLinks)
            .join('line')
            .attr('class', 'wiki-lineage-link')
            .attr('x1', d => xPos(d.source))
            .attr('y1', d => yPos(d.source))
            .attr('x2', d => xPos(d.target))
            .attr('y2', d => yPos(d.target))
            .attr('stroke', d => {
                const l = linkMap[`${d.source.data.id}->${d.target.data.id}`];
                return l ? l.color : GREEN;
            })
            .attr('stroke-width', 2)
            .attr('marker-end', d => {
                const l = linkMap[`${d.source.data.id}->${d.target.data.id}`];
                return (l && l.type === 'ordination') ? 'url(#wiki-arrow-black)' : 'url(#wiki-arrow-green)';
            });

        const node = g.selectAll('g')
            .data(allNodes)
            .join('g')
            .attr('class', 'wiki-lineage-node')
            .attr('transform', d => `translate(${xPos(d)},${yPos(d)})`);

        node.append('circle')
            .attr('r', NODE_R)
            .attr('fill', '#fff')
            .attr('stroke', d => d.data.rank_color || '#888')
            .attr('stroke-width', 2);

        const LINE_HEIGHT = 13;
        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', '#374151')
            .each(function (d) {
                const el = d3.select(this);
                const text = d.data.name || '';
                const lines = wrapText(text, 16);
                const isTopRow = d.depth % 2 === 0;
                const blockH = LABEL_DY + (lines.length - 1) * LINE_HEIGHT;
                el.attr('y', isTopRow ? -blockH : LABEL_DY);
                el.selectAll('tspan').data(lines).join('tspan')
                    .attr('x', 0)
                    .attr('dy', (_, i) => i === 0 ? 0 : LINE_HEIGHT)
                    .text(l => l);
            });
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { renderStaticLineageChart };
    } else {
        global.renderStaticLineageChart = renderStaticLineageChart;
    }
})(typeof window !== 'undefined' ? window : this);
