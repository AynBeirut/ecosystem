# Subscription Validation & API Changes

## Validation rules to enforce

1. **Tier validation**
   - Allowed tiers: `trial`, `starter`, `pro`, `business`.
   - Legacy `premium` is normalized to `starter` for backward compatibility.

2. **Product limits**
   - Trial: 10 products
   - Starter: 8 products
   - Pro: 20 products
   - Business: 50 products

3. **Storage limits**
   - Trial: 500MB
   - Starter: 5GB
   - Pro: 10GB
   - Business: 20GB

4. **Trial operation limits**
   - Trial users: 30 operations/month (`invoice`, `purchase`, `recipe`, `sale`)
   - Non-trial: unlimited

5. **Product type restrictions**
   - Trial: simple products/services only
   - Starter/Pro/Business: composed products allowed
   - Manufacturing features available in Pro/Business or with `manufacturingBom` add-on

6. **Add-on eligibility**
   - `domainPackage`: Starter/Pro/Business
   - `whatsappBusiness`: all tiers
   - `manufacturingBom`: Pro/Business only
   - `extraStorageBlocks`: Starter/Pro/Business

7. **Trial lifecycle**
   - Trial duration: up to 3 months
   - Grace period after trial: 15 days
   - Revenue share on trial: 20%

## API contract changes

### `POST /subscription/trial`
- `tier` is ignored and normalized to `trial`.
- Returns:
  - `trialMonths`
  - `trialGraceDays`
  - `cardVerificationRequired`

### `POST /subscription/subscribe`
- Accepts tiers: `starter`, `pro`, `business`.
- Accepts add-on payload shape:

```json
{
  "domainPackage": true,
  "whatsappBusiness": true,
  "manufacturingBom": false,
  "extraStorageBlocks": 2
}
```

- Still accepts legacy add-ons payloads and normalizes internally.

### `GET /subscription/info`
- Can resolve user from bearer token when `userId` is not passed.
- Response now includes:
  - `addOnsMeta`
  - `limits` object with product/storage/operations/revenue-share values

## Billing notes

- Trial uses `20%` revenue share model in metadata fields.
- Add-on billing supports:
  - Domain package: `$15/mo` or `$150/yr`
  - WhatsApp: `$10/mo` or `$100/yr`
  - Manufacturing: `$15/mo` or `$150/yr`
  - Extra storage: `$2/mo per 5GB block` (yearly equivalent computed in API pricing)
