const express = require('express');
const router = express.Router();
const User = require('../models/users');
const passport = require('passport');
const auth = require('../authenticate');
const RSA = require('../encryption/rsa');
const config = require('../config');
const twilio = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
const mongoose = require('mongoose');
const multer = require('multer');
const Message = require('../models/message');
const Status = require('../models/status');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        const splits = file.originalname.split('.');
        const extension = splits[splits.length-1];
        cb(null, `${req.user._id}.${extension}`)
    }
});
const upload = multer({ storage: storage });

const updateMessageKeys = (userId, oldKeys, newKeys) => {
    Message.find({$or: [{from: userId}, {to: userId}]})
    .select('from to key')
    .then(messages => {
        const myMessages = messages.filter(message => String(message.to) == userId);
        const otherMessages = messages.filter(message => String(message.from) == userId);
        otherMessages.forEach(message => {
            const oldKey = message.key;
            const decryptedKey = RSA.Decryption(oldKey, {private: oldKeys.public, n: oldKeys.n});
            const newKey = RSA.Encryption(decryptedKey, {public: newKeys.private, n: newKeys.n});
            message.key = newKey;
            message.save();
        });
        const targetUsers = [];
        myMessages.forEach(message => {
            targetUsers.push(message.from);
        });
        User.find({_id: {$in: targetUsers}})
        .select('_id public private n')
        .then(users => {
            const userKeysMap = {};
            users.forEach(user => {
                userKeysMap[user._id] = {
                    public: user.public,
                    private: user.private,
                    n: user.n
                };
            });
            myMessages.forEach(message => {
                const oldKey = message.key;
                const decryptedKey = RSA.Decryption(
                    RSA.Decryption(oldKey, {
                        private: userKeysMap[message.from].public,
                        n: userKeysMap[message.from].n
                    }), {
                        private: oldKeys.private,
                        n: oldKeys.n
                    }
                );
                const newKey = RSA.Encryption(
                    RSA.Encryption(decryptedKey, {
                        public: newKeys.public,
                        n: newKeys.n
                    }), {
                        public: userKeysMap[message.from].private,
                        n: userKeysMap[message.from].n 
                    }
                );
                message.key = newKey;
                message.save();
            });
        });
    });
}

router.get('/', auth.verifyUser, auth.verifyToken, (req, res, next) => {
    Message.find({to: req.user._id})
    .then(messages => {
        Message.deleteMany({to: req.user._id}).then(() => {});
        Status.find({from: req.user._id})
        .then(statusList => {
            Status.deleteMany({from: req.user._id}).then(() => {});
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.json({
                success: true,
                messages: messages,
                statusList: statusList
            });
        });
    })
});

router.post('/login', (req, res, next) => {
    const otp = config.generateOtp();
    User.findOne({phone: req.body.phone})
    .then(async user => {
        if(user){
            await user.setPassword(otp);
            user.otpIssuedTime = Date.now();
            return user.save();
        }else{
            return User.register({phone: req.body.phone, otpIssuedTime: Date.now()}, otp);
        }
    }).then(user => {
        // twilio.messages.create({
        //     body: 'Your verification code for messenger is: '+otp,
        //     from: config.twilio.phoneNo,
        //     to: user.phone
        // }).then(message => {
            console.log(otp)
            const keys = RSA.RsaKeyGeneration();
            const oldKeys = {public: user.public, private: user.private, n: user.n};
            updateMessageKeys(user._id, oldKeys, keys);

            user.public = keys.public;
            user.private = keys.private;
            user.n = keys.n;
            user.save().then(() => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.json({success: true, message: `OTP has been sent to ${req.body.phone}, and it will be valid till 5 minutes`});
            });
        // });
    }).catch(err => {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: false, err: err.message});
    });
});

