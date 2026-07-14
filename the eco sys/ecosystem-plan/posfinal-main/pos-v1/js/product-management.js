// ===================================
// AYN BEIRUT POS - PRODUCT MANAGEMENT
// Add, edit, delete products through UI
// ===================================

let isEditMode = false;
let editingProductId = null;

// ===================================
// INITIALIZE PRODUCT MANAGEMENT
// ===================================

function initProductManagement() {
    // Guard against duplicate initialization
    if (window._productMgmtInitialized) {
        console.warn('⚠️ Product Management already initialized, skipping...');
        return;
    }
    window._productMgmtInitialized = true;
    console.log('🔧 Initializing Product Management (first time)...');
    
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const cancelEditBtn = document.getElementById('cancel-edit');
    
    // Setup modal close handlers
    setupProductModal();
    
    // Initialize database management panel
    initDatabaseManagement();
    
    // Handle form submission
    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('📝 === FORM SUBMIT EVENT ===');
        console.log('📝 Edit mode:', isEditMode);
        console.log('📝 Modal visible:', document.getElementById('product-modal').classList.contains('show'));
        console.log('📝 Submit triggered by:', e.submitter ? e.submitter.textContent : 'Enter key or unknown');
        
        if (isEditMode) {
            console.log('📝 Calling updateProduct()...');
            updateProduct();
        } else {
            console.log('📝 Calling addNewProduct()...');
            addNewProduct();
        }
    });
    
    // Cancel edit
    cancelEditBtn.addEventListener('click', () => {
        cancelEdit();
    });
    
    // Import button
    const importBtn = document.getElementById('import-products');
    if (importBtn) {
        importBtn.addEventListener('click', importProducts);
    }
    
    // Export buttons (CSV, Excel, PDF)
    const exportCsvBtn = document.getElementById('export-products-csv');
    const exportExcelBtn = document.getElementById('export-products-excel');
    const exportPdfBtn = document.getElementById('export-products-pdf');
    const priceInput = document.getElementById('product-price-input');
    
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => exportProducts('csv'));
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', () => exportProducts('excel'));
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => exportProducts('pdf'));
    if (priceInput) priceInput.addEventListener('input', syncDerivedServiceRates);
    
    console.log('✅ Product Management initialized');
}

// ===================================
// MODAL MANAGEMENT
// ===================================

function openProductManagement() {
    const modal = document.getElementById('product-modal');
    modal.classList.add('show');
    hideAddProductForm(); // Start with form hidden
    refreshProductList();
    updateDatabaseInfo(); // Update database management info
}

function openProductManagementWithForm() {
    console.log('🚀 Opening Product Management with form');
    const modal = document.getElementById('product-modal');
    if (!modal) {
        console.error('❌ Product modal not found');
        return;
    }
    modal.classList.add('show');
    refreshProductList();
    updateDatabaseInfo();
    showAddProductForm(); // Show form immediately
}

function showAddProductForm() {
    const formSection = document.getElementById('product-form-section');
    if (formSection) {
        formSection.style.display = 'block';
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const nameInput = document.getElementById('product-name-input');
    if (nameInput) {
        setTimeout(() => nameInput.focus(), 300);
    }
}

function hideAddProductForm() {
    const formSection = document.getElementById('product-form-section');
    formSection.style.display = 'none';
    cancelEdit();
}

// Toggle between Item, Service, and Raw Material fields
function toggleProductTypeFields() {
    const type = document.getElementById('product-type-input').value;
    const itemFields = document.getElementById('item-fields');
    const serviceFields = document.getElementById('service-fields');
    const rawMaterialFields = document.getElementById('raw-material-fields');
    
    if (type === 'item') {
        itemFields.style.display = 'block';
        serviceFields.style.display = 'none';
        if (rawMaterialFields) rawMaterialFields.style.display = 'none';
        
        // Reset service fields
        document.getElementById('service-hourly-enabled').checked = false;
        toggleHourlyRates();
    } else if (type === 'service') {
        itemFields.style.display = 'none';
        serviceFields.style.display = 'block';
        if (rawMaterialFields) rawMaterialFields.style.display = 'none';
        syncDerivedServiceRates();
        
        // Reset item fields
        document.getElementById('product-cost-input').value = '';
    } else if (type === 'raw_material') {
        itemFields.style.display = 'none';
        serviceFields.style.display = 'none';
        if (rawMaterialFields) rawMaterialFields.style.display = 'block';
    }
}

// Show unit conversion preview
function showUnitConversion() {
    const unit = document.getElementById('product-unit-input')?.value;
    const quantity = parseFloat(document.getElementById('product-stock-input-raw')?.value) || 0;
    const previewDiv = document.getElementById('unit-conversion-preview');
    const conversionText = document.getElementById('conversion-text');
    
    if (!unit || quantity === 0 || !previewDiv || !conversionText) {
        if (previewDiv) previewDiv.style.display = 'none';
        return;
    }
    
    // Define conversion ratios (from export-utils.js)
    const UNIT_CONVERSIONS = {
        'kg': { base: 'kg', ratio: 1, alt: 'g', altRatio: 1000 },
        'g': { base: 'kg', ratio: 0.001, alt: 'g', altRatio: 1 },
        'litre': { base: 'litre', ratio: 1, alt: 'ml', altRatio: 1000 },
        'ml': { base: 'litre', ratio: 0.001, alt: 'ml', altRatio: 1 },
        'meter': { base: 'meter', ratio: 1, alt: 'cm', altRatio: 100 },
        'cm': { base: 'meter', ratio: 0.01, alt: 'cm', altRatio: 1 },
        'pieces': { base: 'pieces', ratio: 1, alt: 'pieces', altRatio: 1 }
    };
    
    const conversion = UNIT_CONVERSIONS[unit];
    if (!conversion) {
        previewDiv.style.display = 'none';
        return;
    }
    
    // Calculate alternate unit
    let text = `<strong>${quantity.toFixed(2)} ${unit}</strong>`;
    
    if (conversion.alt !== unit) {
        const altQuantity = quantity * conversion.altRatio;
        text += ` = <strong>${altQuantity.toFixed(2)} ${conversion.alt}</strong>`;
    }
    
    conversionText.innerHTML = text;
    previewDiv.style.display = 'block';
}

function syncDerivedServiceRates() {
    const priceInput = document.getElementById('product-price-input');
    const firstHourInput = document.getElementById('service-first-hour-input');
    const firstHourDisplay = document.getElementById('service-first-hour-display');
    const price = parseFloat(priceInput?.value);
    
    if (!firstHourInput || !firstHourDisplay) {
        return;
    }
    
    if (Number.isFinite(price) && price > 0) {
        const formattedPrice = price.toFixed(2);
        firstHourInput.value = formattedPrice;
        firstHourDisplay.textContent = `$${formattedPrice} from Sell Price`;
    } else {
        firstHourInput.value = '';
        firstHourDisplay.textContent = 'Uses Sell Price automatically';
    }
}

function getDerivedServiceFirstPeriodRate() {
    const price = parseFloat(document.getElementById('product-price-input')?.value);
    return Number.isFinite(price) && price > 0 ? price : 0;
}

// Toggle hourly rate fields for services
function toggleHourlyRates() {
    const enabled = document.getElementById('service-hourly-enabled').checked;
    const hourlyFields = document.getElementById('hourly-rate-fields');
    const firstHourInput = document.getElementById('service-first-hour-input');
    const firstHourDisplay = document.getElementById('service-first-hour-display');
    
    if (enabled) {
        hourlyFields.style.display = 'block';
        syncDerivedServiceRates();
    } else {
        hourlyFields.style.display = 'none';
        // Reset hourly rate fields
        if (firstHourInput) firstHourInput.value = '';
        if (firstHourDisplay) firstHourDisplay.textContent = 'Uses Sell Price automatically';
        document.getElementById('service-additional-hour-input').value = '';
    }
}

function setupProductModal() {
    const modal = document.getElementById('product-modal');
    const closeBtn = modal.querySelector('.modal-close');
    
    closeBtn.onclick = () => {
        modal.classList.remove('show');
        cancelEdit();
    };
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            cancelEdit();
        }
    };
}

// ===================================
// PRODUCT DATABASE OPERATIONS
// ===================================

