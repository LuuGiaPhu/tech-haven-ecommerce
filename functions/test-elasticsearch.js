/**
 * Elasticsearch Test Script
 * Script để test và debug Elasticsearch integration
 */

const {
  initializeElasticsearch,
  checkElasticsearchConnection,
  createProductsIndex,
  deleteProductsIndex
} = require('./elasticsearch-config');

const {
  syncAllProducts,
  indexProduct,
  updateProduct,
  deleteProduct
} = require('./elasticsearch-sync');

const {
  searchProducts,
  autocomplete,
  findSimilarProducts,
  getPopularSearchTerms
} = require('./elasticsearch-search');

// Sample product data for testing
const sampleProduct = {
  name: 'Dell XPS 15 9520',
  description: 'Laptop cao cấp với màn hình 15.6" 4K OLED, CPU Intel Core i7-12700H, RAM 32GB, SSD 1TB',
  category: 'Laptop',
  brand: 'Dell',
  price: 45000000,
  originalPrice: 50000000,
  stock: 10,
  availability: 'in-stock',
  rating: 4.8,
  reviewCount: 125,
  image: 'https://example.com/dell-xps-15.jpg',
  images: ['image1.jpg', 'image2.jpg'],
  tags: ['laptop', 'gaming', 'cao cấp', 'dell'],
  isNew: true,
  isBestSeller: true,
  isFeatured: true,
  discount: 10,
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * Test Elasticsearch connection
 */
async function testConnection() {
  console.log('\n🔍 Testing Elasticsearch connection...');
  
  const client = initializeElasticsearch();
  if (!client) {
    console.error('❌ Failed to initialize client');
    return false;
  }
  
  const health = await checkElasticsearchConnection();
  if (health.connected) {
    console.log('✅ Connection successful!');
    console.log('   Status:', health.status);
    console.log('   Cluster:', health.cluster_name);
    console.log('   Nodes:', health.number_of_nodes);
    return true;
  } else {
    console.error('❌ Connection failed:', health.error);
    return false;
  }
}

/**
 * Test index creation
 */
async function testIndexCreation() {
  console.log('\n📦 Testing index creation...');
  
  // Delete existing index
  console.log('Deleting existing index...');
  await deleteProductsIndex();
  
  // Create new index
  console.log('Creating new index...');
  const created = await createProductsIndex();
  
  if (created) {
    console.log('✅ Index created successfully!');
    return true;
  } else {
    console.error('❌ Index creation failed');
    return false;
  }
}

/**
 * Test product indexing
 */
async function testProductIndexing() {
  console.log('\n📝 Testing product indexing...');
  
  const productId = 'test-product-' + Date.now();
  const success = await indexProduct(productId, sampleProduct);
  
  if (success) {
    console.log('✅ Product indexed successfully!');
    console.log('   Product ID:', productId);
    return productId;
  } else {
    console.error('❌ Product indexing failed');
    return null;
  }
}

/**
 * Test product update
 */
async function testProductUpdate(productId) {
  console.log('\n🔄 Testing product update...');
  
  const updatedProduct = {
    ...sampleProduct,
    name: 'Dell XPS 15 9520 - Updated',
    price: 42000000,
    stock: 5
  };
  
  const success = await updateProduct(productId, updatedProduct);
  
  if (success) {
    console.log('✅ Product updated successfully!');
    return true;
  } else {
    console.error('❌ Product update failed');
    return false;
  }
}

/**
 * Test product search
 */
async function testSearch() {
  console.log('\n🔍 Testing product search...');
  
  // Test 1: Basic search
  console.log('\n1️⃣ Basic search for "laptop"...');
  const result1 = await searchProducts('laptop', { size: 5 });
  
  if (result1.success) {
    console.log(`✅ Found ${result1.total} products (showing ${result1.hits.length})`);
    console.log(`   Search took: ${result1.took}ms`);
    if (result1.hits.length > 0) {
      console.log('   Top result:', result1.hits[0].name);
    }
  } else {
    console.error('❌ Search failed:', result1.error);
  }
  
  // Test 2: Search with filters
  console.log('\n2️⃣ Search with category filter...');
  const result2 = await searchProducts('', {
    categories: ['Laptop'],
    size: 5
  });
  
  if (result2.success) {
    console.log(`✅ Found ${result2.total} laptops`);
  } else {
    console.error('❌ Filtered search failed:', result2.error);
  }
  
  // Test 3: Search with price range
  console.log('\n3️⃣ Search with price range...');
  const result3 = await searchProducts('', {
    minPrice: 10000000,
    maxPrice: 50000000,
    size: 5
  });
  
  if (result3.success) {
    console.log(`✅ Found ${result3.total} products in price range`);
  } else {
    console.error('❌ Price range search failed:', result3.error);
  }
  
  // Test 4: Fuzzy search (typo tolerance)
  console.log('\n4️⃣ Fuzzy search with typo: "labtop" (should find "laptop")...');
  const result4 = await searchProducts('labtop', { size: 5 });
  
  if (result4.success) {
    console.log(`✅ Found ${result4.total} products with typo tolerance`);
    if (result4.hits.length > 0) {
      console.log('   Top result:', result4.hits[0].name);
    }
  } else {
    console.error('❌ Fuzzy search failed:', result4.error);
  }
}

/**
 * Test autocomplete
 */
async function testAutocomplete() {
  console.log('\n⌨️ Testing autocomplete...');
  
  const queries = ['lap', 'dell', 'gam'];
  
  for (const query of queries) {
    console.log(`\nAutocomplete for "${query}"...`);
    const result = await autocomplete(query, 5);
    
    if (result.success) {
      console.log(`✅ Found ${result.suggestions.length} suggestions`);
      result.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion.name} (${suggestion.category})`);
      });
    } else {
      console.error('❌ Autocomplete failed:', result.error);
    }
  }
}

/**
 * Test similar products
 */
async function testSimilarProducts(productId) {
  console.log('\n🔗 Testing similar products...');
  
  const result = await findSimilarProducts(productId, 5);
  
  if (result.success) {
    console.log(`✅ Found ${result.products.length} similar products`);
    result.products.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (score: ${product.score.toFixed(2)})`);
    });
  } else {
    console.error('❌ Similar products search failed:', result.error);
  }
}

