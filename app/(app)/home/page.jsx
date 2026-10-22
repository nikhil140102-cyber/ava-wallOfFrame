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

export const metadata = { title: "Home" };

function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const count = (row) => Number(row?.n ?? 0);

async function onboardingSteps(userId, bio) {
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
    { key: "profile", label: "Add a short bio so people know you", done: bio.trim().length > 0, href: "/settings" },
    { key: "recognize", label: "Thank a teammate for something they did", done: count(given) > 0, action: "recognize" },
    { key: "react", label: "Applaud or comment on a post", done: count(reacted) + count(commented) > 0, href: "/home" },
    { key: "rewards", label: "Look at what your points can buy", done: count(visitedRewards) > 0, href: "/rewards" },
  ];
}

async function tasksFor(user) {
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
        title: `${n} reward ${n === 1 ? "request" : "requests"} to review`,
        detail: "Points are on hold until you decide",
        href: "/admin/rewards",
        cta: "Review",
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
        title: `${n} reported ${n === 1 ? "post" : "posts"}`,
        detail: "Keep or hide from the feed",
        href: "/admin/moderation",
        cta: "Review",
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
          title: `${quiet} of ${team.length} teammates are quiet`,
          detail: "They haven't thanked anyone this month",
          href: "/team",
          cta: "See team",
        });
    }
  }
  return tasks;
}

export default async function HomePage({ searchParams }) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const mine = filter === "me";
  const [feed, top, celebrations, steps, tasks, onThisDay] = await Promise.all([
    getFeed(user.id, mine ? { aboutUserId: user.id } : {}),
    getLeaderboard(30),
    getUpcomingCelebrations(),
    onboardingSteps(user.id, user.bio),
    tasksFor(user),
    getOnThisDay({ userId: user.id, viewer: user }),
  ]);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <div className="caption" style={{ textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>
            {today}
          </div>
          <h1 className="large-title">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
        </div>
        <PageHelp topic="home" />
        <nav className="segmented" aria-label="Feed filter">
          <Link href="/home" aria-selected={!mine} role="tab" className="seg-link">
            Everyone
          </Link>
          <Link href="/home?filter=me" aria-selected={mine} role="tab" className="seg-link">
            Involving Me
          </Link>
        </nav>
      </header>

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
              <h3>Nothing here yet</h3>
              <p>
                {mine
                  ? "When someone recognises you, or you recognise them, it shows up here."
                  : "Be the first to recognise someone this week."}
              </p>
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
                Top this month
              </h2>
              <Link href="/leaderboard" className="caption" style={{ color: "var(--accent)", fontWeight: 600 }}>
                See all
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
            {top.length === 0 && <p className="caption">No points given yet this month.</p>}
          </section>

          {celebrations.length > 0 && (
            <section className="card card-pad">
              <h2 className="headline" style={{ marginBottom: 8 }}>
                Coming up
              </h2>
              {celebrations.map((c) => (
                <div key={c.id} className="rail-row">
                  <Avatar name={c.name} size={32} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{c.name}</b>
                    <span className="caption">
                      {c.years} {c.years === 1 ? "year" : "years"} at the company ·{" "}
                      {c.inDays === 0 ? "today 🎉" : c.inDays === 1 ? "tomorrow" : `in ${c.inDays} days`}
                    </span>
                  </span>
                  {c.id !== user.id && user.can("recognition.give") && <RecognizeButton to={c.id} label="Celebrate" />}
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
