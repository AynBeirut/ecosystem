/**
 * Virtual Keyboard Module
 * On-screen keyboard for Electron touchscreen devices
 * With layout persistence and improved navigation
 */

let currentInput = null;
let keyboardVisible = false;
let shiftActive = false;
let lastLayoutByType = {}; // Store last layout for each input type
let virtualKeyboardInitialized = false;
let virtualKeyboardOutsideClickBound = false;

function isVirtualKeyboardEnabled() {
    return localStorage.getItem('enable_virtual_keyboard') === 'true';
}

const keyboardLayout = {
    normal: [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Backspace'],
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '@'],
        ['Space', 'Enter', 'Close']
    ],
    shift: [
        ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', 'Backspace'],
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '-', '_'],
        ['Space', 'Enter', 'Close']
    ],
    numeric: [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['.', '0', 'Backspace'],
        ['Enter', 'Close']
    ],
    email: [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Backspace'],
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.'],
        ['Space', 'Enter', 'Close']
    ],
    phone: [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['+', '0', '-'],
        ['Backspace', 'Clear'],
        ['Enter', 'Close']
    ]
};

/**
 * Initialize virtual keyboard
 */
function initVirtualKeyboard() {
    if (virtualKeyboardInitialized) {
        return;
    }

    // Check if virtual keyboard should be enabled
    // Only enable on touchscreen devices or when explicitly requested
    const enableVirtualKeyboard = isVirtualKeyboardEnabled();
    
    if (!enableVirtualKeyboard) {
        console.log('ℹ️ Virtual keyboard disabled (use Settings to enable for touchscreen)');
        return; // Don't initialize if disabled
    }
    
    // Load layout persistence from localStorage
    try {
        const saved = localStorage.getItem('vk_layout_persistence');
        if (saved) {
            lastLayoutByType = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Could not load keyboard layout persistence:', e);
    }
    
    createKeyboardHTML();
    attachKeyboardEvents();
    virtualKeyboardInitialized = true;
    console.log('✅ Virtual keyboard initialized (Electron mode)');
}

/**
 * Save layout preference
 */
function saveLayoutPreference(inputType, layout) {
    lastLayoutByType[inputType] = layout;
    try {
        localStorage.setItem('vk_layout_persistence', JSON.stringify(lastLayoutByType));
    } catch (e) {
        console.warn('Could not save keyboard layout preference:', e);
    }
}

/**
 * Get preferred layout for input type
 */
function getPreferredLayout(inputType) {
    // Check saved preference first
    if (lastLayoutByType[inputType]) {
        return lastLayoutByType[inputType];
    }
    
    // Default mappings
    if (inputType === 'number') return 'numeric';
    if (inputType === 'tel') return 'phone';
    if (inputType === 'email') return 'email';
    
    return 'normal';
}

/**
 * Create keyboard HTML structure
 */
function createKeyboardHTML() {
    if (document.getElementById('virtual-keyboard')) {
        return;
    }

    const keyboardContainer = document.createElement('div');
    keyboardContainer.id = 'virtual-keyboard';
    keyboardContainer.className = 'virtual-keyboard';
    keyboardContainer.innerHTML = `
        <div class="keyboard-header" onclick="toggleKeyboardMinimize()">
            <span class="keyboard-title">Virtual Keyboard - Tap to Minimize/Maximize</span>
            <button class="keyboard-minimize" onclick="event.stopPropagation(); toggleKeyboardMinimize()">▼</button>
        </div>
        <div class="keyboard-body" id="keyboard-body">
            <!-- Keys will be generated here -->
        </div>
    `;
    document.body.appendChild(keyboardContainer);
}

/**
 * Toggle keyboard minimize state
 */
function toggleKeyboardMinimize() {
    const keyboard = document.getElementById('virtual-keyboard');
    const minimizeBtn = keyboard.querySelector('.keyboard-minimize');
    
    if (keyboard.classList.contains('minimized')) {
        keyboard.classList.remove('minimized');
        keyboard.classList.add('show');
        minimizeBtn.textContent = '▼';
    } else {
        keyboard.classList.add('minimized');
        keyboard.classList.remove('show');
        minimizeBtn.textContent = '▲';
    }
}

/**
 * Attach keyboard events to inputs
 */
function attachKeyboardEvents() {
    // Listen for focus on text inputs
    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            const inputType = e.target.type;
            
            // Skip for certain input types
            if (inputType === 'checkbox' || inputType === 'radio' || inputType === 'file' || inputType === 'hidden') {
                return;
            }
            
            // Skip if disabled or readonly
            if (e.target.disabled || e.target.readOnly) {
                return;
            }
            
            currentInput = e.target;
            
            // Get preferred layout for this input type
            const layout = getPreferredLayout(inputType);
            showVirtualKeyboard(layout, inputType);
        }
    });
    
    // Hide keyboard when clicking outside (optional - commented out for better UX)
    // User can manually close with Close button or Enter key
    /*
    document.addEventListener('click', (e) => {
        if (keyboardVisible && 
            !e.target.closest('.virtual-keyboard') && 
            !e.target.matches('input, textarea')) {
            hideVirtualKeyboard();
        }
    });
    */
}

