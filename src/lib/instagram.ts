import { igPosts, type TopicCategory } from "@/app/data";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

type GraphChildMedia = {
  media_url?: string;
  thumbnail_url?: string;
};

type GraphMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  children?: { data?: GraphChildMedia[] };
};

type GraphMediaResponse = {
  data?: GraphMedia[];
  paging?: { next?: string };
};

type InstagramPublicProfileResponse = {
  data?: {
    user?: {
      id?: string;
    };
  };
};

type InstagramPublicImageCandidate = {
  url?: string;
  width?: number;
  height?: number;
};

type InstagramPublicCaption = {
  text?: string;
};

type InstagramPublicCarouselMedia = {
  image_versions2?: {
    candidates?: InstagramPublicImageCandidate[];
  };
};

type InstagramPublicMediaItem = {
  id?: string;
  code?: string;
  caption?: InstagramPublicCaption;
  media_type?: number;
  image_versions2?: {
    candidates?: InstagramPublicImageCandidate[];
  };
  carousel_media?: InstagramPublicCarouselMedia[];
  taken_at?: number;
};

type InstagramPublicFeedResponse = {
  items?: InstagramPublicMediaItem[];
  more_available?: boolean;
  next_max_id?: string;
};

export type MapHouseContentPost = {
  id: string;
  title: string;
  caption: string;
  category: TopicCategory;
  region: string;
  summary: string;
  sourceYear: string;
  status: "imported" | "live";
  permalink: string;
  mediaType: string;
  mediaUrl?: string;
  gallery: string[];
  timestamp: string;
};

export type MapHouseContentResult = {
  source: "live" | "public" | "fallback";
  posts: MapHouseContentPost[];
  error?: string;
};

type RuntimeEnv = {
  graphVersion: string;
  igUserId?: string;
  accessToken?: string;
  publicUsername: string;
  publicWebAppId: string;
};

let localEnvCache: { loadedAt: number; values: Map<string, string> } | null = null;
const LOCAL_ENV_CACHE_TTL_MS = 5000;
const SNAPSHOT_PATH = path.join(process.cwd(), ".cache", "instagram-posts.json");

async function readLocalEnv() {
  const now = Date.now();
  if (localEnvCache && now - localEnvCache.loadedAt < LOCAL_ENV_CACHE_TTL_MS) {
    return localEnvCache.values;
  }

  let text = "";
  try {
    text = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw error;
  }

  const values = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && value) values.set(key, value);
  }

  localEnvCache = { loadedAt: now, values };
  return values;
}

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  const local = await readLocalEnv();
  const pick = (key: string) => {
    const runtime = process.env[key];
    if (runtime && runtime.trim()) return runtime.trim();
    const fromFile = local.get(key);
    if (fromFile && fromFile.trim()) return fromFile.trim();
    return undefined;
  };

  return {
    graphVersion: pick("INSTAGRAM_GRAPH_VERSION") ?? "v24.0",
    igUserId: pick("INSTAGRAM_IG_USER_ID"),
    accessToken: pick("INSTAGRAM_ACCESS_TOKEN"),
    publicUsername: pick("INSTAGRAM_PUBLIC_USERNAME") ?? "maphouse_",
    publicWebAppId: pick("INSTAGRAM_WEB_APP_ID") ?? "936619743392459",
  };
}

function extractTitle(caption?: string, fallback = "Instagram Post") {
  if (!caption) return fallback;
  const line = caption
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0 && !part.startsWith("#"));

  if (!line) return fallback;
  return line.length > 42 ? `${line.slice(0, 42)}...` : line;
}

function summarizeCaption(caption?: string) {
  if (!caption) return "Instagram post from MapHouse.";
  const clean = caption.replace(/\s+/g, " ").trim();
  return clean.length > 110 ? `${clean.slice(0, 110)}...` : clean;
}

function inferCategory(text: string): TopicCategory {
  const v = text.toLowerCase();
  if (v.includes("黃豆") || v.includes("小麥") || v.includes("玉米") || v.includes("油價") || v.includes("電費") || v.includes("coffee")) {
    return "commodity";
  }
  if (v.includes("供應鏈") || v.includes("h100") || v.includes("半導體")) return "industry";
  if (v.includes("台灣")) return "taiwan";
  if (v.includes("拿鐵") || v.includes("大麥克") || v.includes("消費")) return "lifestyle";
  if (v.includes("世界盃") || v.includes("棒球")) return "sports";
  if (v.includes("殖利率") || v.includes("股") || v.includes("市值") || v.includes("利率") || v.includes("gdp")) return "market";
  return "instagram";
}

