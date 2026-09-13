import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../public/project/index.html", import.meta.url), "utf8");

test("brand subtitle is structurally isolated from title and header actions", () => {
  assert.match(page, /REKIXO_RESPONSIVE_BRAND_SUBTITLE_TICKER_V1_1/);
  assert.match(page, /<small class="brand-subtitle" id="brandSubtitle"><span class="brand-subtitle-track" id="brandSubtitleTrack">RAIGARH, CHHATTISGARH<\/span><\/small>/);
  assert.match(page, /\.brandrow\{width:100%;max-width:100%;min-width:0;overflow:hidden\}/);
  assert.match(page, /\.brand\{flex:1 1 0;min-width:0;max-width:100%;overflow:hidden\}/);
  assert.match(page, /\.head-actions\{flex:0 0 auto;flex-shrink:0\}/);
});

test("subtitle is clipped and cannot widen the page", () => {
  assert.match(page, /\.brand-subtitle\{display:block;width:100%;max-width:100%;min-width:0;overflow:hidden;white-space:nowrap;contain:paint\}/);
  assert.match(page, /\.brand-subtitle-track\{display:inline-block;width:max-content;max-width:none;white-space:nowrap;will-change:transform\}/);
});

test("only actual overflow activates measured ping-pong motion", () => {
  assert.match(page, /const overflow=Math\.ceil\(subtitleTrack\.scrollWidth-subtitleLane\.clientWidth\)/);
  assert.match(page, /if\(overflow<=3\)return/);
  assert.match(page, /subtitleTrack\.style\.setProperty\('--rekixo-subtitle-shift',`-\$\{overflow\}px`\)/);
  assert.match(page, /subtitleLane\.classList\.add\('is-overflowing'\)/);
  assert.match(page, /\.brand-subtitle\.is-overflowing \.brand-subtitle-track\{animation:rekixo-subtitle-pan var\(--rekixo-subtitle-duration,8s\) ease-in-out infinite\}/);
  assert.match(page, /@keyframes rekixo-subtitle-pan\{0%,14%,100%\{transform:translate3d\(0,0,0\)\}42%,64%\{transform:translate3d\(var\(--rekixo-subtitle-shift,0px\),0,0\)\}\}/);
});

test("ticker remeasures for project data viewport fonts and layout", () => {
  assert.match(page, /function setBrandSubtitle\(value\)/);
  assert.match(page, /setBrandSubtitle\(\(resolvedAddress\|\|PROJECT_LOCATION\)\.toUpperCase\(\)\)/);
  assert.match(page, /new ResizeObserver\(scheduleBrandSubtitleMotion\)/);
  assert.match(page, /window\.visualViewport\?\.addEventListener\('resize',scheduleBrandSubtitleMotion\)/);
  assert.match(page, /document\.fonts\?\.ready\?\.then\(scheduleBrandSubtitleMotion\)/);
});

test("reduced motion keeps static ellipsis fallback", () => {
  assert.match(page, /const subtitleMotionMQ=window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(page, /if\(subtitleMotionMQ\.matches\)return/);
  assert.match(page, /@media\(prefers-reduced-motion:reduce\)\{\.brand-subtitle-track\{display:block;width:auto;max-width:100%;overflow:hidden;text-overflow:ellipsis;animation:none!important;transform:none!important;will-change:auto\}\}/);
});

test("map geometry remains untouched", () => {
  assert.match(page, /function setMapDimensions\(width,height\)/);
  assert.match(page, /function setSelected\(id\)/);
  assert.match(page, /matrixTransform\(ctm\.inverse\(\)\)/);
  assert.match(page, /const mapped=normalized\.map\(\(\[x,y\]\)=>\[x\*W,y\*H\]\)/);
});
