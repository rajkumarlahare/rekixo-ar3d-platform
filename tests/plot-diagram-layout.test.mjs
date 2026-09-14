
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';

const html=fs.readFileSync('public/project/index.html','utf8');
const source=html.slice(html.indexOf('  function validPlotSideEdge('),
  html.indexOf('  function syncFrontDepthFacts('));
const ctx=vm.createContext({cleanDimensionLabel:v=>String(v||'').trim()});
vm.runInContext(source,ctx);
const points=[[0,0],[1,0],[1,1],[0,1]];

test('empty, conflicting and stale side indices are safe',()=>{
  for(const value of [null,undefined,'',' ',false,true,-1,4]){
    assert.equal(ctx.plotSideSemantics({
      points,frontEdgeIndex:value,backEdgeIndex:value
    }),null);
  }
  const valid=ctx.plotSideSemantics({
    points,frontEdgeIndex:0,backEdgeIndex:2,depthEdgeIndex:1,depth2EdgeIndex:3
  });
  assert.equal(JSON.stringify(valid),
    '{"front":[0],"back":[2],"depthA":[1],"depthB":[3]}');
  assert.equal(ctx.plotSideSemantics({
    points,frontEdgeIndex:0,backEdgeIndex:0
  }),null);
  assert.equal(ctx.plotSideSemantics({
    points,frontEdgeIndex:0,backEdgeIndex:2,
    edgeSemantics:JSON.stringify({version:1,pointCount:5,roles:{front:[0],back:[2]}})
  }),null);
});

test('both mapper SQL paths save four sides and preserve sales state',()=>{
  const api=fs.readFileSync('app/api/super-mapper/route.ts','utf8');
  const sqls=[...api.matchAll(/"(INSERT INTO plots [^"\n]+)"/g)].map(m=>m[1]);
  const names=('project_id,id,sqft,sqm,sqyd,dimensions,road,front,depth,back,depth2,'+
    'dimension_unit,front_edge_index,depth_edge_index,back_edge_index,depth2_edge_index,'+
    'front_label,depth_label,back_label,depth2_label,side_dimensions,edge_semantics,'+
    'polygon,status,notes,featured,updated_at').split(',');
  assert.equal(sqls.length,2);
  for(const [index,sql] of sqls.entries()){
    const db=new DatabaseSync(':memory:');
    try{
      db.exec('CREATE TABLE plots ('+names.map(n=>n+' TEXT').join(',')+
        ',PRIMARY KEY(project_id,id))');
      const row=Object.fromEntries(names.map(n=>[n,n+'-old']));
      Object.assign(row,{project_id:'test',id:'test',status:'sold',featured:'1'});
      const values=r=>names.map(n=>r[n]);
      db.prepare(sql).run(...values(row));
      const next={...row,back:'12',depth2:'42',back_label:'12 ft',
        depth2_label:'42 ft',edge_semantics:'new',polygon:'new',
        status:'available',featured:'0'};
      db.prepare(sql).run(...values(next));
      const got=db.prepare('SELECT * FROM plots').get();
      assert.equal(got.back,'12');
      assert.equal(got.depth2,'42');
      assert.equal(got.back_label,'12 ft');
      assert.equal(got.depth2_label,'42 ft');
      assert.equal(got.edge_semantics,'new');
      assert.equal(got.status,'sold');
      assert.equal(got.featured,'1');
      assert.equal(got.polygon,index===0?row.polygon:'new');
    }finally{db.close()}
  }
});
