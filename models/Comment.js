const { Schema, model } = require("mongoose");

const CommentSchema = new Schema({
    content: String,
    author:{type:Schema.Types.ObjectId, ref: 'User'}
},{
    timestamps: true,
});

const CommentModel = model('Comment', CommentSchema);
module.exports = CommentModel;