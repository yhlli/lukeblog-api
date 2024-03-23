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

const authenticate = (req, res, next) => {
    const accessToken = req.headers['authorization'];
    const refreshToken = req.cookies['refreshToken'];
  
    if (!accessToken && !refreshToken) {
      return res.status(401).send('Access Denied. No token provided.');
    }
    
    jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, {}, (err,info)=>{
        if (err){
            if (!refreshToken){
                return res.status(401).sent('Access Denied. No refresh token provided.');
            }
            jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, {}, (err,info)=>{
                if (err){
                    return res.status(400).send('Invalid Token.')
                }
                const accessToken = jwt.sign( {info,id: info._id}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
                res
                    .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
                    .header('authorization', accessToken)
                    .send(info._id);
            })
        }
        req.authInfo = info;
        next();
    })
    /* try {
      const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
      req.user = decoded.user;
      next();
    } catch (error) {
      if (!refreshToken) {
        return res.status(401).send('Access Denied. No refresh token provided.');
      }
  
      try {
        const decoded = jwt.verify(refreshToken, secretKey);
        const accessToken = jwt.sign({ user: decoded.user }, secretKey, { expiresIn: '1h' });
  
        res
          .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
          .header('Authorization', accessToken)
          .send(decoded.user);
      } catch (error) {
        return res.status(400).send('Invalid Token.');
      }
    } */
};

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
                .header('authorization', accessToken)
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

app.get('/profile', (req,res)=>{
    const {token} = req.cookies;
    if (token === ''){
        res.json('not logged in');
    } else{
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {}, (err,info)=>{
            if(err) throw err;
            res.json(info);
        });
    }
    
});

app.post('/logout', (req,res)=>{
    res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), authenticate, async (req,res) => {
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
    const {_id} = req.headers;
            const {title,summary,content} = req.body;
            const postDoc = await Post.create({
                title,
                summary,
                content,
                cover:newPath,
                author:_id,
            });
        //res.json(postDoc);
        //res.json({files:req.file})
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
    await Comment.deleteMany({ postId: id });
    await Post.deleteOne(Post.findById(id));
    res.json('ok');
});

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
});

app.delete('/comment/:id', async(req,res)=>{
    const {id} = req.params;
    await Comment.deleteOne(Comment.findById(id));
    res.json('ok');
});

app.listen(4000);

app.get('/user/:id', (req,res)=>{
    const {id} = req.params;
    res.json(req.params);
});

//Below may not work yet and is not integrated well



/* app.post('/login', (req, res) => {
    const user = {
    id: 1,
    username: 'john.doe'
    };
    
    const accessToken = jwt.sign({ user }, secretKey, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ user }, secretKey, { expiresIn: '1d' });
    
    res
    .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
    .header('Authorization', accessToken)
    .send(user);
}); */

app.post('/refresh', (req, res) => {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      return res.status(401).send('Access Denied. No refresh token provided.');
    }
  
    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      const accessToken = jwt.sign({ user: decoded.user }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
  
      res
        .header('authorization', accessToken)
        .send(decoded.user);
    } catch (error) {
      return res.status(400).send('Invalid refresh token.');
    }
});