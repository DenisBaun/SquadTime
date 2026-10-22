import { Schema, model } from 'mongoose';

const userSchema = new Schema({
    username: { type: String, required: true },
    avatar_url: { type: String, required: true }
});

const gameSchema = new Schema({
    title: { type: String, required: true },
    rating: { type: Number, required: true },
    playtime: { type: Number, required: true }
});

const userGameSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    date: { type: Date, required: true },
    max_playtime: { type: Number, required: true }
});

const User = model('User', userSchema);
const Game = model('Game', gameSchema);
const UserGame = model('UserGame', userGameSchema);

export { User, Game, UserGame };