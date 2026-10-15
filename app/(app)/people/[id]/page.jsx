import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getFeed, getLevels, getPoints, levelFor } from "@/lib/queries";
import { Avatar, LevelPill } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PostCard } from "@/components/PostCard";
import { RecognizeButton } from "@/components/RecognizeButton";
import { AwardBadgeButton } from "./AwardBadgeButton";
import { formatDate, num } from "@/lib/format";

export default async function ProfilePage({ params }) {
  const me = await requireUser();
  const { id } = await params;
  const manager = alias(s.users, "manager");
  const row = await db
    .select({ user: s.users, department: s.departments.name, role: s.roles, managerName: manager.name, managerId: manager.id })
    .from(s.users)
    .innerJoin(s.roles, eq(s.users.roleId, s.roles.id))
    .leftJoin(s.departments, eq(s.users.departmentId, s.departments.id))
    .leftJoin(manager, eq(s.users.managerId, manager.id))
    .where(eq(s.users.id, id))
    .get();
  if (!row) notFound();
  const u = row.user;

  const [levels, points, feed, earned, allBadges, received, given] = await Promise.all([
    getLevels(),
    getPoints([u.id]),
    getFeed(me.id, { aboutUserId: u.id, limit: 20 }),
    db
      .select({ id: s.badges.id, name: s.badges.name, icon: s.badges.icon, color: s.badges.color, at: s.userBadges.awardedAt })
      .from(s.userBadges)
      .innerJoin(s.badges, eq(s.userBadges.badgeId, s.badges.id))
      .where(eq(s.userBadges.userId, u.id))
      .orderBy(desc(s.userBadges.awardedAt)),
    db
      .select({ id: s.badges.id, name: s.badges.name, icon: s.badges.icon, color: s.badges.color, category: s.badges.category })
      .from(s.badges)
      .where(eq(s.badges.active, true)),
    db
      .select({ n: sql`count(*)` })
      .from(s.postRecipients)
      .innerJoin(s.posts, eq(s.posts.id, s.postRecipients.postId))
      .where(and(eq(s.postRecipients.userId, u.id), eq(s.posts.kind, "appreciation")))
      .get(),
    db
      .select({ n: sql`count(*)` })
      .from(s.posts)
      .where(and(eq(s.posts.authorId, u.id), eq(s.posts.kind, "appreciation")))
      .get(),
  ]);
  const pts = points.get(u.id);
  const lvl = levelFor(pts.lifetime, levels);
  const isMe = me.id === u.id;
  const canSeeBalance = isMe || me.can("users.manage");

  return (
    <main className="page">
      <section className="card profile-hero">
        <div className="profile-cover" style={{ background: `linear-gradient(120deg, ${lvl.current.color}, #3355E6 70%, #7C3AED)` }} />
        <div className="profile-main">
          <Avatar name={u.name} size={96} ring={lvl.current.color} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <h1 className="title-1">{u.name}</h1>
              <LevelPill name={lvl.current.name} color={lvl.current.color} />
              {!u.active && <span className="tag tag-red">Deactivated</span>}
            </div>
            <p className="secondary" style={{ marginTop: 2 }}>
              {[u.title, row.department, u.city].filter(Boolean).join(" · ")}
            </p>
            <p className="caption" style={{ marginTop: 4 }}>
              <span style={{ color: row.role.color, fontWeight: 600 }}>{row.role.name}</span> · Joined {formatDate(u.joinedAt)}
              {row.managerId && (
                <>
                  {" "}
                  · Reports to{" "}
                  <Link href={`/people/${row.managerId}`} style={{ color: "var(--accent)" }}>
                    {row.managerName}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {isMe ? (
              <Link href="/settings" className="btn">
                <Icon name="pencil" size={15} /> Edit Profile
              </Link>
            ) : (
              <>
                {me.can("badges.award") && (
                  <AwardBadgeButton userId={u.id} name={u.name} badges={allBadges.filter((b) => !earned.some((e) => e.id === b.id))} />
                )}
                <RecognizeButton to={u.id} variant="filled" />
              </>
            )}
          </div>
        </div>
        {u.bio && <p className="profile-bio">{u.bio}</p>}
      </section>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <span className="caption">Lifetime points</span>
          <b>{num(pts.lifetime)}</b>
          <div className="progress" style={{ marginTop: 8 }}>
            <span style={{ width: `${lvl.progress * 100}%`, background: lvl.current.color }} />
          </div>
          <span className="caption">{lvl.next ? `${num(lvl.toNext)} to ${lvl.next.name}` : "Top level"}</span>
        </div>
        <div className="stat">
          <span className="caption">Appreciations received</span>
          <b>{Number(received?.n ?? 0)}</b>
        </div>
        <div className="stat">
          <span className="caption">Appreciations given</span>
          <b>{Number(given?.n ?? 0)}</b>
        </div>
        <div className="stat">
          <span className="caption">{canSeeBalance ? "Points balance" : "Badges"}</span>
          <b>{canSeeBalance ? num(pts.balance) : earned.length}</b>
          {canSeeBalance && <span className="caption">Only visible to {isMe ? "you" : "admins"}</span>}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 28 }}>
        <section className="stack">
          <h2 className="title-3">Activity</h2>
          {feed.length === 0 ? (
            <div className="card empty">
              <span className="empty-icon">
                <Icon name="sparkles" size={26} />
              </span>
              <h3>No activity yet</h3>
              <p>{isMe ? "Recognise a teammate to get started." : `Be the first to recognise ${u.name.split(" ")[0]}.`}</p>
            </div>
          ) : (
            feed.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </section>
        <aside className="stack sticky-rail">
          <section className="card card-pad">
            <div className="row" style={{ marginBottom: 12 }}>
              <h2 className="headline" style={{ flex: 1 }}>
                Badges
              </h2>
              <span className="caption">
                {earned.length} of {allBadges.length}
              </span>
            </div>
            {earned.length === 0 ? (
              <p className="caption">No badges yet.</p>
            ) : (
              <div className="profile-badges">
                {earned.map((b) => (
                  <Link key={b.id} href={`/badges#${b.id}`} title={`${b.name} · ${formatDate(b.at)}`}>
                    <span className="badge-medal" style={{ width: 48, height: 48, background: b.color }}>
                      <Icon name={b.icon} size={22} />
                    </span>
                    <span className="caption">{b.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
