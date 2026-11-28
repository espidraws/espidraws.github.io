export interface ThumbnailCard {
    title: string;
    image: string;
    videoUrl?: string;
    views?: string;
    likes?: string;
    channelName?: string;
    channelAvatar?: string;
    review?: { name: string; quote: string };
}

export interface ThumbnailTier {
    label: string;
    items: ThumbnailCard[];
}
