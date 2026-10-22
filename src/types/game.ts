export interface RawgGame {
    id: number;
    name: string;
    background_image: string | null;
    metacritic: number | null;
    playtime: number;
    ratings_count: number;
    genres: { name: string; slug?: string }[];
    description?: string;
    description_raw?: string;
    released?: string | null;
    website?: string;
    reddit_url?: string;
    platforms?: { platform?: { name?: string } }[];
    publishers?: { name?: string }[];
}

export interface Game {
    id: number;
    title: string;
    rating: number;
    playtime: number;
}