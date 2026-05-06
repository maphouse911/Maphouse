import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ArticleEngagementTracker from "@/components/ArticleEngagementTracker";
import TrackedOutboundLink from "@/components/TrackedOutboundLink";
import {
  contentParagraphs,
  estimateReadMinutes,
  formatPostDate,
  keyTakeaways,
  postSeoDescription,
  postSources,
  relatedPosts,
} from "@/lib/content";
import { loadMapHousePosts, type MapHouseContentPost } from "@/lib/instagram";

type PageProps = {
  params: Promise<{
    postId: string;
  }>;
};

async function resolvePost(decodedId: string): Promise<{ post?: MapHouseContentPost; posts: MapHouseContentPost[] }> {
  const result = await loadMapHousePosts(240);
  const post = result.posts.find((item) => item.id === decodedId);
  return { post, posts: result.posts };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;
  const decodedId = decodeURIComponent(postId);
  const { post } = await resolvePost(decodedId);

  if (!post) {
    return {
      title: "Article Not Found | MapHouse",
      description: "MapHouse topic article unavailable.",
    };
  }

  const description = postSeoDescription(post);
  const title = `${post.title} | MapHouse`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: post.mediaUrl ? [{ url: post.mediaUrl }] : [{ url: "/maphouse-logo.png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.mediaUrl ? [post.mediaUrl] : ["/maphouse-logo.png"],
    },
  };
}

export default async function TopicPostPage({ params }: PageProps) {
  const { postId } = await params;
  const decodedId = decodeURIComponent(postId);
  const { post, posts } = await resolvePost(decodedId);

  if (!post) {
    return (
      <div className="maphouse-shell min-h-screen px-6 py-8 md:px-10">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="paper-card flex items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/maphouse-logo.png"
                alt="MapHouse logo"
                width={38}
                height={38}
                className="rounded-full border border-[var(--line)] bg-white/70"
              />
              <span className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">maphouse_</span>
            </Link>
            <Link href="/topics" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 text-sm">
              Topics
            </Link>
          </header>

          <section className="paper-card p-7 md:p-10">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Post Unavailable</p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">這篇內容目前無法載入</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              這通常是因為 Instagram 暫時限流。請回 Topics 重新整理，或稍後再試一次。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/topics" className="inline-flex rounded-full bg-[var(--brand-ink)] px-4 py-2 text-sm text-white">
                回到 Topics
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const paragraphs = contentParagraphs(post);
  const takeaways = keyTakeaways(post);
  const sources = postSources(post);
  const readMinutes = estimateReadMinutes(post);
  const publishedAt = formatPostDate(post.timestamp);
  const related = relatedPosts(post, posts, 3);
  const coverImage = post.gallery[0] ?? post.mediaUrl;
  const additionalGallery = post.gallery.slice(1);

  return (
    <div className="maphouse-shell min-h-screen px-6 py-8 md:px-10">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <ArticleEngagementTracker postId={post.id} title={post.title} category={post.category} />

        <header className="paper-card flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/maphouse-logo.png"
              alt="MapHouse logo"
              width={38}
              height={38}
              className="rounded-full border border-[var(--line)] bg-white/70"
            />
            <span className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">maphouse_</span>
          </Link>
          <div className="flex gap-2 text-sm">
            <Link href="/map" className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2">
              Interactive Map
            </Link>
            <Link href="/topics" className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2">
              Topics
            </Link>
          </div>
        </header>

        <article className="paper-card overflow-hidden p-0">
          <div className="p-7 md:p-10">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
              <span>{post.category}</span>
              <span>•</span>
              <span>{post.region}</span>
              <span>•</span>
              <span>{readMinutes} min read</span>
            </div>

            <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-tight md:text-5xl">{post.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
              <span>Published: {publishedAt}</span>
              <span>Updated: {publishedAt}</span>
              <span>Source: {post.status === "live" ? "Instagram API" : post.status}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/topics" className="inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm hover:bg-white">
                回到 Topics
              </Link>
              <TrackedOutboundLink
                href={post.permalink}
                className="inline-flex rounded-full bg-[var(--brand-ink)] px-4 py-2 text-sm text-white"
                eventName="ig_outbound_click"
                payload={{ postId: post.id, category: post.category }}
              >
                查看 IG 原文
              </TrackedOutboundLink>
            </div>
          </div>

          {coverImage ? (
            <div className="relative aspect-[16/9] w-full border-y border-[var(--line)] bg-[#e6dece]">
              <Image src={coverImage} alt={post.title} fill sizes="100vw" className="object-cover" />
            </div>
          ) : null}

          <div className="grid gap-6 p-7 md:grid-cols-[1.6fr,0.8fr] md:p-10">
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-3xl">全文內容</h2>
              <div className="mt-4 space-y-5 text-[15px] leading-8 text-[var(--foreground)]">
                {paragraphs.map((paragraph, index) => (
                  <p key={`${post.id}-p-${index}`}>{paragraph}</p>
                ))}
              </div>

              {additionalGallery.length > 0 ? (
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {additionalGallery.map((imageUrl, index) => (
                    <div key={`${post.id}-gallery-${index}`} className="relative aspect-[4/5] overflow-hidden rounded-xl border border-[var(--line)]">
                      <Image src={imageUrl} alt={`${post.title} ${index + 2}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">重點結論</p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--muted)]">
                  {takeaways.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">資料來源</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer" className="text-[var(--foreground)] underline-offset-2 hover:underline">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">研究備註</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  本頁採 MapHouse 編輯格式呈現，資料以公開資料庫與原始圖文內容交叉整理。若後續資料更新，將以最新版本覆蓋。
                </p>
              </section>
            </aside>
          </div>
        </article>

        <section className="paper-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">延伸閱讀</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  {item.category} · {item.region}
                </p>
                <h3 className="mt-2 font-semibold leading-6">
                  <Link href={`/topics/${encodeURIComponent(item.id)}`} className="hover:underline">
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
