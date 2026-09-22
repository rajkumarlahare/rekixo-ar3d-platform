# A.V Complex - Amritsar onboarding bundle

Prepared: 2026-09-22

## Project identity

- Project: A.V Complex
- Developer / associate: Aery Associates
- Type: SCO commercial complex
- Location: National Highway, Ramtirth to Chheharta, near Dashmesh International School, India Gate, Chheharta, Amritsar, Punjab, India
- Contact 1: 7888301350
- Contact 2: 8146450068
- Source technical sheet: `INDIA GATE PDF.pdf`

## Inventory

The sanctioned/technical sheet contains SCO numbers 1 through 55. The area tables are in square yards. Grouped rows in the source (13-15, 30-31, 32-43, 44-45 and 48-49) have been expanded to individual SCO IDs with the same per-SCO area shown by the plan.

Import-ready canonical data is in `plot-data.csv`.

Known sold SCOs from the client message are tracked separately in `sold-status.csv`:
1, 2, 39, 40 and 52.

## Safety / source rules

- Area values are source-backed.
- Exact road widths, road-facing edge semantics, and complete Front/Back/Depth measurements are intentionally not invented in the canonical CSV.
- Use the original plan as the masterplan/reference surface and map boundaries with the Rekixo front-first workflow.
- After canonical Plot Data import, apply the sold states from `sold-status.csv`.
- Use the standard project Sq.M -> Sq.Ft factor 10.7639 unless the client supplies a project-specific business rule.
- Do not overwrite Sold/Booked state or mapped geometry during later metadata corrections.

## Recommended onboarding order

1. Create client project `A.V Complex`.
2. Fill Project Profile from `project-profile.json`.
3. Upload a high-resolution masterplan image rendered from the original PDF.
4. Upload the AV Complex logo supplied by the client.
5. Import `plot-data.csv`.
6. Upload the original technical PDF as the project reference.
7. Apply sold states: 1, 2, 39, 40, 52.
8. Map plot/SCO polygons and road-facing Front edges from the masterplan.
9. Add a Measurement Manifest only for dimensions that can be verified from the source.
10. Run Plot Data Quality review, preview, then publish.
