# Country

> Status: Built — code in `src/features/country/`.

## Purpose

The master list of countries. Admins choose which countries are sold (`isActive`); consumers pick
their destination from the active ones; plans say which countries they cover (`PlanCountry`, see
[plan.md](plan.md)).

## Out of scope

- **Country names.** Never stored. The FE renders them from `isoCode` via `Intl.DisplayNames` in the
  current locale.
- **Creating or deleting countries.** The list comes from the seed; admins only toggle `isActive`.
- **Zones / regions** (Asia, Worldwide). A zone is expressed by which countries a plan covers, not by a
  field on Country.

## Data model

`prisma/schema/country.prisma`

- **Country** — `id` (cuid), `isoCode` (unique, ISO 3166-1 alpha-2, e.g. `JP`), `isActive`
  (default `true`), timestamps.

Seed (`prisma/seeds/country.ts`): every alpha-2 code from `i18n-iso-countries`, upserted. Re-seeding
adds new codes but **never overwrites `isActive`** values admins already set.

## Business rules

1. `isoCode` is the stable identifier other features and the FE use; `id` is internal.
2. The public list returns **active countries only**; the admin list returns all.
3. Both lists are sorted by `isoCode` ascending (the FE re-sorts by display name).
4. Only `isActive` is editable.

## Endpoints

| Method | Path                   | Who    | What                                 |
| ------ | ---------------------- | ------ | ------------------------------------ |
| GET    | `/countries`           | public | Active countries                     |
| GET    | `/admin/countries`     | admin  | All countries                        |
| PATCH  | `/admin/countries/:id` | admin  | Set `isActive` (404 if id not found) |

Shapes: OpenAPI at `/docs`.

## Interactions

- **Plan** links to countries through `PlanCountry`. Deactivating a country doesn't remove it from
  plans; public plan responses only expose active countries (see [plan.md](plan.md)).
