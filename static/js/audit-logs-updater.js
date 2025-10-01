// Audit Logs Updater - Handles real-time updates for audit logs
if (!window.AuditLogsUpdater) {
window.AuditLogsUpdater = class AuditLogsUpdater {
    constructor() {
        this.latestLogId = this.getLatestLogId();
        this.updateInterval = null;
        this.isActive = false;
        this.init();
    }

    init() {
        const auditLogsContent = document.getElementById('clergy-audit-logs-content');
        if (!auditLogsContent) {
            return;
        }

        // Start checking for updates when tab becomes active
        this.observeTabActivation(auditLogsContent);
    }

    getLatestLogId() {
        const latestEntry = document.querySelector('.audit-log-entry');
        return latestEntry ? parseInt(latestEntry.dataset.logId) : 0;
    }

    observeTabActivation(auditLogsContent) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const isActive = auditLogsContent.classList.contains('active');
                    if (isActive && !this.isActive) {
                        this.startUpdating();
                    } else if (!isActive && this.isActive) {
                        this.stopUpdating();
                    }
                }
            });
        });

        observer.observe(auditLogsContent, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Check initial state
        const isInitiallyActive = auditLogsContent.classList.contains('active');
        if (isInitiallyActive) {
            this.startUpdating();
        }
    }

    startUpdating() {
        this.isActive = true;
        this.updateInterval = setInterval(() => {
            this.checkForNewLogs();
        }, 2000); // Check every 2 seconds for faster updates
    }

    stopUpdating() {
        this.isActive = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async checkForNewLogs() {
        try {
            const response = await fetch(`/editor/audit-logs-check?since=${this.latestLogId}`);
            const data = await response.json();
            
            if (data.new_logs && data.new_logs.length > 0) {
                this.insertNewLogs(data.new_logs);
                this.latestLogId = Math.max(...data.new_logs.map(log => log.id));
            }
        } catch (error) {
            console.error('❌ Error checking for new audit logs:', error);
        }
    }

    insertNewLogs(newLogs) {
        const logsList = document.getElementById('audit-logs-list');
        if (!logsList) return;

        // Insert new logs at the top with smooth animation
        newLogs.forEach(log => {
            const logElement = this.createLogElement(log);
            
            // Add fade-in animation
            logElement.style.opacity = '0';
            logElement.style.transform = 'translateY(-10px)';
            logElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            
            logsList.insertBefore(logElement, logsList.firstChild);
            
            // Trigger animation
            requestAnimationFrame(() => {
                logElement.style.opacity = '1';
                logElement.style.transform = 'translateY(0)';
            });

            // Remove animation classes after animation completes
            setTimeout(() => {
                logElement.style.transition = '';
                logElement.style.transform = '';
            }, 300);
        });

        // Limit to last 50 entries to prevent memory issues
        const entries = logsList.querySelectorAll('.audit-log-entry');
        if (entries.length > 50) {
            for (let i = 50; i < entries.length; i++) {
                entries[i].remove();
            }
        }
    }

    createLogElement(log) {
        const div = document.createElement('div');
        div.className = 'audit-log-entry';
        div.dataset.logId = log.id;
        div.style.cssText = 'margin-bottom: 0.1em; padding: 0.25em 0.5em; background: transparent; color: rgba(255, 255, 255, 0.8);';
        
        const actionSymbol = this.getActionSymbol(log.action);
        const entityName = log.entity_name ? `: ${log.entity_name}` : '';
        const userName = log.user ? log.user.username : 'System';
        const timeStr = new Date(log.created_at).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        div.innerHTML = `
            <span style="color: rgba(255, 255, 255, 0.9); font-weight: 500;">
                ${actionSymbol} ${log.action.charAt(0).toUpperCase() + log.action.slice(1)}${entityName}
            </span>
            <span style="color: rgba(255, 255, 255, 0.6); font-size: 0.8em; display: block; margin-top: 0.1em;">
                • ${userName} • ${timeStr}
            </span>
        `;
        
        return div;
    }

    getActionSymbol(action) {
        switch(action) {
            case 'create': return '+';
            case 'update': return '~';
            case 'delete': return '−';
            default: return '•';
        }
    }
}
}

// Initialize the updater when DOM is ready, but only once
if (!window.auditLogsUpdater) {
    document.addEventListener('DOMContentLoaded', function() {
        if (!window.auditLogsUpdater && window.AuditLogsUpdater) {
            window.auditLogsUpdater = new window.AuditLogsUpdater();
        }
    });
    
    // Also try to initialize immediately if DOM is already ready
    if (document.readyState !== 'loading' && !window.auditLogsUpdater && window.AuditLogsUpdater) {
        window.auditLogsUpdater = new window.AuditLogsUpdater();
    }
}
