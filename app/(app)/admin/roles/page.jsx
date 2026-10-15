import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { RoleEditor } from "./RoleEditor";

export const metadata = { title: "Roles & Permissions" };

export default async function RolesPage() {
  const me = await requirePermission("roles.manage");
  const [roles, users] = await Promise.all([
    db.select().from(s.roles).orderBy(s.roles.createdAt),
    db.select({ id: s.users.id, name: s.users.name, roleId: s.users.roleId }).from(s.users).orderBy(s.users.name),
  ]);
  return (
    <RoleEditor
      myRoleId={me.role.id}
      groups={PERMISSION_GROUPS.map((g) => ({
        group: g.group,
        items: g.items.map((i) => ({ key: i.key, label: i.label, hint: i.hint, superAdminOnly: !!i.superAdminOnly })),
      }))}
      roles={roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        color: r.color,
        isSystem: r.isSystem,
        permissions: r.permissions,
        members: users.filter((u) => u.roleId === r.id).map((u) => ({ id: u.id, name: u.name })),
      }))}
    />
  );
}
