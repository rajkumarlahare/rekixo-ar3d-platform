import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { normalizeHost } from "./domain-utils";
import {
  loginCandidates,
  type ClientLoginType,
} from "./client-login-identity";
import {
  PLATFORM_ADMIN_SCOPE_ID,
  legacyTiyanshClientHostAllowed,
} from "./legacy-tiyansh-compat";

const COOKIE="tiyansh_admin";
const enc=new TextEncoder(),dec=new TextDecoder();
const cfg=()=>env as unknown as Record<string,string>;
export const panelMode=()=>cfg().PANEL_MODE==="super"?"super":"client";
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const b64url=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const fromB64url=(value:string)=>bytes(value.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((value.length+3)%4));

export type AdminRole="super_admin"|"client_admin";
export type AdminSession={
  id:string;
  name:string;
  email:string;
  loginId?:string;
  loginType?:ClientLoginType;
  role:AdminRole;
  projectId:string;
  sessionVersion:number;
  mustChangePassword:boolean;
  exp:number;
};

async function signature(body:string){
  const key=await crypto.subtle.importKey("raw",bytes(cfg().SESSION_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(body))));
}

async function verifyPassword(password:string,saltB64:string,hashB64:string){
  const salt=bytes(saltB64),expected=bytes(hashB64);
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const actual=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256));
  if(actual.length!==expected.length)return false;
  let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];
  return diff===0;
}

export async function hashAdminPassword(password:string){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const hash=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256));
  return {passwordSalt:btoa(String.fromCharCode(...salt)),passwordHash:btoa(String.fromCharCode(...hash))};
}

async function clientAdminHostAllowed(projectId:string,legacyAdminHost:string|null,host?:string){
  if(!host)return true;
  const normalized=normalizeHost(host),shared=normalizeHost(cfg().CLIENT_SHARED_ADMIN_HOST||""),fallback=normalizeHost(cfg().CLIENT_FALLBACK_HOST||""),platform=normalizeHost(cfg().CLIENT_PLATFORM_HOST||"");
  if(normalized&&[shared,fallback,platform].filter(Boolean).includes(normalized))return true;
  if(legacyTiyanshClientHostAllowed(projectId,normalized))return true;
  if(legacyAdminHost&&normalizeHost(legacyAdminHost)===normalized)return true;
  const row=await env.DB.prepare("SELECT host FROM project_domains WHERE project_id=? AND host=? AND status='active' AND kind IN ('admin','both') LIMIT 1").bind(projectId,normalized).first();
  return Boolean(row);
}

type ClientAuthRow={
  id:string;
  email:string;
  loginType:ClientLoginType;
  loginId:string|null;
  mobile:string|null;
  name:string;
  role:AdminRole;
  projectId:string;
  passwordHash:string;
  passwordSalt:string;
  sessionVersion:number;
  mustChangePassword:number;
  status:string;
  projectStatus:string;
  adminHost:string|null;
  projectSlug:string;
};

export async function authenticateAdmin(identifier:string,password:string,host?:string,scope?:{projectId?:string;projectSlug?:string}):Promise<AdminSession|null>{
  const candidates=loginCandidates(identifier),now=Date.now();
  const mode=panelMode();
  if(mode==="super"&&candidates.email&&candidates.email===cfg().ADMIN_EMAIL?.toLowerCase()&&await verifyPassword(password,cfg().ADMIN_PASSWORD_SALT,cfg().ADMIN_PASSWORD_HASH))return {id:"owner",name:"Rekixo Super Admin",email:candidates.email,loginId:candidates.email,loginType:"email",role:"super_admin",projectId:PLATFORM_ADMIN_SCOPE_ID,sessionVersion:1,mustChangePassword:false,exp:now+8*60*60*1000};
  if(mode!=="client")return null;
  const rows=await env.DB.prepare("SELECT u.id,u.email,u.login_type AS loginType,u.login_id AS loginId,u.mobile,u.name,u.role,u.project_id AS projectId,u.password_hash AS passwordHash,u.password_salt AS passwordSalt,u.session_version AS sessionVersion,u.must_change_password AS mustChangePassword,u.status,p.status AS projectStatus,p.admin_host AS adminHost,p.slug AS projectSlug FROM admin_users u JOIN projects p ON p.id=u.project_id WHERE u.login_id=? OR u.login_id=? OR ((u.login_type='email' OR u.login_type IS NULL) AND lower(u.email)=?) LIMIT 2").bind(candidates.email,candidates.mobile,candidates.email).all<ClientAuthRow>();
  if(rows.results.length!==1)return null;
  const row=rows.results[0];
  if(row.role!=="client_admin"||row.status!=="active"||row.projectStatus!=="active")return null;
  const requestedProjectId=String(scope?.projectId||"").trim(),requestedProjectSlug=String(scope?.projectSlug||"").trim().toLowerCase();
  if(requestedProjectId&&row.projectId!==requestedProjectId)return null;
  if(requestedProjectSlug&&row.projectSlug.toLowerCase()!==requestedProjectSlug)return null;
  if(!(await clientAdminHostAllowed(row.projectId,row.adminHost,host))||!(await verifyPassword(password,row.passwordSalt,row.passwordHash)))return null;
  const timestamp=new Date().toISOString();
  await env.DB.prepare("UPDATE admin_users SET last_login_at=?,updated_at=? WHERE id=?").bind(timestamp,timestamp,row.id).run();
  const loginType:ClientLoginType=row.loginType==="mobile"?"mobile":"email";
  const loginId=row.loginId||(loginType==="mobile"?row.mobile:row.email)||row.email;
  return {id:row.id,name:row.name,email:row.email,loginId,loginType,role:"client_admin",projectId:row.projectId,sessionVersion:row.sessionVersion,mustChangePassword:Boolean(row.mustChangePassword),exp:now+8*60*60*1000};
}

export async function getAdminSession():Promise<AdminSession|null>{
  const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;
  const [body,sig]=token.split(".");if(!body||!sig||sig!==await signature(body))return null;
  let session:AdminSession;try{session=JSON.parse(dec.decode(fromB64url(body))) as AdminSession}catch{return null}
  if(!session.id||!session.email||!session.role||!session.projectId||session.exp<Date.now())return null;
  const mode=panelMode();
  if(session.role==="super_admin"&&session.id==="owner")return mode==="super"?{...session,loginId:session.loginId||session.email,loginType:"email"}:null;
  if(mode!=="client")return null;
  const row=await env.DB.prepare("SELECT u.name,u.email,u.login_type AS loginType,u.login_id AS loginId,u.mobile,u.role,u.project_id AS projectId,u.session_version AS sessionVersion,u.must_change_password AS mustChangePassword,u.status,p.status AS projectStatus FROM admin_users u JOIN projects p ON p.id=u.project_id WHERE u.id=? LIMIT 1").bind(session.id).first<{name:string;email:string;loginType:ClientLoginType;loginId:string|null;mobile:string|null;role:AdminRole;projectId:string;sessionVersion:number;mustChangePassword:number;status:string;projectStatus:string}>();
  if(!row||row.role!=="client_admin"||row.status!=="active"||row.projectStatus!=="active"||row.email!==session.email||row.sessionVersion!==session.sessionVersion)return null;
  const loginType:ClientLoginType=row.loginType==="mobile"?"mobile":"email";
  const loginId=row.loginId||(loginType==="mobile"?row.mobile:row.email)||row.email;
  return {...session,name:row.name,loginId,loginType,role:"client_admin",projectId:row.projectId,mustChangePassword:Boolean(row.mustChangePassword)};
}

export async function validAdminSession(){return getAdminSession()}
export async function requireAdminSession(){const session=await getAdminSession();if(!session)redirect("/admin/login");if(session.mustChangePassword)redirect("/admin/change-password");return session}
export async function requireSuperAdmin(){const session=await getAdminSession();return panelMode()==="super"&&session?.role==="super_admin"&&session.id==="owner"?session:null}
export async function sessionCookie(session:AdminSession){const body=b64url(enc.encode(JSON.stringify(session)));return `${COOKIE}=${body}.${await signature(body)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`}
export const clearSessionCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export function sameOrigin(request:Request){const origin=request.headers.get("origin");if(!origin)return false;try{return new URL(origin).host===new URL(request.url).host}catch{return false}}
