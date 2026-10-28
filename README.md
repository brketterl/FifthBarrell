# Fifth Barrel Society

A virtual whiskey cabinet and society tasting table with member management, individual and combined cabinets, guided tasting flights, member comparisons, and tasting history.

## Get the files on your computer

From the GitHub repository, use **Code → Download ZIP**, extract it, and open the extracted folder in Visual Studio Code. Install Node.js 24 or newer. Open **Terminal → New Terminal** in the folder containing `package.json`, run `npm start`, leave the terminal open, and visit `http://localhost:3000` in your browser. You do not need to install dependencies just to run the app.

Alternatively, with Git installed:

```sh
git clone https://github.com/brketterl/FifthBarrell.git
cd FifthBarrell
npm start
```

This server app is separate from the single-file browser prototype previously supplied in chat. Browser-only cabinet data is not automatically imported into SQLite.

## Society tasting events

1. Add society members in **Society members**.
2. Open **Tasting events**, create an event, and set its date and location.
3. Add an ordered flight from cabinet bottles or manually entered whiskey. Batch/release and proof are stored with each pour.
4. For each pour, choose **Taste this pour**, select the member, and record nose, palate, finish, mouthfeel, and overall enjoyment.
5. Compare member enjoyment scores and descriptor averages. View or edit individual records in the tasting journal; filter the journal by member.

Descriptor intensity is 0–5, with blank meaning not assessed. Enjoyment is a separate 1–10 score. Averages include assessed values only and show sample counts. Each member has one editable tasting per event pour; create another event to repeat a flight. Whiskey names and notes are visible throughout: these are open-label flights, not secure blind tastings. Member choice is not authenticated and there are no host-only permissions.

Tasting does not change the bottle's remaining amount. Pour identities are snapshots: editing or removing an inventory bottle does not rewrite tasting history. Removing an event/pour preserves its tasting records as archived journal entries. Removing a member permanently removes that member's inventory and tastings, after confirmation. **Export society data** downloads a JSON export of members, bottles, events, pours, and tastings; importing/restoring that JSON is not implemented.

## Run

Requires Node.js 24 or newer. No runtime packages or external services are required.

```sh
cd /workspace/FifthBarrell
npm start
```

The server listens on `127.0.0.1:3000`. Use `npm run dev` to restart on server edits. `PORT`, `HOST`, and `DB_PATH` optionally override the port, binding, and SQLite file. Data defaults to `data/society.sqlite` and survives server restarts. Back up the database using SQLite's backup tools; do not copy only the main file while it is being written in WAL mode.

```sh
npm test
```

The integration tests use separate temporary databases and exercise cabinet operations plus shared events, multi-member scores, duplicate prevention, validation, restart persistence, and history preservation when bottles/events are removed.

For browser tests, install the locked development dependencies and run:

```sh
npm ci --cache /tmp/fifth-barrel-npm-cache
npm run test:browser
```

Browser tests use a separate temporary database and exercise cabinet and society flight workflows at desktop and mobile sizes. Chromium is expected at `/usr/bin/chromium`; set `CHROMIUM_PATH` to use another installed Chromium executable.

## Bottle details

- Name, distillery, proof, and bottling/release year (separate from age)
- Member and preference: Favorite, Daily Drinker, Just OK, Do not Buy Again
- Amount remaining as a percentage, including empty bottles
- Purchase price in USD (optional; unknown prices are excluded from totals)
- Bourbon/tasting notes and member notes

Each entry represents one physical bottle. Member removal permanently removes their bottle entries after a confirmation. Member profiles are shared selectors, not authenticated user accounts.

## Whiskey database integration

The app includes a **254-record BarrelDex offline snapshot**. After pulling the latest code, restart with `npm start`; no account, live API call, or separate import is needed. Search is available for both cabinet bottles and tasting-flight pours.

### Expand lookup using the review CSV

BarrelDex remains the base catalog. The app now bundles **17,485 bottle/release candidates** derived from the user-supplied American Whiskey Review Database CSV, in addition to 254 BarrelDex entries. Pull the latest code and restart the app: no separate import is needed.

To optionally use a newer CSV as a local override, put `reviews.csv` beside `package.json` and run:

```sh
npm run import:reviews -- reviews.csv
npm start
```

Stop a running server with Ctrl+C before restarting. The file can also live elsewhere; quote its full path. The importer writes `data/catalog/reviews.json` without changing cabinet bottles or tastings. It refuses to replace an existing import unless `--replace` is supplied; back up the old file first. No Python, new dependencies, or Internet access is needed.

The provided 48,545 review rows generated **17,485 conservative bottle/release candidates**, not a verified count of unique bottles. Grouping considers brand, label, expression, batch, release year, class, release type, store selection, barrel, warehouse, floor, and rick. Repeated reviews of that identity collapse to one candidate; different batches and selections remain separate. Proof/age disagreements produce blank fields and caveats instead of guessed values. Year ranges are retained for display rather than converted to a single year. Stable IDs derive from normalized identity fields, not review dates, authors, or scores.

