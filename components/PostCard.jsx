"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Avatar, AvatarStack } from "./Avatar";
import { Icon } from "./Icon";
import { useApp } from "./shell/AppContext";
import { addComment, deleteComment, deletePost, reportPost, toggleReaction } from "@/app/actions";
import { useI18n } from "./I18nProvider";
import styles from "./PostCard.module.css";
import { PostImages } from "./PostImages";

const KIND = {
  appreciation: { label: "post.kind.appreciation", cls: "tag-accent", icon: "sparkles" },
  milestone: { label: "post.kind.milestone", cls: "tag-purple", icon: "flag" },
  announcement: { label: "post.kind.announcement", cls: "tag-orange", icon: "megaphone" },
  badge: { label: "post.kind.badge", cls: "tag-teal", icon: "award" },
};

function Names({ people }) {
  const { fmt } = useI18n();
  const seps = fmt.listSeps(people.length);
  return (
    <>
      {people.map((p, i) => (
        <span key={p.id}>
          {seps[i]}
          <Link href={`/people/${p.id}`} className={styles.name}>
            {p.name}
          </Link>
        </span>
      ))}
      {fmt.listEnd(people.length)}
    </>
  );
}

/** Plain words in a headline are muted; names stay as links. */
function muted(parts) {
  return parts.map((part, i) =>
    typeof part === "string" ? (
      <span key={`m${i}`} className="secondary">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function PostCard({ post, expanded = false }) {
  const { data, can, toast, openRecognize } = useApp();
  const { t, fmt, rich } = useI18n();
  const [, start] = useTransition();
  const [reaction, setReaction] = useOptimistic({ reacted: post.reacted, count: post.reactors.length }, (s) => ({
    reacted: !s.reacted,
    count: s.count + (s.reacted ? -1 : 1),
  }));
  const [showComments, setShowComments] = useState(expanded);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [pop, setPop] = useState(false);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const kind = KIND[post.kind];
  const mine = post.author.id === data.me.id;
  const aboutMe = post.recipients.some((r) => r.id === data.me.id);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  function react() {
    if (!can("feed.comment")) return;
    if (!reaction.reacted) {
      setPop(true);
      setTimeout(() => setPop(false), 450);
    }
    start(async () => {
      setReaction(null);
      const r = await toggleReaction(post.id);
      if (!r.ok) toast(r.error, { tone: "error" });
    });
  }

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    const r = await addComment(post.id, draft);
    setSending(false);
    if (!r.ok) return toast(r.error, { tone: "error" });
    setDraft("");
  }

  const headline =
    post.kind === "appreciation" ? (
      <>
        {muted(
          rich(t("post.headline.appreciated"), {
            author: <Names people={[post.author]} />,
            people: <Names people={post.recipients} />,
          })
        )}
      </>
    ) : post.kind === "badge" && !post.recipients?.length && post.badge?.name ? (
      <>
        <Names people={[post.author]} /> <span className="secondary">· {t("memories.earned", { badge: post.badge.name })}</span>
      </>
    ) : post.kind === "badge" ? (
      <>
        {muted(
          rich(t("post.headline.awardedBadge"), {
            author: <Names people={[post.author]} />,
            people: <Names people={post.recipients} />,
          })
        )}
      </>
    ) : (
      <Names people={[post.author]} />
    );

  return (
    <article className={`card ${styles.post}`} data-hidden={post.hidden || undefined} data-me={aboutMe || undefined}>
      <header className={styles.head}>
        <Link href={`/people/${post.author.id}`} aria-hidden tabIndex={-1}>
          <Avatar name={post.author.name} size={40} />
        </Link>
        <div className={styles.headText}>
          <div className={styles.headline}>{headline}</div>
          <div className="caption">
            <Link href={`/posts/${post.id}`} className={styles.time}>
              {fmt.timeAgo(post.createdAt)}
            </Link>
            {post.author.title && ` · ${post.author.title}`}
          </div>
        </div>
        <span className={`tag ${kind.cls}`}>
          <Icon name={kind.icon} size={12} stroke={2.2} /> {t(kind.label)}
        </span>
        <div className={styles.menuWrap} ref={menuRef}>
          <button className="icon-btn" aria-label={t("post.menu.more")} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <Icon name="more" size={18} />
          </button>
          {menu && (
            <div className="popover" style={{ right: 0, top: 40 }} role="menu">
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => (
                  navigator.clipboard?.writeText(`${location.origin}/posts/${post.id}`),
                  toast(t("post.toast.linkCopied")),
                  setMenu(false)
                )}
              >
                <Icon name="copy" size={16} /> {t("post.menu.copyLink")}
              </button>
              {post.recipients.length > 0 && can("recognition.give") && !aboutMe && (
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => (setMenu(false), openRecognize(post.recipients.map((r) => r.id).filter((id) => id !== data.me.id)))}
                >
                  <Icon name="sparkles" size={16} /> {t("post.menu.recognizeToo")}
                </button>
              )}
              {!mine && (
                <button className="menu-item" role="menuitem" onClick={() => (setMenu(false), setReporting(true))}>
                  <Icon name="flag" size={16} /> {t("post.menu.report")}
                </button>
              )}
              {(mine || can("moderation.manage")) && (
                <>
                  <div className="menu-sep" />
                  <button
                    className="menu-item"
                    role="menuitem"
                    style={{ color: "var(--red)" }}
                    onClick={async () => {
                      setMenu(false);
                      const r = await deletePost(post.id);
                      toast(r.ok ? t("post.toast.deleted") : r.error, { tone: r.ok ? "default" : "error" });
                    }}
                  >
                    <Icon name="trash" size={16} /> {t("post.menu.delete")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {post.hidden && (
        <p className={styles.hiddenNote}>
          <Icon name="eyeOff" size={14} /> {t("post.hiddenNotice")}
        </p>
      )}

      <p className={styles.body} dir="auto">{post.body}</p>
      <PostImages images={post.images} />

      {(post.value || post.badge?.name || post.pointsEach > 0) && (
        <div className={styles.meta}>
          {post.value && (
            <span className="tag tag-accent">
              <Icon name="hash" size={12} stroke={2.2} /> {post.value}
            </span>
          )}
          {post.badge?.name && (
            <span
              className="tag"
              style={{ background: `color-mix(in srgb, ${post.badge.color} 14%, transparent)`, color: post.badge.color ?? undefined }}
            >
              <Icon name={post.badge.icon ?? "award"} size={12} stroke={2.2} /> {post.badge.name}
            </span>
          )}
          {post.pointsEach > 0 && (
            <span className="tag tag-orange num">
              <Icon name="points" size={12} stroke={2.2} />{" "}
              {t(post.recipients.length > 1 ? "post.pointsEach" : "post.points", { points: fmt.num(post.pointsEach) })}
            </span>
          )}
        </div>
      )}

      <footer className={styles.actions}>
        <button
          className={styles.action}
          aria-pressed={reaction.reacted}
          onClick={react}
          disabled={!can("feed.comment")}
          aria-label={reaction.reacted ? t("post.reaction.remove") : t("post.reaction.add")}
        >
          <span className={styles.clap} data-pop={pop || undefined}>
            👏
          </span>
          <span className="num">{reaction.count || ""}</span>
        </button>
        <button
          className={styles.action}
          onClick={() => (setShowComments(!showComments), setTimeout(() => inputRef.current?.focus(), 50))}
          aria-expanded={showComments}
        >
          <Icon name="chat" size={17} />
          <span className="num">{post.comments.length || ""}</span>
        </button>
        {post.reactors.length > 0 && (
          <span className={styles.reactors}>
            <AvatarStack names={post.reactors.map((r) => r.name)} size={20} />
            <span className="caption">
              {post.reactors
                .slice(0, 2)
                .map((r) => (r.id === data.me.id ? t("post.reaction.you") : r.name.split(" ")[0]))
                .join(", ")}
              {post.reactors.length > 2 ? ` ${t("post.reaction.more", { count: post.reactors.length - 2 })}` : ""}
            </span>
          </span>
        )}
      </footer>

      {showComments && (
        <div className={styles.comments}>
          {post.comments.map((c) => (
            <div key={c.id} className={styles.comment}>
              <Avatar name={c.author.name} size={28} />
              <div className={styles.bubble}>
                <div>
                  <Link href={`/people/${c.author.id}`} className={styles.name}>
                    {c.author.name}
                  </Link>{" "}
                  <span className="caption">{fmt.timeAgo(c.createdAt)}</span>
                </div>
                <p dir="auto">{c.body}</p>
              </div>
              {(c.author.id === data.me.id || can("moderation.manage")) && (
                <button
                  className="icon-btn"
                  aria-label={t("post.comments.delete")}
                  style={{ width: 28, height: 28 }}
                  onClick={async () => {
                    const r = await deleteComment(c.id);
                    if (!r.ok) toast(r.error, { tone: "error" });
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          ))}
          {can("feed.comment") && (
            <div className={styles.compose}>
              <Avatar name={data.me.name} size={28} />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t("post.comments.placeholder")}
                aria-label={t("post.comments.placeholder")}
                maxLength={500}
              />
              <button
                className="icon-btn"
                onClick={send}
                disabled={!draft.trim() || sending}
                aria-label={t("post.comments.send")}
                style={{ color: draft.trim() ? "var(--accent)" : undefined }}
              >
                <Icon name="send" size={17} />
              </button>
            </div>
          )}
        </div>
      )}

      {reporting && <ReportDialog postId={post.id} onClose={() => setReporting(false)} />}
    </article>
  );
}

function ReportDialog({ postId, onClose }) {
  const { toast } = useApp();
  const { t } = useI18n();
  // `value` is what moderators see in reports, kept in English so reports read the same whatever language the reporter uses.
  const reasons = [
    { key: "post.report.reason.inappropriate", value: "Not appropriate for the recognition feed" },
    { key: "post.report.reason.private", value: "Contains private or sensitive information" },
    { key: "post.report.reason.harassment", value: "Harassment or unkind content" },
    { key: "post.report.reason.other", value: "Something else" },
  ];
  const [reason, setReason] = useState(reasons[0].value);
  const [pending, setPending] = useState(false);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="sheet"
        style={{ width: "min(420px, calc(100vw - 32px))" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <div className="sheet-body">
          <h2 id="report-title" className="title-3" style={{ textAlign: "center" }}>
            {t("post.report.title")}
          </h2>
          <p className="subhead" style={{ textAlign: "center", marginTop: 6 }}>
            {t("post.report.help")}
          </p>
          <div className="group" style={{ marginTop: 16, boxShadow: "none", background: "var(--fill-2)" }}>
            {reasons.map((r) => (
              <button
                key={r.value}
                className="group-item"
                onClick={() => setReason(r.value)}
                role="radio"
                aria-checked={reason === r.value}
              >
                <span style={{ flex: 1, fontSize: 14 }}>{t(r.key)}</span>
                {reason === r.value && <Icon name="check" size={16} stroke={2.6} style={{ color: "var(--accent)" }} />}
              </button>
            ))}
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn btn-gray" style={{ flex: 1 }} onClick={onClose}>
            {t("post.report.cancel")}
          </button>
          <button
            className="btn btn-filled btn-destructive"
            style={{ flex: 1 }}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const r = await reportPost(postId, reason);
              toast(r.ok ? (r.message ?? t("post.report.done")) : r.error, { tone: r.ok ? "default" : "error" });
              onClose();
            }}
          >
            {t("post.report.submit")}
          </button>
        </div>
      </div>
    </>
  );
}
