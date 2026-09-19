import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../public/project/index.html", import.meta.url),
  "utf8",
);

test("desktop HUD keeps status at bottom and groups customer actions above zoom controls", () => {
  assert.match(page, /REKIXO_DESKTOP_HUD_LAYOUT_V1/);
  assert.match(page, /@media\(min-width:701px\)\{[\s\S]*?\.status\{[\s\S]*?top:auto;[\s\S]*?bottom:20px;/);
  assert.match(page, /@media\(min-width:701px\)\{[\s\S]*?\.bottom-links\{[\s\S]*?bottom:78px;[\s\S]*?flex-direction:row;/);
  assert.match(page, /@media\(min-width:701px\)\{[\s\S]*?\.controls\{[\s\S]*?bottom:20px;[\s\S]*?flex-direction:row;/);
});

test("desktop status is a readable horizontal bar while mobile contract remains untouched", () => {
  assert.match(page, /grid-template-columns:102px minmax\(0,1fr\)/);
  assert.match(page, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(page, /@media\(max-width:700px\)[\s\S]*?\.status\{left:var\(--rekixo-hud-left\);bottom:var\(--rekixo-hud-bottom\)\}/);
  assert.match(page, /\.bottom-links\{right:calc\(var\(--rekixo-hud-right\) \+ var\(--rekixo-hud-control-size\) \+ var\(--rekixo-hud-column-gap\)\);bottom:var\(--rekixo-hud-bottom\)\}/);
});
