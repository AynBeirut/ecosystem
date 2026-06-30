# 🚀 AYN BEIRUT POS - TESTER GUIDE

## Quick Start (3 Steps)

### 1️⃣ Download & Extract
- Download the ZIP file from Google Drive
- Extract all files to a folder (e.g., Desktop/AynBeirutPOS)
- Keep all files together in the same folder

### 2️⃣ Run the Application
**Windows:**
- Double-click `START-POS.bat`
- The POS will open automatically in your browser

**Mac/Linux:**
- Open `index.html` in Chrome or Firefox

### 3️⃣ Start Testing
- No login required! The app auto-starts
- Everything works offline (no internet needed)

---

## 🎯 What to Test

### ✅ Basic Operations
- [ ] Add products to cart by clicking product cards
- [ ] Update quantities using +/- buttons
- [ ] Remove items from cart (🗑️ icon)
- [ ] Clear entire cart (Clear Cart button)
- [ ] Calculate total and tax

### ✅ Search & Filter
- [ ] Search products by name
- [ ] Filter by category (All, Electronics, Accessories, etc.)
- [ ] Test search with keyboard

### ✅ Virtual Keyboard (Touchscreen)
- [ ] Click on search box - keyboard should appear
- [ ] Click on barcode input - keyboard should appear
- [ ] Type using virtual keyboard
- [ ] Close keyboard by clicking outside

### ✅ Barcode Scanner
- [ ] Click barcode icon or press F2
- [ ] Enter barcode: `7891234567890` (Laptop)
- [ ] Try other barcodes from the product list
- [ ] Product should add to cart automatically

### ✅ Payment Processing
- [ ] Click "Checkout & Pay" button
- [ ] Try different payment methods (Cash, Card, Mobile)
- [ ] Complete payment
- [ ] View receipt

### ✅ Customer Display
- [ ] Click 🖥️ button (top right)
- [ ] Customer display should open in new window
- [ ] Add items to cart - they should appear on customer display
- [ ] Update quantities - changes should reflect

### ✅ Reports & Admin
- [ ] Click 📊 Reports button
- [ ] View daily sales, products sold, revenue
- [ ] Click ⚙️ Admin button
- [ ] Test product management (add/edit products)

### ✅ Offline Mode
- [ ] Disconnect from internet
- [ ] All features should still work
- [ ] Data persists after closing browser

---

## 📱 Sample Barcodes for Testing

| Product | Barcode |
|---------|---------|
| Laptop Pro 15 | `7891234567890` |
| Wireless Mouse | `7891234567891` |
| Mechanical Keyboard | `7891234567892` |
| USB-C Cable | `7891234567893` |
| Monitor 27" | `7891234567894` |

---

## ⚠️ Known Behaviors

- **Auto-Login:** Authentication is disabled for testing - you're automatically logged in as Admin
- **Virtual Keyboard:** Only appears when clicking input fields (designed for touchscreen)
- **Browser:** Works best in Chrome, Edge, or Firefox
- **Data Storage:** Uses browser's IndexedDB - clears when you clear browser data

---

## 🐛 Bug Reporting

When reporting bugs, please include:

1. **What you were doing** (steps to reproduce)
2. **What happened** (the bug)
3. **What you expected** (correct behavior)
4. **Browser & Version** (Chrome 120, Edge 119, etc.)
5. **Screenshots** (if applicable)

### How to Send Reports:
- Email: testing@aynbeirut.com
- Or create a text file with details

---

## 💡 Tips for Testing

- **Refresh the page** to reset all data
- **Open browser console** (F12) to see technical details
- **Test on different screen sizes** (resize browser window)
- **Try rapid clicking** to test responsiveness
- **Test with keyboard shortcuts** (F2 for barcode)

---

## 🔧 Troubleshooting

**POS won't start?**
- Make sure all files are extracted together
- Try opening `index.html` directly in Chrome
- Check if JavaScript is enabled in browser

**Virtual keyboard not showing?**
- Click directly inside the input field
- Works only on input/text fields
- May not work in Firefox (Chrome/Edge recommended)

**Nothing saves?**
- Make sure cookies/storage is enabled
- Don't use Incognito/Private mode
- Check browser settings for IndexedDB

**Customer display doesn't open?**
- Allow pop-ups in browser
- Check browser pop-up blocker settings

---

## 📞 Support

**Need Help?**
- Email: support@aynbeirut.com
- Documentation: See `README.md` for full details

---

**Thank you for testing! 🙏**

*Ayn Beirut - Tech made in Beirut, deployed worldwide*
