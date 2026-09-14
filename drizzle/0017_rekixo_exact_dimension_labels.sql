-- REKIXO_EXACT_DIMENSION_LABELS_V4
-- Additive nullable metadata only. No existing project/plot data is rewritten.
ALTER TABLE plots ADD COLUMN front_label TEXT;
ALTER TABLE plots ADD COLUMN depth_label TEXT;
ALTER TABLE plots ADD COLUMN side_dimensions TEXT;
