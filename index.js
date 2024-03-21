require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const salt = bcrypt.genSaltSync(10);
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');
const corsOptions = require('./corsOptions');

//http://localhost:3000
//https://lukeblog.onrender.com
//app.use(cors({credentials:true,origin:'https://lukeblog.onrender.com'}));
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

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
        /* jwt.sign({username,id:userDoc._id}, process.env.ACCESS_TOKEN_SECRET, {}, (err,token) => {
            if (err) throw err;
            res.cookie('token', token).json({
              id:userDoc._id,
              username,
            });
          }); */
        const accessToken = jwt.sign({username,id:userDoc._id}, process.env.ACCESS_TOKEN_SECRET, {});
        try {
            res.cookie('token', accessToken, {
                httpOnly: false,
                secure: true,
                sameSite: 'none',
            }).json({
                id:userDoc._id,
                username,
            });
        } catch (error) {
            throw error;
        }
        /* res.json(username); */
    } else{
        res.status(400).json('Wrong credentials');
    }
});

app.get('/profile', (req,res)=>{
    const {token} = req.cookies;
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {}, (err,info)=>{
        if(err) throw err;
        res.json(info);
    });
});

app.post('/logout', (req,res)=>{
    res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
    //const {originalname,path} = req.file;
    var path;
    var originalname;
    var parts;
    var ext;
    if (req.file !== undefined){
        path = req.file.path;
        originalname = req.file.originalname;
        parts = originalname.split('.');
        ext = parts[parts.length - 1];
    } else{
        path = 'uploads\\default';
        ext = 'jpg';
    }
    //const parts = originalname.split('.');
    //const ext = parts[parts.length - 1];
    const newPath = path+'.'+ext;
    if (req.file !== undefined) fs.renameSync(path, newPath);


    const {token} = req.cookies;
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {}, async (err,info)=>{
        if(err) throw err;
            const {title,summary,content} = req.body;
            const postDoc = await Post.create({
                title,
                summary,
                content,
                cover:newPath,
                author:info.id,
            });
        res.json(postDoc);
        //res.json({files:req.file})
    });
});

app.put('/post', uploadMiddleware.single('file'), async (req,res) => {
    let newPath = null;
    if (req.file) {
        const {originalname,path} = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path+'.'+ext;
        fs.renameSync(path, newPath);
    }
    const {token} = req.cookies;
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {}, async (err,info)=>{
        if(err) throw err;
        const {id,title,summary,content} = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if (!isAuthor){
            return res.status(400).json('You are not the author');
        }
        await postDoc.updateOne({
            title,
            summary,
            content,
            cover: newPath ? newPath: postDoc.cover,
        });
        res.json(postDoc);
    });
});

app.get('/post', async (req,res)=>{
    const Posts = await Post.find()
    .populate('author', ['username'])
    .sort({createdAt: -1})
    .limit(20);

    Posts.forEach(function(postItem){
        var co = postItem.cover;
        if (!fs.existsSync(co)) postItem.cover = 'uploads\\default.jpg';
    })
    res.json(
        Posts
    );
});

app.get('/post/:id', async(req,res)=>{
    const {id} = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    if (!fs.existsSync(postDoc.cover)) postDoc.cover = 'uploads\\default.jpg';
    res.json(postDoc);
});

app.delete('/post/:id', async(req,res)=>{
    const {id} = req.params;
    await Post.deleteOne(Post.findById(id));
    res.json('ok');
})

app.post('/comment/:id', uploadMiddleware.single('file'), async(req,res)=>{
    const {id} = req.params;
    const {comment} = req.body;
    const {token} = req.cookies;
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {}, async (err,info)=>{
        if(err) throw err;
        const commentDoc = await Comment.create({
            postId: id,
            content: comment,
            author: info.id,
        })
        res.json(commentDoc);
    });
});

app.get('/comment/:id', async(req,res)=>{
    const {id} = req.params;
    const commentDoc = await Comment.find({postId: id}).populate('author', ['username']);
    res.json(commentDoc);
})

app.listen(4000);
