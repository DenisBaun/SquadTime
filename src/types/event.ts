export interface Event {
    date: string; // ISO format date string
    max_playtime: number; // Maximum playtime in minutes
    selected_users: string[]; // Array of user IDs selected for the event
}