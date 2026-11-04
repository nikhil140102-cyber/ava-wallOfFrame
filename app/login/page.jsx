import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/security";
import { LoginForm } from "./LoginForm";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("login.title") };
}

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/home");
  return <LoginForm demo={DEMO_MODE} />;
}
