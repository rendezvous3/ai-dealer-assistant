# Dealer Catalog Data Sources

Last source pass: July 1, 2026.

This POC inventory is a volatile public-listing snapshot. Used-car listings can disappear, change price, change mileage, or move dealers quickly. Treat the data in `backend/db/seed.sql` as demo inventory, not a durable feed.

## Canonical Location

- Seed data: `backend/db/seed.sql`
- Local vehicle images: `client/public/vehicles/`
- Runtime catalog table: `vehicles`
- Row-level provenance fields: `source_name`, `source_url`, `vin`, `last_scraped_at`

Every catalog row should keep a usable `source_url`. If a source page disappears, replace the row or update it from a newer public listing and update `last_scraped_at`.

## Snapshot Coverage

As of the July 1, 2026 source pass, the seed contains 52 vehicle rows.

| Make | Rows |
| --- | ---: |
| Ford | 7 |
| Toyota | 6 |
| Honda | 4 |
| BMW | 3 |
| Chevrolet | 3 |
| Kia | 3 |
| Mercedes-Benz | 3 |
| Audi | 2 |
| Hyundai | 2 |
| Mazda | 2 |
| Nissan | 2 |
| Subaru | 2 |
| Tesla | 2 |
| Acura, Chrysler, Dodge, GMC, Genesis, Jeep, Lexus, Ram, Rivian, Volkswagen, Volvo | 1 each |

## July 1, 2026 Verified / Updated Rows

These were explicitly checked or refreshed during the July 1, 2026 POC hardening pass.

| Row id | Vehicle | Source | Notes |
| --- | --- | --- | --- |
| `used-subaru-outback-premium-2020-carfax` | 2020 Subaru Outback Premium | `https://www.carfax.com/vehicle/4S4BTACC5L3107801` | Exact CARFAX VIN page. Verified price $16,499, mileage 110,449, wagon body style, AWD, 26/33 MPG, Carface Auto Sales, no accident/damage, 1-owner, service-history surface. Do not invent full service logs beyond source context. |
| `used-mazda-cx30-s-2023-carfax` | 2023 Mazda CX-30 S Premium | `https://www.carfax.com/vehicle/3MVDMBDM1PM514489` | Exact CARFAX VIN URL stored in seed. CARFAX search page also showed VIN `3MVDMBDM1PM514489`, 22,228 miles, $23,717, Bedford, OH, no accident/damage, 1-owner, 7 service records. |
| `used-audi-q5-premium-plus-2023-carfax` | 2023 Audi Q5 Premium Plus 45 | `https://www.carfax.com/vehicle/WA1EAAFY3P2103671` | Exact CARFAX VIN URL stored in seed. CARFAX Summerville page showed VIN `WA1EAAFY3P2103671`, 30,998 miles, $30,795, Automaxx of the Carolinas, no accident/damage, 1-owner, 8 service records. |
| `used-toyota-prius-le-2023-carfax` | 2023 Toyota Prius LE | `https://www.carfax.com/Used-2023-Toyota-Prius_z39336` | Added/kept for Toyota gas-saver follow-ups. If the search page rotates, replace with a current exact VIN listing. |
| `used-toyota-corolla-hybrid-le-2023-stg` | 2023 Toyota Corolla Hybrid LE | `https://www.stgautogroup.com/inventory/2023-toyota-corolla-hybrid-le-JTDBCMFE2PJ014934` | Added/kept for small Toyota hybrid coverage. Volatile dealer listing. |

## Images

Vehicle cards should use local image paths so the widget does not break when marketplace image URLs expire.

- Main image folder: `client/public/vehicles/`
- Mazda CX-30 image refreshed July 1, 2026 from a public CarExpert Mazda CX-30 image:
  - Source page: `https://www.carexpert.com.au/mazda/cx-30`
  - Local file: `client/public/vehicles/mazda-cx30.jpg`

When replacing an image, prefer:

1. A current dealer/CARFAX image for the exact VIN, if permitted and stable enough for the POC.
2. A public editorial/manufacturer image of the same year/make/model.
3. A category fallback only if no model-specific image is practical.

Always save the final asset locally under `client/public/vehicles/` and update `image_url` in `backend/db/seed.sql`.

## Replacement Procedure

Use this when a car listing expires or shows stale price/mileage.

1. Find a current public listing for the same role in the catalog. Keep category coverage balanced: family SUV, gas saver, luxury SUV, truck, minivan, EV, hybrid, performance, work/commercial.
2. Prefer exact VIN pages over broad search pages. CARFAX VIN pages are best when available.
3. Update these fields in `backend/db/seed.sql`: `id`, `vin`, `year`, `make`, `model`, `trim`, `body_type`, `drive_type`, `fuel_type`, `engine`, `horsepower`, `mpg_city`, `mpg_highway`, `seats`, `mileage`, `price`, `dealer_name`, `dealer_zip`, `source_name`, `source_url`, `last_scraped_at`, `key_features`, `use_case_tags`, `priority_tags`.
4. Update or add a local image in `client/public/vehicles/`.
5. Keep service history conservative. A count like "8 service records" is okay if the source says it. Specific work such as "spark plugs changed" is only okay if the source explicitly lists it.
6. Reseed and validate locally.

Useful validation commands:

```bash
cd backend
npx wrangler d1 execute vehicle-catalog --local --file=db/schema.sql
npx wrangler d1 execute vehicle-catalog --local --file=db/seed.sql
npx wrangler d1 execute vehicle-catalog --local --command "select make, count(*) as count from vehicles group by make order by count desc, make;"
npx wrangler deploy --dry-run

cd ../client
npm run build:dev
```

To list all row-level source URLs from a clean SQLite seed:

```bash
tmp=$(mktemp /tmp/dealer-sources.XXXXXX)
sqlite3 "$tmp" < backend/db/schema.sql
sqlite3 "$tmp" < backend/db/seed.sql
sqlite3 -header -column "$tmp" "select id, year, make, model, trim, price, mileage, source_name, source_url from vehicles order by make, model, year;"
rm "$tmp"
```

## Known Volatility

- CARFAX/dealer inventory pages may disappear as soon as vehicles sell.
- Prices and mileage can change after test drives, dealer repricing, or feed refreshes.
- CARFAX service-history details are source-dependent. The app should not present inferred service work as known history.
- Broad CARFAX search URLs can reorder listings. Replace them with exact VIN URLs whenever possible.
