import { YOUTUBE_API_KEY } from "astro:env/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const API_URL = "https://www.googleapis.com/youtube/v3";
const CACHE_FILE = ".cache/youtube-stats.json";
const MAX_IDS_PER_REQUEST = 50;

interface StatsCache {
    subscribers: Record<string, number>;
    views: Record<string, number>;
}

interface StatisticsItem {
    id: string;
    statistics: { subscriberCount?: string; viewCount?: string };
}

export interface YouTubeStats {
    getSubscribers(channel: string | undefined): number | undefined;
    getViews(videoUrl: string | undefined): number | undefined;
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

async function requestStatistics(resource: "channels" | "videos", query: Record<string, string>): Promise<StatisticsItem[]> {
    const url = new URL(`${API_URL}/${resource}`);
    url.search = new URLSearchParams({ ...query, part: "statistics", key: YOUTUBE_API_KEY ?? "" }).toString();
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`YouTube ${resource} request failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as { items?: StatisticsItem[] };
    return body.items ?? [];
}

async function readCache(): Promise<StatsCache> {
    try {
        return JSON.parse(await readFile(CACHE_FILE, "utf8")) as StatsCache;
    } catch {
        return { subscribers: {}, views: {} };
    }
}

async function writeCache(cache: StatsCache): Promise<void> {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function fetchSubscribers(channelKeys: string[], cache: StatsCache): Promise<void> {
    const channelIds = channelKeys.filter((key) => key.startsWith("UC"));
    const handles = channelKeys.filter((key) => key.startsWith("@"));

    for (const batch of splitIntoBatches(channelIds)) {
        for (const item of await requestStatistics("channels", { id: batch.join(",") })) {
            if (item.statistics.subscriberCount) {
                cache.subscribers[item.id] = Number(item.statistics.subscriberCount);
            }
        }
    }
    // The API resolves only one handle per request.
    for (const handle of handles) {
        const [item] = await requestStatistics("channels", { forHandle: handle });
        if (item?.statistics.subscriberCount) {
            cache.subscribers[handle] = Number(item.statistics.subscriberCount);
        }
    }
}

async function fetchViews(videoIds: string[], cache: StatsCache): Promise<void> {
    for (const batch of splitIntoBatches(videoIds)) {
        for (const item of await requestStatistics("videos", { id: batch.join(",") })) {
            if (item.statistics.viewCount) {
                cache.views[item.id] = Number(item.statistics.viewCount);
            }
        }
    }
}

// Falls back to the last cached numbers whenever the key is missing or a request fails.
export async function loadYouTubeStats(channels: (string | undefined)[], videoUrls: (string | undefined)[]): Promise<YouTubeStats> {
    const channelKeys = [...new Set(channels.map(getChannelKey).filter((key) => key !== undefined))];
    const videoIds = [...new Set(videoUrls.map(getVideoId).filter((id) => id !== undefined))];
    const cache = await readCache();

    if (YOUTUBE_API_KEY) {
        try {
            await fetchSubscribers(channelKeys, cache);
            await fetchViews(videoIds, cache);
            await writeCache(cache);
        } catch (error) {
            console.warn(`Using cached YouTube stats: ${(error as Error).message}`);
        }
    }

    return {
        getSubscribers: (channel) => {
            const key = getChannelKey(channel);
            return key ? cache.subscribers[key] : undefined;
        },
        getViews: (videoUrl) => {
            const id = getVideoId(videoUrl);
            return id ? cache.views[id] : undefined;
        },
        totalViews: videoIds.reduce((total, id) => total + (cache.views[id] ?? 0), 0),
    };
}

export function formatCount(count: number): string {
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}
