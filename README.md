# Fifth Barrel Society

A virtual whiskey cabinet and society tasting table with member management, individual and combined cabinets, guided tasting flights, member comparisons, and tasting history.

## Member sign-in and getting started

On first launch, create the administrator account before sharing the app. You can attach it to an existing member profile to preserve their bottles and tasting history. This initial setup must happen in a trusted environment: the first person to complete setup becomes administrator.

Administrators add members in **Society members**, then choose **Create sign-in invite** and share the single-use link privately. Each member chooses their own email and password (required, with no character-count restriction). Invitations attach accounts to existing profiles without duplicating collections. Passwords use salted scrypt hashes; sessions use HttpOnly, SameSite cookies and expire after seven days. Render’s `RENDER_EXTERNAL_URL` sets the trusted public origin automatically, so HTTPS requests remain valid when Render terminates TLS. Other reverse proxies must set `PUBLIC_ORIGIN` to the exact public origin (for example, `https://bourbon.example.com`). HTTPS public origins automatically use Secure session cookies. `PUBLIC_ORIGIN` overrides the Render URL for custom domains. Forwarded headers are not trusted to choose the allowed origin. Password recovery and email delivery are not yet implemented; invitations are shared manually and do not expire until used or replaced.

Administrators can use **Society members → Make administrator** to promote a member who has created an account. **Make member** removes administrator access; at least one administrator must remain. Role changes apply to existing sessions on their next request. Members without accounts must first accept a sign-in invitation.

**My profile** lets signed-in members edit their display name, email, and password. Email/password changes require the current password and sign out other devices while keeping the current device signed in. Name changes update the existing member profile, preserving cabinet ownership and tasting history.

The gathering place leads to your cabinet, event hosting, and your journal. Members can view the society collection and shared notes, edit their own bottles and tastings, and host events. Only an event’s host or an administrator can manage its flight or reveal blind samples. Administrators can manage other members’ records; administrator profiles cannot be deleted. Existing events without a host are managed by the administrator. Tasting entries and scores are shared with signed-in members, including before a blind reveal.

The SVG brand asset is a vector rendition of the supplied logo, not the original artwork.

## Get the files on your computer

From the GitHub repository, use **Code → Download ZIP**, extract it, and open the extracted folder in Visual Studio Code. Install Node.js 24 or newer. Open **Terminal → New Terminal** in the folder containing `package.json`, run `npm start`, leave the terminal open, and visit `http://localhost:3000` in your browser. You do not need to install dependencies just to run the app.

Alternatively, with Git installed:

```sh
git clone https://github.com/brketterl/FifthBarrell.git
cd FifthBarrell
npm start
```

This server app is separate from the single-file browser prototype previously supplied in chat. Browser-only cabinet data is not automatically imported into SQLite.

## Label photo lookup (testing trial)

Open **Add a bottle → Look up a label photo → Photograph label**. Take or select a clear label photo. Review and edit the recognized text, choose a possible catalog match, or correct the proposed name and use the label details as a starting point. Verify the expression, proof, and batch before saving the bottle. Catalog search and manual entry remain available.

Photos are read on the device using self-hosted Tesseract.js and an English language model. No image is uploaded; only recognized text is sent to search the offline catalog. The first lookup downloads the OCR assets and may take longer on phones. Clear, straight-on photos work best. Photos over 15 MB are rejected, and accepted photos are resized locally before OCR. Stylized text, glare, and fine print can still be misread. A clearly printed “proof” value may be extracted for review when using label details directly.

Barcode scanning and external barcode lookup are removed from this trial. Existing saved barcode data is retained and is not changed when bottles are edited. No external barcode provider, account, API key, or lookup allowance is involved in label photo lookup.

Automated desktop/mobile checks exercise the actual OCR engine with generated images, catalog matching, review-before-fill, editable no-match fallback, and the bottle save workflow. Labels should also be tested on physical devices before production approval.

## Optional OpenAI label recognition (testing trial)

