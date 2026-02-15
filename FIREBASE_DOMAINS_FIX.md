# 🔥 FIREBASE DOMAINS - CRITICAL FIX

## Date: February 14, 2026

---

## ⚠️ SITUATION

**grabio.space** and **emoove.site** are Firebase-hosted web applications (production), NOT regular websites on cPanel.

### What We Did:
1. ✅ Updated DNS zones on VPS to point to Firebase IPs (151.101.1.195, 151.101.65.195)
2. ✅ Removed Apache virtual hosts pointing to VPS (will cause issues)

### What You Need To Do:
Configure Firebase custom domains properly

---

## 🎯 SOLUTION OPTIONS

### **OPTION 1: Use Our Nameservers (RECOMMENDED)**

Update nameservers at Namecheap to `ns1.emoove.co` and `ns2.emoove.co`, then verify domains in Firebase.

#### Steps:

**1. Update Nameservers at Namecheap:**
- Login to Namecheap
- Go to grabio.space → Manage → Nameservers
- Select "Custom DNS"
- Enter:
  ```
  ns1.emoove.co
  ns2.emoove.co
  ```
- Repeat for emoove.site

**2. Verify Domains in Firebase Console:**

For each domain (grabio.space and emoove.site):

a) Go to Firebase Console → Hosting → Custom Domain
b) Add custom domain: `grabio.space` (and `www.grabio.space`)
c) Firebase will give you a TXT record like:
   ```
   firebase=firebase1234567890abcdef
   ```

d) Add this TXT record to our DNS server:
   ```bash
   ssh root@104.207.71.117
   # Edit the zone file
   nano /var/named/grabio.space.zone
   
   # Add this line:
   @       IN      TXT     "firebase=YOUR_VERIFICATION_CODE_HERE"
   
   # Save and reload
   systemctl reload named
   ```

e) Click "Verify" in Firebase
f) Firebase will provision SSL automatically
g) Repeat for emoove.site

---

### **OPTION 2: Keep DNS at Namecheap**

Don't change nameservers, just update A records at Namecheap to point to Firebase.

#### Steps:

**1. At Namecheap for grabio.space:**
- Go to Advanced DNS
- Keep nameservers on "Namecheap BasicDNS" or "Namecheap PremiumDNS"
- Update A Records:
  ```
  @ → 151.101.1.195
  @ → 151.101.65.195
  www → 151.101.1.195
  www → 151.101.65.195
  ```

**2. In Firebase Console:**
- Go to Hosting → Custom Domain
- Add `grabio.space` and `www.grabio.space`
- Firebase will provide TXT record for verification
- Add TXT record at Namecheap Advanced DNS
- Click Verify in Firebase

**3. Repeat for emoove.site**

---

## 🔧 CURRENT DNS CONFIGURATION

Our DNS server (104.207.71.117) is already configured:

**grabio.space zone:**
```dns
@       IN      A       151.101.1.195
@       IN      A       151.101.65.195
www     IN      A       151.101.1.195
www     IN      A       151.101.65.195
```

**emoove.site zone:**
```dns
@       IN      A       151.101.1.195
@       IN      A       151.101.65.195
www     IN      A       151.101.1.195
www     IN      A       151.101.65.195
```

---

## 📝 ADDING FIREBASE VERIFICATION TXT RECORDS

When Firebase gives you verification codes, add them like this:

```bash
# SSH to VPS
ssh root@104.207.71.117

# Edit grabio.space zone
nano /var/named/grabio.space.zone

# Add BEFORE the "Firebase Hosting IPs" section:
; Firebase Domain Verification
@       IN      TXT     "firebase=YOUR_VERIFICATION_CODE"

# Increment the serial number (change 2026021402 to 2026021403)
# Save and exit (Ctrl+X, Y, Enter)

# Reload DNS
systemctl reload named

# Verify it's working
dig @localhost grabio.space TXT
```

Repeat for emoove.site if needed.

---

## ✅ VERIFICATION CHECKLIST

After making changes:

- [ ] Nameservers updated at Namecheap (if using Option 1)
- [ ] Domains added in Firebase Console → Hosting
- [ ] TXT verification records added
- [ ] Firebase verification successful
- [ ] SSL certificate provisioned by Firebase
- [ ] Test: https://grabio.space loads your app
- [ ] Test: https://www.grabio.space works
- [ ] Test: https://emoove.site loads your app
- [ ] Test: https://www.emoove.site works

---

## 🚨 IMPORTANT NOTES

1. **Don't Delete Firebase Projects:** These apps are hosted on Firebase, not our VPS

2. **Files on VPS:** The files copied to `/home/aynbeirut/grabio.space` and `/home/aynbeirut/emoove.site` are just build outputs from cPanel cache. They're NOT the production apps. You can delete them.

3. **Apache Virtual Hosts:** We need to REMOVE these domains from Apache on VPS since they're hosted on Firebase

4. **DNS Propagation:** Takes 24-48 hours after nameserver changes

5. **Firebase SSL:** Firebase automatically provisions SSL certificates for custom domains

---

## 🔍 TROUBLESHOOTING

### Domain verification fails in Firebase:
```bash
# Check if TXT record is visible
dig grabio.space TXT +short

# Should show: "firebase=YOUR_CODE"
```

### Website shows error after DNS update:
- Wait for DNS propagation (24-48 hours)
- Check Firebase Console for domain status
- Verify A records point to correct Firebase IPs

### SSL certificate not working:
- Firebase takes 24 hours to provision SSL after domain verification
- Check Firebase Console → Hosting → Custom domains for status

---

## 📞 NEXT IMMEDIATE ACTIONS

1. **Remove these domains from Apache on VPS** (done below)
2. **Tell me your Firebase verification codes** when you get them from Firebase Console
3. **Update nameservers at Namecheap** (your choice: Option 1 or 2)

---

**Status:** ⚠️ DNS configured for Firebase, awaiting domain verification in Firebase Console
