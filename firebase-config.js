// Firebase Configuration for MSLOG
// IMPORTANT: Replace these values with your Firebase project settings
// Get these from: https://console.firebase.google.com > Project Settings > Your Apps

const firebaseConfig = {
    apiKey: "AIzaSyADaNt2fkjeABf3P14lgbO1pVQcACI6nZY",
    authDomain: "mslog-bacd5.firebaseapp.com",
    projectId: "mslog-bacd5",
    storageBucket: "mslog-bacd5.firebasestorage.app",
    messagingSenderId: "640473505384",
    appId: "1:640473505384:web:48a8fee86dcc6b7e2265dd",
    measurementId: "G-WEP4PC5DVD"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
