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

`tests/api.http` expects a fresh seed. Each run registers one new `user<timestamp>@stayfinder.test` and deletes everything else it creates.
