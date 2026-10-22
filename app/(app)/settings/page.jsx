import { requireUser } from "@/lib/auth";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { SettingsForm } from "./SettingsForm";
import { PageHelp } from "@/components/PageHelp";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("settings.title") };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const allowed = PERMISSION_GROUPS.flatMap((g) => g.items.filter((i) => user.permissions.has(i.key)).map((i) => i.label));
  return (
    <main className="page page-narrow">
      <header className="page-head">
        <div>
          <h1 className="large-title">{t("settings.title")}</h1>
          <p>{user.email}</p>
        </div>
        <PageHelp topic="settings" />
      </header>
      <SettingsForm
        profile={{ title: user.title, bio: user.bio, city: user.city }}
        theme={user.theme}
        emailNotifications={user.emailNotifications}
        role={{ name: user.role.name, color: user.role.color }}
        allowed={allowed}
      />
    </main>
  );
}
