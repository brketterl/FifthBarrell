# BarrelDex data attribution

**BarrelDex (barreldex.com)** — https://barreldex.com

Dataset source: https://barreldex.com/data/bottles.json

License: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

The user supplied the JSON snapshot and the following provider license text on October 27, 2026:

> The BarrelDex dataset (bottles.json, bottles.csv, states.json), meaning BarrelDex's selection, structure, classifications and notes, is licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). Credit "BarrelDex (barreldex.com)" with a link.

The compilation owner is identified in the user-provided source summary as EVRLAKES DIGITAL LLC. The source site could not be independently fetched in this environment; the license statement above was supplied by the user.

## American Whiskey Review Database bottle metadata

Source: [American Whiskey Review Database — Review Explorer](https://american-whiskey-review-database.streamlit.app/Review_Explorer).

The user supplied `reviews.csv` and confirmed that the provider permits developer data use. No specific standardized license is asserted here, and BarrelDex's CC BY 4.0 license is not applied to this separate source.

`reviews.json` is a derived bottle-lookup snapshot: 17,485 conservative bottle/release candidates grouped from 48,545 CSV rows. The transformation is implemented in `review-catalog.js`. It preserves source identity and release qualifiers, groups repeated observations, and leaves conflicting proof/age values unset with caveats. Reviewer identities, scores, written reviews, and original review links are excluded. Attribution to the Review Explorer accompanies search results. Candidates are not verified unique products, and no endorsement by the source is implied.

`barreldex.json` is the uploaded 254-record snapshot, unchanged. Its per-record source dates, price observations, and caveats are retained. The app creates a search representation with prefixed stable IDs and converts unknown distilleries to blank fields; it does not verify, update, or endorse the underlying facts. Retail prices remain dated reference observations, not MSRP or member purchase costs. No bottle photos, branding assets, or third-party reviews are bundled. No affiliation or endorsement by BarrelDex, distilleries, brands, or state agencies is implied.
