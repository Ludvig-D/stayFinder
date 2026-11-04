```
npm install
npm run dev
```

```
open http://localhost:3000
```

## Seed data

Three steps, in this order. Together they rebuild all the data from scratch:

1. `supabase/seed/reset.sql` in the Supabase SQL editor. It deletes **all** users, listings and bookings, but keeps the tables, RLS and triggers.
2. `npm run seed` (here in `backend/`). It creates users, listings and bookings through the publishable key, so every row passes RLS and the triggers. It stops if the database isn't empty.
3. `supabase/seed/past_booking.sql` in the SQL editor. It adds a booking whose check-in has passed (VG5), which the rules don't allow through the API.

Every user's password is `password123`:

| User | Role |
|---|---|
| anna@stayfinder.test | host (Åre, Stockholm ×2, Rättvik), also books |
| erik@stayfinder.test | host (Visby, Göteborg, Malmö, Lund), also books |
| omar@stayfinder.test | host (Kiruna, Vaxholm, Uppsala, Öland), also books |
| sara@stayfinder.test | guest |
| lisa@stayfinder.test | guest |

## API tests

`tests/stayfinder.postman_collection.json` has every test call: for each rule, a call that should succeed and the calls that should be rejected. Each request checks its expected status code (and sometimes a value in the body), so a run shows pass or fail per call.

- **Postman:** use the desktop app (Postman on the web can't reach `localhost` without its agent). Import the file, then Run collection.
- **Terminal:** `npx newman run tests/stayfinder.postman_collection.json` (here in `backend/`)

Run it top to bottom, with the backend running and a fresh seed (the 3 steps above). Postman keeps the session cookie between requests, like a browser. Each run registers one new `user<timestamp>@stayfinder.test` and deletes everything else it creates, so it can be run again.
