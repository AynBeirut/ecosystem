## 2025 Project Updates & Changelog

### Android App (Capacitor) Integration & Fixes
- Migrated web app to Android using Capacitor.
- Updated Gradle and SDK configuration to support Android 15 (Vanilla Ice Cream, API 35).
- Fixed build errors by aligning compileSdkVersion/targetSdkVersion to 35 and Java compatibility to 17.
- Guided installation of correct Android SDKs and Build-Tools.
- Resolved "Browser plugin is not implemented on android" by removing all @capacitor/browser usage and switching to signInWithRedirect for Google Sign-In.
- Ensured all sign-in logic is Android-compatible and does not use unsupported plugins.

### Google Sign-In & Auth
- All authentication now uses signInWithRedirect for maximum compatibility (no signInWithPopup or Browser plugin).
- Cleaned up authentication logic for both web and Android.

### Build & Launch Instructions (Web)
To run the web app locally:

```sh
npm install
npm run dev
```
The app will be available at http://localhost:5173 (or the port shown in your terminal).

To build for production:

```sh
npm run build
npm run preview
```
The preview server will show your production build locally.

To deploy, use Vercel, Netlify, or your preferred static hosting provider. Upload the contents of the `dist/` folder.

### General Improvements
- Cleaned up old build artifacts and ensured no legacy plugin code remains.
- README updated with all recent changes and troubleshooting steps.
# HappyBasket

## Project info

**URL**: https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b

## Project Name

**HappyBasket** (formerly market-flow-emporium)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.



## Major Changes & Features (2025 Session)

### Firebase/Firestore Integration
- Seller upgrade logic uses Firestore for persistent seller/admin status (`sellers` collection).
- Store profile management is connected to Firestore (`storeProfiles` collection), with type safety and error handling.
- Product management (add/edit/delete) is fully integrated with Firestore (`products` collection), associating products with seller/store ID.

### Security & Setup
- Firestore security rules provided to allow authenticated users to write to their own data.
- Guidance for Firebase project/database setup included.


- Added Payment Credentials section for store admins to securely enter and save WishPay and Visa/MasterCard details to Firestore (`AdminPayments.tsx`).
- Added Cash on Delivery as a payment option for regular users in the cart (`Cart.tsx`).

### UI/UX
- Loading and processing states for async Firestore operations.
- Toast notifications for success/error feedback.

### How to Continue Development
- All seller/admin features are now persistent and user-specific.
- To add more features, follow the Firestore integration patterns in `src/pages/UpgradeToAdmin.tsx`, `src/pages/admin/AdminProfile.tsx`, and `src/pages/admin/AdminProducts.tsx`.

---

---
## What technologies are used for this project?

HappyBasket is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Local editor hints and `.hintrc`

This repository includes a small `.hintrc` file used to tune webhint/editor warnings that are noisy in some dev environments (for example, theme-color compatibility messages across older browsers or inline-style rules flagged by some tools).

- Why: these rules were added to reduce distracting editor warnings while debugging the admin routing/hook issue.
- How to opt-out: remove or rename `.hintrc` in the repo root. Your editor will then show the original webhint warnings again.
- How to adjust: open `.hintrc` and update or remove specific rules; prefer editing the rules rather than deleting the file so CI behavior remains consistent for the team.

If you'd like, I can revert `.hintrc` and instead fix individual issues strictly (for example by removing all inline styles) — tell me which approach you prefer.
