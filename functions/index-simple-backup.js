const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('./serviceAccountKey.json')),
    projectId: 'tech-haven-5368b'
  });
  console.log('✅ Firebase Admin SDK initialized');
}

const db = admin.firestore();
const auth = admin.auth();

const app = express();

// Express configuration
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for API calls
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Debug middleware
app.use((req, res, next) => {
  if (!req.path.includes('.') && !req.path.includes('/js') && !req.path.includes('/css')) {
    console.log(`🌐 ${req.method} ${req.path}`);
    if (req.headers.authorization) {
      console.log('🔑 Has Authorization header');
    }
  }
  next();
});

// Middleware to verify Firebase ID token
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    console.log('🔍 Verifying ID token...');
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log('✅ Token verified for user:', decodedToken.name);
    
    // Save user info to Firestore if not exists
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      const userData = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        photo: decodedToken.picture,
        provider: 'google',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await userRef.set(userData);
      console.log('💾 New user saved to Firestore:', decodedToken.name);
    } else {
      // Update last login
      await userRef.update({
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('🔄 Updated last login for:', decodedToken.name);
    }
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      photo: decodedToken.picture,
      provider: decodedToken.firebase.sign_in_provider
    };
    
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    req.user = null;
  }
  
  next();
}

// Routes
app.get('/', (req, res) => {
  console.log('🏠 Home page - rendering with Firebase Auth support');
  res.render('index', { 
    user: null, // Client-side will handle user state
    isAuthenticated: false // Client-side will handle auth state
  });
});

// API route to get current user (with token verification)
app.get('/api/user', verifyToken, (req, res) => {
  console.log('👤 User API called - User:', req.user?.name || 'None');
  
  res.json({
    success: true,
    authenticated: !!req.user,
    user: req.user || null,
    timestamp: new Date().toISOString()
  });
});

// API route to save additional user data
app.post('/api/user/update', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { displayName, preferences } = req.body;
    const userRef = db.collection('users').doc(req.user.uid);
    
    await userRef.update({
      ...(displayName && { displayName }),
      ...(preferences && { preferences }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'User updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug route to check token
app.post('/api/debug/token', async (req, res) => {
  const { idToken } = req.body;
  
  if (!idToken) {
    return res.json({ error: 'No token provided' });
  }
  
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    res.json({
      success: true,
      decoded: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
        provider: decodedToken.firebase.sign_in_provider,
        exp: new Date(decodedToken.exp * 1000),
        iat: new Date(decodedToken.iat * 1000)
      }
    });
  } catch (error) {
    res.json({
      error: error.message,
      code: error.code
    });
  }
});

// Debug route to test token verification
app.get('/debug/auth', async (req, res) => {
  const authHeader = req.headers.authorization;
  console.log('🔍 Debug Auth Route');
  console.log('🔑 Authorization header:', authHeader ? 'Present' : 'Missing');
  
  if (!authHeader) {
    return res.json({
      error: 'No Authorization header',
      message: 'Send request with "Authorization: Bearer <idToken>"',
      headers: req.headers
    });
  }
  
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('✅ Token verified for user:', decodedToken.name);
    
    res.json({
      success: true,
      user: {
        uid: decodedToken.uid,
        name: decodedToken.name,
        email: decodedToken.email,
        picture: decodedToken.picture
      }
    });
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Firebase Auth Demo'
  });
});

exports.app = onRequest(app);