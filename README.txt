================================================================================
TECH HAVEN - E-COMMERCE WEBSITE FOR COMPUTER & COMPONENTS
Final Project - Web Application Development with Node.js
================================================================================

PROJECT INFORMATION
-------------------
Project Name: Tech Haven E-Commerce Platform
Team Members: [Điền tên thành viên]
Student IDs: [Điền MSSV]
Submission Date: November 18, 2025

================================================================================
I. PROJECT OVERVIEW
================================================================================

Tech Haven is a comprehensive e-commerce platform specialized in selling 
computers and computer components including:
- Gaming PCs and Custom Build PCs
- Laptops (Gaming, Workstation, Ultrabook)
- PC Components (CPU, GPU, RAM, SSD, Motherboard)
- Monitors and Peripherals
- Storage Devices and Accessories

The platform is built with:
- Backend: Node.js with Express.js framework
- Frontend: EJS templating with vanilla JavaScript
- Database: Google Cloud Firestore (NoSQL)
- Authentication: Firebase Authentication
- Search Engine: Elasticsearch (Serverless on Elastic Cloud)
- Hosting: Firebase Hosting + Cloud Functions
- Real-time Features: Firebase Realtime Database for cart synchronization

================================================================================
II. DEPLOYMENT INFORMATION
================================================================================

LIVE WEBSITE URL:
-----------------
https://tech-haven-5368b.web.app/

ADMIN CREDENTIALS:
-----------------
Email: admin@techhaven.com
Password: Admin123456

TEST USER ACCOUNTS:
------------------
1. Google OAuth User:
   - Login via "Sign in with Google" button
   
2. Manual Registration User:
   Email: testuser@gmail.com
   Password: Test123456

================================================================================
III. PROJECT SETUP & INSTALLATION
================================================================================

PREREQUISITES:
--------------
- Node.js version 18.x or higher
- npm version 8.x or higher
- Firebase CLI: npm install -g firebase-tools
- Git for version control

LOCAL DEVELOPMENT SETUP:
------------------------
1. Clone the repository:
   git clone https://github.com/LuuGiaPhu/tech-haven-ecommerce.git
   cd tech-haven-ecommerce

2. Install dependencies for Cloud Functions:
   cd functions
   npm install

3. Set up environment variables:
   - Create a .env file in the functions directory
   - Add the following variables:
     ELASTICSEARCH_CLOUD_ID=my-elasticsearch-project-cc2314:...
     ELASTICSEARCH_API_KEY=your-elasticsearch-api-key
     VNPAY_TMN_CODE=your-vnpay-terminal-code
     VNPAY_HASH_SECRET=your-vnpay-hash-secret
     GEMINI_API_KEY=your-gemini-api-key

4. Configure Firebase Admin SDK:
   - Place serviceAccountKey.json in the functions directory
   - This file is provided separately for security reasons

5. Run the local development server:
   cd functions
   node index.js
   
   Server will start at: http://localhost:3000

6. Access the application:
   - Homepage: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin
   - Shop Page: http://localhost:3000/shop

FIREBASE DEPLOYMENT:
-------------------
1. Login to Firebase:
   firebase login

2. Deploy Cloud Functions and Hosting:
   firebase deploy

3. Deploy specific components:
   - Functions only: firebase deploy --only functions
   - Hosting only: firebase deploy --only hosting
   - Firestore rules: firebase deploy --only firestore:rules
   - Firestore indexes: firebase deploy --only firestore:indexes

================================================================================
IV. PROJECT STRUCTURE
================================================================================

tech-haven-ecommerce/
│
├── functions/                      # Firebase Cloud Functions (Backend)
│   ├── index.js                   # Main Express.js server
│   ├── auth-service.js            # Authentication middleware
│   ├── elasticsearch-config.js    # Elasticsearch configuration
│   ├── elasticsearch-sync.js      # Firestore to Elasticsearch sync
│   ├── firebase-admin-config.js   # Firebase Admin initialization
│   ├── firestore-config.js        # Firestore database config
│   ├── package.json               # Backend dependencies
│   │
│   ├── public/                    # Static assets
│   │   ├── css/                   # Stylesheets
│   │   │   ├── style.css          # Main styles
│   │   │   ├── user-profile.css   # User profile styles
│   │   │   └── ai-chat-widget.css # AI chatbot styles
│   │   ├── js/                    # Client-side JavaScript
│   │   │   ├── script.js          # Main app logic
│   │   │   ├── auth.js            # Authentication handlers
│   │   │   ├── ai-chat-widget.js  # AI chatbot with Gemini
│   │   │   └── ga4-tracking.js    # Google Analytics 4
│   │   └── images/                # Product images & assets
│   │
│   └── views/                     # EJS Templates
│       ├── index.ejs              # Homepage
│       ├── shop.ejs               # Product catalog
│       ├── product_detail.ejs     # Product details page
│       ├── category.ejs           # Category page
│       ├── bill_admin.ejs         # Admin order list
│       ├── bill_detail_admin.ejs  # Admin order details
│       ├── edit.ejs               # Admin product management
│       ├── input.ejs              # Admin add product
│       └── coupon.ejs             # Admin discount management
│
├── public/                        # Frontend static files (for hosting)
│   ├── css/
│   ├── js/
│   ├── images/
│   └── sitemap.xml               # SEO sitemap
│
├── firebase.json                 # Firebase configuration
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Firestore composite indexes
└── package.json                 # Root dependencies

