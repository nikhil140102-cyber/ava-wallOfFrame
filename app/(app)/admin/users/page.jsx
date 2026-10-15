import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { UserAdmin } from "./UserAdmin";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requirePermission("users.manage");
  const [users, roles, depts, settings] = await Promise.all([
    db
      .select({
        id: s.users.id,
        name: s.users.name,
        email: s.users.email,
        title: s.users.title,
        roleId: s.users.roleId,
        departmentId: s.users.departmentId,
        managerId: s.users.managerId,
        employeeCode: s.users.employeeCode,
        phone: s.users.phone,
        city: s.users.city,
        birthday: s.users.birthday,
        joinedAt: s.users.joinedAt,
        active: s.users.active,
        lastSeenAt: s.users.lastSeenAt,
      })
      .from(s.users)
      .orderBy(s.users.name),
    db
      .select({ id: s.roles.id, name: s.roles.name, color: s.roles.color, permissions: s.roles.permissions })
      .from(s.roles)
      .orderBy(s.roles.name),
    db.select().from(s.departments).orderBy(s.departments.name),
    getSettings(),
  ]);
  // With "Manage roles" you can edit anyone and assign any role. HR (without it) can edit everyone except the
  // Super Admin, and assign any role except Super Admin or a role that can manage roles.
  const lockedRoleIds = me.can("roles.manage")
    ? []
    : roles.filter((r) => r.name === "Super Admin" || r.permissions.includes("roles.manage")).map((r) => r.id);
  const assignable = roles.filter((r) => !lockedRoleIds.includes(r.id)).map((r) => r.id);
  return (
    <UserAdmin
      meId={me.id}
      users={users.map((u) => ({
        ...u,
        joinedAt: u.joinedAt.getTime(),
        lastSeenAt: u.lastSeenAt?.getTime() ?? null,
        editable: u.id === me.id || !lockedRoleIds.includes(u.roleId),
      }))}
      welcomeBonus={settings.rules.welcome.on ? settings.rules.welcome.points : 0}
      roles={roles.map(({ permissions: _p, ...r }) => r)}
      depts={depts}
      assignable={assignable}
    />
  );
}
