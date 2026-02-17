/**
 * Hierarchy building: links → tree structure, summaries, validity, pre-1968 flags.
 * @module lineageTreeHierarchy
 */
import {
  getLinkSourceId,
  getLinkTargetId,
  getLinkStatus,
  parseYearFromDate,
  yearToDecade,
  isBishopRank,
  STATUS_PRIORITY
} from './lineageTreeUtils.js';

export const PRE_1968_CONSECRATION_YEAR = 1968;

export function decadeSteps(decadeDiff) {
  return Math.ceil(decadeDiff / 10);
}

/** Marks nodes with pre-1968 consecration flags. */
export function computePre1968Flags(nodes, consecrationLinks) {
  const pre1968ConsecrationTargets = new Set();
  const pre1968SponsorBishops = new Set();

  consecrationLinks.forEach(link => {
    const year = parseYearFromDate(link.date);
    if (year === null || year >= PRE_1968_CONSECRATION_YEAR) return;

    const targetId = getLinkTargetId(link);
    const sourceId = getLinkSourceId(link);
    if (targetId != null) pre1968ConsecrationTargets.add(targetId);
    if (sourceId != null) pre1968SponsorBishops.add(sourceId);
  });

  const shouldMarkPre1968Consecrator = (node, consecratorIds) => {
    if (!node || !consecratorIds || !consecratorIds.has(node.id)) return false;
    if (node.consecration_date) return false;
    if (node.rank && !isBishopRank(node.rank)) return false;
    return true;
  };

  nodes.forEach(node => {
    const consecrationYear = parseYearFromDate(node.consecration_date);
    node.is_pre_1968_consecration = consecrationYear !== null
      ? consecrationYear < PRE_1968_CONSECRATION_YEAR
      : pre1968ConsecrationTargets.has(node.id) || shouldMarkPre1968Consecrator(node, pre1968SponsorBishops);
  });
}

/** Builds map of source-target key → link (best status per edge). */
export function buildLinkToValidityMap(validConsecLinks) {
  const map = new Map();
  validConsecLinks.forEach(link => {
    const sid = getLinkSourceId(link);
    const tid = getLinkTargetId(link);
    if (sid == null || tid == null) return;
    const key = `${sid}-${tid}`;
    const status = getLinkStatus(link);
    const prev = map.get(key);
    if (!prev || STATUS_PRIORITY[status] > STATUS_PRIORITY[getLinkStatus(prev)]) {
      map.set(key, link);
    }
  });
  return map;
}

/** Builds { single } or { multi } hierarchy from nodes and consecration links. */
export function buildHierarchy(nodes, consecrationLinks, nodeMap, linkDateByEdge) {
  const targetsBySource = new Map();
  const hasIncoming = new Set();

  consecrationLinks.forEach(link => {
    const sid = getLinkSourceId(link);
    const tid = getLinkTargetId(link);
    const sourceNode = nodeMap.get(sid);
    const targetNode = nodeMap.get(tid);
    if (!sourceNode || !targetNode) return;

    hasIncoming.add(tid);
    if (!targetsBySource.has(sid)) targetsBySource.set(sid, []);
    targetsBySource.get(sid).push(targetNode);
  });

  const lineageRoots = nodes.filter(n => n.is_lineage_root);
  const roots = lineageRoots.length > 0
    ? lineageRoots
    : nodes.filter(n => !hasIncoming.has(n.id));

  if (roots.length === 0) return null;

  function buildNode(node) {
    const raw = targetsBySource.get(node.id) || [];
    const seen = new Set();
    const filtered = raw.filter(c => {
      if (seen.has(c.id)) return false;
      if (lineageRoots.length > 0 && c.is_lineage_root) return false;
      seen.add(c.id);
      return true;
    });
    const children = filtered
      .sort((a, b) => {
        const yA = parseYearFromDate(linkDateByEdge?.get(`${node.id}-${a.id}`));
        const yB = parseYearFromDate(linkDateByEdge?.get(`${node.id}-${b.id}`));
        return (yA ?? 9999) - (yB ?? 9999);
      })
      .map(child => buildNode(child))
      .filter(Boolean);
    return {
      data: node,
      children
    };
  }

  if (roots.length === 1) {
    return { single: buildNode(roots[0]) };
  }
  return { multi: roots.map(r => buildNode(r)) };
}

/** Wraps large leaf groups in summary nodes (decade-based). */
export function applyDefaultSummaries(hierarchy, linkDateByEdge) {
  function processNode(node, parentId) {
    if (!node || !node.children?.length) return node;
    const children = node.children;
    if (children.length <= 5) {
      return {
        data: node.data,
        children: children.map(c => processNode(c, node.data?.id))
      };
    }
    const leaves = children.filter(c => !c.children?.length);
    const parents = children.filter(c => c.children?.length > 0);
    if (leaves.length === 0) {
      return {
        data: node.data,
        children: children.map(c => processNode(c, node.data?.id))
      };
    }
    const oldestLeaf = leaves[0];
    const pid = node.data?.id ?? parentId;
    const linkDate = pid != null && oldestLeaf?.data?.id != null
      ? linkDateByEdge?.get(`${pid}-${oldestLeaf.data.id}`)
      : null;
    const leafDate = linkDate || oldestLeaf?.data?.consecration_date;
    const decade = yearToDecade(parseYearFromDate(leafDate));
    const summaryId = `summary-${node.data?.id}`;
    const summaryNode = {
      data: {
        isSummary: true,
        id: summaryId,
        leafIds: leaves.map(l => l.data?.id).filter(Boolean),
        leafNodes: leaves,
        decade: decade ?? 0,
        count: leaves.length
      },
      children: []
    };
    const newChildren = [summaryNode, ...parents].sort((a, b) => {
      const aDecade = a.data?.isSummary ? a.data.decade : yearToDecade(parseYearFromDate(
        pid != null && a.data?.id ? linkDateByEdge?.get(`${pid}-${a.data.id}`) : a.data?.consecration_date
      ));
      const bDecade = b.data?.isSummary ? b.data.decade : yearToDecade(parseYearFromDate(
        pid != null && b.data?.id ? linkDateByEdge?.get(`${pid}-${b.data.id}`) : b.data?.consecration_date
      ));
      return (aDecade ?? 9999) - (bDecade ?? 9999);
    });
    return {
      data: node.data,
      children: newChildren.map(c => c.data?.isSummary ? c : processNode(c, node.data?.id))
    };
  }

  if (!hierarchy) return hierarchy;
  if (hierarchy.single) {
    return { single: processNode(hierarchy.single, null) };
  }
  if (hierarchy.multi) {
    return { multi: hierarchy.multi.map(r => processNode(r, null)) };
  }
  return hierarchy;
}