**Look up a label photo → Read label with OpenAI** accepts one or two photos of the same bottle (front/back). It proposes bottle name, distillery, label/edition, expression, proof, age, size, batch/release, and bottling/release year, plus optional bourbon/tasting notes. Identity and numeric values include quoted label text for review. Members can edit values or uncheck fields, then select **Use selected details**. Only selected fields are merged into the bottle form; other bottle details, purchase price, notes, inventory, and cabinet photo remain intact. Saving the bottle is a separate step. Tasting notes printed on the label are identified with their supporting text. When no tasting notes are printed and the bottle is identifiable, the AI may offer a tentative nose/palate/finish profile based on general whiskey knowledge. These suggestions start unchecked and are saved with an “AI-suggested tasting profile (not verified for this bottle or batch)” prefix only if selected. Existing bourbon notes are not selected for replacement automatically, and personal member notes are never changed. AI can misread or invent details, so members must review suggestions. Submitted label photos are not reused as cabinet photos; image generation is not enabled.

The existing **Read photo on device** option stays available without an API key. That option keeps images on the device. The OpenAI option explicitly sends resized label photos to OpenAI through the app server, with no member profile information or API key exposed to the browser. Label images and AI responses are not saved in the society database. The Responses API request sets `store: false`; OpenAI's applicable data handling policies still apply.

To enable only on testing:

1. Create an OpenAI project API key with access to the Responses API, and ensure that API billing or credits are available.
2. In the Render **testing** service's Environment settings, add the secret Environment variable `OPENAI_API_KEY`. Alternatively, create a Render Secret File named `OPENAI_API_KEY` (or `openai_api_key`) containing the key; custom filenames require `OPENAI_API_KEY_FILE` set to the file’s full path under `/etc/secrets/`. A raw key or an `OPENAI_API_KEY=...` assignment is accepted. Environment variables take precedence. Do not put the key in code, a browser field, or chat.
3. Optionally set `OPENAI_LABEL_MODEL`; the default is `gpt-5.4-mini`, which supports image input and Structured Outputs. The model must support this request format and low reasoning effort.
4. Save/redeploy the testing service, reopen label lookup; AI availability is checked automatically. Startup logs show only whether a key was detected, never its value. The real **Read label with OpenAI** button opens the photo picker even when setup is missing; an actionable setup error is shown instead of a silently disabled control. Try front/back label photos. Check OpenAI project usage as you test. Production remains disabled until its service is configured separately.

The server decodes and resizes accepted image bytes, strips metadata, validates structured field types and numeric bounds, requires supporting evidence for identity/numeric fields and printed tasting notes, labels suggested tasting profiles separately, and limits requests to two images and 3,000 output tokens with a 45-second timeout. It does not use web tools or infer identity/numeric fields from memorized product knowledge in its extraction prompt; the optional, clearly marked tasting-profile suggestion is the exception for general whiskey knowledge; a bottler is not assumed to be the distillery. Duplicate in-flight requests by the same member are rejected. API errors, incomplete responses, or unreadable labels leave the form unchanged and offer the existing reader/manual entry. There are no automatic paid calls or retries.

Automated tests use controlled OpenAI responses and cover strict schema requests, invalid images before paid calls, credentials/origin protection, missing evidence, number validation, refusal/timeout handling, duplicate requests, and the desktop/mobile review-and-merge workflow. Live model accuracy and account access still require testing with a privately configured API key; no paid model call was made during implementation.

## Cabinet photos (testing trial)

In **Add a bottle** or **Edit bottle**, choose **Find a photo** to search Wikimedia Commons using the bottle name and release. You can edit the search terms if the exact release is not found. Results show candidates, their creators, and source links; choose **Use this photo** to preview one. Coverage varies, so **Upload a photo** also accepts your own bottle image. **Remove photo** returns to the bottle illustration. Changes apply only when you save the bottle; cancelling preserves the saved photo.

The first search source is Wikimedia Commons and accepts identifiable public-domain, CC0, CC BY, and CC BY-SA images. Saved search photos retain creator, source, license links, and a resize/conversion notice in the cabinet and bottle detail. The source's metadata must be checked for an exact bottle/release match. No paid image-search account or API key is required. This is a private society app; personal uploads are also supported.

