// Firebase Services for Tech Haven E-commerce
import { auth, db, storage } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from "firebase/auth";
import { 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit 
} from "firebase/firestore";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject 
} from "firebase/storage";

// =====================================
// AUTHENTICATION SERVICES
// =====================================

// Register new user
export async function registerUser(email, password, displayName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update user profile
        await updateProfile(user, {
            displayName: displayName
        });
        
        // Create user document in Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: email,
            displayName: displayName,
            createdAt: new Date().toISOString(),
            role: 'customer'
        });
        
        console.log('User registered successfully:', user.uid);
        return { success: true, user: user };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: error.message };
    }
}

// Login user
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('User logged in successfully:', user.uid);
        return { success: true, user: user };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

// Logout user
export async function logoutUser() {
    try {
        await signOut(auth);
        console.log('User logged out successfully');
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

// Monitor authentication state
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// =====================================
// PRODUCT SERVICES
// =====================================

// Get all products
export async function getAllProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const products = [];
        querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('Products fetched:', products.length);
        return { success: true, products: products };
    } catch (error) {
        console.error('Error fetching products:', error);
        return { success: false, error: error.message };
    }
}

// Add new product (Admin only)
export async function addProduct(productData) {
    try {
        const docRef = await addDoc(collection(db, "products"), {
            ...productData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        console.log('Product added with ID:', docRef.id);
        return { success: true, productId: docRef.id };
    } catch (error) {
        console.error('Error adding product:', error);
        return { success: false, error: error.message };
    }
}

// Update product (Admin only)
export async function updateProduct(productId, productData) {
    try {
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, {
            ...productData,
            updatedAt: new Date().toISOString()
        });
        
        console.log('Product updated:', productId);
        return { success: true };
    } catch (error) {
        console.error('Error updating product:', error);
        return { success: false, error: error.message };
    }
}

// Delete product (Admin only)
export async function deleteProduct(productId) {
    try {
        await deleteDoc(doc(db, "products", productId));
        console.log('Product deleted:', productId);
        return { success: true };
    } catch (error) {
        console.error('Error deleting product:', error);
        return { success: false, error: error.message };
    }
}

// =====================================
// ORDER SERVICES
// =====================================

// Create new order
export async function createOrder(orderData) {
    try {
        const docRef = await addDoc(collection(db, "orders"), {
            ...orderData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        console.log('Order created with ID:', docRef.id);
        return { success: true, orderId: docRef.id };
    } catch (error) {
        console.error('Error creating order:', error);
        return { success: false, error: error.message };
    }
}

// Get user orders
export async function getUserOrders(userId) {
    try {
        const q = query(
            collection(db, "orders"), 
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('User orders fetched:', orders.length);
        return { success: true, orders: orders };
    } catch (error) {
        console.error('Error fetching user orders:', error);
        return { success: false, error: error.message };
    }
}

// =====================================
// FILE UPLOAD SERVICES
// =====================================

// Upload image to Firebase Storage
export async function uploadImage(file, folder = 'products') {
    try {
        const timestamp = Date.now();
        const filename = `${folder}/${timestamp}_${file.name}`;
        const storageRef = ref(storage, filename);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log('Image uploaded successfully:', downloadURL);
        return { success: true, url: downloadURL, path: filename };
    } catch (error) {
        console.error('Error uploading image:', error);
        return { success: false, error: error.message };
    }
}

// Delete image from Firebase Storage
export async function deleteImage(imagePath) {
    try {
        const imageRef = ref(storage, imagePath);
        await deleteObject(imageRef);
        
        console.log('Image deleted successfully:', imagePath);
        return { success: true };
    } catch (error) {
        console.error('Error deleting image:', error);
        return { success: false, error: error.message };
    }
}

// =====================================
// UTILITY FUNCTIONS
// =====================================

// Get current user
export function getCurrentUser() {
    return auth.currentUser;
}

// Check if user is admin
export async function isUserAdmin(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            return userData.role === 'admin';
        }
        return false;
    } catch (error) {
        console.error('Error checking user role:', error);
        return false;
    }
}

console.log('Firebase services loaded successfully');