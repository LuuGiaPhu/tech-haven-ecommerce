// Firebase Configuration for Tech Haven
console.log('Loading Firebase config...');

// Import Firebase SDK from CDN
import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDpzgsxZ1Jfs5hWAfS-gDbYfgkVte_jXoA",
  authDomain: "tech-haven-5368b.firebaseapp.com",
  projectId: "tech-haven-5368b",
  storageBucket: "tech-haven-5368b.firebasestorage.app",
  messagingSenderId: "442337591630",
  appId: "1:442337591630:web:7005525c7664f513a55e1f",
  measurementId: "G-N54V96PG4M"
};

// Initialize Firebase (check if already initialized)
let app, auth, db, storage, firebaseAvailable = false;

try {
  // Check if Firebase app already exists
  try {
    app = getApp(); // Get existing app
    console.log('✅ Using existing Firebase app');
  } catch (e) {
    // App doesn't exist, create it
    app = initializeApp(firebaseConfig);
    console.log('✅ New Firebase app initialized');
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  firebaseAvailable = true;
  console.log('✅ Firebase services initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  console.log('🔐 Falling back to server-side authentication');
}

// Export initialized services
export { app, auth, db, storage, firebaseConfig, firebaseAvailable };

console.log('Firebase config exported successfully');