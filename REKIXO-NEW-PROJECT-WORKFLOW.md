# Rekixo New Project Workflow — Production Contract

Date: 2026-09-19

This is the canonical workflow for every new customer plot project. It replaces older instructions that normalized all projects to the Tiyansh 1200×2133 plane.

## Core rule

Each project keeps its own masterplan dimensions. Plot polygons are stored as normalized 0..1 coordinates, so source resolution can change without changing geometry. Tiyansh is a locked reference project, not a coordinate template.

## Normal onboarding path

1. Create the client project and admin.
2. Complete Project Profile.
3. Upload the project's high-resolution masterplan image.
4. Upload project logo.
5. Upload **one canonical Plot CSV/JSON** containing the complete verified plot inventory.
6. Keep the sanctioned/technical PDF as the project reference.
7. Map plot polygons on the masterplan, or use reviewed CAD assistance when a usable DWG/DXF exists.
8. Confirm the Plot Data Quality card is complete.
9. Review authenticated preview.
10. Configure Share Builder and publish.

## One canonical Plot CSV

The normal new-project file should contain:

- Plot No / ID
- Sqft and/or Sqm and/or Sqyd
- Dimensions
- Road Access
- Front
- Back
- Depth A
- Depth B
- Dimension Unit (explicitly `m` or `ft`)
- Front Direction (`top`, `right`, `bottom`, or `left` in the published masterplan view)
- optional exact labels
- optional Side Dimensions
- Notes

The downloadable Super Admin Plot CSV template is the schema reference.

### Why Front Direction is in the main file

The mapper stores the road-facing direction before geometry exists. When a polygon is later mapped, Rekixo resolves Front / Back / Depth A / Depth B edges automatically. If geometry already exists when the CSV is imported, Rekixo applies the edge semantics immediately.

Separate **Road Access CSV** and **Side Mapping CSV** are correction tools only. They are not required in the normal onboarding path.

## Import safety

A Plot CSV is preflighted before it is written.

The parser:

- rejects duplicate Plot IDs;
- requires a plot ID plus at least one area unit;
- derives missing area units;
- rejects contradictory supplied Sqft/Sqm/Sqyd values outside the configured tolerance;
- never silently assumes feet when numeric side measurements have no explicit/inferable unit;
- validates Front Direction;
- reports missing Dimensions, Road Access, four-side measurements, and Front Direction;
- identifies generic area-only rows that would make the customer drawer incomplete.

The operator sees the preflight report before import. Imported plot-sheet metadata preserves existing polygon geometry and Booked/Sold status.

## Source-of-truth rules

- **Masterplan image:** visual and mapping surface.
- **Plot CSV/JSON:** authoritative plot metadata.
- **DWG/DXF:** optional engineering geometry assistant; never silently publish guessed matches.
- **PDF:** sanctioned/technical reference. Do not silently OCR-guess unreadable measurements.
- **D1:** live project/status data.
- **R2:** source/generated assets.

When a value cannot be read confidently from a sanctioned source, do not invent it. Leave it for review so the preflight/data-quality gate makes the gap visible before publish.

## Quality gates

Super Admin shows a Plot Data Quality summary for:

- Dimensions
- Road Access
- Front/Back/Depth A/Depth B
- Front Direction
- mapped side semantics

Publish review also reports plot-detail quality warnings. Publishing with warnings requires an explicit operator confirmation. This avoids discovering missing plot detail only after a customer opens the public site.

## Geometry and status safety

Plot-sheet re-import must never silently:

- delete mapped polygons;
- reset Sold/Booked state;
- overwrite pricing;
- change another project's data.

All reads and writes remain project-scoped. The same canonical polygon drives 2D click targets and 3D selection.

## AI / manual data preparation rule

When preparing a CSV from a supplied PDF/image:

1. Read the sanctioned reference at full available resolution.
2. Transcribe plot number, approved area, all printed side lengths, road access, and road-facing direction.
3. Cross-check area conversions mathematically.
4. Never infer an unreadable side length from visual proportions.
5. Run the resulting file through Rekixo preflight before import.
6. Correct every reported gap that is verifiable from the source.
7. Use the public preview as a final visual check, not as the first place errors are discovered.

## Regression rule

Do not reintroduce:

- hard-coded 1200×2133 dimensions for new projects;
- silent `ft` defaults;
- mandatory separate Road Access/Side Mapping files for normal onboarding;
- direct Plot CSV writes without preflight;
- guessed PDF measurements;
- tenant-specific plot metadata hardcodes.
