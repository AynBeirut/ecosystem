Server-side functions
=====================


This repository includes a `functions/` folder with a Firebase Cloud Function that implements an atomic `/api/checkout` endpoint. It should be deployed with the Firebase CLI and uses the Admin SDK to safely create orders and credit transactions while decrementing user credits in a Firestore transaction.

## 2025 Major Backend Changes

- **Order Structure:** Orders now include `customerName` and `customerPhone` fields, in addition to `customerId`, `storeId`, `items`, `subtotal`, `total`, and `createdAt`.
- **Debug Logging:** The `/checkout` endpoint now logs every request, including method, path, and headers, and logs all order creation attempts and errors. This helps with debugging and tracking all incoming requests (including CORS preflight `OPTIONS`).
- **Explicit OPTIONS Handler:** The backend now handles and logs all `OPTIONS` requests for CORS, returning status 204 and logging the request details.
- **Global Request Logger:** All requests to the API are logged for method, path, and headers, making it easier to debug frontend/backend communication issues.
- **Deployment:** Use `npm run build && firebase deploy --only functions` from the `functions` directory to deploy changes. If you see a missing script error, ensure you are in the correct directory and that `package.json` includes a `build` script.
- **Troubleshooting:**
	- If orders are not appearing in Firestore, check the Cloud Functions logs for `/api` in the Firebase Console.
	- Look for log entries like `CHECKOUT FUNCTION TRIGGERED` and request details to confirm the function is being called.
	- If you see only status 204 logs, your frontend may be sending only preflight requests (CORS); ensure you are making a real `POST` request to `/checkout`.
	- If you see status 200 but no order in Firestore, check for errors in the logs or Firestore security rules.

## Example Log Output

```
--- GLOBAL REQUEST LOG ---
Method: POST
Path: /checkout
Headers: { ... }
CHECKOUT FUNCTION TRIGGERED
Request method: POST
Request headers: { ... }
User: { userId, customerName, customerPhone }
Checkout items: [ ... ]
Items by store: { ... }
Attempting to create order for store: ...
Order created: { ... }
Orders created: [ ... ]
```

## Firestore Order Example

```
{
	storeId: 'store123',
	customerId: 'user456',
	customerName: 'Jane Doe',
	customerPhone: '+1234567890',
	items: [ ... ],
	subtotal: 100,
	total: 100,
	createdAt: ...
}
```

## CORS & API Endpoint Notes

- The backend is CORS-enabled for all origins.
- All requests (including preflight) are logged and handled.
- Make sure your frontend uses the correct API base URL (see `VITE_API_BASE`).

## Stripe MVP (Card Payments)

The API now includes Stripe card checkout endpoints:

- `POST /payment/stripe/checkout` → creates a Stripe Checkout Session for an existing order.
- `POST /payment/stripe/confirm` → verifies the returned Stripe session and marks the order as paid.

Required environment variables for the `functions` runtime:

- `STRIPE_SECRET_KEY` (required)
- `STRIPE_WEBHOOK_SECRET` (required for signed webhook verification)
- `FRONTEND_BASE_URL` (optional, defaults to `https://grabio.space`)

Example local `.env` (inside `functions/`):

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FRONTEND_BASE_URL=http://localhost:5173
```

Webhook endpoint:

- `POST /webhook/stripe` (expects Stripe-signed raw JSON payload)

## Recurring Service Renewal Job

The daily scheduler (`checkSubscriptions`) now also processes recurring service subscriptions:

- Reads active documents from `serviceSubscriptions`
- Queues reminder records in `serviceRenewalReminders` before due date
- Creates due renewal charge records in `serviceRenewalCharges`
- Marks subscription status as `payment_due` once a due charge is created

This keeps renewal generation idempotent using per-cycle keys stored on each subscription record.

## For further debugging

- Use the Cloud Functions > Logs Explorer in the Firebase Console.
- Filter for the `api` function and look for your request logs.
- If you need to add more logging, edit `functions/src/index.ts` and redeploy.

Quick start (from the repo root):

```powershell
cd functions; npm install; npm run build; npm run deploy
```

For local testing you can run the Functions emulator:

```powershell
cd functions; npm install; npm run start
```

See `functions/README.md` for more details.

Emulator notes:

- This repo now includes a `firebase.json` with `functions.source` set to `functions` and a `.firebaserc` placeholder. Replace `your-firebase-project-id` in `.firebaserc` with your actual Firebase project id or run `firebase use --add`.
- If you see the error "functions: Failed to start Functions emulator: codebase source must be specified", that means `firebase.json` was missing or `functions.source` wasn't set — it's included now, but make sure `.firebaserc` points to a valid project.

Start the emulator (from repo root):

```powershell
cd functions
npm install
npm run start
```

