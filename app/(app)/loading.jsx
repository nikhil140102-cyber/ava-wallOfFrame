// Shown instantly while a page loads, so navigation never feels stuck.
import { getI18n } from "@/lib/i18n/server";

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <main className="page" aria-busy="true" aria-label={t("common.loading")}>
      <div className="skeleton" style={{ width: 120, height: 12, marginBottom: 10 }} />
      <div className="skeleton" style={{ width: 320, height: 34, marginBottom: 28 }} />
      <div className="grid-2">
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card card-pad">
              <div className="row">
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: "50%", height: 12 }} />
                  <div className="skeleton" style={{ width: "25%", height: 10, marginTop: 8 }} />
                </div>
              </div>
              <div className="skeleton" style={{ width: "100%", height: 12, marginTop: 16 }} />
              <div className="skeleton" style={{ width: "70%", height: 12, marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div className="stack">
          <div className="card card-pad">
            <div className="skeleton" style={{ width: 84, height: 84, borderRadius: "50%" }} />
            <div className="skeleton" style={{ width: "100%", height: 52, marginTop: 16, borderRadius: 12 }} />
          </div>
        </div>
      </div>
    </main>
  );
}