/**
 * Show virtual keyboard with specific layout
 */
function showVirtualKeyboard(layout = 'normal', inputType = 'text') {
    const keyboard = document.getElementById('virtual-keyboard');
    const keyboardBody = document.getElementById('keyboard-body');
    
    if (!keyboard || !keyboardBody) return;
    
    // Position keyboard below the focused input (dropdown style)
    if (currentInput) {
        const rect = currentInput.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const viewportHeight = window.innerHeight;
        
        // Check if there's enough space below the input
        const spaceBelow = viewportHeight - rect.bottom;
        const keyboardHeight = 300; // Approximate keyboard height
        
        if (spaceBelow < keyboardHeight && rect.top > keyboardHeight) {
            // Not enough space below, position above
            keyboard.style.top = Math.max(10, rect.top + scrollTop - keyboardHeight - 5) + 'px';
        } else {
            // Position below input
            keyboard.style.top = (rect.bottom + scrollTop + 5) + 'px';
        }
        
        // Position horizontally aligned with input
        keyboard.style.left = Math.max(10, rect.left + scrollLeft) + 'px';
    }
    
    // Save layout preference
    saveLayoutPreference(inputType, layout);
    
    // Generate keyboard keys
    keyboardBody.innerHTML = '';
    const keys = keyboardLayout[layout] || keyboardLayout.normal;
    
    keys.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        
        row.forEach(key => {
            const keyButton = document.createElement('button');
            keyButton.className = 'keyboard-key';
            keyButton.textContent = key;
            
            // Special key classes
            if (key === 'Backspace') {
                keyButton.className += ' key-backspace';
                keyButton.innerHTML = '⌫';
            } else if (key === 'Space') {
                keyButton.className += ' key-space';
            } else if (key === 'Shift') {
                keyButton.className += ' key-shift';
                if (shiftActive) keyButton.classList.add('active');
            } else if (key === 'Enter') {
                keyButton.className += ' key-enter';
                keyButton.innerHTML = '↵';
            } else if (key === 'Close') {
                keyButton.className += ' key-close';
            }
            
            // Attach click handler
            keyButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleKeyPress(key, layout, inputType);
            });
            
            // Prevent button from taking focus
            keyButton.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
            
            rowDiv.appendChild(keyButton);
        });
        
        keyboardBody.appendChild(rowDiv);
    });
    
    keyboard.classList.add('show');
    keyboardVisible = true;
}

/**
 * Hide virtual keyboard
 */
function hideVirtualKeyboard() {
    const keyboard = document.getElementById('virtual-keyboard');
    if (keyboard) {
        keyboard.classList.remove('show');
        keyboardVisible = false;
        currentInput = null;
        shiftActive = false;
    }
}

/**
 * Get next focusable field
 */
function getNextFocusableField(currentElement) {
    // Get all focusable elements
    const focusableElements = Array.from(
        document.querySelectorAll(
            'input[type="text"]:not([disabled]):not([readonly]), ' +
            'input[type="number"]:not([disabled]):not([readonly]), ' +
            'input[type="tel"]:not([disabled]):not([readonly]), ' +
            'input[type="email"]:not([disabled]):not([readonly]), ' +
            'input:not([type]):not([disabled]):not([readonly]), ' +
            'textarea:not([disabled]):not([readonly]), ' +
            'select:not([disabled]), ' +
            'button:not([disabled]):not(.keyboard-key)'
        )
    );
    
    const currentIndex = focusableElements.indexOf(currentElement);
    
    // Return next element, or null if at the end
    if (currentIndex >= 0 && currentIndex < focusableElements.length - 1) {
        return focusableElements[currentIndex + 1];
    }
    
    return null;
}

/**
 * Handle key press on virtual keyboard
 */
