require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User')

app.use(cors());
app.use(express.json());

try {
    mongoose.connect(process.env.DATABASE_URI);
    console.log('Connected to mongoose');
} catch (error) {
    console.log(error);
}
mongoose.connect('mongodb+srv://yihengli1998:mrlulu98@cluster0.rr9fu4y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

app.post('/register', async (req,res)=>{
    const {username,password} = req.body;
    try {
        const userDoc = await User.create({
            username,
            password
        });
        res.json(userDoc);
    } catch (e) {
        res.status(400).json(e);
    }
})

app.listen(4000);
