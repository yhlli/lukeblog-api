const mongoose = require('mongoose');
const {Schema, model} = mongoose;
const Post = require('./Post');

const UserSchema = Schema({
    username: {type: String, required: true, min: 4, unique: true},
    password: {type: String, required: true},
    favoritePosts: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: Post,
        default: [],
    }
});

const UserModel = model('User', UserSchema);

module.exports = UserModel;