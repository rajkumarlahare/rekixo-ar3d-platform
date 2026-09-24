import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const [dashboard,pricing,manager,users,css]=await Promise.all([
  read("../app/admin-dashboard.tsx"),
  read("../app/client-plot-pricing.tsx"),
  read("../app/client-admin-manager.tsx"),
  read("../app/api/admin/users/route.ts"),
  read("../app/globals.css"),
]);

test("large plot management lists are bounded in the browser",()=>{
  assert.match(dashboard,/PLOT_PAGE_SIZE=100/);
  assert.match(dashboard,/visiblePlots\.map/);
  assert.match(dashboard,/plotPageCount/);
  assert.match(pricing,/PRICING_PAGE_SIZE = 100/);
  assert.match(pricing,/visiblePlots\.map/);
  assert.match(pricing,/pageCount/);
  assert.match(css,/REKIXO_ADMIN_LIST_PAGER_V1/);
});

test("Super Admin project selectors and archives use bounded server queries",()=>{
  assert.match(users,/section==="project_options"/);
  assert.match(users,/LIMIT \?"/);
  assert.match(users,/section==="archived"/);
  assert.match(users,/LIMIT \? OFFSET \?/);
  assert.match(manager,/Project name search/);
  assert.match(manager,/section=project_options&limit=50/);
  assert.match(manager,/section=archived&limit=/);
  assert.match(manager,/ARCHIVE_PAGE_SIZE = 8/);
});

test("summary endpoint is counts-only rather than full project inventory",()=>{
  const start=users.indexOf('if(section==="summary")');
  const end=users.indexOf('if(section==="project_options")',start);
  const block=users.slice(start,end);
  assert.match(block,/projectCount/);
  assert.match(block,/archivedCount/);
  assert.doesNotMatch(block,/projectQuery/);
  assert.doesNotMatch(block,/archivedQuery/);
});
