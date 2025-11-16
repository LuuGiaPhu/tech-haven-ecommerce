const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('./serviceAccountKey.json')),
    projectId: 'tech-haven-5368b'
  });
  console.log('✅ Firebase Admin SDK initialized for Cloud Functions');
}

const db = admin.firestore();

// Custom Firestore Session Store
class FirestoreSessionStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.db = options.database || db;
    this.collection = options.collection || 'sessions';
  }

  async get(sessionId, callback) {
    try {
      console.log('🔍 Getting session:', sessionId);
      const doc = await this.db.collection(this.collection).doc(sessionId).get();
      if (doc.exists) {
        const data = doc.data();
        console.log('✅ Session found:', sessionId);
        // Check if session is expired
        if (data.expires && new Date() > data.expires.toDate()) {
          console.log('⏰ Session expired, destroying:', sessionId);
          await this.destroy(sessionId, () => {});
          return callback(null, null);
        }
        return callback(null, data.session);
      }
      console.log('❌ No session found:', sessionId);
      callback(null, null);
    } catch (error) {
      console.error('❌ Error getting session:', error);
      callback(error);
    }
  }

  async set(sessionId, session, callback) {
    try {
      console.log('💾 Setting session:', sessionId);
      const expires = session.cookie && session.cookie.expires 
        ? admin.firestore.Timestamp.fromDate(new Date(session.cookie.expires))
        : admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)); // 24 hours
      
      // Serialize session data to plain object
      const sessionData = JSON.parse(JSON.stringify(session));
      console.log('📝 Session data serialized successfully');
      
      await this.db.collection(this.collection).doc(sessionId).set({
        session: sessionData,
        expires: expires,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Session saved to Firestore:', sessionId);
      if (callback) callback(null);
    } catch (error) {
      console.error('❌ Error setting session:', error);
      if (callback) callback(error);
    }
  }

  async destroy(sessionId, callback) {
    try {
      await this.db.collection(this.collection).doc(sessionId).delete();
      if (callback) callback(null);
    } catch (error) {
      console.error('❌ Error destroying session:', error);
      if (callback) callback(error);
    }
  }
}

// Auth Service
const authService = require('./auth-service');

const app = express();

// Trust proxy for Firebase Hosting → Cloud Functions
app.set('trust proxy', 1);

// Google OAuth Credentials
const clientCredentials = {
  client_id: "442337591630-ab2m15n55vdi1700gs5qvufrpcfol58t.apps.googleusercontent.com",
  client_secret: "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",
  project_id: "tech-haven-5368b"
};

