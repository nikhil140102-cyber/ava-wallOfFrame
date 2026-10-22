import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFeed, getLeaderboard, getUpcomingCelebrations } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";
import { HomeComposer } from "@/components/HomeComposer";
import { LevelCard } from "@/components/LevelCard";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RecognizeButton } from "@/components/RecognizeButton";
import { GettingStarted } from "@/components/GettingStarted";
import { NeedsYou } from "@/components/NeedsYou";
import { PageHelp } from "@/components/PageHelp";
import { and, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getActivity } from "@/lib/analytics";
import { getOnThisDay } from "@/lib/memories";
import { OnThisDay } from "@/components/OnThisDay";
import { FrameOfTheDay, pickFrameOfTheDay } from "@/components/FrameOfTheDay";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("home.title") };
}

function greeting(t, name) {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return t(h < 12 ? "home.greeting.morning" : h < 17 ? "home.greeting.afternoon" : "home.greeting.evening", { name });
}

const count = (row) => Number(row?.n ?? 0);

async function onboardingSteps(t, userId, bio) {
  const [given, reacted, commented, visitedRewards] = await Promise.all([
    db
      .select({ n: sql`count(*)` })
      .from(s.posts)
      .where(and(eq(s.posts.authorId, userId), eq(s.posts.kind, "appreciation")))
      .get(),
    db
      .select({ n: sql`count(*)` })
      .from(s.reactions)
      .where(eq(s.reactions.userId, userId))
      .get(),
    db
      .select({ n: sql`count(*)` })
      .from(s.comments)
      .where(eq(s.comments.authorId, userId))
      .get(),
    db
      .select({ n: sql`count(*)` })
      .from(s.redemptions)
      .where(eq(s.redemptions.userId, userId))
      .get(),
  ]);
  return [
    { key: "profile", label: t("home.steps.profile"), done: bio.trim().length > 0, href: "/settings" },
    { key: "recognize", label: t("home.steps.recognize"), done: count(given) > 0, action: "recognize" },
    { key: "react", label: t("home.steps.react"), done: count(reacted) + count(commented) > 0, href: "/home" },
    { key: "rewards", label: t("home.steps.rewards"), done: count(visitedRewards) > 0, href: "/rewards" },
  ];
}

async function tasksFor(t, user) {
  const tasks = [];
  if (user.can("rewards.manage")) {
    const n = count(
      await db
        .select({ n: sql`count(*)` })
        .from(s.redemptions)
        .where(eq(s.redemptions.status, "pending"))
        .get()
    );
    if (n)
      tasks.push({
        key: "rewards",
        icon: "gift",
        tint: "var(--orange)",
        title: t("home.tasks.rewards.title", { count: n }),
        detail: t("home.tasks.rewards.detail"),
        href: "/admin/rewards",
        cta: t("home.tasks.review"),
      });
  }
  if (user.can("moderation.manage")) {
    const n = count(
      await db
        .select({ n: sql`count(distinct ${s.reports.postId})` })
        .from(s.reports)
        .where(eq(s.reports.status, "open"))
        .get()
    );
    if (n)
      tasks.push({
        key: "reports",
        icon: "flag",
        tint: "var(--red)",
        title: t("home.tasks.reports.title", { count: n }),
        detail: t("home.tasks.reports.detail"),
        href: "/admin/moderation",
        cta: t("home.tasks.review"),
      });
  }
  if (user.can("team.view")) {
    const team = await db
      .select({ id: s.users.id })
      .from(s.users)
      .where(and(eq(s.users.managerId, user.id), eq(s.users.active, true)));
    if (team.length) {
      const act = await getActivity(30);
      const quiet = team.filter((m) => !act.given.get(m.id)).length;
      if (quiet)
        tasks.push({
          key: "team",
          icon: "users",
          tint: "var(--teal)",
          title: t("home.tasks.team.title", { count: quiet, total: team.length }),
          detail: t("home.tasks.team.detail"),
          href: "/team",
          cta: t("home.tasks.seeTeam"),
        });
    }
  }
  return tasks;
}

