// ===================================
// PAGE NAVIGATION CONTROLLER
// Manages page-to-page navigation with history stack
// ===================================

class PageNavigationController {
    constructor() {
        this.history = [];
        this.currentPage = 'pos-main';
        this.pageStates = {}; // Store page states for preservation
        this.initialized = false;
    }

    /**
     * Initialize the navigation system
     */
    init() {
        if (this.initialized) return;
        
        console.log('🧭 Initializing Page Navigation Controller');
        
        // Set initial page
        this.history.push('pos-main');
        
        // Setup browser back button handler
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.page) {
                this.navigateTo(event.state.page, false, true);
            }
        });
        
        // Initial history state
        history.replaceState({ page: 'pos-main' }, '', '');
        
        this.initialized = true;
        console.log('✅ Page Navigation Controller initialized');
    }

    /**
     * Navigate to a page
     * @param {string} pageId - The ID of the page to navigate to
     * @param {boolean} saveState - Whether to save current page state
     * @param {boolean} isBackAction - Whether this is a back navigation
     */
    navigateTo(pageId, saveState = true, isBackAction = false) {
        console.log(`🧭 Navigating from ${this.currentPage} to ${pageId}`);
        
        // Save current page state if requested
        if (saveState && this.currentPage) {
            this.savePageState(this.currentPage);
        }
        
        // Hide current page
        this.hidePage(this.currentPage);
        
        // Show new page
        this.showPage(pageId);
        
        // Update history
        if (!isBackAction) {
            this.history.push(pageId);
            history.pushState({ page: pageId }, '', '');
        }
        
        // Update current page
        this.currentPage = pageId;
        
        // Restore page state if available
        this.restorePageState(pageId);
        
        console.log(`✅ Now on page: ${pageId}, History length: ${this.history.length}`);
    }

    /**
     * Go back to previous page
     */
    goBack() {
        if (this.history.length <= 1) {
            console.warn('⚠️ Already at root page');
            return;
        }
        
        console.log(`🔙 Current history:`, [...this.history]);
        
        // Remove current page from history
        this.history.pop();
        
        // Get previous page
        const previousPage = this.history[this.history.length - 1];
        
        console.log(`🔙 Going back from ${this.currentPage} to: ${previousPage}`);
        
        // Save current page state
        this.savePageState(this.currentPage);
        
        // Hide current page
        this.hidePage(this.currentPage);
        
        // Show previous page
        this.showPage(previousPage);
        
        // Update current page
        this.currentPage = previousPage;
        
        // Restore page state
        this.restorePageState(previousPage);
        
        // Update browser history
        history.back();
        
        console.log(`✅ Back to: ${previousPage}, History: ${this.history.length} pages`);
    }

    /**
     * Hide a page
     * @param {string} pageId - The ID of the page to hide
     */
    hidePage(pageId) {
        const pages = {
            'pos-main': () => {
                const posApp = document.getElementById('pos-app');
                if (posApp) posApp.style.display = 'none';
            },
            'admin-dashboard': () => {
                const adminModal = document.getElementById('admin-dashboard-modal');
                if (adminModal) adminModal.style.display = 'none';
            },
            'sales-reports': () => {
                const reportsModal = document.getElementById('reports-modal');
                if (reportsModal) reportsModal.style.display = 'none';
            },
            'staff-management': () => {
                const staffModal = document.getElementById('staff-modal');
                if (staffModal) staffModal.style.display = 'none';
            },
            'customer-display': () => {
                // Customer display window handling
                console.log('Hiding customer display');
            }
        };
        
        if (pages[pageId]) {
            pages[pageId]();
        }
    }

    /**
     * Show a page
     * @param {string} pageId - The ID of the page to show
     */
    showPage(pageId) {
        const pages = {
            'pos-main': () => {
                const posApp = document.getElementById('pos-app');
                if (posApp) {
                    posApp.style.display = 'flex';
                    posApp.style.visibility = 'visible';
                }
            },
            'admin-dashboard': () => {
                const adminModal = document.getElementById('admin-dashboard-modal');
                if (adminModal) {
                    adminModal.style.display = 'block';
                    // Load default tab if not preserved
                    if (!this.pageStates[pageId]) {
                        if (typeof loadAdminTab === 'function') {
                            loadAdminTab('overview');
                        }
                    }
                }
            },
            'sales-reports': async () => {
                const reportsModal = document.getElementById('reports-modal');
                if (reportsModal) {
                    reportsModal.style.display = 'block';
                    // Initialize reports if not already done
                    if (typeof window.initReports === 'function') {
                        await window.initReports();
                    }
                }
            },
            'staff-management': () => {
                const staffModal = document.getElementById('staff-modal');
                if (staffModal) {
                    staffModal.style.display = 'block';
                    // Initialize staff management if needed
                    if (typeof openStaffManagement === 'function') {
                        openStaffManagement();
                    }
                }
            },
            'customer-display': () => {
                // Customer display window handling
                if (typeof openCustomerDisplay === 'function') {
                    openCustomerDisplay();
                }
            }
        };
        
        if (pages[pageId]) {
            pages[pageId]();
        } else {
            console.error(`❌ Unknown page: ${pageId}`);
        }
    }

    /**
     * Save page state
     * @param {string} pageId - The ID of the page
     */
    savePageState(pageId) {
        const state = {};
        
        switch (pageId) {
            case 'admin-dashboard':
                // Save active tab
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab) {
                    state.activeTab = activeTab.dataset.tab;
                }
                break;
                
            case 'sales-reports':
                // Save selected period and filters
                const activePeriod = document.querySelector('.period-btn.active');
                if (activePeriod) {
                    state.activePeriod = activePeriod.dataset.period;
                }
                // Save filter values (check both admin container and modal)
                const adminContainer = document.getElementById('admin-reports-container');
                const reportsModal = document.getElementById('reports-modal');
                const container = (adminContainer && adminContainer.offsetParent !== null) ? adminContainer : reportsModal;
                
                const startDate = container?.querySelector('#filter-start-date');
                const endDate = container?.querySelector('#filter-end-date');
                if (startDate) state.startDate = startDate.value;
                if (endDate) state.endDate = endDate.value;
                break;
        }
        
        this.pageStates[pageId] = state;
        console.log(`💾 Saved state for ${pageId}:`, state);
    }

    /**
     * Restore page state
     * @param {string} pageId - The ID of the page
     */
    restorePageState(pageId) {
        const state = this.pageStates[pageId];
        if (!state) return;
        
        console.log(`📂 Restoring state for ${pageId}:`, state);
        
        switch (pageId) {
            case 'admin-dashboard':
                // Restore active tab
                if (state.activeTab && typeof loadAdminTab === 'function') {
                    setTimeout(() => loadAdminTab(state.activeTab), 100);
                }
                break;
                
            case 'sales-reports':
                // Restore period and filters
                if (state.activePeriod) {
                    const periodBtn = document.querySelector(`.period-btn[data-period="${state.activePeriod}"]`);
                    if (periodBtn) periodBtn.click();
                }
                if (state.startDate || state.endDate) {
                    // Check both admin container and modal
                    const adminContainer = document.getElementById('admin-reports-container');
                    const reportsModal = document.getElementById('reports-modal');
                    const container = (adminContainer && adminContainer.offsetParent !== null) ? adminContainer : reportsModal;
                    
                    if (state.startDate) {
                        const startDate = container?.querySelector('#filter-start-date');
                        if (startDate) startDate.value = state.startDate;
                    }
                    if (state.endDate) {
                        const endDate = container?.querySelector('#filter-end-date');
                        if (endDate) endDate.value = state.endDate;
                    }
                }
                break;
        }
    }

    /**
     * Clear page state
     * @param {string} pageId - The ID of the page
     */
    clearPageState(pageId) {
        delete this.pageStates[pageId];
        console.log(`🗑️ Cleared state for ${pageId}`);
    }

    /**
     * Get current page
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * Get navigation history
     */
    getHistory() {
        return [...this.history];
    }
}

// Create global instance
const pageNav = new PageNavigationController();

// Export for use in other modules
window.pageNav = pageNav;
window.PageNavigationController = PageNavigationController;

console.log('📄 page-navigation.js loaded');
