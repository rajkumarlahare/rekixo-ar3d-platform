import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Mangal Raj Park alone gets the configured amenities page", () => {
  const html = read("public/project/index.html");

  assert.match(html, /id="amenitiesModal"/);
  assert.match(html, /Mangal Raj Park/);
  assert.match(html, /Project Amenities/);
  assert.match(html, /Light Supply — All Plots/);
  assert.match(html, /Underground Drainage/);
  assert.match(html, /Cement Concrete Road/);
  assert.match(html, /Compound Wall/);

  assert.match(html, /function isMangalRajPark\(\)/);
  assert.match(html, /name==='mangal raj park'\|\|name\.startsWith\('mangal raj park '\)/);
  assert.match(html, /if\(!isMangalRajPark\(\)\)\{toast\('Amenities details not configured'\);return\}/);
  assert.match(html, /q\('#amenitiesBtn'\)\.onclick=openAmenities/);
});

test("amenities page is responsive, dismissible and does not change other project behavior", () => {
  const html = read("public/project/index.html");

  assert.match(html, /\.amenities-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /@media\(max-width:560px\)[\s\S]*\.amenities-grid\{grid-template-columns:1fr/);
  assert.match(html, /amenitiesClose\.onclick=closeAmenities/);
  assert.match(html, /if\(e\.target===amenitiesModal\)closeAmenities\(\)/);
  assert.match(html, /else if\(amenitiesModal\.classList\.contains\('open'\)\)closeAmenities\(\)/);
  assert.match(html, /amenitiesButton\.dataset\.configured=mangalAmenities\?'true':'false'/);
});
