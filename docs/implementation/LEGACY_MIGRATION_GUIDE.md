# Legacy Users Migration Guide

## 🎯 Goal
Activate 8 legacy users with 1 year free access (until Feb 28, 2027):
- **7 users** with **Pro tier**
- **1 user** (sawtonaorganization@gmail.com) with **Premium tier**
- **Note**: h.akalfouni@nip-lb.com is a sub-account under y.malek@nip-lb.com (not migrated separately)

---

## 📋 Prerequisites
- Access to Firebase Console
- Node.js installed (v20+)
- Terminal access

---

## 🚀 Migration Steps

### Step 1: Get Firebase Service Account Key

1. **Open Firebase Console**:
   - Go to: https://console.firebase.google.com/
   - Select project: **marketflow-8e82d**

2. **Navigate to Service Accounts**:
   - Click the gear icon ⚙️ (top left)
   - Click **Project settings**
   - Click **Service accounts** tab

3. **Generate Key**:
   - Click **Generate new private key** button
   - Confirm by clicking **Generate key**
   - A JSON file will download (e.g., `marketflow-8e82d-firebase-adminsdk-xxxxx.json`)

4. **Save the Key**:
   - Rename it to: `serviceAccountKey.json`
   - Move it to your project root:
     ```bash
     mv ~/Downloads/marketflow-8e82d-*.json "/home/anwar/Documents/grabio space/serviceAccountKey.json"
     ```

### Step 2: Verify the File

```bash
cd "/home/anwar/Documents/grabio space"
ls -la serviceAccountKey.json
```

You should see the file listed. **DO NOT commit this file to git!** (Already added to `.gitignore`)

### Step 3: Run the Migration

```bash
npx tsx scripts/activateLegacyUsers.ts
```

### Step 4: Check the Output

You should see:
```
🚀 Starting Legacy User Migration
📅 Migration Date: 2/28/2026
⏰ Free Access Until: 3/1/2027
👥 Total Users to Process: 8

============================================================

📝 Processing: info@emoove.co (Labe4444VCgnx9OVXNxTTgqcufO2) - Tier: PRO
   ✅ Successfully activated - Free until 3/1/2027

📝 Processing: h.akalfouni@nip-lb.com (koQBh4zaIPRJGFqEc2Hhbb9yjtI2) - Tier: PRO
   ✅ Successfully activated - Free until 3/1/2027

...

📝 Processing: sawtonaorganization@gmail.com (8CnhkG94gTgWLDykXmLQIvn4B12) - Tier: PREMIUM
   ✅ Successfully activated - Free until 3/1/2027

============================================================

📊 Migration Summary:
   Total Users: 8
   ✅ Successful: 8
   ❌ Failed: 0

✨ Migration complete!
```

---

## 🔍 Verify Activation

### Option 1: Firebase Console
1. Go to Firestore in Firebase Console
2. Navigate to `storeProfiles` collection
3. Check any legacy user document (e.g., `Labe4444VCgnx9OVXNxTTgqcufO2`)
4. Verify fields:
   - `isLegacyUser: true`
   - `subscriptionStatus: "active"`
   - `subscriptionTier: "pro"` or `"premium"`
   - `subscriptionEndsAt: "2027-02-28T23:59:59.000Z"`

### Option 2: Login as User
1. Login to your app as one of the legacy users
2. Navigate to admin dashboard
3. Check the subscription status shows active until Feb 28, 2027

---

## 👥 Legacy Users List

| Email | Tier | User ID | Notes |
|-------|------|---------|-------|
| info@emoove.co | Pro | Labe4444VCgnx9OVXNxTTgqcufO2 | |
| y.malek@nip-lb.com | Pro | DfIhBAEZ5NR7yNX0HboZvv58Nf82 | ✅ Activated - Includes sub-account h.akalfouni@nip-lb.com |
| janarawwas317@gmail.com | Pro | FcZLT5fzwOVwyfWaB0NEDUQMmPp2 | |
| info@aynbeirut.com | Pro | 91VJ4TwI3eZD1uoQGusYjHf5Pth2 | |
| anwar.ah7@gmail.com | Pro | i5WbUIegaXW7KW9W3hvDI0uKcMv2 | |
| mooveelectro@gmail.com | Pro | 1HfsBr45XYM5SkaaazWegmyqGpA3 | ✅ Activated |
| anwar.abouhassan@gmail.com | Pro | Av22LKyet8QmVcu9b8Njz1HVfo | |
| sawtonaorganization@gmail.com | **Premium** | 8CnhkG94gTgWLDykXmLQIvn4B12 | |

---

## ⚠️ Troubleshooting

### Error: "serviceAccountKey.json not found"
- Make sure you downloaded and renamed the file correctly
- Check that it's in the project root directory
- Verify the filename is exactly: `serviceAccountKey.json`

### Error: "No storeProfile found"
- This user hasn't upgraded to admin account yet
- They need to login and complete the admin upgrade process first
- The migration will skip them and continue with others

### Error: "Permission denied"
- The service account doesn't have Firestore permissions
- Go to Firebase Console → Firestore → Rules
- Make sure service accounts have read/write access

### Error: "Project not found"
- Check that the project ID in the service account matches: `marketflow-8e82d`
- Verify you're using the correct Firebase project

---

## 🔐 Security

**CRITICAL**: The `serviceAccountKey.json` file contains sensitive credentials that grant full admin access to your Firebase project.

- ✅ **Already added to `.gitignore`** - Won't be committed to git
- ❌ **NEVER share this file** with anyone
- ❌ **NEVER commit it** to version control
- ❌ **NEVER upload it** to any server or cloud storage
- ✅ **Delete it after migration** if you don't need it anymore:
  ```bash
  rm serviceAccountKey.json
  ```

---

## 📧 Next Steps After Migration

1. **Send Welcome Emails**: Notify legacy users about their free access
2. **Test Access**: Verify each user can login and access admin features
3. **Set Reminders**: Schedule notifications for Feb 2027 when access expires
4. **Monitor Usage**: Track which features legacy users are using
5. **Plan Transition**: Prepare migration path to paid subscriptions in 2027

---

## 📞 Support

If you encounter any issues:
1. Check the error message in terminal output
2. Review the troubleshooting section above
3. Check Firebase Console logs for detailed errors
4. Verify user IDs match exactly (case-sensitive)

---

**Last Updated**: Feb 28, 2026
