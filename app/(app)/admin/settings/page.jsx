import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { CompanySettings } from "./CompanySettings";

export const metadata = { title: "Company Settings" };

export default async function CompanySettingsPage() {
  await requirePermission("settings.manage");
  const [settings, values] = await Promise.all([getSettings(), db.select().from(s.companyValues).orderBy(s.companyValues.name)]);
  return <CompanySettings settings={settings} values={values} />;
}
