import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root=process.cwd();
const port=Number(process.env.REKIXO_BROWSER_PORT||4179);

const typeFor=(path)=>{
  const ext=extname(path).toLowerCase();
  return ext===".html"?"text/html; charset=utf-8":
    ext===".js"?"text/javascript; charset=utf-8":
    ext===".css"?"text/css; charset=utf-8":
    "application/octet-stream";
};

const svg=(label)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#111827"/><text x="600" y="400" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="48">${label}</text></svg>`;

const publicData={
  projectId:"browser-test",
  projectName:"Browser Test Project",
  slug:"browser-test",
  preview:false,
  publishVersion:7,
  adminUrl:"/admin/login",
  platformUrl:"/projects/browser-test",
  engine3d:null,
  settings:{
    projectName:"Browser Test Project",
    brandName:"REKIXO",
    brandShort:"RXP",
    template:"plots",
    accentColor:"#f0b323",
    plotStatusAvailableColor:"#2fbf71",
    plotStatusBookedColor:"#f0a11c",
    plotStatusSoldColor:"#e34d59",
    location:"Browser City",
    address:"Browser Test Road",
    phone1:"+919999999999",
    whatsapp:"+919999999999",
    masterplanName:"browser-masterplan.svg",
    mapWidth:"1200",
    mapHeight:"800",
    publicRotation:"0",
  },
  plots:[
    {
      id:"1",
      sqft:1200,
      sqm:111.48,
      sqyd:133.33,
      dimensions:"30 x 40",
      road:"30 FT ROAD",
      front:30,
      back:30,
      depth:40,
      depth2:40,
      polygon:JSON.stringify([[0.1,0.15],[0.35,0.15],[0.35,0.5],[0.1,0.5]]),
      status:"available",
      featured:false,
    },
  ],
  gallery:[
    {id:"gallery-1",caption:"Browser Site View",filename:"site-view.webp"},
  ],
};

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||"/",`http://127.0.0.1:${port}`);
  if(url.pathname==="/api/public-data"){
    if(url.searchParams.get("projectId")==="paused"){
      res.writeHead(503,{"content-type":"application/json","cache-control":"no-store"});
      res.end(JSON.stringify({error:"Project temporarily unavailable",code:"PROJECT_TEMPORARILY_UNAVAILABLE"}));
      return;
    }
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    res.end(JSON.stringify(publicData));
    return;
  }
  if(url.pathname==="/api/public-status"){
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    res.end(JSON.stringify({projectId:"browser-test",statuses:[{id:"1",status:"sold"}]}));
    return;
  }
  if(url.pathname.startsWith("/api/project-asset/masterplan")){
    res.writeHead(200,{"content-type":"image/svg+xml","cache-control":"no-store"});
    res.end(svg("Masterplan"));
    return;
  }
  if(url.pathname.startsWith("/api/gallery/")){
    res.writeHead(200,{"content-type":"image/svg+xml","cache-control":"no-store"});
    res.end(svg("Gallery"));
    return;
  }
  if(url.pathname==="/favicon.ico"){
    res.writeHead(204);res.end();return;
  }

  const relative=url.pathname==="/"?"project/index.html":url.pathname.replace(/^\/+/, "");
  const safe=normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const path=join(root,"public",safe);
  try{
    const body=await readFile(path);
    res.writeHead(200,{"content-type":typeFor(path),"cache-control":"no-store"});
    res.end(body);
  }catch{
    res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");
  }
});

server.listen(port,"127.0.0.1",()=>{
  process.stdout.write(`browser fixture listening on http://127.0.0.1:${port}\n`);
});

for(const signal of ["SIGINT","SIGTERM"]){
  process.on(signal,()=>server.close(()=>process.exit(0)));
}
