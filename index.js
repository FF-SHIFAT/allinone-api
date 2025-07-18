const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

const app = express();

// serviceAccountKey.json ফাইলটি লোড করা হচ্ছে
const serviceAccount = require('./serviceAccountKey.json');

// Firebase ইনিশিয়ালাইজেশন
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://allinonebdbot-project-default-rtdb.firebaseio.com"
});
const db = admin.database();

// মিডলওয়্যার ব্যবহার
app.use(cors());
app.use(express.json());

// আপনার বট অনুযায়ী ধ্রুবক (Constants)
const DAILY_AD_LIMIT = 40;
const POINTS_PER_AD = 1;

// ==================================================
//           সাধারণ ব্যবহারকারীর জন্য রুট
// ==================================================

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

    if (!apiKey) {
        console.error("PROXYCHECK_API_KEY is not set in environment variables.");
        return res.status(500).json({ success: false, message: "Server configuration error." });
    }

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
        const userToBlockRef = db.ref(`users/${userId}`);

        if (vpnData[userIp] && vpnData[userIp].proxy === 'yes') {
            await userToBlockRef.update({ isBlocked: true, blockReason: `VPN Detected (${vpnData[userIp].type})` });
            await pendingRef.remove();
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
            const userData = userSnapshot.val();
            if (userData.isBlocked) {
                return res.status(403).json({ success: false, message: "Your account is blocked." });
            }
            const userPoints = userData.points || 0;
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


// ==================================================
//           অ্যাডমিন প্যানেলের জন্য নতুন রুট
// ==================================================
app.post('/admin/users', async (req, res) => {
    const { password } = req.body;

    // ধাপ ১: পাসওয়ার্ড যাচাই করা
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Incorrect Password' });
    }

    // ধাপ ২: Firebase থেকে সব ইউজারের তথ্য আনা
    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        if (snapshot.exists()) {
            const users = snapshot.val();
            // অবজেক্টটিকে একটি অ্যারে-তে রূপান্তর করা হচ্ছে
            const userList = Object.keys(users).map(key => ({
                id: key,
                ...users[key]
            }));
            res.status(200).json({ success: true, users: userList });
        } else {
            res.status(404).json({ success: false, message: 'No users found.' });
        }
    } catch (error) {
        console.error("Admin fetch users error:", error);
        res.status(500).json({ success: false, message: 'Server error while fetching users.' });
    }
});


// ==================================================
//                    সার্ভার চালু করা
// ==================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});




// const express = require('express');
// const cors = require('cors');
// const admin = require('firebase-admin');
// const fetch = require('node-fetch'); // <<-- নতুন প্যাকেজ

// const app = express();
// const serviceAccount = require('./serviceAccountKey.json');

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: "https://allinonebdbot-project-default-rtdb.firebaseio.com"
// });
// const db = admin.database();

// app.use(cors());
// app.use(express.json());

// const DAILY_AD_LIMIT = 40;
// const POINTS_PER_AD = 1;

// // টেস্ট রুট
// app.get('/', (req, res) => {
//     res.send('API Server for AllInOneBdBot is running!');
// });

// // পয়েন্ট ক্লেইম করার মূল রুট (VPN চেক সহ)
// app.post('/claimReward', async (req, res) => {
//     const { token } = req.body;
//     if (!token) return res.status(400).json({ success: false, message: "Token is missing." });
    
//     // --- VPN ডিটেকশন ---
//     const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
//     const apiKey = process.env.PROXYCHECK_API_KEY;
//     const vpnCheckUrl = `https://proxycheck.io/v2/${userIp}?key=${apiKey}&vpn=1`;

//     try {
//         const vpnResponse = await fetch(vpnCheckUrl);
//         const vpnData = await vpnResponse.json();
        
//         const pendingRef = db.ref(`pendingAdViews/${token}`);
//         const pendingSnapshot = await pendingRef.once("value");

//         if (!pendingSnapshot.exists()) {
//             return res.status(404).json({ success: false, message: "Invalid or expired token." });
//         }
        
//         const { userId } = pendingSnapshot.val();

//         if (vpnData[userIp] && vpnData[userIp].proxy === 'yes') {
//             // যদি VPN পাওয়া যায়, ইউজারকে ব্লক করে দাও
//             const userToBlockRef = db.ref(`users/${userId}`);
//             await userToBlockRef.update({ isBlocked: true, blockReason: 'VPN Detected' });
//             await pendingRef.remove(); // টোকেন মুছে ফেলা হচ্ছে
//             return res.status(403).json({ success: false, message: "VPN/Proxy detected. Account has been blocked." });
//         }
        
//         // --- VPN না পাওয়া গেলে পয়েন্ট দেওয়ার প্রক্রিয়া ---
//         await pendingRef.remove();
        
//         const today = new Date().toISOString().slice(0, 10);
//         const adViewsRef = db.ref(`adViews/${userId}/${today}`);
//         const userRef = db.ref(`users/${userId}`);

//         const viewSnapshot = await adViewsRef.once("value");
//         const todayViews = viewSnapshot.val() || 0;

//         if (todayViews >= DAILY_AD_LIMIT) {
//             return res.status(429).json({ success: false, message: "Daily limit reached." });
//         }

//         const userSnapshot = await userRef.once("value");
//         if (userSnapshot.exists()) {
//             const userPoints = userSnapshot.val().points || 0;
//             await adViewsRef.set(todayViews + 1);
//             await userRef.update({ points: userPoints + POINTS_PER_AD });
//             return res.status(200).json({ success: true, message: "Points awarded successfully!" });
//         } else {
//             return res.status(404).json({ success: false, message: "User not found." });
//         }

//     } catch (error) {
//         console.error("Claim reward error:", error);
//         return res.status(500).json({ success: false, message: "An internal server error occurred." });
//     }
// });


// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     console.log(`Server is listening on port ${PORT}`);
// });