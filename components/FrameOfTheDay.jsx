import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { RecognizeButton } from "./RecognizeButton";
import { getI18n } from "@/lib/i18n/server";

/**
 * The most-applauded thank-you of the last two weeks, hung like a framed print at the top of Home.
 * Uses the post's photo if it has one, otherwise the message itself in handwriting.
 */
export function pickFrameOfTheDay(feed) {
  const since = Date.now() - 14 * 86_400_000;
  const candidates = feed.filter((p) => p.kind === "appreciation" && p.createdAt >= since);
  if (!candidates.length) return null;
  return candidates.sort(
    (a, b) => b.reactors.length + (b.images?.length ? 1 : 0) - (a.reactors.length + (a.images?.length ? 1 : 0)) || b.createdAt - a.createdAt
  )[0];
}

const firstName = (p) => p.name.split(" ")[0];
const names = (people, t) =>
  people.length === 1
    ? firstName(people[0])
    : people.length === 2
      ? t("fotd.two", { a: firstName(people[0]), b: firstName(people[1]) })
      : people.length === 0
        ? ""
        : t("fotd.andOthers", { a: firstName(people[0]), count: people.length - 1 });

export async function FrameOfTheDay({ post }) {
  if (!post) return null;
  const { t, rich } = await getI18n();
  const who = names(post.recipients, t);
  const photo = post.images?.[0];
  const quote = post.body.length > 180 ? `${post.body.slice(0, 177).trimEnd()}…` : post.body;
  return (
    <section className="fotd" aria-labelledby="fotd-label">
      <div className="fotd-frame" aria-hidden={!photo}>
        <div className="fotd-mat">
          <div className="fotd-print">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt={t("fotd.photoAlt", { names: who })} />
            ) : (
              <span className="fotd-quote-art">{t("fotd.thankYou", { names: who })}</span>
            )}
          </div>
        </div>
      </div>
      <div>
        <span className="fotd-label" id="fotd-label">
          {t("fotd.label")}
        </span>
        <blockquote dir="auto">{t("fotd.quote", { quote })}</blockquote>
        <div className="fotd-who">
          <Avatar name={post.author.name} size={28} />
          <span>
            {rich(t(post.value ? "fotd.thankedFor" : "fotd.thanked"), {
              author: <b>{post.author.name}</b>,
              people: <b>{who}</b>,
              value: post.value,
            })}
          </span>
        </div>
        <div className="fotd-actions">
          <Link className="btn btn-gray" href={`/posts/${post.id}`}>
            {t("fotd.openPost")}
          </Link>
          <RecognizeButton label={t("fotd.thankToo")} variant="filled" />
          {post.reactors.length > 0 && (
            <span className="fotd-claps">
              <Icon name="hands" size={15} /> {t("fotd.applauded", { count: post.reactors.length })}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