================================================================================
V. CORE FEATURES IMPLEMENTED
================================================================================

CUSTOMER FEATURES (6.0 points):
-------------------------------
✅ Social Media Authentication (Google OAuth)
✅ View Profile Page with comprehensive user information
✅ Change Password functionality
✅ Password Recovery via email
✅ Manage Multiple Delivery Addresses (CRUD operations)
✅ View Purchase History (with order timeline)
✅ View Purchase Details (order items, status, tracking)
✅ Landing Page with product categories
✅ Product Catalog with category filtering
✅ Pagination (implemented on all product lists)
✅ View Product Details with variants support
✅ Product Variants (color, storage, RAM options)
✅ Product Search by keyword (powered by Elasticsearch)
✅ Product Filtering (brand, price range, rating, category)
✅ Product Ordering (by name A-Z, Z-A, price low-high, high-low)
✅ Shopping Cart Display with real-time updates
✅ Update Shopping Cart without page reload
✅ Checkout Process (multi-step with VNPay integration)
✅ Discount Code System (5-character alphanumeric codes)
✅ Email Notification after order placement
✅ Product Review (comments without login required)
✅ Product Rating (star rating, login required)
✅ Real-time Review Updates (WebSocket via Firebase)
✅ Loyalty Program (10% points on each purchase)

ADMIN FEATURES (2.0 points):
----------------------------
✅ User Management (view, edit, ban users)
✅ Product Management (CRUD operations with variants)
✅ Discount Management (create, view, track usage)
✅ View Order List (paginated, filterable by date)
✅ View Order Details & Change Status
✅ Simple Dashboard (total users, orders, revenue, charts)
✅ Advanced Dashboard (revenue/profit by time intervals)

OTHER REQUIREMENTS (2.0 points):
--------------------------------
✅ UI/UX - Modern, responsive design with smooth animations
✅ Teamwork - Git collaboration with regular commits
✅ Responsive Design - Fully responsive across all devices
✅ Horizontal Scaling - Deployed on Firebase (auto-scaling)

================================================================================
VI. BONUS FEATURES IMPLEMENTED (+2.0 points max)
================================================================================

✅ 1. CI/CD Pipeline (+0.5 points)
   - GitHub Actions for automated deployment
   - Automatic deployment to Firebase on push to main branch
   - Build validation and testing before deployment
   
✅ 2. Elasticsearch Integration (+0.5 points)
   - Elasticsearch Cloud (Serverless) for product search
   - Real-time sync from Firestore to Elasticsearch
   - Fast, relevant search results with auto-suggestions
   - Support for Vietnamese search queries
   
✅ 3. AI Integration (+0.5 points)
   - AI Chatbot powered by Google Gemini 2.0 Flash
   - Product recommendations based on user queries
   - Natural language understanding for Vietnamese
   - Persistent chat history across sessions
   
✅ 4. Advanced Features (+0.5 points)
   - Google Analytics 4 integration for tracking
   - SEO optimization with structured data (JSON-LD)
   - Performance monitoring and lazy loading
   - WebSocket for real-time features (reviews, cart sync)

Total Bonus Points: +2.0 points

Evidence for bonus features is provided in the /Bonus folder.

================================================================================
VII. TECHNICAL HIGHLIGHTS
================================================================================

DATABASE ARCHITECTURE:
---------------------
Firestore Collections:
- users: User profiles and authentication data
- products: Product catalog with variants
- carts: Shopping cart items (real-time sync)
- bills: Order records with timestamps
- wishlists: User favorite products
- coupons: Discount codes with usage tracking
- recentlyViewed: Product view history

SECURITY FEATURES:
-----------------
- Firebase Authentication with secure tokens
- Firestore Security Rules for data protection
- Input validation and sanitization
- XSS and CSRF protection
- Secure password hashing (handled by Firebase Auth)
- Environment variables for sensitive data

PERFORMANCE OPTIMIZATIONS:
-------------------------
- Lazy loading for images
- Code splitting and minification
- CDN usage for static assets (Cloudflare)
- Elasticsearch for fast search queries
- Client-side caching with localStorage
- Pagination to reduce data transfer
- Indexed Firestore queries for speed

REAL-TIME FEATURES:
------------------
- Cart synchronization across tabs/devices
- Live product review updates
- Real-time order status tracking
- WebSocket communication via Firebase

PAYMENT INTEGRATION:
-------------------
- VNPay payment gateway integration
- Secure transaction handling
- Order confirmation emails
- Transaction history tracking