function handleKeyPress(key, layout, inputType) {
    if (!currentInput) return;
    
    // Store current focus
    const inputToFocus = currentInput;
    
    switch (key) {
        case 'Backspace':
            const start = currentInput.selectionStart;
            const end = currentInput.selectionEnd;
            
            if (start !== end) {
                // Delete selection
                currentInput.value = currentInput.value.substring(0, start) + 
                                   currentInput.value.substring(end);
                currentInput.setSelectionRange(start, start);
            } else if (start > 0) {
                // Delete one character
                currentInput.value = currentInput.value.substring(0, start - 1) + 
                                   currentInput.value.substring(start);
                currentInput.setSelectionRange(start - 1, start - 1);
            }
            break;
            
        case 'Clear':
            currentInput.value = '';
            currentInput.setSelectionRange(0, 0);
            break;
            
        case 'Shift':
            shiftActive = !shiftActive;
            showVirtualKeyboard(shiftActive ? 'shift' : 'normal', inputType);
            // Restore focus after keyboard rebuild
            setTimeout(() => {
                if (inputToFocus) {
                    inputToFocus.focus();
                    currentInput = inputToFocus;
                }
            }, 10);
            return; // Don't trigger input event for shift
            
        case 'Enter':
            // Trigger input event first
            currentInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Find next focusable input field
            const form = currentInput.closest('form');
            if (form) {
                const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, select')).filter(input => !input.disabled && !input.readOnly);
                const currentIndex = inputs.indexOf(currentInput);
                
                if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                    // Move to next field
                    const nextInput = inputs[currentIndex + 1];
                    nextInput.focus();
                    
                    // If next input is a date/time field, don't show keyboard
                    if (nextInput.type === 'date' || nextInput.type === 'time') {
                        hideVirtualKeyboard();
                    }
                    return;
                }
            }
            
            // If last field or no form, hide keyboard and blur
            hideVirtualKeyboard();
            currentInput.blur();
            return;
            
        case 'Close':
            hideVirtualKeyboard();
            return;
            
        default:
            insertAtCursor(key);
            // Auto-disable shift after key press
            if (shiftActive && layout !== 'numeric' && layout !== 'phone') {
                shiftActive = false;
                showVirtualKeyboard('normal', inputType);
                // Restore focus after keyboard rebuild
                setTimeout(() => {
                    if (inputToFocus) {
                        inputToFocus.focus();
                        currentInput = inputToFocus;
                    }
                }, 10);
            }
            break;
    }
    
    // Ensure input keeps focus
    if (inputToFocus && inputToFocus !== document.activeElement) {
        inputToFocus.focus();
    }
    
    // Trigger input event for validation
    currentInput.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Insert text at cursor position
 */
function insertAtCursor(text) {
    if (!currentInput) return;
    
    // For number inputs, always append to the end to prevent reversal
    if (currentInput.type === 'number') {
        const value = currentInput.value || '';
        currentInput.value = value + text;
        // Move cursor to end
    } else {
        const start = currentInput.selectionStart;
        const end = currentInput.selectionEnd;
        
        currentInput.value = currentInput.value.substring(0, start) + 
                            text + 
                            currentInput.value.substring(end);
        
        const newPos = start + text.length;
        currentInput.setSelectionRange(newPos, newPos);
    }
}

/**
 * Toggle keyboard visibility
 */
function toggleVirtualKeyboard() {
    if (keyboardVisible) {
        hideVirtualKeyboard();
    } else {
        showVirtualKeyboard('normal');
    }
}

// ===================================
// FORCE KEYBOARD FOR SPECIFIC INPUTS
// ===================================

// Force keyboard for numeric/cost/quantity inputs and textareas
function initializeVirtualKeyboard() {
    if (!isVirtualKeyboardEnabled()) {
        console.log('ℹ️ Forced keyboard setup skipped because virtual keyboard is disabled');
        return;
    }

    initVirtualKeyboard();

    if (!virtualKeyboardOutsideClickBound) {
        document.addEventListener('click', (e) => {
            const keyboard = document.getElementById('virtual-keyboard');
            if (keyboardVisible && keyboard && 
                !keyboard.contains(e.target) && 
                e.target !== currentInput &&
                !e.target.closest('input') &&
                !e.target.closest('textarea')) {
                hideVirtualKeyboard();
            }
        });
        virtualKeyboardOutsideClickBound = true;
    }

    console.log('✅ Virtual keyboard runtime setup complete');
}

// Run initialization immediately if DOM already loaded, or wait for it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVirtualKeyboard);
} else {
    initializeVirtualKeyboard();
}

// Export to window for external use
if (typeof window !== 'undefined') {
    window.showVirtualKeyboard = showVirtualKeyboard;
    window.hideVirtualKeyboard = hideVirtualKeyboard;
}