function inferRegion(text: string) {
  if (text.includes("亞洲")) return "Asia";
  if (text.includes("歐洲")) return "Europe";
  if (text.includes("台灣")) return "Taiwan";
  if (text.includes("拉美")) return "Latin America";
  if (text.includes("香港")) return "Hong Kong";
  return "Global";
}

function mediaToGallery(media: GraphMedia) {
  if (media.media_type === "CAROUSEL_ALBUM") {
    const children = media.children?.data ?? [];
    const urls = children.map((child) => child.media_url ?? child.thumbnail_url).filter(Boolean) as string[];
    return urls;
  }

  const primary = media.media_type === "VIDEO" ? media.thumbnail_url ?? media.media_url : media.media_url;
  return primary ? [primary] : [];
}

function toPost(media: GraphMedia): MapHouseContentPost {
  const caption = media.caption ?? "";
  const gallery = mediaToGallery(media);
  const title = extractTitle(caption, `IG ${media.id.slice(-6)}`);
  const timestamp = media.timestamp ?? new Date().toISOString();
  const date = new Date(timestamp);
  const sourceYear = Number.isNaN(date.valueOf()) ? "unknown" : String(date.getFullYear());
  const body = `${title}\n${caption}`;

  return {
    id: media.id,
    title,
    caption,
    category: inferCategory(body),
    region: inferRegion(body),
    summary: summarizeCaption(caption),
    sourceYear,
    status: "live",
    permalink: media.permalink ?? "https://www.instagram.com/maphouse_/",
    mediaType: media.media_type,
    mediaUrl: gallery[0],
    gallery,
    timestamp,
  };
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    next: { revalidate: 1800 },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instagram API request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as GraphMediaResponse;
}

function publicHeaders(username: string, webAppId: string): HeadersInit {
  return {
    Accept: "application/json",
    "x-ig-app-id": webAppId,
    "x-requested-with": "XMLHttpRequest",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    referer: `https://www.instagram.com/${username}/`,
  };
}

async function fetchPublicJson<T>(url: string, username: string, webAppId: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: publicHeaders(username, webAppId),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instagram public feed request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

function pickBestCandidate(candidates?: InstagramPublicImageCandidate[]) {
  if (!candidates?.length) return undefined;
  return [...candidates]
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
    .find((candidate) => candidate.url)?.url;
}

function publicItemGallery(item: InstagramPublicMediaItem) {
  if (item.media_type === 8) {
    const images =
      item.carousel_media
        ?.map((child) => pickBestCandidate(child.image_versions2?.candidates))
        .filter(Boolean) ?? [];
    return images as string[];
  }

  const image = pickBestCandidate(item.image_versions2?.candidates);
  return image ? [image] : [];
}

function publicMediaType(item: InstagramPublicMediaItem) {
  if (item.media_type === 8) return "CAROUSEL_ALBUM";
  if (item.media_type === 2) return "VIDEO";
  return "IMAGE";
}

function toPublicPost(item: InstagramPublicMediaItem): MapHouseContentPost | null {
  const code = item.code?.trim();
  const id = item.id?.trim() || code;
  if (!id) return null;

  const caption = item.caption?.text ?? "";
  const gallery = publicItemGallery(item);
  const title = extractTitle(caption, code ? `IG ${code}` : "Instagram Post");
  const timestamp = item.taken_at ? new Date(item.taken_at * 1000).toISOString() : new Date().toISOString();
  const date = new Date(timestamp);
  const sourceYear = Number.isNaN(date.valueOf()) ? "unknown" : String(date.getFullYear());
  const body = `${title}\n${caption}`;

  return {
    id,
    title,
    caption,
    category: inferCategory(body),
    region: inferRegion(body),
    summary: summarizeCaption(caption),
    sourceYear,
    status: "live",
    permalink: code ? `https://www.instagram.com/p/${code}/` : "https://www.instagram.com/maphouse_/",
    mediaType: publicMediaType(item),
    mediaUrl: gallery[0],
    gallery,
    timestamp,
  };
}

async function fetchInstagramPublicMedia(username: string, webAppId: string, maxItems = 120) {
  const profileUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const profile = await fetchPublicJson<InstagramPublicProfileResponse>(profileUrl, username, webAppId);
  const userId = profile.data?.user?.id;
  if (!userId) {
    throw new Error(`Instagram public profile not found: ${username}`);
  }

  const items: InstagramPublicMediaItem[] = [];
  let nextMaxId: string | undefined;

  while (items.length < maxItems) {
    const feedUrl = new URL(`https://i.instagram.com/api/v1/feed/user/${userId}/`);
    feedUrl.searchParams.set("count", "12");
    if (nextMaxId) {
      feedUrl.searchParams.set("max_id", nextMaxId);
    }

    const page = await fetchPublicJson<InstagramPublicFeedResponse>(feedUrl.toString(), username, webAppId);
    const chunk = page.items ?? [];
    items.push(...chunk);

    if (!page.more_available || !page.next_max_id) {
      break;
    }
    nextMaxId = page.next_max_id;
  }

  return items.slice(0, maxItems);
}

async function fetchInstagramMedia(env: RuntimeEnv, maxItems = 120) {
  if (!env.igUserId || !env.accessToken) return [];

  const base = `https://graph.facebook.com/${env.graphVersion}/${env.igUserId}/media`;
  const params = new URLSearchParams({
    fields:
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}",
    limit: "50",
    access_token: env.accessToken,
  });

  let nextUrl: string | undefined = `${base}?${params.toString()}`;
  const media: GraphMedia[] = [];

  while (nextUrl && media.length < maxItems) {
    const page = await fetchPage(nextUrl);
    const chunk = page.data ?? [];
    media.push(...chunk);
    nextUrl = page.paging?.next;
  }

  return media.slice(0, maxItems);
}

