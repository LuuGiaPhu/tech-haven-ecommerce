const express = require('express');
const compression = require('compression');
const path = require('path');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Elasticsearch modules
const { 
  initializeElasticsearch, 
  checkElasticsearchConnection,
  createProductsIndex 
} = require('./elasticsearch-config');
const { 
  syncAllProducts,
  setupFirestoreListeners 
} = require('./elasticsearch-sync');
const {
  searchProducts,
  autocomplete,
  findSimilarProducts,
  getPopularSearchTerms
} = require('./elasticsearch-search');

// Check if running locally or on Firebase
// During deployment/emulator: FUNCTIONS_EMULATOR or FIREBASE_CONFIG is set
// During local dev with npm start: NODE_ENV=development is set
const isLocal = process.env.NODE_ENV === 'development' && 
                !process.env.FUNCTIONS_EMULATOR && 
                !process.env.FIREBASE_CONFIG;
console.log('🌍 Environment:', isLocal ? 'Local Development' : 'Firebase Functions');

// Only require Firebase Functions when not running locally
let functions, onRequest, onSchedule;
if (!isLocal) {
  functions = require('firebase-functions');
  ({ onRequest } = require('firebase-functions/v2/https'));
  ({ onSchedule } = require('firebase-functions/v2/scheduler'));
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountPath = isLocal 
      ? path.join(__dirname, 'serviceAccountKey.json')
      : './serviceAccountKey.json';
    
    const serviceAccount = require(serviceAccountPath);
    
    console.log('🔑 Service Account Email:', serviceAccount.client_email);
    console.log('🆔 Project ID:', serviceAccount.project_id);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('✅ Firebase Admin SDK initialized');
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    throw error;
  }
}

const db = admin.firestore();
const auth = admin.auth();

// =====================================
// AUTO-UPDATE BILL STATUS SCHEDULER
// =====================================
// This function runs every hour to check and update bill statuses:
// pending -> processing (after 1 minute)
// processing -> shipping (after 30 minutes)
// shipping -> delivered (after 3 days) - Đã Giao (waiting for customer confirmation)
// delivered -> completed (manual confirmation by user via "Xác Nhận Đã Nhận" button)
// 
// Schedule: every 1 hours (720 times/month vs 43,200 times/month with every 1 minute)
// Cost savings: ~98% reduction in Cloud Scheduler invocations

if (!isLocal && onSchedule) {
  // Cloud Scheduler function - runs every hour
  exports.updateBillStatuses = onSchedule({
    schedule: 'every 1 hours',
    timeZone: 'Asia/Ho_Chi_Minh',
    memory: '256MiB'
  }, async (event) => {
    console.log('🔄 Starting bill status update check...');
    
    try {
      const now = admin.firestore.Timestamp.now();
      const oneMinuteAgo = new Date(now.toDate().getTime() - 1 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.toDate().getTime() - 30 * 60 * 1000);
      const threeDaysAgo = new Date(now.toDate().getTime() - 3 * 24 * 60 * 60 * 1000);
      
      let updateCount = 0;
      
      // 1. Update pending -> processing (after 1 minute)
      const pendingBills = await db.collection('bills')
        .where('status', '==', 'pending')
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(oneMinuteAgo))
        .get();
      
      for (const doc of pendingBills.docs) {
        const billData = doc.data();
        // Skip if bill is cancelled
        if (billData.status === 'cancelled') {
          console.log(`⏭️ Skipping cancelled bill ${doc.id}`);
          continue;
        }
        
        await doc.ref.update({
          status: 'processing',
          updatedAt: now
        });
        updateCount++;
        console.log(`✅ Updated bill ${doc.id}: pending -> processing`);
      }
      
      // 2. Update processing -> shipping (after 30 minutes from creation)
      const processingBills = await db.collection('bills')
        .where('status', '==', 'processing')
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(thirtyMinutesAgo))
        .get();
      
      for (const doc of processingBills.docs) {
        const billData = doc.data();
        // Skip if bill is cancelled
        if (billData.status === 'cancelled') {
          console.log(`⏭️ Skipping cancelled bill ${doc.id}`);
          continue;
        }
        
        await doc.ref.update({
          status: 'shipping',
          updatedAt: now
        });
        updateCount++;
        console.log(`✅ Updated bill ${doc.id}: processing -> shipping`);
      }
      
      // 3. Update shipping -> delivered (after 3 days from creation)
      const shippingBills = await db.collection('bills')
        .where('status', '==', 'shipping')
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(threeDaysAgo))
        .get();
      
      for (const doc of shippingBills.docs) {
        const billData = doc.data();
        // Skip if bill is cancelled
        if (billData.status === 'cancelled') {
          console.log(`⏭️ Skipping cancelled bill ${doc.id}`);
          continue;
        }
        
        await doc.ref.update({
          status: 'delivered',
          deliveredAt: now,
          updatedAt: now
        });
        updateCount++;
        console.log(`✅ Updated bill ${doc.id}: shipping -> delivered`);
      }
      
      console.log(`✨ Bill status update complete! Updated ${updateCount} bills.`);
      return null;
      
    } catch (error) {
      console.error('❌ Error updating bill statuses:', error);
      return null;
    }
  });
}

const app = express();

// Enable gzip compression for all responses (saves ~317 KiB)
app.use(compression({
  // Compression level (1-9): 6 is default, balanced between speed and compression ratio
  level: 6,
  // Only compress responses larger than 1kb
  threshold: 1024,
  // Filter function to decide what to compress
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      // Don't compress if client explicitly requests
      return false;
    }
    // Use compression's default filter function
    return compression.filter(req, res);
  }
}));

// Express configuration
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sitemap routes with proper content-type
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

app.get('/sitemap_4623456.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'public', 'sitemap_4623456.xml'));
});

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
    console.log('🔐 Verifying ID token... (length:', idToken.length, ')');
    console.log('🔐 Token preview:', idToken.substring(0, 50) + '...');
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log('✅ Token verified for user:', decodedToken.name, 'UID:', decodedToken.uid);
    
    // First check if this is a Firebase UID or if we need to find by firebaseUid
    let userRef;
    let userDoc;
    let userData;
    
    // Try to find user by Firebase UID first (Google users)
    userRef = db.collection('users').doc(decodedToken.uid);
    userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      // If not found, try to find by firebaseUid field (manual login users)
      console.log('🔍 User not found by Firebase UID, searching by firebaseUid field...');
      const userQuery = await db.collection('users').where('firebaseUid', '==', decodedToken.uid).limit(1).get();
      
      if (!userQuery.empty) {
        console.log('✅ Found user by firebaseUid field');
        userDoc = userQuery.docs[0];
        userRef = userDoc.ref;
        userData = userDoc.data();
      } else {
        // Create new Google user if not found at all
        console.log('📝 Creating new Google user profile...');
        const newUserData = {
          uid: decodedToken.uid,
          firebaseUid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name,
          photo: decodedToken.picture,
          provider: 'google',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
          // Additional fields for e-commerce
          preferences: {
            currency: 'VND',
            language: 'vi',
            notifications: true
          },
          profile: {
            isActive: true,
            membershipLevel: 'bronze',
            totalOrders: 0,
            totalSpent: 0
          },
          addresses: [],
          wishlist: [],
          is_admin: false,
          hasSeenWelcomeModal: false // Track if user has seen welcome address modal
        };
        
        await userRef.set(newUserData);
        console.log('✅ Created new Google user profile in Firestore:', decodedToken.name);
        userData = newUserData;
      }
    } else {
      userData = userDoc.data();
    }

    // Update last login time and ensure all required fields exist
    const updateData = {
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      // Update user info in case it changed
      name: decodedToken.name,
      email: decodedToken.email
    };
    
    // Only update photo if it exists (Google users have pictures, manual users don't)
    if (decodedToken.picture) {
      updateData.photo = decodedToken.picture;
    }
    
    // Add missing fields for existing users, but preserve is_admin if it exists
    if (!userData.preferences) {
      updateData.preferences = {
        currency: 'VND',
        language: 'vi',
        notifications: true
      };
    }
    if (!userData.profile) {
      updateData.profile = {
        isActive: true,
        membershipLevel: 'bronze',
        totalOrders: userData.totalOrders || 0,
        totalSpent: userData.totalSpent || 0
      };
    }
    if (!userData.addresses) {
      updateData.addresses = [];
    }
    if (!userData.wishlist) {
      updateData.wishlist = [];
    }
    // Only set is_admin to false if it doesn't exist - preserve existing value
    if (typeof userData.is_admin === 'undefined') {
      updateData.is_admin = false;
    }
    
    await userRef.update(updateData);
    console.log('🔄 Updated user profile in Firestore:', userData.name, '- Admin:', userData.is_admin || false);
    
    // Get fresh user data after update to ensure we have the latest is_admin value
    const freshUserDoc = await userRef.get();
    const freshUserData = freshUserDoc.data();
    
    req.user = {
      uid: freshUserData.uid || decodedToken.uid, // Use database uid for manual users, Firebase uid for Google users
      email: decodedToken.email,
      name: decodedToken.name,
      photo: decodedToken.picture,
      provider: decodedToken.firebase.sign_in_provider,
      is_admin: freshUserData.is_admin || false
    };
    
    console.log('👤 User API called - User:', req.user.name, '- Admin status:', req.user.is_admin);
    
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error stack:', error.stack);
    req.user = null;
  }
  
  next();
}

// Middleware to check admin privileges
async function requireAdmin(req, res, next) {
  // Check if token is in query parameter (for direct navigation)
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
    console.log('🔑 Using token from query parameter');
  }
  
  // First verify token
  await new Promise((resolve) => {
    verifyToken(req, res, resolve);
  });
  
  if (!req.user) {
    console.log('❌ requireAdmin: No user found in req.user');
    
    // Check if it's an API request or web request
    const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
    
    if (acceptsJson) {
      return res.status(401).json({ 
        error: 'Authentication required for admin access',
        message: 'Please log in to access this page'
      });
    } else {
      // For web requests, redirect to home with error message
      return res.redirect('/?error=login_required&message=' + encodeURIComponent('Please log in to access admin pages'));
    }
  }
  
  console.log('🔍 requireAdmin: User found:', req.user.name, '- Admin status:', req.user.is_admin);
  
  if (!req.user.is_admin) {
    console.log('❌ requireAdmin: User is not admin');
    
    const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
    
    if (acceptsJson) {
      return res.status(403).json({ 
        error: 'Admin privileges required',
        message: 'You do not have permission to access this page',
        user: {
          name: req.user.name,
          email: req.user.email,
          is_admin: req.user.is_admin
        }
      });
    } else {
      // For web requests, redirect to home with error message
      return res.redirect('/?error=admin_required&message=' + encodeURIComponent('You do not have admin privileges to access this page'));
    }
  }
  
  console.log('✅ Admin access granted to:', req.user.name);
  next();
}

// Routes
app.get('/', async (req, res) => {
  console.log('🏠 Home page - rendering with Firebase Auth support');
  
  try {
    // Pass URL query parameters for error messages
    const errorParams = {
      error: req.query.error,
      message: req.query.message
    };
    
    // Helper function to filter out variant products (products with parent_id_product)
    const filterVariants = (products) => {
      return products.filter(product => !product.parent_id_product);
    };
    
    // Fetch products by category from Firestore
    const [monitorProductsRaw, storageOnlyProductsRaw, ramProductsRaw, newProductsRaw, bestSellersRaw, laptopsRaw] = await Promise.all([
      // Monitors (category = 'monitor')
      db.collection('products')
        .where('category', '==', 'monitor')
        .limit(30) // Fetch more to compensate for variant filtering
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      
      // Storage (category = 'storage')
      db.collection('products')
        .where('category', '==', 'storage')
        .limit(15) // Fetch more to compensate for variant filtering
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      
      // RAM (category = 'ram')
      db.collection('products')
        .where('category', '==', 'ram')
        .limit(15) // Fetch more to compensate for variant filtering
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      
      // New Products - latest 10 products
      db.collection('products')
        .orderBy('created_at', 'desc')
        .limit(30) // Fetch more to compensate for variant filtering
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      
      // Best Sellers - products with highest views/sales (fallback to all products)
      db.collection('products')
        .limit(30) // Fetch more to compensate for variant filtering
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      
      // Laptops (category = 'laptop')
      db.collection('products')
        .where('category', '==', 'laptop')
        .limit(30) // Fetch more to compensate for variant filtering
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    ]);
    
    // Filter out variants and limit to desired count
    const monitorProducts = filterVariants(monitorProductsRaw).slice(0, 10);
    const storageOnlyProducts = filterVariants(storageOnlyProductsRaw).slice(0, 5);
    const ramProducts = filterVariants(ramProductsRaw).slice(0, 5);
    const newProducts = filterVariants(newProductsRaw).slice(0, 10);
    const bestSellers = filterVariants(bestSellersRaw).slice(0, 10);
    const laptops = filterVariants(laptopsRaw).slice(0, 10);
    
    // Combine storage and RAM products
    const storageProducts = [...storageOnlyProducts, ...ramProducts];
    
    console.log(`📊 Fetched products - Monitors: ${monitorProducts.length}, Storage: ${storageProducts.length}`);
    
    res.render('index', { 
      monitorProducts,
      storageProducts,
      newProducts,
      bestSellers,
      laptops,
      user: null, // Client-side will handle user state
      isAuthenticated: false, // Client-side will handle auth state
      ...errorParams // Pass error parameters to template
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    // Fallback to empty arrays if error occurs
    res.render('index', { 
      monitorProducts: [],
      storageProducts: [],
      newProducts: [],
      bestSellers: [],
      laptops: [],
      user: null,
      isAuthenticated: false,
      error: req.query.error,
      message: req.query.message
    });
  }
});

// Category routes
app.get('/components', (req, res) => {
  res.render('category', { 
    category: 'Components',
    user: null 
  });
});

app.get('/accessories', (req, res) => {
  res.render('category', { 
    category: 'Accessories',
    user: null 
  });
});

app.get('/gaming', (req, res) => {
  res.render('category', { 
    category: 'Gaming',
    user: null 
  });
});

app.get('/desktops', (req, res) => {
  res.render('category', { 
    category: 'Desktops',
    user: null 
  });
});

app.get('/laptops', (req, res) => {
  res.render('category', { 
    category: 'Laptops',
    user: null 
  });
});

app.get('/shop', (req, res) => {
  res.render('shop', { user: null });
});

// SEO: Dynamic Sitemap Generator
app.get('/sitemap.xml', async (req, res) => {
  try {
    console.log('🗺️ Generating dynamic sitemap...');
    
    // Helper function to escape XML special characters
    const escapeXml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    // Get all active products
    const productsSnapshot = await db.collection('products')
      .where('status', '==', 'active')
      .get();
    
    const products = [];
    productsSnapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  
  <!-- Homepage -->
  <url>
    <loc>https://tech-haven-5368b.web.app/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Shop Page -->
  <url>
    <loc>https://tech-haven-5368b.web.app/shop</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  
  <!-- Product Pages -->`;
    
    products.forEach(product => {
      const lastmod = product.updatedAt ? 
        new Date(product.updatedAt.toDate()).toISOString().split('T')[0] : 
        new Date().toISOString().split('T')[0];
      
      sitemap += `
  <url>
    <loc>https://tech-haven-5368b.web.app/product/${escapeXml(product.id)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>`;
      
      // Add product images
      if (product.images && product.images.length > 0) {
        product.images.forEach(imageUrl => {
          sitemap += `
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapeXml(product.name)}</image:title>
    </image:image>`;
        });
      }
      
      sitemap += `
  </url>`;
    });
    
    // Add category pages
    const categories = ['laptop', 'pc', 'components', 'accessories'];
    categories.forEach(category => {
      sitemap += `
  <url>
    <loc>https://tech-haven-5368b.web.app/shop?category=${escapeXml(category)}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });
    
    sitemap += `
</urlset>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
    
    console.log(`✅ Sitemap generated with ${products.length} products`);
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// SEO: Ping Google to update sitemap
app.get('/ping-sitemap', async (req, res) => {
  try {
    const sitemapUrl = 'https://tech-haven-5368b.web.app/sitemap.xml';
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    
    console.log('📡 Pinging Google with sitemap:', sitemapUrl);
    
    res.json({
      success: true,
      message: 'Sitemap ping initiated',
      pingUrl: pingUrl,
      instructions: `Visit this URL in browser to notify Google: ${pingUrl}`
    });
  } catch (error) {
    console.error('❌ Error pinging sitemap:', error);
    res.status(500).json({ error: 'Error pinging sitemap' });
  }
});

// Edit Profile route
app.get('/edit-profile', (req, res) => {
  res.render('edit-profile', { user: null });
});

// Bill Detail route (Order History)
app.get('/bill-detail', (req, res) => {
  res.render('bill_detail', { user: null });
});

// Admin Bill Management route (View ALL orders)
app.get('/bill_detail_admin', (req, res) => {
  res.render('bill_detail_admin', { user: null });
});

// Route to view specific bill/order details
app.get('/bill/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log('📋 Loading bill details for:', orderId);

    // Get bill from Firebase
    const billDoc = await db.collection('bills').doc(orderId).get();

    if (!billDoc.exists) {
      console.log('❌ Bill not found:', orderId);
      return res.status(404).render('404', { 
        message: 'Đơn hàng không tồn tại',
        user: null 
      });
    }

    const billData = billDoc.data();
    console.log('✅ Bill loaded:', orderId);

    // Format bill data for the template
    const bill = {
      id: orderId,
      orderId: billData.orderId || orderId,
      ...billData
    };

    // Render the bill detail page with the specific order
    res.render('bill_detail', { 
      user: null,
      selectedOrder: bill // Pass the order to pre-populate the page
    });

  } catch (error) {
    console.error('❌ Error loading bill:', error);
    res.status(500).render('404', { 
      message: 'Có lỗi khi tải thông tin đơn hàng',
      user: null 
    });
  }
});

app.get('/product/:id', async (req, res) => {
  const productId = req.params.id;
  
  try {
    console.log('📦 Loading product:', productId);
    
    // Get product from Firebase
    const productDoc = await db.collection('products').doc(productId).get();
    
    if (!productDoc.exists) {
      console.log('❌ Product not found:', productId);
      return res.status(404).render('404', { 
        message: 'Sản phẩm không tồn tại',
        user: null 
      });
    }
    
    const productData = productDoc.data();
    console.log('✅ Product loaded:', productData.name);
    
    // Format product data for frontend
    const product = {
      id: productId,
      name: productData.name || 'Sản phẩm không tên',
      price: productData.price || 0,
      oldPrice: productData.oldPrice || null,
      category: productData.category || 'other',
      brand: productData.brand || 'Unknown',
      rating: productData.rating || 5,
      reviewCount: productData.reviewCount || 0,
      availability: productData.availability === 'in-stock' ? 'Còn hàng' : 
                   productData.availability === 'out-of-stock' ? 'Hết hàng' : 'Không xác định',
      stock: productData.stock || 0,
      sku: productData.sku || productId,
      description: productData.description || 'Không có mô tả',
      specifications: productData.specifications || {},
      features: productData.features || [],
      images: productData.images || [],
      status: productData.status || 'active'
    };
    
    // Get related products from same category
    let relatedProducts = [];
    try {
      const relatedQuery = await db.collection('products')
        .where('category', '==', product.category)
        .where('status', '==', 'active')
        .limit(10)
        .get();
      
      relatedProducts = relatedQuery.docs
        .filter(doc => doc.id !== productId) // Exclude current product
        .slice(0, 8) // Limit to 8 related products
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            price: data.price,
            image: data.images && data.images[0] ? data.images[0] : '/images/placeholder.jpg'
          };
        });
      
      console.log('🔗 Found', relatedProducts.length, 'related products');
    } catch (error) {
      console.error('❌ Error loading related products:', error);
    }
    
    product.relatedProducts = relatedProducts;
    
    res.render('product_detail', { 
      product,
      user: null 
    });
    
  } catch (error) {
    console.error('❌ Error loading product:', error);
    res.status(500).render('404', { 
      message: 'Có lỗi xảy ra khi tải sản phẩm',
      user: null 
    });
  }
});

// API route to get current user (with token verification)
app.get('/api/user', verifyToken, (req, res) => {
  console.log('� User API called - User:', req.user?.name || 'None');
  
  res.json({
    success: true,
    authenticated: !!req.user,
    user: req.user || null,
    timestamp: new Date().toISOString()
  });
});

// API route for manual user registration (with email verification)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }
    
    // Validate phone number (Vietnamese format)
    const cleanPhone = phone.replace(/\s+/g, '').replace(/[-().]/g, '');
    const phoneRegex = /^(\+84|84|0)?(3[2-9]|5[689]|7[06-9]|8[1-689]|9[0-46-9])[0-9]{7}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }
    
    // Normalize email to lowercase to handle case sensitivity
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if user already exists in Firestore (by email or phone)
    const existingUserQuery = await db.collection('users').where('email', '==', normalizedEmail).get();
    if (!existingUserQuery.empty) {
      return res.status(400).json({ error: 'Email đã được sử dụng' });
    }
    
    const existingPhoneQuery = await db.collection('users').where('phone', '==', cleanPhone).get();
    if (!existingPhoneQuery.empty) {
      return res.status(400).json({ error: 'Số điện thoại đã được sử dụng' });
    }
    
    // Create user in Firebase Auth first for email verification
    let firebaseUser;
    try {
      firebaseUser = await auth.createUser({
        email: normalizedEmail,
        password: password,
        displayName: name,
        emailVerified: false
      });
      console.log('✅ Firebase Auth user created:', firebaseUser.uid);
    } catch (authError) {
      console.error('❌ Firebase Auth creation failed:', authError);
      if (authError.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: 'Email đã được sử dụng trong hệ thống' });
      }
      return res.status(500).json({ error: 'Không thể tạo tài khoản xác thực' });
    }
    
    // Use Firebase UID as the primary document ID
    const firebaseUid = firebaseUser.uid;
    
    // Create user document in Firestore using Firebase UID as document ID
    const userData = {
      uid: firebaseUid, // Use Firebase UID as primary UID
      firebaseUid: firebaseUid, // Keep for backward compatibility
      email: normalizedEmail,
      name: name,
      phone: cleanPhone, // Store cleaned phone number
      provider: 'manual',
      emailVerified: false, // Will be synced from Firebase Auth after verification
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: null,
      preferences: {
        currency: 'VND',
        language: 'vi',
        notifications: true
      },
      profile: {
        isActive: false, // Will be activated after email verification
        membershipLevel: 'bronze',
        totalOrders: 0,
        totalSpent: 0
      },
      addresses: [],
      wishlist: [],
      is_admin: false,
      hasSeenWelcomeModal: false, // Track if user has seen welcome address modal
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(firebaseUid).set(userData);
    console.log('💾 New manual user created in Firestore:', name, 'with Firebase UID as document ID:', firebaseUid);
    
    // Return success and let frontend handle email verification using client SDK
    res.json({
      success: true,
      message: 'Tài khoản đã được tạo thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
      requiresVerification: true,
      user: {
        uid: firebaseUid, // Use Firebase UID as primary UID
        email: email,
        name: name,
        phone: cleanPhone,
        provider: 'manual',
        emailVerified: false,
        is_admin: false,
        firebaseUid: firebaseUid // Keep for backward compatibility
      },
      emailSent: false // Frontend will handle email sending
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Không thể tạo tài khoản. Vui lòng thử lại.' });
  }
});

