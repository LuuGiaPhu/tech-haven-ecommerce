const admin = require('firebase-admin');

let db = null;
let firebaseInitialized = false;

// Simple in-memory storage for development
const memoryStorage = {
    users: new Map(),
    nextUserId: 1
};

// Simple Firestore Mock for development
class SimpleFirestoreMock {
    collection(name) {
        return new SimpleCollectionMock(name);
    }
}

class SimpleCollectionMock {
    constructor(name) {
        this.name = name;
    }
    
    doc(id) {
        return new SimpleDocumentMock(this.name, id);
    }
    
    where(field, operator, value) {
        return new SimpleQueryMock(this.name, { field, operator, value });
    }
    
    orderBy(field, direction = 'asc') {
        return new SimpleQueryMock(this.name, null, { field, direction });
    }
}

class SimpleDocumentMock {
    constructor(collection, id) {
        this.collection = collection;
        this.id = id;
    }
    
    async get() {
        if (this.collection === 'users') {
            const user = memoryStorage.users.get(this.id);
            return {
                exists: !!user,
                data: () => user || {}
            };
        }
        return { exists: false };
    }
    
    async set(data) {
        if (this.collection === 'users') {
            memoryStorage.users.set(this.id, {
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`✅ Simple Mock: User ${this.id} saved to memory storage`);
            return true;
        }
        console.log(`✅ Simple Mock: Document ${this.id} set in ${this.collection}`);
        return true;
    }
    
    async update(data) {
        if (this.collection === 'users') {
            const existing = memoryStorage.users.get(this.id) || {};
            memoryStorage.users.set(this.id, {
                ...existing,
                ...data,
                updatedAt: new Date()
            });
            console.log(`✅ Simple Mock: User ${this.id} updated in memory storage`);
            return true;
        }
        return true;
    }
}

class SimpleQueryMock {
    constructor(collection, whereClause = null, orderClause = null) {
        this.collection = collection;
        this.whereClause = whereClause;
        this.orderClause = orderClause;
    }
    
    where(field, operator, value) {
        return new SimpleQueryMock(this.collection, { field, operator, value }, this.orderClause);
    }
    
    orderBy(field, direction = 'asc') {
        return new SimpleQueryMock(this.collection, this.whereClause, { field, direction });
    }
    
    limit(count) {
        return this;
    }
    
    async get() {
        if (this.collection === 'users') {
            const users = Array.from(memoryStorage.users.values());
            let filtered = users;
            
            if (this.whereClause) {
                const { field, operator, value } = this.whereClause;
                filtered = users.filter(user => {
                    switch (operator) {
                        case '==':
                            return user[field] === value;
                        case '!=':
                            return user[field] !== null && user[field] !== undefined;
                        default:
                            return true;
                    }
                });
            }
            
            if (this.orderClause) {
                const { field, direction } = this.orderClause;
                filtered.sort((a, b) => {
                    const aVal = a[field] || 0;
                    const bVal = b[field] || 0;
                    return direction === 'desc' ? bVal - aVal : aVal - bVal;
                });
            }
            
            return {
                empty: filtered.length === 0,
                docs: filtered.map((user, index) => ({
                    data: () => user
                }))
            };
        }
        
        return { empty: true, docs: [] };
    }
}

try {
    // Try to use actual Firebase Admin SDK first
    const fs = require('fs');
    const serviceAccountPaths = ['./serviceAccountKey.json', './service-account-key.json'];
    
    let useRealFirebase = false;
    for (const serviceAccountPath of serviceAccountPaths) {
        if (fs.existsSync(serviceAccountPath)) {
            try {
                const serviceAccount = require(serviceAccountPath);
                
                // Check if it's a real service account key (not dummy)
                if (serviceAccount.project_id && 
                    serviceAccount.private_key && 
                    !serviceAccount.private_key.includes('DUMMY') &&
                    serviceAccount.private_key.length > 500 &&
                    serviceAccount.client_email) {
                    
                    admin.initializeApp({
                        credential: admin.credential.cert(serviceAccount)
                    });
                    
                    db = admin.firestore();
                    firebaseInitialized = true;
                    useRealFirebase = true;
                    console.log('✅ Firebase Admin SDK initialized with real service account:', serviceAccountPath);
                    console.log('📊 Project ID:', serviceAccount.project_id);
                    console.log('📧 Service Email:', serviceAccount.client_email);
                    break;
                }
            } catch (error) {
                console.log(`⚠️ Failed to load ${serviceAccountPath}:`, error.message);
            }
        }
    }
    
    if (!useRealFirebase) {
        // Use simple mock Firebase for development
        db = new SimpleFirestoreMock();
        firebaseInitialized = true;
        console.log('✅ Simple Firebase Mock initialized for development');
        console.log('📝 User data will be saved to memory storage');
    }
    
} catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('🔄 Server will continue without Firebase');
    firebaseInitialized = false;
    db = null;
}

// Mock admin object for development
const mockAdmin = {
    firestore: {
        FieldValue: {
            serverTimestamp: () => new Date()
        }
    }
};

module.exports = {
    db,
    admin: admin.apps.length > 0 ? admin : mockAdmin,
    firebaseInitialized,
    // Export memory storage for debugging
    memoryStorage: process.env.NODE_ENV === 'development' ? memoryStorage : undefined
};
