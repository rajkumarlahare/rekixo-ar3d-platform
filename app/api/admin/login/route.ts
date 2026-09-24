import { env } from "cloudflare:workers";
import { authenticateAdmin,sameOrigin,sessionCookie } from "@/modules/auth";

const WINDOW=15*60*1000;
const IDENTIFIER_MAX=5;
const IP_MAX=20;
const CLEANUP_AGE=24*60*60*1000;

type LoginInput={
  loginId?:string;
  email?:string;
  password?:string;
  projectId?:string;
  projectSlug?:string;
  successPath?:string;
  changePasswordPath?:string;
  returnPath?:string;
};

type AttemptRow={attempts:number;windowStart:number};

async function digestKey(scope:string,value:string){
  const raw=new TextEncoder().encode(`${scope}:${value}`);
  const hash=await crypto.subtle.digest("SHA-256",raw);
  return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function rateKeys(request:Request,identifier:string){
  const ip=(request.headers.get("cf-connecting-ip")||"unknown").trim().slice(0,96);
  const normalizedIdentifier=identifier.trim().toLowerCase().slice(0,254)||"<empty>";
  const [ipKey,identifierKey]=await Promise.all([
    digestKey("ip",ip),
    digestKey("ip+identifier",`${ip}:${normalizedIdentifier}`),
  ]);
  return {ipKey,identifierKey};
}

function formRequest(request:Request){
  const type=(request.headers.get("content-type")||"").toLowerCase();
  return type.includes("application/x-www-form-urlencoded")||type.includes("multipart/form-data");
}

async function loginInput(request:Request):Promise<{body:LoginInput;nativeForm:boolean}>{
  const nativeForm=formRequest(request);
  if(nativeForm){
    const form=await request.formData();
    return {nativeForm,body:{
      loginId:String(form.get("loginId")||form.get("email")||""),
      email:String(form.get("email")||""),
      password:String(form.get("password")||""),
      projectId:String(form.get("projectId")||""),
      projectSlug:String(form.get("projectSlug")||""),
      successPath:String(form.get("successPath")||""),
      changePasswordPath:String(form.get("changePasswordPath")||""),
      returnPath:String(form.get("returnPath")||""),
    }};
  }
  return {nativeForm:false,body:await request.json().catch(()=>({})) as LoginInput};
}

function safeInternalPath(value:unknown,fallback:string){
  const path=String(value||"").trim();
  if(!path.startsWith("/")||path.startsWith("//")||path.includes("\\")||/[\r\n\0]/.test(path))return fallback;
  return path;
}

function nativeRedirect(request:Request,path:string,errorCode?:string,headers?:HeadersInit){
  const target=new URL(safeInternalPath(path,"/admin/login"),request.url);
  if(errorCode)target.searchParams.set("loginError",errorCode);
  const responseHeaders=new Headers(headers);
  responseHeaders.set("location",target.toString());
  responseHeaders.set("cache-control","no-store");
  return new Response(null,{status:303,headers:responseHeaders});
}

function loginFailure(request:Request,nativeForm:boolean,returnPath:string,error:string,status:number,code:string,headers?:HeadersInit){
  if(nativeForm)return nativeRedirect(request,returnPath||"/admin/login",code,headers);
  const responseHeaders=new Headers(headers);
  responseHeaders.set("cache-control","no-store");
  return Response.json({error},{status,headers:responseHeaders});
}

function blocked(row:AttemptRow|null,now:number,max:number){
  return Boolean(row&&now-row.windowStart<WINDOW&&row.attempts>=max);
}

async function recordFailure(key:string,row:AttemptRow|null,now:number){
  if(!row||now-row.windowStart>=WINDOW){
    await env.DB.prepare("INSERT INTO login_attempts (key, attempts, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts=1, window_start=excluded.window_start").bind(key,now).run();
    return;
  }
  await env.DB.prepare("UPDATE login_attempts SET attempts=attempts+1 WHERE key=?").bind(key).run();
}

export async function POST(request:Request){
  const parsed=await loginInput(request);
  const body=parsed.body;
  const returnPath=safeInternalPath(body.returnPath,"/admin/login");

  if(!sameOrigin(request))return loginFailure(request,parsed.nativeForm,returnPath,"Invalid request origin",403,"origin");

  const identifier=String(body.loginId||body.email||"").trim();
  const password=String(body.password||"");
  const now=Date.now();
  const db=env.DB;
  const host=(request.headers.get("host")||new URL(request.url).host).toLowerCase().split(":")[0];
  const {ipKey,identifierKey}=await rateKeys(request,identifier);

  // Cleanup runs on every login request, not only after a successful login.
  // The window_start index in migration 0030 keeps this bounded as D1 grows.
  await db.prepare("DELETE FROM login_attempts WHERE window_start < ?").bind(now-CLEANUP_AGE).run();

  const [ipRow,identifierRow]=await Promise.all([
    db.prepare("SELECT attempts, window_start AS windowStart FROM login_attempts WHERE key=?").bind(ipKey).first<AttemptRow>(),
    db.prepare("SELECT attempts, window_start AS windowStart FROM login_attempts WHERE key=?").bind(identifierKey).first<AttemptRow>(),
  ]);

  if(blocked(ipRow,now,IP_MAX)||blocked(identifierRow,now,IDENTIFIER_MAX)){
    return loginFailure(
      request,
      parsed.nativeForm,
      returnPath,
      "Too many attempts. 15 minutes baad try karein.",
      429,
      "rate",
      {"retry-after":"900"},
    );
  }

  if(!identifier||!password){
    await recordFailure(ipKey,ipRow,now);
    return loginFailure(request,parsed.nativeForm,returnPath,"Login ID ya password required hai.",400,"invalid");
  }

  const session=await authenticateAdmin(identifier,password,host,{
    projectId:String(body.projectId||""),
    projectSlug:String(body.projectSlug||""),
  });
  if(!session){
    // IP-wide accounting bounds random-identifier abuse: once the IP bucket is
    // exhausted, no further identifier rows are created during the window.
    await Promise.all([
      recordFailure(ipKey,ipRow,now),
      recordFailure(identifierKey,identifierRow,now),
    ]);
    return loginFailure(request,parsed.nativeForm,returnPath,"Login ID ya password galat hai.",401,"invalid");
  }

  await db.batch([
    db.prepare("DELETE FROM login_attempts WHERE key=?").bind(ipKey),
    db.prepare("DELETE FROM login_attempts WHERE key=?").bind(identifierKey),
  ]);

  const cookie=await sessionCookie(session);
  if(parsed.nativeForm){
    const successPath=safeInternalPath(body.successPath,"/admin");
    const changePasswordPath=safeInternalPath(body.changePasswordPath,"/admin/change-password");
    return nativeRedirect(request,session.mustChangePassword?changePasswordPath:successPath,undefined,{"set-cookie":cookie});
  }

  return Response.json(
    {ok:true,mustChangePassword:session.mustChangePassword,user:{name:session.name,loginId:session.loginId||session.email,loginType:session.loginType||"email",role:session.role}},
    {headers:{"set-cookie":cookie,"cache-control":"no-store"}},
  );
}
