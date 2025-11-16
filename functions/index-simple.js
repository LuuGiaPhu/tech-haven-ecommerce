const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const path = require('path');

const app = express();

// Simple test to see if Cloud Functions can start
console.log('🚀 Starting Express app for Cloud Functions');

// Basic middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// EJS template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Simple test route
app.get('/', (req, res) => {
  console.log('📝 Home route accessed');
  res.render('index', { user: null });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Cloud Functions is working!', timestamp: new Date() });
});

// Export with minimal configuration
exports.app = onRequest({
  region: 'asia-southeast1',
  memory: '512MiB',
  timeoutSeconds: 60
}, app);

console.log('✅ Express app configured for export');