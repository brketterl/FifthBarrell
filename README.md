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

`GET /api/catalog?q=...` currently searches twelve curated entries in `catalog.js`. This is explicitly labeled in the app. Select a result to fill name, distillery, and proof; all details remain editable. Proof can vary by release and market. The catalog has no photos, tasting notes, or prices and should not be treated as authoritative.

Live provider access is not configured. Requests to whiskyhunter.net and thecocktaildb.com were denied by the setup environment's network proxy. The latter is an ingredient/cocktail source rather than a comprehensive bottle catalog; neither has been validated as a suitable bottle provider. Before integrating a service, confirm bottle-level coverage, license, authentication, quota, and access. Implement a server-side adapter in `/api/catalog` that returns `{source, results: [{name, distillery, proof}]}`; keep provider credentials on the server and retain manual entry on errors. Do not put API keys in browser code.

The user provided `https://barreldex.com/data/bottles.json` as a preferred catalog source. The environment proxy denied this domain too. `barreldex.com` has been requested in the environment configuration draft; that does not apply network access until saved. No BarrelDex records or third-party flavor datasets are bundled. The supplied research reports CC BY 4.0 for BarrelDex, but the actual dataset schema, license text, attribution requirements, record count, and current coverage have not yet been verified. The tasting vocabulary in `tasting.js` is original to this app. See `docs/data-model.md` for the catalog integration direction.

## Before a public launch

This is a working local/shared prototype. It has no sign-in or role enforcement: anyone with server access can read and modify all cabinets. Keep it on a trusted local interface until authentication, society membership authorization, administrator-only member management, HTTPS, database backups, and deployment configuration are implemented. A hosted server and persistent storage are necessary for multiple devices to share data.
