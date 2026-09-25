import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../public/project/index.html", import.meta.url),
  "utf8",
);

test("desktop HUD keeps compact status card at bottom and groups customer actions above zoom controls", () => {
  assert.match(page, /REKIXO_DESKTOP_HUD_LAYOUT_V2/);
  assert.match(page, /@media\(min-width:701px\)\{[\s\S]*?\.status\{[\s\S]*?top:auto;[\s\S]*?bottom:20px;/);
  assert.match(page, /@media\(min-width:701px\)\{[\s\S]*?\.bottom-links\{[\s\S]*?bottom:78px;[\s\S]*?flex-direction:row;/);
  assert.match(page, /@media\(min-width:701px\)\{[\s\S]*?\.controls\{[\s\S]*?bottom:20px;[\s\S]*?flex-direction:row;/);
});

test("desktop status uses vertical reference-card layout instead of horizontal rail", () => {
  const desktopStart = page.indexOf("/* REKIXO_DESKTOP_HUD_LAYOUT_V2");
  const desktopEnd = page.indexOf("/* REKIXO_UI_MOTION_SYSTEM_V1", desktopStart);
  assert.ok(desktopStart >= 0 && desktopEnd > desktopStart);
  const desktop = page.slice(desktopStart, desktopEnd);

  assert.match(desktop, /\.status\{[\s\S]*?width:160px;[\s\S]*?display:block;/);
  assert.match(desktop, /\.status-head,.status\.expanded \.status-head\{[\s\S]*?border-bottom:1px solid rgba\(122,167,255,.16\)/);
  assert.match(desktop, /\.status-body,.status\.expanded \.status-body\{[\s\S]*?max-height:none!important/);
  assert.match(desktop, /\.status-body,.status\.expanded \.status-body\{[\s\S]*?display:block;/);
  assert.match(desktop, /\.status-option,.status\.expanded \.status-option\{[\s\S]*?margin:4px 0 0;[\s\S]*?padding:6px 0/);
  assert.match(desktop, /\.status-body \.status-line\.total\{[\s\S]*?display:flex!important;[\s\S]*?border-top:/);
  assert.doesNotMatch(desktop, /grid-template-columns:102px minmax\(0,1fr\)/);
  assert.doesNotMatch(desktop, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("mobile status contract remains unchanged", () => {
  assert.match(
    page,
    /@media\(max-width:700px\)\{[\s\S]*?\.status\{left:var\(--rekixo-hud-left\);bottom:var\(--rekixo-hud-bottom\)\}/,
  );
  assert.match(
    page,
    /@media\(max-width:700px\)\{[\s\S]*?\.status\{left:10px;top:auto;bottom:10px;width:var\(--status-card-width\);padding:0 10px 10px;/,
  );
  assert.match(
    page,
    /\.bottom-links\{right:calc\(var\(--rekixo-hud-right\) \+ var\(--rekixo-hud-control-size\) \+ var\(--rekixo-hud-column-gap\)\);bottom:var\(--rekixo-hud-bottom\)\}/,
  );
});
