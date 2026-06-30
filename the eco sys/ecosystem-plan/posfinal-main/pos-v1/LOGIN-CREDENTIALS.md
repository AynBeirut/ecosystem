# 🔐 Ayn Beirut POS - Login Credentials

## Default Users

### 👨‍💼 Admin Account
- **Username:** `admin`
- **Password:** `admin123`
- **Role:** Administrator
- **Permissions:**
  - ✅ Product Management (Add/Edit/Delete products)
  - ✅ Sales Reports & Analytics
  - ✅ Customer Display Control
  - ✅ Barcode Scanner
  - ✅ Process Sales & Payments
  - ✅ View Activity Logs
  - ✅ Full System Access

### 👤 Cashier Account
- **Username:** `cashier`
- **Password:** `cashier123`
- **Role:** Cashier
- **Permissions:**
  - ❌ Product Management (Admin only)
  - ✅ Sales Reports & Analytics
  - ✅ Customer Display Control
  - ✅ Barcode Scanner
  - ✅ Process Sales & Payments
  - ❌ Activity Logs (Admin only)
  - ⚠️ Limited Access

## Quick Login

Both login options are available on the login page:
1. **Manual Entry:** Enter username/password and select role
2. **Quick Login Buttons:** Click "Admin" or "Cashier" button to auto-fill credentials

## Testing the System

1. **Open POS:** Double-click `START-POS-V1.bat`
2. **Login Screen:** You'll be redirected to login page
3. **Choose Account:** Click "Admin" or "Cashier" quick login button
4. **Test Features:**
   - Add products to cart
   - Use barcode scanner (F2 or scanner icon)
   - Open customer display (🖥️ button)
   - Process payment (💳 Checkout & Pay)
   - View reports (📊 Reports button)
   - Manage products (⚙️ Admin button - Admin only)

## Sales Reports Fix

✅ **FIXED:** Both Admin and Cashier can now view Sales Reports
- The reports button (📊) is now visible for both roles
- Cashiers can track their sales performance
- Admin has full analytics access

## Session Management

- Sessions persist in browser localStorage
- Auto-redirect to login if not authenticated
- Logout button (🚪) in header
- All actions logged with username

## Security Notes

⚠️ **Development Mode:**
- Passwords stored in plain text (for demo only)
- In production, use hashed passwords
- Consider adding password reset functionality
- Implement session timeout for security

## Troubleshooting

**Can't see reports button?**
- Make sure you're logged in
- Clear browser cache and reload
- Check browser console for errors

**Session not persisting?**
- Check if localStorage is enabled
- Try incognito/private mode
- Verify browser compatibility

**Login not working?**
- Username and password are case-sensitive
- Select correct role (Admin/Cashier)
- Check browser console for error messages

---

**Need Help?**
Contact: Ayn Beirut Support
Email: admin@aynbeirut.com
