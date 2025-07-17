// প্রয়োজনীয় লাইব্রেরি ইম্পোর্ট
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Express অ্যাপ এবং Firebase ইনিশিয়ালাইজেশন
const app = express();
const serviceAccount = require('./serviceAccountKey.json'); // <<-- এই ফাইলটি যোগ করতে হবে

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://allinonebdbot-project-default-rtdb.firebaseio.com" // আপনার আসল URL
});

// মিডলওয়্যার ব্যবহার
app.use(cors());
app.use(express.json());

// একটি সাধারণ টেস্ট রুট
app.get('/', (req, res) => {
    res.send('API Server for AllInOneBdBot is running!');
});

// আমাদের পয়েন্ট ক্লেইম করার রুট (পরে তৈরি করব)
// app.post('/claimReward', (req, res) => {
//     // ... এখানে আমাদের মূল লজিক থাকবে ...
// });

// সার্ভার চালু করা
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});