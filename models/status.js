const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Status = Schema({
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
    status: {
        type: String,
        required: true
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
},{
    collection: 'statuses'
});

module.exports = mongoose.model('Status', Status);