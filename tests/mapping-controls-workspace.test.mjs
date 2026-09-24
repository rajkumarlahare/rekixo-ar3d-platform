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

test("controls mode removes source/publish-assistant surfaces but keeps mapping canvas and controls", async () => {
  const mapper = await source("../app/plot-mapper.tsx");

  assert.match(mapper, /!controlsWorkspace && \(\s*<div className="card mapper-tools mapper-v2-head">/);
  assert.match(mapper, /cadGeometry && !completedProject && !controlsWorkspace/);
  assert.match(mapper, /!controlsWorkspace && !completedProject && liveMatrix/);
  assert.match(mapper, /<div className="mapper-work mapper-v4-work">/);
  assert.match(mapper, /PLOT MAPPING CONTROLS/);
  assert.match(mapper, /Boundary बदलें/);
  assert.match(mapper, /Dimensions → Front\/Depth/);
  assert.match(mapper, /Swap Front ↔ Depth/);
});

test("Mapping Controls shows explicit safety disclaimer and keeps live publish separate", async () => {
  const [mapper, dashboard, css] = await Promise.all([
    source("../app/plot-mapper.tsx"),
    source("../app/super-admin-dashboard.tsx"),
    source("../app/super-mapper.css"),
  ]);

  assert.match(mapper, /SAFE MAPPING WORKSPACE/);
  assert.match(mapper, /duplicate mapper ya duplicate data store nahi hai/);
  assert.match(mapper, /live customer site tab tak unchanged rehti hai jab tak/);
  assert.match(mapper, /Publish Update nahi kiya jata/);
  assert.match(mapper, /source upload aur publishing controls original\s+Plot Mapper page par hi rahenge/);
  assert.match(dashboard, /tab !== "assets" && tab !== "mapping-controls"/);
  assert.match(css, /REKIXO_MAPPING_CONTROLS_WORKSPACE_V1/);
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