function fallbackPosts(): MapHouseContentPost[] {
  return igPosts.map((post, index) => ({
    id: post.slug,
    title: post.title,
    caption: "",
    category: post.category,
    region: post.region,
    summary: post.summary,
    sourceYear: post.sourceYear,
    status: "imported",
    permalink: "https://www.instagram.com/maphouse_/",
    mediaType: "UNKNOWN",
    mediaUrl: undefined,
    gallery: [],
    timestamp: `2000-01-01T00:00:${String(index).padStart(2, "0")}Z`,
  }));
}

async function readSnapshotPosts(): Promise<MapHouseContentPost[] | null> {
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw) as { posts?: unknown };
    if (!Array.isArray(parsed.posts)) return null;
    const posts = parsed.posts.filter((item): item is MapHouseContentPost => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return typeof record.id === "string" && typeof record.title === "string";
    });
    return posts.length ? posts : null;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    return null;
  }
}

async function writeSnapshotPosts(posts: MapHouseContentPost[]) {
  try {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), posts }, null, 2), "utf8");
  } catch {
    // Snapshot write failure should not break page render.
  }
}

export async function loadMapHousePosts(maxItems = 120): Promise<MapHouseContentResult> {
  const errors: string[] = [];
  const env = await getRuntimeEnv();
  const isConfigured = Boolean(env.igUserId && env.accessToken);

  if (isConfigured) {
    try {
      const live = await fetchInstagramMedia(env, maxItems);
      const posts = live.map(toPost).sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
      if (posts.length) {
        await writeSnapshotPosts(posts);
        return { source: "live", posts };
      }
      errors.push("Instagram API returned 0 posts.");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Instagram API fetch failed.");
    }
  } else {
    const missingKeys = [!env.igUserId ? "INSTAGRAM_IG_USER_ID" : null, !env.accessToken ? "INSTAGRAM_ACCESS_TOKEN" : null]
      .filter(Boolean)
      .join(", ");
    errors.push(`Instagram API env vars not configured (${missingKeys}).`);
  }

  try {
    const publicItems = await fetchInstagramPublicMedia(env.publicUsername, env.publicWebAppId, maxItems);
    const posts = publicItems
      .map(toPublicPost)
      .filter((post): post is MapHouseContentPost => post !== null)
      .sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

    if (posts.length) {
      await writeSnapshotPosts(posts);
      return {
        source: "public",
        posts,
        error: errors.length ? errors.join(" | ") : undefined,
      };
    }

    errors.push("Instagram public feed returned 0 posts.");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Instagram public feed fetch failed.");
  }

  const snapshotPosts = await readSnapshotPosts();
  if (snapshotPosts?.length) {
    errors.push("Live sync unavailable. Showing last successful snapshot.");
    return {
      source: "fallback",
      posts: snapshotPosts,
      error: errors.join(" | "),
    };
  }

  return {
    source: "fallback",
    posts: fallbackPosts(),
    error: errors.join(" | "),
  };
}
