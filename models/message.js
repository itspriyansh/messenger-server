const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Message = Schema({
    from: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    key: {
        type: String,
        required: true
    },
    time: {
        type: Date,
        required: true,
        default: Date.now()
    },
    type: {
        type: String,
        default: 'utf-8'
    },
    index: {
        type: Number,
        required: true
    }
},{
    timestamps: true
});

module.exports = mongoose.model('Message', Message);