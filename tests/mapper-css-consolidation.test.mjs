import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [superCss,globalCss,sideCss,layout]=await Promise.all([
  readFile(new URL("../app/super-mapper.css",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  readFile(new URL("../app/mapper-side-controls.css",import.meta.url),"utf8"),
  readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),
]);

test("normal and fullscreen toolbar share one canonical parity block",()=>{
  assert.match(superCss,/REKIXO_MAPPER_TOOLBAR_PARITY_V2/);
  const legacyStart=superCss.indexOf("REKIXO_FOCUS_TOOLBAR_ACTIONS_V1");
  const parityStart=superCss.indexOf("/* REKIXO_MAPPER_TOOLBAR_PARITY_V2");
  const legacy=superCss.slice(legacyStart,parityStart);
  assert.doesNotMatch(legacy,/\.mapper-v4-canvas:fullscreen \.mapper-v4-toolbar\{/);
  assert.doesNotMatch(legacy,/\.mapper-focus-primary-action\{[\s\S]*display:none/);
  assert.match(legacy,/safe-area-inset-bottom/);
});

test("side dock has no earlier transform-none conflict",()=>{
  assert.doesNotMatch(
    globalCss,
    /\.mapper-v4-canvas:fullscreen \.mapper-side-dock\{[^}]*transform:none!important/,
  );
  assert.match(
    sideCss,
    /\.mapper-v4-canvas:fullscreen \.plot-side-assigner \{[\s\S]*transform: translateX\(-50%\) !important/,
  );
});

test("side-control file remains last mapper CSS import",()=>{
  const globals=layout.indexOf('import "./globals.css"');
  const mapper=layout.indexOf('import "./super-mapper.css"');
  const side=layout.indexOf('import "./mapper-side-controls.css"');
  assert.ok(globals>=0&&mapper>globals&&side>mapper);
});
