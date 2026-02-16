/**
 * Wiki syntax repairs module.
 * Registry of repair functions (footnotes, ordered lists) with runRepairs and applyRepairsToEditor.
 */
(function (global) {
    'use strict';

    const repairs = [];

    /**
     * Register a repair.
     * @param {string} id - Repair id (e.g. 'footnotes', 'orderedLists')
     * @param {(text: string) => string} run - Function that returns repaired text
     * @param {(text: string) => boolean} [shouldRun] - Optional predicate; if absent, always runs
     */
    function registerRepair(id, run, shouldRun) {
        repairs.push({ id, run, shouldRun: shouldRun || (() => true) });
    }

    /**
     * Run all repairs (or a subset) on text.
     * @param {string} text
     * @param {{ only?: string[] }} [opts] - only: run only these repair ids
     * @returns {string}
     */
    function runRepairs(text, opts = {}) {
        const only = opts.only ? new Set(opts.only) : null;
        let out = text;
        for (const r of repairs) {
            if (only && !only.has(r.id)) continue;
            if (!r.shouldRun(out)) continue;
            out = r.run(out);
        }
        return out;
    }

    /**
     * Renumber footnotes 1..n by order of first citation in document reading order.
     */
    function renumberFootnotes(text) {
        const defFirstRe = /^\[\^(\d+)\]:\s*(.*)$/;
        const continuationRe = /^(    |\t)(.*)$/;
        const defLineRe = /^\[\^(\d+)\]:/;
        const lines = text.split('\n');

        const defIndices = new Set();
        const defBlocks = [];
        for (let i = 0; i < lines.length; i++) {
            const defMatch = lines[i].match(defFirstRe);
            if (defMatch) {
                defIndices.add(i);
                let content = defMatch[2] ?? '';
                const blockLines = [lines[i]];
                let j = i + 1;
                while (j < lines.length) {
                    const cont = lines[j].match(continuationRe);
                    if (cont && !defLineRe.test(lines[j])) {
                        defIndices.add(j);
                        content += '\n' + lines[j];
                        blockLines.push(lines[j]);
                        j++;
                    } else break;
                }
                defBlocks.push({ id: defMatch[1], content, blockLines });
                i = j - 1;
            }
        }

        const body = lines
            .map((line, i) => (defIndices.has(i) ? null : line))
            .filter(line => line !== null)
            .join('\n');

        const refOrder = [];
        const seenRef = new Set();
        for (const m of body.matchAll(/\[\^(\d+)\](?!:)/g)) {
            const id = m[1];
            if (!seenRef.has(id)) {
                seenRef.add(id);
                refOrder.push(id);
            }
        }

        const defs = {};
        const defIdsInDocOrder = [];
        for (const b of defBlocks) {
            if (!(b.id in defs)) {
                defs[b.id] = b.content;
                defIdsInDocOrder.push(b.id);
            }
        }

        const refToContent = {};
        for (const id of refOrder) {
            refToContent[id] = id in defs ? defs[id] : undefined;
        }
        const unmatchedRefs = refOrder.filter(id => refToContent[id] === undefined);
        const unmatchedDefIds = defIdsInDocOrder.filter(id => !seenRef.has(id));
        for (let i = 0; i < unmatchedRefs.length && i < unmatchedDefIds.length; i++) {
            refToContent[unmatchedRefs[i]] = defs[unmatchedDefIds[i]];
        }
        for (const id of unmatchedRefs) {
            if (refToContent[id] === undefined) refToContent[id] = '';
        }
        const pairedDefIds = new Set(
            unmatchedRefs.slice(0, unmatchedDefIds.length).map((_, i) => unmatchedDefIds[i])
        );
        const defOnly = defIdsInDocOrder.filter(id => !seenRef.has(id) && !pairedDefIds.has(id));
        const orderedIds = [...refOrder, ...defOnly];
        if (orderedIds.length === 0) return text;

        const oldToNew = {};
        orderedIds.forEach((oldId, i) => { oldToNew[oldId] = String(i + 1); });

        const PREFIX = '\uFFFF';
        let out = text;
        orderedIds.forEach(oldId => {
            out = out.replace(new RegExp(`\\[\\^${oldId}\\](?!:)`, 'g'), `[^${PREFIX}${oldId}${PREFIX}]`);
        });
        orderedIds.forEach(oldId => {
            out = out.replace(new RegExp(`\\[\\^${PREFIX}${oldId}${PREFIX}\\]`, 'g'), `[^${oldToNew[oldId]}]`);
        });

        const outLines = out.split('\n');
        const modifiedBodyLines = outLines.filter((_, i) => !defIndices.has(i));
        const modifiedBody = modifiedBodyLines.join('\n');
        const getDefContent = (id) => refOrder.includes(id) ? (refToContent[id] ?? '') : (defs[id] ?? '');
        const renumberRefsInText = (s, map) => {
            if (!s) return s;
            return s.replace(/\[\^(\d+)\]/g, (_, n) => `[^${map[n] ?? n}]`);
        };
        const formatDefBlock = (oldId) => {
            const raw = renumberRefsInText(getDefContent(oldId), oldToNew);
            const parts = raw.split('\n');
            const first = `[^${oldToNew[oldId]}]: ${parts[0] || ''}`;
            if (parts.length <= 1) return first;
            return first + '\n' + parts.slice(1).join('\n');
        };
        const newDefLines = orderedIds.map(formatDefBlock);
        const sep = modifiedBody.trimEnd() ? '\n\n' : '';
        out = modifiedBody.trimEnd() + sep + newDefLines.join('\n');
        return out;
    }

    /**
     * Renumber ordered list items within each contiguous list block.
     */
    function renumberOrderedLists(text) {
        const lines = text.split('\n');
        const orderedRe = /^(\s*)(\d+)\.(\s+)/;
        const result = [];
        let i = 0;
        while (i < lines.length) {
            const m = lines[i].match(orderedRe);
            if (!m) {
                result.push(lines[i]);
                i++;
                continue;
            }
            const block = [];
            let j = i;
            while (j < lines.length) {
                const mm = lines[j].match(orderedRe);
                if (!mm) break;
                block.push({ indent: mm[1], num: mm[2], rest: mm[3] + lines[j].slice(m[0].length) });
                j++;
            }
            let num = 1;
            block.forEach(b => {
                result.push(b.indent + num + '.' + b.rest);
                num++;
            });
            i = j;
        }
        return result.join('\n');
    }

    registerRepair('footnotes', renumberFootnotes, (t) => /\[\^\d+\]/.test(t) || /\[\^\d+\]:/.test(t));
    registerRepair('orderedLists', renumberOrderedLists, (t) => /^\s*\d+\.\s+/m.test(t));

    /**
     * Apply repairs to a textarea. Updates value, preserves cursor, syncs highlighter.
     * @param {HTMLTextAreaElement} textarea
     * @param {{ wikiApp?: { highlighter?: { sync: () => void } }, only?: string[] }} [opts]
     */
    function applyRepairsToEditor(textarea, opts = {}) {
        if (!textarea) return;
        const before = textarea.value;
        const out = runRepairs(before, { only: opts.only });
        if (out !== before) {
            let pos = Math.min(textarea.selectionStart, out.length);
            textarea.value = out;
            const openIdx = out.lastIndexOf('[^', pos);
            if (openIdx !== -1) {
                const closeIdx = out.indexOf(']', openIdx);
                if (closeIdx !== -1 && pos > openIdx && pos <= closeIdx) {
                    pos = openIdx;
                }
            }
            textarea.setSelectionRange(pos, pos);
            const wikiApp = opts.wikiApp;
            if (wikiApp && wikiApp.highlighter && typeof wikiApp.highlighter.sync === 'function') {
                wikiApp.highlighter.sync();
            }
        }
    }

    /**
     * Get cursor context for ref/def detection.
     * @param {string} text
     * @param {number} pos - Cursor position
     * @returns {{ type: 'ref'|'def'|null }}
     */
    function getCursorContext(text, pos) {
        // def: cursor on a line matching [^n]:
        const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        const lineEnd = text.indexOf('\n', pos);
        const line = lineEnd === -1 ? text.slice(lineStart) : text.slice(lineStart, lineEnd);
        if (/^\[\^\d+\]:/.test(line)) {
            return { type: 'def' };
        }
        // ref: cursor inside [^ ... not yet closed
        const before = text.slice(0, pos);
        const openIdx = before.lastIndexOf('[^');
        if (openIdx === -1) return { type: null };
        const afterOpen = text.slice(openIdx, pos);
        if (!/^\[\^[^\]]*$/.test(afterOpen)) return { type: null };
        return { type: 'ref' };
    }

    global.WikiSyntaxRepairs = {
        registerRepair,
        runRepairs,
        applyRepairsToEditor,
        getCursorContext
    };
})(typeof window !== 'undefined' ? window : this);
