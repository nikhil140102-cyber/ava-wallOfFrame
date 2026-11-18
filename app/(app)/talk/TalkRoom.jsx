"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { useI18n } from "@/components/I18nProvider";
import { deleteTalk, postTalk, reportTalk } from "@/app/actions";

const DAY = 86_400_000;
const istDay = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);

function AnonAvatar({ size = 36 }) {
  return (
    <span className="avatar talk-anon" style={{ width: size, height: size }} aria-hidden="true">
      <Icon name="eyeOff" size={Math.round(size * 0.45)} />
    </span>
  );
}

export function TalkRoom({ messages, canModerate }) {
  const { data, toast } = useApp();
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [pending, start] = useTransition();
  const listRef = useRef(null);
  const atBottom = useRef(true);
  const byId = new Map(messages.map((m) => [m.id, m]));
  const nameOf = (m) => (m.anonymous ? t("talk.anonymous") : m.author?.name ?? "");

  // Keep the conversation fresh: check for new messages every 10 seconds while the tab is open.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => clearInterval(id);
  }, [router]);

  // Stay pinned to the newest message unless the reader has scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Jump to a message from a notification link (#m-<id>).
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      atBottom.current = false;
      el.scrollIntoView({ block: "center" });
      el.classList.add("talk-flash");
    }
  }, []);

  function send() {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const r = await postTalk({ body: text, anonymous, replyToId: replyTo?.id ?? null });
      if (!r.ok) return toast(r.error, { tone: "error" });
      setBody("");
      setReplyTo(null);
      atBottom.current = true;
      router.refresh();
    });
  }

  let lastDay = "";
  const today = istDay(Date.now());
  const yesterday = istDay(Date.now() - DAY);

  return (
    <main className="page page-narrow talk-page">
      <header className="page-head">
        <div>
          <h1 className="large-title">{t("talk.title")}</h1>
          <p>{t("talk.subtitle")}</p>
        </div>
      </header>

      <section className="card talk-card">
        <div
          className="talk-list"
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="talk-empty">
              <Icon name="chat" size={28} />
              <p>{t("talk.empty")}</p>
            </div>
          )}
          {messages.map((m) => {
            const day = istDay(m.at);
            const showDay = day !== lastDay;
            lastDay = day;
            const parent = m.replyToId ? byId.get(m.replyToId) : null;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="talk-day" suppressHydrationWarning>
                    <span>{day === today ? t("talk.today") : day === yesterday ? t("talk.yesterday") : fmt.date(m.at, { day: "numeric", month: "long" })}</span>
                  </div>
                )}
                <article id={`m-${m.id}`} className="talk-msg" data-mine={m.mine || undefined} data-anon={m.anonymous || undefined}>
                  {m.anonymous ? (
                    <AnonAvatar />
                  ) : (
                    <Link href={`/people/${m.author.id}`} aria-label={m.author.name}>
                      <Avatar name={m.author.name} size={36} />
                    </Link>
                  )}
                  <div className="talk-bubble">
                    <div className="talk-meta">
                      <b>{nameOf(m)}</b>
                      {m.mine && <span className="tag tag-accent">{m.anonymous ? t("talk.youAnon") : t("talk.you")}</span>}
                      {!m.anonymous && m.author.title && <span className="caption">{m.author.title}</span>}
                      <time className="caption" suppressHydrationWarning>
                        · {fmt.timeAgo(m.at)}
                      </time>
                      {m.reports > 0 && <span className="tag tag-red">{t("talk.reported", { count: m.reports })}</span>}
                    </div>
                    {parent && (
                      <a href={`#m-${parent.id}`} className="talk-quote">
                        <b>{nameOf(parent)}</b> <span dir="auto">{parent.body.slice(0, 120)}</span>
                      </a>
                    )}
                    <p className="talk-body" dir="auto">
                      {m.body}
                    </p>
                    <div className="talk-actions">
                      <button className="btn btn-plain btn-sm" onClick={() => setReplyTo(m)}>
                        {t("talk.reply")}
                      </button>
                      {!m.mine && (
                        <button
                          className="btn btn-plain btn-sm"
                          onClick={async () => {
                            const r = await reportTalk(m.id);
                            toast(r.ok ? t("talk.reportedThanks") : r.error, { tone: r.ok ? "default" : "error" });
                          }}
                        >
                          {t("talk.report")}
                        </button>
                      )}
                      {(m.mine || canModerate) && (
                        <button
                          className="btn btn-plain btn-sm talk-delete"
                          onClick={async () => {
                            const r = await deleteTalk(m.id);
                            if (!r.ok) return toast(r.error, { tone: "error" });
                            router.refresh();
                          }}
                        >
                          {t("talk.delete")}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>

        <div className="talk-composer">
          {replyTo && (
            <div className="talk-replying">
              <Icon name="chat" size={14} />
              <span>{t("talk.replyingTo", { name: nameOf(replyTo) })}</span>
              <button className="icon-btn" onClick={() => setReplyTo(null)} aria-label={t("talk.cancelReply")}>
                <Icon name="x" size={14} />
              </button>
            </div>
          )}
          <div className="talk-postas" role="radiogroup" aria-label={t("talk.postAs")}>
            <span className="caption">{t("talk.postAs")}</span>
            <button type="button" role="radio" aria-checked={!anonymous} className="talk-chip" onClick={() => setAnonymous(false)}>
              <Avatar name={data.me.name} size={20} /> {data.me.name}
            </button>
            <button type="button" role="radio" aria-checked={anonymous} className="talk-chip" onClick={() => setAnonymous(true)}>
              <AnonAvatar size={20} /> {t("talk.anonymous")}
            </button>
          </div>
          {anonymous && <p className="talk-anon-note">{t("talk.anonNote")}</p>}
          <div className="talk-input-row">
            <textarea
              className="field"
              rows={2}
              maxLength={1000}
              value={body}
              placeholder={anonymous ? t("talk.placeholderAnon") : t("talk.placeholder")}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              aria-label={t("talk.placeholder")}
            />
            <button className="btn btn-filled" onClick={send} disabled={pending || !body.trim()}>
              <Icon name="send" size={16} /> {t("talk.send")}
            </button>
          </div>
          <p className="caption talk-hint">{t("talk.hint")}</p>
        </div>
      </section>
    </main>
  );
}
