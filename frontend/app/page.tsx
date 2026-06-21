"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import TopBar from "@/components/feed/TopBar";
import Composer from "@/components/feed/Composer";
import PostCard from "@/components/feed/PostCard";
import BottomNav from "@/components/feed/BottomNav";
import EmptyState from "@/components/feed/EmptyState";
import PostSkeleton from "@/components/feed/PostSkeleton";

type Post = {
  _id: string;
  authorId: string;
  content: string;
  createdAt: string;
  imageUrl?: string;
};

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data } = await api.get("/api/posts");
      setPosts(data);
    } catch {
      // si 401 non récupérable, l'intercepteur de lib/api redirige vers /login
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // chargement initial du feed (le fetch diffère ses setState après await)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <TopBar />
      <Composer onPosted={load} />

      <div className="flex-1">
        {loading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          posts.map((p) => <PostCard key={p._id} post={p} />)
        )}
      </div>

      <BottomNav />
    </div>
  );
}