async function loadProductsFromDB() {
    // Wait for database to be ready if not already
    if (!db && window.dbReady) {
        console.log('⏳ Waiting for database to initialize...');
        await window.dbReady;
    }
    
    if (!db) {
        console.warn('⚠️ Database not ready, using default products');
        return [...PRODUCTS]; // Return a copy
    }

    try {
        console.log('🔍 Running query: SELECT * FROM products');
        const products = await runQuery('SELECT * FROM products');
        console.log('📊 Products retrieved:', products.length);

        if (products.length > 0) {
            console.log('🔍 First product keys:', Object.keys(products[0]));
            console.log('🔍 Sample product:', products[0]);

            return products.map(product => {
                if (product.category === 'software' && product.type !== 'service') {
                    console.log(`🔧 Runtime fix: ${product.name} type='${product.type}' → type='service'`);
                    return {
                        ...product,
                        type: 'service',
                        hourlyEnabled: product.hourlyEnabled || 0,
                        firstHourRate: product.firstHourRate || 0,
                        additionalHourRate: product.additionalHourRate || 0
                    };
                }
                return product;
            });
        }

        if (products.length === 0) {
            console.log('📦 No products in DB, saving default products...');
            // First time - save default products to DB
            await saveDefaultProducts();
            // Load from DB to get consistent format
            const loadedProducts = await runQuery('SELECT * FROM products');
            console.log('✅ Default products initialized:', loadedProducts.length);
            return loadedProducts;
        }
    } catch (error) {
        console.error('❌ Failed to load products from DB:', error);
        throw error;
    }
}

async function saveDefaultProducts() {
    if (!db) return;
    
    for (const product of PRODUCTS) {
        await runExec(
            `INSERT OR REPLACE INTO products (id, name, category, price, icon, barcode, stock, description, createdAt, updatedAt, synced) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [product.id, product.name, product.category, product.price, product.icon, product.barcode || null, product.stock || 0, product.description || '', product.createdAt || Date.now(), Date.now()]
        );
    }
    
    console.log('✅ Default products saved to database');
}

async function saveProductToDB(product) {
    if (!db) {
        console.error('Database not initialized');
        return false;
    }
    
    try {
        console.log('💾 Saving product to DB:', product);
        
        // Check and add missing columns
        const columnsToAdd = [
            { name: 'cost', type: 'REAL DEFAULT 0' },
            { name: 'type', type: 'TEXT DEFAULT "item"' },
            { name: 'unit', type: 'TEXT' },
            { name: 'hourlyEnabled', type: 'INTEGER DEFAULT 0' },
            { name: 'firstHourRate', type: 'REAL DEFAULT 0' },
            { name: 'additionalHourRate', type: 'REAL DEFAULT 0' },
            { name: 'serviceDuration', type: 'INTEGER DEFAULT 60' }
        ];
        
        for (const column of columnsToAdd) {
            try {
                await runQuery(`SELECT ${column.name} FROM products LIMIT 1`);
            } catch (e) {
                console.log(`⚠️ ${column.name} column does not exist, adding it...`);
                try {
                    await runExec(`ALTER TABLE products ADD COLUMN ${column.name} ${column.type}`);
                    console.log(`✅ Added ${column.name} column to products table`);
                } catch (alterError) {
                    console.error(`❌ Failed to add ${column.name} column:`, alterError);
                }
            }
        }
        
        // Save product with all columns
        await runExec(
            `INSERT OR REPLACE INTO products (id, name, category, type, price, cost, icon, barcode, stock, unit, hourlyEnabled, firstHourRate, additionalHourRate, serviceDuration, description, createdAt, updatedAt, synced) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                product.id, 
                product.name, 
                product.category, 
                product.type || 'item',
                product.price, 
                product.cost || 0, 
                product.icon, 
                product.barcode || null, 
                product.stock || 0,
                product.unit || null,
                product.hourlyEnabled ? 1 : 0,
                product.firstHourRate || 0,
                product.additionalHourRate || 0,
                product.serviceDuration || 60,
                product.description || '', 
                product.createdAt || Date.now(), 
                Date.now()
            ]
        );
        
        console.log('✅ Product saved to DB:', product.name);
        
        // Save database to IndexedDB
        await saveDatabase();
        console.log('✅ Database persisted to IndexedDB');
        
        return true;
    } catch (error) {
        console.error('❌ Failed to save product:', error);
        alert('Failed to save product: ' + error.message);
        return false;
    }
}

async function deleteProductFromDB(productId) {
    if (!db) return false;
    
    try {
        await runExec('DELETE FROM products WHERE id = ?', [productId]);
        console.log('✅ Product deleted:', productId);
        return true;
    } catch (error) {
        console.error('Failed to delete product:', error);
        return false;
    }
}

// ===================================
// PRODUCT CRUD OPERATIONS
// ===================================

async function addNewProduct() {
    console.log('\n📝 === ADD NEW PRODUCT STARTED ===');
    
    const name = document.getElementById('product-name-input').value.trim();
    const category = document.getElementById('product-category-input').value;
    const type = document.getElementById('product-type-input').value; // 'item' or 'service'
    const price = parseFloat(document.getElementById('product-price-input').value);
    const icon = document.getElementById('product-icon-input').value || (type === 'service' ? '🛠️' : '📦');
    const barcode = document.getElementById('product-barcode-input').value.trim();
    
    console.log('📋 Basic Form Values:');
    console.log('  • Name:', name ? `"${name}"` : '(empty)');
    console.log('  • Type:', type);
    console.log('  • Category:', category);
    console.log('  • Price:', price);
    console.log('  • Icon:', icon);
    console.log('  • Barcode:', barcode || '(none)');
    
    // Type-specific fields
    let cost = 0;
    let stock = 0;
    let unit = null;
    let hourlyEnabled = false;
    let firstHourRate = 0;
    let additionalHourRate = 0;
    let serviceDuration = 60;
    
    if (type === 'item') {
        const costInput = document.getElementById('product-cost-input');
        const itemFieldsDiv = document.getElementById('item-fields');
        
        console.log('📦 Item-specific fields:');
        console.log('  • item-fields div display:', itemFieldsDiv ? window.getComputedStyle(itemFieldsDiv).display : 'not found');
        console.log('  • Cost input element:', costInput ? 'found' : 'NOT FOUND');
        console.log('  • Cost input value (raw):', costInput?.value);
        
        cost = parseFloat(costInput?.value) || 0;
        stock = 0; // Stock starts at 0, managed through deliveries
        
        console.log('  • Parsed Cost:', cost);
        console.log('  • Initial Stock: 0');
    } else if (type === 'raw_material') {
        const costInput = document.getElementById('product-cost-input-raw');
        const unitInput = document.getElementById('product-unit-input');
        
        console.log('🧱 Raw Material-specific fields:');
        console.log('  • Cost input value (raw):', costInput?.value);
        console.log('  • Unit:', unitInput?.value);
        
        cost = parseFloat(costInput?.value) || 0;
        stock = 0; // Stock starts at 0, managed through purchases/deliveries
        unit = unitInput?.value || 'pieces';
        
        console.log('  • Parsed Cost:', cost);
        console.log('  • Initial Stock: 0 (managed through purchases)');
        console.log('  • Unit:', unit);
    } else if (type === 'service') {
        serviceDuration = parseInt(document.getElementById('service-duration-input')?.value) || 60;
        hourlyEnabled = document.getElementById('service-hourly-enabled').checked;
        if (hourlyEnabled) {
            firstHourRate = getDerivedServiceFirstPeriodRate();
            additionalHourRate = parseFloat(document.getElementById('service-additional-hour-input')?.value) || 0;
            syncDerivedServiceRates();
        }
        console.log('🛠️ Service-specific fields:');
        console.log('  • Service duration:', serviceDuration, 'minutes');
        console.log('  • Hourly enabled:', hourlyEnabled);
        if (hourlyEnabled) {
            console.log('  • First hour rate:', firstHourRate);
            console.log('  • Additional hour rate:', additionalHourRate);
        }
    }
    
    console.log('\n✅ Validating required fields...');
    
    // Validate required fields with specific messages
    if (!name) {
        console.error('❌ Validation failed: Product name is empty');
        alert('❌ Product name is required');
        document.getElementById('product-name-input').focus();
        return;
    }
    if (!price || price <= 0) {
        console.error('❌ Validation failed: Price is invalid:', price);
        alert('❌ Please enter a valid price (must be greater than 0)');
        document.getElementById('product-price-input').focus();
        return;
    }
    
    console.log('✅ Validation passed');
    
    // Check if barcode already exists
    if (barcode && barcodeExists && barcodeExists(barcode)) {
        console.warn('⚠️ Barcode already exists:', barcode);
        alert('This barcode already exists. Please use a different barcode.');
        return;
    }
    
    // Generate new ID
    const products = await loadProductsFromDB();
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    console.log('🆔 Generated new ID:', newId);
    
    const newProduct = {
        id: newId,
        name: name,
        category: category,
        type: type,
        price: price,
        cost: cost,
        icon: icon,
        barcode: barcode || null,
        stock: stock,
        unit: unit, // Add unit for raw materials
        hourlyEnabled: hourlyEnabled,
        firstHourRate: firstHourRate,
        additionalHourRate: additionalHourRate,
        serviceDuration: serviceDuration
    };
    
    console.log('\n💾 Product object to save:');
    console.log(JSON.stringify(newProduct, null, 2));
    
    try {
        console.log('💾 Calling saveProductToDB...');
        await saveProductToDB(newProduct);
        
        // Update global products array
        await reloadProducts();
        
        // Force refresh main menu
        if (typeof searchProducts === 'function') {
            console.log('🔄 Refreshing main product menu...');
            searchProducts('');
        }
        
        // Log activity
        if (typeof logActivity === 'function') {
            const typeLabel = type === 'service' ? 'Service' : 'Item';
            const details = type === 'item' 
                ? `${stock} in stock, cost $${cost.toFixed(2)}`
                : hourlyEnabled 
                    ? `Hourly: $${firstHourRate.toFixed(2)}/hr first, $${additionalHourRate.toFixed(2)}/hr additional`
                    : 'One-time service';
            await logActivity('product_add', `Added ${typeLabel}: ${name} ($${price.toFixed(2)}) - ${details}`);
        }
        
        // Reset form
        document.getElementById('product-form').reset();
        
        // Reset to default state (Item type with item fields visible)
        document.getElementById('product-type-input').value = 'item';
        toggleProductTypeFields();
        
        // Refresh list
        refreshProductList();
        
        // Show success notification
        showNotification('✅ Product added successfully!');
        console.log('✅ === ADD NEW PRODUCT COMPLETED ===\n');
        
    } catch (error) {
        console.error('❌ Failed to add product:', error);
        console.error('❌ Error stack:', error.stack);
        alert('Failed to add product. Please try again.');
    }
}

