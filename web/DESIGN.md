# Wild Orbit

A wildlife discovery observatory: photographs are the subject, the globe is their navigation metaphor.

## Foundations

CSS custom properties in `assets/css/app.css` hold the design:

- `--bg: #090b0d`: ink black.
- `--surface: #141618`: dialog and location panels.
- `--ink: #f2eddf`: warm ivory text.
- `--muted: #b5afa3`: supporting text.
- `--gold: #d4ac67`: thin globe lines, logo, fine labels and quiet controls.
- `--orange: #ee9658`: warm interactive highlights and location links.
- `--violet: #b48aff`: selected discovery mode and visible keyboard focus; use sparingly.
- `--line: #34312a`: quiet dividers.
- `--font-heading`: Space Grotesk, sans-serif. `--font-body`: Archivo, sans-serif.

Use 4/8px spacing increments, generous black space, small tracking on technical labels, and large tightly set headings. Photo corners are 2px, panels 8–12px, orbital controls circular. Photographs use warm paper frames and shadows, with visible location and observer captions. Never use unreadable pale gold as body text.

## Interaction

Six upright, slightly rotated photos overlap the front of a thin gold latitude/longitude globe. Stable outer hit areas raise the hovered photo; focus takes precedence over hover. Hover/focus scale is 1.06 over 180ms. Clicking immediately opens a native dialog; touch needs no hover step.

Grid expands the same context to 24 records, with 24-record increments. The first six remain the same when switching back. Layout transitions use measured positions over 450ms. Grid columns: four desktop, three tablet, two phone. Globe journeys last 900ms; grid fades, stack travels around the edge. There is no idle globe rotation. Sparse gold dust has a pause control.

Modal isolation uses a dark blurred backdrop. Same-species photos update the existing dialog. Its location button explores that point without changing home or layout. Closing restores focus; location jumps focus the updated context label.

Reduced motion disables dust and movement, including enlarged-photo transforms. Missing WebGL or a blocked external module leaves the static gold globe and all discovery features working. Each visible photograph loads independently; image failures get a text fallback.

## Data and privacy

Only stored workshop observations are used. No live climate/weather or geocoding requests. Coordinates stay in browser memory. Country fallback is explicitly an area, not an exact location. Climate discovery compares historical observation temperatures by at least 10°C; it does not claim to classify climates. Local results expand through 250/1,000/2,500km with clear coverage text, then nearest available observations if necessary.

Do not add a framework, build pipeline, extra pages, globe dragging, accounts or uploads to this version.
