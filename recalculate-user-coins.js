/**
 * Recalculate and update coin for users based on completed bills
 * This script will retroactively award coins for all completed orders
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

async function recalculateUserCoins() {
    console.log('🚀 Starting coin recalculation for all users...\n');

    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        
        if (usersSnapshot.empty) {
            console.log('⚠️ No users found in the database');
            return;
        }

        console.log(`📊 Found ${usersSnapshot.size} users\n`);

        let updatedCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            
            try {
                console.log(`\n👤 Processing user: ${userId} (${userData.email || 'No email'})`);
                console.log(`   Current coin balance: ${userData.coin || 0}`);

                // Get all completed bills for this user
                const billsSnapshot = await db.collection('bills')
                    .where('userId', '==', userId)
                    .where('status', '==', 'completed')
                    .get();

                if (billsSnapshot.empty) {
                    console.log(`   ⏭️  No completed bills found - skipping`);
                    skipCount++;
                    continue;
                }

                console.log(`   📦 Found ${billsSnapshot.size} completed bills`);

                // Calculate total coin earned (10% of all completed orders)
                let totalCoinEarned = 0;
                billsSnapshot.docs.forEach(billDoc => {
                    const billData = billDoc.data();
                    const orderAmount = billData.totalAmount || 0;
                    const coinFromOrder = Math.floor(orderAmount * 0.10);
                    totalCoinEarned += coinFromOrder;
                    
                    console.log(`   💰 Bill ${billDoc.id}: ${orderAmount.toLocaleString('vi-VN')} VNĐ → ${coinFromOrder.toLocaleString('vi-VN')} coin`);
                });

                console.log(`   ✅ Total coin to set: ${totalCoinEarned.toLocaleString('vi-VN')} coin`);

                // Update user's coin balance
                await userDoc.ref.update({
                    coin: totalCoinEarned,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                console.log(`   💾 Updated user ${userId} coin balance to ${totalCoinEarned}`);
                updatedCount++;

            } catch (error) {
                console.error(`   ❌ Error processing user ${userId}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ COIN RECALCULATION COMPLETED!');
        console.log('='.repeat(60));
        console.log(`📊 Summary:`);
        console.log(`   - Total users: ${usersSnapshot.size}`);
        console.log(`   - Updated: ${updatedCount}`);
        console.log(`   - Skipped (no completed bills): ${skipCount}`);
        console.log(`   - Errors: ${errorCount}`);
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Recalculation failed:', error);
        throw error;
    }
}

// Run recalculation
recalculateUserCoins()
    .then(() => {
        console.log('🎉 Coin recalculation finished!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Coin recalculation failed:', error);
        process.exit(1);
    });