async function editProduct(productId) {
    const products = await loadProductsFromDB();
    const product = products.find(p => p.id === productId);
    
    if (!product) return;
    
    // If product has a recipe, open recipe builder instead
    if (product.has_recipe === 1) {
        console.log('Product has recipe, opening recipe builder');
        openRecipeBuilder(productId);
        return;
    }
    
    // Show the form
    showAddProductForm();
    
    // Fill form with product data
    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('product-name-input').value = product.name;
    document.getElementById('product-category-input').value = product.category;
    document.getElementById('product-type-input').value = product.type || 'item';
    document.getElementById('product-price-input').value = product.price;
    document.getElementById('product-icon-input').value = product.icon;
    document.getElementById('product-barcode-input').value = product.barcode || '';
    
    // Load type-specific fields
    if (product.type === 'service') {
        document.getElementById('service-duration-input').value = product.serviceDuration || 60;
        document.getElementById('service-hourly-enabled').checked = product.hourlyEnabled || false;
        if (product.hourlyEnabled) {
            document.getElementById('service-additional-hour-input').value = product.additionalHourRate || 0;
        }
        toggleHourlyRates();
    } else {
        const costInput = document.getElementById('product-cost-input');
        
        if (costInput) costInput.value = product.cost || 0;
    }
    
    // Toggle field visibility based on type
    toggleProductTypeFields();
    
    // Switch to edit mode
    isEditMode = true;
    editingProductId = productId;
    
    document.getElementById('form-title').textContent = 'Edit Product';
    document.getElementById('submit-text').textContent = 'Update Product';
    document.getElementById('cancel-edit').classList.add('visible');
    
    // Scroll to form
    document.querySelector('.product-form-section').scrollIntoView({ behavior: 'smooth' });
}

async function updateProduct() {
    const id = parseInt(document.getElementById('edit-product-id').value);
    const name = document.getElementById('product-name-input').value.trim();
    const category = document.getElementById('product-category-input').value;
    const type = document.getElementById('product-type-input').value;
    const price = parseFloat(document.getElementById('product-price-input').value);
    const icon = document.getElementById('product-icon-input').value || (type === 'service' ? '🛠️' : '📦');
    const barcode = document.getElementById('product-barcode-input').value.trim();
    
    // Type-specific fields
    let cost = 0;
    let unit = 'pieces';
    let hourlyEnabled = false;
    let firstHourRate = 0;
    let additionalHourRate = 0;
    let serviceDuration = 60;
    
    // Get current product to preserve stock
    const allProducts = await loadProductsFromDB();
    const currentProduct = allProducts.find(p => p.id === id);
    const currentStock = currentProduct ? (currentProduct.stock || 0) : 0;
    
    if (type === 'item') {
        cost = parseFloat(document.getElementById('product-cost-input')?.value) || 0;
        // Preserve existing stock - don't reset to 0
    } else if (type === 'raw_material') {
        cost = parseFloat(document.getElementById('product-cost-input-raw')?.value) || 0;
        unit = document.getElementById('product-unit-input')?.value || 'pieces';
        // Preserve existing stock - don't reset to 0
    } else if (type === 'service') {
        serviceDuration = parseInt(document.getElementById('service-duration-input')?.value) || 60;
        hourlyEnabled = document.getElementById('service-hourly-enabled').checked;
        if (hourlyEnabled) {
            firstHourRate = getDerivedServiceFirstPeriodRate();
            additionalHourRate = parseFloat(document.getElementById('service-additional-hour-input')?.value) || 0;
            syncDerivedServiceRates();
        }
    }
    
    // Validate required fields with specific messages
    if (!name) {
        alert('❌ Product name is required');
        document.getElementById('product-name-input').focus();
        return;
    }
    if (!price || price <= 0) {
        alert('❌ Please enter a valid price (must be greater than 0)');
        document.getElementById('product-price-input').focus();
        return;
    }
    
    // Check if barcode already exists on another product
    if (barcode && barcodeExists) {
        const products = await loadProductsFromDB();
        const existingProduct = products.find(p => p.barcode === barcode && p.id !== id);
        if (existingProduct) {
            alert('This barcode already exists on another product. Please use a different barcode.');
            return;
        }
    }
    
    const updatedProduct = {
        id: id,
        name: name,
        category: category,
        type: type,
        price: price,
        cost: cost,
        icon: icon,
        barcode: barcode || null,
        stock: currentStock, // Preserve existing stock
        unit: unit, // Save the unit
        hourlyEnabled: hourlyEnabled,
        firstHourRate: firstHourRate,
        additionalHourRate: additionalHourRate,
        serviceDuration: serviceDuration
    };
    
    console.log('📝 Updating product:', updatedProduct);
    
    try {
        await saveProductToDB(updatedProduct);
        
        // Update global products array
        await reloadProducts();
        
        // Refresh inventory display if it's open
        if (typeof loadInventoryData === 'function') {
            loadInventoryData();
        }
        
        // Log activity
        if (typeof logActivity === 'function') {
            const typeLabel = type === 'service' ? 'Service' : 'Item';
            const details = type === 'item' 
                ? `${stock} in stock`
                : hourlyEnabled 
                    ? `Hourly billing enabled`
                    : 'One-time service';
            await logActivity('product_edit', `Updated ${typeLabel}: ${name} ($${price.toFixed(2)}) - ${details}`);
        }
        
        // Reset form and edit mode
        cancelEdit();
        
        // Refresh list
        refreshProductList();
        
        // Show success notification
        showNotification('✅ Product updated successfully!');
        
    } catch (error) {
        console.error('Failed to update product:', error);
        alert('Failed to update product. Please try again.');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    // Get product name before deleting
    const products = await loadProductsFromDB();
    const product = products.find(p => p.id === productId);
    const productName = product ? product.name : 'Unknown';
    
    try {
        await deleteProductFromDB(productId);
        
        // Update global products array
        await reloadProducts();
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('product_delete', `Deleted product: ${productName}`);
        }
        
        // Refresh list
        refreshProductList();
        
        // Show success notification
        showNotification('✅ Product deleted successfully!');
        
    } catch (error) {
        console.error('Failed to delete product:', error);
        alert('Failed to delete product. Please try again.');
    }
}

function cancelEdit() {
    isEditMode = false;
    editingProductId = null;
    
    document.getElementById('product-form').reset();
    document.getElementById('form-title').textContent = 'Add New Product';
    document.getElementById('submit-text').textContent = 'Add Product';
    document.getElementById('cancel-edit').classList.remove('visible');
    
    // Reset to default state (Item type)
    document.getElementById('product-type-input').value = 'item';
    toggleProductTypeFields();
}

// ===================================
// PRODUCT LIST RENDERING
// ===================================

