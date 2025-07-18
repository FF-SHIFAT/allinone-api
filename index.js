const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fetch = require('node-fetch'); // <<-- নতুন প্যাকেজ

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

// পয়েন্ট ক্লেইম করার মূল রুট (VPN চেক সহ)
app.post('/claimReward', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "Token is missing." });
    
    // --- VPN ডিটেকশন ---
    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const apiKey = process.env.PROXYCHECK_API_KEY;
    const vpnCheckUrl = `https://proxycheck.io/v2/${userIp}?key=${apiKey}&vpn=1`;

    try {
        const vpnResponse = await fetch(vpnCheckUrl);
        const vpnData = await vpnResponse.json();
        
        const pendingRef = db.ref(`pendingAdViews/${token}`);
        const pendingSnapshot = await pendingRef.once("value");

        if (!pendingSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Invalid or expired token." });
        }
        
        const { userId } = pendingSnapshot.val();

        if (vpnData[userIp] && vpnData[userIp].proxy === 'yes') {
            // যদি VPN পাওয়া যায়, ইউজারকে ব্লক করে দাও
            const userToBlockRef = db.ref(`users/${userId}`);
            await userToBlockRef.update({ isBlocked: true, blockReason: 'VPN Detected' });
            await pendingRef.remove(); // টোকেন মুছে ফেলা হচ্ছে
            return res.status(403).json({ success: false, message: "VPN/Proxy detected. Account has been blocked." });
        }
        
        // --- VPN না পাওয়া গেলে পয়েন্ট দেওয়ার প্রক্রিয়া ---
        await pendingRef.remove();
        
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

    } catch (error) {
        console.error("Claim reward error:", error);
        return res.status(500).json({ success: false, message: "An internal server error occurred." });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});