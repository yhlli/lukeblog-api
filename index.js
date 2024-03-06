require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const salt = bcrypt.genSaltSync(10);

//http://localhost:3000
//https://lukeblog.onrender.com
app.use(cors({credentials:true,origin:'https://lukeblog.onrender.com'}));
app.use(express.json());

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
            res.cookie('token', token).json('ok');
        });
        //res.json();
    } else{
        res.status(400).json('Wrong credentials');
    }
})

app.listen(4000);
