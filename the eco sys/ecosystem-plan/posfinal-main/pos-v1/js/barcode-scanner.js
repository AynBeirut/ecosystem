/**
 * Barcode Scanner Integration Module
 * Supports USB/Bluetooth barcode scanners and manual barcode entry
 */

let barcodeBuffer = '';
let barcodeTimeout = null;
const BARCODE_TIMEOUT = 100; // ms - time between scans

/**
 * Initialize barcode scanner functionality
 */
function initBarcodeScanner() {
    const barcodeInput = document.getElementById('barcode-input');
    
    if (!barcodeInput) return;
    
    // Manual barcode entry (user types and presses Enter)
    barcodeInput.addEventListener('keydown', handleBarcodeInput);
    
    // Focus barcode input on F2
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            barcodeInput.focus();
        }
    });
    
    // Listen for rapid keyboard input (hardware scanner)
    document.addEventListener('keypress', handleHardwareScanner);
    
    console.log('✅ Barcode scanner initialized');
}

/**
 * Handle manual barcode input
 */
function handleBarcodeInput(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const barcode = e.target.value.trim();
        
        if (barcode) {
            processBarcodeScanner(barcode);
            e.target.value = '';
        }
    }
}

/**
 * Handle hardware barcode scanner input
 * Hardware scanners type very fast and end with Enter
 */
function handleHardwareScanner(e) {
    const barcodeInput = document.getElementById('barcode-input');
    
    // Ignore if user is typing in search or other inputs
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === 'INPUT' && activeElement.id !== 'barcode-input') {
        return;
    }
    
    // Ignore if in a modal input field
    if (activeElement && activeElement.closest('.modal')) {
        return;
    }
    
    // Clear timeout if still buffering
    if (barcodeTimeout) {
        clearTimeout(barcodeTimeout);
    }
    
    // Add character to buffer
    if (e.key === 'Enter') {
        // Barcode complete
        if (barcodeBuffer.length > 0) {
            processBarcodeScanner(barcodeBuffer);
            barcodeBuffer = '';
        }
    } else if (e.key.length === 1) {
        // Regular character
        barcodeBuffer += e.key;
        
        // Visual feedback
        if (barcodeInput) {
            barcodeInput.classList.add('scanning');
            barcodeInput.placeholder = `Scanning: ${barcodeBuffer}`;
        }
        
        // Auto-reset buffer after timeout
        barcodeTimeout = setTimeout(() => {
            barcodeBuffer = '';
            if (barcodeInput) {
                barcodeInput.classList.remove('scanning');
                barcodeInput.placeholder = 'Scan barcode (F2)';
            }
        }, BARCODE_TIMEOUT);
    }
}

/**
 * Process scanned barcode and add product to cart
 */
function processBarcodeScanner(barcode) {
    const barcodeInput = document.getElementById('barcode-input');
    
    // Visual feedback
    if (barcodeInput) {
        barcodeInput.classList.add('scanning');
    }
    
    // Find product by barcode
    const product = PRODUCTS.find(p => p.barcode === barcode);
    
    if (product) {
        // Add to cart
        addToCart(product);
        
        // Success feedback
        showBarcodeNotification(`✅ Added: ${product.name}`, 'success');
        playBeep('success');
    } else {
        // Product not found
        showBarcodeNotification(`❌ Product not found: ${barcode}`, 'error');
        playBeep('error');
    }
    
    // Reset visual feedback
    setTimeout(() => {
        if (barcodeInput) {
            barcodeInput.classList.remove('scanning');
            barcodeInput.placeholder = 'Scan barcode (F2)';
            barcodeInput.value = '';
        }
    }, 300);
}

/**
 * Show barcode scan notification
 */
function showBarcodeNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.querySelector('.barcode-notification');
    if (existing) {
        existing.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `barcode-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

/**
 * Play beep sound for feedback (optional)
 */
function playBeep(type = 'success') {
    // Create audio context for beep
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Set frequency based on type
        oscillator.frequency.value = type === 'success' ? 800 : 400;
        oscillator.type = 'sine';
        
        // Set volume
        gainNode.gain.value = 0.1;
        
        // Play beep
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        // Beep not supported, silently fail
        console.log('Audio beep not supported');
    }
}

/**
 * Generate barcode for product (simple implementation)
 * Can be called when adding products without barcodes
 */
function generateBarcode() {
    // Generate random 13-digit EAN-13 style barcode
    let barcode = '';
    for (let i = 0; i < 13; i++) {
        barcode += Math.floor(Math.random() * 10);
    }
    return barcode;
}

/**
 * Check if barcode already exists in products
 */
function barcodeExists(barcode) {
    return PRODUCTS.some(p => p.barcode === barcode);
}
