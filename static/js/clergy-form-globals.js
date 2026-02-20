/**
 * Canonical clear for clergy form image/file globals and spritesheet polling.
 * Callers should use window.clergyFormGlobals?.clear() for load-order safety.
 */
(function () {
    'use strict';

    window.clergyFormGlobals = {
        clear: function () {
            delete window.droppedFile;
            delete window.processedImageData;

            if (window.spritesheetPollingInterval != null) {
                clearInterval(window.spritesheetPollingInterval);
                window.spritesheetPollingInterval = null;
            }

            if (window.imageEditor && typeof window.imageEditor.clearProcessedData === 'function') {
                window.imageEditor.clearProcessedData();
            }
        }
    };
})();