export default async function HomePage({ searchParams }) {
  const user = await requireUser();
  const { t, fmt } = await getI18n();
  const { filter } = await searchParams;
  const mine = filter === "me";
  const [feed, top, celebrations, steps, tasks, onThisDay] = await Promise.all([
    getFeed(user.id, mine ? { aboutUserId: user.id } : {}),
    getLeaderboard(30),
    getUpcomingCelebrations(),
    onboardingSteps(t, user.id, user.bio),
    tasksFor(t, user),
    getOnThisDay({ userId: user.id, viewer: user }),
  ]);
  const today = fmt.date(Date.now(), { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <main className="page">
      <header className="page-head">
        <div className="home-greet">
          <span className="home-date">{today}</span>
          <h1 className="large-title">{greeting(t, user.name.split(" ")[0])}</h1>
        </div>
        <PageHelp topic="home" />
        <nav className="segmented" aria-label={t("home.feedFilter")}>
          <Link href="/home" aria-selected={!mine} role="tab" className="seg-link">
            {t("home.filter.everyone")}
          </Link>
          <Link href="/home?filter=me" aria-selected={mine} role="tab" className="seg-link">
            {t("home.filter.me")}
          </Link>
        </nav>
      </header>

      {!mine && <FrameOfTheDay post={pickFrameOfTheDay(feed)} />}

      <div className="grid-2">
        <div className="stack">
          <GettingStarted steps={steps} />
          <OnThisDay groups={onThisDay} />
          <HomeComposer />
          {feed.length === 0 ? (
            <div className="card empty">
              <span className="empty-icon">
                <Icon name="sparkles" size={26} />
              </span>
              <h3>{t("home.empty.title")}</h3>
              <p>{mine ? t("home.empty.mine") : t("home.empty.everyone")}</p>
            </div>
          ) : (
            feed.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>

        <aside className="stack sticky-rail">
          <NeedsYou tasks={tasks} />
          <LevelCard />

          <section className="card card-pad">
            <div className="row" style={{ marginBottom: 8 }}>
              <h2 className="headline" style={{ flex: 1 }}>
                {t("home.top.title")}
              </h2>
              <Link href="/leaderboard" className="caption" style={{ color: "var(--accent)", fontWeight: 600 }}>
                {t("home.top.seeAll")}
              </Link>
            </div>
            {top.slice(0, 5).map((p, i) => (
              <Link key={p.id} href={`/people/${p.id}`} className="rail-row">
                <span className="rank" data-rank={i + 1}>
                  {i + 1}
                </span>
                <Avatar name={p.name} size={32} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{p.name}</b>
                  <span className="caption">{p.department}</span>
                </span>
                <span className="num caption" style={{ fontWeight: 600, color: "var(--label)" }}>
                  {p.points}
                </span>
              </Link>
            ))}
            {top.length === 0 && <p className="caption">{t("home.top.empty")}</p>}
          </section>

          {celebrations.length > 0 && (
            <section className="card card-pad">
              <h2 className="headline" style={{ marginBottom: 8 }}>
                {t("home.comingUp")}
              </h2>
              {celebrations.map((c) => (
                <div key={c.id} className="rail-row">
                  <Avatar name={c.name} size={32} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{c.name}</b>
                    <span className="caption">
                      {t("home.anniversary", { count: c.years })} ·{" "}
                      {c.inDays === 0
                        ? t("home.when.today")
                        : c.inDays === 1
                          ? t("home.when.tomorrow")
                          : t("home.when.inDays", { count: c.inDays })}
                    </span>
                  </span>
                  {c.id !== user.id && user.can("recognition.give") && <RecognizeButton to={c.id} label={t("home.celebrate")} />}
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
