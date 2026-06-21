"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function Composer({ onPosted }: { onPosted?: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const MAX = 280;
  const over = content.length > MAX;
  const empty = !content.trim();

  async function publish() {
    if (empty || over) return;
    setLoading(true);
    try {
      await api.post("/api/posts", { content });
      setContent("");
      onPosted?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-none rounded-full bg-gray-200" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Quoi de neuf ?"
          rows={2}
          className="w-full resize-none text-[#1F2937] placeholder:text-[#9CA3AF] outline-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between pl-12">
        <span className={`text-sm ${over ? "text-red-500" : "text-[#6B7280]"}`}>
          {content.length} / {MAX}
        </span>
        <button
          onClick={publish}
          disabled={loading || empty || over}
          className="rounded-lg bg-[#1565C0] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Publier
        </button>
      </div>
    </div>
  );
}
