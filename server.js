const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');

// Firebase Admin configuration
const { db, admin, firebaseInitialized } = require('./firebase-admin-config');

// Auth Service
const authService = require('./auth-service');

const app = express();

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
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  secret: 'tech-haven-secret-key-2025',
  resave: false, // Không force save session
  saveUninitialized: false, // Không lưu session chưa có dữ liệu
  cookie: { 
    secure: false, // HTTP cho localhost
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  name: 'tech-haven-session'
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// ✅ Enhanced Google OAuth Strategy - WITH FIREBASE INTEGRATION
passport.use(new GoogleStrategy({
  clientID: clientCredentials.client_id,
  clientSecret: clientCredentials.client_secret,
  callbackURL: "http://localhost:3000/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  console.log('✅ Google Profile received:', {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails[0]?.value
  });
  
  try {
    // Create user object
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
    
    // Save to Firebase if available
    if (firebaseInitialized && db) {
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('✅ Google user updated in Firebase:', userData.name);
          console.log('📍 Updated at path: users/' + userData.id);
        } else {
          // Create new user
          const newUserData = {
            ...userData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            role: 'customer',
            status: 'active',
            numericId: null // Google users don't get numeric IDs
          };
          console.log('💾 Creating new user with data:', Object.keys(newUserData));
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
        }
        
      } catch (firebaseError) {
        console.error('❌ Firebase error during Google OAuth:', firebaseError.message);
        // Continue without Firebase - user will still be logged in via session
      }
    } else {
      console.log('⚠️ Firebase not available - user saved to session only');
    }
    
    console.log('✅ User processed successfully:', userData.name);
    return done(null, userData);
    
  } catch (error) {
    console.error('❌ Error in Google OAuth strategy:', error.message);
    return done(error, null);
  }
}));

// Serialize/Deserialize user for session
passport.serializeUser((user, done) => {
  console.log('📝 Serializing user:', user.name, 'with ID:', user.id);
  done(null, user.id); // Lưu chỉ ID vào session
});

passport.deserializeUser(async (userId, done) => {
  console.log('📖 Deserializing user ID:', userId);
  
  try {
    if (firebaseInitialized && db) {
      // Tìm user trong Firebase Firestore
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
    } else {
      console.log('⚠️ Firebase not available for deserialization');
      return done(null, null);
    }
  } catch (error) {
    console.error('❌ Error deserializing user:', error.message);
    return done(error, null);
  }
});

// Session debugging middleware
app.use((req, res, next) => {
  // Only log for main routes, not static assets
  if (!req.path.includes('.') && !req.path.includes('/js') && !req.path.includes('/css') && !req.path.includes('/images')) {
    console.log(`🌐 ${req.method} ${req.path} - Auth: ${req.isAuthenticated()}, User: ${req.user?.name || 'None'}`);
    console.log(`🍪 Session ID: ${req.sessionID}`);
    console.log(`🔐 Session exists: ${!!req.session}`);
    
    if (req.session && req.session.passport) {
      console.log(`👤 Passport user in session: ${req.session.passport.user?.name || 'None'}`);
    }
    
    // Theo dõi số lượng request từ cùng một session
    if (!req.session.requestCount) {
      req.session.requestCount = 0;
    }
    req.session.requestCount++;
    
    // Log số request nếu user đã đăng nhập
    if (req.isAuthenticated()) {
      console.log(`📊 Request #${req.session.requestCount} từ user đã đăng nhập`);
    }
  }
  next();
});

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// =====================================
// ROUTES
// =====================================

// Home page
app.get('/', (req, res) => {
  console.log('🏠 Home page accessed - isAuthenticated:', req.isAuthenticated());
  console.log('🏠 User in session:', req.user);
  console.log('🏠 Session ID:', req.sessionID);
  console.log('🏠 Passport session:', req.session?.passport);
  // Log chi tiết user truyền vào template
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

// Google OAuth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    console.log('🔄 OAuth callback completed');
    
    // Hiển thị thông tin chi tiết user sau khi đăng nhập thành công
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
      
      // Lưu thời gian đăng nhập cuối
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

// Logout route
app.get('/logout', (req, res) => {
  const userName = req.user?.name;
  const userEmail = req.user?.email;
  const sessionId = req.sessionID;
  const loginCount = req.session.loginCount;
  
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
    
    // Clear additional session data
    req.session.lastLogin = null;
    req.session.loginCount = 0;
    req.session.requestCount = 0;
    
    console.log('✅ User logged out successfully:', userName);
    console.log('🧹 Session data cleared');
    res.redirect('/');
  });
});