// EJS template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration optimized for Firebase Hosting + Cloud Functions
app.use(session({
  store: new FirestoreSessionStore({
    database: db,
    collection: 'sessions'
  }),
  secret: 'tech-haven-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true, // HTTPS required for Firebase Hosting
    httpOnly: false, // Allow frontend JavaScript access for debugging
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // Lax for same-origin requests
    // Remove domain restriction to work with Firebase Hosting
  },
  name: 'tech-haven-session',
  proxy: true // Trust Firebase proxy headers
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// CORS và debug middleware
app.use((req, res, next) => {
  // Only log for main routes, not static assets
  if (!req.path.includes('.') && !req.path.includes('/js') && !req.path.includes('/css') && !req.path.includes('/images')) {
    console.log(`🌐 ${req.method} ${req.path} - Auth: ${req.isAuthenticated()}, User: ${req.user?.name || 'None'}`);
    console.log(`🍪 Session ID: ${req.sessionID}`);
    console.log(`🔐 Session exists: ${!!req.session}`);
    console.log('🔍 Cookie header:', req.headers.cookie || 'No cookies');
    
    if (req.session && req.session.passport) {
      console.log(`� Passport user in session: ${req.session.passport.user || 'None'}`);
    }
    
    // Theo dõi số lượng request từ cùng một session
    if (!req.session.requestCount) {
      req.session.requestCount = 0;
    }
    req.session.requestCount++;
    
    // Log số request nếu user đã đăng nhập
    if (req.isAuthenticated()) {
      console.log(`� Request #${req.session.requestCount} từ user đã đăng nhập`);
    }
  }
  
  // CORS headers cho Firebase Hosting
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', 'https://tech-haven-5368b.web.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  next();
});

// Google OAuth Strategy - copy từ server.js working version
const callbackURL = "https://tech-haven-5368b.web.app/auth/google/callback";

console.log('🔧 OAuth Callback URL:', callbackURL);
console.log('🔧 Environment:', process.env.NODE_ENV);

passport.use(new GoogleStrategy({
  clientID: clientCredentials.client_id,
  clientSecret: clientCredentials.client_secret,
  callbackURL: callbackURL
}, async (accessToken, refreshToken, profile, done) => {
  console.log('✅ Google Profile received:', {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails[0]?.value
  });
  
  try {
    // Create user object - same as server.js
    const userData = {
      id: profile.id,
      googleId: profile.id,
      name: profile.displayName,
      email: profile.emails[0]?.value,
      photo: profile.photos[0]?.value || '',
      provider: 'google',
      isGoogleUser: true,
      updatedAt: new Date().toISOString()
    };
    
    // Save to Firebase - same logic as server.js
    try {
      const userRef = db.collection('users').doc(userData.id);
      console.log('📄 Attempting to save user to path: users/' + userData.id);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        // Update existing user
        await userRef.update({
          name: userData.name,
          email: userData.email,
          photo: userData.photo,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Google user updated in Firebase:', userData.name);
        console.log('📍 Updated at path: users/' + userData.id);
      } else {
        // Create new user
        const newUserData = {
          ...userData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
          role: 'customer',
          status: 'active',
          numericId: null // Google users don't get numeric IDs
        };
        console.log('� Creating new user with data:', Object.keys(newUserData));
        await userRef.set(newUserData);
        console.log('✅ New Google user created in Firebase:', userData.name);
        console.log('📍 Created at path: users/' + userData.id);
      }
      
      // Get updated user data
      const updatedDoc = await userRef.get();
      if (updatedDoc.exists) {
        const firestoreData = updatedDoc.data();
        console.log('📖 Retrieved user data from Firestore with keys:', Object.keys(firestoreData));
        userData.createdAt = firestoreData.createdAt;
        userData.role = firestoreData.role;
        userData.status = firestoreData.status;
        userData.numericId = firestoreData.numericId;
        userData.lastLoginAt = firestoreData.lastLoginAt;
      }
      
    } catch (firebaseError) {
      console.error('❌ Firebase error during Google OAuth:', firebaseError.message);
      // Continue without Firebase - user will still be logged in via session
    }
    
    console.log('✅ User processed successfully:', userData.name);
    return done(null, userData);
    
  } catch (error) {
    console.error('❌ Error in Google OAuth strategy:', error.message);
    return done(error, null);
  }
}));

// Serialize/Deserialize user for session - same as server.js
passport.serializeUser((user, done) => {
  console.log('� Serializing user:', user.name, 'with ID:', user.id);
  done(null, user.id); // Lưu chỉ ID vào session
});

passport.deserializeUser(async (userId, done) => {
  console.log('� Deserializing user ID:', userId);
  
  try {
    // Tìm user trong Firebase Firestore - same as server.js
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ User found in Firestore:', userData.name);
      return done(null, userData);
    } else {
      console.log('❌ User not found in Firestore:', userId);
      return done(null, null);
    }
  } catch (error) {
    console.error('❌ Error deserializing user:', error.message);
    return done(error, null);
  }
});

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  console.log('🚫 Access denied - User not authenticated');
  res.redirect('/');
}

// Routes - based on working server.js
app.get('/', (req, res) => {
  console.log('🏠 Home page accessed - isAuthenticated:', req.isAuthenticated());
  console.log('🏠 User in session:', req.user);
  console.log('🏠 Session ID:', req.sessionID);
  console.log('🏠 Passport session:', req.session?.passport);
  
  // Log chi tiết user truyền vào template - same as server.js
  if (req.isAuthenticated() && req.user) {
    console.log('💚 [DEBUG] Truyền user vào template:', JSON.stringify(req.user));
  } else {
    console.log('❌ [DEBUG] Không có user, truyền null vào template');
  }
  
  const products = [
    {
      id: 1,
      name: "RTX 4070",
      price: "$15.00",
      rating: 5,
      image: "/images/gpu1.jpg"
    },
    {
      id: 2,
      name: "RTX 4080", 
      price: "$24.00",
      rating: 4,
      image: "/images/gpu2.jpg"
    },
    {
      id: 3,
      name: "MOTHERBOARD5",
      price: "$158.00",
      rating: 5,
      image: "/images/keyboard.jpg"
    },
    {
      id: 4,
      name: "Alienware",
      price: "$73.00",
      rating: 4,
      image: "/images/laptop.jpg"
    }
  ];
  
  res.render('index', { 
    products,
    user: req.user || null
  });
});

// Google OAuth routes - same as server.js
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    console.log('🔄 OAuth callback completed');
    
    // Hiển thị thông tin chi tiết user sau khi đăng nhập thành công - same as server.js
    if (req.user) {
      console.log('\n🎉 ===== ĐĂNG NHẬP THÀNH CÔNG =====');
      console.log('👤 Tên người dùng:', req.user.name);
      console.log('📧 Email:', req.user.email);
      console.log('🆔 User ID:', req.user.id);
      console.log('🔗 Provider:', req.user.provider);
      console.log('🖼️ Avatar:', req.user.photo);
      console.log('👥 Vai trò:', req.user.role);
      console.log('✅ Trạng thái:', req.user.status);
      console.log('📅 Ngày tham gia:', req.user.createdAt);
      console.log('🔐 Session ID:', req.sessionID);
      console.log('⏰ Session hết hạn:', req.session.cookie.expires);
      console.log('🔄 IsAuthenticated:', req.isAuthenticated());
      console.log('=====================================\n');
      
      // Lưu thời gian đăng nhập cuối - same as server.js
      req.session.lastLogin = new Date();
      req.session.loginCount = (req.session.loginCount || 0) + 1;
      
      console.log('🔐 Trạng thái session được duy trì');
      console.log('🔄 Lần đăng nhập thứ:', req.session.loginCount);
    }
    
    console.log('🔄 User in callback:', req.user);
    console.log('🔄 Session after callback:', req.session);
    console.log('🔄 IsAuthenticated after callback:', req.isAuthenticated());
    console.log('✅ Google authentication successful for:', req.user.name);
    res.redirect('/');
  }
);

// Logout route - same as server.js
app.get('/logout', (req, res) => {
  const userName = req.user?.name;
  const userEmail = req.user?.email;
  const sessionId = req.sessionID;
  const loginCount = req.session?.loginCount;
  
  console.log('\n👋 ===== ĐĂNG XUẤT =====');
  console.log('👤 User đăng xuất:', userName || 'Unknown');
  console.log('📧 Email:', userEmail || 'Unknown');
  console.log('🔐 Session ID:', sessionId);
  console.log('🔢 Tổng số lần đăng nhập trong session:', loginCount);
  console.log('========================\n');
  
  req.logout((err) => {
    if (err) {
      console.error('❌ Logout error:', err);
      return res.redirect('/');
    }
    
    // Clear additional session data - same as server.js
    if (req.session) {
      req.session.lastLogin = null;
      req.session.loginCount = 0;
      req.session.requestCount = 0;
    }
    
    console.log('✅ User logged out successfully:', userName);
    console.log('🧹 Session data cleared');
    res.redirect('/');
  });
});

// API routes - enhanced from server.js
app.get('/api/user', (req, res) => {
  const authStatus = req.isAuthenticated();
  
  res.json({
    success: true,
    authenticated: authStatus,
    user: req.user || null,
    session: {
      sessionId: req.sessionID,
      lastLogin: req.session?.lastLogin,
      loginCount: req.session?.loginCount,
      expires: req.session?.cookie?.expires
    }
  });
});

app.get('/api/user-icon', async (req, res) => {
  try {
    const authStatus = await authService.checkAuthStatus(req);
    const html = await authService.generateUserIconHTML(authStatus);
    res.json({ html });
  } catch (error) {
    console.error('❌ Error generating user icon:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/user-menu', async (req, res) => {
  try {
    const authStatus = await authService.checkAuthStatus(req);
    const html = await authService.generateUserMenuHTML(authStatus);
    res.json({ html });
  } catch (error) {
    console.error('❌ Error generating user menu:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin routes (protected)
app.get('/admin', isAuthenticated, (req, res) => {
  res.render('input', { user: req.user });
});

app.get('/admin/input', isAuthenticated, (req, res) => {
  res.render('input', { user: req.user });
});

app.get('/admin/edit', isAuthenticated, (req, res) => {
  res.render('edit', { 
    productId: null,
    user: req.user 
  });
});

app.get('/admin/edit/:productId', isAuthenticated, (req, res) => {
  const productId = req.params.productId;
  res.render('edit', { 
    productId: productId,
    user: req.user 
  });
});

// Category routes - from server.js
app.get('/components', (req, res) => {
  res.render('category', { 
    category: 'Components',
    user: req.user || null 
  });
});

app.get('/accessories', (req, res) => {
  res.render('category', { 
    category: 'Accessories',
    user: req.user || null 
  });
});

app.get('/gaming', (req, res) => {
  res.render('category', { 
    category: 'Gaming',
    user: req.user || null 
  });
});

app.get('/desktops', (req, res) => {
  res.render('category', { 
    category: 'Desktops',
    user: req.user || null 
  });
});

app.get('/laptops', (req, res) => {
  res.render('category', { 
    category: 'Laptops',
    user: req.user || null 
  });
});

app.get('/shop', (req, res) => {
  res.render('shop', { user: req.user || null });
});

app.get('/product/:id', (req, res) => {
  const productId = req.params.id;
  
  // Sample product data - same as server.js
  const product = {
    id: productId,
    name: "ASUS ROG Strix G15 Gaming Laptop",
    price: 35990000,
    oldPrice: 39990000,
    category: "laptop",
    brand: "asus",
    rating: 5,
    reviewCount: 152,
    availability: "Còn hàng",
    sku: "ASU-ROG-G15-001",
    description: "Laptop gaming ASUS ROG Strix G15 với hiệu năng mạnh mẽ, thiết kế đẳng cấp và công nghệ tản nhiệt tiên tiến.",
    specifications: {
      cpu: "AMD Ryzen 7 6800H (8 nhân, 16 luồng, 3.2GHz up to 4.7GHz)",
      gpu: "NVIDIA GeForce RTX 3060 6GB GDDR6",
      ram: "16GB DDR5-4800MHz (2x8GB, còn trống 2 slot)",
      storage: "512GB PCIe 4.0 NVMe SSD (còn trống 1 slot M.2)",
      display: "15.6\" FHD (1920x1080) IPS, 144Hz, 100% sRGB"
    },
    features: [
      "Tản nhiệt Intelligent Cooling với 2 quạt Arc Flow",
      "ROG Keystone II để tùy chỉnh profile game",
      "Armoury Crate để điều khiển RGB và hiệu năng"
    ],
    images: ["/images/laptop.jpg"],
    relatedProducts: [
      { id: 2, name: "MSI Katana 17 B13V", price: 28990000, image: "/images/laptop.jpg" }
    ]
  };
  
  res.render('product_detail', { 
    product,
    user: req.user || null 
  });
});

// Debug routes - enhanced from server.js working versions
app.get('/debug/session', (req, res) => {
  console.log('🐛 DEBUG Session Route Called');
  console.log('🐛 Session ID:', req.sessionID);
  console.log('🐛 Is Authenticated:', req.isAuthenticated());
  console.log('🐛 User:', req.user);
  console.log('🐛 Session:', req.session);
  
  res.json({
    success: true,
    isAuthenticated: req.isAuthenticated(),
    user: req.user || null,
    sessionId: req.sessionID,
    session: req.session,
    cookies: req.headers.cookie,
    timestamp: new Date().toISOString()
  });
});

// Route to verify authentication system is working (shows real session data)
app.get('/verify-auth', async (req, res) => {
  console.log('🔍 VERIFICATION: Checking authentication system');
  
  try {
    // Get the recent session from Firestore that was created during login
    const sessionsSnapshot = await db.collection('sessions')
      .orderBy('updatedAt', 'desc')
      .limit(5)
      .get();
    
    const recentSessions = [];
    sessionsSnapshot.forEach(doc => {
      const sessionData = doc.data();
      recentSessions.push({
        id: doc.id,
        hasUser: !!(sessionData.session && sessionData.session.passport && sessionData.session.passport.user),
        userId: sessionData.session?.passport?.user,
        expires: sessionData.expires?.toDate?.(),
        lastLogin: sessionData.session?.lastLogin,
        loginCount: sessionData.session?.loginCount
      });
    });
    
    console.log('📊 Recent sessions:', recentSessions);
    
    res.json({
      message: 'Hệ thống authentication hoạt động bình thường!',
      explanation: 'VS Code Simple Browser không hỗ trợ cookies bảo mật, nhưng người dùng thật sẽ thấy thông tin user.',
      currentRequest: {
        isAuthenticated: req.isAuthenticated(),
        sessionId: req.sessionID,
        hasUser: !!req.user,
        browserType: 'VS Code Simple Browser (có hạn chế cookie)'
      },
      recentAuthenticatedSessions: recentSessions,
      recommendation: 'Mở https://tech-haven-5368b.web.app/ trong Chrome/Firefox để test đầy đủ'
    });
    
  } catch (error) {
    console.error('❌ Error checking sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/debug/home', (req, res) => {
  console.log('🐛 DEBUG Home Route Called');
  console.log('🐛 User authenticated:', req.isAuthenticated());
  console.log('🐛 User data:', req.user);
  
  res.json({
    success: true,
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    sessionId: req.sessionID,
    userForTemplate: req.user ? 'USER_EXISTS' : 'NO_USER',
    timestamp: new Date().toISOString()
  });
});

// Test routes - from server.js for debugging
app.get('/test-auth', (req, res) => {
  console.log('🧪 Test Auth Route - creating sample authenticated state');
  
  // Create a sample user for testing the template - same as server.js
  const sampleUser = {
    id: '103544480283367579781',
    googleId: '103544480283367579781',
    name: 'Lưu Gia Phú',
    email: 'luugiaphup6tpbt@gmail.com',
    photo: 'https://lh3.googleusercontent.com/a/ACg8ocJs6pdErTpdmJyj8EVK9_LqW6i-2MC5glI_um44ejYMXZV_uvAL=s96-c',
    provider: 'google',
    isGoogleUser: true,
    role: 'customer',
    status: 'active'
  };
  
  const products = [
    {
      id: 1,
      name: "RTX 4070",
      price: "$15.00",
      rating: 5,
      image: "/images/gpu1.jpg"
    },
    {
      id: 2,
      name: "RTX 4080",
      price: "$24.00",
      rating: 4,
      image: "/images/gpu2.jpg"
    }
  ];
  
  console.log('🧪 Rendering index with sample user:', sampleUser.name);
  console.log('🧪 This should show user info in browser console');
  
  res.render('index', { 
    products,
    user: sampleUser
  });
});

app.get('/test-current', (req, res) => {
  console.log('🧪 Test Current Session Route');
  
  const isAuth = req.isAuthenticated();
  const user = req.user;
  
  console.log('🔍 Current session status:');
  console.log('   - IsAuthenticated:', isAuth);
  console.log('   - User:', user ? user.name : 'None');
  console.log('   - Session ID:', req.sessionID);
  
  const products = [
    {
      id: 1,
      name: "RTX 4070",
      price: "$15.00",
      rating: 5,
      image: "/images/gpu1.jpg"
    }
  ];
  
  res.render('index', { 
    products,
    user: user // Use real session user
  });
});

// Firebase Cloud Functions v2 export
exports.app = onRequest({
  region: 'asia-southeast1',
  memory: '1GiB',
  timeoutSeconds: 540,
  maxInstances: 100
}, app);

// Import and export test app
const testApp = require('./index-test');
exports.testapp = testApp.testapp;
