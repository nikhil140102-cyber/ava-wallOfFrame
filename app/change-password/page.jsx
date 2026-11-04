import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("security.title") };
}

// People land here after an invite, a password reset by HR, or signing in with a weak password.
export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return <ChangePasswordForm name={user.name} email={user.email} required={user.mustChangePassword} />;
}
