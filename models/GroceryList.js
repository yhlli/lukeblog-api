const { Schema, model } = require('mongoose');


const GroceryListSchema = new Schema({
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    items: [{
        name: {
            type: String,
            required: true,
        },
        quantity: {
            type: Number,
            default: 1,
        },
    }],
});

const GroceryListModel = model('GroceryList', GroceryListSchema);
module.exports = GroceryListModel;