Uploads are resized in the browser (15 MB input limit). The server accepts at most 6 MB, validates and decodes image bytes with Sharp, limits decoded pixels, strips embedded metadata, and stores a resized WebP in SQLite on the same persistent disk as the collection. No member-supplied remote URLs are fetched. Search imports require server-signed candidates, use a fixed Wikimedia host allowlist, reject redirects, and enforce size/time limits. Photos require sign-in to view, and members can assign their own uploads or search imports. Administrators can manage all photos. Unused drafts older than one day are cleaned up on later uploads/imports; photos attached to bottles are retained. Include the database when backing up photos.

Validation covers saving, replacement/removal, cancellation, persistence across restart, creator/license credit, candidate tampering, image validation, and member ownership. Live Wikimedia requests are blocked by this Codex workspace's outbound policy; automated search/import tests use provider fixtures. Check search coverage from the test site before production approval.

## Society tasting events

1. Add society members in **Society members**.
2. Open **Tasting events**, create an event, and set its date and location.
3. Add an ordered flight from cabinet bottles or manually entered whiskey. Batch/release and proof are stored with each pour.
4. For each pour, choose **Taste this pour**, record your own nose, palate, finish, mouthfeel, and overall enjoyment.
5. Compare member enjoyment scores and descriptor averages. View or edit individual records in the tasting journal; filter the journal by member.

Descriptor intensity is 0–5, with blank meaning not assessed. Enjoyment is a separate 1–10 score. Averages include assessed values only and show sample counts. Each member has one editable tasting per event pour; create another event to repeat a flight. Events support open-label and blind tastings. Members sign in individually; only the event host or an administrator can manage the flight and reveal samples.

### Blind tasting events

Choose **Blind tasting — reveal at the end** when creating an event. Add anonymous samples such as “Sample 1” or “Glass A”; do not use identifying names. The form does not collect the actual whiskey, cabinet link, proof, or catalog entry at this stage, and the server rejects those identity fields when adding a blind sample. Members record their guided tastings under the anonymous name.

After tasting, choose **Enter bourbon & reveal** on each sample. Select the actual whiskey from the catalog/cabinet or enter its details manually, then confirm **Reveal bourbon**. The sample's actual identity becomes visible in the flight and tasting journal. Existing scores, flavor measurements, dates, and notes stay intact; the original sample name remains alongside the revealed identity. Each pour is revealed separately. This is a one-way step; identities cannot be hidden again or changed through the reveal action. Existing open-label events are unchanged.

Only the host or an administrator can reveal samples. Members can edit their own tastings afterward. There is no minimum number of tasters, locked scores, or automatic end time. Before reveal, the actual identity is not stored or returned by the app, so state responses/JSON exports contain only anonymous samples. Avoid writing identifying information in shared event titles or tasting notes. Scores and notes remain visible to other members during blind tasting.

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

Individual member accounts protect society data and enforce ownership and host roles. Hosted deployments use the shared HTTP Basic gate over Render HTTPS only until the first administrator account is created. After setup, member sign-in is the only login, including after logout. Complete administrator setup before sharing member invitations.

### Render testing and production

`render.yaml` defines a Fifth Barrel Society project with testing and production environments in Oregon. Each has its own paid Starter web service and 1 GB disk. Confirm current charges in Render's deployment plan. Disk-backed deploys briefly interrupt access; these services run one instance each.

Testing deploys the `staging` branch; production deploys `main`. Both run `npm ci && npm test` before starting, use Node 24.19.0, listen on `0.0.0.0`, and store SQLite at `/var/data/society.sqlite`. `/health` checks database readiness without exposing app data. SIGTERM and SIGINT drain HTTP requests before closing the database.

Render generates a separate `ACCESS_PASSWORD` for each service. Retrieve it privately in that service's Environment settings and use the browser sign-in username `society`. Do not commit or share these values in chat. `REQUIRE_AUTH=true` prevents startup if the password is missing. Password changes require a redeploy. This shared gate protects first-run setup only and is automatically bypassed once an account exists; individual member accounts then provide society membership and administrator authorization.

Push changes to `staging`, check the testing site, then merge those same changes into `main` to release production. The databases remain independent and code promotion does not copy test records. Both databases start empty; existing local records are not automatically uploaded. Use SQLite-native backups for any migration or backup, including WAL state; filesystem snapshots alone are not application-consistent database backups. Catalog snapshots are bundled in Git; local catalog overrides are not transferred.
