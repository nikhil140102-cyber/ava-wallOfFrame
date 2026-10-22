import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { RecognizeButton } from "./RecognizeButton";

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

const names = (people) =>
  people.length <= 2
    ? people.map((p) => p.name.split(" ")[0]).join(" and ")
    : `${people[0].name.split(" ")[0]} and ${people.length - 1} others`;

export function FrameOfTheDay({ post }) {
  if (!post) return null;
  const photo = post.images?.[0];
  const quote = post.body.length > 180 ? `${post.body.slice(0, 177).trimEnd()}…` : post.body;
  return (
    <section className="fotd" aria-labelledby="fotd-label">
      <div className="fotd-frame" aria-hidden={!photo}>
        <div className="fotd-mat">
          <div className="fotd-print">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt={`Photo shared with the thank-you to ${names(post.recipients)}`} />
            ) : (
              <span className="fotd-quote-art">Thank you, {names(post.recipients)}!</span>
            )}
          </div>
        </div>
      </div>
      <div>
        <span className="fotd-label" id="fotd-label">
          Frame of the day
        </span>
        <blockquote>“{quote}”</blockquote>
        <div className="fotd-who">
          <Avatar name={post.author.name} size={28} />
          <span>
            <b>{post.author.name}</b> thanked <b>{names(post.recipients)}</b>
            {post.value ? ` for ${post.value}` : ""}
          </span>
        </div>
        <div className="fotd-actions">
          <Link className="btn btn-gray" href={`/posts/${post.id}`}>
            Open the post
          </Link>
          <RecognizeButton label="Thank someone too" variant="filled" />
          {post.reactors.length > 0 && (
            <span className="fotd-claps">
              <Icon name="hands" size={15} /> {post.reactors.length} applauded
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
