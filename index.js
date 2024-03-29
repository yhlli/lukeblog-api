require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const Bio = require('./models/Bio');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const salt = bcrypt.genSaltSync(10);
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');
const corsOptions = require('./corsOptions');

const authenticate = async (req, res, next) => {
    const accessToken = req.cookies['authorization'];
    const refreshToken = req.cookies['refreshToken'];
    try {
        if (!accessToken && !refreshToken) {
            return res.status(401).send('Access Denied. No token provided.');
        }
        const info = await jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, {});
        req.infoId = info.id;
        req.infoUsername = info.username;
    } catch (err) {
        if (!refreshToken){
            return res.status(401).sent('Access Denied. No refresh token provided.');
        }
        try {
            const refreshInfo = await jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET,{});
            req.infoId = refreshInfo.id;
            req.infoUsername = refreshInfo.username;
            const accessToken = jwt.sign( {refreshInfo,id: refreshInfo._id}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' });
            res.cookie('authorization', accessToken);
        } catch (err) {
            return res.status(400).send('Invalid Refresh Token.')
        }
    }
    next();
};

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
        const accessToken = jwt.sign({username,id:userDoc._id}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        const refreshToken = jwt.sign({username,id:userDoc._id}, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' });
        try {
            res
                .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
                .cookie('authorization', accessToken)
                .json({
                id:userDoc._id,
                username,
            });
        } catch (error) {
            throw error;
        }
    } else{
        res.status(400).json('Wrong credentials');
    }
});

app.get('/profile', authenticate, (req,res)=>{
    const {authorization} = req.cookies;
    if (authorization === ''){
        res.json('not logged in');
    } else{
        res.json(req.infoId);
    }
    
});

app.post('/logout', (req,res)=>{
    res.cookie('authorization', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), authenticate, async (req,res) => {
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
    const newPath = path+'.'+ext;
    if (req.file !== undefined) fs.renameSync(path, newPath);

        const {title,summary,content} = req.body;
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover:newPath,
            author:req.infoId,
            uname:req.infoUsername,
        });
    res.json(postDoc);
});

app.put('/post', uploadMiddleware.single('file'), authenticate, async (req,res) => {
    let newPath = null;
    if (req.file) {
        const {originalname,path} = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path+'.'+ext;
        fs.renameSync(path, newPath);
    }
    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(req.infoId);
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

app.get('/post', async (req,res)=>{
    const page = parseInt(req.query.page);
    const offset = 20;
    const Posts = await Post.find()
    .populate('author', ['username'])
    .sort({createdAt: -1})
    .limit(offset)
    .skip((page-1)*offset);

    Posts.forEach(function(postItem){
        var co = postItem.cover;
        if (!fs.existsSync(co)) postItem.cover = 'uploads\\default.jpg';
    })
    res.json({
        data: Posts,
        totalCount: await Post.countDocuments(),
    }
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
    await Comment.deleteMany({ postId: id });
    await Post.deleteOne(Post.findById(id));
    res.json('ok');
})

app.post('/comment/:id', uploadMiddleware.single('file'), authenticate, async(req,res)=>{
    const {id} = req.params;
    const {comment} = req.body;
    const commentDoc = await Comment.create({
        postId: id,
        content: comment,
        author: req.infoId,
    })
    res.json(commentDoc);
});


app.get('/comment/:id', async(req,res)=>{
    const {id} = req.params;
    const commentDoc = await Comment.find({postId: id}).populate('author', ['username']);
    res.json(commentDoc);
});

app.delete('/comment/:id', async(req,res)=>{
    const {id} = req.params;
    await Comment.deleteOne(Comment.findById(id));
    res.json('ok');
});

app.get('/user/:id', async (req,res)=>{
    const {id} = req.params;
    const bioDoc = await Bio.find({ postId: id });
    res.json(bioDoc);
});

app.post('/user/editbio/:id', uploadMiddleware.single('file'), async (req,res)=>{
    const {id} = req.params;
    const { content } = req.body;
    await Bio.deleteMany({ postId: id });
    const bioDoc = await Bio.create({
        postId: id,
        content: content,
        author: req.infoId,
    })
    res.json(bioDoc);
});

app.get('/user/post/:id', async (req,res)=>{
    const {id} = req.params;
    const userPosts = await Post.find({ uname: id })
    res.json(userPosts);
});

app.listen(4000);



//Below may not work yet and is not integrated well