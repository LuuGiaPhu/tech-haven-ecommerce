// Script để set admin status cho user
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

async function setAdminStatus() {
  try {
    // Thay đổi email này thành email của admin chính
    const adminEmail = 'luugiaphup6tpbt@gmail.com'; // Change this to your admin email
    
    console.log('🔍 Looking for user with email:', adminEmail);
    
    // Find user by email
    const usersQuery = await db.collection('users').where('email', '==', adminEmail).get();
    
    if (usersQuery.empty) {
      console.log('❌ User not found with email:', adminEmail);
      console.log('📝 Available users:');
      
      // Show available users
      const allUsers = await db.collection('users').limit(10).get();
      allUsers.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.name} (${data.email})`);
      });
      
      return;
    }
    
    const userDoc = usersQuery.docs[0];
    const userData = userDoc.data();
    
    console.log('👤 Found user:', userData.name, '(', userData.email, ')');
    console.log('📊 Current admin status:', userData.is_admin || false);
    
    // Update admin status to true
    await userDoc.ref.update({
      is_admin: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      adminUpdatedBy: 'system',
      adminUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Successfully set admin status to TRUE for:', userData.name);
    console.log('👑 User', userData.email, 'is now an admin!');
    console.log('');
    console.log('🔐 Admin can now access:');
    console.log('  - /admin');
    console.log('  - /admin/input');
    console.log('  - /admin/edit');
    console.log('  - /admin/edit/:productId');
    
  } catch (error) {
    console.error('❌ Error setting admin status:', error);
  }
}

// Run the script
setAdminStatus()
  .then(() => {
    console.log('🏁 Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });