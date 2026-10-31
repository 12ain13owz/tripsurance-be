# Plan

> Status: **Spec — not built yet.** This slice covers single-trip plans only; annual plans are the
> next slice (see `ROADMAP.md`). Built **after** [Add-on](addon.md). Code will live in
> `src/features/plan/`.

## Purpose

A plan is an insurance package a consumer can buy: what it covers (coverage amounts), where it covers
(countries), what it costs (price tiers by trip length), and which add-ons can be bought with it.
Admins create and maintain plans; consumers browse active plans and pick one.

A plan is **date-independent** — travel dates, travellers and the final price belong to the Order.

## Out of scope

- **Plan copy** (name, description, marketing text, coverage category labels). Lives in FE i18n
  (`tripsurance-fe/src/shared/i18n/messages/{en,th}/plans.json`), keyed by `plan.code`.
- **Quote / total price calculation** (`calculateQuote`). Lands with Order; this slice only stores
  the data it will read.
- **Annual plans** — next slice. Adds `ANNUAL` to `PlanType` and its pricing.
- **Managing add-ons themselves** (price, pricing type, activation) — that's the
  [Add-on](addon.md) feature. Plan only says _which_ add-ons it offers.
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
  sortOrder  Int     @default(0)        // storefront order; set by the server, changed via reorder
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

PlanAddon                               // which add-ons the plan offers
  planId → Plan (cascade), addonId → Addon
  @@id([planId, addonId])
```

`PlanCountry` and `PlanAddon` belong to this feature: the master tables (`Country`, `Addon`) don't
know which plans use them. Prisma still requires a back-relation field on both sides, so
`country.prisma` and `addon.prisma` each get one line (`planCountries PlanCountry[]`,
`planAddons PlanAddon[]`) — schema only; the country and add-on features never read it.

### Coverage categories

`categoryKey` is checked against a fixed BE constant list (`PLAN_COVERAGE_CATEGORIES` in
`src/features/plan/plan.const.ts`), not free text — every key needs an FE i18n label, so admins
can't invent one. It's stored as a `String`, not a Prisma enum, so adding a category needs no
migration:

`MEDICAL_EXPENSES`, `ACCIDENTAL_DEATH_DISABILITY`, `EMERGENCY_EVACUATION`, `REPATRIATION`,
`TRIP_CANCELLATION`, `TRIP_CURTAILMENT`, `FLIGHT_DELAY`, `BAGGAGE_DELAY`, `BAGGAGE_LOSS`,
`PERSONAL_LIABILITY`.

The list's order is the **display order**: responses return `coverages[]` sorted by it, so the
storefront and the policy PDF list coverages the same way.

Adding a category = add it to the constant + FE i18n in the same change.

## Business rules

Rules that only look at the request (code format, tiers, coverages) are checked by request
validation and fail with **422**. Rules that need the database fail in the service: `code` taken
→ 409, unknown country or add-on id → 400, plan not found → 404.

### Code

1. `code` is lowercase kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`), max 50 chars, unique.
2. `code` is **set on create and never changes** — update requests can't change it.

### Price tiers

Breakpoints are **free per plan** — plans don't have to share them. The seed uses the same
breakpoints for every plan by convention only.

3. A plan has at least 1 tier.
4. The first tier starts at `minDays = 1`.
5. Tiers are contiguous: sorted by `minDays`, each tier's `minDays` = previous `maxDays + 1` — no
   gaps, no overlaps.
6. `minDays ≤ maxDays` in every tier.
7. The last tier's `maxDays` is the plan's **max trip length**; a trip longer than that can't be
   quoted (400 at quote time). Hard upper bound: 365.
8. `pricePerTraveller` is a positive integer (satang) and is the **gross** price — what the customer
   pays per traveller, stamp duty and VAT included.

### Coverages

9. At least 1 coverage; each `categoryKey` is in the allowed list and appears once per plan.
10. `amount` is a positive integer (satang).

### Countries

11. At least 1 country; ids must exist (400 otherwise). Duplicates are ignored.
12. A plan may keep a country that has since been deactivated, but the **public** response only
    lists active countries.

### Add-ons

13. Zero or more add-ons; ids must exist (400 otherwise). Duplicates are ignored.
14. A plan may keep an add-on that has since been deactivated, but the **public** response only
    lists active add-ons — same rule as countries.

### Activation & order

15. New plans are created **inactive**. The admin toggles `isActive` when ready.
16. The public API only ever returns active plans. `GET /plans?country=JP` (ISO 3166-1 alpha-2,
    uppercase) keeps only plans covering that country; an unknown or inactive country returns an
    empty list, not 404.
17. Lists are sorted by `sortOrder` ascending, then `code`. Nested add-ons follow the add-on's own
    `sortOrder`.
18. Admins never type `sortOrder` — same rules as [Add-on](addon.md) (rules 9–10): a new plan is
    placed **last**, and order changes only through `PATCH /admin/plans/reorder` with every plan
    listed once as `{ id, sortOrder }` (400 otherwise, one transaction).

### Updates

19. `PATCH /admin/plans/:id` accepts any of `isActive`, `tiers`, `coverages`, `countryIds`,
    `addonIds`. Each list sent **replaces** that list entirely (in one transaction); a list not sent
    is left untouched.
20. Changing a price affects new quotes only — orders keep their own snapshot.

## Endpoints

| Method | Path                   | Who    | What                                                                                               |
| ------ | ---------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| GET    | `/admin/plans`         | admin  | All plans (active and inactive), with tiers, coverages, countries, add-ons                         |
| GET    | `/admin/plans/:id`     | admin  | One plan (404 if not found)                                                                        |
| POST   | `/admin/plans`         | admin  | Create (`code`, `tiers`, `coverages`, `countryIds`, `addonIds?`); placed last; 409 if `code` taken |
| PATCH  | `/admin/plans/reorder` | admin  | Reorder all plans (rule 18); registered before `/:id`                                              |
| PATCH  | `/admin/plans/:id`     | admin  | Update (rule 19); `code`, `type` and `sortOrder` not editable                                      |
| GET    | `/plans`               | public | Active plans; optional `?country=JP` (rule 16)                                                     |

Response shape (both audiences): `id`, `code`, `type`, `tiers[]`, `coverages[]`, countries as
`isoCode`s, and `addons[]` (`code`, `pricingType`, `price`, `coverageAmount`). Admin also gets
`isActive`, `sortOrder`, timestamps and every linked country/add-on; public gets active ones only.
Exact shapes go into OpenAPI after manual testing.

## Interactions

- **Country** — `PlanCountry.countryId` → `Country.id`. Public responses filter by `Country.isActive`.
- **Add-on** — `PlanAddon.addonId` → `Addon.id`. Public responses filter by `Addon.isActive`.
- **Order** (later) — snapshots the chosen plan's `code`, matched tier price, coverages, countries and
  chosen add-ons. Never references live Plan data after purchase.
- **Quote** (later) — reads `PlanPriceTier` to find the tier containing the trip's day count, and
  checks requested add-ons are offered by the plan and active.
- **FE** — admin form edits money in **baht** and converts to satang (× 100) before sending; the API
  only speaks satang.

## Seed

`prisma/seeds/plan.ts`, idempotent upsert by `code`, runs after the add-on seed, e.g.:

- `asia-basic` — Asian countries (a hardcoded `isoCode` list in the seed, since `Country` has no
  region); tiers 1–7 / 8–15 / 16–31 / 32–90 / 91–180 days; a couple of add-ons.
- `worldwide-plus` — all countries; same tier breakpoints, higher prices and coverage; all add-ons.