async function refreshProductList() {
    const products = await loadProductsFromDB();
    const productList = document.getElementById('product-list');
    const productCount = document.getElementById('product-count');
    
    productCount.textContent = products.length;
    
    if (products.length === 0) {
        productList.innerHTML = `
            <div class="product-list-empty">
                <div class="product-list-empty-icon">📦</div>
                <p>No products yet</p>
                <p style="font-size: 12px; margin-top: 4px;">Add your first product using the form</p>
            </div>
        `;
        return;
    }
    
    productList.innerHTML = '';
    
    products.forEach(product => {
        const item = document.createElement('div');
        item.className = 'product-list-item';
        
        const productType = product.type || 'item';
        const hasRecipe = product.has_recipe === 1;
        
        let typeBadge = '';
        if (productType === 'service') {
            typeBadge = '<span style="background: rgba(156, 39, 176, 0.2); color: #9C27B0; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 4px;">SERVICE</span>';
        } else if (productType === 'raw_material') {
            typeBadge = '<span style="background: rgba(255, 152, 0, 0.2); color: #FF9800; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 4px;">RAW MATERIAL</span>';
        } else {
            typeBadge = '<span style="background: rgba(76, 175, 80, 0.2); color: #4CAF50; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 4px;">ITEM</span>';
        }
        
        // Add recipe badge if product has a recipe
        const recipeBadge = hasRecipe 
            ? '<span style="background: rgba(255, 152, 0, 0.2); color: #FF9800; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 4px;" title="Composed Product with Recipe">🍽️ COMPOSED</span>'
            : '';
        
        // Calculate stock for composed products based on raw materials
        let displayStock = product.stock || 0;
        if (hasRecipe && productType === 'item') {
            displayStock = calculateComposedProductStock(product.id);
        }
        
        const stockInfo = productType === 'item' 
            ? ` • Stock: ${displayStock}`
            : product.hourlyEnabled 
                ? ' • Hourly'
                : '';
        
        // Add onclick for recipe products to view recipe
        const itemClickHandler = hasRecipe ? `style="cursor: pointer;" onclick="viewRecipeDetails(${product.id})"` : '';
        
        item.innerHTML = `
            <div class="product-list-icon">${product.icon}</div>
            <div class="product-list-info" ${itemClickHandler}>
                <div class="product-list-name">${product.name}${typeBadge}${recipeBadge}</div>
                <div class="product-list-meta">${capitalizeFirst(product.category)} • ID: ${product.id}${stockInfo}${hasRecipe ? ' • Click to view recipe' : ''}</div>
            </div>
            <div class="product-list-price">$${product.price.toFixed(2)}</div>
            <div class="product-list-actions-btn">
                ${hasRecipe ? `<button class="btn-icon" onclick="openRecipeBuilder(${product.id})" title="Edit Recipe">🍽️</button>` : ''}
                <button class="btn-icon" onclick="editProduct(${product.id})" title="Edit">✏️</button>
                <button class="btn-icon delete" onclick="deleteProduct(${product.id})" title="Delete">🗑️</button>
            </div>
        `;
        productList.appendChild(item);
    });
}

// ===================================
// RELOAD PRODUCTS IN MAIN VIEW
// ===================================

async function reloadProducts() {
    const products = await loadProductsFromDB();
    
    // Update global PRODUCTS array
    PRODUCTS.length = 0;
    PRODUCTS.push(...products);
    
    // Re-render product grid in admin
    const searchQuery = document.getElementById('product-search')?.value || '';
    searchProducts(searchQuery);
    
    // Refresh POS product display if renderProducts function exists
    if (typeof renderProducts === 'function') {
        console.log('🔄 Refreshing POS product display after reload...');
        renderProducts(PRODUCTS);
    }
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('productsReloaded', { detail: { products } }));
}

// ===================================
// IMPORT / EXPORT
// ===================================

async function exportProducts(format) {
    if (!format) {
        showNotification('Please select an export format', 'error');
        return;
    }
    
    const products = await loadProductsFromDB();
    
    // Prepare export data - ONLY PRODUCT NAMES (simplified for product management)
    const exportData = products.map(product => {
        return {
            'name': product.name,
            'icon': product.icon || ''
        };
    });
    
    const filename = `products-list-${new Date().toISOString().split('T')[0]}`;
    
    try {
        switch (format) {
            case 'csv':
                if (typeof exportToCSV === 'function') {
                    const csvColumns = [
                        {header: 'Icon', key: 'icon'},
                        {header: 'Product Name', key: 'name'}
                    ];
                    await exportToCSV(exportData, csvColumns, filename);
                    showNotification('✅ Products exported as CSV');
                } else {
                    throw new Error('Export utilities not loaded');
                }
                break;
                
            case 'excel':
                if (typeof exportToExcel === 'function') {
                    const excelColumns = [
                        {header: 'Icon', key: 'icon', width: 8},
                        {header: 'Product Name', key: 'name', width: 40}
                    ];
                    await exportToExcel(exportData, excelColumns, filename, 'Product List');
                    showNotification('✅ Products exported as Excel');
                } else {
                    throw new Error('Export utilities not loaded');
                }
                break;
                
            case 'pdf':
                if (typeof exportToPDF === 'function') {
                    const pdfColumns = [
                        {header: 'Icon', dataKey: 'icon'},
                        {header: 'Product Name', dataKey: 'name'}
                    ];
                    await exportToPDF(exportData, pdfColumns, 'Product List', filename);
                    showNotification('✅ Products exported as PDF');
                } else {
                    throw new Error('Export utilities not loaded');
                }
                break;
                
            default:
                throw new Error('Invalid format selected');
        }
    } catch (error) {
        console.error('❌ Export failed:', error);
        showNotification('❌ Export failed: ' + error.message, 'error');
    }
}

function importProducts() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const products = JSON.parse(event.target.result);
                
                if (!Array.isArray(products)) {
                    throw new Error('Invalid format');
                }
                
                if (!confirm(`Import ${products.length} products? This will add to existing products.`)) {
                    return;
                }
                
                // Save all products
                for (const product of products) {
                    // Ensure unique IDs
                    const existing = await loadProductsFromDB();
                    const maxId = existing.length > 0 ? Math.max(...existing.map(p => p.id)) : 0;
                    product.id = maxId + 1;
                    
                    await saveProductToDB(product);
                }
                
                await reloadProducts();
                refreshProductList();
                
                showNotification(`✅ Imported ${products.length} products!`);
                
            } catch (error) {
                console.error('Import failed:', error);
                alert('Failed to import products. Please check the file format.');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// ===================================
// NOTIFICATIONS
// ===================================

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: linear-gradient(135deg, #1C75BC, #00C2FF);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 194, 255, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===================================
// DATABASE MANAGEMENT
// ===================================

async function updateDatabaseInfo() {
    try {
        // Get schema version
        const schemaVersion = document.getElementById('db-schema-version');
        if (schemaVersion) {
            try {
                const versionResult = runQuery('SELECT MAX(version) as version FROM schema_version');
                schemaVersion.textContent = versionResult[0]?.version || '0';
            } catch (e) {
                schemaVersion.textContent = 'N/A';
            }
        }
        
        // Get backup count
        const backupCount = document.getElementById('db-backup-count');
        if (backupCount) {
            let count = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('AynBeirutPOS_backup_')) {
                    count++;
                }
            }
            backupCount.textContent = count;
        }
        
        // Get sync queue count
        const syncQueue = document.getElementById('db-sync-queue');
        if (syncQueue) {
            try {
                const queueResult = runQuery('SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0');
                const pendingCount = queueResult[0]?.count || 0;
                syncQueue.textContent = `${pendingCount} pending`;
                syncQueue.style.color = pendingCount > 0 ? '#FFA500' : '#00FF88';
            } catch (e) {
                syncQueue.textContent = 'N/A';
            }
        }
    } catch (error) {
        console.error('Failed to update database info:', error);
    }
}

function initDatabaseManagement() {
    // View Backups button
    const viewBackupsBtn = document.getElementById('view-backups-btn');
    if (viewBackupsBtn) {
        viewBackupsBtn.addEventListener('click', showBackupList);
    }
    
    // Export Database button
    const exportDbBtn = document.getElementById('export-db-btn');
    if (exportDbBtn) {
        exportDbBtn.addEventListener('click', async () => {
            try {
                await createManualBackup();
                updateDatabaseInfo(); // Refresh backup count
            } catch (error) {
                console.error('Export failed:', error);
            }
        });
    }
    
    // Import Database button
    const importDbBtn = document.getElementById('import-db-btn');
    if (importDbBtn) {
        importDbBtn.addEventListener('click', async () => {
            if (confirm('⚠️ Importing a database will replace all current data.\\n\\nAre you sure you want to continue?')) {
                try {
                    await restoreFromFile();
                } catch (error) {
                    console.error('Import failed:', error);
                }
            }
        });
    }
    
    // Backup modal close button
    const closeBackupModal = document.getElementById('close-backup-modal');
    if (closeBackupModal) {
        closeBackupModal.addEventListener('click', () => {
            document.getElementById('backup-modal').classList.remove('show');
        });
    }
}

function showBackupList() {
    const backupModal = document.getElementById('backup-modal');
    const backupList = document.getElementById('backup-list');
    
    if (!backupModal || !backupList) return;
    
    // Find all backups in localStorage
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('AynBeirutPOS_backup_')) {
            // Parse timestamp from key
            const match = key.match(/(\\d{4}-\\d{2}-\\d{2}T[\\d-]+Z?)/);
            let timestamp = 0;
            let dateStr = 'Unknown date';
            
            if (match) {
                const rawDate = match[1].replace(/-/g, ':').replace('T', 'T').slice(0, -1) + '.000Z';
                try {
                    const date = new Date(rawDate.replace(/-(\\d{3})Z$/, '.$1Z'));
                    timestamp = date.getTime();
                    dateStr = date.toLocaleString();
                } catch (e) {
                    console.warn('Could not parse date from:', key);
                }
            }
            
            // Get size
            const data = localStorage.getItem(key);
            const sizeKB = data ? (data.length / 1024).toFixed(2) : '0';
            
            // Calculate age
            const ageMs = Date.now() - timestamp;
            const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
            const ageStr = ageDays === 0 ? 'Today' : `${ageDays} days ago`;
            
            backups.push({ key, dateStr, sizeKB, ageStr, timestamp });
        }
    }
    
    // Sort by date (newest first)
    backups.sort((a, b) => b.timestamp - a.timestamp);
    
    // Render backup list
    if (backups.length === 0) {
        backupList.innerHTML = '<div style="text-align: center; padding: 40px; color: #888;">No backups found</div>';
    } else {
        backupList.innerHTML = backups.map((backup, index) => `
            <div style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 600; margin-bottom: 5px;">
                        ${index < 3 ? '⭐ ' : ''}Backup ${index + 1}
                    </div>
                    <div style="font-size: 13px; color: #888;">
                        📅 ${backup.dateStr} (${backup.ageStr})
                    </div>
                    <div style="font-size: 13px; color: #888;">
                        💾 Size: ${backup.sizeKB} KB
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-text" onclick="restoreBackupByKey('${backup.key}')" style="background: rgba(0, 255, 136, 0.2);">
                        ♻️ Restore
                    </button>
                    <button class="btn-text" onclick="deleteBackupByKey('${backup.key}')" style="background: rgba(255, 68, 68, 0.2);">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    backupModal.classList.add('show');
}

async function restoreBackupByKey(key) {
    if (!confirm('⚠️ Restoring this backup will replace all current data.\\n\\nAre you sure?')) {
        return;
    }
    
    try {
        const data = localStorage.getItem(key);
        if (!data) {
            alert('❌ Backup not found');
            return;
        }
        
        // Parse and restore
        const buffer = new Uint8Array(JSON.parse(data));
        db = new SQL.Database(buffer);
        await saveDatabase();
        
        alert('✅ Database restored successfully!\\n\\nThe app will reload now.');
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        console.error('Restore failed:', error);
        alert('❌ Restore failed: ' + error.message);
    }
}

function deleteBackupByKey(key) {
    if (!confirm('Delete this backup?\\n\\nThis cannot be undone.')) {
        return;
    }
    
    try {
        localStorage.removeItem(key);
        showBackupList(); // Refresh list
        updateDatabaseInfo(); // Update count
        showNotification('✅ Backup deleted');
    } catch (error) {
        console.error('Delete failed:', error);
        alert('❌ Delete failed: ' + error.message);
    }
}

// ===================================
// RECEIVE STOCK FUNCTIONALITY
// ===================================

function showReceiveStockModal() {
    const modal = document.getElementById('receive-stock-modal');
    const select = document.getElementById('receive-product-select');
    
    // Clear and populate product select
    select.innerHTML = '<option value="">-- Choose a product --</option>';
    
    loadProductsFromDB().then(products => {
        // Filter to only show Items (not Services)
        const items = products.filter(p => !p.type || p.type === 'item');
        
        if (items.length === 0) {
            select.innerHTML = '<option value="">No items with stock available</option>';
            return;
        }
        
        items.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.icon} ${product.name} (Stock: ${product.stock || 0})`;
            option.dataset.stock = product.stock || 0;
            select.appendChild(option);
        });
    });
    
    // Reset form
    document.getElementById('receive-stock-form').reset();
    document.getElementById('current-stock-display').value = '0';
    
    modal.classList.add('show');
}

function closeReceiveStockModal() {
    const modal = document.getElementById('receive-stock-modal');
    modal.classList.remove('show');
}

// Handle product selection change to show current stock
// Guard to prevent duplicate event listeners
if (!window._receiveStockInitialized) {
    window._receiveStockInitialized = true;
    
    function initializeReceiveStock() {
        const select = document.getElementById('receive-product-select');
        const display = document.getElementById('current-stock-display');
        
        if (select && display) {
            select.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                display.value = selectedOption.dataset.stock || '0';
            });
        }
        
        // Handle receive stock form submission
        const form = document.getElementById('receive-stock-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await receiveStock();
            });
        }
    }
    
    // Run initialization immediately if DOM already loaded, or wait for it
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeReceiveStock);
    } else {
        initializeReceiveStock();
    }
}

async function receiveStock() {
    const productId = parseInt(document.getElementById('receive-product-select').value);
    const quantity = parseInt(document.getElementById('receive-quantity-input').value);
    const notes = document.getElementById('receive-notes-input').value.trim();
    
    if (!productId) {
        alert('❌ Please select a product');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        alert('❌ Please enter a valid quantity (greater than 0)');
        return;
    }
    
    try {
        console.log('📦 Receiving stock for product ID:', productId, 'Quantity:', quantity);
        
        // Get current product
        const products = await loadProductsFromDB();
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            alert('❌ Product not found');
            return;
        }
        
        const oldStock = product.stock || 0;
        const newStock = oldStock + quantity;
        
        console.log(`📊 Stock update: ${product.name} ${oldStock} → ${newStock}`);
        
        // Update stock in database
        await runExec(
            'UPDATE products SET stock = ?, updatedAt = ? WHERE id = ?',
            [newStock, Date.now(), productId]
        );
        console.log('✅ Stock updated in database');
        
        // CRITICAL: Save database to IndexedDB
        await saveDatabase();
        console.log('✅ Database persisted to IndexedDB');
        
        // Log the stock adjustment
        if (typeof logActivity === 'function') {
            await logActivity('stock_receive', `Received ${quantity} units of ${product.name} (${oldStock} → ${newStock})${notes ? ': ' + notes : ''}`);
        }
        
        // Reload products
        await reloadProducts();
        
        // Refresh displays
        refreshProductList();
        if (typeof searchProducts === 'function') {
            searchProducts('');
        }
        if (typeof loadInventoryData === 'function') {
            loadInventoryData();
        }
        
        // Close modal and show success
        closeReceiveStockModal();
        showNotification(`✅ Received ${quantity} units of ${product.name}`);
        
        console.log(`✅ Stock received: ${product.name} +${quantity} (${oldStock} → ${newStock})`);
        
    } catch (error) {
        console.error('Failed to receive stock:', error);
        alert('❌ Failed to receive stock. Please try again.');
    }
}

// ===================================
// COMPOSED PRODUCT STOCK CALCULATION
// ===================================

window.calculateComposedProductStock = function calculateComposedProductStock(productId) {
    try {
        const db = window.db;
        if (!db) {
            console.warn('⚠️ Database not ready yet, cannot calculate stock for product:', productId);
            return 0;
        }
        
        console.log(`🔍 Calculating stock for composed product ID: ${productId}`);
        
        // Get recipe ingredients (DISTINCT to handle duplicate entries)
        const recipeResult = db.exec(`
            SELECT DISTINCT raw_material_id, quantity
            FROM product_recipes
            WHERE product_id = ${productId}
        `);
        
        console.log('📋 Recipe query result:', recipeResult);
        
        if (!recipeResult || !recipeResult[0] || recipeResult[0].values.length === 0) {
            console.log('⚠️ No recipe found for product ID:', productId);
            return 0;
        }
        
        console.log(`✅ Found ${recipeResult[0].values.length} ingredients in recipe`);
        
        let minPossibleUnits = Infinity;
        
        // Check each ingredient's available stock
        for (const ingredientRow of recipeResult[0].values) {
            const materialId = ingredientRow[0];
            const quantityNeeded = ingredientRow[1];
            
            console.log(`📦 Checking ingredient: Material ID ${materialId}, needs ${quantityNeeded}`);
            
            // Get current stock of raw material
            const stockResult = db.exec(`
                SELECT stock FROM products WHERE id = ${materialId}
            `);
            
            if (stockResult && stockResult[0] && stockResult[0].values.length > 0) {
                const availableStock = stockResult[0].values[0][0] || 0;
                const possibleUnits = Math.floor(availableStock / quantityNeeded);
                console.log(`  ➜ Available stock: ${availableStock}, can make: ${possibleUnits} units`);
                minPossibleUnits = Math.min(minPossibleUnits, possibleUnits);
            } else {
                console.log(`  ❌ Ingredient not found in products table`);
                return 0; // If any ingredient is missing, can't make any units
            }
        }
        
        const finalStock = minPossibleUnits === Infinity ? 0 : minPossibleUnits;
        console.log(`📊 Final calculated stock: ${finalStock} units`);
        return finalStock;
    } catch (error) {
        console.error('Error calculating composed product stock:', error);
        return 0;
    }
}

