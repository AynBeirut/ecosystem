# Online table reservations — 2026-09-28

## What changed
- Store page form style 11 writes a `tableReservations` row: guest, phone, email, date, time, party size, notes, status `requested`.
- Admin `/admin/events` → Reservations shows those rows. Staff set a table name, then Confirm, Seat, or Cancel.
- Event tickets and the contact email are unchanged. The email can fail after the booking is saved.

## Deployed
- Staging hosting: `index-Dn3Aakhr.js` at https://market-flow-7b074--staging-qj6e98fx.web.app
- Firestore rules for `tableReservations` were released on the live database so a public save works. Live hosting was not released.

## Test
1. Open the E-Moove store page table form. Request a table for a name, phone, date, and time.
2. Open Admin → Reservations. The row shows the guest name, date, time, and party size.
3. Type a table name, then Confirm.
