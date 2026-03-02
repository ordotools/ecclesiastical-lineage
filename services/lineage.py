"""Lineage filtering utilities."""
from collections import defaultdict


def get_exclude_ids_for_lineage_roots():
    """
    Load ordination/consecration links from DB, get lineage root IDs,
    return set of clergy IDs to exclude (ancestors of lineage roots).
    Used so table subset and viz apply the same exclusion.
    """
    from models import Clergy, Ordination, Consecration, LineageRoot
    from sqlalchemy.orm import joinedload

    non_deleted = set(
        c[0] for c in Clergy.query.filter(Clergy.is_deleted != True).with_entities(Clergy.id).all()
    )
    links = []
    ordinations = Ordination.query.filter(
        Ordination.ordaining_bishop_id.isnot(None),
        Ordination.clergy_id.in_(non_deleted),
        Ordination.ordaining_bishop_id.in_(non_deleted),
    ).with_entities(Ordination.ordaining_bishop_id, Ordination.clergy_id).all()
    for ob_id, clergy_id in ordinations:
        links.append({'source': ob_id, 'target': clergy_id})
    consecrations = Consecration.query.options(
        joinedload(Consecration.co_consecrators)
    ).filter(
        Consecration.consecrator_id.isnot(None),
        Consecration.clergy_id.in_(non_deleted),
        Consecration.consecrator_id.in_(non_deleted),
    ).all()
    for c in consecrations:
        links.append({'source': c.consecrator_id, 'target': c.clergy_id})
        for co in c.co_consecrators:
            if co.id in non_deleted:
                links.append({'source': co.id, 'target': c.clergy_id})

    root_clergy_ids = {lr.clergy_id for lr in LineageRoot.query.all()}
    if not root_clergy_ids:
        return set()
    return get_ancestors_of_roots(root_clergy_ids, links)


def get_ancestors_of_roots(root_clergy_ids, all_links):
    """Given root IDs and link list with source/target, return set of ancestor IDs to exclude."""
    ancestor_of = defaultdict(set)
    for link in all_links:
        ancestor_of[link['target']].add(link['source'])
    exclude_ids = set()
    for root_id in root_clergy_ids:
        queue = [root_id]
        visited = {root_id}
        while queue:
            node = queue.pop(0)
            for anc in ancestor_of.get(node, set()):
                if anc not in visited:
                    visited.add(anc)
                    exclude_ids.add(anc)
                    queue.append(anc)
    return exclude_ids
