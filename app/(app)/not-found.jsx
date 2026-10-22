import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="page page-narrow">
      <div className="card empty">
        <span className="empty-icon">
          <Icon name="search" size={26} />
        </span>
        <h3>{t("common.notFound.title")}</h3>
        <p>{t("common.notFound.body")}</p>
        <Link href="/home" className="btn btn-tinted" style={{ marginTop: 8 }}>
          {t("common.backToHome")}
        </Link>
      </div>
    </main>
  );
}
