import { env } from "cloudflare:workers";
import { clearSessionCookie, requireSuperAdmin, sameOrigin } from "@/modules/auth";

export async function GET(request:Request){
  const url=new URL(request.url),returnTo=url.searchParams.get("returnTo")||"/";
  let location=new URL("/",request.url).toString();
  if(returnTo.startsWith("/")&&!returnTo.startsWith("//"))location=new URL(returnTo,request.url).toString();
  return new Response(null,{status:302,headers:{location,"set-cookie":clearSessionCookie(),"cache-control":"no-store"}});
}

// Emergency/credential-rotation path: invalidate every currently issued owner
// cookie without rotating SESSION_SECRET or affecting client-admin sessions.
export async function POST(request:Request){
  const actor=await requireSuperAdmin();
  if(!actor)return Response.json({error:"Super Admin access required"},{status:403});
  if(!sameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const now=new Date().toISOString();
  await env.DB.prepare("UPDATE super_admin_security SET session_version=session_version+1,updated_at=? WHERE id='owner'").bind(now).run();
  return Response.json(
    {ok:true,allOwnerSessionsRevoked:true},
    {headers:{"set-cookie":clearSessionCookie(),"cache-control":"no-store"}},
  );
}
