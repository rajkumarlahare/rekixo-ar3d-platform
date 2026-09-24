
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLOT_PLAYWRIGHT_MODULE).href);
const html=fs.readFileSync('public/project/index.html','utf8');
const css=html.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
const start=html.indexOf('  <div class="diagram">');
const markup=html.slice(start,html.indexOf('  <div class="facts">',start));
const functions=html.slice(html.indexOf('  function setLine('),
  html.indexOf('  // REKIXO_PROJECT_PRICING_UPLOAD_V1'));
const points=[[0,0],[1,0],[1,1],[0,1]];
// Synthetic fixtures; not production plot records.
const fixtures=[
  {id:'RECT',points,frontLabel:'18 ft 11 in',backLabel:'19 ft',
   depthLabel:'North boundary 44 ft 6 in',depth2Label:'South boundary 45 ft',
   frontEdgeIndex:0,backEdgeIndex:2,depthEdgeIndex:1,depth2EdgeIndex:3},
  {id:'NARROW',points:[[0,0],[.1,.02],[.08,1],[0,.96]],
   frontLabel:'L'.repeat(160),backLabel:'पीछे की सीमा '.repeat(10),
   depthLabel:'44 ft',depth2Label:'45 ft',
   frontEdgeIndex:0,backEdgeIndex:2,depthEdgeIndex:1,depth2EdgeIndex:3},
  {id:'LEGACY',points,frontLabel:'Long frontage '.repeat(10),
   depthLabel:'Long depth '.repeat(10),frontEdgeIndex:null,backEdgeIndex:null},
  {id:'EMPTY',points,frontEdgeIndex:null,backEdgeIndex:null}
];
const rotationFixture={
  id:'ROTATION',
  points:[[0,0],[2,0],[2,1],[0,1]],
  frontLabel:'Front 30 ft',backLabel:'Back 30 ft',
  depthLabel:'Depth A 60 ft',depth2Label:'Depth B 60 ft',
  frontEdgeIndex:0,backEdgeIndex:2,depthEdgeIndex:1,depth2EdgeIndex:3,
};
fs.mkdirSync('artifacts/plot-diagram',{recursive:true});
const browser=await chromium.launch();
try{
  for(const width of [320,360,390,768]){
    const page=await browser.newPage({viewport:{width,height:1100}});
    await page.setContent('<style>'+css+'</style><main style="max-width:460px;margin:auto;padding:12px">'+markup+'</main>');
    await page.evaluate('let publicRotation=0;\nconst q=s=>document.querySelector(s);\n'+functions+'\nwindow.draw=diagram;window.setPublicRotation=value=>{publicRotation=value};');
    for(const fixture of fixtures){
      await page.evaluate(p=>{window.setPublicRotation(0);window.draw(p)},fixture);
      const result=await page.evaluate(()=>{
        const box=document.querySelector('.diagram');
        const bounds=box.getBoundingClientRect();
        const svg=box.querySelector('svg').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.diagram-side')];
        const visibleCards=cards.filter(c=>c.getClientRects().length>0);
        const rects=visibleCards.map(c=>c.getBoundingClientRect());
        return {
          overflow:box.scrollWidth>box.clientWidth+1||
            visibleCards.some(c=>c.scrollWidth>c.clientWidth+1),
          outside:rects.some(r=>r.left<bounds.left-1||r.right>bounds.right+1||
            r.bottom>bounds.bottom+1||r.top<svg.bottom-1),
          overlap:rects.some((a,i)=>rects.slice(i+1).some(b=>
            Math.min(a.right,b.right)>Math.max(a.left,b.left)+.5&&
            Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+.5)),
          texts:document.querySelectorAll('#semanticEdgeLabels text').length,
          edges:document.querySelectorAll('#semanticEdgeLabels line').length,
          hidden:document.querySelector('#diagramLegend').hidden,
          values:cards.map(c=>[c.dataset.role,c.querySelector('.diagram-side-value').textContent])
        }
      });
      assert.equal(result.overflow,false,width+' '+fixture.id+' overflow');
      assert.equal(result.outside,false,width+' '+fixture.id+' clipping');
      assert.equal(result.overlap,false,width+' '+fixture.id+' overlap');
      // V11 (2026-09-23) intentionally renders one SVG label plus
      // one offset segment and two endpoint ticks for each logical side.
      const semanticFixture=['RECT','NARROW'].includes(fixture.id);
      assert.equal(result.texts,semanticFixture?4:0);
      assert.equal(result.edges,semanticFixture?12:0);
      for(const [role,key] of [['front','frontLabel'],['back','backLabel'],
        ['depthA','depthLabel'],['depthB','depth2Label']]){
        if(fixture[key])assert.equal(result.values.find(v=>v[0]===role)?.[1],
          fixture[key].replace(/\s+/g,' ').trim());
      }
      if(fixture.id==='EMPTY')assert.equal(result.hidden,true);
      if(width===360)await page.locator('.diagram').screenshot({
        path:'artifacts/plot-diagram/'+fixture.id+'.png'
      });
      console.log('PASS',width,fixture.id);
    }

    if(width===390){
      for(const turn of [0,1,2,3]){
        await page.evaluate(({fixture,turn})=>{
          window.setPublicRotation(turn);
          window.draw(fixture);
        },{fixture:rotationFixture,turn});
        const rotated=await page.evaluate(()=>{
          const poly=document.querySelector('#diagramPoly').getBBox();
          const front=document.querySelector('#semanticEdgeLabels line');
          const x1=Number(front.getAttribute('x1')),x2=Number(front.getAttribute('x2'));
          const y1=Number(front.getAttribute('y1')),y2=Number(front.getAttribute('y2'));
          return{
            width:poly.width,height:poly.height,cx:poly.x+poly.width/2,cy:poly.y+poly.height/2,
            frontX:(x1+x2)/2,frontY:(y1+y2)/2,
            frontVertical:Math.abs(x1-x2)<.5,
            frontHorizontal:Math.abs(y1-y2)<.5,
          }
        });
        assert.equal(rotated.width>rotated.height,turn%2===0,'turn '+turn+' drawer aspect');
        if(turn===0){
          assert.equal(rotated.frontHorizontal,true,'0° front must stay horizontal');
          assert.ok(rotated.frontY<rotated.cy,'0° front must remain above shape');
        }else if(turn===1){
          assert.equal(rotated.frontVertical,true,'90° front must become vertical');
          assert.ok(rotated.frontX>rotated.cx,'90° front must rotate to right side');
        }else if(turn===2){
          assert.equal(rotated.frontHorizontal,true,'180° front must stay horizontal');
          assert.ok(rotated.frontY>rotated.cy,'180° front must rotate below shape');
        }else{
          assert.equal(rotated.frontVertical,true,'270° front must become vertical');
          assert.ok(rotated.frontX<rotated.cx,'270° front must rotate to left side');
        }
        await page.locator('.diagram').screenshot({
          path:'artifacts/plot-diagram/ROTATION-'+(turn*90)+'.png'
        });
        console.log('PASS',width,'ROTATION',turn*90);
      }
    }
    await page.close();
  }
}finally{await browser.close()}
