// User Management Service for Tech Haven
import { db, firebaseAvailable } from './firebase-config.js';
import { 
    collection, 
    doc, 
    addDoc, 
    setDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    serverTimestamp,
    updateDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// User Management Class
class UserManager {
    constructor() {
        this.usersCollection = 'users';
        this.nextUserId = 1;
        this.initialized = false;
    }

    // Initialize user manager
    async initialize() {
        if (!firebaseAvailable) {
            console.log('🔐 Firebase not available, using server-side user management');
            return;
        }

        try {
            // Get the highest user ID to continue sequence
            const usersRef = collection(db, this.usersCollection);
            const q = query(usersRef, orderBy('numericId', 'desc'));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const highestUser = snapshot.docs[0].data();
                this.nextUserId = (highestUser.numericId || 0) + 1;
            }
            
            this.initialized = true;
            console.log('✅ UserManager initialized, next ID:', this.nextUserId);
        } catch (error) {
            console.error('❌ Failed to initialize UserManager:', error);
        }
    }

    // Create or update user from Google OAuth
    async createOrUpdateGoogleUser(googleProfile) {
        if (!firebaseAvailable || !this.initialized) {
            throw new Error('UserManager not available or not initialized');
        }

        try {
            const userId = `google_${googleProfile.id}`;
            const userRef = doc(db, this.usersCollection, userId);
            const userSnap = await getDoc(userRef);

            const userData = {
                id: userId,
                googleId: googleProfile.id,
                name: googleProfile.name,
                email: googleProfile.email,
                photo: googleProfile.photo || '',
                provider: 'google',
                isGoogleUser: true,
                updatedAt: serverTimestamp()
            };

            if (userSnap.exists()) {
                // Update existing Google user
                await updateDoc(userRef, userData);
                console.log('✅ Google user updated:', googleProfile.name);
                return { ...userData, ...userSnap.data() };
            } else {
                // Create new Google user
                userData.createdAt = serverTimestamp();
                userData.numericId = null; // Google users don't get numeric IDs
                userData.role = 'customer';
                userData.status = 'active';
                
                await setDoc(userRef, userData);
                console.log('✅ New Google user created:', googleProfile.name);
                return userData;
            }
        } catch (error) {
            console.error('❌ Error managing Google user:', error);
            throw error;
        }
    }

    // Register new regular user
    async registerUser(userData) {
        if (!firebaseAvailable || !this.initialized) {
            throw new Error('UserManager not available or not initialized');
        }

        try {
            // Check if email already exists
            const existingUser = await this.getUserByEmail(userData.email);
            if (existingUser) {
                throw new Error('Email đã được sử dụng');
            }

            // Create user with auto-incrementing numeric ID
            const userId = `user_${this.nextUserId}`;
            const userRef = doc(db, this.usersCollection, userId);

            const newUser = {
                id: userId,
                numericId: this.nextUserId,
                name: userData.name,
                email: userData.email,
                password: userData.hashedPassword, // Should be hashed on server
                provider: 'local',
                isGoogleUser: false,
                role: 'customer',
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                photo: userData.photo || ''
            };

            await setDoc(userRef, newUser);
            this.nextUserId++;

            console.log('✅ New user registered:', userData.name);
            return newUser;
        } catch (error) {
            console.error('❌ Error registering user:', error);
            throw error;
        }
    }

    // Login regular user
    async loginUser(email, password) {
        if (!firebaseAvailable || !this.initialized) {
            throw new Error('UserManager not available or not initialized');
        }

        try {
            const user = await this.getUserByEmail(email);
            if (!user) {
                throw new Error('Email không tồn tại');
            }

            // In a real app, you'd verify the password hash
            // For now, we'll assume password verification is done on server
            console.log('✅ User login successful:', user.name);
            return user;
        } catch (error) {
            console.error('❌ Login error:', error);
            throw error;
        }
    }

    // Get user by email
    async getUserByEmail(email) {
        if (!firebaseAvailable || !this.initialized) {
            return null;
        }

        try {
            const usersRef = collection(db, this.usersCollection);
            const q = query(usersRef, where('email', '==', email));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return null;
            }

            return snapshot.docs[0].data();
        } catch (error) {
            console.error('❌ Error fetching user by email:', error);
            return null;
        }
    }

    // Get user by ID
    async getUserById(userId) {
        if (!firebaseAvailable || !this.initialized) {
            return null;
        }

        try {
            const userRef = doc(db, this.usersCollection, userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                return userSnap.data();
            }
            return null;
        } catch (error) {
            console.error('❌ Error fetching user by ID:', error);
            return null;
        }
    }

    // Update user profile
    async updateUserProfile(userId, updates) {
        if (!firebaseAvailable || !this.initialized) {
            throw new Error('UserManager not available or not initialized');
        }

        try {
            const userRef = doc(db, this.usersCollection, userId);
            await updateDoc(userRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });

            console.log('✅ User profile updated:', userId);
            return true;
        } catch (error) {
            console.error('❌ Error updating user profile:', error);
            throw error;
        }
    }

    // Get all users (admin only)
    async getAllUsers() {
        if (!firebaseAvailable || !this.initialized) {
            return [];
        }

        try {
            const usersRef = collection(db, this.usersCollection);
            const q = query(usersRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            const users = [];
            snapshot.forEach(doc => {
                users.push(doc.data());
            });

            return users;
        } catch (error) {
            console.error('❌ Error fetching all users:', error);
            return [];
        }
    }
}

// Create global instance
const userManager = new UserManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await userManager.initialize();
});

// Export for use in other modules
export { userManager };
export default userManager;