router.post('/verify-otp', (req, res, next) => {
    User.findOne({phone: req.body.username})
    .then(user => {
        if(new Date().getTime() - new Date(user.otpIssuedTime).getTime() > 300000) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.json({success: false, message: 'OTP is outdated, try again!'});
            return;
        }
        passport.authenticate('local', (err, user, info) => {
            if(err) return next(err);
            if (!user) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.json({success: false, message: 'Login Unsuccessful!', err: 'OTP provided is incorrect!'});
                return;
            }
            req.logIn(user, async (err) => {
                if(err){
                    res.statusCode=401;
                    res.setHeader('Content-Type', 'application/json');
                    res.json({success: false, status: 'Login Unsuccessful!', err: 'Could not log in user!'});
                    return;
                }
                let token = auth.getToken({_id: req.user._id});
                req.user = user;
                await user.setPassword(config.generateOtp());
                user.token = token;
                user.save().then(user => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.json({success: true, message: 'Login Successful!', token: token, user: {
                        _id: user._id,
                        name: user.name,
                        image: user.image,
                        phone: user.phone,
                        private: user.private,
                        n: user.n
                    }});
                });
                return;
            });
        })(req,res,next);
    })
});

router.get('/:userId/getKeys', auth.verifyUser, auth.verifyToken, (req, res, next) => {
    const userId = req.params.userId;
    if(!mongoose.Types.ObjectId.isValid(userId)){
        let err = new Error(`${userId} is not a valid User Id`);
        err.status = 404;
        return next(err);
    }
    User.findById(userId)
    .then(user => {
        let keys = {};
        if(user) {
            keys.public = user.public;
            keys.n = user.n;
            keys.loginTime = user.updatedAt;
        }
        res.statusCode  =200;
        res.setHeader('Content-Type', 'application/json');
        res.json(keys);
    });
});

router.post('/get-info', auth.verifyUser, auth.verifyToken, (req,res) => {
    const phone = req.body.phone;
    User.findOne({phone: phone})
    .select('_id phone image')
    .then(user => {
        res.setHeader('Content-Type', 'application/json');
        if(!user || user.phone === req.user.phone) {
            res.statusCode = 404;
            res.json({success: false, message: `No other user found with phone number: ${phone}`});
        } else {
            res.statusCode = 200;
            res.json({success: true, user: user});
        }
    }).catch(err => {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: false, message: err.message});
    });
});

router.get('/:userId/get-info', auth.verifyUser, auth.verifyToken, (req,res) => {
    const userId = req.params.userId;
    if(!mongoose.Types.ObjectId.isValid(userId)){
        let err = new Error(`${userId} is not a valid User Id`);
        err.status = 404;
        return next(err);
    }
    User.findById(userId)
    .select('_id phone image')
    .then(user => {
        res.setHeader('Content-Type', 'application/json');
        if(!user || user.phone === req.user.phone) {
            res.statusCode = 404;
            res.json({success: false, message: `No other user found with phone number: ${phone}`});
        } else {
            res.statusCode = 200;
            res.json({success: true, user: user});
        }
    }).catch(err => {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: false, message: err.message});
    });
});

router.post('/upload-profile-picture',
    auth.verifyUser,
    auth.verifyToken,
    upload.single('image'),
    (req, res) => {
        const path = 'images/'+req.file.filename;
        req.user.image = path;
        req.user.save();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: true, message: 'Profile picture updated successfully!', path: path});
});

router.get('/reset-profile-picture',
    auth.verifyUser,
    auth.verifyToken,
    (req, res) => {
        const path = 'images/default.png';
        req.user.image = path;
        req.user.save();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: true, message: 'Profile picture reset successfully!', path: path});
});

router.post('/update-name', auth.verifyUser, auth.verifyToken, (req, res) => {
    req.user.name = req.body.name;
    req.user.save();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'alpplication/json');
    res.json({success: true, name: req.body.name});
});

router.post('/getKeysInBulk', auth.verifyUser, auth.verifyToken, (req, res, next) => {
    User.find({_id: {$in: req.body.users}})
    .select('_id public n')
    .then(users => {
        let keys = {};
        users.forEach(user => {
            keys[user._id] = {
                public: user.public,
                private: user.private,
                n: user.n
            };
        });
        res.statusCode  =200;
        res.setHeader('Content-Type', 'application/json');
        res.json(keys);
    });
});

router.post('/get-info-in-bulk', auth.verifyUser, auth.verifyToken, (req,res) => {
    User.find({_id: req.body.users})
    .select('_id phone image')
    .then(users => {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.json({success: true, users: users});
    }).catch(err => {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: false, message: err.message});
    });
});

module.exports = router;