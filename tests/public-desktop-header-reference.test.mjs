import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../public/project/index.html", import.meta.url),
  "utf8",
);

test("desktop header uses balanced left-brand centered-search right-actions layout", () => {
  assert.match(page, /REKIXO_DESKTOP_HEADER_REFERENCE_V1/);
  const start = page.indexOf("/* REKIXO_DESKTOP_HEADER_REFERENCE_V1");
  const end = page.indexOf("/* MOBILE REFINEMENT", start);
  assert.ok(start >= 0 && end > start);
  const desktop = page.slice(start, end);

  assert.match(desktop, /@media\(min-width:901px\)/);
  assert.match(desktop, /grid-template-columns:minmax\(0,1fr\) minmax\(340px,420px\) minmax\(0,1fr\)/);
  assert.match(desktop, /\.search\{[\s\S]*?grid-column:2;[\s\S]*?justify-self:center/);
  assert.match(desktop, /\.head-actions\{[\s\S]*?position:absolute;[\s\S]*?right:20px;[\s\S]*?top:50%/);
  assert.match(desktop, /\.header-whatsapp\{[\s\S]*?background:#13c968/);
});

test("desktop header has Call, grid/admin and built-in WhatsApp in that order", () => {
  const headerStart = page.indexOf('<header class="header">');
  const headerEnd = page.indexOf("</header>", headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart);
  const header = page.slice(headerStart, headerEnd);
  const call = header.indexOf('id="callTop"');
  const grid = header.indexOf('id="outlineTop"');
  const whatsapp = header.indexOf('id="waTop"');
  assert.ok(call >= 0 && grid > call && whatsapp > grid);
  assert.match(header, /id="waTop"[\s\S]*?>[\s\S]*?<span>WhatsApp<\/span>/);
});

test("desktop subtitle is clipped to its brand lane and moves continuously only when overflowing", () => {
  assert.match(page, /\.brand\{[\s\S]*?max-width:360px;[\s\S]*?overflow:hidden/);
  assert.match(page, /\.brand-subtitle\{display:block;[\s\S]*?overflow:hidden;white-space:nowrap/);
  assert.match(page, /\.brand-subtitle\.is-desktop-marquee \.brand-subtitle-track\{[\s\S]*?linear infinite/);
  assert.match(page, /\.brand-subtitle\.is-desktop-marquee \.brand-subtitle-track::after\{[\s\S]*?content:attr\(data-marquee-text\)/);
  assert.match(page, /subtitleTrack\.dataset\.marqueeText=text/);
});

test("mobile header remains on its existing compact contract and does not show top WhatsApp", () => {
  assert.match(page, /\.header-whatsapp\{display:none\}/);
  assert.match(page, /@media\(max-width:700px\)\{[\s\S]*?\.header\{padding:7px 10px 9px;box-shadow:0 4px 16px #0006\}/);
  assert.match(page, /@media\(max-width:700px\)\{[\s\S]*?\.brandmark\{width:42px;height:42px/);
  assert.match(page, /@media\(max-width:700px\)\{[\s\S]*?\.search\{height:47px;margin-top:8px/);
  assert.doesNotMatch(
    page.match(/@media\(max-width:700px\)\{[\s\S]*?\n\}/)?.[0] || "",
    /\.header-whatsapp\{[\s\S]*?display:(?:flex|inline-flex)/,
  );
});

test("header presentation change does not alter map geometry contracts", () => {
  assert.match(page, /function setMapDimensions\(width,height\)/);
  assert.match(page, /matrixTransform\(ctm\.inverse\(\)\)/);
  assert.match(page, /const mapped=normalized\.map\(\(\[x,y\]\)=>\[x\*W,y\*H\]\)/);
});
