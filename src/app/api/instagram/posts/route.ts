import { NextResponse } from "next/server";
import { loadMapHousePosts } from "@/lib/instagram";

export async function GET() {
  const result = await loadMapHousePosts(120);

  return NextResponse.json(
    {
      ok: true,
      source: result.source,
      count: result.posts.length,
      error: result.error ?? null,
      posts: result.posts,
    },
    {
      status: 200,
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=3600" },
    },
  );
}

