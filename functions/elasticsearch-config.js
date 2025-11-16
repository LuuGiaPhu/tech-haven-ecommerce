/**
 * Elasticsearch Configuration
 * Cấu hình kết nối và quản lý Elasticsearch cho Tech Haven
 */

const { Client } = require('@elastic/elasticsearch');

// Elasticsearch connection configuration
const ELASTICSEARCH_CONFIG = {
  // Local development
  local: {
    node: 'http://localhost:9200',
    auth: {
      username: 'elastic',
      password: 'changeme' // Change this in production
    }
  },
  
  // Production (Elastic Cloud or self-hosted)
  production: {
    // Support both Cloud ID and direct node URL
    cloud: process.env.ELASTICSEARCH_CLOUD_ID ? {
      id: process.env.ELASTICSEARCH_CLOUD_ID
    } : undefined,
    node: !process.env.ELASTICSEARCH_CLOUD_ID && process.env.ELASTICSEARCH_NODE ? process.env.ELASTICSEARCH_NODE : undefined,
    auth: process.env.ELASTICSEARCH_API_KEY ? {
      apiKey: process.env.ELASTICSEARCH_API_KEY
    } : undefined
  }
};

// Determine environment
// Use Elastic Cloud if ELASTICSEARCH_NODE is set, regardless of NODE_ENV
const useElasticCloud = !!process.env.ELASTICSEARCH_NODE;
const isProduction = process.env.NODE_ENV === 'production' || useElasticCloud;
const config = isProduction ? ELASTICSEARCH_CONFIG.production : ELASTICSEARCH_CONFIG.local;

// Create Elasticsearch client
let esClient = null;

/**
 * Initialize Elasticsearch client
 */
function initializeElasticsearch() {
  try {
    // Create client with appropriate config
    if (isProduction) {
      // Production: Use Cloud ID or direct node URL
      const clientConfig = {};
      
      if (config.cloud && config.cloud.id) {
        clientConfig.cloud = config.cloud;
        console.log('🔗 Connecting to Elasticsearch Cloud (Cloud ID)...');
      } else if (config.node) {
        clientConfig.node = config.node;
        // Disable sniffing for Serverless
        clientConfig.sniffOnStart = false;
        clientConfig.sniffOnConnectionFault = false;
        console.log('🔗 Connecting to Elasticsearch Serverless:', config.node);
      } else {
        console.error('❌ No Elasticsearch connection config found');
        return null;
      }
      
      // Add auth if available
      if (config.auth) {
        clientConfig.auth = config.auth;
      }
      
      // Add SSL/TLS config for HTTPS
      clientConfig.tls = {
        rejectUnauthorized: true
      };
      
      esClient = new Client(clientConfig);
      console.log('✅ Elasticsearch client initialized (Production/Serverless)');
    } else {
      // Local development
      esClient = new Client({
        node: config.node,
        auth: config.auth
      });
      console.log('✅ Elasticsearch client initialized (Local Development)');
    }
    
    return esClient;
  } catch (error) {
    console.error('❌ Failed to initialize Elasticsearch client:', error);
    return null;
  }
}

/**
 * Get Elasticsearch client instance
 */
function getElasticsearchClient() {
  if (!esClient) {
    esClient = initializeElasticsearch();
  }
  return esClient;
}

/**
 * Check Elasticsearch connection
 */
async function checkElasticsearchConnection() {
  try {
    const client = getElasticsearchClient();
    if (!client) {
      console.error('❌ Client not initialized');
      return { connected: false, error: 'Client not initialized' };
    }
    
    console.log('🔍 Testing Elasticsearch connection...');
    
    // Use ping instead of cluster.health for Serverless compatibility
    const pingResult = await client.ping();
    
    if (pingResult) {
      console.log('✅ Elasticsearch connected successfully!');
      return {
        connected: true,
        status: 'available',
        serverless: true
      };
    } else {
      console.error('❌ Ping failed');
      return { connected: false, error: 'Ping failed' };
    }
  } catch (error) {
    console.error('❌ Elasticsearch connection check failed:');
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    if (error.meta) {
      console.error('   Status code:', error.meta.statusCode);
      console.error('   Error body:', JSON.stringify(error.meta.body, null, 2));
    }
    return {
      connected: false,
      error: error.message
    };
  }
}

/**
 * Create products index with optimized settings
 */
async function createProductsIndex() {
  const client = getElasticsearchClient();
  if (!client) {
    console.error('❌ Elasticsearch client not available');
    return false;
  }
  
  const indexName = 'products';
  
  try {
    // Check if index already exists
    const exists = await client.indices.exists({ index: indexName });
    
    if (exists) {
      console.log(`ℹ️ Index '${indexName}' already exists`);
      return true;
    }
    
    // Create index with mappings and settings (simplified for Serverless)
    await client.indices.create({
      index: indexName,
      body: {
        settings: {
          // Serverless doesn't support shards/replicas config
          analysis: {
            analyzer: {
              vietnamese_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding']
              },
              autocomplete_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding', 'autocomplete_filter']
              },
              autocomplete_search_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding']
              }
            },
            filter: {
              autocomplete_filter: {
                type: 'edge_ngram',
                min_gram: 2,
                max_gram: 20
              }
            }
          }
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: {
              type: 'text',
              analyzer: 'vietnamese_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                autocomplete: {
                  type: 'text',
                  analyzer: 'autocomplete_analyzer',
                  search_analyzer: 'autocomplete_search_analyzer'
                }
              }
            },
            description: {
              type: 'text',
              analyzer: 'vietnamese_analyzer'
            },
            category: {
              type: 'keyword',
              fields: {
                text: {
                  type: 'text',
                  analyzer: 'vietnamese_analyzer'
                }
              }
            },
            brand: {
              type: 'keyword',
              fields: {
                text: {
                  type: 'text',
                  analyzer: 'vietnamese_analyzer'
                }
              }
            },
            price: { type: 'double' },
            originalPrice: { type: 'double' },
            stock: { type: 'integer' },
            availability: { type: 'keyword' },
            rating: { type: 'float' },
            reviewCount: { type: 'integer' },
            image: { type: 'keyword', index: false },
            images: { type: 'keyword', index: false },
            specifications: { type: 'object', enabled: false },
            tags: { type: 'keyword' },
            isNew: { type: 'boolean' },
            isBestSeller: { type: 'boolean' },
            isFeatured: { type: 'boolean' },
            discount: { type: 'float' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            // Additional search-optimized fields
            searchText: {
              type: 'text',
              analyzer: 'vietnamese_analyzer'
            }
          }
        }
      }
    });
    
    console.log(`✅ Created index '${indexName}' with Vietnamese language support`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create index '${indexName}':`, error.message);
    return false;
  }
}

/**
 * Delete products index
 */
async function deleteProductsIndex() {
  const client = getElasticsearchClient();
  if (!client) return false;
  
  const indexName = 'products';
  
  try {
    const exists = await client.indices.exists({ index: indexName });
    
    if (!exists) {
      console.log(`ℹ️ Index '${indexName}' does not exist`);
      return true;
    }
    
    await client.indices.delete({ index: indexName });
    console.log(`✅ Deleted index '${indexName}'`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete index '${indexName}':`, error.message);
    return false;
  }
}

module.exports = {
  initializeElasticsearch,
  getElasticsearchClient,
  checkElasticsearchConnection,
  createProductsIndex,
  deleteProductsIndex
};