// Resend email verification
app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email là bắt buộc'
      });
    }
    
    // Find user by email in Firebase Auth
    const firebaseUser = await auth.getUserByEmail(email);
    ``
    if (firebaseUser.emailVerified) {
      return res.json({
        success: false,
        message: 'Email đã được xác thực rồi'
      });
    }
    
    // Find user in Firestore to get custom UID
    const usersSnapshot = await db.collection('users')
      .where('firebaseUid', '==', firebaseUser.uid)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin người dùng'
      });
    }
    
    const userData = usersSnapshot.docs[0].data();
    const customUid = userData.uid;
    
    // Send verification email with custom action URL that redirects to our route
    const actionCodeSettings = {
      url: 'https://app-tb7nq3o2qq-uc.a.run.app/verify-email?uid=' + customUid, // Custom verification URL
      handleCodeInApp: false, // Firebase will handle the verification but redirect to our URL
    };
    
    const emailVerificationLink = await auth.generateEmailVerificationLink(email, actionCodeSettings);
    console.log('📧 Resend email verification link generated and email should be sent by Firebase to:', email);
    
    res.json({
      success: true,
      message: 'Email xác thực đã được gửi lại thành công!'
    });
    
  } catch (error) {
    console.error('❌ Error resending verification email:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi gửi lại email xác thực: ' + error.message
    });
  }
});

// Password reset route (Firebase standard)
app.get('/reset-password', async (req, res) => {
  try {
    const { oobCode, mode } = req.query;
    
    if (mode !== 'resetPassword') {
      return res.status(400).send('Invalid reset mode');
    }
    
    if (!oobCode) {
      return res.status(400).send('Invalid reset link');
    }
    
    // Verify the password reset code and get email
    try {
      const email = await auth.checkActionCode(oobCode);
      console.log('🔒 Password reset requested for:', email.data.email);
      
      // Render password reset form
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Đặt Lại Mật Khẩu - Tech Haven</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container { 
              background: white; 
              padding: 40px; 
              border-radius: 15px; 
              max-width: 500px; 
              width: 100%;
              box-shadow: 0 8px 25px rgba(0,0,0,0.15); 
            }
            .lock-icon { font-size: 60px; color: #667eea; margin-bottom: 20px; }
            .title { color: #333; margin-bottom: 10px; font-size: 24px; }
            .subtitle { color: #666; margin-bottom: 30px; line-height: 1.6; }
            .form-group { margin-bottom: 20px; text-align: left; }
            .form-group label { display: block; margin-bottom: 8px; color: #333; font-weight: 500; }
            .form-group input { 
              width: 100%; 
              padding: 12px; 
              border: 2px solid #e1e5e9; 
              border-radius: 8px; 
              font-size: 16px;
              box-sizing: border-box;
              transition: border-color 0.3s;
            }
            .form-group input:focus { 
              outline: none; 
              border-color: #667eea; 
            }
            .btn { 
              background: #667eea; 
              color: white; 
              padding: 12px 30px; 
              border: none; 
              border-radius: 8px; 
              cursor: pointer; 
              font-size: 16px;
              width: 100%;
              margin-bottom: 15px;
              transition: background 0.3s;
            }
            .btn:hover { background: #5a6fd8; }
            .btn-secondary { 
              background: #6c757d; 
              text-decoration: none; 
              display: inline-block; 
              text-align: center;
            }
            .btn-secondary:hover { background: #5a6268; }
            .error { color: #dc3545; margin-top: 15px; font-weight: 500; }
            .success { color: #28a745; margin-top: 15px; font-weight: 500; }
            .requirements { 
              text-align: left; 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 8px; 
              margin-bottom: 20px;
              font-size: 14px;
            }
            .requirements ul { margin: 0; padding-left: 20px; }
            .requirements li { margin-bottom: 5px; color: #666; }
          </style>
          <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
          <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
        </head>
        <body>
          <div class="container">
            <div class="lock-icon">🔒</div>
            <h1 class="title">Đặt Lại Mật Khẩu</h1>
            <p class="subtitle">Nhập mật khẩu mới cho tài khoản: <strong>${email.data.email}</strong></p>
            
            <div class="requirements">
              <strong>Yêu cầu mật khẩu:</strong>
              <ul>
                <li>Ít nhất 6 ký tự</li>
                <li>Nên bao gồm chữ hoa, chữ thường và số</li>
                <li>Không sử dụng mật khẩu quá đơn giản</li>
              </ul>
            </div>
            
            <form id="resetForm">
              <div class="form-group">
                <label for="newPassword">Mật khẩu mới:</label>
                <input type="password" id="newPassword" placeholder="Nhập mật khẩu mới" required minlength="6">
              </div>
              <div class="form-group">
                <label for="confirmPassword">Xác nhận mật khẩu:</label>
                <input type="password" id="confirmPassword" placeholder="Nhập lại mật khẩu mới" required minlength="6">
              </div>
              <button type="submit" class="btn">Đặt Lại Mật Khẩu</button>
              <a href="/" class="btn btn-secondary">Quay Về Trang Chủ</a>
            </form>
            
            <div id="message"></div>
          </div>
          
          <script>
            // Initialize Firebase
            const firebaseConfig = {
              apiKey: "AIzaSyDpzgsxZ1Jfs5hWAfS-gDbYfgkVte_jXoA",
              authDomain: "tech-haven-5368b.firebaseapp.com",
              projectId: "tech-haven-5368b",
              storageBucket: "tech-haven-5368b.appspot.com",
              messagingSenderId: "442337591630",
              appId: "1:442337591630:web:5d4977cc5c3cb44b7c3b8c"
            };
            firebase.initializeApp(firebaseConfig);
            const auth = firebase.auth();
            
            const actionCode = "${oobCode}";
            const userEmail = "${email.data.email}";
            
            document.getElementById('resetForm').addEventListener('submit', async function(e) {
              e.preventDefault();
              
              const newPassword = document.getElementById('newPassword').value;
              const confirmPassword = document.getElementById('confirmPassword').value;
              const messageDiv = document.getElementById('message');
              
              // Validation
              if (newPassword.length < 6) {
                messageDiv.innerHTML = '<div class="error">Mật khẩu phải có ít nhất 6 ký tự</div>';
                return;
              }
              
              if (newPassword !== confirmPassword) {
                messageDiv.innerHTML = '<div class="error">Mật khẩu xác nhận không khớp</div>';
                return;
              }
              
              try {
                // Show loading
                messageDiv.innerHTML = '<div style="color: #007bff;">Đang đặt lại mật khẩu...</div>';
                
                // Confirm password reset with Firebase
                await auth.confirmPasswordReset(actionCode, newPassword);
                
                messageDiv.innerHTML = '<div class="success">Mật khẩu đã được đặt lại thành công! Đang chuyển về trang đăng nhập...</div>';
                
                // Redirect to home page after 3 seconds
                setTimeout(() => {
                  window.location.href = '/?message=' + encodeURIComponent('Mật khẩu đã được đặt lại thành công! Vui lòng đăng nhập với mật khẩu mới.');
                }, 3000);
                
              } catch (error) {
                console.error('Password reset error:', error);
                let errorMessage = 'Có lỗi xảy ra khi đặt lại mật khẩu';
                
                if (error.code === 'auth/expired-action-code') {
                  errorMessage = 'Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu reset lại.';
                } else if (error.code === 'auth/invalid-action-code') {
                  errorMessage = 'Liên kết đặt lại mật khẩu không hợp lệ.';
                } else if (error.code === 'auth/weak-password') {
                  errorMessage = 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.';
                }
                
                messageDiv.innerHTML = '<div class="error">' + errorMessage + '</div>';
              }
            });
          </script>
        </body>
        </html>
      `);
      
    } catch (actionCodeError) {
      console.error('❌ Invalid password reset code:', actionCodeError);
      
      let errorMessage = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn';
      if (actionCodeError.code === 'auth/expired-action-code') {
        errorMessage = 'Liên kết đặt lại mật khẩu đã hết hạn';
      } else if (actionCodeError.code === 'auth/invalid-action-code') {
        errorMessage = 'Liên kết đặt lại mật khẩu không hợp lệ';
      }
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lỗi Đặt Lại Mật Khẩu</title>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error-icon { font-size: 60px; color: #dc3545; margin-bottom: 20px; }
            .title { color: #333; margin-bottom: 20px; }
            .message { color: #666; margin-bottom: 30px; line-height: 1.6; }
            .btn { background: #667eea; color: white; padding: 12px 30px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1 class="title">Lỗi Đặt Lại Mật Khẩu</h1>
            <p class="message">${errorMessage}. Vui lòng yêu cầu đặt lại mật khẩu mới từ trang đăng nhập.</p>
            <a href="/" class="btn">Về Trang Chủ</a>
          </div>
        </body>
        </html>
      `);
    }
    
  } catch (error) {
    console.error('❌ Password reset route error:', error);
    res.status(500).send('Internal server error');
  }
});

// Email verification route (Firebase standard)
app.get('/verify-email', async (req, res) => {
  try {
    const { oobCode, uid } = req.query;
    
    if (!oobCode) {
      return res.status(400).send('Invalid verification link');
    }
    
    // Check the action code first to get user info
    const actionCodeInfo = await auth.checkActionCode(oobCode);
    const email = actionCodeInfo.data.email;
    console.log('📧 Verifying email for:', email);
    
    // Apply the action code to verify email
    await auth.applyActionCode(oobCode);
    console.log('✅ Email verified successfully in Firebase Auth');
    
    // Find and update user in Firestore
    try {
      let userDoc = null;
      
      // First try to find by uid parameter if provided
      if (uid) {
        const userRef = db.collection('users').doc(uid);
        userDoc = await userRef.get();
        console.log('🔍 Searching by UID:', uid, 'Found:', userDoc.exists);
      }
      
      // If not found by uid, search by email (normalized)
      if (!userDoc || !userDoc.exists) {
        const normalizedEmail = email.toLowerCase().trim();
        const userQuery = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
        if (!userQuery.empty) {
          userDoc = userQuery.docs[0];
          console.log('🔍 Found user by email:', email);
        }
      }
      
      // Update user if found
      if (userDoc && userDoc.exists) {
        await userDoc.ref.update({
          emailVerified: true,
          'profile.isActive': true,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ User email verified and activated in Firestore:', email, 'UID:', userDoc.id);
      } else {
        console.log('⚠️ User not found in Firestore for email:', email);
        // Create a warning but don't fail the verification
      }
    } catch (firestoreError) {
      console.error('❌ Error updating Firestore after email verification:', firestoreError);
      // Don't fail the verification if Firestore update fails
    }
    
    // Render success page or redirect
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Xác Thực Thành Công</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .success-icon { font-size: 60px; color: #28a745; margin-bottom: 20px; }
          .title { color: #333; margin-bottom: 20px; }
          .message { color: #666; margin-bottom: 30px; line-height: 1.6; }
          .btn { background: #667eea; color: white; padding: 12px 30px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1 class="title">Email Xác Thực Thành Công!</h1>
          <p class="message">Chúc mừng! Email của bạn đã được xác thực thành công. Tài khoản của bạn đã được kích hoạt và bạn có thể đăng nhập để sử dụng dịch vụ.</p>
          <a href="/" class="btn">Về Trang Chủ</a>
        </div>
        <script>
          // Auto redirect after 5 seconds
          setTimeout(() => {
            window.location.href = '/';
          }, 5000);
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ Email verification error:', error);
    
    let errorMessage = 'Có lỗi xảy ra khi xác thực email';
    if (error.code === 'auth/invalid-action-code') {
      errorMessage = 'Link xác thực không hợp lệ hoặc đã hết hạn';
    } else if (error.code === 'auth/expired-action-code') {
      errorMessage = 'Link xác thực đã hết hạn';
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lỗi Xác Thực Email</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .error-icon { font-size: 60px; color: #dc3545; margin-bottom: 20px; }
          .title { color: #333; margin-bottom: 20px; }
          .message { color: #666; margin-bottom: 30px; line-height: 1.6; }
          .btn { background: #667eea; color: white; padding: 12px 30px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1 class="title">Lỗi Xác Thực Email</h1>
          <p class="message">${errorMessage}. Vui lòng liên hệ support hoặc đăng ký lại.</p>
          <a href="/" class="btn">Về Trang Chủ</a>
        </div>
      </body>
      </html>
    `);
  }
});

// Route to handle password reset (from Firebase Auth email)
app.get('/reset-password', async (req, res) => {
  try {
    const { oobCode, email } = req.query;
    
    if (!oobCode) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lỗi Reset Password</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 50px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
            .error-icon { font-size: 48px; margin-bottom: 20px; }
            .title { color: #333; margin-bottom: 20px; }
            .message { color: #666; margin-bottom: 30px; line-height: 1.5; }
            .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; transition: background 0.3s; }
            .btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1 class="title">Lỗi Reset Password</h1>
            <p class="message">Link reset password không hợp lệ hoặc đã hết hạn.</p>
            <a href="/" class="btn">Về Trang Chủ</a>
          </div>
        </body>
        </html>
      `);
    }

    // Display reset password form
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Đặt Lại Mật Khẩu</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 50px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .title { color: #333; margin-bottom: 30px; text-align: center; }
          .form-group { margin-bottom: 20px; }
          .form-group label { display: block; margin-bottom: 8px; color: #333; font-weight: bold; }
          .form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; box-sizing: border-box; }
          .btn { width: 100%; background: #007bff; color: white; padding: 12px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; transition: background 0.3s; }
          .btn:hover { background: #0056b3; }
          .btn:disabled { background: #ccc; cursor: not-allowed; }
          .error { color: #dc3545; margin-top: 10px; font-size: 14px; }
          .success { color: #28a745; margin-top: 10px; font-size: 14px; }
          .back-link { text-align: center; margin-top: 20px; }
          .back-link a { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="title">Đặt Lại Mật Khẩu</h1>
          <form id="resetForm">
            <div class="form-group">
              <label for="newPassword">Mật khẩu mới:</label>
              <input type="password" id="newPassword" name="newPassword" required minlength="6" placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)">
            </div>
            <div class="form-group">
              <label for="confirmPassword">Xác nhận mật khẩu:</label>
              <input type="password" id="confirmPassword" name="confirmPassword" required minlength="6" placeholder="Nhập lại mật khẩu mới">
            </div>
            <button type="submit" class="btn" id="submitBtn">Đặt Lại Mật Khẩu</button>
            <div id="message"></div>
          </form>
          <div class="back-link">
            <a href="/">← Về Trang Chủ</a>
          </div>
        </div>

        <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
        <script>
          // Firebase config
          const firebaseConfig = {
            apiKey: "AIzaSyBYOy1NQmlXv8N4GjBXdCdIIe2PfTG0e1M",
            authDomain: "shopping-website-7cebf.firebaseapp.com",
            projectId: "shopping-website-7cebf",
            storageBucket: "shopping-website-7cebf.appspot.com",
            messagingSenderId: "442337591630",
            appId: "1:442337591630:web:36344e8a88fb8c4e4b1c19"
          };
          
          firebase.initializeApp(firebaseConfig);
          const auth = firebase.auth();
          
          const urlParams = new URLSearchParams(window.location.search);
          const oobCode = urlParams.get('oobCode');
          const email = urlParams.get('email') || '';
          
          document.getElementById('resetForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const messageDiv = document.getElementById('message');
            const submitBtn = document.getElementById('submitBtn');
            
            // Clear previous messages
            messageDiv.innerHTML = '';
            
            // Validate passwords
            if (newPassword !== confirmPassword) {
              messageDiv.innerHTML = '<div class="error">Mật khẩu xác nhận không khớp!</div>';
              return;
            }
            
            if (newPassword.length < 6) {
              messageDiv.innerHTML = '<div class="error">Mật khẩu phải có ít nhất 6 ký tự!</div>';
              return;
            }
            
            try {
              submitBtn.disabled = true;
              submitBtn.textContent = 'Đang xử lý...';
              
              // Verify the reset code and get email
              const email = await auth.verifyPasswordResetCode(oobCode);
              
              // Confirm password reset
              await auth.confirmPasswordReset(oobCode, newPassword);
              
              messageDiv.innerHTML = '<div class="success">Mật khẩu đã được đặt lại thành công! Đang chuyển hướng...</div>';
              setTimeout(() => {
                window.location.href = '/';
              }, 2000);
              
            } catch (error) {
              console.error('Password reset error:', error);
              let errorMessage = 'Có lỗi xảy ra khi đặt lại mật khẩu.';
              
              if (error.code === 'auth/expired-action-code') {
                errorMessage = 'Link đặt lại mật khẩu đã hết hạn.';
              } else if (error.code === 'auth/invalid-action-code') {
                errorMessage = 'Link đặt lại mật khẩu không hợp lệ.';
              } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.';
              }
              
              messageDiv.innerHTML = '<div class="error">' + errorMessage + '</div>';
              submitBtn.disabled = false;
              submitBtn.textContent = 'Đặt Lại Mật Khẩu';
            }
          });
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Reset password route error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lỗi Server</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 50px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
          .error-icon { font-size: 48px; margin-bottom: 20px; }
          .title { color: #333; margin-bottom: 20px; }
          .message { color: #666; margin-bottom: 30px; line-height: 1.5; }
          .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; transition: background 0.3s; }
          .btn:hover { background: #0056b3; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1 class="title">Lỗi Server</h1>
          <p class="message">Có lỗi xảy ra khi xử lý yêu cầu. Vui lòng thử lại sau.</p>
          <a href="/" class="btn">Về Trang Chủ</a>
        </div>
      </body>
      </html>
    `);
  }
});

// API route for manual user login (without Google)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Normalize email to lowercase to handle case sensitivity
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find user by email
    const userQuery = await db.collection('users').where('email', '==', normalizedEmail).get();
    if (userQuery.empty) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    
    // Check if user was created manually
    if (userData.provider !== 'manual') {
      return res.status(401).json({ error: 'Vui lòng sử dụng đăng nhập Google cho tài khoản này' });
    }
    
    // For manual users, verify password using Firebase Auth client SDK
    // Auto-update missing firebaseUid if uid exists
    const firebaseUid = userData.firebaseUid || userData.uid;
    if (firebaseUid) {
      try {
        // Update missing firebaseUid field if needed
        if (!userData.firebaseUid && userData.uid) {
          await userDoc.ref.update({
            firebaseUid: userData.uid
          });
          console.log('✅ Updated missing firebaseUid field');
        }
        // Use Firebase client SDK to verify password
        const { initializeApp } = require('firebase/app');
        const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
        
        // Initialize Firebase client app for password verification
        const firebaseConfig = {
          apiKey: "AIzaSyDpzgsxZ1Jfs5hWAfS-gDbYfgkVte_jXoA",
          authDomain: "tech-haven-5368b.firebaseapp.com",
          projectId: "tech-haven-5368b"
        };
        
        let clientApp;
        try {
          clientApp = initializeApp(firebaseConfig, 'client-auth');
        } catch (e) {
          // App already exists, get it
          const { getApps, getApp } = require('firebase/app');
          const apps = getApps();
          clientApp = apps.find(app => app.name === 'client-auth') || initializeApp(firebaseConfig, 'client-auth');
        }
        
        const clientAuth = getAuth(clientApp);
        
        // Verify password by attempting to sign in
        await signInWithEmailAndPassword(clientAuth, email, password);
        console.log('✅ Password verified with Firebase Auth');
        
        // Check email verification from Firebase Auth (source of truth)
        const firebaseUser = await auth.getUser(firebaseUid);
        if (!firebaseUser.emailVerified) {
          return res.status(403).json({ 
            error: 'Email chưa được xác thực. Vui lòng kiểm tra email và click vào link xác thực.',
            requiresVerification: true 
          });
        }
        
        // Update Firestore to sync with Firebase Auth status if needed
        if (!userData.emailVerified) {
          await userDoc.ref.update({
            emailVerified: true,
            'profile.isActive': true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('✅ Updated Firestore emailVerified status to match Firebase Auth');
        }
        
      } catch (authError) {
        console.error('❌ Firebase Auth verification failed:', authError);
        if (authError.code === 'auth/wrong-password' || authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
          return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        }
        return res.status(500).json({ error: 'Không thể xác thực đăng nhập' });
      }
    } else {
      console.error('❌ No Firebase UID found for user:', userData);
      return res.status(401).json({ error: 'Tài khoản không hợp lệ - missing Firebase UID' });
    }
    
    // Update last login
    await userDoc.ref.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Manual login successful for:', userData.name);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        provider: userData.provider,
        is_admin: userData.is_admin || false
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
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

// API route to update user profile
app.post('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const { uid, name, phone, photo, photoUrl } = req.body;
    
    // Use authenticated user's UID for security
    const userUid = req.user ? req.user.uid : uid;
    
    if (!userUid) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    console.log('📝 Updating profile for user:', userUid);
    console.log('📸 Photo data received:', photo || photoUrl);
    
    // Update data in Firestore
    const userRef = db.collection('users').doc(userUid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log('❌ User not found in Firestore:', userUid);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    
    // Support both 'photo' and 'photoUrl' parameters
    const photoValue = photo !== undefined ? photo : photoUrl;
    if (photoValue !== undefined) {
      updateData.photo = photoValue; // Allow empty string to remove photo
      console.log('📸 Updating photo to:', photoValue);
    }
    
    console.log('📊 Update data to be saved:', updateData);
    
    await userRef.update(updateData);
    console.log('✅ Firestore update completed successfully');
    
    // Also update Firebase Auth if it's a Firebase Auth user
    const userData = userDoc.data();
    if (userData.firebaseUid) {
      try {
        const authUpdateData = {};
        if (name) authUpdateData.displayName = name;
        
        // Support both photo parameters
        const photoValue = photo !== undefined ? photo : photoUrl;
        if (photoValue !== undefined) authUpdateData.photoURL = photoValue;
        
        if (Object.keys(authUpdateData).length > 0) {
          await auth.updateUser(userData.firebaseUid, authUpdateData);
          console.log('✅ Firebase Auth user updated');
        }
      } catch (authError) {
        console.warn('⚠️ Could not update Firebase Auth user:', authError.message);
        // Continue anyway since Firestore update succeeded
      }
    }
    
    // Get updated user data
    const updatedDoc = await userRef.get();
    const updatedUserData = updatedDoc.data();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        uid: updatedUserData.uid,
        email: updatedUserData.email,
        name: updatedUserData.name,
        phone: updatedUserData.phone,
        photo: updatedUserData.photo,
        provider: updatedUserData.provider,
        is_admin: updatedUserData.is_admin || false
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// API route to update user photo only (for immediate upload)
app.post('/api/user/photo', verifyToken, async (req, res) => {
  try {
    const { photo } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userUid = req.user.uid;
    console.log('📸 Updating photo for user:', userUid);
    console.log('📸 New photo URL:', photo);
    
    // Update photo in Firestore
    const userRef = db.collection('users').doc(userUid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log('❌ User not found in Firestore:', userUid);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const updateData = {
      photo: photo || '', // Allow empty string to remove photo
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await userRef.update(updateData);
    console.log('✅ Photo updated in Firestore successfully');
    
    // Also update Firebase Auth photo
    const userData = userDoc.data();
    if (userData.firebaseUid) {
      try {
        await auth.updateUser(userData.firebaseUid, {
          photoURL: photo || ''
        });
        console.log('✅ Photo updated in Firebase Auth successfully');
      } catch (authError) {
        console.warn('⚠️ Could not update Firebase Auth photo:', authError.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Photo updated successfully',
      photo: photo || ''
    });
    
  } catch (error) {
    console.error('❌ Error updating photo:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// API route to get full user profile from Firestore
app.get('/api/user/profile', async (req, res) => {
  try {
    console.log('📱 Getting user profile...');
    
    // Check if we have authorization header first
    const authHeader = req.headers.authorization;
    let user = null;
    let searchUid = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Try token verification first
      const idToken = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        console.log('✅ Token verified for user:', decodedToken.email);
        searchUid = decodedToken.uid;
        
        // Find user in Firestore by firebaseUid first
        const usersSnapshot = await db.collection('users')
          .where('firebaseUid', '==', decodedToken.uid)
          .limit(1)
          .get();
        
        if (!usersSnapshot.empty) {
          user = usersSnapshot.docs[0].data();
          console.log('👤 User found by Firebase UID:', user.name);
        } else {
          // Try by custom UID
          const userDoc = await db.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists) {
            user = userDoc.data();
            console.log('� User found by custom UID:', user.name);
          }
        }
      } catch (tokenError) {
        console.error('❌ Token verification failed:', tokenError.message);
      }
    }
    
    // If no user found via token, try UID from query parameter
    if (!user && req.query.uid) {
      console.log('🔍 Searching user by UID from query:', req.query.uid);
      const userDoc = await db.collection('users').doc(req.query.uid).get();
      if (userDoc.exists) {
        user = userDoc.data();
        console.log('👤 User found by query UID:', user.name, 'Phone:', user.phone);
      }
    }
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('📱 Returning user profile:', user.name, 'Phone:', user.phone || 'No phone');
    res.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        phone: user.phone || '',
        photo: user.photo || '',
        provider: user.provider,
        is_admin: user.is_admin || false,
        emailVerified: user.emailVerified || false
      },
      profile: user, // Keep for compatibility
      lastUpdated: user.updatedAt?.toDate?.() || user.createdAt?.toDate?.()
    });
    
  } catch (error) {
    console.error('❌ Error getting user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// API route to add item to wishlist
app.post('/api/user/wishlist', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { productId, productName, productPrice, productImage } = req.body;
    const userRef = db.collection('users').doc(req.user.uid);
    
    await userRef.update({
      wishlist: admin.firestore.FieldValue.arrayUnion({
        productId,
        productName,
        productPrice,
        productImage,
        addedAt: new Date().toISOString()
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Item added to wishlist' });
  } catch (error) {
    console.error('❌ Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// API route to get user statistics
app.get('/api/user/stats', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      res.json({
        success: true,
        stats: {
          memberSince: userData.createdAt?.toDate?.(),
          lastLogin: userData.lastLoginAt?.toDate?.(),
          totalOrders: userData.profile?.totalOrders || 0,
          totalSpent: userData.profile?.totalSpent || 0,
          membershipLevel: userData.profile?.membershipLevel || 'bronze',
          wishlistCount: userData.wishlist?.length || 0,
          addressCount: userData.addresses?.length || 0
        }
      });
    } else {
      res.status(404).json({ error: 'User profile not found' });
    }
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
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

// API route to check admin status
app.get('/api/user/admin-status', verifyToken, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    success: true,
    user: {
      uid: req.user.uid,
      name: req.user.name,
      email: req.user.email,
      is_admin: req.user.is_admin
    },
    timestamp: new Date().toISOString()
  });
});

// API route to set admin status (only existing admins can promote others)
app.post('/api/user/set-admin', requireAdmin, async (req, res) => {
  try {
    const { userEmail, isAdmin } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }
    
    // Find user by email
    const usersQuery = await db.collection('users').where('email', '==', userEmail).get();
    
    if (usersQuery.empty) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userDoc = usersQuery.docs[0];
    await userDoc.ref.update({
      is_admin: !!isAdmin,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      adminUpdatedBy: req.user.email,
      adminUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`👑 Admin status updated for ${userEmail} to ${!!isAdmin} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: `Admin status updated for ${userEmail}`,
      newStatus: !!isAdmin,
      updatedBy: req.user.email
    });
    
  } catch (error) {
    console.error('❌ Error updating admin status:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// Debug route to test token verification
app.get('/debug/auth', async (req, res) => {
  const authHeader = req.headers.authorization;
  console.log('� Debug Auth Route');
  console.log('� Authorization header:', authHeader ? 'Present' : 'Missing');
  
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

// ===== COUPON MANAGEMENT API ENDPOINTS =====

// GET /api/coupons - Get all coupons (admin only)
app.get('/api/coupons', requireAdmin, async (req, res) => {
  try {
    console.log('🎫 Getting coupons from database...');
    
    const couponsSnapshot = await db.collection('coupons')
      .orderBy('createdAt', 'desc')
      .get();
    
    const coupons = [];
    couponsSnapshot.forEach(doc => {
      coupons.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()?.toISOString() || new Date().toISOString()
      });
    });
    
    console.log(`✅ Found ${coupons.length} coupons`);
    res.json({
      success: true,
      coupons: coupons
    });
    
  } catch (error) {
    console.error('❌ Error getting coupons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coupons'
    });
  }
});

// GET /api/coupons/available - Get available coupons for public use (no admin required)
app.get('/api/coupons/available', async (req, res) => {
  try {
    console.log('🎫 Getting available coupons for public use');
    
    // Get userId from query parameter if user is logged in
    const userId = req.query.userId;
    
    // Get all active coupons
    const couponsSnapshot = await db.collection('coupons').get();
    
    // If user is logged in, get their used coupons from coupon_user collection
    let usedCouponIds = [];
    if (userId) {
      console.log('👤 Filtering coupons for user:', userId);
      const usedCouponsSnapshot = await db.collection('coupon_user')
        .where('userId', '==', userId)
        .get();
      
      usedCouponIds = usedCouponsSnapshot.docs.map(doc => doc.data().couponId);
      console.log('🚫 User already used coupons:', usedCouponIds);
    }
    
    const availableCoupons = [];
    const now = new Date();
    
    couponsSnapshot.forEach(doc => {
      const coupon = { id: doc.id, ...doc.data() };
      
      // Skip if user already used this coupon
      if (userId && usedCouponIds.includes(doc.id)) {
        console.log('⛔ Skipping already used coupon:', coupon.code, 'for user:', userId);
        return;
      }
      
      // Filter for active status and validity
      if (coupon.status !== 'active') return;
      
      // Check if coupon is still valid
      const expiredDate = coupon.expiredDate ? new Date(coupon.expiredDate) : null;
      const isNotExpired = !expiredDate || now <= expiredDate;
      const hasUsageLeft = coupon.usedCount < coupon.usageLimit;
      
      if (isNotExpired && hasUsageLeft) {
        // Only return necessary fields for public display
        availableCoupons.push({
          id: coupon.id,
          code: coupon.code,
          discountAmount: coupon.discountAmount,
          description: coupon.description,
          usageLimit: coupon.usageLimit,
          usedCount: coupon.usedCount,
          expiredDate: coupon.expiredDate,
          status: coupon.status,
          createdAt: coupon.createdAt?.toDate()?.toISOString() || new Date().toISOString()
        });
      }
    });
    
    // Sort by created date (newest first)
    availableCoupons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log(`✅ Found ${availableCoupons.length} available coupons for user: ${userId || 'anonymous'}`);
    
    res.json({
      success: true,
      coupons: availableCoupons,
      count: availableCoupons.length,
      userId: userId || null
    });
  } catch (error) {
    console.error('❌ Error getting available coupons:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /api/coupons - Create new coupon (admin only)
app.post('/api/coupons', requireAdmin, async (req, res) => {
  try {
    const { code, discountAmount, usageLimit, description, expiredDate } = req.body;
    
    // Validate input
    if (!code || !discountAmount || !usageLimit) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: code, discountAmount, usageLimit'
      });
    }
    
    // Validate coupon code format (5 uppercase alphanumeric characters)
    const codeRegex = /^[A-Z0-9]{5}$/;
    if (!codeRegex.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code must be exactly 5 uppercase alphanumeric characters'
      });
    }
    
    // Check if coupon code already exists
    const existingCoupon = await db.collection('coupons').where('code', '==', code).get();
    if (!existingCoupon.empty) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code already exists'
      });
    }
    
    // Validate discount amount
    if (discountAmount < 1000 || discountAmount > 10000000) {
      return res.status(400).json({
        success: false,
        error: 'Discount amount must be between 1,000 and 10,000,000 VNĐ'
      });
    }
    
    // Validate usage limit
    if (usageLimit < 1 || usageLimit > 10) {
      return res.status(400).json({
        success: false,
        error: 'Usage limit must be between 1 and 10'
      });
    }
    
    // Validate expiredDate if provided
    if (expiredDate) {
      const expDate = new Date(expiredDate);
      const now = new Date();
      
      if (isNaN(expDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid expiredDate format'
        });
      }
      
      if (expDate <= now) {
        return res.status(400).json({
          success: false,
          error: 'Expired date must be in the future'
        });
      }
    }
    
    const couponData = {
      code: code.toUpperCase(),
      discountAmount: parseInt(discountAmount),
      usageLimit: parseInt(usageLimit),
      usedCount: 0,
      status: 'active',
      description: description || '',
      expiredDate: expiredDate ? new Date(expiredDate).toISOString() : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user.email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('🎫 Creating coupon:', code);
    const docRef = await db.collection('coupons').add(couponData);
    
    console.log('✅ Coupon created with ID:', docRef.id);
    
    res.json({
      success: true,
      message: 'Coupon created successfully',
      coupon: {
        id: docRef.id,
        ...couponData,
        createdAt: new Date().toISOString(),
        expiredDate: expiredDate
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating coupon:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create coupon'
    });
  }
});

// DELETE /api/coupons/:id - Delete coupon (admin only)
app.delete('/api/coupons/:id', requireAdmin, async (req, res) => {
  try {
    const couponId = req.params.id;
    
    if (!couponId) {
      return res.status(400).json({
        success: false,
        error: 'Coupon ID is required'
      });
    }
    
    console.log('🗑️ Deleting coupon:', couponId);
    
    // Check if coupon exists
    const couponDoc = await db.collection('coupons').doc(couponId).get();
    if (!couponDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found'
      });
    }
    
    const couponData = couponDoc.data();
    
    // Check if coupon has been used
    if (couponData.usedCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete coupon that has been used'
      });
    }
    
    await db.collection('coupons').doc(couponId).delete();
    
    console.log('✅ Coupon deleted:', couponData.code);
    
    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting coupon:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete coupon'
    });
  }
});

// POST /api/coupons/validate - Validate coupon for use (public endpoint)
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code is required'
      });
    }
    
    console.log('🎫 Validating coupon:', code);
    
    // Find coupon by code
    const couponQuery = await db.collection('coupons').where('code', '==', code.toUpperCase()).get();
    
    if (couponQuery.empty) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found'
      });
    }
    
    const couponDoc = couponQuery.docs[0];
    const couponData = couponDoc.data();
    
    // Check if coupon is active
    if (couponData.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Coupon is not active'
      });
    }
    
    // Check if coupon has expired
    if (couponData.expiredDate) {
      const now = new Date();
      const expiredDate = new Date(couponData.expiredDate);
      
      if (now > expiredDate) {
        return res.status(400).json({
          success: false,
          error: 'Coupon has expired'
        });
      }
    }
    
    // Check if coupon has remaining uses
    if (couponData.usedCount >= couponData.usageLimit) {
      return res.status(400).json({
        success: false,
        error: 'Coupon has reached its usage limit'
      });
    }
    
    console.log('✅ Coupon is valid:', code);
    
    res.json({
      success: true,
      message: 'Coupon is valid',
      coupon: {
        id: couponDoc.id,
        code: couponData.code,
        discountAmount: couponData.discountAmount,
        description: couponData.description,
        remainingUses: couponData.usageLimit - couponData.usedCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error validating coupon:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate coupon'
    });
  }
});

// POST /api/coupon-usage - Save coupon usage to coupon_user table and update usedCount
app.post('/api/coupon-usage', async (req, res) => {
  try {
    const { couponId, userId, orderData } = req.body;
    
    if (!couponId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Coupon ID and user ID are required'
      });
    }
    
    console.log('🎫 Saving coupon usage:', couponId, 'for user:', userId);
    
    // Check if user already used this coupon
    const existingUsage = await db.collection('coupon_user')
      .where('userId', '==', userId)
      .where('couponId', '==', couponId)
      .get();
      
    if (!existingUsage.empty) {
      return res.status(400).json({
        success: false,
        error: 'User has already used this coupon'
      });
    }
    
    // Use transaction to ensure atomicity
    const result = await db.runTransaction(async (transaction) => {
      // Get coupon document
      const couponRef = db.collection('coupons').doc(couponId);
      const couponDoc = await transaction.get(couponRef);
      
      if (!couponDoc.exists) {
        throw new Error('Coupon not found');
      }
      
      const couponData = couponDoc.data();
      
      // Validate coupon
      if (couponData.status !== 'active') {
        throw new Error('Coupon is not active');
      }
      
      if (couponData.usedCount >= couponData.usageLimit) {
        throw new Error('Coupon has reached its usage limit');
      }
      
      // Update coupon usedCount
      const newUsedCount = couponData.usedCount + 1;
      const newStatus = newUsedCount >= couponData.usageLimit ? 'used' : 'active';
      
      transaction.update(couponRef, {
        usedCount: newUsedCount,
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Create record in coupon_user collection
      const couponUserRef = db.collection('coupon_user').doc();
      transaction.create(couponUserRef, {
        userId: userId,
        couponId: couponId,
        couponCode: couponData.code,
        discountAmount: couponData.discountAmount,
        orderData: orderData || {},
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        couponUserId: couponUserRef.id, // Return the coupon_user document ID
        discountAmount: couponData.discountAmount,
        newUsedCount: newUsedCount,
        remainingUses: couponData.usageLimit - newUsedCount
      };
    });
    
    console.log('✅ Coupon usage saved successfully:', couponId);
    
    res.json({
      success: true,
      message: 'Coupon usage saved successfully',
      couponUserId: result.couponUserId, // Include couponUserId in response
      discountAmount: result.discountAmount,
      remainingUses: result.remainingUses
    });
    
  } catch (error) {
    console.error('❌ Error saving coupon usage:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save coupon usage'
    });
  }
});

// GET /api/coupon-usage/check - Check if user has used a specific coupon
app.get('/api/coupon-usage/check', async (req, res) => {
  try {
    const { userId, couponId, couponCode } = req.query;
    
    if (!userId || (!couponId && !couponCode)) {
      return res.status(400).json({
        success: false,
        error: 'User ID and either coupon ID or coupon code are required'
      });
    }
    
    console.log('🔍 Checking coupon usage for user:', userId, 'coupon:', couponId || couponCode);
    
    let query = db.collection('coupon_user').where('userId', '==', userId);
    
    if (couponId) {
      query = query.where('couponId', '==', couponId);
    } else if (couponCode) {
      query = query.where('couponCode', '==', couponCode);
    }
    
    const usageSnapshot = await query.get();
    const hasUsed = !usageSnapshot.empty;
    
    res.json({
      success: true,
      hasUsed: hasUsed,
      usageCount: usageSnapshot.size
    });
    
  } catch (error) {
    console.error('❌ Error checking coupon usage:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check coupon usage'
    });
  }
});

// GET /api/coupon-usage/check-by-email - Check which coupons an email has used
app.get('/api/coupon-usage/check-by-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Missing email parameter'
      });
    }

    // Normalize email to lowercase to handle case sensitivity
    const normalizedEmail = email.toLowerCase().trim();

    console.log('🔍 Checking used coupons for email:', email, '-> normalized:', normalizedEmail);

    // First, find the user by email (case insensitive)
    const userSnapshot = await db.collection('users')
      .where('email', '==', normalizedEmail)
      .get();
    
    if (userSnapshot.empty) {
      console.log('📧 No user found with email:', email);
      return res.json({
        success: true,
        usedCoupons: [], // New user, no coupons used
        userExists: false
      });
    }

    const userData = userSnapshot.docs[0];
    const userId = userData.id;
    
    console.log('👤 Found user:', userId, 'for email:', email);

    // Get all coupon usage for this user
    const usageSnapshot = await db.collection('coupon_user')
      .where('userId', '==', userId)
      .get();
    
    const usedCoupons = [];
    usageSnapshot.forEach(doc => {
      const data = doc.data();
      usedCoupons.push({
        couponId: data.couponId,
        couponCode: data.couponCode,
        usedAt: data.usedAt,
        billId: data.billId
      });
    });

    console.log('🎫 Used coupons for user:', usedCoupons.length, 'coupons');

    res.json({
      success: true,
      usedCoupons,
      userExists: true,
      userId
    });
  } catch (error) {
    console.error('❌ Error checking coupon usage by email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check coupon usage by email'
    });
  }
});

