# Bottle enjoyment ratings

## Problem and recommendation

The cabinet's original required preference list combines liking (Favorite, Just OK), usage (Daily Drinker), and purchase intent (Do not Buy Again). These are different questions: a daily pour can be loved, and a loved bottle can be too expensive to buy again. This is a heuristic finding from the interface, not an observed user-study result.

Use an optional five-point personal enjoyment rating: 1 Dislike, 2 Not for me, 3 Like it, 4 Really like it, 5 Love it. The labels are proposed product language and need validation. Unrated is distinct from a low score. Whole stars offer quick comparison without requiring precise judgments. Keep the existing preference values as optional tags to preserve members' records. Do not infer stars from those tags or from event tasting scores.

The cabinet rating belongs to the bottle's member. Event tastings retain their separate 1–10 enjoyment scores and context; no automatic conversion or averaging is introduced. Favorites counts continue to use the Favorite tag.

## Secondary research

- Nielsen Norman Group, [Rating Scales in UX Research](https://www.nngroup.com/articles/rating-scales/): rating questions measure degrees of attitude; scale wording and format influence interpretation. This supports asking one clear enjoyment question. It does not establish that five stars is best for bourbon collectors.
- W3C APG, [Rating Radio Group Example](https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio-rating/): demonstrates ratings as mutually exclusive choices with keyboard interaction and accessible names, and recommends semantic HTML. The implementation uses native labeled radio inputs, visible text for every score, and a selectable Unrated option.

## Alternatives considered

- Existing preference dropdown alone: quick, but categories mix dimensions and do not provide consistent ordering.
- Thumbs up/down: faster, but cannot separate a decent pour from a standout.
- 10- or 100-point cabinet score: more granularity, but asks for finer distinctions. The detailed event journal already supports 1–10 scoring.
- Stars plus a separate buy-again decision: promising future option, but validate demand before adding another required decision. Current preference tags remain optional during this iteration.

## Lightweight HCD validation plan (not yet conducted)

Recruit 5–6 members with varied whiskey experience. Ask each to add an untasted bottle, rate a bottle they like, distinguish a daily pour from a special favorite, find their top bottles, and change or clear an old rating. Include mobile and keyboard use. Avoid explaining the labels before they attempt the tasks.

Observe completion, hesitation, accidental selections, and whether participants can distinguish enjoyment, preference tags, and event scores. Ask what 3 versus 4 means to them and whether price affected the answer. Compare five labeled stars with three choices (Dislike / Like / Love). Revise labels or simplify the scale if members cannot use them consistently. Ask separately whether a buy-again field would help actual purchase decisions.

## Implemented behavior

New and existing bottles start with no numeric rating; legacy preferences are preserved. Members can choose or clear stars while adding/editing bottles. Cards and details display the score and meaning. Filters support exact scores, 4 and up, and unrated bottles; highest-rated sorting places unrated bottles last. API validation accepts only whole stars 1–5 or no rating, and SQLite adds a nullable column without rewriting legacy records. JSON exports include stars through the existing state export.
