/* ===================================
   RIPPLE EFFECT FOR TOUCHSCREEN
   Material Design Ripple Animation
   =================================== */

(function() {
    'use strict';

    /**
     * Create ripple effect on element
     * @param {Event} event - Click or touch event
     * @param {HTMLElement} element - Target element
     */
    function createRipple(event, element) {
        // Remove existing ripples
        const existingRipples = element.querySelectorAll('.ripple');
        existingRipples.forEach(ripple => ripple.remove());

        // Create ripple element
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');

        // Get element position and size
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        // Set ripple position and size
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        // Add ripple to element
        element.appendChild(ripple);

        // Remove ripple after animation
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    /**
     * Add ripple effect to element
     * @param {HTMLElement} element - Element to add ripple to
     */
    function addRippleEffect(element) {
        // Skip if already has ripple
        if (element.dataset.rippleAdded) return;
        
        // Mark as added
        element.dataset.rippleAdded = 'true';
        
        // Ensure element has position relative or absolute
        const position = window.getComputedStyle(element).position;
        if (position === 'static') {
            element.style.position = 'relative';
        }
        
        // Ensure overflow hidden for ripple effect
        element.style.overflow = 'hidden';

        // Add click/touch event listener
        element.addEventListener('click', function(event) {
            createRipple(event, this);
        });

        element.addEventListener('touchstart', function(event) {
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                const mouseEvent = new MouseEvent('click', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true
                });
                createRipple(mouseEvent, this);
            }
        }, { passive: true });
    }

    /**
     * Initialize ripple effects on all buttons
     */
    function initRippleEffects() {
        // Selectors for elements that should have ripple
        const selectors = [
            '.btn-primary',
            '.btn-secondary',
            '.btn-success',
            '.btn-checkout',
            '.btn-place-order',
            '.product-card',
            '.category-btn',
            '.tab-btn',
            '.payment-method-btn',
            '.quick-cash-btn',
            '.qty-btn',
            '.cart-item-remove',
            '.status-dropdown-item',
            '.modal-close',
            'button:not(.no-ripple)'
        ];

        // Add ripple to all matching elements
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                addRippleEffect(element);
            });
        });
    }

    /**
     * Observe DOM for dynamically added buttons
     */
    function observeDynamicElements() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        // Check if the node itself is a button
                        if (node.matches('button') || 
                            node.matches('.btn-primary') || 
                            node.matches('.btn-secondary') ||
                            node.matches('.product-card') ||
                            node.matches('.category-btn')) {
                            addRippleEffect(node);
                        }
                        
                        // Check for buttons within the node
                        const buttons = node.querySelectorAll('button, .btn-primary, .btn-secondary, .product-card, .category-btn');
                        buttons.forEach(button => addRippleEffect(button));
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initRippleEffects();
            observeDynamicElements();
        });
    } else {
        initRippleEffects();
        observeDynamicElements();
    }

    // Re-initialize when products are loaded or categories change
    window.addEventListener('productsLoaded', initRippleEffects);
    window.addEventListener('categoriesLoaded', initRippleEffects);
    
    // Export for manual initialization if needed
    window.initRippleEffects = initRippleEffects;
    window.addRippleEffect = addRippleEffect;

})();
