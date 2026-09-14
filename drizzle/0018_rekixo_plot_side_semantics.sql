-- REKIXO_PLOT_SIDE_SEMANTICS_V1
-- Additive only. Existing plots/projects are not rewritten.
ALTER TABLE plots ADD COLUMN back REAL;
ALTER TABLE plots ADD COLUMN depth2 REAL;
ALTER TABLE plots ADD COLUMN back_edge_index INTEGER;
ALTER TABLE plots ADD COLUMN depth2_edge_index INTEGER;
ALTER TABLE plots ADD COLUMN back_label TEXT;
ALTER TABLE plots ADD COLUMN depth2_label TEXT;
ALTER TABLE plots ADD COLUMN edge_semantics TEXT;
