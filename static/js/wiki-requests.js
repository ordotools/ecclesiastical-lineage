// Helper for tracking clergy article requests with localStorage de-duplication
// and wiring them to the wiki article request API.
//
// Exposes a small API on window.WikiArticleRequests:
//   - hasRequested(clergyId): boolean
//   - requestArticle(clergyId): Promise<{ ok, duplicate, status?, demand?, data?, error? }>
//
// The helper stores a map in localStorage under STORAGE_KEY that looks like:
//   { "123": "2026-02-27T12:00:00.000Z", ... }

(function () {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    const STORAGE_KEY = 'clergyArticleRequests';

    function safeParse(json) {
        if (!json) return {};
        try {
            const parsed = JSON.parse(json);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (err) {
            console.warn('Failed to parse clergyArticleRequests from localStorage; resetting.', err);
            return {};
        }
    }

    function readRequestMap() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return safeParse(raw);
        } catch (err) {
            console.warn('Unable to read clergyArticleRequests from localStorage.', err);
            return {};
        }
    }

    function writeRequestMap(map) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
        } catch (err) {
            console.warn('Unable to persist clergyArticleRequests to localStorage.', err);
        }
    }

    function normalizeId(clergyId) {
        if (clergyId === null || clergyId === undefined) return null;
        const str = String(clergyId).trim();
        return str === '' ? null : str;
    }

    function hasRequested(clergyId) {
        const id = normalizeId(clergyId);
        if (!id) return false;
        const map = readRequestMap();
        return Object.prototype.hasOwnProperty.call(map, id);
    }

    async function requestArticle(clergyId) {
        const id = normalizeId(clergyId);
        if (!id) {
            return {
                ok: false,
                duplicate: false,
                error: 'missing-clergy-id',
            };
        }

        // Client-side de-duplication: don't even hit the API if
        // this browser has already requested this clergy.
        if (hasRequested(id)) {
            return {
                ok: false,
                duplicate: true,
            };
        }

        if (typeof fetch !== 'function') {
            return {
                ok: false,
                duplicate: false,
                error: 'fetch-unavailable',
            };
        }

        try {
            const res = await fetch('/api/wiki/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ clergy_id: id }),
            });

            if (!res.ok) {
                return {
                    ok: false,
                    duplicate: false,
                    status: res.status,
                };
            }

            let data = null;
            try {
                data = await res.json();
            } catch (err) {
                // Non-fatal: treat as success without structured payload.
                data = null;
            }

            const map = readRequestMap();
            map[id] = new Date().toISOString();
            writeRequestMap(map);

            return {
                ok: true,
                duplicate: false,
                demand: data && typeof data.demand !== 'undefined' ? data.demand : undefined,
                data,
            };
        } catch (err) {
            console.error('Failed to POST wiki article request', err);
            return {
                ok: false,
                duplicate: false,
                error: 'network-error',
            };
        }
    }

    async function getRequestStatus(clergyId) {
        const id = normalizeId(clergyId);
        if (!id) {
            return {
                ok: false,
                error: 'missing-clergy-id',
            };
        }

        if (typeof fetch !== 'function') {
            return {
                ok: false,
                error: 'fetch-unavailable',
            };
        }

        try {
            const res = await fetch(`/api/wiki/requests/status?clergy_id=${encodeURIComponent(id)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!res.ok) {
                return {
                    ok: false,
                    status: res.status,
                };
            }

            let data = null;
            try {
                data = await res.json();
            } catch (err) {
                // Non-fatal: treat as success without structured payload.
                data = null;
            }

            const demand = data && typeof data.demand !== 'undefined' ? data.demand : undefined;
            const queuePosition = data && typeof data.queue_position !== 'undefined' ? data.queue_position : undefined;

            return {
                ok: true,
                demand,
                queuePosition,
                data,
            };
        } catch (err) {
            console.error('Failed to GET wiki article request status', err);
            return {
                ok: false,
                error: 'network-error',
            };
        }
    }

    window.WikiArticleRequests = {
        hasRequested,
        requestArticle,
        getStatus: getRequestStatus,
        // Expose storage key for potential debugging/inspection.
        STORAGE_KEY,
    };
})();

