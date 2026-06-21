type Post = {
  _id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likes?: number;
  comments?: number;
  authorName?: string;
  authorHandle?: string;
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

export default function PostCard({ post }: { post: Post }) {
  return (
    <article className="border-b border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-none rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-semibold text-[#1F2937]">
              {post.authorName || "Utilisateur"}
            </span>
            <span className="truncate text-[#6B7280]">@{post.authorHandle || "user"}</span>
            <span className="text-[#6B7280]">· {timeAgo(post.createdAt)}</span>
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-[#1F2937]">{post.content}</p>

          {post.imageUrl && (
            <img src={post.imageUrl} alt="" className="mt-2 w-full rounded-xl border border-gray-200" />
          )}

          <div className="mt-3 flex items-center gap-6 text-sm text-[#6B7280]">
            <button className="flex items-center gap-1 transition hover:text-red-500">
              ♥ <span>{post.likes ?? 0}</span>
            </button>
            <button className="flex items-center gap-1 transition hover:text-[#1565C0]">
              💬 <span>{post.comments ?? 0}</span>
            </button>
            <button className="transition hover:text-[#1565C0]">Répondre</button>
          </div>
        </div>
      </div>
    </article>
  );
}
