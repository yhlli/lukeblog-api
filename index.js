require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const salt = bcrypt.genSaltSync(10);

//http://localhost:3000
//https://lukeblog.onrender.com
app.use(cors({credentials:true,origin:'https://lukeblog.onrender.com'}));
app.use(express.json());
app.use(cookieParser());

try {
    mongoose.connect(process.env.DATABASE_URI);
    console.log('Connected to mongoose');
} catch (error) {
    console.log(error);
}

app.post('/register', async (req,res)=>{
    const {username,password} = req.body;
    try {
        const userDoc = await User.create({
            username,
            password:bcrypt.hashSync(password,salt)
        });
        res.json(userDoc);
    } catch (e) {
        console.log(e);
        res.status(400).json(e);
    }
})

app.post('/login', async (req,res)=>{
    const {username,password} = req.body;
    const userDoc = await User.findOne({username});
    var passOk = false;
    if (userDoc !== null){
        passOk = bcrypt.compareSync(password, userDoc.password);
    }
    if (passOk){
        //Logged in
        jwt.sign({username,id:userDoc._id}, process.env.ACCESS_TOKEN_SECRET, {}, (err,token) =>{
            if (err) throw err;
            res.cookie('token', token, {
                httpOnly: false,
                secure: true,
                sameSite: 'none',
            }).json({
                id:userDoc._id,
                username,
            });
        });
        //res.json();
        console.log(res.cookies);
    } else{
        res.status(400).json('Wrong credentials');
    }
})

app.get('/profile', (req,res)=>{
    const {token} = req.cookies;
    console.log(token);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {}, (err,info)=>{
        if(err) throw err;
        res.json(info);
    });
});

app.post('/logout', (req,res)=>{
    res.cookie('token', '').json('ok');
})

app.listen(4000);