CSV **Label name** (such as Barrel Proof or Single Barrel) and **Expression** are shown explicitly in search results and selected-record details, and are editable/persisted for cabinet bottles and flight pours. Older catalog-linked bottles and local CSV imports can recover missing fields from bundled metadata by stable ID; saved non-null values are preserved. These fields are text, not label images.

Both lookup forms have an **All sources / BarrelDex / Review CSV** filter and Previous/Next results. Search brand/expression plus batch/year or selection/barrel details. Each result identifies its source. Specific review batches can prefill the bottle's batch and a missing release year; a manually entered year is preserved. Cabinet batch details persist through edits and carry into event pours. This is a flat search across expressions/releases, not a hierarchy of expression pages. Cross-source matches are not automatically merged: there is no verified link between a BarrelDex expression and a CSV release.

The user confirmed the provider permits developer data use. The derived bottle metadata is bundled in `catalog-data/reviews.json`, with provenance in `catalog-data/ATTRIBUTION.md`. No specific standardized license is claimed for this source. A local import in `data/catalog/reviews.json` overrides the bundled copy; remove that local override to return to the bundled snapshot. Attribution links to the original [Review Explorer](https://american-whiskey-review-database.streamlit.app/Review_Explorer). No reviewer names, scores, review text, or external posts are imported or scraped. An original synthetic CSV is used for tests. The optional local override and original CSV remain ignored by Git. Existing inventory and tasting records are not modified by catalog updates. `REVIEW_CATALOG_PATH` can select another generated catalog file and is used to isolate browser tests.

### Download the latest JSON automatically

In the VS Code terminal, run:

```sh
npm run update:catalog
```

Then restart the app (`Ctrl+C`, followed by `npm start`) and refresh your browser. This command checks the provider's official `https://barreldex.com/data/bottles.json` download on demand; it does not scrape pages or run on a schedule. It uses Node's environment proxy support (use a current Node 24 release, 24.5+). TLS verification remains enabled.

The updater validates HTTP status, JSON type, a 10 MB size limit, and bottle records/unique IDs before replacing the local catalog atomically. It has a 30-second request timeout and prevents concurrent updater runs. The previous local snapshot is saved under `data/catalog/backups/` when data changes; identical content produces no new backup. Download or validation failures preserve the previous catalog. Cabinet and tasting data are never touched. To restore an older snapshot, stop the app, run the import command below with a backup path and `--replace`, then restart.

The download command's actual request was denied by this cloud environment's network proxy during development. Success/failure paths were verified using controlled responses; a live BarrelDex download has not been verified here. On your computer, it requires ordinary HTTPS access to `barreldex.com`. No API key is required by this code. There is no guarantee that the provider's newest published file contains current prices or every new whiskey release.

### Optional: update the catalog from another download

The bundled snapshot lives in `catalog-data/barreldex.json`. To use a newer provider download locally, run:

```sh
npm run import:catalog -- /path/to/bottles.json
```

Quote paths containing spaces. Restart the server afterward. A validated local copy at `data/catalog/barreldex.json` takes precedence over the bundled snapshot and is ignored by Git. Existing cabinets and tastings are never modified by the importer. To intentionally replace an existing local copy, back it up and add `--replace`. Invalid replacements leave the previous catalog intact. Remove only the local override to return to the bundled snapshot. If neither snapshot is present, twelve starter entries remain available.

### Lookup behavior

Both **Add a bottle** and **Add a pour** search names, verified distilleries, suppliers, and categories. The uploaded snapshot inspected during development contains 254 records. The API returns stable `barreldex:<slug>` references, source metadata, counts, and up to 25 matches; refine the search for more specific results. Selecting a result fills editable identity/proof fields. Cabinet entries also store age statement and bottle size. Age is never converted into release year. Missing distilleries stay blank instead of substituting the supplier. Existing notes, release year/batch, and actual purchase price are preserved.

Dated NC/VA/PA retail observations are displayed separately, with source links, retrieval dates, and caveats. They are not MSRP, current market value, or acquisition cost, and never autofill the purchase-price field. Records identify their source verification dates; the app has not independently verified those dates or underlying prices. Details may vary by batch or market; confirm the physical label. Manual entries remain available.

### Attribution and data rights

Credit: **[BarrelDex (barreldex.com)](https://barreldex.com)**. The user supplied the provider's license text permitting reuse of its selection, structure, classifications, and notes under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** with linked credit. The unchanged uploaded JSON is bundled with the supplied terms and provenance in `catalog-data/ATTRIBUTION.md`. The provider website remains blocked here, so the licensing text was supplied by the user rather than fetched independently. The app displays linked attribution and the license alongside selected catalog details.

Original source: `https://barreldex.com/data/bottles.json`. Source dates and per-record caveats are preserved, with no claim that prices are current or independently verified. No scraping, external review imports, bottle photographs, or brand endorsement is involved. The tasting vocabulary remains original to this app. See `docs/data-model.md` for the catalog architecture direction.

## Before a public launch

This is a working local/shared prototype. It has no sign-in or role enforcement: anyone with server access can read and modify all cabinets. Keep it on a trusted local interface until authentication, society membership authorization, administrator-only member management, HTTPS, database backups, and deployment configuration are implemented. A hosted server and persistent storage are necessary for multiple devices to share data.
