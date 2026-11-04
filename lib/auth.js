import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { readSession } from "./session";
import { ALL_PERMISSIONS, SUPER_ADMIN_ONLY } from "./permissions";
import { clientIp, logSecurity } from "./security";

async function loadUser(id, sv) {
  const row = await db
    .select({
      user: schema.users,
      role: schema.roles,
      department: schema.departments.name,
    })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .leftJoin(schema.departments, eq(schema.users.departmentId, schema.departments.id))
    .where(eq(schema.users.id, id))
    .get();
  if (!row || !row.user.active) return null;
  // Signed in before a password change / reset / sign-out-everywhere → this cookie no longer counts.
  if (sv !== undefined && sv !== (row.user.sessionVersion ?? 0)) return null;
  // Super Admin is the escape hatch: it always holds every permission, even if edited.
  const isSuperAdmin = row.role.name === "Super Admin";
  const perms = new Set(isSuperAdmin ? ALL_PERMISSIONS : row.role.permissions.filter((p) => !SUPER_ADMIN_ONLY.includes(p)));
  const { passwordHash: _omit, ...user } = row.user;
  return {
    ...user,
    department: row.department ?? "",
    role: { id: row.role.id, name: row.role.name, color: row.role.color },
    isSuperAdmin,
    permissions: perms,
    can: (p) => perms.has(p),
  };
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  return loadUser(session.id, session.sv);
});

/** Use in pages. People who must pick a new password are sent to /change-password first. */
export async function requireUser({ allowPasswordChange = false } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !allowPasswordChange) redirect("/change-password");
  return user;
}

/** Use in pages: redirects people without the permission to Home. */
export async function requirePermission(p) {
  const user = await requireUser();
  if (!user.can(p)) redirect("/home?denied=1");
  return user;
}

/** Use in server actions: throws instead of redirecting so the client gets an error. */
export async function assertPermission(p) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You need to sign in again.");
  if (user.mustChangePassword) throw new Error("Choose a new password first.");
  if (!user.can(p)) {
    await logSecurity("permission_denied", { email: user.email, userId: user.id, ip: await clientIp(), detail: p });
    throw new Error("You don't have permission to do that.");
  }
  return user;
}