// API route for user info (Enhanced with AuthService)
app.get('/api/user', (req, res) => {
  authService.logUserActivity(req, 'API_USER_REQUEST');
  const authStatus = authService.checkAuthStatus(req);
  
  res.json({
    success: true,
    authenticated: authStatus.authenticated,
    user: authStatus.user,
    session: {
      sessionId: authStatus.sessionId,
      lastLogin: req.session.lastLogin,
      loginCount: req.session.loginCount,
      expires: req.session.cookie.expires
    }
  });
});

// API route for user icon HTML
app.get('/api/user-icon', (req, res) => {
  authService.logUserActivity(req, 'API_USER_ICON_REQUEST');
  const iconHTML = authService.generateUserIconHTML(req);
  
  res.json({
    success: true,
    html: iconHTML,
    authenticated: req.isAuthenticated()
  });
});

// API route for user menu HTML
app.get('/api/user-menu', (req, res) => {
  authService.logUserActivity(req, 'API_USER_MENU_REQUEST');
  const menuHTML = authService.generateUserMenuHTML(req);
  
  res.json({
    success: true,
    html: menuHTML,
    authenticated: req.isAuthenticated()
  });
});

// Debug frontend route - always returns user data
app.get('/debug-frontend', (req, res) => {
    console.log('🐛 Debug Frontend Route');
    
    // Force user data for testing frontend
    const debugUser = {
        id: '103544480283367579781',
        googleId: '103544480283367579781', 
        name: 'Lưu Gia Phú (Debug Mode)',
        email: 'luugiaphup6tpbt@gmail.com',
        photo: 'https://lh3.googleusercontent.com/a/ACg8ocJs6pdErTpdmJyj8EVK9_LqW6i-2MC5glI_um44ejYMXZV_uvAL=s96-c',
        provider: 'google',
        role: 'customer',
        status: 'active'
    };
    
    const products = [];
    
    console.log('🐛 Rendering debug frontend with forced user data');
    console.log('🐛 This should show user info in browser console');
    
    res.render('index', { 
        products,
        user: debugUser
    });
});

// Debug route to check session
app.get('/debug/session', (req, res) => {
  res.json({
    isAuthenticated: req.isAuthenticated(),
    user: req.user || null,
    session: req.session,
    sessionID: req.sessionID,
    cookies: req.headers.cookie
  });
});

// Debug route to check home page rendering
app.get('/debug/home', (req, res) => {
  console.log('🏠 DEBUG Home - Auth:', req.isAuthenticated(), 'User:', req.user?.name);
  res.json({
    isAuthenticated: req.isAuthenticated(),
    user: req.user || null,
    userForTemplate: req.user ? 'USER_DATA_EXISTS' : null
  });
});

