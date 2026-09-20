import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { panelMode,validAdminSession } from "../../admin-auth";
import LoginForm from "./login-form";
import { clientLoginModeForProject,projectHostRole } from "../../project-context";

export const dynamic="force-dynamic";

function loginError(code:string|undefined){
  if(code==="invalid")return "Login ID ya password galat hai.";
  if(code==="rate")return "Too many attempts. 15 minutes baad try karein.";
  if(code==="origin")return "Login request reject hua. Page reload karke dobara try karein.";
  return "";
}

export default async function LoginPage({searchParams}:{searchParams:Promise<{loginError?:string}>}){
  if(await validAdminSession())redirect("/admin");
  const mode=panelMode();
  let loginType:"email"|"mobile"|"mixed"=mode==="super"?"email":"mixed";
  if(mode==="client"){
    const host=(await headers()).get("host")||"";
    const hostRole=await projectHostRole(host);
    if(hostRole?.projectId)loginType=await clientLoginModeForProject(hostRole.projectId);
  }
  const query=await searchParams;
  return <LoginForm mode={mode} loginType={loginType} initialError={loginError(query.loginError)}/>;
}