// POST /api/coupons/use - Use coupon (internal endpoint) - DEPRECATED, use /api/coupon-usage instead
app.post('/api/coupons/use', async (req, res) => {
  try {
    const { code, userId, orderData } = req.body;
    
    if (!code || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code and user ID are required'
      });
    }
    
    console.log('🎫 Using coupon:', code, 'for user:', userId);
    
    // Find and update coupon in a transaction
    const result = await db.runTransaction(async (transaction) => {
      const couponQuery = await db.collection('coupons').where('code', '==', code.toUpperCase()).get();
      
      if (couponQuery.empty) {
        throw new Error('Coupon not found');
      }
      
      const couponDoc = couponQuery.docs[0];
      const couponData = couponDoc.data();
      
      // Validate coupon
      if (couponData.status !== 'active') {
        throw new Error('Coupon is not active');
      }
      
      if (couponData.usedCount >= couponData.usageLimit) {
        throw new Error('Coupon has reached its usage limit');
      }
      
      // Update coupon usage
      const newUsedCount = couponData.usedCount + 1;
      const newStatus = newUsedCount >= couponData.usageLimit ? 'used' : 'active';
      
      transaction.update(couponDoc.ref, {
        usedCount: newUsedCount,
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedBy: userId
      });
      
      // Log coupon usage
      transaction.create(db.collection('couponUsage').doc(), {
        couponId: couponDoc.id,
        couponCode: code.toUpperCase(),
        userId: userId,
        discountAmount: couponData.discountAmount,
        orderData: orderData || {},
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        discountAmount: couponData.discountAmount,
        newUsedCount: newUsedCount,
        remainingUses: couponData.usageLimit - newUsedCount
      };
    });
    
    console.log('✅ Coupon used successfully:', code);
    
    res.json({
      success: true,
      message: 'Coupon used successfully',
      discountAmount: result.discountAmount,
      remainingUses: result.remainingUses
    });
    
  } catch (error) {
    console.error('❌ Error using coupon:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to use coupon'
    });
  }
});

// ===== END COUPON MANAGEMENT API ENDPOINTS =====

// Admin routes (protected by admin privileges)
app.get('/admin', requireAdmin, (req, res) => {
  res.render('input', { user: req.user });
});

app.get('/admin/input', requireAdmin, (req, res) => {
  res.render('input', { user: req.user });
});

// Quick Input route (for batch product entry) - ADMIN ONLY
app.get('/admin/quick-input', requireAdmin, (req, res) => {
  res.render('quick-input', { user: req.user });
});

// Redirect /quick-input to /admin/quick-input (for direct navigation) - ADMIN ONLY
app.get('/quick-input', requireAdmin, (req, res) => {
  // Preserve token in query parameters when redirecting
  const token = req.query.token;
  if (token) {
    res.redirect(`/admin/quick-input?token=${token}`);
  } else {
    res.redirect('/admin/quick-input');
  }
});

// Redirect /edit to /admin/edit (for direct navigation)
app.get('/edit', requireAdmin, (req, res) => {
  res.render('edit', { 
    productId: null,
    user: req.user 
  });
});

app.get('/admin/edit', requireAdmin, (req, res) => {
  res.render('edit', { 
    productId: null,
    user: req.user 
  });
});

app.get('/admin/edit/:productId', requireAdmin, (req, res) => {
  const productId = req.params.productId;
  res.render('edit', { 
    productId: productId,
    user: req.user 
  });
});

app.get('/admin/coupon', requireAdmin, (req, res) => {
  res.render('coupon', { user: req.user });
});

// Redirect /revenue to /admin/revenue (for direct navigation)
app.get('/revenue', requireAdmin, (req, res) => {
  res.render('revenue', { user: req.user });
});

app.get('/admin/revenue', requireAdmin, (req, res) => {
  res.render('revenue', { user: req.user });
});

// Admin Bill Management Page
app.get('/admin/bill', requireAdmin, (req, res) => {
  console.log('📋 Admin accessing bill management page');
  res.render('bill_detail_admin', { user: req.user });
});

