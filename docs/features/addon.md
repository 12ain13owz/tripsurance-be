# Add-on

> Status: **Built** — code in `src/features/addon/`. Built before [Plan](plan.md).

## Purpose

Optional extra cover a consumer can buy on top of a plan (e.g. extreme sports, rental-car excess,
more baggage cover). Admins maintain the add-on catalogue — price, how it's charged, coverage amount,
active flag, display order. Which plans offer which add-ons is set on the Plan.

## Out of scope

- **Linking add-ons to plans** (`PlanAddon`) — owned by [Plan](plan.md), set via the plan's
  `addonIds`, the same way `PlanCountry` is.
- **A public route.** Consumers see add-ons only as part of a plan (`GET /plans`).
- **Add-on copy** (name, description). Lives in FE i18n
  (`tripsurance-fe/src/shared/i18n/messages/{en,th}/addons.json`), keyed by `addon.code`.
- **Price calculation for an order** — done by `calculateQuote` in the Order slice, using the rules
  below.
- **Per-plan prices.** One price per add-on. Add an override column on `PlanAddon` only if a real case
  needs it.
- **Dependencies / exclusions** between add-ons ("B requires A"). Not needed yet.
- **Deleting add-ons.** Deactivate instead, so past orders and reports keep a meaningful `code`.

## Data model

New file `prisma/schema/addon.prisma`. All money is **integer satang** (THB × 100).

```
enum AddonPricingType {
  PER_ORDER               // one price for the whole order
  PER_TRAVELLER           // price × travellers
  PER_TRAVELLER_PER_DAY   // price × travellers × trip days
}

Addon
  id              cuid
  code            String  @unique        // stable slug, e.g. "extreme-sports"
  pricingType     AddonPricingType
  price           Int                    // satang, gross (incl. stamp duty + VAT)
  coverageAmount  Int?                   // satang; extra sum insured, if the add-on has one
  isActive        Boolean @default(false)
  sortOrder       Int     @default(0)    // set by the server, changed only via reorder
  createdAt, updatedAt
```

## Business rules

### Code

1. `code` is lowercase kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`), max 50 chars, unique (409 if taken).
2. `code` is **set on create and never changes**.

### Price

3. `price` is a positive integer (satang), max 100,000,000 (1,000,000 THB), and is **gross** — stamp
   duty and VAT included, like plan prices.
4. The amount an order pays for an add-on is:
   - `PER_ORDER` → `price`
   - `PER_TRAVELLER` → `price × travellers`
   - `PER_TRAVELLER_PER_DAY` → `price × travellers × days`
5. `coverageAmount` is optional; when set, a positive integer (satang), same max as `price`.

### Activation & order

6. New add-ons are created **inactive**; the admin activates them when ready.
7. An inactive add-on stays linked to its plans but is hidden from consumers and can't be quoted.
8. Lists are sorted by `sortOrder` ascending, then `code`.
9. Admins never type `sortOrder`. Create and update don't accept it: a new add-on is placed **last**
   (current max `sortOrder` + 1, or 0 when it's the first).
10. Order is changed only by `PATCH /admin/addons/reorder` (drag and drop in the admin UI). The body
    lists **every** add-on exactly once as `{ id, sortOrder }`, ids and `sortOrder`s unique,
    `sortOrder` an integer ≥ 0. Anything else (missing, extra or unknown id, duplicates) is 400 and
    nothing changes. All rows are updated in one transaction.

### Updates

11. `PATCH /admin/addons/:id` accepts any of `pricingType`, `price`, `coverageAmount` (`null` clears
    it), `isActive` — at least one. `code` and `sortOrder` are not editable here.
12. Changing a price affects new quotes only — orders keep their own snapshot.

## Endpoints

| Method | Path                    | Who   | What                                                       |
| ------ | ----------------------- | ----- | ---------------------------------------------------------- |
| GET    | `/admin/addons`         | admin | All add-ons (active and inactive), sorted                  |
| GET    | `/admin/addons/:id`     | admin | One add-on (404 if not found)                              |
| POST   | `/admin/addons`         | admin | Create (starts inactive, placed last); 409 if `code` taken |
| PATCH  | `/admin/addons/reorder` | admin | Reorder all add-ons (rule 10); returns the sorted list     |
| PATCH  | `/admin/addons/:id`     | admin | Update (rule 11); 404 if not found                         |

`/reorder` is registered before `/:id`, otherwise Express matches `reorder` as an id.

Shapes: OpenAPI at `/docs` (`src/features/docs/spec/paths/addon/`).

## Interactions

- **Plan** — `PlanAddon` links plans to add-ons; public `/plans` embeds each plan's active add-ons.
- **Order** (later) — snapshots each chosen add-on's `code`, `pricingType`, unit `price`, computed line
  amount and `coverageAmount`. Each add-on becomes its own Stripe line item.
- **FE admin** — edits money in **baht**, converts to satang (× 100) before sending. No `sortOrder`
  field in the form; the list page reorders by drag and drop, sending the full list with
  `sortOrder` = index. Drag is disabled while the list is filtered, since reorder needs every row.

## Seed

`prisma/seeds/addon.ts` — placeholder data for dev, **active**, upserted by `code` without
overwriting existing rows (admin edits survive a re-seed, like countries). Real add-ons and prices are
entered by admins later.

| code                | pricingType             | price (THB) | coverage (THB) | sortOrder |
| ------------------- | ----------------------- | ----------- | -------------- | --------- |
| `extreme-sports`    | `PER_TRAVELLER_PER_DAY` | 20          | —              | 10        |
| `baggage-plus`      | `PER_TRAVELLER`         | 99          | 10,000         | 20        |
| `flight-delay-plus` | `PER_TRAVELLER`         | 59          | 5,000          | 30        |
| `rental-car-excess` | `PER_ORDER`             | 150         | 20,000         | 40        |

## Open questions

None blocking. The real add-on list and prices are data, entered by admins.
