# Rollback Procedure

**Created:** February 17, 2026  
**Purpose:** Step-by-step instructions to rollback Phase 11 (Sync Sold Quantities) if issues arise

---

## ⚠️ WHEN TO USE THIS PROCEDURE

Use this rollback if Phase 11 sync causes:
- Incorrect quantity calculations
- Data inconsistencies worse than before
- System errors or crashes
- Customer reports of wrong inventory

---

## 📋 PRE-ROLLBACK CHECKLIST

- [ ] Stop all users from creating new orders
- [ ] Note the exact time sync was performed
- [ ] Have backup folder name ready (from Phase 10)
- [ ] Verify backup exists in `backups/` folder
- [ ] Document what went wrong

---

## 🔙 ROLLBACK STEPS

### Step 1: Verify Backup Exists

```bash
ls -la backups/
```

Look for folder: `backup-[storeId]-[timestamp]`

### Step 2: Run Audit to Document Current State

```bash
npx ts-node scripts/auditAccountData.ts <storeId>
```

Save this report as "POST-SYNC-AUDIT.md" for comparison.

### Step 3: Restore finishedGoodsInventory Collection

**Option A - Restore Only Finished Goods (Recommended):**

1. Open Firebase Console
2. Navigate to Firestore Database
3. Go to `finishedGoodsInventory` collection
4. Delete all documents for your store
5. Open backup file: `backups/backup-[storeId]-[timestamp]/finishedGoodsInventory.json`
6. Import each document manually or use restore script:

```bash
# This will restore ONLY finishedGoodsInventory
# You'll need to modify restoreDatabase.ts to restore single collection
```

**Option B - Full Database Restore (Nuclear Option):**

```bash
npx ts-node scripts/restoreDatabase.ts <storeId> backup-[storeId]-[timestamp] --clear
```

⚠️ **WARNING:** This restores EVERYTHING and deletes current data!

### Step 4: Verify Restoration

```bash
npx ts-node scripts/auditAccountData.ts <storeId>
```

Compare with original pre-sync audit from Phase 10.

### Step 5: Check Key Products

In your app:
1. Go to **Finished Goods** page
2. Check 3-5 critical products
3. Verify:
   - Quantity Sold matches expected
   - Current Balance correct
   - Transaction history looks right

### Step 6: Allow Users Back

Once verified:
1. Notify users system is back online
2. Document what happened
3. Plan fix for sync issue

---

## 🔍 VERIFICATION CHECKLIST

After rollback, verify:

- [ ] Quantity Sold restored to pre-sync values
- [ ] Current Balance matches physical inventory
- [ ] Transaction history doesn't show sync entry
- [ ] No duplicate transactions
- [ ] Account Statement calculations match Finished Goods
- [ ] Can create new orders successfully
- [ ] Can mark orders as delivered without errors

---

## 📊 COMPARE PRE/POST SYNC

### Before Sync (from Phase 10 audit):
```
Product: 3Kg
  Finished Goods Qty: 22
  Actual Orders Qty: 14
  Difference: +8
```

### After Sync (should be):
```
Product: 3Kg
  Finished Goods Qty: 14
  Actual Orders Qty: 14
  Difference: 0
```

### After Rollback (should return to):
```
Product: 3Kg
  Finished Goods Qty: 22
  Actual Orders Qty: 14
  Difference: +8
```

---

## 🚨 IF ROLLBACK FAILS

1. **Contact Support:**
   - Provide backup folder location
   - Share audit reports (pre-sync, post-sync, post-rollback)
   - Describe exact error messages

2. **Manual Restoration:**
   - Open `backups/backup-[storeId]-[timestamp]/finishedGoodsInventory.json`
   - For each critical product, manually update in Firebase console:
     - Copy `quantitySold` value
     - Copy `currentBalance` value
     - Copy `transactions` array (if needed)

3. **Temporary Fix:**
   - Disable sync button
   - Continue operations with original (mismatched) data
   - Plan proper fix during off-hours

---

## 📝 POST-ROLLBACK ACTIONS

1. **Document Issue:**
   - What went wrong with sync?
   - Which products were affected?
   - What was the root cause?

2. **Review Sync Logic:**
   - Check sync function code
   - Verify order status filtering
   - Test with sample data

3. **Plan Re-Sync:**
   - Fix identified issues
   - Test in staging environment
   - Create backup before retry
   - Monitor closely during retry

---

## 🛠️ PREVENT FUTURE ISSUES

- Always backup before sync
- Run audit before and after
- Test sync on single product first
- Monitor for 24 hours after sync
- Keep multiple backup versions

---

**Last Updated:** February 17, 2026  
**Next Review:** After Phase 11 completion
