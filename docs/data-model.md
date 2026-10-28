# Cabinet + tasting table

The current prototype uses Node 24 and SQLite, with additive table creation on startup. Existing cabinet records are preserved. No hosted database, new account, or API key is needed for local testing. Authentication, permissions, and deployment remain separate work before public use.

## Working model

- `members`: society profiles (not authenticated accounts).
- `bottles`: individual owned physical bottles and purchase cost; separate from enjoyment scores. Optional catalog reference, age statement, and bottle size preserve selected catalog metadata without inferring release year.
- `events`: a shared tasting occasion, date, and location.
- `pours`: an ordered event flight; each pour snapshots whiskey name, distillery, batch/release, proof, and an optional inventory bottle reference.
- `tastings`: member, date, optional event pour and cabinet bottle, a 1–10 enjoyment score, stage notes, and structured flavor intensities in JSON.

Each member may rate each event pour once; the server rejects duplicates and permits edits. Another event supports another tasting of the same whiskey. Flavor intensity values are 0–5; omitted values are unassessed. SQL foreign keys preserve tasting snapshots when inventory bottles, pours, or events are deleted. Member deletion cascades to that member's private inventory/tasting records; it does not remove shared events.

All current records are visible and editable by anyone with app access. Blind events use late identity entry: actual whiskey identities are not stored until the reveal action. This is not an authenticated host-controlled or public multi-tenant service. Members using separate devices must connect to the same hosted server/database; separate local copies do not synchronize.

## Preferred catalog direction

Treat the supplied research as leads, not verified provider contracts. BarrelDex's supplied JSON URL is blocked by the current environment proxy. The user supplied a 254-record JSON snapshot; the offline importer validates it and can install a local override. The user subsequently supplied the provider’s CC BY 4.0 terms and linked-credit requirement. The original snapshot is bundled with attribution in `catalog-data/ATTRIBUTION.md`; source terms were supplied by the user because the provider website remains blocked here. Do not invent fields or publish externally sourced reviews without established rights.

The next catalog migration should introduce stable `expressions`, `releases`, and `source_records` identities. Keep distillery, producer, and brand separate when the source distinguishes them. Preserve age separately from release year and distinguish proof per batch from expression defaults. Cabinet bottles and event pours should reference releases while retaining historical snapshots. Imported prices belong in dated, sourced price observations, separate from a member's actual purchase price. The current collection value sums purchase prices only and is not market valuation.

Import into staging first. Match by source ID, inspect duplicates/ambiguous releases, and preserve manual entries and user corrections. Store attribution with imported fields and expose it in the app. Do not merge outside review-derived flavor frequencies into member-measured intensity scores. The live catalog must remain optional so manual cabinet entries and flights continue working offline.

Blind events now store anonymous sample names and a per-pour reveal state. The reveal transaction attaches actual identities to both the pour and its tasting snapshots, preserving scores and notes. Existing events migrate as open-label and existing pours as revealed. Future event work can add authenticated host/member roles, attendance/invitations, score locking, and participant rankings.
