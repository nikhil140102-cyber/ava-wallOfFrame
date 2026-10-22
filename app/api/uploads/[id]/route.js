import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth";

// Serves post photos to signed-in people only — this is an internal company app.
export async function GET(_req, { params }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to see this photo.", { status: 401 });
  const { id } = await params;
  const img = await db
    .select({
      postId: s.postImages.postId,
      memoryId: s.postImages.memoryId,
      uploaderId: s.postImages.uploaderId,
      mime: s.postImages.mime,
      data: s.postImages.data,
    })
    .from(s.postImages)
    .where(eq(s.postImages.id, id))
    .get();
  if (!img) return new Response("Not found", { status: 404 });
  if (!img.postId && !img.memoryId && img.uploaderId !== user.id) return new Response("Not found", { status: 404 });
  if (img.memoryId && !img.postId) {
    // Private Memory Wall photos: only the person, whoever added it, and HR / Super Admin.
    const m = await db
      .select({ userId: s.memories.userId, createdById: s.memories.createdById, private: s.memories.private })
      .from(s.memories)
      .where(eq(s.memories.id, img.memoryId))
      .get();
    if (m?.private && m.userId !== user.id && m.createdById !== user.id && !user.can("users.manage"))
      return new Response("Not found", { status: 404 });
  }
  if (img.postId) {
    const post = await db
      .select({ hidden: s.posts.hidden, authorId: s.posts.authorId })
      .from(s.posts)
      .where(eq(s.posts.id, img.postId))
      .get();
    if (post?.hidden && post.authorId !== user.id && !user.can("moderation.manage")) return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
