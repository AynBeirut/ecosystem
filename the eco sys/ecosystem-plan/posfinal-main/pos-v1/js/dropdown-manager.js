// ===================================
// DROPDOWN MANAGER - SINGLETON PATTERN
// Prevents duplicate event listeners and manages all dropdowns
// ===================================

class DropdownManager {
    constructor() {
        // Singleton pattern - return existing instance if already created
        if (DropdownManager.instance) {
            return DropdownManager.instance;
        }
        
        this.initialized = false;
        this.activeDropdown = null;
        this.listeners = [];
        this.intervals = [];
        this.registered = new Set(); // Track registered dropdowns to prevent duplicates
        DropdownManager.instance = this;
    }
    
    /**
     * Initialize the dropdown manager (call once on app load)
     */
    init() {
        if (this.initialized) {
            console.log('⚠️ DropdownManager already initialized');
            return;
        }
        
        // Single document click listener to close dropdowns when clicking outside
        this.documentClickListener = (e) => {
            if (this.activeDropdown && !this.activeDropdown.contains(e.target)) {
                const toggleBtn = this.activeDropdown.dataset.toggleBtn;
                if (toggleBtn) {
                    const btn = document.getElementById(toggleBtn);
                    if (btn && !btn.contains(e.target)) {
                        this.closeAll();
                    }
                } else {
                    this.closeAll();
                }
            }
        };
        
        document.addEventListener('click', this.documentClickListener);
        this.initialized = true;
        console.log('✅ DropdownManager initialized');
    }
    
    /**
     * Register a dropdown with its toggle button
     * @param {HTMLElement} toggleBtn - Button that toggles the dropdown
     * @param {HTMLElement} dropdown - Dropdown element to show/hide
     * @param {Object} options - Optional configuration
     */
    register(toggleBtn, dropdown, options = {}) {
        if (!toggleBtn || !dropdown) {
            console.error('❌ DropdownManager: Invalid elements provided');
            return;
        }
        
        // Check if already registered to prevent duplicate listeners
        const dropdownKey = `${toggleBtn.id}-${dropdown.id}`;
        if (this.registered.has(dropdownKey)) {
            console.log(`⚠️ Dropdown already registered: ${dropdownKey}`);
            return;
        }
        
        // Mark as registered
        this.registered.add(dropdownKey);
        
        // Store reference to toggle button in dropdown
        dropdown.dataset.toggleBtn = toggleBtn.id;
        
        // Add simple debounce protection
        let isToggling = false;
        
        // Create click listener with minimal debounce
        const listener = (e) => {
            e.stopPropagation();
            
            // Simple debounce check
            if (isToggling) {
                return;
            }
            
            isToggling = true;
            
            // Toggle instantly
            this.toggle(dropdown);
            
            // Reset quickly
            setTimeout(() => {
                isToggling = false;
            }, 100);
        };
        
        toggleBtn.addEventListener('click', listener);
        this.listeners.push({ element: toggleBtn, listener, type: 'click' });
        
        console.log(`✅ Registered dropdown: ${dropdown.id} with toggle: ${toggleBtn.id}`);
        
        // Handle optional click handlers inside dropdown
        if (options.closeOnItemClick) {
            const items = dropdown.querySelectorAll(options.itemSelector || '.dropdown-item');
            console.log(`📝 Found ${items.length} dropdown items for ${dropdown.id}:`, Array.from(items).map(i => i.id));
            items.forEach(item => {
                const itemListener = (e) => {
                    console.log(`🖱️ Dropdown item clicked: ${item.id}`);
                    // Don't stop propagation - let other handlers fire first
                    setTimeout(() => this.closeAll(), 50);
                };
                item.addEventListener('click', itemListener);
                this.listeners.push({ element: item, listener: itemListener, type: 'click' });
            });
        }
    }
    
    /**
     * Toggle a specific dropdown (close others)
     * @param {HTMLElement} dropdown - Dropdown to toggle
     */
    toggle(dropdown) {
        const isOpen = this.activeDropdown === dropdown;
        
        // Close immediately
        this.closeAll();
        
        // Open if was closed
        if (!isOpen) {
            dropdown.style.display = 'block';
            dropdown.style.opacity = '1';
            this.activeDropdown = dropdown;
        }
    }
    
    /**
     * Close all dropdowns
     */
    closeAll() {
        if (this.activeDropdown) {
            this.activeDropdown.style.display = 'none';
            this.activeDropdown = null;
        }
    }
    
    /**
     * Register an interval that should be cleaned up
     * @param {number} intervalId - Interval ID to track
     */
    registerInterval(intervalId) {
        this.intervals.push(intervalId);
    }
    
    /**
     * Cleanup all listeners and intervals
     */
    cleanup() {
        console.log(`🧹 Cleaning up ${this.listeners.length} dropdown listeners`);
        
        // Remove all registered listeners
        this.listeners.forEach(({ element, listener, type }) => {
            element.removeEventListener(type, listener);
        });
        
        // Remove document listener
        if (this.documentClickListener) {
            document.removeEventListener('click', this.documentClickListener);
        }
        
        // Clear all intervals
        this.intervals.forEach(intervalId => clearInterval(intervalId));
        
        // Reset state
        this.listeners = [];
        this.intervals = [];
        this.registered = new Set(); // Clear registered dropdowns
        this.activeDropdown = null;
        this.initialized = false;
        
        console.log('✅ DropdownManager cleanup complete');
    }
}

// Create and export singleton instance
window.dropdownManager = new DropdownManager();