// API route to get all bills for revenue statistics (Admin only)
app.get('/api/bills', requireAdmin, async (req, res) => {
  try {
    console.log('📊 Getting bills data for revenue statistics...');
    console.log('👤 Admin user:', req.user.email, '- is_admin:', req.user.is_admin);
    
    const billsSnapshot = await db.collection('bills').orderBy('createdAt', 'desc').get();
    const bills = [];
    
    // Track unique users
    const uniqueUsers = new Set();
    
    billsSnapshot.forEach(doc => {
      const data = doc.data();
      uniqueUsers.add(data.userId);
      
      bills.push({
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to ISO string for proper JSON serialization
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
      });
    });
    
    console.log(`✅ Retrieved ${bills.length} bills from ${uniqueUsers.size} unique users`);
    console.log(`👥 User IDs:`, Array.from(uniqueUsers));
    
    res.json({
      success: true,
      bills: bills,
      total: bills.length,
      uniqueUsers: uniqueUsers.size
    });
    
  } catch (error) {
    console.error('❌ Error getting bills:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API route to get best selling products based on actual sales data
app.get('/api/products/best-sellers', async (req, res) => {
  try {
    console.log('🔥 Getting best selling products from sales data...');
    
    // Get all bills
    const billsSnapshot = await db.collection('bills').get();
    const productSales = new Map(); // productId -> total quantity sold
    
    // Calculate total sales for each product
    billsSnapshot.forEach(doc => {
      const bill = doc.data();
      if (bill.products && Array.isArray(bill.products)) {
        bill.products.forEach(product => {
          const productId = product.id;
          const quantity = parseInt(product.quantity) || 1;
          
          if (productSales.has(productId)) {
            productSales.set(productId, productSales.get(productId) + quantity);
          } else {
            productSales.set(productId, quantity);
          }
        });
      }
    });
    
    // Sort products by sales quantity (descending)
    const sortedSales = Array.from(productSales.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by quantity desc
      .slice(0, 10); // Get top 10
    
    // Get product details for best sellers
    const bestSellerIds = sortedSales.map(([productId]) => productId);
    const bestSellers = [];
    
    if (bestSellerIds.length > 0) {
      // Get product details from products collection
      for (const productId of bestSellerIds) {
        try {
          const productDoc = await db.collection('products').doc(productId).get();
          if (productDoc.exists) {
            const productData = productDoc.data();
            const salesData = productSales.get(productId);
            
            bestSellers.push({
              id: productDoc.id,
              ...productData,
              totalSold: salesData,
              // Convert Firestore Timestamp to ISO string
              createdAt: productData.createdAt?.toDate ? productData.createdAt.toDate().toISOString() : productData.createdAt,
              updatedAt: productData.updatedAt?.toDate ? productData.updatedAt.toDate().toISOString() : productData.updatedAt
            });
          }
        } catch (productError) {
          console.warn(`⚠️ Could not fetch product ${productId}:`, productError.message);
        }
      }
    }
    
    console.log(`✅ Found ${bestSellers.length} best selling products`);
    console.log('📊 Sales data:', sortedSales.map(([id, qty]) => `${id}: ${qty} sold`).join(', '));
    
    res.json({
      success: true,
      products: bestSellers,
      salesData: Object.fromEntries(productSales)
    });
    
  } catch (error) {
    console.error('❌ Error getting best sellers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API route to get all users data for statistics
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    console.log('👥 Getting users data for statistics...');
    console.log('👤 Admin user:', req.user.email, '- is_admin:', req.user.is_admin);
    
    const usersSnapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        email: data.email,
        name: data.name,
        // Convert Firestore Timestamp to ISO string for proper JSON serialization
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
      });
    });
    
    console.log(`✅ Retrieved ${users.length} users`);
    
    res.json({
      success: true,
      users: users,
      total: users.length
    });
    
  } catch (error) {
    console.error('❌ Error getting users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API route to get all products
app.get('/api/products', async (req, res) => {
  try {
    console.log('📦 Getting products from database...');
    
    // Get query parameters for filtering
    const { 
      category = '', 
      brand = '', 
      minPrice, 
      maxPrice, 
      rating,
      sort = 'default',
      limit = 100, // Increased default limit to handle variant filtering
      offset = 0 
    } = req.query;

    // Handle undefined or invalid price parameters
    const minPriceValue = (minPrice && minPrice !== 'undefined') ? parseInt(minPrice) || 0 : 0;
    const maxPriceValue = (maxPrice && maxPrice !== 'undefined') ? parseInt(maxPrice) || 999999999 : 999999999;

    console.log('🔍 Query parameters:', { category, brand, minPrice: minPriceValue, maxPrice: maxPriceValue, rating, sort, limit, offset });
    
    // First, check if products collection exists and has data
    const testSnapshot = await db.collection('products').limit(1).get();
    if (testSnapshot.empty) {
      console.log('⚠️ Products collection is empty, returning empty result');
      return res.json({
        success: true,
        products: [],
        pagination: {
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: false
        },
        message: 'No products found. Please seed the database first.'
      });
    }
    
    // Start with base query and apply filters step by step
    let productsQuery = db.collection('products');
    const filters = [];
    
    // Filter out variant products (products with parent_id_product)
    // Only show main products (those without parent_id_product)
    console.log('🔄 Filtering out variant products (parent_id_product exists)');
    filters.push('exclude variants (no parent_id_product)');
    
    // Variables for in-memory filtering
    let categoryFilterValues = [];
    let brandFilterValues = [];
    let ratingFilter = 0;
    
    // Parse category filter
    if (category && category !== 'all' && category.length > 0) {
      const categories = category.split(',').filter(c => c.trim());
      console.log('📂 Category filter requested:', categories);
      categoryFilterValues = categories.map(c => c.toLowerCase());
      filters.push(`category in-memory: [${categories.join(',')}]`);
    }
    
    // Parse brand filter (case-insensitive approach)
    if (brand && brand.length > 0) {
      const brands = brand.split(',').filter(b => b.trim());
      console.log(`🏢 Brand filter requested (case-insensitive):`, brands);
      brandFilterValues = brands.map(b => b.toLowerCase());
      filters.push(`brand case-insensitive: [${brands.join(',')}]`);
    }
    
    // Parse rating filter - only apply if rating is provided and > 0
    if (rating && rating !== '' && rating !== 'undefined' && parseFloat(rating) > 0) {
      console.log(`⭐ Rating filter requested: ${rating} stars or higher`);
      ratingFilter = parseFloat(rating);
      filters.push(`rating>=${rating}`);
    } else {
      console.log(`⭐ No rating filter applied (rating: ${rating})`);
    }
    
    // Use minimal Firestore query to avoid composite index issues
    // Only apply the most selective filter to Firestore, rest in memory
    let useFirestoreFilter = false;
    
    if (categoryFilterValues.length === 1 && !brandFilterValues.length && !ratingFilter) {
      // Single category filter - safe to use in Firestore
      console.log('📂 Using Firestore category filter:', categoryFilterValues[0]);
      productsQuery = productsQuery.where('category', '==', categoryFilterValues[0]);
      categoryFilterValues = []; // Clear since handled by Firestore
      useFirestoreFilter = true;
    } else {
      console.log('🔄 Using in-memory filtering to avoid composite index issues');
    }
    
    // Apply simple sorting (avoiding complex compound queries)
    // Skip orderBy when using Firestore filters to avoid composite index errors
    if (!useFirestoreFilter) {
      switch (sort) {
        case 'name-asc':
          productsQuery = productsQuery.orderBy('name', 'asc');
          break;
        case 'name-desc':
          productsQuery = productsQuery.orderBy('name', 'desc');
          break;
        case 'price-asc':
          productsQuery = productsQuery.orderBy('price', 'asc');
          break;
        case 'price-desc':
          productsQuery = productsQuery.orderBy('price', 'desc');
          break;
        case 'rating-desc':
          productsQuery = productsQuery.orderBy('rating', 'desc');
          break;
        case 'newest':
          productsQuery = productsQuery.orderBy('createdAt', 'desc');
          break;
        default:
          // Default sorting - avoid complex queries
          productsQuery = productsQuery.orderBy('createdAt', 'desc');
      }
    } else {
      console.log('⚠️ Skipping orderBy due to Firestore where clauses to avoid composite index requirements');
    }
    
    // Apply pagination
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    
    // For better performance with variant filtering, fetch ALL products first
    // We'll apply pagination after filtering out variants
    // Don't apply Firestore limit here - we need all products to filter variants properly
    // const fetchLimit = Math.min(limitNum * 3, 300); // Old: was too small
    // productsQuery = productsQuery.limit(fetchLimit);
    // Note: pagination will be applied in-memory after variant filtering
    
    console.log('🔍 Executing query with filters:', filters.join(', '));
    const snapshot = await productsQuery.get();
    let products = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      products.push({
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to ISO string if needed
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      });
    });
    
    // Filter out variant products (products with parent_id_product)
    const originalCount = products.length;
    products = products.filter(product => {
      // Only show main products (those without parent_id_product)
      const isVariant = product.parent_id_product && product.parent_id_product.trim() !== '';
      const shouldShow = !isVariant;
      if (isVariant) {
        console.log(`🚫 Filtering out variant product: "${product.name}" (parent: ${product.parent_id_product})`);
      }
      return shouldShow;
    });
    console.log(`🔄 Variant filter applied: ${originalCount} -> ${products.length} products (removed ${originalCount - products.length} variants)`);
    
    // Apply in-memory category filter
    if (categoryFilterValues.length > 0) {
      const originalCount = products.length;
      products = products.filter(product => {
        const productCategory = (product.category || '').toLowerCase();
        const match = categoryFilterValues.includes(productCategory);
        console.log(`📂 Category check: "${product.category}" (${productCategory}) -> ${match}`);
        return match;
      });
      console.log(`📂 Category filter applied: ${originalCount} -> ${products.length} products`);
    }
    
    // Apply in-memory brand filter (case-insensitive)
    if (brandFilterValues.length > 0) {
      const originalCount = products.length;
      products = products.filter(product => {
        const productBrand = (product.brand || '').toLowerCase();
        const match = brandFilterValues.includes(productBrand);
        console.log(`🏢 Brand check: "${product.brand}" (${productBrand}) -> ${match}`);
        return match;
      });
      console.log(`🏢 Brand filter applied: ${originalCount} -> ${products.length} products`);
    }
    
    // Apply in-memory rating filter
    if (ratingFilter > 0) {
      const originalCount = products.length;
      products = products.filter(product => {
        const productRating = product.rating || 0;
        const match = productRating >= ratingFilter;
        console.log(`⭐ Rating check: ${productRating} >= ${ratingFilter} -> ${match}`);
        return match;
      });
      console.log(`⭐ Rating filter applied: ${originalCount} -> ${products.length} products`);
    }
    
    // Apply price filtering in memory (to avoid complex Firestore queries)
    if (minPriceValue > 0 || maxPriceValue < 999999999) {
      const originalCount = products.length;
      console.log(`💰 Price filter range: ${minPriceValue} - ${maxPriceValue}`);
      console.log(`💰 Products before price filter:`, products.map(p => `${p.name}: ${p.price}`));
      
      products = products.filter(product => {
        const price = product.price || 0;
        const match = price >= minPriceValue && price <= maxPriceValue;
        console.log(`💰 Price check: "${product.name}" price=${price} in range [${minPriceValue}, ${maxPriceValue}] -> ${match}`);
        return match;
      });
      console.log(`💰 Price filter applied: ${originalCount} -> ${products.length} products`);
    }
    
    // Apply sorting in memory if we used Firestore filter (to avoid composite index)
    if (useFirestoreFilter && sort !== 'default') {
      console.log(`🔄 Applying sort ${sort} in memory`);
      switch (sort) {
        case 'name-asc':
          products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
        case 'name-desc':
          products.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
          break;
        case 'price-asc':
          products.sort((a, b) => (a.price || 0) - (b.price || 0));
          break;
        case 'price-desc':
          products.sort((a, b) => (b.price || 0) - (a.price || 0));
          break;
        case 'rating-desc':
          products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case 'newest':
          products.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          break;
        default:
          products.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }
    }
    
    console.log(`✅ Final result: ${products.length} products after all filters`);
    
    // Store total count before pagination
    const totalAfterFiltering = products.length;
    
    // Apply pagination in-memory after all filtering
    const startIndex = offsetNum;
    const endIndex = startIndex + limitNum;
    const paginatedProducts = products.slice(startIndex, endIndex);
    
    console.log(`📄 Pagination: showing ${paginatedProducts.length} products (${startIndex}-${endIndex} of ${totalAfterFiltering})`);

    res.json({
      success: true,
      products: paginatedProducts,
      pagination: {
        total: totalAfterFiltering,
        limit: limitNum,
        offset: offsetNum,
        hasMore: endIndex < totalAfterFiltering
      },
      filters: {
        category,
        brand,
        minPrice: minPriceValue,
        maxPrice: maxPriceValue,
        rating: parseFloat(rating),
        sort
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting products:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get products',
      details: error.message 
    });
  }
});

// API route to seed sample products (for testing)
app.post('/api/seed-products', async (req, res) => {
  try {
    console.log('🌱 Seeding sample products...');
    
    const sampleProducts = [
      {
        name: 'ASUS ROG Strix G15 Gaming',
        price: 35990000,
        oldPrice: 39990000,
        category: 'laptop',
        brand: 'asus',
        rating: 5,
        image: '/images/laptop.jpg',
        images: ['/images/laptop.jpg', '/images/gpu1.jpg'],
        description: 'Laptop gaming ASUS ROG Strix G15 với hiệu năng mạnh mẽ',
        discount: true,
        stock: 15,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'MSI Katana 17 B13V',
        price: 28990000,
        category: 'laptop',
        brand: 'msi',
        rating: 4,
        image: '/images/laptop.jpg',
        images: ['/images/laptop.jpg'],
        description: 'Laptop gaming MSI Katana 17 với thiết kế mạnh mẽ',
        stock: 8,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Acer Predator Helios 300',
        price: 32990000,
        category: 'laptop',
        brand: 'acer',
        rating: 4,
        image: '/images/laptop.jpg',
        images: ['/images/laptop.jpg', '/images/gpu2.jpg'],
        description: 'Laptop gaming Acer Predator với hiệu năng tối ưu',
        stock: 12,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Intel Core i9-14900K',
        price: 15990000,
        category: 'cpu',
        brand: 'intel',
        rating: 5,
        image: '/images/cpu.jpg',
        images: ['/images/keyboard.jpg'],
        description: 'Vi xử lý Intel Core i9 thế hệ 14 hiệu năng cao',
        stock: 25,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'AMD Ryzen 9 7950X',
        price: 18990000,
        category: 'cpu',
        brand: 'amd',
        rating: 5,
        image: '/images/cpu.jpg',
        images: ['/images/keyboard.jpg', '/images/gpu1.jpg'],
        description: 'Vi xử lý AMD Ryzen 9 series 7000 mạnh mẽ',
        stock: 20,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'ASUS ROG Strix RTX 4080',
        price: 29990000,
        oldPrice: 32990000,
        category: 'gpu',
        brand: 'asus',
        rating: 5,
        image: '/images/gpu1.jpg',
        images: ['/images/gpu1.jpg', '/images/gpu2.jpg'],
        description: 'Card đồ họa ASUS ROG Strix RTX 4080 gaming',
        discount: true,
        stock: 10,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'MSI RTX 4070 Ti SUPER',
        price: 22990000,
        category: 'gpu',
        brand: 'msi',
        rating: 5,
        image: '/images/gpu2.jpg',
        images: ['/images/gpu2.jpg', '/images/laptop.jpg'],
        description: 'Card đồ họa MSI RTX 4070 Ti SUPER',
        stock: 18,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Corsair Vengeance RGB Pro 32GB',
        price: 4990000,
        category: 'ram',
        brand: 'corsair',
        rating: 4,
        image: '/images/ram.jpg',
        images: ['/images/keyboard.jpg'],
        description: 'RAM Corsair Vengeance RGB Pro 32GB DDR4',
        stock: 30,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Samsung 980 PRO 1TB NVMe SSD',
        price: 3990000,
        category: 'storage',
        brand: 'samsung',
        rating: 5,
        image: '/images/ssd.jpg',
        description: 'Ổ cứng SSD Samsung 980 PRO 1TB NVMe',
        stock: 35,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'LG UltraGear 27GN950 4K Gaming',
        price: 12990000,
        category: 'monitor',
        brand: 'lg',
        rating: 4,
        image: '/images/monitor.jpg',
        description: 'Màn hình gaming LG UltraGear 27 inch 4K',
        stock: 15,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Razer DeathAdder V3 Gaming Mouse',
        price: 1990000,
        category: 'peripheral',
        brand: 'razer',
        rating: 4,
        image: '/images/mouse.jpg',
        description: 'Chuột gaming Razer DeathAdder V3 chuyên nghiệp',
        stock: 40,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        name: 'Logitech G Pro X Mechanical Keyboard',
        price: 3490000,
        category: 'peripheral',
        brand: 'logitech',
        rating: 5,
        image: '/images/keyboard.jpg',
        description: 'Bàn phím cơ gaming Logitech G Pro X',
        stock: 22,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];
    
    const batch = db.batch();
    
    sampleProducts.forEach((product, index) => {
      const productRef = db.collection('products').doc(`product_${index + 1}`);
      batch.set(productRef, product);
    });
    
    await batch.commit();
    
    console.log(`✅ Successfully seeded ${sampleProducts.length} sample products`);
    
    res.json({
      success: true,
      message: `Successfully seeded ${sampleProducts.length} sample products`,
      count: sampleProducts.length
    });
    
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to seed products' 
    });
  }
});

// API route to get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('📦 Getting product by ID:', productId);
    
    const productDoc = await db.collection('products').doc(productId).get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const product = {
      id: productDoc.id,
      ...productDoc.data()
    };
    
    console.log('✅ Product found:', product.name);
    
    res.json({
      success: true,
      product: product
    });
    
  } catch (error) {
    console.error('❌ Error getting product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get product' 
    });
  }
});

