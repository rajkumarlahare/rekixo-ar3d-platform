# Rekixo New Project Workflow — Production Contract

Date: 2026-09-19
Revision: Plot Measurement V2

This is the canonical workflow for present and future customer plot projects.

## Core rules

- Every project keeps its own masterplan dimensions.
- Plot polygons are stored in normalized 0..1 coordinates.
- The masterplan image is the visual/mapping surface.
- Plot metadata comes from verified source data, never visual proportion guesses.
- Front means the road-facing plot boundary, not screen top/right/bottom/left.
- Side measurements and side identity are separate data. They are bound only when geometry is known.
- Existing geometry, Sold/Booked state and pricing must survive metadata correction imports.

## Normal onboarding path

1. Create client project and admin.
2. Complete Project Profile.
3. Upload the high-resolution masterplan image.
4. Upload project logo.
5. Import verified Plot Data CSV/JSON for plot IDs, authoritative area, road and any known dimensions.
6. When the PDF/image contains side measurements, prepare and upload the AI Measurement Manifest. This may be done immediately or later as a safe backfill.
7. Keep the sanctioned/technical PDF as the project reference.
8. Map normal four-corner plots with the Front-first workflow.
9. Use irregular side assignment only for real exceptions.
10. Confirm Plot Data Quality and source-review counters.
11. Review authenticated preview and publish.

## Area conversion policy

Sq.M -> Sq.Ft is project-scoped.

- Default: 10.7639.
- A customer-specific business rule may override the factor without changing other projects.
- Mangal Raj Park uses 10.76.
- Sq.Yd is derived independently from the standard metric-to-yard conversion; changing Sq.M -> Sq.Ft must not silently redefine Sq.Yd.
- Changing the project Sq.M -> Sq.Ft factor intentionally recalculates stored Sq.Ft from authoritative Sq.M for that project only.

## Verified Plot Data

The existing CSV/JSON schema remains backward compatible. It can contain:

- Plot No / ID
- Sqft and/or Sqm and/or Sqyd
- Dimensions
- Road Access
- Front / Back / Depth A / Depth B
- Dimension Unit (explicit m or ft)
- optional legacy Front Direction
- optional exact labels / Side Dimensions
- Notes

Front Direction is no longer required for the normal manual workflow. It remains a legacy/correction input for older projects and bulk direction-based repair.

## AI Measurement Manifest

This is the preferred safe bridge from a sanctioned PDF/image to side measurements, especially for an already-mapped project.

It supports:

- Plot No / ID
- Front
- Back
- Depth A
- Depth B
- Measurement Unit
- exact display labels
- Road Access
- Side Measurements raw text
- Source Ref / page
- Source Raw Text
- Confidence
- Verified

The importer updates only measurement/road metadata and the additive edge-measurement store. It must not alter polygon geometry, Sold/Booked state, featured state or pricing.

AI should transcribe source facts. It should not invent database edge indices.

## Front-first mapper

For a normal four-corner plot:

1. Tap the first endpoint of the road-facing Front boundary.
2. Tap the second endpoint of that same Front boundary.
3. Continue around the plot in the same clockwise order for the remaining two corners.
4. Rekixo binds:
   - edge 0 = Front
   - edge 1 = Depth A
   - edge 2 = Back
   - edge 3 = Depth B

This binding is independent of screen rotation.

Clone Previous preserves the source plot's semantic edge ordering so cloned geometry does not silently reinterpret Front.

For irregular or corner-road plots, use the explicit edge assigner. Do not guess left/right from screen orientation.

## Edge Measurement V2

The `plot_edge_measurements` table is additive and future-proof.

Each measurement may store:

- role
- segment index
- actual polygon edge index
- polygon point count
- numeric length and unit
- exact raw label
- road-frontage flag
- road access
- source reference/raw source
- confidence
- verification state

The old `front/back/depth/depth2` plot columns remain for backward compatibility. Public rendering prefers V2 edge-specific measurements when available.

This allows future irregular plots where one semantic role can span more than one polygon segment.

## Public customer UI

The plot detail diagram uses the actual saved polygon.

When canonical edge semantics and measurements exist, show the measurement on the corresponding actual edge, for example:

- Front · 9 m
- Back · 10 m
- Depth A · 13.2 m
- Depth B · 13.4 m

Legacy projects still use the safe fallback renderer.

## Import safety

Plot Data preflight:

- rejects duplicate Plot IDs;
- requires Plot ID plus at least one area unit;
- derives missing area units with the current project conversion policy;
- rejects contradictory area columns outside tolerance;
- never silently assumes feet for unitless side measurements;
- validates optional legacy Front Direction;
- reports missing Dimensions, Road Access and four-side measurements.

Missing Front Direction is advisory, not a rich-detail blocker, because Front-first mapping creates canonical side semantics from the actual polygon.

Measurement Manifest import:

- rejects unknown/duplicate Plot IDs;
- requires at least one side measurement/label;
- validates units;
- stores source confidence/verification;
- backfills edge binding when polygon semantics already exist;
- leaves unresolved geometry binding nullable until mapping.

## Quality gates

Super Admin should expose:

- Dimensions complete
- Road Access complete
- 4-side measurements complete
- Front / side binding complete
- mapped side semantics complete
- Measurement Manifest verified count
- Measurement Manifest review count

Low-confidence or unverified source rows remain visible for review instead of being silently treated as trusted.

## Source-of-truth rules

- Masterplan image: mapping/visual surface.
- Plot Data: authoritative inventory and area/business metadata.
- AI Measurement Manifest: source-backed side measurements and evidence.
- DWG/DXF: optional geometry assistant.
- PDF/image: sanctioned reference source.
- D1: live structured/status data.
- R2: source/generated assets.

Never infer an unreadable side length from image proportions.

## Regression rules

Do not reintroduce:

- a global Mangal-specific 10.76 conversion;
- mandatory Front Direction for normal four-corner mapping;
- screen-direction semantics as the definition of Front;
- AI-generated edge indices before polygon geometry exists;
- plot-sheet re-import that resets Sold/Booked or polygons;
- measurement correction that changes status/pricing;
- tenant UUID hardcodes where project-scoped settings are sufficient;
- public dimension labels detached from their actual polygon edge.
