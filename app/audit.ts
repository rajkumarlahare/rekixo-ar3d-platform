import { env } from "cloudflare:workers";

export async function writeAudit(actor:{id:string;email:string;loginId?:string},action:string,projectId:string|null,targetId:string|null,details:Record<string,unknown>={}){
  const actorIdentity=actor.loginId||actor.email;
  await env.DB.prepare("INSERT INTO audit_logs (id,actor_id,actor_email,action,project_id,target_id,details,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),actor.id,actorIdentity,action,projectId,targetId,JSON.stringify(details),new Date().toISOString()).run();
}
