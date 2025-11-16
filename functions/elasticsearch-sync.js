/**
 * Elasticsearch Sync Service
 * Đồng bộ dữ liệu từ Firestore sang Elasticsearch
 */

const admin = require('firebase-admin');
const { getElasticsearchClient } = require('./elasticsearch-config');

const INDEX_NAME = 'products';

/**
 * Transform Firestore product to Elasticsearch document
 */
function transformProductForES(productId, productData) {
  // Create searchText field combining all searchable fields
  const searchableFields = [
    productData.name || '',
    productData.description || '',
    productData.category || '',
    productData.brand || '',
    (productData.tags || []).join(' ')
  ];
  
  return {
    id: productId,
    name: productData.name || '',
    description: productData.description || '',
    category: productData.category || '',
    brand: productData.brand || '',
    price: parseFloat(productData.price) || 0,
    originalPrice: parseFloat(productData.originalPrice) || parseFloat(productData.price) || 0,
    stock: parseInt(productData.stock) || 0,
    availability: productData.availability || 'in-stock',
    rating: parseFloat(productData.rating) || 0,
    reviewCount: parseInt(productData.reviewCount) || 0,
    image: productData.image || '',
    images: productData.images || [],
    specifications: productData.specifications || {},
    tags: productData.tags || [],
    isNew: productData.isNew || false,
    isBestSeller: productData.isBestSeller || false,
    isFeatured: productData.isFeatured || false,
    discount: parseFloat(productData.discount) || 0,
    createdAt: productData.createdAt?.toDate?.() || new Date(),
    updatedAt: productData.updatedAt?.toDate?.() || new Date(),
    searchText: searchableFields.join(' ').toLowerCase()
  };
}

/**
 * Index a single product to Elasticsearch
 */
async function indexProduct(productId, productData) {
  const client = getElasticsearchClient();
  if (!client) {
    console.error('❌ Elasticsearch client not available');
    return false;
  }
  
  try {
    const esDoc = transformProductForES(productId, productData);
    
    await client.index({
      index: INDEX_NAME,
      id: productId,
      document: esDoc
    });
    
    console.log(`✅ Indexed product: ${productId} - ${esDoc.name}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to index product ${productId}:`, error.message);
    return false;
  }
}

/**
 * Update a product in Elasticsearch
 */
async function updateProduct(productId, productData) {
  const client = getElasticsearchClient();
  if (!client) return false;
  
  try {
    const esDoc = transformProductForES(productId, productData);
    
    await client.update({
      index: INDEX_NAME,
      id: productId,
      doc: esDoc,
      doc_as_upsert: true
    });
    
    console.log(`✅ Updated product in ES: ${productId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update product ${productId}:`, error.message);
    return false;
  }
}

/**
 * Delete a product from Elasticsearch
 */
async function deleteProduct(productId) {
  const client = getElasticsearchClient();
  if (!client) return false;
  
  try {
    await client.delete({
      index: INDEX_NAME,
      id: productId
    });
    
    console.log(`✅ Deleted product from ES: ${productId}`);
    return true;
  } catch (error) {
    if (error.meta?.statusCode === 404) {
      console.log(`ℹ️ Product ${productId} not found in ES (already deleted)`);
      return true;
    }
    console.error(`❌ Failed to delete product ${productId}:`, error.message);
    return false;
  }
}

/**
 * Bulk index multiple products
 */
async function bulkIndexProducts(products) {
  const client = getElasticsearchClient();
  if (!client) {
    console.error('❌ Elasticsearch client not available');
    return { success: 0, failed: 0 };
  }
  
  if (!products || products.length === 0) {
    console.log('ℹ️ No products to index');
    return { success: 0, failed: 0 };
  }
  
  try {
    const operations = products.flatMap(({ id, data }) => [
      { index: { _index: INDEX_NAME, _id: id } },
      transformProductForES(id, data)
    ]);
    
    const result = await client.bulk({
      refresh: true,
      operations
    });
    
    const successCount = result.items.filter(item => !item.index?.error).length;
    const failedCount = result.items.filter(item => item.index?.error).length;
    
    if (failedCount > 0) {
      console.error(`⚠️ Bulk index: ${successCount} succeeded, ${failedCount} failed`);
      result.items.forEach(item => {
        if (item.index?.error) {
          console.error(`  - Error indexing ${item.index._id}:`, item.index.error);
        }
      });
    } else {
      console.log(`✅ Bulk indexed ${successCount} products successfully`);
    }
    
    return { success: successCount, failed: failedCount };
  } catch (error) {
    console.error('❌ Bulk index failed:', error.message);
    return { success: 0, failed: products.length };
  }
}

/**
 * Sync all products from Firestore to Elasticsearch
 */
async function syncAllProducts() {
  console.log('🔄 Starting full product sync from Firestore to Elasticsearch...');
  
  const db = admin.firestore();
  const client = getElasticsearchClient();
  
  if (!client) {
    console.error('❌ Elasticsearch client not available');
    return { success: false, error: 'Client not initialized' };
  }
  
  try {
    // Fetch all products from Firestore
    const productsSnapshot = await db.collection('products').get();
    
    if (productsSnapshot.empty) {
      console.log('ℹ️ No products found in Firestore');
      return { success: true, count: 0 };
    }
    
    console.log(`📦 Found ${productsSnapshot.size} products in Firestore`);
    
    // Prepare products for bulk indexing
    const products = [];
    productsSnapshot.forEach(doc => {
      products.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    // Bulk index in batches of 500
    const batchSize = 500;
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      console.log(`📤 Indexing batch ${Math.floor(i / batchSize) + 1} (${batch.length} products)...`);
      
      const result = await bulkIndexProducts(batch);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }
    
    console.log(`✅ Sync completed: ${totalSuccess} succeeded, ${totalFailed} failed`);
    
    return {
      success: true,
      totalProducts: products.length,
      successCount: totalSuccess,
      failedCount: totalFailed
    };
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Setup Firestore listeners for real-time sync
 */
function setupFirestoreListeners() {
  console.log('🎧 Setting up Firestore listeners for real-time sync...');
  
  const db = admin.firestore();
  
  // Listen to product changes
  db.collection('products').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      const productId = change.doc.id;
      const productData = change.doc.data();
      
      if (change.type === 'added' || change.type === 'modified') {
        // Index or update product
        updateProduct(productId, productData)
          .catch(err => console.error('❌ Real-time sync error:', err));
      } else if (change.type === 'removed') {
        // Delete product
        deleteProduct(productId)
          .catch(err => console.error('❌ Real-time delete error:', err));
      }
    });
  }, error => {
    console.error('❌ Firestore listener error:', error);
  });
  
  console.log('✅ Firestore listeners active');
}

module.exports = {
  indexProduct,
  updateProduct,
  deleteProduct,
  bulkIndexProducts,
  syncAllProducts,
  setupFirestoreListeners
};
