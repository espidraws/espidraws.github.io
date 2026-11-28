import { YOUTUBE_API_KEY } from "astro:env/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const API_URL = "https://www.googleapis.com/youtube/v3";
const CACHE_FILE = ".cache/youtube-stats.json";
const MAX_IDS_PER_REQUEST = 50;

export interface VideoInfo {
    title: string;
    channelId: string;
    views: number;
    likes?: number;
}

export interface ChannelInfo {
    title: string;
    avatar: string;
    subscribers?: number;
}

interface StatsCache {
    videos: Record<string, VideoInfo>;
    channels: Record<string, ChannelInfo>;
    handles: Record<string, string>;
}

interface ApiItem {
    id: string;
    snippet: { title: string; channelId?: string; thumbnails?: Record<string, { url: string }> };
    statistics: { subscriberCount?: string; viewCount?: string; likeCount?: string };
}

export interface YouTubeStats {
    getVideo(videoUrl: string | undefined): VideoInfo | undefined;
    getChannel(channel: string | undefined): (ChannelInfo & { id: string }) | undefined;
    totalViews: number;
}

export function getVideoId(videoUrl: string | undefined): string | undefined {
    return videoUrl?.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)?.[1];
}

function getChannelKey(channel: string | undefined): string | undefined {
    const trimmed = channel?.trim();
    if (!trimmed) {
        return undefined;
    }
    const channelId = trimmed.match(/UC[\w-]{22}/)?.[0];
    if (channelId) {
        return channelId;
    }
    const handle = trimmed.match(/@([\w.-]+)/)?.[1] ?? trimmed;
    return `@${handle.toLowerCase()}`;
}

function splitIntoBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let start = 0; start < items.length; start += MAX_IDS_PER_REQUEST) {
        batches.push(items.slice(start, start + MAX_IDS_PER_REQUEST));
    }
    return batches;
}

async function requestItems(resource: "channels" | "videos", query: Record<string, string>): Promise<ApiItem[]> {
    const url = new URL(`${API_URL}/${resource}`);
    url.search = new URLSearchParams({ ...query, part: "snippet,statistics", key: YOUTUBE_API_KEY ?? "" }).toString();
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`YouTube ${resource} request failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as { items?: ApiItem[] };
    return body.items ?? [];
}

async function readCache(): Promise<StatsCache> {
    const empty: StatsCache = { videos: {}, channels: {}, handles: {} };
    try {
        const stored = JSON.parse(await readFile(CACHE_FILE, "utf8")) as Partial<StatsCache>;
        return { ...empty, ...stored };
    } catch {
        return empty;
    }
}

async function writeCache(cache: StatsCache): Promise<void> {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function toChannelInfo(item: ApiItem): ChannelInfo {
    const thumbnails = item.snippet.thumbnails ?? {};
    const subscriberCount = item.statistics.subscriberCount;
    return {
        title: item.snippet.title,
        avatar: (thumbnails.medium ?? thumbnails.default)?.url ?? "",
        subscribers: subscriberCount === undefined ? undefined : Number(subscriberCount),
    };
}

async function fetchVideos(videoIds: string[], cache: StatsCache): Promise<void> {
    for (const batch of splitIntoBatches(videoIds)) {
        for (const item of await requestItems("videos", { id: batch.join(",") })) {
            const likeCount = item.statistics.likeCount;
            cache.videos[item.id] = {
                title: item.snippet.title,
                channelId: item.snippet.channelId ?? "",
                views: Number(item.statistics.viewCount ?? 0),
                likes: likeCount === undefined ? undefined : Number(likeCount),
            };
        }
    }
}

async function fetchChannels(channelKeys: string[], cache: StatsCache): Promise<void> {
    const handles = channelKeys.filter((key) => key.startsWith("@"));
    // The API resolves only one handle per request.
    for (const handle of handles) {
        const [item] = await requestItems("channels", { forHandle: handle });
        if (item) {
            cache.handles[handle] = item.id;
            cache.channels[item.id] = toChannelInfo(item);
        }
    }
    const channelIds = channelKeys.filter((key) => key.startsWith("UC"));
    for (const batch of splitIntoBatches(channelIds)) {
        for (const item of await requestItems("channels", { id: batch.join(",") })) {
            cache.channels[item.id] = toChannelInfo(item);
        }
    }
}

// Falls back to the last cached data whenever the key is missing or a request fails.
export async function loadYouTubeStats(channels: (string | undefined)[], videoUrls: (string | undefined)[]): Promise<YouTubeStats> {
    const videoIds = [...new Set(videoUrls.map(getVideoId).filter((id) => id !== undefined))];
    const cache = await readCache();

    if (YOUTUBE_API_KEY) {
        try {
            await fetchVideos(videoIds, cache);
            const uploaderIds = videoIds.map((id) => cache.videos[id]?.channelId).filter((id) => id !== undefined && id !== "");
            const channelKeys = [...new Set([...channels.map(getChannelKey), ...uploaderIds].filter((key) => key !== undefined))];
            await fetchChannels(channelKeys, cache);
            await writeCache(cache);
        } catch (error) {
            console.warn(`Using cached YouTube stats: ${(error as Error).message}`);
        }
    }

    const resolveChannelId = (channel: string | undefined) => {
        const key = getChannelKey(channel);
        return key?.startsWith("@") ? cache.handles[key] : key;
    };

    return {
        getVideo: (videoUrl) => {
            const id = getVideoId(videoUrl);
            return id ? cache.videos[id] : undefined;
        },
        getChannel: (channel) => {
            const id = resolveChannelId(channel);
            const info = id ? cache.channels[id] : undefined;
            return id && info ? { ...info, id } : undefined;
        },
        totalViews: videoIds.reduce((total, id) => total + (cache.videos[id]?.views ?? 0), 0),
    };
}

export function formatCount(count: number): string {
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}