// Test authenticated state route
app.get('/test-auth', (req, res) => {
    console.log('🧪 Test Auth Route - creating sample authenticated state');
    
    // Create a sample user for testing the template
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

// Route to test current session
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

// Test Firebase connection
app.get('/debug/firebase', async (req, res) => {
  try {
    if (!firebaseInitialized || !db) {
      return res.json({ error: 'Firebase not initialized', firebaseInitialized });
    }
    
    // Test creating a test document
    const testRef = db.collection('test').doc('connection-test');
    await testRef.set({
      message: 'Firebase connection working!',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      testId: Date.now()
    });
    
    // Try to read it back
    const testDoc = await testRef.get();
    const testData = testDoc.data();
    
    // Clean up
    await testRef.delete();
    
    res.json({
      success: true,
      message: 'Firebase connection successful!',
      testData,
      firebaseInitialized,
      projectId: process.env.FIREBASE_PROJECT_ID || 'tech-haven-5368b'
    });
    
  } catch (error) {
    res.json({
      error: error.message,
      stack: error.stack,
      firebaseInitialized
    });
  }
});

// API routes for user registration/login (for non-Google users)
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    
    if (!firebaseInitialized || !db) {
      return res.status(500).json({ error: 'Hệ thống database chưa sẵn sàng' });
    }
    
    try {
      // Check if email already exists
      const existingUserQuery = await db.collection('users')
        .where('email', '==', email)
        .get();
      
      if (!existingUserQuery.empty) {
        return res.status(400).json({ error: 'Email đã được sử dụng' });
      }
      
      // Get next numeric ID
      const usersQuery = await db.collection('users')
        .where('numericId', '!=', null)
        .orderBy('numericId', 'desc')
        .limit(1)
        .get();
      
      let nextId = 1;
      if (!usersQuery.empty) {
        const highestUser = usersQuery.docs[0].data();
        nextId = (highestUser.numericId || 0) + 1;
      }
      
      // Create user
      const userId = `user_${nextId}`;
      const userData = {
        id: userId,
        numericId: nextId,
        name,
        email,
        password, // In production, hash this password!
        provider: 'local',
        isGoogleUser: false,
        role: 'customer',
        status: 'active',
        photo: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('users').doc(userId).set(userData);
      
      // Return user data without password
      const { password: _, ...userResponse } = userData;
      
      res.json({ 
        success: true, 
        message: 'Đăng ký thành công',
        user: userResponse
      });
      
    } catch (firebaseError) {
      console.error('Firebase error during registration:', firebaseError);
      res.status(500).json({ error: 'Lỗi hệ thống khi đăng ký' });
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' });
    }
    
    if (!firebaseInitialized || !db) {
      return res.status(500).json({ error: 'Hệ thống database chưa sẵn sàng' });
    }
    
    try {
      // Find user by email
      const userQuery = await db.collection('users')
        .where('email', '==', email)
        .where('provider', '==', 'local')
        .get();
      
      if (userQuery.empty) {
        return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
      }
      
      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      
      // In production, use proper password hashing (bcrypt)
      if (userData.password !== password) {
        return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
      }
      
      // Return user data without password
      const { password: _, ...userResponse } = userData;
      
      res.json({ 
        success: true, 
        message: 'Đăng nhập thành công',
        user: userResponse
      });
      
    } catch (firebaseError) {
      console.error('Firebase error during login:', firebaseError);
      res.status(500).json({ error: 'Lỗi hệ thống khi đăng nhập' });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Category routes
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
    
    // Sample product data
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

app.get('/category/:categoryName', (req, res) => {
    const categoryName = req.params.categoryName;
    res.render('category', { 
        categoryName: categoryName,
        user: req.user || null 
    });
});

// Admin routes (protected)
app.get('/admin', isAuthenticated, (req, res) => {
    res.render('input', { user: req.user });
});

// Route cho /admin/input
app.get('/admin/input', isAuthenticated, (req, res) => {
    res.render('input', { user: req.user });
});

// Route cho /admin/edit (danh sách sản phẩm để edit)
app.get('/admin/edit', isAuthenticated, (req, res) => {
    res.render('edit', { 
        productId: null, // Không có productId cụ thể, hiển thị danh sách
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

// Other routes
app.get('/components', (req, res) => {
    res.render('category', { 
        category: 'Components',
        user: req.user || null 
    });
});

app.get('/peripherals', (req, res) => {
    res.render('category', { 
        category: 'Peripherals',
        user: req.user || null 
    });
});

app.get('/build-pc', (req, res) => {
    res.render('category', { 
        category: 'Build PC',
        user: req.user || null 
    });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`🔐 Google OAuth2 được cấu hình với Client ID: ${clientCredentials.client_id.substring(0, 25)}...`);
    console.log(`✅ Redirect URI: http://localhost:${PORT}/auth/google/callback`);
    console.log(`📱 Để đăng nhập với Google, truy cập: http://localhost:${PORT}/auth/google`);
    
    if (firebaseInitialized) {
        console.log('✅ Firebase Admin SDK integrated successfully');
        console.log('📊 User data will be saved to Firestore');
    } else {
        console.log('⚠️ Firebase not available - using session-only storage');
    }
});