// ===================================
// RECIPE BUILDER FOR COMPOSED PRODUCTS
// ===================================

let recipeIngredients = [];
let isRecipeEditMode = false;
let editingRecipeProductId = null;

async function openRecipeBuilder(productId = null) {
    const modal = document.getElementById('recipe-builder-modal');
    const form = document.getElementById('recipe-product-form');
    
    // Reset form and ingredients
    form.reset();
    recipeIngredients = [];
    isRecipeEditMode = false;
    editingRecipeProductId = null;
    
    // Remove any existing warnings
    const existingWarning = form.querySelector('.recipe-locked-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    // Re-enable all form inputs (in case they were disabled)
    form.querySelectorAll('input, select, button').forEach(el => {
        el.disabled = false;
    });
    
    // Clear ingredients list
    document.getElementById('recipe-ingredients-list').innerHTML = '';
    document.getElementById('recipe-ingredients-empty').style.display = 'block';
    
    // Reset cost displays
    updateRecipeCostDisplay();
    
    // If editing existing product
    if (productId) {
        isRecipeEditMode = true;
        editingRecipeProductId = productId;
        document.getElementById('recipe-submit-text').textContent = '✅ Update Composed Product';
        // WAIT for recipe data to load BEFORE showing modal
        await loadRecipeForEdit(productId);
    } else {
        document.getElementById('recipe-submit-text').textContent = '✅ Create Composed Product';
    }
    
    modal.classList.add('show');
    modal.style.zIndex = '9999';
    
    // Ensure inputs are focusable and not blocked - multiple attempts
    const enableInputs = () => {
        console.log('🔧 Enabling form inputs...');
        const allInputs = modal.querySelectorAll('input, select, textarea');
        console.log(`Found ${allInputs.length} form elements`);
        
        allInputs.forEach((el, index) => {
            el.removeAttribute('readonly');
            el.removeAttribute('disabled');
            el.style.pointerEvents = 'auto';
            el.style.userSelect = 'text';
            el.tabIndex = index;
            console.log(`Enabled: ${el.id || el.tagName}`);
        });
        
        // Focus first input
        const firstInput = document.getElementById('recipe-product-name');
        if (firstInput) {
            firstInput.focus();
            console.log('✅ Focused first input');
            
            // Test if we can actually type
            firstInput.addEventListener('keydown', (e) => {
                console.log('Key pressed:', e.key);
            }, { once: true });
        }
    };
    
    // Try immediately
    enableInputs();
    
    // Try again after short delay
    setTimeout(enableInputs, 50);
    setTimeout(enableInputs, 200);
}

function closeRecipeBuilder() {
    const modal = document.getElementById('recipe-builder-modal');
    modal.classList.remove('show');
    recipeIngredients = [];
    isRecipeEditMode = false;
    editingRecipeProductId = null;
}

async function loadRecipeForEdit(productId) {
    try {
        // Load product details
        const product = await db.exec(`SELECT * FROM products WHERE id = ${productId}`)[0];
        if (!product || product.values.length === 0) {
            showNotification('Product not found', 'error');
            return;
        }
        
        const productData = product.values[0];
        const columns = product.columns;
        const getCol = (name) => productData[columns.indexOf(name)];
        
        // Fill basic info
        document.getElementById('recipe-product-id').value = productId;
        document.getElementById('recipe-product-name').value = getCol('name');
        document.getElementById('recipe-product-category').value = getCol('category');
        document.getElementById('recipe-product-icon').value = getCol('icon') || '';
        document.getElementById('recipe-service-cost').value = getCol('service_cost') || 0;
        document.getElementById('recipe-sell-price').value = getCol('price');
        
        // Load recipe ingredients
        console.log(`🔍 Loading recipe for product ${productId}...`);
        const recipe = await db.exec(`
            SELECT pr.*, rm.name, rm.cost, rm.unit
            FROM product_recipes pr
            JOIN products rm ON pr.raw_material_id = rm.id
            WHERE pr.product_id = ${productId}
        `)[0];
        
        console.log('📦 Recipe query result:', recipe);
        
        if (recipe && recipe.values.length > 0) {
            console.log(`✅ Found ${recipe.values.length} ingredients`);
            recipe.values.forEach(row => {
                const ing = {
                    id: row[recipe.columns.indexOf('raw_material_id')],
                    name: row[recipe.columns.indexOf('name')],
                    quantity: row[recipe.columns.indexOf('quantity')],
                    unit: row[recipe.columns.indexOf('unit')],
                    cost: row[recipe.columns.indexOf('cost')]
                };
                console.log('➕ Added ingredient:', ing);
                recipeIngredients.push(ing);
            });
            
            console.log('🧱 Total ingredients loaded:', recipeIngredients.length);
            renderRecipeIngredients();
            updateRecipeCostDisplay();
        } else {
            console.warn('⚠️ No recipe ingredients found for product', productId);
        }
        
        // Check if product has sales (for locking)
        // Only check for existing products, not new ones
        if (!productId) {
            console.log('ℹ️ New product - skipping sales check');
            return;
        }
        
        // Sales items are stored as JSON, so we need to check if product exists in any sale
        const salesResult = await db.exec(`
            SELECT COUNT(*) as count FROM sales WHERE items LIKE '%"id":${productId}%' OR items LIKE '%"id":"${productId}"%'
        `);
        
        const hasSales = salesResult && salesResult[0] && salesResult[0].values[0][0] > 0;
        
        if (hasSales) {
            // Show warning and disable editing
            const form = document.getElementById('recipe-product-form');
            
            // Check if warning already exists to prevent duplicates
            const existingWarning = form.querySelector('.recipe-locked-warning');
            if (!existingWarning) {
                const warning = document.createElement('div');
                warning.className = 'recipe-locked-warning';
                warning.style.cssText = 'background: rgba(244, 67, 54, 0.1); padding: 12px; border-radius: 6px; border-left: 4px solid #F44336; margin-bottom: 20px;';
                warning.innerHTML = `
                    <strong style="display: block; margin-bottom: 5px;">🔒 Recipe Locked</strong>
                    <small style="display: block; color: #C62828;">
                        This product has been sold and its recipe cannot be modified.<br>
                        To change the recipe, create a new product instead.
                    </small>
                    <button type="button" onclick="closeRecipeBuilder(); openRecipeBuilder();" class="btn-primary" style="margin-top: 10px; padding: 8px 16px; font-size: 14px;">
                        ➕ Create New Product
                    </button>
                `;
                form.insertBefore(warning, form.firstChild);
            }
            
            // Disable all form inputs
            form.querySelectorAll('input, select, button[type="submit"]').forEach(el => {
                if (!el.onclick || !el.onclick.toString().includes('closeRecipeBuilder')) {
                    el.disabled = true;
                }
            });
        }
        
    } catch (error) {
        console.error('Failed to load recipe:', error);
        showNotification('Failed to load recipe', 'error');
    }
}

async function addRecipeIngredient() {
    try {
        // Load available raw materials
        const result = await db.exec(`
            SELECT id, name, cost, unit, stock
            FROM products
            WHERE type = 'raw_material'
            ORDER BY name
        `);
        
        const materials = result[0];
        
        if (!materials || materials.values.length === 0) {
            showNotification('No raw materials available. Please add raw materials first.', 'error');
            return;
        }
        
        // Create ingredient selection UI
        const ingredientDiv = document.createElement('div');
        ingredientDiv.className = 'recipe-ingredient-item';
        ingredientDiv.style.cssText = 'background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);';
        
        let optionsHTML = '<option value="">-- Select raw material --</option>';
        materials.values.forEach(row => {
            const id = row[0];
            const name = row[1];
            const cost = row[2] || 0;
            const unit = row[3] || 'pieces';
            const stock = row[4] || 0;
            optionsHTML += `<option value="${id}" data-cost="${cost}" data-unit="${unit}">${name} (${stock} ${unit} @ $${cost}/${unit})</option>`;
        });
        
        const tempId = Date.now();
        ingredientDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 10px; align-items: end;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 12px; color: #8B949E;">Raw Material</label>
                    <select class="ingredient-select" data-temp-id="${tempId}" onchange="onIngredientSelect(this)" style="width: 100%;">
                        ${optionsHTML}
                    </select>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 12px; color: #8B949E;">Quantity</label>
                    <input type="number" class="ingredient-quantity" data-temp-id="${tempId}" step="0.01" min="0.01" placeholder="0" oninput="updateIngredientCost(this)" style="width: 100%;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 12px; color: #8B949E;">Line Cost</label>
                    <input type="text" class="ingredient-cost" data-temp-id="${tempId}" readonly style="width: 100%; background: rgba(0,0,0,0.3);" value="$0.00">
                </div>
                <button type="button" onclick="removeRecipeIngredient(${tempId})" class="btn-icon delete" style="margin-bottom: 0;">🗑️</button>
            </div>
            <input type="hidden" class="ingredient-unit" data-temp-id="${tempId}">
            <input type="hidden" class="ingredient-cost-per-unit" data-temp-id="${tempId}">
        `;
        
        document.getElementById('recipe-ingredients-list').appendChild(ingredientDiv);
        document.getElementById('recipe-ingredients-empty').style.display = 'none';
    } catch (error) {
        console.error('Failed to add ingredient:', error);
        showNotification('Failed to add ingredient: ' + error.message, 'error');
    }
}

function onIngredientSelect(selectElement) {
    const tempId = selectElement.dataset.tempId;
    const option = selectElement.options[selectElement.selectedIndex];
    const cost = parseFloat(option.dataset.cost) || 0;
    const unit = option.dataset.unit || 'pieces';
    
    // Update hidden fields
    document.querySelector(`.ingredient-unit[data-temp-id="${tempId}"]`).value = unit;
    document.querySelector(`.ingredient-cost-per-unit[data-temp-id="${tempId}"]`).value = cost;
    
    // Recalculate cost
    updateIngredientCost(document.querySelector(`.ingredient-quantity[data-temp-id="${tempId}"]`));
}

function updateIngredientCost(quantityInput) {
    const tempId = quantityInput.dataset.tempId;
    const quantity = parseFloat(quantityInput.value) || 0;
    const costPerUnit = parseFloat(document.querySelector(`.ingredient-cost-per-unit[data-temp-id="${tempId}"]`).value) || 0;
    const lineCost = quantity * costPerUnit;
    
    document.querySelector(`.ingredient-cost[data-temp-id="${tempId}"]`).value = `$${lineCost.toFixed(2)}`;
    
    updateRecipeCostDisplay();
}

function removeRecipeIngredient(tempId) {
    const item = document.querySelector(`.ingredient-select[data-temp-id="${tempId}"]`).closest('.recipe-ingredient-item');
    item.remove();
    
    const remainingItems = document.querySelectorAll('.recipe-ingredient-item');
    if (remainingItems.length === 0) {
        document.getElementById('recipe-ingredients-empty').style.display = 'block';
    }
    
    updateRecipeCostDisplay();
}

function renderRecipeIngredients() {
    const list = document.getElementById('recipe-ingredients-list');
    list.innerHTML = '';
    
    recipeIngredients.forEach((ing, index) => {
        const ingredientDiv = document.createElement('div');
        ingredientDiv.className = 'recipe-ingredient-item';
        ingredientDiv.style.cssText = 'background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);';
        
        const lineCost = ing.quantity * ing.cost;
        ingredientDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 10px; align-items: center;">
                <div><strong>${ing.name}</strong></div>
                <div>${ing.quantity} ${ing.unit}</div>
                <div style="color: #FF9800; font-weight: bold;">$${lineCost.toFixed(2)}</div>
                <button type="button" onclick="removeRecipeIngredientByIndex(${index})" class="btn-icon delete">🗑️</button>
            </div>
        `;
        list.appendChild(ingredientDiv);
    });
    
    if (recipeIngredients.length > 0) {
        document.getElementById('recipe-ingredients-empty').style.display = 'none';
    }
}

