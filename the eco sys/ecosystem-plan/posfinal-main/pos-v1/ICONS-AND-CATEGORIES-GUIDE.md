# Icons and Categories Guide

## Where Icons Come From

Icons in the POS system are stored in the **database** in the `products` table, specifically in the `icon` column.

### Icon Sources:
1. **Database Field**: Each product has an `icon` field that stores an emoji or symbol
2. **Default Icons**: When you add a product, you can specify any emoji as the icon
3. **Emoji Support**: The system uses Unicode emojis, so any emoji works (📦, 🥩, 🍕, 💻, etc.)

### How to Change Product Icons:

**Option 1: Through Admin Panel**
1. Click the Admin button (⚙️) in the top menu
2. Go to "Product Management"
3. Click "Edit" on any product
4. Change the "Icon" field to any emoji you want
5. Save changes

**Option 2: Directly in Database**
- Icons are stored in the `products` table, `icon` column
- You can update them through database management tools
- Format: Single emoji character (e.g., '🍕', '📦', '💻')

### Recommended Icons by Category:

**Food Products:**
- 🍕 Pizza
- 🍔 Burger
- 🥗 Salad
- 🥩 Meat
- 🍞 Bread
- 🥪 Sandwich
- 🍝 Pasta

**Electronics:**
- 💻 Laptop
- 📱 Phone
- ⌨️ Keyboard
- 🖱️ Mouse
- 🖥️ Monitor

**Services:**
- 🛠️ Service
- ⚙️ Maintenance
- 🔧 Repair

**Raw Materials:**
- 📦 Generic Package
- 🥩 Meat
- 🌾 Grains
- 🥕 Vegetables

## Category System

### How Categories Work:

1. **Dynamic Loading**: Categories are now loaded dynamically from your actual products
2. **Auto-Generated**: The system scans all products and creates category buttons automatically
3. **Case-Insensitive**: Category filtering works regardless of uppercase/lowercase
4. **Excludes Raw Materials**: Only sellable products (items and services) appear in categories

### Category Filtering:

- **All Products**: Shows all sellable items and services
- **Specific Categories**: Click any category button to filter products
- **Search**: Works across categories - type to search products by name or category

### Adding New Categories:

When you add a product with a **new category name**, it will automatically appear in the category filter after refresh.

**Example:**
1. Add product with category: "Beverages"
2. Refresh the page
3. "Beverages" button appears in the category filter automatically

### Category Best Practices:

1. **Consistent Naming**: Use the same category name for similar products
2. **Capitalization**: Doesn't matter - "food", "Food", "FOOD" all work the same
3. **Descriptive Names**: Use clear category names (e.g., "Sandwiches" not "S")
4. **Avoid Duplicates**: Check existing categories before creating new ones

## Troubleshooting

### Categories Not Filtering:
✅ **FIXED** - Updated to case-insensitive comparison
- Categories now filter correctly regardless of case

### Raw Materials Showing in POS:
✅ **FIXED** - Raw materials filtered out automatically
- Only products with `type = 'item'` or `type = 'service'` show in POS
- Raw materials (`type = 'raw_material'`) only appear in inventory/purchases

### Icons Not Displaying:
- Check if the `icon` field in the database has a valid emoji
- Ensure your font supports emoji display
- Try updating the product icon through Admin Panel

### Wrong Icon for Product:
1. Go to Admin → Product Management
2. Find the product
3. Edit and update the icon field
4. Save changes

## Recent Fixes Applied

1. ✅ **Category Filtering**: Now case-insensitive
2. ✅ **Dynamic Categories**: Auto-generated from actual products
3. ✅ **Raw Materials Filtered**: Don't appear in POS menu
4. ✅ **Payment Modal Sizing**: Reduced to reasonable size (700px max)
5. ✅ **Cart Summary**: Collapsible - shows only Total by default
6. ✅ **Currency Symbol**: Moved to right side of input field
