(() => {
    'use strict';

    /**
     * Lightweight graph utilities for the Validation Impact panel.
     *
     * Responsibilities for this file (js-graph-cascade task):
     * - Build ordination / consecration adjacency from window.clergyListData.
     * - Provide BFS / DFS-style descendant traversal for a given root clergy ID.
     *
     * Higher-level panel rendering, synthetic summaries, and wiring are handled
     * in follow-on tasks; this module focuses purely on data structures.
     */

    /**
     * Normalize an array-like value to a plain array.
     * @param {*} value
     * @returns {Array}
     */
    function toArray(value) {
        if (!value) {
            return [];
        }
        return Array.isArray(value) ? value : Array.from(value);
    }

    /**
     * Build adjacency lists for ordinations and consecrations from clergyListData.
     *
     * Input shape (from /editor/clergy-list in routes/editor.py):
     *   clergyListData: [
     *     {
     *       id: <int>,
     *       ordinations: [
     *         {
     *           ordaining_bishop_id: <int|null>,
     *           date, date_unknown, year,
     *           validity,
     *           is_sub_conditione, is_doubtful_event,
     *           is_invalid, is_doubtfully_valid
     *         },
     *         ...
     *       ],
     *       consecrations: [
     *         {
     *           consecrator_id: <int|null>,
     *           date, date_unknown, year,
     *           validity,
     *           is_sub_conditione, is_doubtful_event,
     *           is_invalid, is_doubtfully_valid
     *         },
     *         ...
     *       ]
     *     },
     *     ...
     *   ]
     *
     * Output shape:
     *   {
     *     clergyById: Map<number, ClergyRecord>,
     *     adjacency: Map<number, Array<{
     *       childId: number,
     *       ordinations: Array<{ index: number, record: object }>,
     *       consecrations: Array<{ index: number, record: object }>
     *     }>>
     *   }
     *
     * Where adjacency has an entry for each parent (bishop) ID that appears as:
     *   - ordination.ordaining_bishop_id
     *   - consecration.consecrator_id
     */
    function buildAdjacencyFromClergyList(clergyListData) {
        const data = toArray(clergyListData || (typeof window !== 'undefined' ? window.clergyListData : []) || []);

        const clergyById = new Map();
        const adjacency = new Map();

        data.forEach(clergy => {
            if (!clergy || typeof clergy.id !== 'number') {
                return;
            }
            clergyById.set(clergy.id, clergy);
        });

        data.forEach(clergy => {
            if (!clergy || typeof clergy.id !== 'number') {
                return;
            }
            const childId = clergy.id;

            toArray(clergy.ordinations).forEach((ordination, index) => {
                const parentId = ordination && ordination.ordaining_bishop_id;
                if (!parentId || typeof parentId !== 'number') {
                    return;
                }
                ensureEdge(adjacency, parentId, childId).ordinations.push({
                    index,
                    record: ordination
                });
            });

            toArray(clergy.consecrations).forEach((consecration, index) => {
                const parentId = consecration && consecration.consecrator_id;
                if (!parentId || typeof parentId !== 'number') {
                    return;
                }
                ensureEdge(adjacency, parentId, childId).consecrations.push({
                    index,
                    record: consecration
                });
            });
        });

        return { clergyById, adjacency };
    }

    /**
     * Ensure an edge entry exists for (parentId -> childId) in the adjacency map.
     * @param {Map<number, Array>} adjacency
     * @param {number} parentId
     * @param {number} childId
     * @returns {{ childId: number, ordinations: Array, consecrations: Array }}
     */
    function ensureEdge(adjacency, parentId, childId) {
        if (!adjacency.has(parentId)) {
            adjacency.set(parentId, []);
        }
        const edges = adjacency.get(parentId);
        let edge = edges.find(e => e.childId === childId);
        if (!edge) {
            edge = {
                childId,
                ordinations: [],
                consecrations: []
            };
            edges.push(edge);
        }
        return edge;
    }

    /**
     * Compute the full descendant closure for a given root clergy ID using BFS.
     *
     * Returns an array of:
     *   {
     *     id: number,
     *     distance: number,                // number of hops from root (1 for direct children)
     *     parents: Array<number>,          // immediate parents within this cascade
+     *     via: Array<{
     *       parentId: number,
     *       ordinations: Array<{ index: number, record: object }>,
     *       consecrations: Array<{ index: number, record: object }>
     *     }>
     *   }
     *
     * The root itself is excluded from the result set.
     *
     * @param {number} rootId
     * @param {Map<number, Array>} adjacency
     * @returns {Array<object>}
     */
    function getDescendantsBFS(rootId, adjacency) {
        if (!rootId || typeof rootId !== 'number' || !adjacency || typeof adjacency.get !== 'function') {
            return [];
        }

        const visited = new Set();
        const results = new Map(); // childId -> descriptor
        const queue = [];

        visited.add(rootId);
        queue.push({ id: rootId, distance: 0 });

        while (queue.length > 0) {
            const current = queue.shift();
            const { id, distance } = current;
            const edges = adjacency.get(id) || [];
            const nextDistance = distance + 1;

            edges.forEach(edge => {
                const childId = edge.childId;
                if (!childId || typeof childId !== 'number') {
                    return;
                }

                let descriptor = results.get(childId);
                if (!descriptor) {
                    descriptor = {
                        id: childId,
                        distance: nextDistance,
                        parents: [],
                        via: []
                    };
                    results.set(childId, descriptor);
                } else if (nextDistance < descriptor.distance) {
                    descriptor.distance = nextDistance;
                }

                descriptor.parents.push(id);
                descriptor.via.push({
                    parentId: id,
                    ordinations: toArray(edge.ordinations),
                    consecrations: toArray(edge.consecrations)
                });

                if (!visited.has(childId)) {
                    visited.add(childId);
                    queue.push({ id: childId, distance: nextDistance });
                }
            });
        }

        return Array.from(results.values()).sort((a, b) => {
            if (a.distance !== b.distance) {
                return a.distance - b.distance;
            }
            return a.id - b.id;
        });
    }

    /**
     * Simple DFS variant that returns the same descriptor shape as BFS but
     * with depth-first ordering. Mostly useful for alternative UI presentations.
     *
     * @param {number} rootId
     * @param {Map<number, Array>} adjacency
     * @returns {Array<object>}
     */
    function getDescendantsDFS(rootId, adjacency) {
        if (!rootId || typeof rootId !== 'number' || !adjacency || typeof adjacency.get !== 'function') {
            return [];
        }

        const visited = new Set();
        const results = new Map();

        function visit(nodeId, distance, parentId, edge) {
            if (nodeId === null || typeof nodeId !== 'number') {
                return;
            }

            if (parentId === null && distance === 0) {
                visited.add(nodeId);
            }

            if (!visited.has(nodeId)) {
                visited.add(nodeId);
            }

            if (nodeId !== rootId) {
                let descriptor = results.get(nodeId);
                if (!descriptor) {
                    descriptor = {
                        id: nodeId,
                        distance,
                        parents: [],
                        via: []
                    };
                    results.set(nodeId, descriptor);
                } else if (distance < descriptor.distance) {
                    descriptor.distance = distance;
                }

                if (parentId !== null) {
                    descriptor.parents.push(parentId);
                    if (edge) {
                        descriptor.via.push({
                            parentId,
                            ordinations: toArray(edge.ordinations),
                            consecrations: toArray(edge.consecrations)
                        });
                    }
                }
            }

            const edges = adjacency.get(nodeId) || [];
            const nextDistance = distance + 1;
            edges.forEach(nextEdge => {
                if (!nextEdge || typeof nextEdge.childId !== 'number') {
                    return;
                }
                if (!visited.has(nextEdge.childId)) {
                    visit(nextEdge.childId, nextDistance, nodeId, nextEdge);
                }
            });
        }

        visit(rootId, 0, null, null);

        return Array.from(results.values()).sort((a, b) => {
            if (a.distance !== b.distance) {
                return a.distance - b.distance;
            }
            return a.id - b.id;
        });
    }

    /**
     * Helper that lazily builds and caches adjacency on window for reuse.
     * This allows other parts of the Validation Impact panel to share
     * the same underlying graph representation.
     */
    function getOrBuildCachedAdjacency() {
        if (typeof window === 'undefined') {
            return buildAdjacencyFromClergyList([]);
        }
        const cache = window.__validationImpactGraphCache || {};
        const currentData = window.clergyListData || [];

        if (cache._dataRef === currentData && cache.clergyById && cache.adjacency) {
            return cache;
        }

        const built = buildAdjacencyFromClergyList(currentData);
        built._dataRef = currentData;
        window.__validationImpactGraphCache = built;
        return built;
    }

    /**
     * Build a lightweight record object for a form entry that can be consumed
     * by StatusInheritance.getEffectiveStatus. This mirrors the shape used by
     * status-inheritance.js#getEntryRecord.
     *
     * @param {Element} entryElement
     * @returns {{ validity: string, is_sub_conditione: boolean, is_doubtful_event: boolean, is_invalid: boolean, is_doubtfully_valid: boolean }}
     */
    function getEntryRecordFromDom(entryElement) {
        if (!entryElement || typeof document === 'undefined') {
            return {
                validity: 'valid',
                is_sub_conditione: false,
                is_doubtful_event: false,
                is_invalid: false,
                is_doubtfully_valid: false
            };
        }

        const validitySelect = entryElement.querySelector('select[name*="[validity]"]');
        const subConditioneInput = entryElement.querySelector('input[name*="[is_sub_conditione]"]');
        const doubtfulEventInput = entryElement.querySelector('input[name*="[is_doubtful_event]"]');

        const validity = validitySelect && validitySelect.value ? validitySelect.value : 'valid';

        return {
            validity: validity,
            is_sub_conditione: !!(subConditioneInput && subConditioneInput.checked),
            is_doubtful_event: !!(doubtfulEventInput && doubtfulEventInput.checked),
            is_invalid: validity === 'invalid',
            is_doubtfully_valid: validity === 'doubtfully_valid'
        };
    }

    /**
     * Compute a synthetic bishop summary for the currently edited clergy based
     * on the live contents of the clergy form.
     *
     * This mirrors routes.editor._get_bishop_summary on the server and uses
     * StatusInheritance.getEffectiveStatus / getWorstStatus for consistency.
     *
     * @param {Element} [root] Optional root element for the form (defaults to document)
     * @returns {{ has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string }}
     */
    function buildSyntheticBishopSummaryFromForm(root) {
        const scope = root || (typeof document !== 'undefined' ? document : null);
        if (!scope) {
            return {
                has_valid_ordination: true,
                has_valid_consecration: true,
                worst_ordination_status: 'valid',
                worst_consecration_status: 'valid'
            };
        }

        const StatusInheritance = (typeof window !== 'undefined' && window.StatusInheritance) ? window.StatusInheritance : null;

        const ordinationEntries = scope.querySelectorAll ? scope.querySelectorAll('.ordination-entry') : [];
        const consecrationEntries = scope.querySelectorAll ? scope.querySelectorAll('.consecration-entry') : [];

        const ordinationStatuses = [];
        let hasValidOrdination = false;

        toArray(ordinationEntries).forEach(entry => {
            const record = getEntryRecordFromDom(entry);
            const status = StatusInheritance && typeof StatusInheritance.getEffectiveStatus === 'function'
                ? StatusInheritance.getEffectiveStatus(record)
                : 'valid';
            ordinationStatuses.push(status);
            if (status === 'valid' || status === 'sub_conditione') {
                hasValidOrdination = true;
            }
        });

        const consecrationStatuses = [];
        let hasValidConsecration = false;

        toArray(consecrationEntries).forEach(entry => {
            const record = getEntryRecordFromDom(entry);
            const status = StatusInheritance && typeof StatusInheritance.getEffectiveStatus === 'function'
                ? StatusInheritance.getEffectiveStatus(record)
                : 'valid';
            consecrationStatuses.push(status);
            if (status === 'valid' || status === 'sub_conditione') {
                hasValidConsecration = true;
            }
        });

        // Server-side semantics:
        // - If no ordinations, bishop is treated as having a valid ordination (worst 'valid').
        // - If no consecrations, bishop is treated as having a valid consecration (worst 'valid').
        const hasAnyOrdinations = ordinationStatuses.length > 0;
        const hasAnyConsecrations = consecrationStatuses.length > 0;

        const worstOrdinationStatus = hasAnyOrdinations
            ? (StatusInheritance && typeof StatusInheritance.getWorstStatus === 'function'
                ? StatusInheritance.getWorstStatus(ordinationStatuses)
                : 'valid')
            : 'valid';

        const worstConsecrationStatus = hasAnyConsecrations
            ? (StatusInheritance && typeof StatusInheritance.getWorstStatus === 'function'
                ? StatusInheritance.getWorstStatus(consecrationStatuses)
                : 'valid')
            : 'valid';

        return {
            has_valid_ordination: hasAnyOrdinations ? hasValidOrdination : true,
            has_valid_consecration: hasAnyConsecrations ? hasValidConsecration : true,
            worst_ordination_status: worstOrdinationStatus || 'valid',
            worst_consecration_status: worstConsecrationStatus || 'valid'
        };
    }

    /**
     * Map an effective status to a validity dropdown value.
     * Matches the mapping described in status-inheritance.js:
     *   - valid / sub_conditione / doubtful_event -> 'valid'
     *   - doubtfully_valid -> 'doubtfully_valid'
     *   - invalid -> 'invalid'
     *
     * @param {string} effectiveStatus
     * @returns {'valid'|'doubtfully_valid'|'invalid'}
     */
    function mapEffectiveToValidity(effectiveStatus) {
        if (effectiveStatus === 'invalid') {
            return 'invalid';
        }
        if (effectiveStatus === 'doubtfully_valid') {
            return 'doubtfully_valid';
        }
        return 'valid';
    }

    /**
     * Compute how a single ordination / consecration record's effective status
     * would be treated under a given bishop summary, using the same inheritance
     * rules as status-inheritance.js.
     *
     * Returns both the original and adjusted effective statuses along with a
     * flag indicating whether the current status is already allowed or would
     * need to be downgraded.
     *
     * @param {object} record
     * @param {object|null} bishopSummary
     * @param {'ordination'|'consecration'} type
     * @param {object|null} StatusInheritanceRef
     * @returns {{
     *   effectiveBefore: string,
     *   effectiveAfter: string,
     *   isAllowed: boolean,
     *   targetValidity: ('valid'|'doubtfully_valid'|'invalid')|null
     * }}
     */
    function computeAdjustedEffectiveStatus(record, bishopSummary, type, StatusInheritanceRef) {
        const StatusInheritance = StatusInheritanceRef || (typeof window !== 'undefined' ? window.StatusInheritance : null);
        if (!StatusInheritance || typeof StatusInheritance.getEffectiveStatus !== 'function') {
            return {
                effectiveBefore: 'valid',
                effectiveAfter: 'valid',
                isAllowed: true,
                targetValidity: null
            };
        }

        const effectiveBefore = StatusInheritance.getEffectiveStatus(record);

        if (!bishopSummary) {
            return {
                effectiveBefore: effectiveBefore,
                effectiveAfter: effectiveBefore,
                isAllowed: true,
                targetValidity: null
            };
        }

        const getAllowed =
            type === 'consecration'
                ? (StatusInheritance.getAllowedConsecrationStatuses || StatusInheritance.getAllowedEffectiveConsecrationStatuses)
                : (StatusInheritance.getAllowedOrdinationStatuses || StatusInheritance.getAllowedEffectiveOrdinationStatuses);

        const allowedEffective = typeof getAllowed === 'function'
            ? (getAllowed(bishopSummary) || [])
            : [];

        const isAllowed = allowedEffective.indexOf(effectiveBefore) !== -1;
        if (isAllowed || allowedEffective.length === 0) {
            return {
                effectiveBefore: effectiveBefore,
                effectiveAfter: effectiveBefore,
                isAllowed: true,
                targetValidity: null
            };
        }

        // Choose the "worst" allowed status, matching STATUS_PRIORITY ordering
        // used by status-inheritance.js (ALL_EFFECTIVE_STATUSES).
        const effectiveAfter = allowedEffective[allowedEffective.length - 1] || effectiveBefore;
        const targetValidity = mapEffectiveToValidity(effectiveAfter);

        return {
            effectiveBefore: effectiveBefore,
            effectiveAfter: effectiveAfter,
            isAllowed: false,
            targetValidity: targetValidity
        };
    }

    /**
     * Compute a synthetic bishop summary for a clergy ID based on clergy list
     * data and synthetic summaries of its ordaining / consecrating bishops.
     *
     * While building this summary we also record per-event impact information
     * for any ordinations / consecrations received from a bishop that already
     * has a synthetic summary in the cascade (typically the root or its
     * ancestors).
     *
     * @param {number} clergyId
     * @param {Map<number, object>} summaryById
     * @param {Map<number, Array<object>>} eventImpactsByChildId
     * @param {Map<number, object>} clergyById
     * @param {object|null} StatusInheritanceRef
     * @param {boolean} isRoot
     * @returns {{ has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string }}
     */
    function buildSyntheticSummaryForClergyId(clergyId, summaryById, eventImpactsByChildId, clergyById, StatusInheritanceRef, isRoot) {
        const StatusInheritance = StatusInheritanceRef || (typeof window !== 'undefined' ? window.StatusInheritance : null);
        const clergy = clergyById.get(clergyId);

        if (!StatusInheritance || !clergy) {
            return {
                has_valid_ordination: true,
                has_valid_consecration: true,
                worst_ordination_status: 'valid',
                worst_consecration_status: 'valid'
            };
        }

        // For the root, when a summary is already supplied (from the live form),
        // we trust that synthetic summary and do not recompute it from list data.
        if (isRoot && summaryById.has(clergyId)) {
            return summaryById.get(clergyId);
        }

        const ordinationStatuses = [];
        let hasValidOrdination = false;

        (clergy.ordinations || []).forEach(ordination => {
            const bishopId = ordination && ordination.ordaining_bishop_id;
            const parentSummary = bishopId != null ? summaryById.get(bishopId) : null;
            let effectiveStatus;

            if (parentSummary) {
                const adjusted = computeAdjustedEffectiveStatus(ordination, parentSummary, 'ordination', StatusInheritance);
                effectiveStatus = adjusted.effectiveAfter;

                let impacts = eventImpactsByChildId.get(clergyId);
                if (!impacts) {
                    impacts = [];
                    eventImpactsByChildId.set(clergyId, impacts);
                }
                impacts.push({
                    type: 'ordination',
                    parentId: bishopId,
                    record: ordination,
                    effectiveBefore: adjusted.effectiveBefore,
                    effectiveAfter: adjusted.effectiveAfter,
                    isAllowed: adjusted.isAllowed,
                    targetValidity: adjusted.targetValidity
                });
            } else {
                effectiveStatus = StatusInheritance.getEffectiveStatus(ordination);
            }

            ordinationStatuses.push(effectiveStatus);
            if (effectiveStatus === 'valid' || effectiveStatus === 'sub_conditione') {
                hasValidOrdination = true;
            }
        });

        const consecrationStatuses = [];
        let hasValidConsecration = false;

        (clergy.consecrations || []).forEach(consecration => {
            const bishopId = consecration && consecration.consecrator_id;
            const parentSummary = bishopId != null ? summaryById.get(bishopId) : null;
            let effectiveStatus;

            if (parentSummary) {
                const adjusted = computeAdjustedEffectiveStatus(consecration, parentSummary, 'consecration', StatusInheritance);
                effectiveStatus = adjusted.effectiveAfter;

                let impacts = eventImpactsByChildId.get(clergyId);
                if (!impacts) {
                    impacts = [];
                    eventImpactsByChildId.set(clergyId, impacts);
                }
                impacts.push({
                    type: 'consecration',
                    parentId: bishopId,
                    record: consecration,
                    effectiveBefore: adjusted.effectiveBefore,
                    effectiveAfter: adjusted.effectiveAfter,
                    isAllowed: adjusted.isAllowed,
                    targetValidity: adjusted.targetValidity
                });
            } else {
                effectiveStatus = StatusInheritance.getEffectiveStatus(consecration);
            }

            consecrationStatuses.push(effectiveStatus);
            if (effectiveStatus === 'valid' || effectiveStatus === 'sub_conditione') {
                hasValidConsecration = true;
            }
        });

        const hasAnyOrdinations = ordinationStatuses.length > 0;
        const hasAnyConsecrations = consecrationStatuses.length > 0;

        const worstOrdinationStatus = hasAnyOrdinations
            ? (StatusInheritance.getWorstStatus
                ? StatusInheritance.getWorstStatus(ordinationStatuses)
                : 'valid')
            : 'valid';

        const worstConsecrationStatus = hasAnyConsecrations
            ? (StatusInheritance.getWorstStatus
                ? StatusInheritance.getWorstStatus(consecrationStatuses)
                : 'valid')
            : 'valid';

        return {
            has_valid_ordination: hasAnyOrdinations ? hasValidOrdination : true,
            has_valid_consecration: hasAnyConsecrations ? hasValidConsecration : true,
            worst_ordination_status: worstOrdinationStatus || 'valid',
            worst_consecration_status: worstConsecrationStatus || 'valid'
        };
    }

    /**
     * Evaluate the full-cascade inheritance impact for a given root clergy ID.
     *
     * For each descendant reachable via ordination / consecration edges, this
     * simulates how their incoming events would be constrained under the
     * synthetic bishop summaries of the root and all intervening ancestors.
     *
     * The result can be used by the Validation Impact panel to highlight which
     * descendant events would need to be downgraded and to drive bulk actions.
     *
     * @param {number} rootId
     * @param {{ has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string }} syntheticRootSummary
     * @returns {{
     *   rootId: number,
     *   descendants: Array<{
     *     id: number,
     *     distance: number,
     *     parents: Array<number>,
     *     via: Array<object>,
     *     events: Array<{
     *       type: 'ordination'|'consecration',
     *       parentId: number,
     *       record: object,
     *       effectiveBefore: string,
     *       effectiveAfter: string,
     *       isAllowed: boolean,
     *       targetValidity: ('valid'|'doubtfully_valid'|'invalid')|null
     *     }>,
     *     hasViolation: boolean
     *   }>,
     *   summariesById: { [id: number]: { has_valid_ordination: boolean, has_valid_consecration: boolean, worst_ordination_status: string, worst_consecration_status: string } }
     * }}
     */
    function evaluateCascadeImpact(rootId, syntheticRootSummary) {
        if (!rootId || typeof rootId !== 'number') {
            return {
                rootId: rootId,
                descendants: [],
                summariesById: {}
            };
        }

        const StatusInheritance = (typeof window !== 'undefined' && window.StatusInheritance) ? window.StatusInheritance : null;
        const cache = getOrBuildCachedAdjacency();
        const clergyById = cache.clergyById || new Map();
        const adjacency = cache.adjacency || new Map();

        if (!StatusInheritance || !clergyById.has(rootId)) {
            return {
                rootId: rootId,
                descendants: [],
                summariesById: {}
            };
        }

        const summaryById = new Map();
        const eventImpactsByChildId = new Map();

        if (syntheticRootSummary) {
            summaryById.set(rootId, syntheticRootSummary);
        }

        const descendantDescriptors = getDescendantsBFS(rootId, adjacency);
        const processingOrder = [rootId].concat(descendantDescriptors.map(d => d.id));

        processingOrder.forEach(id => {
            const isRoot = id === rootId;
            const summary = buildSyntheticSummaryForClergyId(
                id,
                summaryById,
                eventImpactsByChildId,
                clergyById,
                StatusInheritance,
                isRoot
            );
            summaryById.set(id, summary);
        });

        const descendants = descendantDescriptors.map(desc => {
            const events = eventImpactsByChildId.get(desc.id) || [];
            const hasViolation = events.some(evt => evt && evt.isAllowed === false);
            return Object.assign({}, desc, {
                events: events,
                hasViolation: hasViolation
            });
        });

        const summariesPlain = {};
        summaryById.forEach((summary, id) => {
            summariesPlain[id] = summary;
        });

        return {
            rootId: rootId,
            descendants: descendants,
            summariesById: summariesPlain
        };
    }

    /**
     * Keep track of the last computed cascade impact so that bulk actions
     * can use the same data that was rendered into the panel.
     * @type {{ rootId: number, descendants: Array<object>, summariesById: object }|null}
     */
    let lastImpactResult = null;

    /**
     * Track the currently selected root clergy ID for the Validation Impact
     * panel. This is set via init() when a clergy is selected from the editor.
     * @type {number|null}
     */
    let currentRootClergyId = null;

    /**
     * Render an explicit "no selection" empty state into the Validation
     * Impact panel. Safe to call whenever there is no active clergy.
     */
    function renderValidationImpactEmpty() {
        if (typeof document === 'undefined') {
            return;
        }

        const panel = document.getElementById('validationImpactPanel');
        if (!panel) {
            return;
        }

        panel.innerHTML = '';

        const empty = document.createElement('div');
        empty.className = 'validation-impact-empty';
        empty.textContent = 'Select a clergy record to preview validation impact on its descendants.';
        panel.appendChild(empty);
    }

    /**
     * Render a lightweight loading state into the Validation Impact panel.
     * This can be used while cascade data is being recomputed.
     *
     * @param {string} [message]
     */
    function renderValidationImpactLoading(message) {
        if (typeof document === 'undefined') {
            return;
        }

        const panel = document.getElementById('validationImpactPanel');
        if (!panel) {
            return;
        }

        panel.innerHTML = '';

        const loading = document.createElement('div');
        loading.className = 'validation-impact-loading';
        loading.textContent = message || 'Computing validation impact...';
        panel.appendChild(loading);
    }

    /**
     * Render the Validation Impact panel DOM for a given cascade impact result.
     *
     * This focuses purely on DOM structure and visual state:
     *  - Descendant list with truncated name.
     *  - Relation badges (Ord. / Cons.).
     *  - Current status badge (worst effective status across relevant events).
     *  - Affected marker (when any event would be downgraded).
     *  - Per-row checkbox and "Update this clergy" button scaffolding.
     *
     * Behavioural wiring (select all, bulk apply, per-row actions) is handled
     * by follow-on tasks; this function only controls markup and basic state.
     *
     * @param {{ rootId: number, descendants: Array<object> }} impactResult
     */
    function renderValidationImpactPanel(impactResult) {
        if (typeof document === 'undefined') {
            return;
        }

        const panel = document.getElementById('validationImpactPanel');
        if (!panel) {
            return;
        }

        lastImpactResult = impactResult || null;

        panel.innerHTML = '';

        if (!impactResult || !impactResult.rootId) {
            renderValidationImpactEmpty();
            return;
        }

        const descendants = Array.isArray(impactResult.descendants) ? impactResult.descendants : [];
        if (descendants.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'validation-impact-empty';
            empty.textContent = 'No descendant clergy found for this bishop in the current graph.';
            panel.appendChild(empty);
            return;
        }

        const cache = getOrBuildCachedAdjacency();
        const clergyById = cache.clergyById || new Map();

        const affectedCount = descendants.reduce((count, desc) => desc && desc.hasViolation ? count + 1 : count, 0);

        const actions = document.createElement('div');
        actions.className = 'validation-impact-actions';

        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.className = 'validation-impact-btn-apply';
        applyButton.disabled = affectedCount === 0;
        applyButton.setAttribute('data-role', 'validation-impact-apply-all');
        applyButton.innerHTML = '<i class="fas fa-balance-scale-right" aria-hidden="true"></i><span>Apply to all affected</span>';

        const metaLine = document.createElement('div');
        metaLine.className = 'editor-text-xs editor-text-tertiary';
        metaLine.textContent = affectedCount > 0
            ? `${affectedCount} descendant${affectedCount === 1 ? '' : 's'} will need status adjustment.`
            : 'All descendant clergy are currently consistent with this bishop\'s validity.';

        const selectAllWrapper = document.createElement('label');
        selectAllWrapper.className = 'editor-text-xs editor-text-muted';
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.id = 'validationImpactSelectAll';
        selectAllCheckbox.setAttribute('data-role', 'validation-impact-select-all');
        selectAllCheckbox.checked = affectedCount > 0;
        selectAllCheckbox.style.marginRight = '0.35em';
        selectAllWrapper.appendChild(selectAllCheckbox);
        selectAllWrapper.appendChild(document.createTextNode('Include all affected descendants'));

        actions.appendChild(applyButton);
        actions.appendChild(metaLine);
        actions.appendChild(selectAllWrapper);

        panel.appendChild(actions);

        const list = document.createElement('ul');
        list.className = 'validation-impact-descendant-list';

        const STATUS_PRIORITY = {
            invalid: 4,
            doubtfully_valid: 3,
            doubtful_event: 2,
            sub_conditione: 1,
            valid: 0
        };

        function getWorstStatus(statuses) {
            if (!statuses || statuses.length === 0) {
                return null;
            }
            let worst = null;
            let worstScore = -1;
            statuses.forEach(status => {
                const score = STATUS_PRIORITY[status] != null ? STATUS_PRIORITY[status] : -1;
                if (score > worstScore) {
                    worstScore = score;
                    worst = status;
                }
            });
            return worst;
        }

        function getStatusLabel(status) {
            switch (status) {
                case 'invalid':
                    return 'Invalid';
                case 'doubtfully_valid':
                    return 'Doubtfully valid';
                case 'doubtful_event':
                    return 'Doubtful event';
                case 'sub_conditione':
                    return 'Sub conditione';
                case 'valid':
                default:
                    return 'Valid';
            }
        }

        descendants.forEach(desc => {
            if (!desc || typeof desc.id !== 'number') {
                return;
            }

            const row = document.createElement('li');
            row.className = 'validation-impact-descendant-row';
            row.setAttribute('data-clergy-id', String(desc.id));
            if (desc.hasViolation) {
                row.classList.add('affected');
                row.setAttribute('data-affected', 'true');
            }

            const clergy = clergyById.get(desc.id) || {};
            const fullName = clergy.name || clergy.display_name || `Clergy #${desc.id}`;

            const nameEl = document.createElement('span');
            nameEl.className = 'validation-impact-descendant-name';
            nameEl.textContent = fullName;
            nameEl.title = fullName;

            const relationBadges = document.createElement('span');
            relationBadges.className = 'validation-impact-relation-badges';

            const viaArray = Array.isArray(desc.via) ? desc.via : [];
            const hasOrdEdge = viaArray.some(v => v && Array.isArray(v.ordinations) && v.ordinations.length > 0);
            const hasConsEdge = viaArray.some(v => v && Array.isArray(v.consecrations) && v.consecrations.length > 0);

            if (hasOrdEdge) {
                const ordChip = document.createElement('span');
                ordChip.className = 'validation-impact-relation-chip';
                ordChip.textContent = hasConsEdge ? 'Ord.' : 'Ordination';
                relationBadges.appendChild(ordChip);
            }
            if (hasConsEdge) {
                const consChip = document.createElement('span');
                consChip.className = 'validation-impact-relation-chip';
                consChip.textContent = hasOrdEdge ? 'Cons.' : 'Consecration';
                relationBadges.appendChild(consChip);
            }

            const statusContainer = document.createElement('span');
            statusContainer.className = 'validation-impact-status-badges';

            const events = Array.isArray(desc.events) ? desc.events : [];
            const effectiveStatuses = events
                .map(evt => evt && (evt.effectiveBefore || evt.effectiveAfter))
                .filter(Boolean);
            const worstStatus = getWorstStatus(effectiveStatuses);

            if (worstStatus) {
                const statusBadge = document.createElement('span');
                statusBadge.className = 'validation-impact-badge validation-impact-badge--' + worstStatus;
                statusBadge.textContent = getStatusLabel(worstStatus);
                statusContainer.appendChild(statusBadge);
            }

            if (desc.hasViolation) {
                const impactBadge = document.createElement('span');
                impactBadge.className = 'validation-impact-badge validation-impact-badge--doubtfully_valid';
                impactBadge.textContent = 'Will downgrade';
                statusContainer.appendChild(impactBadge);
            }

            const actionsCell = document.createElement('span');
            actionsCell.className = 'validation-impact-row-actions';

            const rowCheckbox = document.createElement('input');
            rowCheckbox.type = 'checkbox';
            rowCheckbox.className = 'validation-impact-row-select';
            rowCheckbox.setAttribute('data-clergy-id', String(desc.id));
            rowCheckbox.checked = !!desc.hasViolation;

            const rowButton = document.createElement('button');
            rowButton.type = 'button';
            rowButton.className = 'validation-impact-btn-row';
            rowButton.setAttribute('data-clergy-id', String(desc.id));
            rowButton.textContent = 'Update this clergy';

            actionsCell.appendChild(rowCheckbox);
            actionsCell.appendChild(rowButton);

            row.appendChild(nameEl);
            row.appendChild(relationBadges);
            row.appendChild(statusContainer);
            row.appendChild(actionsCell);

            list.appendChild(row);
        });

        panel.appendChild(list);

        function getRowCheckboxes() {
            return Array.prototype.slice.call(
                panel.querySelectorAll('.validation-impact-row-select')
            );
        }

        function getAffectedRowCheckboxes() {
            return getRowCheckboxes().filter(function (checkbox) {
                const row = checkbox.closest('.validation-impact-descendant-row');
                return row && row.getAttribute('data-affected') === 'true';
            });
        }

        function updateApplyButtonState() {
            const affectedCheckboxes = getAffectedRowCheckboxes();
            const anySelected = affectedCheckboxes.some(function (checkbox) {
                return checkbox.checked;
            });
            applyButton.disabled = !anySelected;

            if (selectAllCheckbox) {
                const allSelected = affectedCheckboxes.length > 0 && affectedCheckboxes.every(function (checkbox) {
                    return checkbox.checked;
                });
                selectAllCheckbox.checked = allSelected && anySelected;
            }
        }

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function () {
                const checked = !!this.checked;
                getAffectedRowCheckboxes().forEach(function (checkbox) {
                    checkbox.checked = checked;
                });
                updateApplyButtonState();
            });
        }

        getRowCheckboxes().forEach(function (checkbox) {
            checkbox.addEventListener('change', function () {
                updateApplyButtonState();
            });
        });

        const rowButtons = panel.querySelectorAll('.validation-impact-btn-row');
        Array.prototype.forEach.call(rowButtons, function (button) {
            button.addEventListener('click', function () {
                const clergyId = this.getAttribute('data-clergy-id');
                if (!clergyId) {
                    return;
                }
                const row = panel.querySelector('.validation-impact-descendant-row[data-clergy-id="' + clergyId + '"]');
                if (!row) {
                    return;
                }
                const checkbox = row.querySelector('.validation-impact-row-select');
                if (!checkbox) {
                    return;
                }
                checkbox.checked = !checkbox.checked;
                updateApplyButtonState();
            });
        });

        applyButton.addEventListener('click', function () {
            const api = (typeof window !== 'undefined' && window.ValidationImpactPanel) ? window.ValidationImpactPanel : null;
            if (api && typeof api.applyBulkChanges === 'function') {
                api.applyBulkChanges();
            } else if (typeof console !== 'undefined' && console.warn) {
                console.warn('ValidationImpactPanel.applyBulkChanges is not defined yet.');
            }
        });

        updateApplyButtonState();
    }

    /**
     * Build and submit a bulk changes payload for all selected descendant
     * rows in the Validation Impact panel. On success, triggers soft
     * refreshes for the visualization, clergy list, and clergy form.
     */
    async function applyBulkChanges() {
        if (typeof document === 'undefined' || typeof fetch === 'undefined') {
            return;
        }

        const panel = document.getElementById('validationImpactPanel');
        if (!panel) {
            return;
        }

        // Derive the current root clergy ID from the last impact result or
        // fall back to the globally-tracked selected clergy.
        const rootIdFromImpact = lastImpactResult && typeof lastImpactResult.rootId === 'number'
            ? lastImpactResult.rootId
            : null;
        const globalRootId = (typeof window !== 'undefined' && typeof window.currentSelectedClergyId === 'number')
            ? window.currentSelectedClergyId
            : null;
        const rootClergyId = rootIdFromImpact || globalRootId;

        if (!rootClergyId) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('ValidationImpactPanel.applyBulkChanges: no root clergy ID available.');
            }
            return;
        }

        // Collect selected descendant IDs from the current panel DOM.
        const checkboxes = Array.prototype.slice.call(
            panel.querySelectorAll('.validation-impact-row-select')
        );
        const selectedIds = checkboxes
            .filter(function (checkbox) {
                if (!checkbox.checked) {
                    return false;
                }
                const row = checkbox.closest('.validation-impact-descendant-row');
                return row && row.getAttribute('data-affected') === 'true';
            })
            .map(function (checkbox) {
                const idStr = checkbox.getAttribute('data-clergy-id');
                const idNum = idStr ? parseInt(idStr, 10) : NaN;
                return Number.isFinite(idNum) ? idNum : null;
            })
            .filter(function (id) { return id !== null; });

        if (selectedIds.length === 0) {
            return;
        }

        // Recompute cascade impact using the latest form state so that
        // targetValidity values match the user's current edits.
        const syntheticRootSummary = buildSyntheticBishopSummaryFromForm(
            typeof document !== 'undefined' ? document : null
        );
        const impact = evaluateCascadeImpact(rootClergyId, syntheticRootSummary);
        lastImpactResult = impact;

        // Build the changes payload from all violating events for the
        // selected descendants.
        const changes = [];
        const descendants = Array.isArray(impact.descendants) ? impact.descendants : [];
        descendants.forEach(function (desc) {
            if (!desc || typeof desc.id !== 'number') {
                return;
            }
            if (selectedIds.indexOf(desc.id) === -1) {
                return;
            }

            const events = Array.isArray(desc.events) ? desc.events : [];
            events.forEach(function (evt) {
                if (!evt || evt.isAllowed !== false || !evt.targetValidity) {
                    return;
                }

                const record = evt.record || {};
                const rawId = record.id;
                const eventId = typeof rawId === 'number' ? rawId : parseInt(rawId, 10);
                if (!Number.isFinite(eventId)) {
                    return;
                }

                const type = evt.type === 'consecration' ? 'consecration' : 'ordination';
                changes.push({
                    type: type,
                    id: eventId,
                    new_validity: evt.targetValidity
                });
            });
        });

        if (changes.length === 0) {
            return;
        }

        const applyButton = panel.querySelector('[data-role="validation-impact-apply-all"]');
        let originalHtml = null;
        if (applyButton) {
            originalHtml = applyButton.innerHTML;
            applyButton.disabled = true;
            applyButton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Applying...</span>';
        }

        try {
            const response = await fetch('/editor/api/validation-impact/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    root_clergy_id: rootClergyId,
                    changes: changes
                })
            });

            const data = await response.json().catch(function () { return {}; });

            if (!response.ok || data.error) {
                if (typeof console !== 'undefined' && console.error) {
                    console.error('Validation impact bulk update failed:', data.error || response.statusText);
                }
                if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                    window.alert('Failed to apply bulk validation updates. Please try again.');
                }
                return;
            }

            // Soft refresh the visualization so its link colours / statuses
            // reflect the newly applied validity changes.
            if (typeof window !== 'undefined' && typeof window.softRefreshVisualization === 'function') {
                window.softRefreshVisualization();
            }

            // Soft-update clergy list items for all affected clergy, falling
            // back to a full list refresh if the helper is unavailable.
            const affectedIds = Array.isArray(data.affected_clergy_ids) ? data.affected_clergy_ids : [];
            if (affectedIds.length > 0) {
                if (typeof window !== 'undefined' && typeof window.softUpdateClergyListItem === 'function') {
                    affectedIds.forEach(function (id) {
                        if (id) {
                            window.softUpdateClergyListItem(id);
                        }
                    });
                } else if (typeof window !== 'undefined' && typeof window.refreshClergyListImages === 'function') {
                    window.refreshClergyListImages();
                }
            }

            // Refresh the clergy form for the root clergy if available so the
            // editor sees updated validity flags immediately.
            const refreshedRootId = data.root_clergy_id || rootClergyId;
            if (typeof window !== 'undefined') {
                if (typeof window.refreshClergyFormSmooth === 'function') {
                    window.refreshClergyFormSmooth(refreshedRootId);
                } else if (typeof window.refreshClergyForm === 'function') {
                    window.refreshClergyForm(refreshedRootId);
                }
            }

            // After the backend has applied changes, re-evaluate the cascade
            // based on the current (possibly reloaded) form state to update
            // the panel UI.
            const newSyntheticSummary = buildSyntheticBishopSummaryFromForm(
                typeof document !== 'undefined' ? document : null
            );
            const newImpact = evaluateCascadeImpact(refreshedRootId, newSyntheticSummary);
            lastImpactResult = newImpact;
            renderValidationImpactPanel(newImpact);
        } catch (error) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('Error during validation impact bulk update:', error);
            }
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('An unexpected error occurred while applying bulk validation updates.');
            }
        } finally {
            if (applyButton) {
                applyButton.disabled = false;
                if (originalHtml !== null) {
                    applyButton.innerHTML = originalHtml;
                }
            }
        }
    }

    /**
     * Internal helper to attach change listeners to the clergy form so that
     * the Validation Impact panel can react to live edits to validity
     * dropdowns and status checkboxes.
     *
     * @param {Element} root
     */
    function wireFormChangeListeners(root) {
        if (typeof document === 'undefined') {
            return;
        }
        const scope = root || document;
        const form = scope.querySelector ? (scope.querySelector('#clergyForm') || (scope.closest && scope.closest('#clergyForm'))) : document.getElementById('clergyForm');
        if (!form) {
            return;
        }
        if (form.getAttribute('data-validation-impact-wired') === 'true') {
            return;
        }
        form.setAttribute('data-validation-impact-wired', 'true');

        form.addEventListener('change', function (event) {
            const target = event.target;
            if (!target || !target.name) {
                return;
            }
            if (
                target.matches('select[name*="[validity]"]') ||
                target.matches('input[name*="[is_sub_conditione]"]') ||
                target.matches('input[name*="[is_doubtful_event]"]')
            ) {
                if (typeof window !== 'undefined' && window.ValidationImpactPanel && typeof window.ValidationImpactPanel.onFormChanged === 'function') {
                    window.ValidationImpactPanel.onFormChanged();
                }
            }
        });
    }

    /**
     * Initialise the Validation Impact panel for a given root clergy ID.
     * This computes a synthetic bishop summary from the live form, then
     * evaluates the cascade impact and renders the panel.
     *
     * @param {number|null} rootClergyId
     */
    function initValidationImpact(rootClergyId) {
        if (typeof document === 'undefined') {
            return;
        }

        const numericId = rootClergyId != null ? parseInt(rootClergyId, 10) : NaN;
        if (!Number.isFinite(numericId)) {
            currentRootClergyId = null;
            renderValidationImpactEmpty();
            return;
        }

        currentRootClergyId = numericId;
        renderValidationImpactLoading('Computing validation impact...');

        const syntheticSummary = buildSyntheticBishopSummaryFromForm(
            document.getElementById('clergyForm') || document
        );
        const impact = evaluateCascadeImpact(currentRootClergyId, syntheticSummary);
        lastImpactResult = impact;
        renderValidationImpactPanel(impact);

        wireFormChangeListeners(document.getElementById('clergyForm') || document);
    }

    /**
     * Recompute the cascade impact when the clergy form changes. This uses
     * the current root clergy ID and the latest synthetic bishop summary.
     */
    function handleFormChanged() {
        if (typeof document === 'undefined') {
            return;
        }
        if (!currentRootClergyId || !Number.isFinite(currentRootClergyId)) {
            return;
        }
        const syntheticSummary = buildSyntheticBishopSummaryFromForm(
            document.getElementById('clergyForm') || document
        );
        const impact = evaluateCascadeImpact(currentRootClergyId, syntheticSummary);
        lastImpactResult = impact;
        renderValidationImpactPanel(impact);
    }

    /**
     * Public API surface for this module.
     */
    const exported = {
        buildAdjacencyFromClergyList,
        getDescendantsBFS,
        getDescendantsDFS,
        getOrBuildCachedAdjacency,
        buildSyntheticBishopSummaryFromForm,
        evaluateCascadeImpact,
        renderValidationImpactPanel,
        renderValidationImpactEmpty,
        renderValidationImpactLoading,
        applyBulkChanges,
        init: initValidationImpact,
        onFormChanged: handleFormChanged
    };

    if (typeof window !== 'undefined') {
        const existing = window.ValidationImpactPanel || {};
        window.ValidationImpactPanel = Object.assign(existing, exported);

        // Wire global events: clergySeleced and HTMX afterSwap
        document.body.addEventListener('clergySeleced', function (event) {
            const detail = event && event.detail ? event.detail : {};
            const clergyId = detail.clergyId;
            if (clergyId == null) {
                renderValidationImpactEmpty();
                currentRootClergyId = null;
                return;
            }
            if (typeof window.ValidationImpactPanel.init === 'function') {
                window.ValidationImpactPanel.init(clergyId);
            }
        });

        document.body.addEventListener('htmx:afterSwap', function (event) {
            const target = (event.detail && event.detail.target) || event.target;
            if (!target) {
                return;
            }
            const containsForm = target.querySelector && target.querySelector('#clergyForm');
            const isForm = target.id === 'clergyForm';
            if (!(containsForm || isForm)) {
                return;
            }
            const formElement = containsForm || (isForm ? target : null) || document.getElementById('clergyForm');
            wireFormChangeListeners(formElement || document);

            const rootId = (typeof window.currentSelectedClergyId === 'number')
                ? window.currentSelectedClergyId
                : currentRootClergyId;
            if (rootId && typeof window.ValidationImpactPanel.init === 'function') {
                window.ValidationImpactPanel.init(rootId);
            } else if (!rootId) {
                renderValidationImpactEmpty();
            }
        });
    } else if (typeof globalThis !== 'undefined') {
        const existing = globalThis.ValidationImpactPanel || {};
        globalThis.ValidationImpactPanel = Object.assign(existing, exported);
    }
})();

