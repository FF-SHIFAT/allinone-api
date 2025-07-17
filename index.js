const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://allinonebdbot-project-default-rtdb.firebaseio.com"
});
const db = admin.database();

app.use(cors());
app.use(express.json());

const DAILY_AD_LIMIT = 40;
const POINTS_PER_AD = 1;

// টেস্ট রুট
app.get('/', (req, res) => {
    res.send('API Server for AllInOneBdBot is running!');
});

// পয়েন্ট ক্লেইম করার মূল রুট
app.post('/claimReward', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, message: "Token is missing." });
    }

    const pendingRef = db.ref(`pendingAdViews/${token}`);
    const pendingSnapshot = await pendingRef.once("value");

    if (!pendingSnapshot.exists()) {
        return res.status(404).json({ success: false, message: "Invalid or expired token." });
    }

    const { userId } = pendingSnapshot.val();
    await pendingRef.remove(); // টোকেন ব্যবহার হয়ে যাওয়ায় মুছে ফেলা হচ্ছে

    const today = new Date().toISOString().slice(0, 10);
    const adViewsRef = db.ref(`adViews/${userId}/${today}`);
    const userRef = db.ref(`users/${userId}`);

    const viewSnapshot = await adViewsRef.once("value");
    const todayViews = viewSnapshot.val() || 0;

    if (todayViews >= DAILY_AD_LIMIT) {
        return res.status(429).json({ success: false, message: "Daily limit reached." });
    }

    const userSnapshot = await userRef.once("value");
    if (userSnapshot.exists()) {
        const userPoints = userSnapshot.val().points || 0;
        await adViewsRef.set(todayViews + 1);
        await userRef.update({ points: userPoints + POINTS_PER_AD });

        return res.status(200).json({ success: true, message: "Points awarded successfully!" });
    } else {
        return res.status(404).json({ success: false, message: "User not found." });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});