import AdminDashboard from "@/modules/client-admin";
import SuperAdminDashboard from "@/modules/super-admin";
import { panelMode,requireAdminSession } from "@/modules/auth";
export const dynamic="force-dynamic";
export default async function AdminPage(){const session=await requireAdminSession();if(panelMode()==="super")return <SuperAdminDashboard user={{name:session.name,email:session.email}}/>;return <AdminDashboard user={{name:session.name,email:session.loginId||session.email,role:"client_admin"}} signOut="/api/admin/logout" projectId={session.projectId}/>}
