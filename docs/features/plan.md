# Plan

> Status: **Spec — not built yet.** This slice covers single-trip plans only. Annual plans and add-ons
> are their own slices (see `ROADMAP.md`). Code will live in `src/features/plan/`.

## Purpose

A plan is an insurance package a consumer can buy: what it covers (coverage amounts), where it covers
(countries), and what it costs (price tiers by trip length). Admins create and maintain plans;
consumers browse active plans and pick one.

A plan is **date-independent** — travel dates, travellers and the final price belong to the Order.

## Out of scope

- **Plan copy** (name, description, marketing text, coverage category labels). Lives in FE i18n
  (`tripsurance-fe/src/shared/i18n/messages/{en,th}/plans.json`), keyed by `plan.code`.
- **Quote / total price calculation** (`calculateQuote`). Lands with Add-on/Order; this slice only
  stores the tiers it will read.
- **Annual plans** — next slice. Adds `ANNUAL` to `PlanType` and its pricing.
- **Add-ons** — own slice (`Addon` + `PlanAddon`).
- **Deleting plans.** Plans are deactivated (`isActive = false`), never deleted, so past orders and
  reports keep a meaningful `code`.
- **Stripe.** No Stripe IDs on Plan; price goes to Stripe at checkout via `price_data`.

## Data model

New file `prisma/schema/plan.prisma`. All money is **integer satang** (THB × 100).

```
enum PlanType { SINGLE_TRIP }            // ANNUAL added by the annual slice

Plan
  id         cuid
  code       String  @unique            // stable slug, e.g. "asia-basic"
  type       PlanType @default(SINGLE_TRIP)
  isActive   Boolean @default(false)    // new plans start hidden until reviewed
  createdAt, updatedAt

PlanPriceTier                           // price per traveller by trip length
  id, planId → Plan (cascade)
  minDays    Int
  maxDays    Int
  pricePerTraveller Int                 // satang, gross (incl. stamp duty + VAT)
  @@unique([planId, minDays])

PlanCoverage                            // sum insured per coverage category
  id, planId → Plan (cascade)
  categoryKey String                    // see "Coverage categories"
  amount      Int                       // satang
  @@unique([planId, categoryKey])

PlanCountry                             // where the plan covers
  planId → Plan (cascade), countryId → Country
  @@id([planId, countryId])
```

### Coverage categories

`categoryKey` is checked against a fixed BE constant list (`PLAN_COVERAGE_CATEGORIES`), not free
text — every key needs an FE i18n label, so admins can't invent one. Initial list (to confirm):

`MEDICAL_EXPENSES`, `ACCIDENTAL_DEATH_DISABILITY`, `EMERGENCY_EVACUATION`, `REPATRIATION`,
`TRIP_CANCELLATION`, `TRIP_CURTAILMENT`, `FLIGHT_DELAY`, `BAGGAGE_DELAY`, `BAGGAGE_LOSS`,
`PERSONAL_LIABILITY`.

Adding a category = add it to the constant + FE i18n in the same change.

## Business rules

**Code**

1. `code` is lowercase kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`), max 50 chars, unique.
2. `code` is **set on create and never changes** — update requests can't change it.

**Price tiers** 3. A plan has at least 1 tier. 4. The first tier starts at `minDays = 1`. 5. Tiers are contiguous: sorted by `minDays`, each tier's `minDays` = previous `maxDays + 1` — no
gaps, no overlaps. 6. `minDays ≤ maxDays` in every tier. 7. The last tier's `maxDays` is the plan's **max trip length**; a trip longer than that can't be
quoted (400 at quote time). Hard upper bound: 365. 8. `pricePerTraveller` is a positive integer (satang) and is the **gross** price — what the customer
pays per traveller, stamp duty and VAT included.

**Coverages** 9. At least 1 coverage; each `categoryKey` is in the allowed list and appears once per plan. 10. `amount` is a positive integer (satang).

**Countries** 11. At least 1 country; ids must exist. Duplicates are ignored. 12. A plan may keep a country that has since been deactivated, but the **public** response only lists
active countries.

**Activation** 13. New plans are created **inactive**. The admin toggles `isActive` when ready. 14. The public API only ever returns active plans.

**Updates** 15. `PATCH /admin/plans/:id` accepts any of `isActive`, `tiers`, `coverages`, `countryIds`. Each list
sent **replaces** that list entirely (in one transaction); a list not sent is left untouched. 16. Changing a price affects new quotes only — orders keep their own snapshot.

## Endpoints

| Method | Path               | Who    | What                                                                     |
| ------ | ------------------ | ------ | ------------------------------------------------------------------------ |
| GET    | `/admin/plans`     | admin  | All plans (active and inactive), with tiers, coverages, countries        |
| GET    | `/admin/plans/:id` | admin  | One plan (404 if not found)                                              |
| POST   | `/admin/plans`     | admin  | Create (`code`, `tiers`, `coverages`, `countryIds`); 409 if `code` taken |
| PATCH  | `/admin/plans/:id` | admin  | Update (rule 15); `code` and `type` not editable                         |
| GET    | `/plans`           | public | Active plans; optional `?country=JP` to keep plans covering that country |

Response shape (both audiences): `id`, `code`, `type`, `tiers[]`, `coverages[]`, and countries as
`isoCode`s. Admin also gets `isActive`, timestamps and every linked country; public gets active
countries only. Exact shapes go into OpenAPI after manual testing.

Sort order: by `code` ascending for now.

## Interactions

- **Country** — `PlanCountry.countryId` → `Country.id`. Public responses filter by `Country.isActive`.
- **Order** (later) — snapshots the chosen plan's `code`, matched tier price, coverages and countries.
  Never references live Plan data after purchase.
- **Quote** (later) — reads `PlanPriceTier` to find the tier containing the trip's day count.
- **FE** — admin form edits tiers in **baht** and converts to satang (× 100) before sending; the API
  only speaks satang.

## Seed

`prisma/seeds/plan.ts`, idempotent upsert by `code`, e.g.:

- `asia-basic` — Asia countries; tiers 1–7 / 8–15 / 16–31 / 32–90 / 91–180 days.
- `worldwide-plus` — all countries; same tier breakpoints, higher prices and coverage.

## Open questions

1. **Coverage category list** above — confirm or replace with the insurer's real categories.
2. **Display order** — is `code` order fine, or do admins need a `sortOrder` to control the storefront
   order (e.g. basic → plus → premium)? Proposal: add `sortOrder Int @default(0)` now; it's cheap.
3. **Tier breakpoints** — free per plan (as specified), or one fixed set shared by all plans? Proposal:
   free per plan; the seed uses the same breakpoints by convention.
