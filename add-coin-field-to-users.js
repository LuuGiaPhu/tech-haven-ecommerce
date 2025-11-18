/**
 * Migration Script: Add coin field to all users
 * Run this script once to add the coin field to existing users
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function addCoinFieldToUsers() {
    console.log('🚀 Starting migration: Adding coin field to all users...\n');

    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        
        if (usersSnapshot.empty) {
            console.log('⚠️ No users found in the database');
            return;
        }

        console.log(`📊 Found ${usersSnapshot.size} users\n`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // Batch update
        const batch = db.batch();
        let batchCount = 0;
        const BATCH_SIZE = 500; // Firestore batch limit

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const userId = doc.id;

            // Check if coin field already exists
            if (userData.hasOwnProperty('coin')) {
                console.log(`⏭️  Skipping user ${userId} - coin field already exists (${userData.coin} coin)`);
                skipCount++;
                continue;
            }

            // Add coin field with value 0
            batch.update(doc.ref, {
                coin: 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            batchCount++;
            console.log(`✅ Queued update for user ${userId} (${userData.email || 'No email'})`);

            // Commit batch if we reach the limit
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`\n💾 Committed batch of ${batchCount} updates\n`);
                successCount += batchCount;
                batchCount = 0;
            }
        }

        // Commit remaining updates
        if (batchCount > 0) {
            await batch.commit();
            console.log(`\n💾 Committed final batch of ${batchCount} updates\n`);
            successCount += batchCount;
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log(`📊 Summary:`);
        console.log(`   - Total users: ${usersSnapshot.size}`);
        console.log(`   - Updated: ${successCount}`);
        console.log(`   - Skipped (already have coin): ${skipCount}`);
        console.log(`   - Errors: ${errorCount}`);
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration
addCoinFieldToUsers()
    .then(() => {
        console.log('🎉 Migration script finished!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Migration script failed:', error);
        process.exit(1);
    });