function removeRecipeIngredientByIndex(index) {
    recipeIngredients.splice(index, 1);
    renderRecipeIngredients();
    updateRecipeCostDisplay();
}

function updateRecipeCostDisplay() {
    let materialCost = 0;
    
    // Sum up from UI if in add mode
    document.querySelectorAll('.recipe-ingredient-item').forEach(item => {
        const costText = item.querySelector('.ingredient-cost')?.value || '$0.00';
        const cost = parseFloat(costText.replace('$', '')) || 0;
        materialCost += cost;
    });
    
    // Or from recipeIngredients array if editing
    if (recipeIngredients.length > 0) {
        materialCost = recipeIngredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost), 0);
    }
    
    const serviceCost = parseFloat(document.getElementById('recipe-service-cost')?.value) || 0;
    const totalCost = materialCost + serviceCost;
    const suggestedPrice = totalCost * 2.5; // 150% markup
    
    document.getElementById('recipe-material-cost').textContent = materialCost.toFixed(2);
    document.getElementById('recipe-service-cost-display').textContent = serviceCost.toFixed(2);
    document.getElementById('recipe-total-cost').textContent = totalCost.toFixed(2);
    document.getElementById('recipe-suggested-price').textContent = suggestedPrice.toFixed(2);
    
    // Auto-fill sell price with suggested price if empty
    const sellPriceInput = document.getElementById('recipe-sell-price');
    if (sellPriceInput && (!sellPriceInput.value || parseFloat(sellPriceInput.value) === 0)) {
        sellPriceInput.value = suggestedPrice.toFixed(2);
    }
}

// Listen to service cost changes (works even if DOM already loaded)
function initializeRecipeProductHandlers() {
    const serviceCostInput = document.getElementById('recipe-service-cost');
    if (serviceCostInput) {
        serviceCostInput.addEventListener('input', updateRecipeCostDisplay);
    }
    
    // Handle recipe form submission
    const recipeForm = document.getElementById('recipe-product-form');
    if (recipeForm) {
        recipeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveProductWithRecipe();
        });
    }
}

// Run initialization immediately if DOM already loaded, or wait for it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRecipeProductHandlers);
} else {
    initializeRecipeProductHandlers();
}

async function saveProductWithRecipe() {
    let ingredients = []; // Declare at function scope so it's accessible in post-save operations
    
    try {
        // Gather form data
        const name = document.getElementById('recipe-product-name').value.trim();
        const category = document.getElementById('recipe-product-category').value;
        const icon = document.getElementById('recipe-product-icon').value || '🍽️';
        const serviceCost = parseFloat(document.getElementById('recipe-service-cost').value) || 0;
        const sellPrice = parseFloat(document.getElementById('recipe-sell-price').value);
        
        console.log('📝 Creating composed product:', { name, category, icon, serviceCost, sellPrice });
        
        if (!name) {
            showNotification('Please enter product name', 'error');
            return;
        }
        
        if (!sellPrice || sellPrice <= 0) {
            showNotification('Please enter a valid sell price', 'error');
            return;
        }
        
        // Collect ingredients from DOM (for newly added items not yet in recipeIngredients array)
        const ingredientItems = document.querySelectorAll('.recipe-ingredient-item');
        const domIngredients = [];
        
        ingredientItems.forEach(item => {
            const select = item.querySelector('.ingredient-select');
            const quantityInput = item.querySelector('.ingredient-quantity');
            const unitInput = item.querySelector('.ingredient-unit');
            const costPerUnitInput = item.querySelector('.ingredient-cost-per-unit');
            
            if (select && select.value && quantityInput && quantityInput.value) {
                const materialId = parseInt(select.value);
                const quantity = parseFloat(quantityInput.value);
                const unit = unitInput ? unitInput.value : 'pieces';
                const cost = costPerUnitInput ? parseFloat(costPerUnitInput.value) : 0;
                
                // Get material name from select option
                const selectedOption = select.options[select.selectedIndex];
                const materialName = selectedOption ? selectedOption.text.split(' (')[0] : 'Unknown';
                
                domIngredients.push({
                    id: materialId,
                    name: materialName,
                    quantity: quantity,
                    unit: unit,
                    cost: cost
                });
            }
        });
        
        // Use DOM ingredients if available, otherwise use recipeIngredients array
        const sourceIngredients = domIngredients.length > 0 ? domIngredients : recipeIngredients;
        
        // Use ingredients from source and assign to function-scope variable
        ingredients = sourceIngredients.map(ing => ({
            raw_material_id: parseInt(ing.id),
            quantity: parseFloat(ing.quantity),
            unit: ing.unit,
            cost_per_unit: parseFloat(ing.cost) || 0
        }));
        
        if (ingredients.length === 0) {
            showNotification('Please add at least one ingredient', 'error');
            return;
        }
        
        // Calculate material cost
        const materialCost = ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_per_unit), 0);
        const totalCost = materialCost + serviceCost;
        
        // Start transaction
        db.run('BEGIN TRANSACTION');
        
        let productId;
        if (isRecipeEditMode && editingRecipeProductId) {
            // Update existing product
            productId = editingRecipeProductId;
            db.run(`
                UPDATE products SET
                    name = ?,
                    category = ?,
                    icon = ?,
                    price = ?,
                    cost = ?,
                    service_cost = ?,
                    has_recipe = 1,
                    type = 'composed'
                WHERE id = ?
            `, [name, category, icon, sellPrice, totalCost, serviceCost, productId]);
            
            // Delete existing recipe
            db.run(`DELETE FROM product_recipes WHERE product_id = ${productId}`);
        } else {
            // Insert new product
            // Generate a unique barcode
            const barcode = `RECIPE-${Date.now()}`;
            
            console.log('🔍 Creating new recipe product with barcode:', barcode);
            
            db.run(`
                INSERT INTO products (name, category, icon, price, cost, service_cost, stock, type, has_recipe, barcode)
                VALUES (?, ?, ?, ?, ?, ?, 0, 'composed', 1, ?)
            `, [name, category, icon, sellPrice, totalCost, serviceCost, barcode]);
            
            productId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        }
        
        // Insert recipe ingredients
        ingredients.forEach(ing => {
            db.run(`
                INSERT INTO product_recipes (product_id, raw_material_id, quantity, unit)
                VALUES (?, ?, ?, ?)
            `, [productId, ing.raw_material_id, ing.quantity, ing.unit]);
        });
        
        // Commit transaction
        db.run('COMMIT');
        
    } catch (error) {
        // Only rollback if transaction is still active
        try {
            db.run('ROLLBACK');
        } catch (rollbackError) {
            console.warn('Transaction already closed:', rollbackError);
        }
        console.error('Failed to save recipe:', error);
        showNotification('Failed to save composed product', 'error');
        return;
    }
    
    // Post-transaction operations (no rollback needed after this point)
    try {
        // Save to IndexedDB
        await saveDatabase();
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('product_recipe', `${isRecipeEditMode ? 'Updated' : 'Created'} composed product: ${name} with ${ingredients.length} ingredients`);
        }
        
        // Reload and close
        await reloadProducts();
        refreshProductList();
        
        closeRecipeBuilder();
        
        showNotification(`✅ Composed product ${isRecipeEditMode ? 'updated' : 'created'}: ${name}`);
        
    } catch (error) {
        console.error('Error in post-save operations:', error);
        showNotification('⚠️ Product saved but some operations failed', 'warning');
    }
}

