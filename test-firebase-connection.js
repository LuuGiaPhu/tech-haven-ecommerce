const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('./functions/serviceAccountKey.json')),
    projectId: 'tech-haven-5368b'
  });
  console.log('✅ Firebase Admin SDK initialized');
}

const db = admin.firestore();
const auth = admin.auth();

async function testFirebaseConnection() {
  try {
    console.log('🔄 Testing Firebase connection...');
    
    // Test 1: Check Firestore connection
    console.log('📊 Testing Firestore connection...');
    const testDoc = await db.collection('test').doc('connection').set({
      message: 'Firebase connection test',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Firestore write successful');
    
    // Read back the test document
    const testRead = await db.collection('test').doc('connection').get();
    if (testRead.exists) {
      console.log('✅ Firestore read successful:', testRead.data());
    }
    
    // Test 2: Check Auth connection
    console.log('🔐 Testing Firebase Auth...');
    const usersList = await auth.listUsers(1); // List 1 user to test connection
    console.log('✅ Firebase Auth connection successful');
    
    // Test 3: Check users collection
    console.log('👥 Checking users collection...');
    const usersSnapshot = await db.collection('users').limit(5).get();
    console.log(`📊 Found ${usersSnapshot.size} users in Firestore`);
    
    if (!usersSnapshot.empty) {
      console.log('👤 Sample users:');
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        console.log(`  - ${userData.name} (${userData.email}) - Created: ${userData.createdAt?.toDate?.()}`);
      });
    } else {
      console.log('📝 No users found in Firestore - this is normal if no one has logged in yet');
    }
    
    // Clean up test document
    await db.collection('test').doc('connection').delete();
    console.log('🧹 Test document cleaned up');
    
    console.log('✅ All Firebase connection tests passed!');
    
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    console.error('Error details:', error.message);
  }
}

// Run the test
testFirebaseConnection().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed with error:', error);
  process.exit(1);
});