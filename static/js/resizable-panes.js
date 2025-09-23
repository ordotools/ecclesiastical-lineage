/**
 * Resizable Panes for Editor Interface
 * Provides drag-to-resize functionality for editor panels
 */

class ResizablePanes {
    constructor() {
        this.isResizing = false;
        this.currentResizer = null;
        this.startX = 0;
        this.startY = 0;
        this.startLeftWidth = 0;
        this.startRightWidth = 0;
        this.startBottomHeight = 0;
        this.initialized = false;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeEditor());
        } else {
            this.initializeEditor();
        }
        
        // Also listen for HTMX events to ensure content is loaded
        document.addEventListener('htmx:afterSettle', () => this.initializeEditor());
    }

    initializeEditor() {
        // Only setup once
        if (this.initialized) return;
        
        const container = document.querySelector('.editor-container');
        if (!container) return;
        
        this.setupResizers();
        this.loadLayout();
        this.initialized = true;
    }

    setupResizers() {
        // Create and add resize handles
        this.createVerticalResizer('left-resizer', 'left-panel', 'center-panel');
        this.createVerticalResizer('right-resizer', 'center-panel', 'right-panel');
        this.createHorizontalResizer('bottom-resizer', 'bottom-panel');
        
        // Add event listeners
        this.addEventListeners();
        
        // Position handles correctly on initial setup
        setTimeout(() => this.updateHandlePositions(), 0);
    }

    createVerticalResizer(id, leftPanelClass, rightPanelClass) {
        const resizer = document.createElement('div');
        resizer.id = id;
        resizer.className = 'resize-handle vertical-resize';
        resizer.dataset.leftPanel = leftPanelClass;
        resizer.dataset.rightPanel = rightPanelClass;
        
        // Add to the editor container
        const container = document.querySelector('.editor-container');
        if (container) {
            container.appendChild(resizer);
        }
    }

    createHorizontalResizer(id, panelClass) {
        const resizer = document.createElement('div');
        resizer.id = id;
        resizer.className = 'resize-handle horizontal-resize';
        resizer.dataset.panel = panelClass;
        
        // Add to the editor container
        const container = document.querySelector('.editor-container');
        if (container) {
            container.appendChild(resizer);
        }
    }

    addEventListeners() {
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
        
        // Prevent text selection during resize
        document.addEventListener('selectstart', (e) => {
            if (this.isResizing) {
                e.preventDefault();
            }
        });
    }

    handleMouseDown(e) {
        if (!e.target.classList.contains('resize-handle')) return;
        
        this.isResizing = true;
        this.currentResizer = e.target;
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        document.body.style.cursor = this.currentResizer.classList.contains('vertical-resize') 
            ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
        
        // Store initial dimensions
        this.storeInitialDimensions();
        
        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.isResizing || !this.currentResizer) return;
        
        const container = document.querySelector('.editor-container');
        if (!container) return;
        
        if (this.currentResizer.classList.contains('vertical-resize')) {
            this.handleVerticalResize(e, container);
        } else {
            this.handleHorizontalResize(e, container);
        }
        
        e.preventDefault();
    }

    handleVerticalResize(e, container) {
        const deltaX = e.clientX - this.startX;
        const containerWidth = container.offsetWidth;
        
        if (this.currentResizer.id === 'left-resizer') {
            // Resizing between left and center panels
            const newLeftWidth = Math.max(200, Math.min(600, this.startLeftWidth + deltaX));
            
            // Keep the right panel at its current width
            const rightPanel = document.querySelector('.right-panel');
            const currentRightWidth = rightPanel ? rightPanel.offsetWidth : 400;
            
            container.style.gridTemplateColumns = `${newLeftWidth}px 1fr ${currentRightWidth}px`;
            
            // Move the left resizer handle
            this.currentResizer.style.left = `${newLeftWidth}px`;
            
            // Ensure handle height is correct based on bottom panel
            const bottomPanel = document.querySelector('.bottom-panel');
            if (bottomPanel) {
                const newHeight = container.offsetHeight - bottomPanel.offsetHeight;
                this.currentResizer.style.height = `${newHeight}px`;
            }
            
        } else if (this.currentResizer.id === 'right-resizer') {
            // Resizing between center and right panels
            const newRightWidth = Math.max(250, Math.min(600, this.startRightWidth - deltaX));
            
            // Keep the left panel at its current width
            const leftPanel = document.querySelector('.left-panel');
            const currentLeftWidth = leftPanel ? leftPanel.offsetWidth : 350;
            
            container.style.gridTemplateColumns = `${currentLeftWidth}px 1fr ${newRightWidth}px`;
            
            // Move the right resizer handle
            this.currentResizer.style.right = `${newRightWidth}px`;
            
            // Ensure handle height is correct based on bottom panel
            const bottomPanel = document.querySelector('.bottom-panel');
            if (bottomPanel) {
                const newHeight = container.offsetHeight - bottomPanel.offsetHeight;
                this.currentResizer.style.height = `${newHeight}px`;
            }
        }
    }

    handleHorizontalResize(e, container) {
        const deltaY = e.clientY - this.startY;
        const containerHeight = container.offsetHeight;
        
        if (this.currentResizer.id === 'bottom-resizer') {
            const newBottomHeight = Math.max(150, Math.min(500, this.startBottomHeight - deltaY));
            
            container.style.gridTemplateRows = `1fr ${newBottomHeight}px`;
            
            // Move the bottom resizer handle
            this.currentResizer.style.bottom = `${newBottomHeight}px`;
            
            // Update the height of vertical resize handles
            const leftResizer = document.getElementById('left-resizer');
            const rightResizer = document.getElementById('right-resizer');
            const newVerticalHeight = containerHeight - newBottomHeight;
            
            if (leftResizer) {
                leftResizer.style.height = `${newVerticalHeight}px`;
            }
            
            if (rightResizer) {
                rightResizer.style.height = `${newVerticalHeight}px`;
            }
        }
    }

    handleMouseUp() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        this.currentResizer = null;
        
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Save current layout to localStorage for persistence
        this.saveLayout();
    }

    storeInitialDimensions() {
        // Get actual current panel dimensions
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        const bottomPanel = document.querySelector('.bottom-panel');
        
        if (!leftPanel || !rightPanel || !bottomPanel) return;
        
        // Store actual current dimensions
        this.startLeftWidth = leftPanel.offsetWidth;
        this.startRightWidth = rightPanel.offsetWidth;
        this.startBottomHeight = bottomPanel.offsetHeight;
    }

    saveLayout() {
        // Save actual panel dimensions
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        const bottomPanel = document.querySelector('.bottom-panel');
        
        if (!leftPanel || !rightPanel || !bottomPanel) return;
        
        const layout = {
            leftWidth: leftPanel.offsetWidth,
            rightWidth: rightPanel.offsetWidth,
            bottomHeight: bottomPanel.offsetHeight
        };
        
        localStorage.setItem('editorLayout', JSON.stringify(layout));
    }

    loadLayout() {
        const savedLayout = localStorage.getItem('editorLayout');
        if (!savedLayout) return;
        
        try {
            const layout = JSON.parse(savedLayout);
            const container = document.querySelector('.editor-container');
            
            if (container) {
                // Handle new format (dimensions)
                if (layout.leftWidth && layout.rightWidth && layout.bottomHeight) {
                    container.style.gridTemplateColumns = `${layout.leftWidth}px 1fr ${layout.rightWidth}px`;
                    container.style.gridTemplateRows = `1fr ${layout.bottomHeight}px`;
                }
                // Handle old format (CSS strings) - backward compatibility
                else if (layout.gridTemplateColumns && layout.gridTemplateRows) {
                    container.style.gridTemplateColumns = layout.gridTemplateColumns;
                    container.style.gridTemplateRows = layout.gridTemplateRows;
                }
                
                // Update handle positions after layout is applied
                setTimeout(() => this.updateHandlePositions(), 0);
            }
        } catch (e) {
            console.warn('Failed to load saved editor layout:', e);
            // Clear corrupted data
            localStorage.removeItem('editorLayout');
        }
    }

    updateHandlePositions() {
        const container = document.querySelector('.editor-container');
        if (!container) return;
        
        // Get actual computed dimensions from the grid
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        const bottomPanel = document.querySelector('.bottom-panel');
        
        if (!leftPanel || !rightPanel || !bottomPanel) return;
        
        const leftWidth = leftPanel.offsetWidth;
        const rightWidth = rightPanel.offsetWidth;
        const bottomHeight = bottomPanel.offsetHeight;
        
        // Update handle positions
        const leftResizer = document.getElementById('left-resizer');
        const rightResizer = document.getElementById('right-resizer');
        const bottomResizer = document.getElementById('bottom-resizer');
        
        if (leftResizer) {
            leftResizer.style.left = `${leftWidth}px`;
            leftResizer.style.height = `${container.offsetHeight - bottomHeight}px`;
        }
        
        if (rightResizer) {
            rightResizer.style.right = `${rightWidth}px`;
            rightResizer.style.height = `${container.offsetHeight - bottomHeight}px`;
        }
        
        if (bottomResizer) {
            bottomResizer.style.bottom = `${bottomHeight}px`;
        }
    }

    resetLayout() {
        const container = document.querySelector('.editor-container');
        if (container) {
            container.style.gridTemplateColumns = '350px 1fr 400px';
            container.style.gridTemplateRows = '1fr 300px';
            localStorage.removeItem('editorLayout');
            
            // Update handle positions to match reset layout
            setTimeout(() => this.updateHandlePositions(), 0);
        }
    }
}

// Initialize when the script loads
new ResizablePanes();
