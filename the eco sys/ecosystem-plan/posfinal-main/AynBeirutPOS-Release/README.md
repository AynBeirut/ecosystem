# AYN BEIRUT POS v1.0 - MVP

Modern, lightweight point of sale system built with vanilla JavaScript, optimized for offline-first operation.

## Features

✅ **Offline First** - Works completely offline using IndexedDB
✅ **Fast & Lightweight** - <10MB total size, <2 second load time
✅ **Modern UI** - Dark theme with Ayn Beirut brand colors
✅ **Real-time Cart** - Instant updates and calculations
✅ **Receipt Printing** - Branded receipts with print functionality
✅ **Product Search** - Instant client-side search and filtering
✅ **Category Filters** - Quick product organization
✅ **Sales History** - Persistent storage of all transactions
✅ **PWA Ready** - Installable as standalone app

## Tech Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Storage**: IndexedDB for offline persistence
- **Cache**: Service Worker for offline-first capability
- **Fonts**: Poppins (Google Fonts)
- **Size**: ~10MB (vs 879MB Odoo)

## Quick Start

1. Double-click `START-POS-V1.bat`
2. System opens in browser (Chrome/Edge app mode recommended)
3. Start scanning or selecting products
4. Add to cart, adjust quantities
5. Click "Complete Payment" to checkout
6. Print receipt or start new order

## Keyboard Shortcuts

- `F1` or `Ctrl+K` - Focus search bar
- `Ctrl+Enter` - Complete checkout (if cart has items)
- `Escape` - Clear search or close modals

## Brand Colors

- **Ayn Blue**: #1C75BC (Primary)
- **Deep Tech Navy**: #0A0F1C (Background)
- **Electric Cyan**: #00C2FF (Highlights)
- **Warm Orange**: #F27A1D (Call-to-Action)

## Project Structure

```
pos-v1/
├── index.html          # Main application
├── manifest.json       # PWA configuration
├── sw.js              # Service Worker (offline support)
├── css/
│   └── styles.css     # All styles (brand colors, animations)
├── js/
│   ├── app.js         # Application initialization
│   ├── pos-core.js    # Product catalog, cart logic
│   ├── db.js          # IndexedDB operations
│   └── receipt.js     # Receipt generation & printing
├── assets/            # Images, icons (future)
└── data/              # Product data (future)
```

## Customization

### Add Products

Edit `js/pos-core.js` - modify the `PRODUCTS` array:

```javascript
{
    id: 11,
    name: "Your Product",
    category: "electronics",
    price: 99.99,
    icon: "📱"
}
```

### Change Tax Rate

Edit `js/pos-core.js`:

```javascript
const TAX_RATE = 0.11; // 11%
```

### Update Branding

Edit `css/styles.css` - modify CSS variables in `:root`

## Performance

- **Load Time**: <2 seconds (after first load)
- **Search**: <50ms
- **Cart Operations**: Instant
- **Receipt Generation**: <1 second
- **Database Operations**: <100ms

## Offline Capability

- All assets cached by Service Worker
- IndexedDB stores all sales history
- LocalStorage for cart persistence
- Works 100% without internet after first load
- Installable as PWA (Add to Desktop)

## Future Enhancements

- [ ] Logo upload/customization
- [ ] Product image support
- [ ] Barcode scanner integration
- [ ] Multiple payment methods
- [ ] User authentication
- [ ] Sales reports/analytics
- [ ] Inventory management
- [ ] Multi-location support
- [ ] Receipt printer driver integration
- [ ] Export sales data (CSV/JSON)

## Lessons Learned (from 3 previous attempts)

1. ❌ **Odoo (879MB)** - Too large, broken dependencies, 5-minute startup
2. ❌ **Electron wrapper** - Blank page issues, complexity overhead
3. ❌ **Bootstrap dependency** - Missing files caused complete failure
4. ✅ **Vanilla JS MVP** - Simple, fast, works offline, no dependencies

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

## License

Built by **Ayn Beirut** - Tech made in Beirut, deployed worldwide

---

**Version**: 1.0.0 (MVP)  
**Last Updated**: December 2025
