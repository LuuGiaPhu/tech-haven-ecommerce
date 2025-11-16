const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');

const app = express();

// Express configuration
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple session (memory store for testing)
app.use(session({
  secret: 'simple-test-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  name: 'test-session'
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: "442337591630-ab2m15n55vdi1700gs5qvufrpcfol58t.apps.googleusercontent.com",
  clientSecret: "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",
  callbackURL: "https://tech-haven-5368b.web.app/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  console.log('🔐 Google OAuth for:', profile.displayName);
  
  const userData = {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails[0]?.value,
    photo: profile.photos[0]?.value
  };
  
  console.log('👤 User:', userData);
  return done(null, userData);
}));

// Passport serialization
passport.serializeUser((user, done) => {
  console.log('📝 Serialize:', user.name);
  done(null, user);
});

passport.deserializeUser((user, done) => {
  console.log('📖 Deserialize:', user.name);
  done(null, user);
});

// Debug middleware
app.use((req, res, next) => {
  if (!req.path.includes('.')) {
    console.log(`🌐 ${req.method} ${req.path} - Auth: ${req.isAuthenticated()} - User: ${req.user?.name || 'None'}`);
  }
  next();
});

// Routes
app.get('/', (req, res) => {
  res.render('index', { 
    user: req.user || null,
    isAuthenticated: req.isAuthenticated()
  });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    console.log('🎉 Login successful:', req.user.name);
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

app.get('/debug', (req, res) => {
  res.json({
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    sessionID: req.sessionID,
    cookies: req.headers.cookie
  });
});

// Route để kiểm tra tất cả sessions trong Firestore
app.get('/check-sessions', async (req, res) => {
  try {
    const sessionsRef = db.collection('sessions');
    const snapshot = await sessionsRef.orderBy('updatedAt', 'desc').limit(10).get();
    
    const sessions = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        hasUser: !!(data.session && data.session.passport && data.session.passport.user),
        userId: data.session?.passport?.user,
        expires: data.expires?.toDate?.(),
        updatedAt: data.updatedAt?.toDate?.()
      });
    });
    
    res.json({
      message: 'Sessions trong Firestore:',
      totalFound: sessions.length,
      sessions: sessions,
      currentRequest: {
        sessionId: req.sessionID,
        authenticated: req.isAuthenticated(),
        cookies: req.headers.cookie
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

exports.app = onRequest(app);