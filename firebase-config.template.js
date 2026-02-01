// Firebase Configuration Template for MSLOG
//
// SETUP INSTRUCTIONS:
// 1. Copy this file to firebase-config.js
// 2. Replace the placeholder values with your Firebase project settings
// 3. Get these values from: https://console.firebase.google.com > Project Settings > Your Apps
//
// IMPORTANT: Never commit firebase-config.js with real credentials!

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
