import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Super Admin adds Mapping Controls directly under Plot Mapper", async () => {
  const dashboard = await source("../app/super-admin-dashboard.tsx");

  assert.match(dashboard, /"mapping-controls"/);
  const mapperIndex = dashboard.indexOf("<MapPinned /> Plot Mapper");
  const controlsIndex = dashboard.indexOf("<SlidersHorizontal /> Mapping Controls");
  const geoIndex = dashboard.indexOf("<Globe2 /> Geo Mapper");
  assert.ok(mapperIndex >= 0, "Plot Mapper nav missing");
  assert.ok(controlsIndex > mapperIndex, "Mapping Controls must follow Plot Mapper");
  assert.ok(geoIndex > controlsIndex, "Mapping Controls must stay before Geo Mapper");
  assert.match(dashboard, /workspaceMode="controls"/);
  assert.match(dashboard, /key={\`mapping-controls:\$\{projectId\}\`}/);
});

test("Mapping Controls reuses the canonical PlotMapper instead of duplicating save logic", async () => {
  const [dashboard, mapper] = await Promise.all([
    source("../app/super-admin-dashboard.tsx"),
    source("../app/plot-mapper.tsx"),
  ]);

  assert.match(dashboard, /<PlotMapper[\s\S]*workspaceMode="controls"/);
  assert.match(mapper, /workspaceMode\?: "full" \| "controls"/);
  assert.match(mapper, /const controlsWorkspace = workspaceMode === "controls"/);
  assert.match(mapper, /fetch\("\/api\/super-mapper"/);
  assert.match(mapper, /async function confirmPlot\(\)/);
  assert.match(mapper, /verifyPlotPersistence\(saved\)/);
  assert.match(mapper, /mappingDraftKey\(projectId, plotId\)/);
  assert.doesNotMatch(dashboard, /api\/mapping-controls/);
});

test("controls mode renders only the existing manual mapping-control card", async () => {
  const mapper = await source("../app/plot-mapper.tsx");

  assert.match(mapper, /function renderMappingControlsCard\(\)/);
  assert.match(mapper, /PLOT MAPPING CONTROLS/);
  assert.match(mapper, /Dimensions → Front\/Depth/);
  assert.match(mapper, /Swap Front ↔ Depth/);
  assert.match(mapper, /Boundary बदलें/);
  assert.match(mapper, /manual size\/details ke liye focused hai/);

  const controlsStart = mapper.indexOf("if (controlsWorkspace) {\n    return (");
  const fullStart = mapper.indexOf("\n  return (\n    <section", controlsStart + 1);
  assert.ok(controlsStart >= 0 && fullStart > controlsStart, "focused controls return missing");
  const controlsBranch = mapper.slice(controlsStart, fullStart);
  assert.match(controlsBranch, /renderMappingControlsCard\(\)/);
  assert.doesNotMatch(controlsBranch, /mapper-work mapper-v4-work/);
  assert.doesNotMatch(controlsBranch, /mapper-precision-canvas/);
  assert.doesNotMatch(controlsBranch, /mapper-source-grid/);
});

test("controls mode starts on mapped plots and stays on the edited plot after save", async () => {
  const mapper = await source("../app/plot-mapper.tsx");

  assert.match(mapper, /const firstMapped = orderedNextPlots\.find\(\(plot\) => Boolean\(plot\.polygon\)\)/);
  assert.match(mapper, /controlsWorkspace \? mappedPlots : inventoryPlots/);
  assert.match(mapper, /loadPlotDetails\(verified\.plot, true\)/);
  assert.match(mapper, /manual details SERVER VERIFIED/);
});

test("Mapping Controls keeps live publishing separate and shows compact inline disclaimer", async () => {
  const [mapper, dashboard, css] = await Promise.all([
    source("../app/plot-mapper.tsx"),
    source("../app/super-admin-dashboard.tsx"),
    source("../app/super-mapper.css"),
  ]);

  assert.match(mapper, /Live customer site Publish Update ke bina change nahi hoti/);
  assert.match(mapper, /Boundary edit ke liye Plot Mapper page use karein/);
  assert.match(dashboard, /tab !== "assets" && tab !== "mapping-controls"/);
  assert.match(css, /REKIXO_MAPPING_CONTROLS_WORKSPACE_V2/);
  assert.doesNotMatch(css, /mapping-controls-safety-note/);
});

test("existing Plot Mapper behavior remains the default", async () => {
  const [mapper, dashboard] = await Promise.all([
    source("../app/plot-mapper.tsx"),
    source("../app/super-admin-dashboard.tsx"),
  ]);

  assert.match(mapper, /workspaceMode = "full"/);
  assert.match(
    dashboard,
    /<PlotMapper key={projectId} projectId={projectId} notify={notify} \/>/,
  );
  assert.match(dashboard, /ProjectStatusThemeManager/);
  assert.match(dashboard, /ProjectPublishPanel projectId={projectId}/);
});