SEO OPTIMIZATION:
----------------
- Meta tags for social media sharing
- Sitemap.xml for search engines
- Structured data (JSON-LD) for rich snippets
- Canonical URLs to prevent duplicate content
- Google Analytics 4 for tracking
- Google Search Console verification

================================================================================
VIII. API ENDPOINTS
================================================================================

PUBLIC ENDPOINTS:
----------------
GET  /                          - Homepage
GET  /shop                      - Product catalog
GET  /product/:id               - Product details
GET  /category/:name            - Category products
POST /api/search                - Search products (Elasticsearch)

AUTHENTICATED ENDPOINTS:
-----------------------
GET  /api/user                  - Get user profile
GET  /api/user/profile          - Get full user profile
POST /api/user/wishlist         - Add to wishlist
GET  /api/wishlist/:uid         - Get user wishlist
GET  /api/cart                  - Get shopping cart
POST /api/cart                  - Update cart
POST /api/checkout              - Create order
GET  /api/user/recent-products  - Recently viewed
GET  /api/user/recent-orders    - Order history

ADMIN ENDPOINTS:
---------------
GET  /admin                     - Admin dashboard
GET  /bill_admin                - Order list
GET  /bill_detail_admin/:id     - Order details
GET  /edit                      - Product management
POST /add_product               - Add new product
POST /update_product/:id        - Update product
POST /delete_product/:id        - Delete product
GET  /coupon                    - Discount management
POST /create_coupon             - Create discount code

================================================================================
IX. TESTING INSTRUCTIONS
================================================================================

FOR GRADING PURPOSES:
--------------------
1. Visit the live website: https://tech-haven-5368b.web.app/

2. Test Customer Features:
   a) Browse products without logging in
   b) Add products to cart and checkout as guest
   c) Login with Google OAuth
   d) Test search with keywords: "laptop gaming", "RTX 4070"
   e) Filter products by brand (ASUS, MSI) and price range
   f) Leave a product review (no login needed)
   g) Rate a product with stars (login required)
   h) Apply discount code: TECH5 (5 uses remaining)
   i) Check order history in user profile

3. Test Admin Features:
   a) Login with admin credentials (provided above)
   b) Navigate to /admin for dashboard
   c) View order list at /bill_admin
   d) Manage products at /edit
   e) Create discount codes at /coupon
   f) Update order status in order details

4. Test Responsive Design:
   - Open browser DevTools (F12)
   - Test on mobile (375px), tablet (768px), desktop (1920px)
   - Verify all features work on different screen sizes

5. Test Bonus Features:
   a) AI Chatbot: Click purple chat bubble in bottom-right
   b) Search: Use search bar and observe Elasticsearch speed
   c) Real-time: Open product in two tabs, add review in one

PRE-LOADED TEST DATA:
--------------------
- 50+ products across 8 categories
- 15+ test orders with various statuses
- 5+ discount codes (some used, some available)
- Multiple user accounts with purchase history
- Product reviews and ratings

KNOWN LIMITATIONS:
-----------------
- VNPay payment is in sandbox mode (test transactions only)
- Email sending uses Firebase SMTP (may have rate limits)
- Elasticsearch queries limited to 1000 results per request

================================================================================
X. TROUBLESHOOTING
================================================================================

If the website doesn't load:
----------------------------
1. Check internet connection
2. Clear browser cache and cookies
3. Try incognito/private mode
4. Verify the URL is correct: https://tech-haven-5368b.web.app/

If login fails:
--------------
1. For Google OAuth: Ensure pop-ups are enabled
2. For manual login: Check credentials are correct
3. Try password recovery if needed

If features are missing:
-----------------------
1. Ensure JavaScript is enabled in browser
2. Check browser console for errors (F12)
3. Verify you're using a modern browser (Chrome, Firefox, Edge)

If admin panel is inaccessible:
------------------------------
1. Verify admin credentials are correct
2. Ensure you're logged in before accessing /admin
3. Contact team if issue persists

================================================================================
XI. PROJECT DOCUMENTATION
================================================================================

Additional documentation files:
- ELASTICSEARCH-SETUP.md: Elasticsearch configuration guide
- FIREBASE-PRODUCTION-SETUP.md: Firebase deployment guide
- SEO-GUIDE.md: SEO optimization details
- PERFORMANCE-OPTIMIZATION.md: Performance tuning guide
- Data.md: Database schema documentation

All documentation is available in the project root directory.

================================================================================
XII. CONTACT INFORMATION
================================================================================

For any questions or issues regarding this project:
- GitHub Repository: https://github.com/LuuGiaPhu/tech-haven-ecommerce
- Email: [Điền email nhóm]
- Project Duration: October 18, 2025 - November 18, 2025 (1 month)

================================================================================
XIII. ACKNOWLEDGMENTS
================================================================================

This project uses the following technologies and services:
- Node.js & Express.js
- Firebase (Authentication, Firestore, Hosting, Cloud Functions)
- Elasticsearch Cloud
- Google Gemini AI
- VNPay Payment Gateway
- Google Analytics 4
- Cloudflare CDN
- GitHub for version control

================================================================================
END OF README
================================================================================