async function viewRecipeDetails(productId) {
    try {
        // Load product and recipe
        const productResult = await db.exec(`SELECT * FROM products WHERE id = ${productId}`)[0];
        if (!productResult || productResult.values.length === 0) {
            showNotification('Product not found', 'error');
            return;
        }
        
        const product = productResult.values[0];
        const columns = productResult.columns;
        const getName = (col) => product[columns.indexOf(col)];
        
        // Load recipe ingredients with JOIN instead of view
        const recipeResult = await db.exec(`
            SELECT 
                rm.name as raw_material_name,
                pr.quantity,
                pr.unit,
                rm.cost as current_cost_per_unit,
                (pr.quantity * rm.cost) as current_line_cost
            FROM product_recipes pr
            JOIN products rm ON pr.raw_material_id = rm.id
            WHERE pr.product_id = ${productId}
            ORDER BY rm.name
        `)[0];
        
        let ingredientsHTML = '';
        let totalMaterialCost = 0;
        
        if (recipeResult && recipeResult.values.length > 0) {
            recipeResult.values.forEach(row => {
                const name = row[0];
                const qty = row[1];
                const unit = row[2];
                const cost = row[3] || 0;
                const lineCost = row[4] || 0;
                totalMaterialCost += lineCost;
                
                ingredientsHTML += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">${name}</td>
                        <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">${qty} ${unit}</td>
                        <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">$${cost.toFixed(2)}/${unit}</td>
                        <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right; font-weight: bold; color: #FF9800;">$${lineCost.toFixed(2)}</td>
                    </tr>
                `;
            });
        } else {
            ingredientsHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #8B949E;">No ingredients found</td></tr>';
        }
        
        const serviceCost = getName('service_cost') || 0;
        const totalCost = totalMaterialCost + serviceCost;
        const sellPrice = getName('price');
        const profit = sellPrice - totalCost;
        const profitMargin = totalCost > 0 ? ((profit / sellPrice) * 100).toFixed(1) : 0;
        
        // Create modal content
        const modalHTML = `
            <div id="recipe-details-modal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 700px;">
                    <div class="modal-header">
                        <h2>🍽️ Recipe Details: ${getName('name')}</h2>
                        <button class="modal-close" onclick="closeRecipeDetailsModal()">&times;</button>
                    </div>
                    
                    <div style="padding: var(--space-lg);">
                        <!-- Cost Summary -->
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
                            <div>
                                <div style="font-size: 12px; color: #8B949E; margin-bottom: 5px;">Material Cost</div>
                                <div style="font-size: 20px; font-weight: bold; color: #FF9800;">$${totalMaterialCost.toFixed(2)}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #8B949E; margin-bottom: 5px;">Service Cost</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2196F3;">$${serviceCost.toFixed(2)}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #8B949E; margin-bottom: 5px;">Total Cost</div>
                                <div style="font-size: 20px; font-weight: bold; color: #4CAF50;">$${totalCost.toFixed(2)}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #8B949E; margin-bottom: 5px;">Sell Price</div>
                                <div style="font-size: 20px; font-weight: bold; color: #00C2FF;">$${sellPrice.toFixed(2)}</div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                            <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; text-align: center;">
                                <div style="font-size: 12px; color: #8B949E; margin-bottom: 5px;">Profit per Unit</div>
                                <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">$${profit.toFixed(2)}</div>
                            </div>
                            <div style="padding: 15px; background: rgba(33, 150, 243, 0.1); border-radius: 8px; text-align: center;">
                                <div style="font-size: 12px; color: #8B949E; margin-bottom: 5px;">Profit Margin</div>
                                <div style="font-size: 24px; font-weight: bold; color: #2196F3;">${profitMargin}%</div>
                            </div>
                        </div>
                        
                        <!-- Ingredients Table -->
                        <h3 style="margin-bottom: 15px; color: #FF9800;">🧱 Recipe Ingredients</h3>
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: rgba(255,255,255,0.05);">
                                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid rgba(255,255,255,0.2);">Ingredient</th>
                                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.2);">Quantity</th>
                                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid rgba(255,255,255,0.2);">Unit Cost</th>
                                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid rgba(255,255,255,0.2);">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ingredientsHTML}
                                </tbody>
                                <tfoot>
                                    <tr style="background: rgba(255, 152, 0, 0.1); font-weight: bold;">
                                        <td colspan="3" style="padding: 12px; border-top: 2px solid rgba(255,255,255,0.2); text-align: right;">Material Subtotal:</td>
                                        <td style="padding: 12px; border-top: 2px solid rgba(255,255,255,0.2); text-align: right; color: #FF9800;">$${totalMaterialCost.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <div style="margin-top: 20px; display: flex; gap: 10px;">
                            <button onclick="openRecipeBuilder(${productId})" class="btn-primary" style="flex: 1;">
                                ✏️ Edit Recipe
                            </button>
                            <button onclick="closeRecipeDetailsModal()" class="btn-secondary">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        const existingModal = document.getElementById('recipe-details-modal');
        if (existingModal) {
            existingModal.remove();
        }
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Failed to load recipe details:', error);
        showNotification('Failed to load recipe details', 'error');
    }
}

function closeRecipeDetailsModal() {
    const modal = document.getElementById('recipe-details-modal');
    if (modal) {
        modal.remove();
    }
}

// ===================================/
// EXPORT FUNCTIONS
// ===================================

window.initProductManagement = initProductManagement;
window.loadProductsFromDB = loadProductsFromDB;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.reloadProducts = reloadProducts;
window.updateDatabaseInfo = updateDatabaseInfo;
window.showAddProductForm = showAddProductForm;
window.hideAddProductForm = hideAddProductForm;
window.openProductManagement = openProductManagement;
window.openProductManagementWithForm = openProductManagementWithForm;
window.restoreBackupByKey = restoreBackupByKey;
window.deleteBackupByKey = deleteBackupByKey;
window.showReceiveStockModal = showReceiveStockModal;
window.closeReceiveStockModal = closeReceiveStockModal;
window.receiveStock = receiveStock;
window.openRecipeBuilder = openRecipeBuilder;
window.closeRecipeBuilder = closeRecipeBuilder;
window.addRecipeIngredient = addRecipeIngredient;
window.removeRecipeIngredient = removeRecipeIngredient;
window.removeRecipeIngredientByIndex = removeRecipeIngredientByIndex;
window.onIngredientSelect = onIngredientSelect;
window.updateIngredientCost = updateIngredientCost;
window.saveProductWithRecipe = saveProductWithRecipe;window.viewRecipeDetails = viewRecipeDetails;
window.closeRecipeDetailsModal = closeRecipeDetailsModal;