// API route to get product variants by main product ID
app.get('/api/products/:id/variants', async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('🔗 Getting variants for product ID:', productId);
    
    // First get the main product
    const mainProductDoc = await db.collection('products').doc(productId).get();
    
    if (!mainProductDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Main product not found'
      });
    }
    
    const mainProduct = {
      id: mainProductDoc.id,
      ...mainProductDoc.data()
    };
    
    // Get all variants that have this product as parent
    const variantsSnapshot = await db.collection('products')
      .where('parent_id_product', '==', productId)
      .where('has_variant', '==', true)
      .get();
    
    const variants = [];
    variantsSnapshot.forEach(doc => {
      variants.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Found ${variants.length} variants for product: ${mainProduct.name}`);
    
    res.json({
      success: true,
      mainProduct: mainProduct,
      variants: variants,
      hasVariants: variants.length > 0 || mainProduct.has_variant
    });
    
  } catch (error) {
    console.error('❌ Error getting product variants:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get product variants' 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Firebase Auth Demo',
    environment: isLocal ? 'Local Development' : 'Firebase Functions'
  });
});

// API route for manual user profile update (without token)
app.post('/api/user/profile-manual', async (req, res) => {
  try {
    const { uid, name, phone, photo } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    console.log('📝 Updating manual user profile:', uid);
    console.log('📸 Photo data received:', photo);
    
    // Update data in Firestore
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log('❌ User not found in Firestore:', uid);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (photo !== undefined) updateData.photo = photo;
    
    console.log('📊 Update data to be saved:', updateData);
    
    await userRef.update(updateData);
    console.log('✅ Manual user profile updated successfully');
    
    // Get updated user data
    const updatedDoc = await userRef.get();
    const updatedUserData = updatedDoc.data();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        uid: updatedUserData.uid,
        email: updatedUserData.email,
        name: updatedUserData.name,
        phone: updatedUserData.phone,
        photo: updatedUserData.photo,
        provider: updatedUserData.provider,
        is_admin: updatedUserData.is_admin || false
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating manual user profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// =====================================
// USER ADDRESS MANAGEMENT APIs
// =====================================

// Geocode address to get coordinates using free Nominatim API
app.post('/api/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Generate fallback addresses (simplify if detailed address not found)
    // Example: "101/60a Lê Văn Lương" → ["101/60a Lê Văn Lương", "101 Lê Văn Lương", "Lê Văn Lương"]
    const addressVariants = generateAddressVariants(address);
    console.log('🔍 Trying address variants:', addressVariants);

    // Use https module for request
    const https = require('https');
    
    // Try each address variant until one works
    tryGeocodeVariants(addressVariants, 0);
    
    function tryGeocodeVariants(variants, index) {
      if (index >= variants.length) {
        // All variants failed
        console.error('❌ Geocoding failed: No results found for any variant');
        return res.status(400).json({ 
          error: 'Could not geocode address',
          details: 'No results found for this address. Please try a simpler address format.',
          attemptedAddresses: variants
        });
      }
      
      const currentAddress = variants[index];
      const encodedAddress = encodeURIComponent(currentAddress);
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
      
      const options = {
        headers: {
          'User-Agent': 'TechHaven-App/1.0' // Required by Nominatim
        }
      };
      
      console.log(`🔍 Attempt ${index + 1}/${variants.length}: Trying "${currentAddress}"`);
      
      https.get(geocodeUrl, options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            
            if (parsed && parsed.length > 0) {
              const result = parsed[0];
              const coordinates = {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon)
              };
              
              console.log(`✅ Geocoded (attempt ${index + 1}):`, currentAddress, '→', coordinates);
              
              res.json({
                success: true,
                coordinates: coordinates,
                formattedAddress: result.display_name,
                usedAddress: currentAddress,
                originalAddress: address
              });
            } else {
              // Try next variant
              console.log(`⚠️ No results for "${currentAddress}", trying next variant...`);
              setTimeout(() => tryGeocodeVariants(variants, index + 1), 500); // Small delay to avoid rate limiting
            }
          } catch (parseError) {
            console.error('❌ Error parsing geocode response:', parseError);
            res.status(500).json({ error: 'Failed to parse geocoding response' });
          }
        });
      }).on('error', (error) => {
        console.error('❌ Geocoding request error:', error);
        res.status(500).json({ error: 'Failed to geocode address' });
      });
    }
    
    // Helper function to generate address variants
    function generateAddressVariants(addr) {
      const variants = [addr]; // Start with original address
      
      // Pattern 1: "101/60a Lê Văn Lương, Quận, Thành phố"
      // Simplify to: "101 Lê Văn Lương, Quận, Thành phố"
      const simplifiedNumber = addr.replace(/(\d+)\/[\d\w]+/g, '$1');
      if (simplifiedNumber !== addr) {
        variants.push(simplifiedNumber);
      }
      
      // Pattern 2: Further simplify - keep only street and city
      // "101 Lê Văn Lương, Hồ Chí Minh" → just street and main city
      const parts = addr.split(',').map(p => p.trim());
      if (parts.length > 2) {
        // Try: [street, city]
        const streetAndCity = `${parts[0].replace(/(\d+)\/[\d\w]+/g, '$1')}, ${parts[parts.length - 1]}`;
        if (!variants.includes(streetAndCity)) {
          variants.push(streetAndCity);
        }
      }
      
      // Pattern 3: Just the street name (no house number)
      const streetOnly = addr.replace(/^\d+[\/\d\w]*\s+/, '');
      if (streetOnly !== addr && streetOnly.length > 5) {
        variants.push(streetOnly);
      }
      
      return variants;
    }
    
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Get user addresses
app.get('/api/user/addresses', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const addresses = userData.addresses || [];

    console.log('📍 Retrieved addresses for user:', req.user.name, '- Count:', addresses.length);

    res.json({
      success: true,
      addresses: addresses
    });
  } catch (error) {
    console.error('❌ Error retrieving addresses:', error);
    res.status(500).json({ error: 'Failed to retrieve addresses' });
  }
});

// Add new address
app.post('/api/user/addresses', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { address, city, district, isDefault, coordinates } = req.body;

    // Validation
    if (!address || !city || !district) {
      return res.status(400).json({ error: 'Tất cả thông tin địa chỉ là bắt buộc' });
    }

    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    let addresses = userData.addresses || [];

    // Create new address object (use regular Date instead of FieldValue in arrays)
    const now = new Date();
    const newAddress = {
      address: address.trim(),
      city: city,
      district: district.trim(),
      isDefault: isDefault || false,
      coordinates: coordinates || null, // Save coordinates if provided
      createdAt: now,
      updatedAt: now
    };

    // If this is set as default, unset all other defaults
    if (newAddress.isDefault) {
      addresses = addresses.map(addr => ({ ...addr, isDefault: false }));
    }

    // Add new address
    addresses.push(newAddress);

    // Update user document
    await userRef.update({
      addresses: addresses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ New address added for user:', req.user.name, coordinates ? '(with coordinates)' : '(no coordinates)');

    res.json({
      success: true,
      message: 'Địa chỉ đã được thêm thành công',
      address: newAddress
    });
  } catch (error) {
    console.error('❌ Error adding address:', error);
    res.status(500).json({ error: 'Không thể thêm địa chỉ' });
  }
});

// Update existing address
app.put('/api/user/addresses/:index', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const addressIndex = parseInt(req.params.index);
    const { address, city, district, isDefault, coordinates } = req.body;

    // Validation
    if (!address || !city || !district) {
      return res.status(400).json({ error: 'Tất cả thông tin địa chỉ là bắt buộc' });
    }

    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    let addresses = userData.addresses || [];

    if (addressIndex < 0 || addressIndex >= addresses.length) {
      return res.status(404).json({ error: 'Địa chỉ không tồn tại' });
    }

    // If this is set as default, unset all other defaults
    if (isDefault) {
      addresses = addresses.map((addr, idx) => ({ 
        ...addr, 
        isDefault: idx === addressIndex ? true : false 
      }));
    }

    // Update the specific address (use regular Date instead of FieldValue in arrays)
    addresses[addressIndex] = {
      ...addresses[addressIndex],
      address: address.trim(),
      city: city,
      district: district.trim(),
      isDefault: isDefault || false,
      coordinates: coordinates !== undefined ? coordinates : addresses[addressIndex].coordinates, // Keep or update coordinates
      updatedAt: new Date()
    };

    // Update user document
    await userRef.update({
      addresses: addresses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Address updated for user:', req.user.name, 'at index:', addressIndex, coordinates ? '(with coordinates)' : '(no coordinate update)');

    res.json({
      success: true,
      message: 'Địa chỉ đã được cập nhật',
      address: addresses[addressIndex]
    });
  } catch (error) {
    console.error('❌ Error updating address:', error);
    res.status(500).json({ error: 'Không thể cập nhật địa chỉ' });
  }
});

// Set address as default
app.put('/api/user/addresses/:index/set-default', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const addressIndex = parseInt(req.params.index);

    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    let addresses = userData.addresses || [];

    if (addressIndex < 0 || addressIndex >= addresses.length) {
      return res.status(404).json({ error: 'Địa chỉ không tồn tại' });
    }

    // Set all addresses as non-default, then set the selected one as default
    addresses = addresses.map((addr, idx) => ({
      ...addr,
      isDefault: idx === addressIndex
    }));

    // Update user document
    await userRef.update({
      addresses: addresses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Default address set for user:', req.user.name, 'at index:', addressIndex);

    res.json({
      success: true,
      message: 'Địa chỉ mặc định đã được cập nhật'
    });
  } catch (error) {
    console.error('❌ Error setting default address:', error);
    res.status(500).json({ error: 'Không thể đặt địa chỉ mặc định' });
  }
});

// Delete address
app.delete('/api/user/addresses/:index', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const addressIndex = parseInt(req.params.index);

    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    let addresses = userData.addresses || [];

    if (addressIndex < 0 || addressIndex >= addresses.length) {
      return res.status(404).json({ error: 'Địa chỉ không tồn tại' });
    }

    // Remove the address
    addresses.splice(addressIndex, 1);

    // If we deleted the default address and there are remaining addresses,
    // set the first one as default
    if (addresses.length > 0 && !addresses.some(addr => addr.isDefault)) {
      addresses[0].isDefault = true;
    }

    // Update user document
    await userRef.update({
      addresses: addresses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Address deleted for user:', req.user.name, 'at index:', addressIndex);

    res.json({
      success: true,
      message: 'Địa chỉ đã được xóa'
    });
  } catch (error) {
    console.error('❌ Error deleting address:', error);
    res.status(500).json({ error: 'Không thể xóa địa chỉ' });
  }
});

// =====================================
// SHOPPING CART APIs
// =====================================

// Get user's cart
app.get('/api/cart', async (req, res) => {
  try {
    const userId = req.query.uid;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    console.log('🛒 Getting cart for user:', userId);
    
    const cartSnapshot = await db.collection('carts')
      .where('userId', '==', userId)
      .get();
    
    let cartItems = [];
    let total = 0;
    
    if (!cartSnapshot.empty) {
      for (const doc of cartSnapshot.docs) {
        const cartItem = { id: doc.id, ...doc.data() };
        
        // Validate basic cart item structure first
        if (!cartItem.productId || cartItem.productId === 'undefined' || 
            !cartItem.quantity || cartItem.quantity <= 0) {
          console.warn('🗑️ Skipping invalid cart item:', cartItem);
          // Delete this invalid cart item
          await doc.ref.delete();
          continue;
        }
        
        // Get product details
        const productDoc = await db.collection('products').doc(cartItem.productId).get();
        if (productDoc.exists) {
          const product = productDoc.data();
          
          // Validate product data
          if (!product.name || !product.price || isNaN(product.price)) {
            console.warn('🗑️ Skipping cart item with invalid product data:', { cartItem, product });
            // Delete this cart item with invalid product
            await doc.ref.delete();
            continue;
          }
          
          // Normalize cart item structure for frontend
          cartItem.cartId = doc.id; // Add cartId for frontend operations
          cartItem.productName = product.name;
          cartItem.name = product.name; // Add both for compatibility
          cartItem.productPrice = product.price;
          cartItem.price = product.price; // Add both for compatibility
          cartItem.numericPrice = parseFloat(product.price) || 0;
          cartItem.productImage = product.images?.[0] || product.image;
          cartItem.image = product.images?.[0] || product.image; // Add both for compatibility
          cartItem.total = cartItem.quantity * parseFloat(product.price);
          total += cartItem.total;
          
          cartItems.push(cartItem);
        } else {
          console.warn('🗑️ Product not found for cart item, removing:', cartItem.productId);
          // Delete cart item for non-existent product
          await doc.ref.delete();
        }
      }
    }
    
    console.log(`✅ Retrieved ${cartItems.length} cart items, total: ${total}`);
    
    res.json({
      success: true,
      cartItems,
      total,
      itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0)
    });
    
  } catch (error) {
    console.error('❌ Error getting cart:', error);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

// Add item to cart
app.post('/api/cart', async (req, res) => {
  try {
    const { userId, productId, quantity = 1 } = req.body;
    
    if (!userId || !productId) {
      return res.status(400).json({ error: 'User ID and Product ID are required' });
    }
    
    console.log('🛒 Adding to cart:', { userId, productId, quantity });
    
    // Check if item already exists in cart
    const existingCartSnapshot = await db.collection('carts')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .get();
    
    if (!existingCartSnapshot.empty) {
      // Update existing item - ADD to existing quantity instead of overwriting
      const cartDoc = existingCartSnapshot.docs[0];
      const currentQuantity = cartDoc.data().quantity;
      const newQuantity = currentQuantity + quantity;
      
      await cartDoc.ref.update({
        quantity: newQuantity, // ADD to existing quantity
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Updated cart item quantity: ${currentQuantity} + ${quantity} = ${newQuantity} (ADD)`);
    } else {
      // Add new item
      await db.collection('carts').add({
        userId,
        productId,
        quantity,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Added new item to cart');
    }
    
    res.json({ success: true, message: 'Item added to cart' });
    
  } catch (error) {
    console.error('❌ Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

// Update cart item quantity
app.put('/api/cart/:cartItemId', async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }
    
    console.log('🛒 Updating cart item:', cartItemId, 'quantity:', quantity);
    
    // Check if cart item exists first
    const cartItemRef = db.collection('carts').doc(cartItemId);
    const cartItemDoc = await cartItemRef.get();
    
    if (!cartItemDoc.exists) {
      console.log('ℹ️ Cart item already removed (checkout completed)');
      return res.status(200).json({ 
        success: true, 
        message: 'Cart item already removed',
        alreadyRemoved: true 
      });
    }
    
    if (quantity === 0) {
      // Remove item if quantity is 0
      await cartItemRef.delete();
      console.log('✅ Removed cart item');
    } else {
      // Update quantity
      await cartItemRef.update({
        quantity,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Updated cart item quantity');
    }
    
    res.json({ success: true, message: 'Cart updated' });
    
  } catch (error) {
    console.error('❌ Error updating cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Update cart quantity by productId  
app.post('/api/cart/update-quantity', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { productId, quantity, userId: bodyUserId } = req.body;
    let userId;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Firebase Auth user
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      userId = decodedToken.uid;
    } else if (bodyUserId) {
      // Manual user - get userId from body
      userId = bodyUserId;
    } else {
      return res.status(400).json({ error: 'User authentication required' });
    }
    
    if (!productId || !quantity || quantity < 0) {
      return res.status(400).json({ error: 'Product ID and valid quantity are required' });
    }
    
    console.log('🛒 Updating cart quantity for product:', productId, 'to quantity:', quantity);
    
    // Find the cart item
    const cartSnapshot = await db.collection('carts')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .get();
    
    if (cartSnapshot.empty) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    const cartDoc = cartSnapshot.docs[0];
    
    if (quantity === 0) {
      // Remove item if quantity is 0
      await cartDoc.ref.delete();
      console.log('✅ Removed cart item');
    } else {
      // Update quantity
      await cartDoc.ref.update({
        quantity,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Updated cart item quantity to:', quantity);
    }
    
    res.json({ success: true, message: 'Cart quantity updated' });
    
  } catch (error) {
    console.error('❌ Error updating cart quantity:', error);
    res.status(500).json({ error: 'Failed to update cart quantity' });
  }
});

// Remove item from cart
app.delete('/api/cart/:cartItemId', async (req, res) => {
  try {
    const { cartItemId } = req.params;
    
    console.log('🛒 Removing cart item:', cartItemId);
    
    await db.collection('carts').doc(cartItemId).delete();
    
    console.log('✅ Cart item removed');
    
    res.json({ success: true, message: 'Item removed from cart' });
    
  } catch (error) {
    console.error('❌ Error removing cart item:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Remove cart item by productId (for frontend integration)
app.delete('/api/cart/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const authHeader = req.headers.authorization;
    let userId;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Firebase Auth user
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      userId = decodedToken.uid;
    } else if (req.query.userId) {
      // Manual user - get userId from query parameter
      userId = req.query.userId;
    } else {
      return res.status(400).json({ error: 'User authentication required' });
    }
    
    console.log('🛒 Removing cart item for user:', userId, 'productId:', productId);
    
    // Find and delete cart item by userId and productId
    const cartSnapshot = await db.collection('carts')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .get();
    
    if (cartSnapshot.empty) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    const batch = db.batch();
    cartSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log('✅ Cart item removed by productId');
    
    res.json({ success: true, message: 'Item removed from cart' });
    
  } catch (error) {
    console.error('❌ Error removing cart item by productId:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Clear entire cart
app.delete('/api/cart/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🛒 Clearing cart for user:', userId);
    
    const cartSnapshot = await db.collection('carts')
      .where('userId', '==', userId)
      .get();
    
    const batch = db.batch();
    cartSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`✅ Cleared ${cartSnapshot.docs.length} items from cart`);
    
    res.json({ success: true, message: 'Cart cleared' });
    
  } catch (error) {
    console.error('❌ Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// Process order completion - ONLY clear cart (stock already updated by /api/bills)
app.post('/api/order/complete', async (req, res) => {
  try {
    const { userId, orderItems } = req.body;
    
    if (!userId || !orderItems || !Array.isArray(orderItems)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId and orderItems'
      });
    }

    console.log(`🧹 Processing order completion (cart cleanup only) for user: ${userId}`);
    console.log(`📦 Order items count:`, orderItems.length);

    // Clear user's cart (stock already updated by /api/bills endpoint)
    const cartQuery = db.collection('carts').where('userId', '==', userId);
    const cartSnapshot = await cartQuery.get();
    
    const batch = db.batch();
    cartSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`✅ Order completed: cart cleared for user ${userId} (${cartSnapshot.size} items removed)`);
    console.log(`ℹ️ Stock updates handled by /api/bills endpoint`);
    
    res.json({
      success: true,
      message: 'Order completed successfully',
      itemsProcessed: orderItems.length,
      cartItemsCleared: cartSnapshot.size
    });

  } catch (error) {
    console.error('❌ Error completing order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete order'
    });
  }
});

// =====================================
// ALTERNATIVE ADDRESS MANAGEMENT FOR MANUAL USERS
// =====================================

// Get user addresses using UID (for manual login users)
app.get('/api/user/addresses/by-uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }
    
    console.log('📍 Getting addresses for UID:', uid);
    
    // Get user document
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      console.log('❌ User not found:', uid);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    console.log('✅ Found user addresses:', userData.addresses?.length || 0);
    
    res.json({
      success: true,
      addresses: userData.addresses || []
    });
    
  } catch (error) {
    console.error('❌ Error getting addresses:', error);
    res.status(500).json({ error: 'Failed to get addresses' });
  }
});

// Add new address using UID (for manual login users)
app.post('/api/user/addresses/by-uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { address, city, district, isDefault, coordinates } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }
    
    if (!address || !city || !district) {
      return res.status(400).json({ error: 'Address, city, and district are required' });
    }
    
    console.log('📍 Adding new address for UID:', uid, coordinates ? '(with coordinates)' : '');
    
    // Get user document
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const currentAddresses = userData.addresses || [];
    
    // Create new address object
    const newAddress = {
      address,
      city,
      district,
      isDefault: isDefault || false,
      coordinates: coordinates || null // Save coordinates if provided
    };
    
    // If this is set as default, make all others not default
    if (isDefault) {
      currentAddresses.forEach(addr => addr.isDefault = false);
    }
    
    // Add new address
    currentAddresses.push(newAddress);
    
    // Update user document
    await userRef.update({
      addresses: currentAddresses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Address added successfully for UID:', uid);
    
    res.json({
      success: true,
      message: 'Address added successfully',
      addresses: currentAddresses
    });
    
  } catch (error) {
    console.error('❌ Error adding address:', error);
    res.status(500).json({ error: 'Failed to add address' });
  }
});

// Update address using UID (for manual login users)
app.put('/api/user/addresses/by-uid/:uid/:index', async (req, res) => {
  try {
    const { uid, index } = req.params;
    const { address, city, district, isDefault, coordinates } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }
    
    const addressIndex = parseInt(index);
    if (isNaN(addressIndex)) {
      return res.status(400).json({ error: 'Invalid address index' });
    }
    
    console.log('📍 Updating address for UID:', uid, 'Index:', addressIndex, coordinates ? '(with coordinates)' : '');
    
    // Get user document
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const currentAddresses = userData.addresses || [];
    
    if (addressIndex < 0 || addressIndex >= currentAddresses.length) {
      return res.status(400).json({ error: 'Address index out of range' });
    }
    
    // Update the address
    if (address) currentAddresses[addressIndex].address = address;
    if (city) currentAddresses[addressIndex].city = city;
    if (district) currentAddresses[addressIndex].district = district;
    if (coordinates !== undefined) currentAddresses[addressIndex].coordinates = coordinates; // Update coordinates if provided
    
    // Handle default status
    if (isDefault !== undefined) {
      if (isDefault) {
        // Make all others not default
        currentAddresses.forEach(addr => addr.isDefault = false);
      }
      currentAddresses[addressIndex].isDefault = isDefault;
    }
    
    // Update user document
    await userRef.update({
      addresses: currentAddresses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Address updated successfully for UID:', uid);
    
    res.json({
      success: true,
      message: 'Address updated successfully',
      addresses: currentAddresses
    });
    
  } catch (error) {
    console.error('❌ Error updating address:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// Set address as default using UID (for manual login users)
app.put('/api/user/addresses/by-uid/:uid/:index/set-default', async (req, res) => {
  try {
    const { uid, index } = req.params;
    
    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }
    
    const addressIndex = parseInt(index);
    if (isNaN(addressIndex)) {
      return res.status(400).json({ error: 'Invalid address index' });
    }
    
    console.log('📍 Setting default address for UID:', uid, 'Index:', addressIndex);
    
    // Get user document
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const currentAddresses = userData.addresses || [];
    
    if (addressIndex < 0 || addressIndex >= currentAddresses.length) {
      return res.status(400).json({ error: 'Address index out of range' });
    }
    
    // Make all addresses not default, then set the selected one as default
    currentAddresses.forEach((addr, idx) => {
      addr.isDefault = (idx === addressIndex);
    });
    
    // Update user document
    await userRef.update({
      addresses: currentAddresses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Default address set successfully for UID:', uid);
    
    res.json({
      success: true,
      message: 'Default address updated successfully',
      addresses: currentAddresses
    });
    
  } catch (error) {
    console.error('❌ Error setting default address:', error);
    res.status(500).json({ error: 'Failed to set default address' });
  }
});

// Delete address using UID (for manual login users)
app.delete('/api/user/addresses/by-uid/:uid/:index', async (req, res) => {
  try {
    const { uid, index } = req.params;
    
    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }
    
    const addressIndex = parseInt(index);
    if (isNaN(addressIndex)) {
      return res.status(400).json({ error: 'Invalid address index' });
    }
    
    console.log('📍 Deleting address for UID:', uid, 'Index:', addressIndex);
    
    // Get user document
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const currentAddresses = userData.addresses || [];
    
    if (addressIndex < 0 || addressIndex >= currentAddresses.length) {
      return res.status(400).json({ error: 'Address index out of range' });
    }
    
    // Remove the address
    currentAddresses.splice(addressIndex, 1);
    
    // Update user document
    await userRef.update({
      addresses: currentAddresses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Address deleted successfully for UID:', uid);
    
    res.json({
      success: true,
      message: 'Address deleted successfully',
      addresses: currentAddresses
    });
    
  } catch (error) {
    console.error('❌ Error deleting address:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// =====================================
// ALTERNATIVE CART MANAGEMENT FOR MANUAL USERS
// =====================================

// Get user's cart using UID (for manual login users)
app.get('/api/cart/by-uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log(`🛒 Getting cart for user ${uid} (manual)`);

    // Query cart items where userId equals uid
    const cartQuery = await db.collection('carts').where('userId', '==', uid).get();
    
    if (cartQuery.empty) {
      return res.json({ 
        success: true, 
        cart: { items: [], updatedAt: new Date() } 
      });
    }

    const items = [];
    cartQuery.docs.forEach(doc => {
      const cartItem = doc.data();
      items.push({
        productId: cartItem.productId,
        quantity: cartItem.quantity,
        updatedAt: cartItem.updatedAt
      });
    });
    
    console.log(`✅ Cart retrieved for user ${uid} (manual):`, items.length, 'items');
    
    res.json({ 
      success: true, 
      cart: { items, updatedAt: new Date() } 
    });

  } catch (error) {
    console.error('❌ Error getting cart (manual):', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get cart' 
    });
  }
});

// Save user's cart using UID (for manual login users)
app.post('/api/cart/by-uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { items } = req.body;
    
    console.log(`🛒 Saving cart for user ${uid} (manual):`, items?.length || 0, 'items');

    if (!Array.isArray(items)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cart items must be an array' 
      });
    }

    // Delete existing cart items for this user
    const existingCartQuery = await db.collection('carts').where('userId', '==', uid).get();
    const batch = db.batch();
    
    existingCartQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Add new cart items with correct structure
    items.forEach(item => {
      if (item.productId && item.quantity > 0) {
        const cartRef = db.collection('carts').doc(); // Auto-generate document ID
        batch.set(cartRef, {
          userId: uid,
          productId: item.productId,
          quantity: item.quantity,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
    await batch.commit();

    console.log(`✅ Cart saved for user ${uid} (manual)`);
    res.json({ 
      success: true, 
      message: 'Cart saved successfully' 
    });

  } catch (error) {
    console.error('❌ Error saving cart (manual):', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save cart' 
    });
  }
});

// Clear user's cart using UID (for manual login users)
app.delete('/api/cart/by-uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log(`🗑️ Clearing cart for user ${uid} (manual)`);

    // Delete all cart items where userId equals uid
    const cartQuery = await db.collection('carts').where('userId', '==', uid).get();
    const batch = db.batch();
    
    cartQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();

    console.log(`✅ Cart cleared for user ${uid} (manual)`);
    res.json({ 
      success: true, 
      message: 'Cart cleared successfully' 
    });

  } catch (error) {
    console.error('❌ Error clearing cart (manual):', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear cart' 
    });
  }
});

// =====================================
// WISHLIST API ENDPOINTS
// =====================================

// Get user's wishlist
app.get('/api/wishlist/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('📋 Getting wishlist for user:', userId);

    const wishlistSnapshot = await db.collection('wishlists')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const wishlistItems = [];
    wishlistSnapshot.forEach(doc => {
      wishlistItems.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✅ Retrieved ${wishlistItems.length} wishlist items for user ${userId}`);
    res.json({ 
      success: true, 
      items: wishlistItems 
    });

  } catch (error) {
    console.error('❌ Error getting wishlist:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get wishlist' 
    });
  }
});

// Add item to wishlist
app.post('/api/wishlist', async (req, res) => {
  try {
    const { userId, productId, name, price, image } = req.body;
    
    if (!userId || !productId) {
      return res.status(400).json({ error: 'User ID and Product ID are required' });
    }

    console.log('💖 Adding to wishlist:', { userId, productId, name });

    // Check if item already exists in wishlist
    const existingWishlistSnapshot = await db.collection('wishlists')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .get();

    if (!existingWishlistSnapshot.empty) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item already in wishlist' 
      });
    }

    // Add new item to wishlist
    const wishlistData = {
      userId,
      productId,
      name: name || 'Unknown Product',
      productName: name || 'Unknown Product',
      price: price || '0',
      productPrice: price || '0',
      image: image || '',
      productImage: image || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('wishlists').add(wishlistData);

    console.log('✅ Added to wishlist with ID:', docRef.id);
    res.json({ 
      success: true, 
      message: 'Item added to wishlist',
      id: docRef.id
    });

  } catch (error) {
    console.error('❌ Error adding to wishlist:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add to wishlist' 
    });
  }
});

// Remove item from wishlist by wishlist document ID
app.delete('/api/wishlist/:wishlistItemId', async (req, res) => {
  try {
    const { wishlistItemId } = req.params;
    console.log('💔 Removing from wishlist:', wishlistItemId);

    await db.collection('wishlists').doc(wishlistItemId).delete();

    console.log('✅ Removed from wishlist');
    res.json({ 
      success: true, 
      message: 'Item removed from wishlist' 
    });

  } catch (error) {
    console.error('❌ Error removing from wishlist:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove from wishlist' 
    });
  }
});

// Remove item from wishlist by productId and userId
app.delete('/api/wishlist/product/:productId/user/:userId', async (req, res) => {
  try {
    const { productId, userId } = req.params;
    console.log('💔 Removing from wishlist by product:', { productId, userId });

    const wishlistQuery = await db.collection('wishlists')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .get();

    if (wishlistQuery.empty) {
      return res.status(404).json({ 
        success: false, 
        error: 'Item not found in wishlist' 
      });
    }

    const batch = db.batch();
    wishlistQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();

    console.log('✅ Removed from wishlist by product');
    res.json({ 
      success: true, 
      message: 'Item removed from wishlist' 
    });

  } catch (error) {
    console.error('❌ Error removing from wishlist by product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove from wishlist' 
    });
  }
});

// Clear user's entire wishlist
app.delete('/api/wishlist/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🗑️ Clearing wishlist for user:', userId);

    const wishlistQuery = await db.collection('wishlists')
      .where('userId', '==', userId)
      .get();

    const batch = db.batch();
    wishlistQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();

    console.log('✅ Wishlist cleared for user:', userId);
    res.json({ 
      success: true, 
      message: 'Wishlist cleared successfully' 
    });

  } catch (error) {
    console.error('❌ Error clearing wishlist:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear wishlist' 
    });
  }
});

// Check if product is in user's wishlist
app.get('/api/wishlist/check/:userId/:productId', async (req, res) => {
  try {
    const { userId, productId } = req.params;

    const wishlistSnapshot = await db.collection('wishlists')
      .where('userId', '==', userId)
      .where('productId', '==', productId)
      .get();

    const isInWishlist = !wishlistSnapshot.empty;

    res.json({ 
      success: true, 
      isInWishlist,
      wishlistId: isInWishlist ? wishlistSnapshot.docs[0].id : null
    });

  } catch (error) {
    console.error('❌ Error checking wishlist:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check wishlist' 
    });
  }
});

// =====================================
// MEMBERSHIP LEVEL & POINTS API
// =====================================

// =====================================
// RECENTLY VIEWED PRODUCTS API ENDPOINTS
// =====================================

// Track recently viewed product
app.post('/api/user/recent-products', verifyToken, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user?.uid; // Assuming verifyToken middleware sets req.user
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }
    
    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Product ID is required' 
      });
    }

    console.log('👁️ Tracking recently viewed product:', { userId, productId });

    // Get current user document
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const userData = userDoc.data();
    let recentProductIds = [];
    
    // Parse existing recent_product_ids (comma-separated string)
    if (userData.recent_product_ids) {
      recentProductIds = userData.recent_product_ids.split(',').filter(id => id.trim());
    }
    
    // Remove productId if it already exists (to avoid duplicates)
    recentProductIds = recentProductIds.filter(id => id !== productId);
    
    // Add new productId at the beginning (most recent first)
    recentProductIds.unshift(productId);
    
    // Keep only last 10 products
    if (recentProductIds.length > 10) {
      recentProductIds = recentProductIds.slice(0, 10);
    }
    
    // Save back as comma-separated string
    await db.collection('users').doc(userId).update({
      recent_product_ids: recentProductIds.join(','),
      lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Updated recently viewed products:', recentProductIds);
    res.json({ 
      success: true, 
      message: 'Product view tracked successfully',
      recentProductIds: recentProductIds
    });

  } catch (error) {
    console.error('❌ Error tracking recently viewed product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to track product view' 
    });
  }
});

// Get recently viewed products with full product details
app.get('/api/user/recent-products', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.uid; // Assuming verifyToken middleware sets req.user
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    console.log('📋 Getting recently viewed products for user:', userId);

    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const userData = userDoc.data();
    let recentProductIds = [];
    
    // Parse recent_product_ids
    if (userData.recent_product_ids) {
      recentProductIds = userData.recent_product_ids.split(',').filter(id => id.trim());
    }
    
    if (recentProductIds.length === 0) {
      return res.json({ 
        success: true, 
        products: [] 
      });
    }

    // Fetch product details for each ID
    const products = [];
    for (const productId of recentProductIds) {
      try {
        const productDoc = await db.collection('products').doc(productId).get();
        
        if (productDoc.exists) {
          const productData = productDoc.data();
          
          // Format product data to ensure consistent structure
          const formattedProduct = {
            id: productDoc.id,
            name: productData.name || 'Unknown Product',
            price: productData.price || productData.priceFormatted || 'Liên hệ',
            priceFormatted: productData.priceFormatted || productData.price || 'Liên hệ',
            // Handle images array - use first image if available
            image: productData.images && Array.isArray(productData.images) && productData.images.length > 0 
              ? productData.images[0] 
              : productData.image || productData.imageUrl || '/images/default-product.png',
            imageUrl: productData.images && Array.isArray(productData.images) && productData.images.length > 0 
              ? productData.images[0] 
              : productData.image || productData.imageUrl || '/images/default-product.png',
            // Include original data for any other fields needed
            ...productData
          };
          
          products.push(formattedProduct);
        } else {
          console.warn(`⚠️ Product not found: ${productId}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching product ${productId}:`, error);
      }
    }

    console.log(`✅ Retrieved ${products.length} recently viewed products for user ${userId}`);
    res.json({ 
      success: true, 
      products: products 
    });

  } catch (error) {
    console.error('❌ Error getting recently viewed products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get recently viewed products' 
    });
  }
});

// ===================================
// Get Recent Orders (Bills) for User
// ===================================
app.get('/api/user/recent-orders', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    console.log(`📋 Getting recent orders for user: ${userId}`);

    // Fetch recent orders from bills collection
    const billsSnapshot = await db.collection('bills')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (billsSnapshot.empty) {
      console.log(`ℹ️ No orders found for user ${userId}`);
      return res.json({ 
        success: true, 
        orders: [] 
      });
    }

    // Format orders data
    const orders = [];
    billsSnapshot.forEach(doc => {
      const billData = doc.data();
      
      // Calculate total quantity from products array
      const products = billData.products || billData.items || [];
      const itemCount = products.reduce((sum, product) => {
        return sum + (product.quantity || 0);
      }, 0);
      
      // Convert Firestore timestamp to ISO string for JSON serialization
      let createdAtString = null;
      if (billData.createdAt) {
        try {
          // Firestore timestamp has toDate() method
          const date = billData.createdAt.toDate ? billData.createdAt.toDate() : new Date(billData.createdAt);
          createdAtString = date.toISOString();
        } catch (error) {
          console.error('Error converting timestamp:', error);
          createdAtString = new Date().toISOString();
        }
      }
      
      // Format order data
      const formattedOrder = {
        id: doc.id,
        orderId: billData.orderId || doc.id,
        total: billData.total || billData.totalAmount || 0,
        status: billData.status || 'pending',
        createdAt: createdAtString,
        items: products,
        itemCount: itemCount,
        paymentMethod: billData.paymentMethod || 'Chưa xác định',
        shippingAddress: billData.shippingAddress || null
      };
      
      orders.push(formattedOrder);
    });

    console.log(`✅ Retrieved ${orders.length} recent orders for user ${userId}`);
    res.json({ 
      success: true, 
      orders: orders 
    });

  } catch (error) {
    console.error('❌ Error getting recent orders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get recent orders' 
    });
  }
});

// Helper function to calculate membership level based on points
function calculateMembershipLevel(points) {
  if (points >= 2000000) return { level: 'diamond', name: 'Kim Cương', icon: '💎', color: '#b9f2ff' };
  if (points >= 1000000) return { level: 'gold', name: 'Vàng', icon: '🥇', color: '#ffd700' };
  if (points >= 500000) return { level: 'silver', name: 'Bạc', icon: '🥈', color: '#c0c0c0' };
  return { level: 'standard', name: 'Tiêu Chuẩn', icon: '⭐', color: '#6c757d' };
}

// Helper function to get next tier info
function getNextTierInfo(points) {
  if (points >= 2000000) return { nextTier: null, nextTierName: null, pointsNeeded: 0 };
  if (points >= 1000000) return { nextTier: 'diamond', nextTierName: 'Kim Cương', pointsNeeded: 2000000 - points };
  if (points >= 500000) return { nextTier: 'gold', nextTierName: 'Vàng', pointsNeeded: 1000000 - points };
  return { nextTier: 'silver', nextTierName: 'Bạc', pointsNeeded: 500000 - points };
}

// GET /api/users/:userId/membership - Get user membership info
app.get('/api/users/:userId/membership', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('📊 Calculating membership for user:', userId);

    // Query all completed bills for this user
    const billsSnapshot = await db.collection('bills')
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .get();

    // Calculate total spending and points
    let totalSpending = 0;
    billsSnapshot.docs.forEach(doc => {
      const bill = doc.data();
      if (bill.totalAmount) {
        totalSpending += bill.totalAmount;
      }
    });

    // Calculate points (10% of total spending)
    const points = Math.floor(totalSpending * 0.10);

    // Determine membership level
    const membership = calculateMembershipLevel(points);
    const nextTier = getNextTierInfo(points);

    // Update user document with latest points and membership level
    await db.collection('users').doc(userId).update({
      points: points,
      membershipLevel: membership.level,
      lastMembershipUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Membership calculated: ${membership.name} (${points} points)`);

    res.json({
      success: true,
      membership: {
        level: membership.level,
        name: membership.name,
        icon: membership.icon,
        color: membership.color,
        points: points,
        totalSpending: totalSpending,
        completedOrders: billsSnapshot.size,
        nextTier: nextTier.nextTier,
        nextTierName: nextTier.nextTierName,
        pointsToNextTier: nextTier.pointsNeeded
      }
    });

  } catch (error) {
    console.error('❌ Error calculating membership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate membership'
    });
  }
});

// POST /api/users/:userId/update-membership - Force recalculate membership
app.post('/api/users/:userId/update-membership', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🔄 Force updating membership for user:', userId);

    // Query all completed bills for this user
    const billsSnapshot = await db.collection('bills')
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .get();

    // Calculate total spending and points
    let totalSpending = 0;
    billsSnapshot.docs.forEach(doc => {
      const bill = doc.data();
      if (bill.totalAmount) {
        totalSpending += bill.totalAmount;
      }
    });

    // Calculate points (10% of total spending)
    const points = Math.floor(totalSpending * 0.10);

    // Determine membership level
    const membership = calculateMembershipLevel(points);
    const nextTier = getNextTierInfo(points);

    // Update user document with latest points and membership level
    await db.collection('users').doc(userId).update({
      points: points,
      membershipLevel: membership.level,
      lastMembershipUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Membership force updated: ${membership.name} (${points} points)`);

    res.json({
      success: true,
      message: 'Membership updated successfully',
      membership: {
        level: membership.level,
        name: membership.name,
        icon: membership.icon,
        color: membership.color,
        points: points,
        totalSpending: totalSpending,
        completedOrders: billsSnapshot.size,
        nextTier: nextTier.nextTier,
        nextTierName: nextTier.nextTierName,
        pointsToNextTier: nextTier.pointsNeeded
      }
    });

  } catch (error) {
    console.error('❌ Error updating membership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update membership'
    });
  }
});

// =====================================
// GUEST CHECKOUT OTP VERIFICATION API
// =====================================

// Store OTP codes temporarily (in production, use Redis or database)
const otpStore = new Map();

// Configure SMTP transporter for sending emails
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: 'hiroyamasaki0939@gmail.com',
    pass: 'chps gdzm xcyc iprl'
  }
});

// VNPay Configuration - official sandbox credentials from VNPAY email
const vnpay = {
  tmnCode: 'MLH4G0K1', // Terminal ID from VNPAY email
  secretKey: 'O03QT6ZJOCYHLIQ31TJULNMB67RKNN7D', // Secret key from VNPAY email
  vnpUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', // Official sandbox URL from VNPAY email
  returnUrl: isLocal 
    ? 'http://localhost:3000/vnpay-return' 
    : 'https://tech-haven-5368b.web.app/vnpay-return', // Environment-specific return URL
  ipnUrl: isLocal 
    ? 'http://localhost:3000/api/vnpay/ipn' 
    : 'https://tech-haven-5368b.web.app/api/vnpay/ipn' // Environment-specific IPN URL
};

const crypto = require('crypto');
const querystring = require('qs');
const moment = require('moment-timezone');

// Helper function to sort object
function sortObject(obj) {
  const sorted = {};
  const str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
}

// Generate random OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate random password
function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Send OTP email for guest checkout
app.post('/api/guest-checkout/send-otp', async (req, res) => {
  try {
    const { email, customerName } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email không hợp lệ'
      });
    }

    // Normalize email to lowercase to handle case sensitivity
    const normalizedEmail = email.toLowerCase().trim();

    // Generate OTP
    const otp = generateOTP();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP temporarily (use normalized email)
    otpStore.set(normalizedEmail, {
      otp,
      expiry,
      customerName: customerName || 'Khách hàng',
      verified: false
    });

    // Prepare email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ec4899; margin: 0; font-size: 28px;">
              <i class="fas fa-shield-alt"></i> Tech Haven
            </h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Xác thực đơn hàng</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: white; margin: 0 0 10px 0; text-align: center;">Mã xác thực OTP</h2>
            <div style="background-color: white; padding: 15px; border-radius: 6px; text-align: center;">
              <span style="font-size: 32px; font-weight: bold; color: #ec4899; letter-spacing: 3px;">${otp}</span>
            </div>
          </div>
          
          <div style="margin-bottom: 25px;">
            <p style="color: #374151; margin: 0 0 15px 0;">Xin chào <strong>${customerName || 'Khách hàng'}</strong>,</p>
            <p style="color: #374151; margin: 0 0 15px 0;">Bạn đã yêu cầu xác thực email để hoàn tất đơn hàng tại Tech Haven.</p>
            <p style="color: #374151; margin: 0 0 15px 0;">Vui lòng sử dụng mã OTP trên để xác thực đơn hàng của bạn.</p>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px;">
            <p style="color: #92400e; margin: 0; font-weight: 500;">
              <strong>Lưu ý:</strong> Mã OTP này sẽ hết hạn sau 10 phút.
            </p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
            </p>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 14px;">
              © 2024 Tech Haven. Cảm ơn bạn đã tin tượng chúng tôi!
            </p>
          </div>
        </div>
      </div>
    `;

    // Send email using SMTP
    const mailOptions = {
      from: 'Tech Haven <hiroyamasaki0939@gmail.com>',
      to: normalizedEmail,
      subject: '🔐 Mã xác thực OTP cho đơn hàng Tech Haven',
      html: emailContent
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`📧 OTP sent successfully to ${normalizedEmail}: ${otp}`);
    
    res.json({
      success: true,
      message: 'Mã OTP đã được gửi đến email của bạn'
    });

  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể gửi mã OTP. Vui lòng thử lại sau.'
    });
  }
});

// Verify OTP and create user if needed
app.post('/api/guest-checkout/verify-otp', async (req, res) => {
  try {
    const { email, otp, customerName, customerPhone } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email và mã OTP là bắt buộc'
      });
    }

    // Normalize email to lowercase to handle case sensitivity
    const normalizedEmail = email.toLowerCase().trim();

    // Check OTP (use normalized email)
    const storedOTP = otpStore.get(normalizedEmail);
    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        error: 'Mã OTP không tồn tại hoặc đã hết hạn'
      });
    }

    if (Date.now() > storedOTP.expiry) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        error: 'Mã OTP đã hết hạn'
      });
    }

    if (storedOTP.otp !== otp) {
      return res.status(400).json({
        success: false,
        error: 'Mã OTP không chính xác'
      });
    }

    // Mark as verified
    storedOTP.verified = true;
    otpStore.set(normalizedEmail, storedOTP);

    // Check if user already exists
    let existingUser = null;
    try {
      existingUser = await auth.getUserByEmail(normalizedEmail);
      console.log('👤 User already exists:', existingUser.uid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    let userId;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.uid;
    } else {
      // Create new user with random password
      const randomPassword = generateRandomPassword();
      
      try {
        const userRecord = await auth.createUser({
          email: normalizedEmail,
          password: randomPassword,
          displayName: customerName || 'Guest User',
          emailVerified: true // Auto-verify since they confirmed via OTP
        });

        userId = userRecord.uid;
        isNewUser = true;

        // Create user profile in Firestore
        await db.collection('users').doc(userId).set({
          uid: userId,
          firebaseUid: userId, // Add this for login compatibility
          email: normalizedEmail,
          name: customerName || 'Guest User',
          phone: customerPhone || '',
          provider: 'manual',
          emailVerified: true,
          temporaryPassword: true, // Flag to require password change
          addresses: [],
          wishlist: [],
          hasSeenWelcomeModal: false, // Track if user has seen welcome address modal
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ New user created:', userId);
      } catch (createError) {
        console.error('❌ Error creating user:', createError);
        return res.status(500).json({
          success: false,
          error: 'Không thể tạo tài khoản người dùng'
        });
      }
    }

    // Generate Firebase custom token for immediate login
    const customToken = await auth.createCustomToken(userId);

    res.json({
      success: true,
      message: 'Xác thực thành công',
      userId,
      email,
      customToken,
      isNewUser,
      customerName: customerName || storedOTP.customerName
    });

  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xác thực mã OTP'
    });
  }
});

