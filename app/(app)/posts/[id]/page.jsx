import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFeed } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Post" };

export default async function PostPage({ params }) {
  const user = await requireUser();
  const { id } = await params;
  const [post] = await getFeed(user.id, { postId: id, includeHidden: user.can("moderation.manage") });
  if (!post) notFound();
  return (
    <main className="page page-narrow">
      <Link href="/home" className="btn btn-plain" style={{ marginLeft: -8, marginBottom: 12 }}>
        <Icon name="chevronRight" size={16} style={{ transform: "rotate(180deg)" }} /> Home
      </Link>
      <PostCard post={post} expanded />
    </main>
  );
}
