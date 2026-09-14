-- REKIXO_PLOT_FRONT_DEPTH_V1
-- Additive nullable sales-dimension metadata.
-- Existing geometry/status/pricing is intentionally untouched.
ALTER TABLE plots ADD COLUMN front REAL;
ALTER TABLE plots ADD COLUMN depth REAL;
ALTER TABLE plots ADD COLUMN dimension_unit TEXT;
ALTER TABLE plots ADD COLUMN front_edge_index INTEGER;