// Check if OTP is verified for an email (used during checkout)
app.get('/api/guest-checkout/otp-status/:email', (req, res) => {
  const { email } = req.params;
  
  // Normalize email to lowercase to handle case sensitivity
  const normalizedEmail = email.toLowerCase().trim();
  
  const storedOTP = otpStore.get(normalizedEmail);
  
  if (!storedOTP) {
    return res.json({
      success: false,
      verified: false,
      message: 'Chưa có mã OTP'
    });
  }

  if (Date.now() > storedOTP.expiry) {
    otpStore.delete(normalizedEmail);
    return res.json({
      success: false,
      verified: false,
      message: 'Mã OTP đã hết hạn'
    });
  }

  res.json({
    success: true,
    verified: storedOTP.verified,
    customerName: storedOTP.customerName
  });
});

// =====================================
// VNPAY PAYMENT API
// =====================================

// Create VNPay payment URL
app.post('/api/vnpay/create-payment', async (req, res) => {
  try {
    const { amount, orderInfo, orderType, userId, cartData, isGuest, customerInfo } = req.body;

    // Get client IP
    const ipAddr = req.headers['x-forwarded-for'] ||
                   req.connection.remoteAddress ||
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                   '127.0.0.1';

    const date = moment().tz('Asia/Ho_Chi_Minh');
    const createDate = date.format('YYYYMMDDHHmmss');
    const orderId = date.format('HHmmss') + Math.floor(Math.random() * 1000);
    
    // Store order info temporarily for verification
    const tempOrderData = {
      userId,
      isGuest,
      customerInfo,
      cartData,
      amount,
      orderInfo,
      createDate,
      orderId
    };
    
    // Store in Firestore for later verification
    await db.collection('temp_orders').doc(orderId).set(tempOrderData);

    const locale = 'vn';
    const currCode = 'VND';
    
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = vnpay.tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = orderInfo;
    vnp_Params['vnp_OrderType'] = orderType || 'other';
    vnp_Params['vnp_Amount'] = amount * 100; // VNPay requires amount * 100
    vnp_Params['vnp_ReturnUrl'] = vnpay.returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    vnp_Params['vnp_ExpireDate'] = moment(date).add(15, 'minutes').format('YYYYMMDDHHmmss');

    vnp_Params = sortObject(vnp_Params);

    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', vnpay.secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;
    
    const vnpUrl = vnpay.vnpUrl + '?' + querystring.stringify(vnp_Params, { encode: false });

    console.log('✅ VNPay payment URL created:', { orderId, amount, userId });
    
    res.json({
      success: true,
      paymentUrl: vnpUrl,
      orderId: orderId
    });
    
  } catch (error) {
    console.error('❌ Error creating VNPay payment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi tạo URL thanh toán'
    });
  }
});

// VNPay IPN (Instant Payment Notification) - support both GET and POST
app.all('/api/vnpay/ipn', async (req, res) => {
  console.log('📨 VNPay IPN called with method:', req.method);
  console.log('📋 IPN params:', req.method === 'GET' ? req.query : req.body);
  try {
    let vnp_Params = req.method === 'GET' ? req.query : req.body;
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', vnpay.secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
      const orderId = vnp_Params['vnp_TxnRef'];
      const rspCode = vnp_Params['vnp_ResponseCode'];
      const transactionStatus = vnp_Params['vnp_TransactionStatus'];

      console.log('📨 VNPay IPN received:', { orderId, rspCode, transactionStatus });

      if (rspCode === '00' && transactionStatus === '00') {
        // Payment successful - process order
        try {
          const tempOrderDoc = await db.collection('temp_orders').doc(orderId).get();
          if (tempOrderDoc.exists) {
            const orderData = tempOrderDoc.data();
            
            // Process the successful payment
            await processSuccessfulPayment(orderData, vnp_Params);
            
            // Clean up temp order
            await db.collection('temp_orders').doc(orderId).delete();
            
            res.status(200).json({ RspCode: '00', Message: 'success' });
          } else {
            res.status(200).json({ RspCode: '01', Message: 'Order not found' });
          }
        } catch (error) {
          console.error('❌ Error processing payment:', error);
          res.status(200).json({ RspCode: '99', Message: 'Processing error' });
        }
      } else {
        // Payment failed
        console.log('💳 Payment failed:', { orderId, rspCode, transactionStatus });
        res.status(200).json({ RspCode: '00', Message: 'Payment failed recorded' });
      }
    } else {
      res.status(200).json({ RspCode: '97', Message: 'Fail checksum' });
    }
  } catch (error) {
    console.error('❌ VNPay IPN error:', error);
    res.status(200).json({ RspCode: '99', Message: 'System error' });
  }
});

// VNPay Return URL (for user redirect)
app.get('/vnpay-return', async (req, res) => {
  console.log('🌐 VNPay return URL accessed');
  console.log('📋 Query params:', req.query);
  try {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', vnpay.secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const orderId = vnp_Params['vnp_TxnRef'];
    const rspCode = vnp_Params['vnp_ResponseCode'];
    const transactionStatus = vnp_Params['vnp_TransactionStatus'];
    const amount = vnp_Params['vnp_Amount'] / 100; // Convert back from VNPay format

    if (secureHash === signed) {
      if (rspCode === '00' && transactionStatus === '00') {
        // Payment successful - process payment and clear cart
        console.log('✅ VNPay payment successful for order:', orderId);
        
        // Retrieve temp order data
        const tempOrderDoc = await db.collection('temp_orders').doc(orderId).get();
        if (tempOrderDoc.exists) {
          const orderData = tempOrderDoc.data();
          console.log('📦 Retrieved order data:', orderData);
          
          // Process successful payment (clear cart, create bill)
          try {
            await processSuccessfulPayment(orderData, vnp_Params);
            console.log('✅ Payment processing completed successfully');
            
            // Clean up temp order
            await db.collection('temp_orders').doc(orderId).delete();
            console.log('🧹 Temp order data cleaned up');
          } catch (processError) {
            console.error('❌ Error processing payment:', processError);
            // Still redirect to success page but log the error
          }
        } else {
          console.error('⚠️ Temp order not found for orderId:', orderId);
        }
        
        // Redirect to shop page with success
        res.redirect(`/shop?payment=success&orderId=${orderId}&amount=${amount}`);
      } else {
        // Payment failed - redirect to shop page
        res.redirect(`/shop?payment=failed&orderId=${orderId}&error=${rspCode}`);
      }
    } else {
      // Invalid checksum
      res.redirect('/shop?payment=error&message=Invalid_signature');
    }
  } catch (error) {
    console.error('❌ VNPay return error:', error);
    res.redirect('/shop?payment=error&message=System_error');
  }
});

