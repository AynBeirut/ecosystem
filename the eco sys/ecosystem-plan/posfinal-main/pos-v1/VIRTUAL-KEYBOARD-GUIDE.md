# 🎹 Virtual Keyboard - User Guide

## Overview

The Ayn Beirut POS now includes an **on-screen virtual keyboard** for touchscreen devices and tablets. The keyboard automatically appears when you tap on any text input field.

## Features

✅ **Auto-Detection**: Keyboard automatically shows when tapping input fields
✅ **Smart Layout**: Different layouts for text vs numeric inputs
✅ **Shift Support**: Toggle between lowercase and uppercase letters
✅ **Special Characters**: Access numbers and symbols easily
✅ **Touch-Optimized**: Large keys for easy tapping on touchscreens
✅ **Responsive**: Adapts to different screen sizes

## Keyboard Layouts

### 1. **Normal Layout** (Text Inputs)
- Full QWERTY layout
- Numbers row (1-9, 0)
- Letters (a-z)
- Common symbols (. @ -)
- Space bar and Backspace
- Shift key for uppercase

### 2. **Shift Layout** (Uppercase)
- Uppercase letters (A-Z)
- Special characters (! @ # $ % ^ & * ( ))
- Additional symbols (_ -)
- Same spacebar and backspace

### 3. **Numeric Layout** (Number Inputs)
- 0-9 digits
- Decimal point (.)
- Backspace
- Optimized for prices and quantities

## How to Use

### Automatic Activation
1. **Tap any input field** (username, password, product name, price, etc.)
2. **Keyboard appears** from the bottom of the screen
3. **Type using on-screen keys**
4. **Keyboard stays** until you close it

### Manual Control
- **Close Button**: Tap "Close" to hide the keyboard
- **Minimize Button** (▼): Click the down arrow in the header to hide

### Key Functions

**Standard Keys**: Tap to insert character
**Backspace (⌫)**: Delete previous character
**Shift**: Toggle uppercase/lowercase
**Space**: Insert space character
**Close**: Hide the keyboard

## Where It Works

The virtual keyboard activates on these screens:

✅ **Login Page**
- Username input
- Password input

✅ **Main POS**
- Search products
- Barcode scanner input

✅ **Product Management**
- Product name
- Category
- Price
- Icon
- Barcode
- Stock quantity

✅ **Payment Modal**
- Cash amount received

✅ **Inventory Management**
- Stock adjustment prompts

## Tips & Tricks

### For Cashiers
- Use **numeric keyboard** for fast price entry
- Keyboard remembers your last input field
- Tap outside or press Close to dismiss

### For Admins
- Keyboard works in all admin forms
- Great for adding products on tablets
- Perfect for kiosk mode setups

### For Touch Devices
- Optimized for tablets (iPad, Android tablets)
- Works on touchscreen monitors
- Ideal for restaurant/retail kiosks
- No physical keyboard needed

## Technical Details

**Activation**: Focus event on input fields
**Layouts**: 3 different layouts (normal, shift, numeric)
**Input Types**: Automatically detects `type="number"` for numeric layout
**Position**: Fixed at bottom of screen
**Z-Index**: 10000 (always on top)
**Animation**: Smooth slide-up transition
**Compatibility**: All modern browsers

## Customization

### Disable Virtual Keyboard
If you prefer using physical keyboard only:
1. Comment out `initVirtualKeyboard()` in `app.js`
2. Remove `<script src="js/virtual-keyboard.js"></script>` from HTML

### Adjust Key Size
Edit `.keyboard-key` in `styles.css`:
```css
.keyboard-key {
    min-width: 50px;  /* Increase for larger keys */
    height: 50px;     /* Increase for taller keys */
}
```

### Change Layout
Modify `keyboardLayout` object in `virtual-keyboard.js` to add/remove keys.

## Browser Support

✅ Chrome / Edge (recommended)
✅ Firefox
✅ Safari (iOS/macOS)
✅ Opera
✅ Samsung Internet

## Accessibility

- **Large Keys**: Easy to tap (50x50px minimum)
- **Visual Feedback**: Keys highlight on hover
- **Color Coded**: Different colors for special keys
- **Clear Labels**: All keys clearly labeled

## Troubleshooting

**Keyboard not appearing?**
- Check if JavaScript is enabled
- Verify input field is focusable
- Ensure virtual-keyboard.js is loaded

**Keys not working?**
- Check browser console for errors
- Verify input field is not disabled
- Try refreshing the page

**Keyboard stuck open?**
- Click the "Close" button
- Click the minimize (▼) button
- Refresh the page

**Wrong layout showing?**
- Numeric layout: Triggered by `type="number"` inputs
- Text layout: All other input types
- Re-tap input field to reset

## Future Enhancements

Planned features:
- Copy/Paste buttons
- Tab key for field navigation
- Enter key for form submission
- Language layouts (Arabic, French, etc.)
- Custom key mappings
- Sound effects on key press
- Haptic feedback (vibration)

---

**Questions or Issues?**
Contact Ayn Beirut Support: admin@aynbeirut.com
