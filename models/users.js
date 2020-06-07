const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const User = new mongoose.Schema({
    name: {
        type: String
    },
    image: {
        type: String,
        default: 'images/default.png'
    },
    phone: {
        type: String,
        required: true
    },
    public: {
        type: String
    },
    private: {
        type: String
    },
    n: {
        type: String
    },
    otpIssuedTime: {
        type: Date
    },
    token: {
        type: String
    }
},{
    timestamps: true
});

User.plugin(passportLocalMongoose, {usernameField: 'phone'});

module.exports = mongoose.model('User', User);