// Helper function to process successful payment
async function processSuccessfulPayment(orderData, vnpayResponse) {
  try {
    const { userId, cartData, amount, orderInfo, customerInfo } = orderData;
    
    console.log('💰 Processing successful payment for user:', userId);
    console.log('📦 Cart items:', cartData.length);
    console.log('📍 Guest temp address:', orderData.guestTempAddress ? 'Yes' : 'No');
    
    // Update product stock FIRST (before creating bill)
    const stockUpdatePromises = [];
    const stockErrors = [];
    
    for (const item of cartData) {
      if (item.productId || item.id) {
        const productId = item.productId || item.id;
        const quantity = item.quantity || 1;
        
        try {
          const productRef = db.collection('products').doc(productId);
          const productDoc = await productRef.get();
          
          if (productDoc.exists) {
            const productData = productDoc.data();
            const currentStock = productData.stock || 0;
            
            // Check if enough stock
            if (currentStock < quantity) {
              stockErrors.push(`Not enough stock for product ${productId}. Available: ${currentStock}, Required: ${quantity}`);
              continue;
            }
            
            const newStock = currentStock - quantity;
            
            stockUpdatePromises.push(
              productRef.update({
                stock: newStock,
                updatedAt: admin.firestore.Timestamp.now()
              })
            );
            
            console.log(`📦 Updating stock for product ${productId}: ${currentStock} - ${quantity} = ${newStock}`);
          } else {
            console.warn(`⚠️ Product ${productId} not found, skipping stock update`);
          }
        } catch (error) {
          console.error(`❌ Error updating stock for product ${productId}:`, error);
          stockErrors.push(`Error updating product ${productId}: ${error.message}`);
        }
      }
    }
    
    // If there are critical stock errors, throw error
    if (stockErrors.length > 0) {
      console.error('❌ Stock errors:', stockErrors);
      // Don't throw error, just log warning - payment already succeeded
      console.warn('⚠️ Payment succeeded but some stock updates failed:', stockErrors);
    }
    
    // Wait for all stock updates to complete
    if (stockUpdatePromises.length > 0) {
      await Promise.all(stockUpdatePromises);
      console.log(`✅ Updated stock for ${stockUpdatePromises.length} products`);
    }
    
    // Create bill record with NEW format (matching POST /api/bills)
    const billData = {
      userId: userId,
      products: cartData.map(item => ({
        id: item.productId || item.id,
        name: item.name || item.productName,
        price: item.price,
        quantity: item.quantity || 1,
        subtotal: (item.price || 0) * (item.quantity || 1)
      })),
      totalAmount: amount,
      discount: orderData.discount || 0,
      shippingFee: orderData.shippingFee || 0,
      couponUserId: orderData.couponUserId || null,
      customerInfo: customerInfo || null,
      name: customerInfo?.name || null,
      email: customerInfo?.email || null,
      phone: customerInfo?.phone || null,
      address: customerInfo?.address || null,
      paymentMethod: 'vnpay',
      paymentStatus: 'completed',
      vnpayTransactionId: vnpayResponse['vnp_TransactionNo'],
      vnpayTxnRef: vnpayResponse['vnp_TxnRef'],
      orderInfo: orderInfo,
      status: 'pending', // Start with 'pending' - will auto-update via scheduler
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const billRef = await db.collection('bills').add(billData);
    console.log('✅ Bill created with ID:', billRef.id);
    
    // Save guest temp address to user profile if exists
    // This works for both guest checkout (with OTP) and logged-in users
    if (orderData.guestTempAddress) {
      console.log('📍 Guest temp address found in order data');
      console.log('🏠 Temp address:', JSON.stringify(orderData.guestTempAddress));
      console.log('👤 User ID:', userId);
      console.log('📧 Customer email:', customerInfo?.email);
      
      try {
        let userDoc = null;
        
        // Try to find user by userId first (most reliable)
        if (userId && userId !== 'guest' && !userId.startsWith('guest_')) {
          console.log('🔍 Looking up user by userId:', userId);
          try {
            const userDocRef = await db.collection('users').doc(userId).get();
            if (userDocRef.exists) {
              userDoc = userDocRef;
              console.log('✅ Found user by userId:', userId);
            } else {
              console.warn('⚠️ User document not found for userId:', userId);
            }
          } catch (error) {
            console.error('❌ Error looking up user by userId:', error);
          }
        }
        
        // If not found by userId, try by email
        if (!userDoc && customerInfo?.email) {
          const normalizedEmail = customerInfo.email.toLowerCase().trim();
          console.log('🔍 Looking up user by email:', normalizedEmail);
          
          const usersSnapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
          
          if (!usersSnapshot.empty) {
            userDoc = usersSnapshot.docs[0];
            console.log('✅ Found user by email:', normalizedEmail, '- Doc ID:', userDoc.id);
          } else {
            console.warn('⚠️ User not found with email:', normalizedEmail);
          }
        }
        
        // Save address if user found
        if (userDoc) {
          const userData = userDoc.data();
          console.log('👤 User data loaded - Current addresses:', userData.addresses?.length || 0);
          
          const existingAddresses = userData.addresses || [];
          
          // Check if address already exists (avoid duplicates)
          const addressExists = existingAddresses.some(addr => 
            addr.address === orderData.guestTempAddress.address &&
            addr.city === orderData.guestTempAddress.city &&
            addr.district === orderData.guestTempAddress.district
          );
          
          if (addressExists) {
            console.log('⚠️ Address already exists in user profile, skipping...');
          } else {
            // Add new address to user profile
            const newAddress = {
              address: orderData.guestTempAddress.address,
              city: orderData.guestTempAddress.city,
              district: orderData.guestTempAddress.district,
              coordinates: orderData.guestTempAddress.coordinates || null,
              isDefault: existingAddresses.length === 0, // Only set as default if it's the first address
              createdAt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now()
            };
            
            console.log('➕ Adding new address to user profile:', JSON.stringify(newAddress));
            existingAddresses.push(newAddress);
            
            await userDoc.ref.update({
              addresses: existingAddresses,
              updatedAt: admin.firestore.Timestamp.now()
            });
            
            console.log('✅ Guest temp address saved to user profile!');
            console.log('📊 User', userDoc.id, 'now has', existingAddresses.length, 'addresses');
          }
        } else {
          console.error('❌ Could not find user to save address');
          console.log('📋 Available data - userId:', userId, 'email:', customerInfo?.email);
        }
      } catch (error) {
        console.error('❌ Error saving guest temp address:', error);
        console.error('❌ Error stack:', error.stack);
        // Don't throw - payment already succeeded
      }
    } else {
      console.log('ℹ️ No guest temp address in orderData');
    }
    
    // Send order confirmation email to customer
    const customerEmail = customerInfo?.email || billData.email;
    const customerName = customerInfo?.name || billData.name;
    if (customerEmail) {
      console.log('📧 Sending order confirmation email to:', customerEmail);
      sendOrderConfirmationEmail(billRef.id, billData, customerEmail, customerName)
        .then(() => console.log('✅ Order confirmation email sent'))
        .catch(err => console.error('❌ Failed to send order confirmation email:', err));
    } else {
      console.warn('⚠️ No customer email found, skipping order confirmation email');
    }
    
    // Clear user's cart
    const cartQuery = await db.collection('carts').where('userId', '==', userId).get();
    if (cartQuery.empty) {
      // Try 'cart' collection (legacy)
      const legacyCartQuery = await db.collection('cart').where('userId', '==', userId).get();
      if (!legacyCartQuery.empty) {
        const batch = db.batch();
        legacyCartQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('🛒 Legacy cart cleared for user:', userId);
      }
    } else {
      const batch = db.batch();
      cartQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log('🛒 Cart cleared for user:', userId);
    }
    
    console.log('✅ Payment processing completed successfully');
    return billRef.id;
    
  } catch (error) {
    console.error('❌ Error processing successful payment:', error);
    throw error;
  }
}

// Helper function to send order confirmation email
async function sendOrderConfirmationEmail(billId, billData, customerEmail, customerName) {
  try {
    console.log('📧 Preparing order confirmation email for:', customerEmail);
    
    // Calculate totals
    const subtotal = billData.products.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const discount = billData.discount || 0;
    const shippingFee = billData.shippingFee || 0;
    const totalAmount = billData.totalAmount || subtotal - discount + shippingFee;
    
    // Format date with Vietnam timezone (UTC+7)
    const orderDate = billData.createdAt?.toDate ? 
      billData.createdAt.toDate().toLocaleString('vi-VN', { 
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) : 
      new Date().toLocaleString('vi-VN', { 
        timeZone: 'Asia/Ho_Chi_Minh'
      });
    
    // Generate product list HTML
    const productListHTML = billData.products.map(item => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 15px 10px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 5px;">${item.name}</div>
          <div style="color: #6b7280; font-size: 14px;">Số lượng: ${item.quantity}</div>
        </td>
        <td style="padding: 15px 10px; text-align: right; color: #374151; font-weight: 500;">
          ${new Intl.NumberFormat('vi-VN').format(item.subtotal)} VNĐ
        </td>
      </tr>
    `).join('');
    
    // Prepare email content with beautiful, cute and vibrant design
    const emailContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #ffdee9 0%, #b5fffc 50%, #e0c3fc 100%);">
        <div style="background-color: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15); border: 3px solid rgba(255, 255, 255, 0.8);">
          
          <!-- Animated Header with Floating Icons -->
          <div style="background: linear-gradient(135deg, #ff6b9d 0%, #c06fef 50%, #6eb6ff 100%); padding: 50px 30px; text-align: center; position: relative; overflow: hidden;">
            <!-- Decorative circles -->
            <div style="position: absolute; top: -20px; left: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.15); border-radius: 50%;"></div>
            <div style="position: absolute; bottom: -30px; right: -30px; width: 150px; height: 150px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
            
            <div style="position: relative; z-index: 1;">
              <!-- Success Icon with bounce effect -->
              <div style="display: inline-block; background: linear-gradient(135deg, #fff 0%, #f0f9ff 100%); width: 100px; height: 100px; border-radius: 50%; margin-bottom: 25px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 4px solid rgba(255,255,255,0.5);">
                <span style="font-size: 55px;">🎉</span>
              </div>
              
              <h1 style="color: white; margin: 0; font-size: 38px; font-weight: 800; text-shadow: 0 4px 12px rgba(0,0,0,0.2); letter-spacing: 1px;">
                🎊 YAY! Đặt Hàng Thành Công! 🎊
              </h1>
              <p style="color: rgba(255,255,255,0.95); margin: 18px 0 0 0; font-size: 18px; font-weight: 500;">
                ✨ Cảm ơn bạn đã chọn Tech Haven ✨
              </p>
              
              <!-- Cute divider -->
              <div style="margin-top: 20px;">
                <span style="font-size: 24px; margin: 0 5px;">💖</span>
                <span style="font-size: 24px; margin: 0 5px;">🌟</span>
                <span style="font-size: 24px; margin: 0 5px;">💖</span>
              </div>
            </div>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 35px;">
            
            <!-- Greeting Message -->
            <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #fff5f7 0%, #fff 100%); border-radius: 16px; border: 2px dashed #ff6b9d;">
              <p style="margin: 0; font-size: 20px; color: #ff6b9d; font-weight: 700;">
                🎁 Chào ${customerName || 'bạn'} thân yêu! 🎁
              </p>
              <p style="margin: 10px 0 0 0; font-size: 15px; color: #666;">
                Đơn hàng của bạn đã được xác nhận và đang chờ xử lý! 🚀
              </p>
            </div>
            
            <!-- Customer Info with cute icons -->
            <div style="background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%); border-radius: 16px; padding: 25px; margin-bottom: 25px; border: 3px solid #ffd700; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);">
              <h2 style="color: #d97706; margin: 0 0 20px 0; font-size: 20px; font-weight: 800; display: flex; align-items: center;">
                <span style="background: white; width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">👤</span>
                Thông Tin Khách Hàng
              </h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #92400e; font-weight: 700; width: 140px; font-size: 15px;">
                    <span style="margin-right: 8px;">🙋‍♀️</span>Họ tên:
                  </td>
                  <td style="padding: 10px 0; color: #b45309; font-size: 15px; font-weight: 600;">${customerName || 'Khách hàng'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #92400e; font-weight: 700; font-size: 15px;">
                    <span style="margin-right: 8px;">📧</span>Email:
                  </td>
                  <td style="padding: 10px 0; color: #b45309; font-size: 15px; font-weight: 600;">${customerEmail}</td>
                </tr>
                ${billData.phone ? `
                <tr>
                  <td style="padding: 10px 0; color: #92400e; font-weight: 700; font-size: 15px;">
                    <span style="margin-right: 8px;">📱</span>Điện thoại:
                  </td>
                  <td style="padding: 10px 0; color: #b45309; font-size: 15px; font-weight: 600;">${billData.phone}</td>
                </tr>
                ` : ''}
                ${billData.address ? `
                <tr>
                  <td style="padding: 10px 0; color: #92400e; font-weight: 700; vertical-align: top; font-size: 15px;">
                    <span style="margin-right: 8px;">🏠</span>Địa chỉ:
                  </td>
                  <td style="padding: 10px 0; color: #b45309; font-size: 15px; font-weight: 600; line-height: 1.6;">${billData.address}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- Order Info with gradient -->
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 16px; padding: 25px; margin-bottom: 25px; border: 3px solid #38bdf8; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.2);">
              <h2 style="color: #0369a1; margin: 0 0 20px 0; font-size: 20px; font-weight: 800; display: flex; align-items: center;">
                <span style="background: white; width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">📦</span>
                Chi Tiết Đơn Hàng
              </h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #075985; font-weight: 700; font-size: 15px;">
                    <span style="margin-right: 8px;">🔖</span>Mã đơn hàng:
                  </td>
                  <td style="padding: 10px 0; color: #0369a1; text-align: right; font-weight: 800; font-size: 16px; background: white; padding: 5px 15px; border-radius: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    #${billId.substring(0, 8).toUpperCase()}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #075985; font-weight: 700; font-size: 15px;">
                    <span style="margin-right: 8px;">📅</span>Ngày đặt:
                  </td>
                  <td style="padding: 10px 0; color: #0369a1; text-align: right; font-weight: 600; font-size: 15px;">${orderDate}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #075985; font-weight: 700; font-size: 15px;">
                    <span style="margin-right: 8px;">💳</span>Thanh toán:
                  </td>
                  <td style="padding: 10px 0; color: #0369a1; text-align: right; font-weight: 600; font-size: 15px;">${billData.paymentMethod === 'vnpay' ? '💳 VNPay' : billData.paymentMethod === 'cod' ? '💵 COD' : 'Khác'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #075985; font-weight: 700; font-size: 15px;">
                    <span style="margin-right: 8px;">✅</span>Trạng thái:
                  </td>
                  <td style="padding: 10px 0; text-align: right;">
                    <span style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); color: #065f46; padding: 6px 16px; border-radius: 25px; font-size: 14px; font-weight: 800; border: 2px solid #34d399; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">
                      ✓ Đã Thanh Toán
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Products List with cute design -->
            <div style="margin-bottom: 25px;">
              <h2 style="color: #db2777; margin: 0 0 20px 0; font-size: 20px; font-weight: 800; display: flex; align-items: center;">
                <span style="background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%); width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px; border: 3px solid #f9a8d4;">🛍️</span>
                Sản Phẩm Yêu Thích Của Bạn
              </h2>
              <div style="background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%); border-radius: 16px; overflow: hidden; border: 3px solid #f0abfc; box-shadow: 0 4px 15px rgba(240, 171, 252, 0.2);">
                <table style="width: 100%; border-collapse: collapse;">
                  ${productListHTML}
                </table>
              </div>
            </div>
            
            <!-- Order Summary with sparkles -->
            <div style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border-radius: 20px; padding: 25px; margin-bottom: 25px; border: 4px solid #c4b5fd; box-shadow: 0 8px 25px rgba(139, 92, 246, 0.3);">
              <h2 style="color: #6b21a8; margin: 0 0 20px 0; font-size: 22px; font-weight: 800; display: flex; align-items: center;">
                <span style="background: white; width: 45px; height: 45px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px; box-shadow: 0 3px 10px rgba(0,0,0,0.15);">💰</span>
                Tổng Thanh Toán
              </h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #6b21a8; font-weight: 700; font-size: 16px;">
                    <span style="margin-right: 8px;">📝</span>Tạm tính:
                  </td>
                  <td style="padding: 10px 0; color: #7c3aed; text-align: right; font-weight: 700; font-size: 16px;">${new Intl.NumberFormat('vi-VN').format(subtotal)} VNĐ</td>
                </tr>
                ${discount > 0 ? `
                <tr>
                  <td style="padding: 10px 0; color: #6b21a8; font-weight: 700; font-size: 16px;">
                    <span style="margin-right: 8px;">🎁</span>Giảm giá:
                  </td>
                  <td style="padding: 10px 0; color: #dc2626; text-align: right; font-weight: 700; font-size: 16px;">-${new Intl.NumberFormat('vi-VN').format(discount)} VNĐ</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 10px 0; color: #6b21a8; font-weight: 700; font-size: 16px;">
                    <span style="margin-right: 8px;">🚚</span>Vận chuyển:
                  </td>
                  <td style="padding: 10px 0; color: #7c3aed; text-align: right; font-weight: 700; font-size: 16px;">${shippingFee > 0 ? new Intl.NumberFormat('vi-VN').format(shippingFee) + ' VNĐ' : '🎉 Miễn phí'}</td>
                </tr>
                <tr style="border-top: 3px dashed #a78bfa;">
                  <td style="padding: 20px 0 5px 0; color: #581c87; font-weight: 800; font-size: 20px;">
                    <span style="margin-right: 8px;">💎</span>Tổng cộng:
                  </td>
                  <td style="padding: 20px 0 5px 0; text-align: right;">
                    <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 10px 20px; border-radius: 30px; display: inline-block; font-weight: 900; font-size: 24px; box-shadow: 0 5px 20px rgba(245, 158, 11, 0.4); border: 3px solid #fcd34d;">
                      ${new Intl.NumberFormat('vi-VN').format(totalAmount)} VNĐ
                    </div>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Status Timeline with cute steps -->
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 3px solid #86efac; border-radius: 16px; padding: 25px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(74, 222, 128, 0.2);">
              <h2 style="color: #15803d; margin: 0 0 20px 0; font-size: 18px; font-weight: 800; display: flex; align-items: center;">
                <span style="margin-right: 10px;">🚀</span>Hành Trình Đơn Hàng
              </h2>
              <div style="color: #166534; line-height: 2;">
                <div style="margin-bottom: 12px; padding-left: 10px; border-left: 4px solid #22c55e; background: white; padding: 12px; border-radius: 8px;">
                  <div style="display: flex; align-items: center;">
                    <span style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; min-width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 14px; font-weight: 800; box-shadow: 0 3px 10px rgba(34, 197, 94, 0.4);">✓</span>
                    <span style="font-weight: 700; font-size: 15px;">🎉 Đơn hàng đã xác nhận</span>
                  </div>
                </div>
                <div style="margin-bottom: 12px; padding-left: 10px; border-left: 4px solid #e5e7eb; background: #f9fafb; padding: 12px; border-radius: 8px; opacity: 0.7;">
                  <div style="display: flex; align-items: center;">
                    <span style="background: #d1d5db; color: white; min-width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 14px; font-weight: 700;">2</span>
                    <span style="font-weight: 600; font-size: 15px;">📦 Đang chuẩn bị hàng</span>
                  </div>
                </div>
                <div style="margin-bottom: 12px; padding-left: 10px; border-left: 4px solid #e5e7eb; background: #f9fafb; padding: 12px; border-radius: 8px; opacity: 0.7;">
                  <div style="display: flex; align-items: center;">
                    <span style="background: #d1d5db; color: white; min-width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 14px; font-weight: 700;">3</span>
                    <span style="font-weight: 600; font-size: 15px;">🚚 Đang giao hàng</span>
                  </div>
                </div>
                <div style="padding-left: 10px; border-left: 4px solid #e5e7eb; background: #f9fafb; padding: 12px; border-radius: 8px; opacity: 0.7;">
                  <div style="display: flex; align-items: center;">
                    <span style="background: #d1d5db; color: white; min-width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 14px; font-weight: 700;">4</span>
                    <span style="font-weight: 600; font-size: 15px;">🎊 Hoàn thành</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Cute Note -->
            <div style="background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border: 3px solid #fb923c; border-radius: 16px; padding: 20px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(251, 146, 60, 0.2);">
              <p style="color: #9a3412; margin: 0; font-weight: 600; font-size: 15px; line-height: 1.7;">
                <span style="font-size: 24px; margin-right: 8px;">💝</span>
                <strong style="font-size: 16px;">Lưu ý quan trọng:</strong><br>
                <span style="margin-left: 32px; display: block; margin-top: 8px;">
                  Đơn hàng của bạn đang được team Tech Haven xử lý cẩn thận! Chúng mình sẽ thông báo ngay khi đơn hàng bắt đầu vận chuyển nhé! 🚀✨
                </span>
              </p>
            </div>
            
            <!-- CTA Button with hover effect -->
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${isLocal ? 'http://localhost:3000' : 'https://tech-haven-5368b.web.app'}" 
                 style="display: inline-block; background: linear-gradient(135deg, #ff6b9d 0%, #c06fef 50%, #6eb6ff 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 18px; box-shadow: 0 8px 25px rgba(192, 111, 239, 0.4); border: 3px solid white; letter-spacing: 0.5px;">
                🎁 Khám Phá Thêm Sản Phẩm Ngay! 🎁
              </a>
              <p style="margin-top: 15px; color: #9ca3af; font-size: 13px; font-style: italic;">
                ✨ Nhiều ưu đãi đang chờ bạn! ✨
              </p>
            </div>
            
            <!-- Bonus gifts message -->
            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; margin-bottom: 25px; border: 2px dashed #fbbf24;">
              <p style="margin: 0; font-size: 16px; color: #92400e; font-weight: 700;">
                🌟 Mỗi đơn hàng đều được gói ghém cẩn thận với yêu thương! 🌟
              </p>
            </div>
            
          </div>
          
          <!-- Footer with cute design -->
          <div style="background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%); border-top: 3px solid #f9a8d4; padding: 35px; text-align: center;">
            <div style="margin-bottom: 25px;">
              <h3 style="color: #be185d; margin: 0 0 15px 0; font-size: 18px; font-weight: 800;">
                💌 Cần Hỗ Trợ? Chúng Mình Luôn Ở Đây! 💌
              </h3>
              <div style="background: white; display: inline-block; padding: 15px 30px; border-radius: 50px; box-shadow: 0 4px 15px rgba(190, 24, 93, 0.2); border: 2px solid #f9a8d4;">
                <p style="color: #be185d; margin: 0; font-size: 15px; font-weight: 700; line-height: 1.8;">
                  📧 hiroyamasaki0939@gmail.com<br>
                  📞 Hotline: 1900-xxxx<br>
                  ⏰ Hỗ trợ 24/7
                </p>
              </div>
            </div>
            
            <!-- Social links mockup -->
            <div style="margin-bottom: 25px;">
              <p style="color: #be185d; margin: 0 0 12px 0; font-weight: 700; font-size: 14px;">Kết nối với chúng mình</p>
              <div style="display: inline-flex; gap: 12px;">
                <span style="background: white; width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">📘</span>
                <span style="background: white; width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">📷</span>
                <span style="background: white; width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">🐦</span>
              </div>
            </div>
            
            <div style="border-top: 2px solid #f9a8d4; padding-top: 25px;">
              <p style="color: #be185d; margin: 0; font-size: 14px; font-weight: 700;">
                © 2024 Tech Haven - Nơi Công Nghệ Gặp Gỡ Yêu Thương 💖
              </p>
              <p style="color: #db2777; margin: 12px 0 0 0; font-size: 13px; font-weight: 600;">
                Cảm ơn bạn đã tin tưởng và ủng hộ! Bạn thật tuyệt vời! 🌈✨
              </p>
              <p style="color: #ec4899; margin: 10px 0 0 0; font-size: 12px; font-style: italic;">
                Email này được gửi tự động với tất cả tình yêu thương 💕
              </p>
            </div>
          </div>
          
        </div>
        
        <!-- Extra decorative elements outside card -->
        <div style="text-align: center; margin-top: 20px; padding: 15px;">
          <p style="color: white; font-size: 24px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            ⭐ 🎀 💝 🌸 💖 🌈 ✨
          </p>
        </div>
      </div>
    `;

    // Send email using SMTP
    const mailOptions = {
      from: 'Tech Haven <hiroyamasaki0939@gmail.com>',
      to: customerEmail,
      subject: `✅ Xác nhận đơn hàng #${billId.substring(0, 8).toUpperCase()} - Tech Haven`,
      html: emailContent
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`📧 Order confirmation email sent successfully to ${customerEmail}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error sending order confirmation email:', error);
    // Don't throw error - email failure shouldn't break the order process
    return false;
  }
}

// =====================================
// BILL MANAGEMENT API
// =====================================

// Process VNPay payment success (fallback endpoint for frontend)
app.post('/api/vnpay/process-success', async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    console.log('🔄 Processing VNPay success fallback for order:', orderId);
    
    // Check if bill already exists
    const existingBill = await db.collection('bills').where('vnpayTxnRef', '==', orderId).get();
    if (!existingBill.empty) {
      console.log('✅ Bill already exists for order:', orderId);
      return res.json({ success: true, message: 'Bill already processed' });
    }
    
    // Retrieve temp order data
    const tempOrderDoc = await db.collection('temp_orders').doc(orderId).get();
    if (tempOrderDoc.exists) {
      const orderData = tempOrderDoc.data();
      console.log('📦 Retrieved order data for fallback processing:', orderData);
      
      // Create VNPay response object for processing
      const vnpayResponse = {
        vnp_TransactionNo: `VNP_${orderId}_${Date.now()}`,
        vnp_TxnRef: orderId
      };
      
      // Process successful payment
      await processSuccessfulPayment(orderData, vnpayResponse);
      console.log('✅ Fallback payment processing completed');
      
      // Clean up temp order
      await db.collection('temp_orders').doc(orderId).delete();
      console.log('🧹 Temp order data cleaned up');
      
      res.json({ success: true, message: 'Payment processed successfully' });
    } else {
      console.error('⚠️ Temp order not found for orderId:', orderId);
      res.status(404).json({ success: false, message: 'Order not found' });
    }
  } catch (error) {
    console.error('❌ Error in VNPay fallback processing:', error);
    res.status(500).json({ success: false, message: 'Processing failed' });
  }
});

// Create new bill when order is completed
app.post('/api/bills', async (req, res) => {
  try {
    const { 
      userId, 
      products, 
      totalAmount, 
      couponUserId, 
      guestTempAddress, // Add guest temp address parameter
      customerInfo,
      name,
      email, 
      phone,
      address,
      coordinates // Add coordinates parameter
    } = req.body;
    
    console.log('📋 Creating new bill:', {
      userId,
      productsCount: products?.length || 0,
      totalAmount,
      couponUserId,
      guestTempAddress: guestTempAddress ? 'YES ✅' : 'NO ❌',
      customerInfo: customerInfo ? `${customerInfo.name} - ${customerInfo.email}` : 'No info',
      name,
      email,
      phone,
      address,
      coordinates: coordinates ? `(${coordinates.lat}, ${coordinates.lng})` : 'No coordinates'
    });
    
    // Validate required fields
    if (!userId || !products || !Array.isArray(products) || products.length === 0 || !totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, products (array), totalAmount'
      });
    }
    
    // Validate products format
    for (const product of products) {
      if (!product.id || !product.name || !product.price || !product.quantity) {
        return res.status(400).json({
          success: false,
          error: 'Each product must have: id, name, price, quantity'
        });
      }
    }
    
    // Update stock for each product (decrease quantity)
    const stockUpdatePromises = [];
    const stockErrors = [];
    
    for (const product of products) {
      try {
        const productRef = db.collection('products').doc(product.id);
        const productDoc = await productRef.get();
        
        if (!productDoc.exists) {
          stockErrors.push(`Product ${product.id} (${product.name}) not found`);
          continue;
        }
        
        const productData = productDoc.data();
        const currentStock = productData.stock || 0;
        const quantity = product.quantity || 1;
        
        // Check if enough stock
        if (currentStock < quantity) {
          stockErrors.push(`Not enough stock for ${product.name}. Available: ${currentStock}, Required: ${quantity}`);
          continue;
        }
        
        const newStock = currentStock - quantity;
        
        stockUpdatePromises.push(
          productRef.update({
            stock: newStock,
            updatedAt: admin.firestore.Timestamp.now()
          })
        );
        
        console.log(`📦 Updating stock for product ${product.id}: ${currentStock} - ${quantity} = ${newStock}`);
        
      } catch (error) {
        console.error(`❌ Error updating stock for product ${product.id}:`, error);
        stockErrors.push(`Error updating ${product.name}: ${error.message}`);
      }
    }
    
    // If there are stock errors, don't create the bill
    if (stockErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock validation failed',
        details: stockErrors
      });
    }
    
    // Wait for all stock updates to complete
    await Promise.all(stockUpdatePromises);
    console.log(`✅ Updated stock for ${stockUpdatePromises.length} products`);
    
    // Create bill object
    const billData = {
      userId: userId,
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        subtotal: product.price * product.quantity
      })),
      totalAmount: totalAmount,
      couponUserId: couponUserId || null,
      customerInfo: customerInfo || null,
      // Add individual customer fields
      name: name || (customerInfo ? customerInfo.name : null),
      email: email || (customerInfo ? customerInfo.email : null),
      phone: phone || (customerInfo ? customerInfo.phone : null), 
      address: address || (customerInfo ? customerInfo.address : null),
      coordinates: coordinates || null, // Save coordinates if provided
      status: 'pending', // Start with 'pending' status - will auto-update: pending -> processing (1m) -> shipping (30m) -> completed (3d)
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // Save bill to Firestore
    const billRef = await db.collection('bills').add(billData);
    console.log('✅ Bill created with ID:', billRef.id);
    
    // Save guest temp address to user profile if exists
    if (guestTempAddress && userId) {
      console.log('📍 Guest temp address found in bill request, saving to user profile...');
      console.log('👤 User ID:', userId);
      console.log('🏠 Temp address:', JSON.stringify(guestTempAddress));
      
      try {
        let userDoc = null;
        
        // Try to find user by userId first (most reliable)
        if (userId !== 'guest' && !userId.startsWith('guest_')) {
          console.log('🔍 Looking up user by userId:', userId);
          try {
            const userDocRef = await db.collection('users').doc(userId).get();
            if (userDocRef.exists) {
              userDoc = userDocRef;
              console.log('✅ Found user by userId:', userId);
            } else {
              console.warn('⚠️ User document not found for userId:', userId);
            }
          } catch (error) {
            console.error('❌ Error looking up user by userId:', error);
          }
        }
        
        // If not found by userId, try by email
        if (!userDoc && email) {
          const normalizedEmail = email.toLowerCase().trim();
          console.log('🔍 Looking up user by email:', normalizedEmail);
          
          const usersSnapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
          
          if (!usersSnapshot.empty) {
            userDoc = usersSnapshot.docs[0];
            console.log('✅ Found user by email:', normalizedEmail, '- Doc ID:', userDoc.id);
          } else {
            console.warn('⚠️ User not found with email:', normalizedEmail);
          }
        }
        
        // Save address if user found
        if (userDoc) {
          const userData = userDoc.data();
          console.log('👤 User data loaded - Current addresses:', userData.addresses?.length || 0);
          
          const existingAddresses = userData.addresses || [];
          
          // Check if address already exists (avoid duplicates)
          const addressExists = existingAddresses.some(addr => 
            addr.address === guestTempAddress.address &&
            addr.city === guestTempAddress.city &&
            addr.district === guestTempAddress.district
          );
          
          if (addressExists) {
            console.log('⚠️ Address already exists in user profile, skipping...');
          } else {
            // Add new address to user profile
            const newAddress = {
              address: guestTempAddress.address,
              city: guestTempAddress.city,
              district: guestTempAddress.district,
              coordinates: guestTempAddress.coordinates || null,
              isDefault: existingAddresses.length === 0, // Only set as default if it's the first address
              createdAt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now()
            };
            
            console.log('➕ Adding new address to user profile:', JSON.stringify(newAddress));
            existingAddresses.push(newAddress);
            
            await userDoc.ref.update({
              addresses: existingAddresses,
              updatedAt: admin.firestore.Timestamp.now()
            });
            
            console.log('✅ Guest temp address saved to user profile!');
            console.log('📊 User', userDoc.id, 'now has', existingAddresses.length, 'addresses');
          }
        } else {
          console.error('❌ Could not find user to save address');
          console.log('📋 Available data - userId:', userId, 'email:', email);
        }
      } catch (error) {
        console.error('❌ Error saving guest temp address:', error);
        console.error('❌ Error stack:', error.stack);
        // Don't throw - bill already created successfully
      }
    } else {
      if (!guestTempAddress) {
        console.log('ℹ️ No guest temp address in bill request');
      }
      if (!userId) {
        console.log('ℹ️ No userId in bill request');
      }
    }
    
    // Send order confirmation email to customer
    const customerEmail = email || (customerInfo ? customerInfo.email : null);
    const customerName = name || (customerInfo ? customerInfo.name : null);
    if (customerEmail) {
      console.log('📧 Sending order confirmation email to:', customerEmail);
      sendOrderConfirmationEmail(billRef.id, billData, customerEmail, customerName)
        .then(() => console.log('✅ Order confirmation email sent'))
        .catch(err => console.error('❌ Failed to send order confirmation email:', err));
    } else {
      console.warn('⚠️ No customer email found, skipping order confirmation email');
    }
    
    // Return success with bill ID
    res.json({
      success: true,
      billId: billRef.id,
      message: 'Bill created successfully'
    });
    
  } catch (error) {
    console.error('❌ Error creating bill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bill'
    });
  }
});

// Get bills for a specific user
app.get('/api/bills/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    console.log(`📋 Getting bills for user: ${userId} (limit: ${limit}, offset: ${offset})`);
    
    const billsSnapshot = await db.collection('bills')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();
    
    const bills = [];
    billsSnapshot.forEach(doc => {
      const billData = doc.data();
      bills.push({
        id: doc.id,
        ...billData,
        createdAt: billData.createdAt?.toDate?.()?.toISOString() || billData.createdAt,
        updatedAt: billData.updatedAt?.toDate?.()?.toISOString() || billData.updatedAt
      });
    });
    
    console.log(`✅ Found ${bills.length} bills for user: ${userId}`);
    res.json({
      success: true,
      bills: bills,
      count: bills.length
    });
    
  } catch (error) {
    console.error('❌ Error getting user bills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user bills'
    });
  }
});

// Confirm bill delivery (user confirms receipt) - delivered -> completed
app.post('/api/bills/:billId/confirm-delivery', async (req, res) => {
  try {
    const billId = req.params.billId;
    const { userId } = req.body;
    
    console.log(`📦 Confirming delivery for bill: ${billId} by user: ${userId}`);
    
    const billDoc = await db.collection('bills').doc(billId).get();
    
    if (!billDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Đơn hàng không tồn tại'
      });
    }
    
    const billData = billDoc.data();
    
    // Verify user owns this bill
    if (billData.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xác nhận đơn hàng này'
      });
    }
    
    // Only allow confirmation if status is 'delivered' OR already completed but missing confirmDeliveryDate
    if (billData.status !== 'delivered' && !(billData.status === 'completed' && !billData.confirmDeliveryDate)) {
      return res.status(400).json({
        success: false,
        error: `Chỉ có thể xác nhận đơn hàng đã được giao. Trạng thái hiện tại: ${billData.status}`
      });
    }
    
    // Update to completed with confirmation date
    const confirmDeliveryDate = admin.firestore.Timestamp.now();
    await billDoc.ref.update({
      status: 'completed',
      completedAt: billData.completedAt || confirmDeliveryDate, // Keep original if exists
      confirmDeliveryDate: confirmDeliveryDate, // Ngày xác nhận đã nhận hàng
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    console.log(`✅ Bill ${billId} confirmed by user ${userId}: ${billData.status} -> completed with confirmDeliveryDate at ${confirmDeliveryDate.toDate()}`);

    
    // Auto-update membership points when order is completed
    let tierPromoted = false;
    let membershipData = null;
    let oldLevel = null;
    
    try {
      // Get user's old membership level first
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        oldLevel = userDoc.data().membershipLevel || 'standard';
      }
      
      const billsSnapshot = await db.collection('bills')
        .where('userId', '==', userId)
        .where('status', '==', 'completed')
        .get();

      let totalSpending = 0;
      billsSnapshot.docs.forEach(doc => {
        const bill = doc.data();
        if (bill.totalAmount) {
          totalSpending += bill.totalAmount;
        }
      });

      const points = Math.floor(totalSpending * 0.10);
      const membership = calculateMembershipLevel(points);

      await db.collection('users').doc(userId).update({
        points: points,
        membershipLevel: membership.level,
        lastMembershipUpdate: admin.firestore.FieldValue.serverTimestamp()
      });

      // Check if tier was promoted
      if (oldLevel && oldLevel !== membership.level) {
        tierPromoted = true;
        membershipData = {
          level: membership.level,
          name: membership.name,
          icon: membership.icon,
          points: points
        };
        console.log(`🎉 TIER PROMOTION: ${oldLevel} -> ${membership.level}`);
      }

      console.log(`🏆 Membership auto-updated: ${membership.name} (${points} points)`);
    } catch (membershipError) {
      console.error('⚠️ Error auto-updating membership:', membershipError);
      // Don't fail the main request if membership update fails
    }
    
    res.json({
      success: true,
      message: 'Đã xác nhận nhận hàng thành công!',
      billId: billId,
      tierPromoted: tierPromoted,
      membership: membershipData
    });
    
  } catch (error) {
    console.error('❌ Error confirming delivery:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xác nhận nhận hàng: ' + error.message
    });
  }
});

// Return/Refund order - User returns order within 7 days of confirmation
app.post('/api/bills/:billId/return', async (req, res) => {
  try {
    const billId = req.params.billId;
    const { userId, reason, refundBankAccount, refundAccountName, refundBankName } = req.body;
    
    console.log(`↩️ Processing return for bill: ${billId} by user: ${userId}`);
    console.log(`📝 Return reason: ${reason || 'Not specified'}`);
    console.log(`💳 Refund info - Account: ${refundBankAccount}, Name: ${refundAccountName}, Bank: ${refundBankName}`);
    
    const billDoc = await db.collection('bills').doc(billId).get();
    
    if (!billDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Đơn hàng không tồn tại'
      });
    }
    
    const billData = billDoc.data();
    
    // Verify user owns this bill
    if (billData.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền trả đơn hàng này'
      });
    }
    
    // Only allow return if status is 'completed'
    if (billData.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: `Chỉ có thể trả đơn hàng đã hoàn thành. Trạng thái hiện tại: ${billData.status}`
      });
    }
    
    // Check if confirmDeliveryDate exists and is within 7 days
    if (!billData.confirmDeliveryDate) {
      return res.status(400).json({
        success: false,
        error: 'Không tìm thấy ngày xác nhận nhận hàng'
      });
    }
    
    const confirmDate = billData.confirmDeliveryDate.toDate();
    const now = new Date();
    const daysDiff = Math.floor((now - confirmDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 7) {
      return res.status(400).json({
        success: false,
        error: `Đã quá thời hạn trả hàng (7 ngày). Đơn hàng được xác nhận cách đây ${daysDiff} ngày.`
      });
    }
    
    console.log(`✅ Return eligible: ${daysDiff} days since confirmation (within 7-day window)`);
    
    // Restore product stock
    const products = billData.products || billData.items || [];
    const batch = db.batch();
    
    for (const product of products) {
      const productRef = db.collection('products').doc(product.id);
      const productDoc = await productRef.get();
      
      if (productDoc.exists) {
        const currentStock = productDoc.data().stock || 0;
        const quantityToRestore = product.quantity || 1;
        const newStock = currentStock + quantityToRestore;
        
        batch.update(productRef, {
          stock: newStock,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`📦 Restoring ${quantityToRestore}x "${product.name}" (stock: ${currentStock} -> ${newStock})`);
      }
    }
    
    // Update bill status to 'returned' with refund information
    batch.update(billDoc.ref, {
      status: 'returned',
      returnedAt: admin.firestore.Timestamp.now(),
      returnReason: reason || 'Không có lý do',
      refundBankAccount: refundBankAccount || '',
      refundAccountName: refundAccountName || '',
      refundBankName: refundBankName || '',
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    await batch.commit();
    
    console.log(`✅ Bill ${billId} returned successfully. Stock restored and refund info saved.`);
    
    res.json({
      success: true,
      message: 'Đã xử lý trả hàng thành công! Số lượng sản phẩm đã được hoàn về kho. Thông tin hoàn tiền đã được lưu.',
      billId: billId
    });
    
  } catch (error) {
    console.error('❌ Error processing return:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xử lý trả hàng: ' + error.message
    });
  }
});

// Cancel bill and restore product stock
app.post('/api/bills/:billId/cancel', async (req, res) => {
  try {
    const billId = req.params.billId;
    const { userId, reason, refundBankAccount, refundAccountName, refundBankName } = req.body;
    
    console.log(`🚫 Cancelling bill: ${billId} by user: ${userId}`);
    console.log(`💳 Refund info - Account: ${refundBankAccount}, Name: ${refundAccountName}, Bank: ${refundBankName}`);
    
    const billDoc = await db.collection('bills').doc(billId).get();
    
    if (!billDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Đơn hàng không tồn tại'
      });
    }
    
    const billData = billDoc.data();
    
    // Verify user owns this bill
    if (billData.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền hủy đơn hàng này'
      });
    }
    
    // Only allow cancellation if status is not completed or already cancelled
    if (billData.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Không thể hủy đơn hàng đã hoàn thành'
      });
    }
    
    if (billData.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Đơn hàng đã được hủy trước đó'
      });
    }
    
    // Restore stock for each product
    const products = billData.products || [];
    const stockUpdatePromises = [];
    
    for (const product of products) {
      if (product.id) {
        const productRef = db.collection('products').doc(product.id);
        const productDoc = await productRef.get();
        
        if (productDoc.exists) {
          const currentStock = productDoc.data().stock || 0;
          const quantity = product.quantity || 1;
          const newStock = currentStock + quantity;
          
          stockUpdatePromises.push(
            productRef.update({
              stock: newStock,
              updatedAt: admin.firestore.Timestamp.now()
            })
          );
          
          console.log(`📦 Restoring stock for product ${product.id}: ${currentStock} + ${quantity} = ${newStock}`);
        }
      }
    }
    
    // Wait for all stock updates to complete
    await Promise.all(stockUpdatePromises);
    
    // Update bill status to cancelled with refund bank info
    await billDoc.ref.update({
      status: 'cancelled',
      cancelledAt: admin.firestore.Timestamp.now(),
      cancelReason: reason || 'Người dùng yêu cầu hủy',
      refundBankAccount: refundBankAccount || '',
      refundAccountName: refundAccountName || '',
      refundBankName: refundBankName || '',
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    console.log(`✅ Bill ${billId} cancelled by user ${userId}. Stock restored for ${products.length} products. Refund info saved.`);
    
    res.json({
      success: true,
      message: 'Đã hủy đơn hàng và hoàn trả số lượng sản phẩm thành công!',
      billId: billId,
      restoredProducts: products.length
    });
    
  } catch (error) {
    console.error('❌ Error cancelling bill:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể hủy đơn hàng: ' + error.message
    });
  }
});

// Get specific bill by ID
app.get('/api/bills/:billId', async (req, res) => {
  try {
    const billId = req.params.billId;
    
    console.log(`📋 Getting bill: ${billId}`);
    
    const billDoc = await db.collection('bills').doc(billId).get();
    
    if (!billDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }
    
    const billData = billDoc.data();
    const bill = {
      id: billDoc.id,
      ...billData,
      createdAt: billData.createdAt?.toDate?.()?.toISOString() || billData.createdAt,
      updatedAt: billData.updatedAt?.toDate?.()?.toISOString() || billData.updatedAt
    };
    
    console.log(`✅ Found bill: ${billId}`);
    res.json({
      success: true,
      bill: bill
    });
    
  } catch (error) {
    console.error('❌ Error getting bill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bill'
    });
  }
});

// =====================================
// ADDRESS OTP FOR GUEST USERS
// =====================================

// Note: Using shared otpStore Map defined above for guest checkout

// Send OTP to email for guest users to view addresses
app.post('/api/guest/send-address-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email là bắt buộc' 
      });
    }
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`📧 Sending address OTP to guest email: ${normalizedEmail}`);
    
    // Check if user exists in database
    const userQuery = await db.collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();
    
    if (userQuery.empty) {
      return res.status(404).json({ 
        success: false, 
        error: 'Không tìm thấy tài khoản với email này' 
      });
    }
    
    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    
    // Check if user has addresses
    if (!userData.addresses || userData.addresses.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tài khoản này chưa có địa chỉ nào được lưu' 
      });
    }
    
    // Generate 6-digit OTP
    const otp = generateOTP();
    
    // Store OTP with 5 minute expiration
    const otpData = {
      otp: otp,
      email: normalizedEmail,
      uid: userDoc.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    };
    
    otpStore.set(normalizedEmail, otpData);
    
    // Clean up expired OTPs
    setTimeout(() => {
      otpStore.delete(normalizedEmail);
    }, 5 * 60 * 1000);
    
    // Send OTP email
    const mailOptions = {
      from: 'Tech Haven <hiroyamasaki0939@gmail.com>',
      to: normalizedEmail,
      subject: '🔐 Mã OTP Xem Địa Chỉ - Tech Haven',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              padding: 30px;
            }
            .otp-box {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              font-size: 36px;
              font-weight: bold;
              text-align: center;
              padding: 20px;
              border-radius: 10px;
              letter-spacing: 8px;
              margin: 20px 0;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              font-size: 14px;
              color: #666;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Mã OTP Xem Địa Chỉ</h1>
            </div>
            <div class="content">
              <p>Xin chào <strong>${userData.name || 'Khách hàng'}</strong>,</p>
              
              <p>Bạn đã yêu cầu xem danh sách địa chỉ đã lưu trong tài khoản Tech Haven.</p>
              
              <p>Mã OTP của bạn là:</p>
              
              <div class="otp-box">
                ${otp}
              </div>
              
              <div class="warning">
                <strong>⚠️ Lưu ý quan trọng:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Mã OTP có hiệu lực trong <strong>5 phút</strong></li>
                  <li>Không chia sẻ mã này với bất kỳ ai</li>
                  <li>Tech Haven sẽ không bao giờ yêu cầu mã OTP qua điện thoại</li>
                </ul>
              </div>
              
              <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
              
              <p style="margin-top: 30px;">Trân trọng,<br><strong>Tech Haven Team</strong></p>
            </div>
            <div class="footer">
              <p>
                📧 hiroyamasaki0939@gmail.com<br>
                🌐 <a href="https://tech-haven-5368b.web.app">tech-haven-5368b.web.app</a>
              </p>
              <p style="font-size: 12px; color: #999; margin-top: 15px;">
                Email này được gửi tự động, vui lòng không trả lời.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log(`✅ OTP sent to ${normalizedEmail}: ${otp}`);
    
    res.json({
      success: true,
      message: 'Mã OTP đã được gửi đến email của bạn',
      expiresIn: 300 // 5 minutes in seconds
    });
    
  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể gửi mã OTP. Vui lòng thử lại sau.'
    });
  }
});

// Verify OTP and return user addresses
app.post('/api/guest/verify-address-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email và mã OTP là bắt buộc' 
      });
    }
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`🔐 Verifying OTP for guest email: ${normalizedEmail}`);
    
    // Get stored OTP
    const storedOtpData = otpStore.get(normalizedEmail);
    
    if (!storedOtpData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Mã OTP không hợp lệ hoặc đã hết hạn' 
      });
    }
    
    // Check if OTP expired
    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ 
        success: false, 
        error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' 
      });
    }
    
    // Verify OTP
    if (storedOtpData.otp !== otp.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Mã OTP không đúng. Vui lòng thử lại.' 
      });
    }
    
    // OTP is valid - get user addresses
    const userDoc = await db.collection('users').doc(storedOtpData.uid).get();
    
    if (!userDoc.exists) {
      otpStore.delete(normalizedEmail);
      return res.status(404).json({ 
        success: false, 
        error: 'Không tìm thấy thông tin người dùng' 
      });
    }
    
    const userData = userDoc.data();
    const addresses = userData.addresses || [];
    
    // Delete OTP after successful verification
    otpStore.delete(normalizedEmail);
    
    console.log(`✅ OTP verified for ${normalizedEmail}. Returning ${addresses.length} addresses.`);
    
    res.json({
      success: true,
      message: 'Xác thực thành công',
      addresses: addresses,
      userName: userData.name || 'Khách hàng',
      userEmail: userData.email
    });
    
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xác thực mã OTP. Vui lòng thử lại sau.'
    });
  }
});

// =====================================
// ELASTICSEARCH API ENDPOINTS
// =====================================

// Elasticsearch health check
app.get('/api/elasticsearch/health', async (req, res) => {
  try {
    const health = await checkElasticsearchConnection();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// Initialize Elasticsearch index
app.post('/api/elasticsearch/init', async (req, res) => {
  try {
    console.log('🚀 Initializing Elasticsearch...');
    
    // Initialize client
    const client = initializeElasticsearch();
    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize Elasticsearch client'
      });
    }
    
    // Check connection
    const health = await checkElasticsearchConnection();
    if (!health.connected) {
      return res.status(500).json({
        success: false,
        error: 'Elasticsearch connection failed',
        details: health.error
      });
    }
    
    // Create index
    const indexCreated = await createProductsIndex();
    if (!indexCreated) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create products index'
      });
    }
    
    res.json({
      success: true,
      message: 'Elasticsearch initialized successfully',
      health
    });
  } catch (error) {
    console.error('❌ Elasticsearch init error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync all products from Firestore to Elasticsearch
app.post('/api/elasticsearch/sync', async (req, res) => {
  try {
    console.log('🔄 Starting product sync...');
    const result = await syncAllProducts();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Products synced successfully',
        ...result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Advanced product search with Elasticsearch
app.get('/api/search', async (req, res) => {
  try {
    const {
      q: query,
      from = 0,
      size = 20,
      categories,
      brands,
      minPrice,
      maxPrice,
      inStock,
      sortBy,
      sortOrder
    } = req.query;
    
    console.log('🔍 Elasticsearch search:', query);
    
    // Parse array parameters
    const options = {
      from: parseInt(from),
      size: parseInt(size),
      categories: categories ? (Array.isArray(categories) ? categories : [categories]) : [],
      brands: brands ? (Array.isArray(brands) ? brands : [brands]) : [],
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      inStock: inStock === 'true',
      sortBy: sortBy || '_score',
      sortOrder: sortOrder || 'desc',
      aggregations: true
    };
    
    const result = await searchProducts(query || '', options);
    
    if (result.success) {
      res.json(result);
    } else {
      // Fallback to Firestore if Elasticsearch fails
      console.warn('⚠️ Elasticsearch search failed, falling back to Firestore...');
      
      const db = admin.firestore();
      const productsSnapshot = await db.collection('products').limit(20).get();
      
      const products = [];
      productsSnapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      res.json({
        success: true,
        hits: products,
        total: products.length,
        fallback: true
      });
    }
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Autocomplete suggestions
app.get('/api/search/autocomplete', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    console.log('🔍 Autocomplete:', query);
    
    const result = await autocomplete(query, parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('❌ Autocomplete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Similar products recommendation
app.get('/api/products/:productId/similar', async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 6 } = req.query;
    
    console.log('🔍 Finding similar products for:', productId);
    
    const result = await findSimilarProducts(productId, parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('❌ Similar products error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Popular search terms
app.get('/api/search/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await getPopularSearchTerms(parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('❌ Popular terms error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export for Firebase Functions or start local server
if (isLocal) {
  // Local development server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, async () => {
    console.log(`🚀 Local server running on http://localhost:${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    
    // Initialize Elasticsearch on startup
    console.log('🔍 Initializing Elasticsearch...');
    try {
      const client = initializeElasticsearch();
      if (client) {
        const health = await checkElasticsearchConnection();
        if (health.connected) {
          console.log('✅ Elasticsearch connected:', health.status);
          
          // Create index if not exists
          await createProductsIndex();
          
          // Setup real-time sync listeners
          console.log('🎧 Setting up Firestore listeners...');
          setupFirestoreListeners();
        } else {
          console.warn('⚠️ Elasticsearch not connected:', health.error);
          console.warn('⚠️ Search will fall back to Firestore');
        }
      }
    } catch (error) {
      console.warn('⚠️ Elasticsearch initialization failed:', error.message);
      console.warn('⚠️ Search will fall back to Firestore');
    }
  });
  
  module.exports = app;
} else {
  // Firebase Functions export
  exports.app = onRequest(app);
}
