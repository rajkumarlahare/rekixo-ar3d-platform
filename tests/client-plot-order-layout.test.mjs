import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [dataApi, css] = await Promise.all([
  readFile(new URL("../app/api/data/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("plot inventory uses stable natural numeric ordering before pagination", () => {
  assert.match(dataApi, /REKIXO_PLOT_NATURAL_ORDER_V1/);
  assert.match(dataApi, /GLOB '\[0-9\]\*'/);
  assert.match(dataApi, /NOT GLOB '\*\[\^0-9\]\*'/);
  assert.match(dataApi, /CAST\(\$\{plots\.id\} AS INTEGER\)/);
  assert.match(dataApi, /COLLATE NOCASE/);
  assert.match(dataApi, /\.where\(where\)\.orderBy\(plotNaturalOrder\)\.limit\(limit\)\.offset\(offset\)/);
});

test("Client Admin desktop plot management uses the full content column", () => {
  assert.match(css, /REKIXO_CLIENT_PLOT_DESKTOP_WIDE_V1/);
  assert.match(
    css,
    /@media \(min-width: 901px\)[\s\S]*?\.admin-shell\.role-client-admin \.plots-layout \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(css, /\.admin-shell\.role-client-admin \.plot-list \{[\s\S]*?width: 100%;/);
  assert.match(css, /\.admin-shell\.role-client-admin \.plot-row \{[\s\S]*?minmax\(140px, 170px\)/);
  assert.match(css, /\.admin-shell\.role-client-admin \.client-pricing-editor \{[\s\S]*?grid-column: 1 \/ -1;/);
});

test("Super Admin two-column plot editor and mobile collapse remain intact", () => {
  assert.match(css, /\.plots-layout \{\s*grid-template-columns: 390px 1fr;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.plots-layout \{\s*grid-template-columns: 1fr;/);
});