/**
 * Test popular terms
 */
async function testPopularTerms() {
  console.log('\n🔥 Testing popular search terms...');
  
  const result = await getPopularSearchTerms(5);
  
  if (result.success) {
    console.log('✅ Popular categories:');
    result.categories.forEach((cat, index) => {
      console.log(`   ${index + 1}. ${cat.key} (${cat.doc_count} products)`);
    });
    
    console.log('\n✅ Popular brands:');
    result.brands.forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand.key} (${brand.doc_count} products)`);
    });
  } else {
    console.error('❌ Popular terms failed:', result.error);
  }
}

/**
 * Test product deletion
 */
async function testProductDeletion(productId) {
  console.log('\n🗑️ Testing product deletion...');
  
  const success = await deleteProduct(productId);
  
  if (success) {
    console.log('✅ Product deleted successfully!');
    return true;
  } else {
    console.error('❌ Product deletion failed');
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  Elasticsearch Integration Test Suite            ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  try {
    // Test 1: Connection
    const connected = await testConnection();
    if (!connected) {
      console.error('\n❌ Cannot proceed without Elasticsearch connection');
      console.log('\n💡 Make sure Elasticsearch is running:');
      console.log('   docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.11.0');
      return;
    }
    
    // Test 2: Index creation
    const indexCreated = await testIndexCreation();
    if (!indexCreated) {
      console.error('\n❌ Cannot proceed without index');
      return;
    }
    
    // Test 3: Product indexing
    const productId = await testProductIndexing();
    if (!productId) {
      console.error('\n❌ Cannot proceed without indexed product');
      return;
    }
    
    // Wait a moment for indexing to complete
    console.log('\n⏳ Waiting for index refresh...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 4: Product update
    await testProductUpdate(productId);
    
    // Wait for update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 5: Search
    await testSearch();
    
    // Test 6: Autocomplete
    await testAutocomplete();
    
    // Test 7: Similar products
    await testSimilarProducts(productId);
    
    // Test 8: Popular terms
    await testPopularTerms();
    
    // Test 9: Product deletion
    await testProductDeletion(productId);
    
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║  ✅ All tests completed!                          ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    
    console.log('\n📝 Next steps:');
    console.log('   1. Sync your Firestore products: curl -X POST http://localhost:3000/api/elasticsearch/sync');
    console.log('   2. Test search API: curl "http://localhost:3000/api/search?q=laptop"');
    console.log('   3. Check the client-side search is working');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
  }
}

// Run tests if executed directly
if (require.main === module) {
  console.log('Starting Elasticsearch tests...\n');
  runAllTests().then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
  });
}

module.exports = {
  testConnection,
  testIndexCreation,
  testProductIndexing,
  testProductUpdate,
  testSearch,
  testAutocomplete,
  testSimilarProducts,
  testPopularTerms,
  testProductDeletion,
  runAllTests
};
