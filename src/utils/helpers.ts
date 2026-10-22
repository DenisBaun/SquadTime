export const formatGameData = (game: any) => {
    return {
        id: game.id,
        title: game.title,
        rating: game.rating,
        playtime: game.playtime,
        coverImage: game.coverImage || 'default-image-url.jpg',
    };
};

export const filterGamesByPlaytime = (games: any[], maxPlaytime: number) => {
    return games.filter(game => game.playtime <= maxPlaytime);
};

export const sortGamesByRating = (games: any[]) => {
    return games.sort((a, b) => b.rating - a.rating);
};