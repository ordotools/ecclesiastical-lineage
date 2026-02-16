"""Lineage filtering utilities."""
from collections import defaultdict


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
