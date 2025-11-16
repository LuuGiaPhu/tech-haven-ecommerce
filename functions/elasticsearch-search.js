/**
 * Elasticsearch Search Service
 * Advanced search functionality with Elasticsearch
 */

const { getElasticsearchClient } = require('./elasticsearch-config');

const INDEX_NAME = 'products';

/**
 * Search products with advanced features
 * @param {string} query - Search query
 * @param {Object} options - Search options (filters, pagination, sorting)
 */
async function searchProducts(query, options = {}) {
  const client = getElasticsearchClient();
  if (!client) {
    const err = 'Elasticsearch client not available';
    console.error('❌', err);
    throw new Error(err);
  }
  
  const {
    from = 0,
    size = 20,
    categories = [],
    brands = [],
    minPrice = null,
    maxPrice = null,
    inStock = false,
    sortBy = '_score',
    sortOrder = 'desc',
    aggregations = true
  } = options;
  
  try {
    // Build search query
    const must = [];
    const filter = [];
    
    // Main search query
    if (query && query.trim()) {
      must.push({
        multi_match: {
          query: query,
          fields: [
            'name^3',           // Boost name field
            'name.autocomplete^2',
            'brand^2',
            'category.text^1.5',
            'description',
            'searchText'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',  // Auto typo tolerance
          prefix_length: 2
        }
      });
    } else {
      // Match all if no query
      must.push({
        match_all: {}
      });
    }
    
    // Category filter
    if (categories && categories.length > 0) {
      filter.push({
        terms: { category: categories }
      });
    }
    
    // Brand filter
    if (brands && brands.length > 0) {
      filter.push({
        terms: { brand: brands }
      });
    }
    
    // Price range filter
    if (minPrice !== null || maxPrice !== null) {
      const priceRange = {};
      if (minPrice !== null) priceRange.gte = minPrice;
      if (maxPrice !== null) priceRange.lte = maxPrice;
      
      filter.push({
        range: { price: priceRange }
      });
    }
    
    // Stock filter
    if (inStock) {
      filter.push({
        range: { stock: { gt: 0 } }
      });
      filter.push({
        term: { availability: 'in-stock' }
      });
    }
    
    // Build sort
    const sort = [];
    if (sortBy === '_score') {
      sort.push({ _score: sortOrder });
    } else if (sortBy === 'price') {
      sort.push({ price: sortOrder });
    } else if (sortBy === 'name') {
      sort.push({ 'name.keyword': sortOrder });
    } else if (sortBy === 'createdAt') {
      sort.push({ createdAt: sortOrder });
    } else if (sortBy === 'popularity') {
      sort.push({ reviewCount: 'desc' }, { rating: 'desc' });
    }
    
    // Build aggregations for faceted search
    const aggs = aggregations ? {
      categories: {
        terms: {
          field: 'category',
          size: 20
        }
      },
      brands: {
        terms: {
          field: 'brand',
          size: 30
        }
      },
      price_ranges: {
        range: {
          field: 'price',
          ranges: [
            { key: 'Dưới 5 triệu', to: 5000000 },
            { key: '5-10 triệu', from: 5000000, to: 10000000 },
            { key: '10-20 triệu', from: 10000000, to: 20000000 },
            { key: '20-30 triệu', from: 20000000, to: 30000000 },
            { key: 'Trên 30 triệu', from: 30000000 }
          ]
        }
      },
      avg_price: {
        avg: { field: 'price' }
      },
      in_stock_count: {
        filter: {
          range: { stock: { gt: 0 } }
        }
      }
    } : undefined;
    
    // Execute search
    const result = await client.search({
      index: INDEX_NAME,
      from,
      size,
      body: {
        query: {
          bool: {
            must,
            filter
          }
        },
        sort,
        aggs,
        highlight: {
          fields: {
            name: {},
            description: {}
          },
          pre_tags: ['<mark>'],
          post_tags: ['</mark>']
        }
      }
    });
    
    // Process results
    const hits = result.hits.hits.map(hit => ({
      id: hit._id,
      score: hit._score,
      ...hit._source,
      highlights: hit.highlight
    }));
    
    const response = {
      success: true,
      hits,
      total: result.hits.total.value,
      took: result.took,
      maxScore: result.hits.max_score
    };
    
    // Add aggregations if enabled
    if (aggregations && result.aggregations) {
      response.facets = {
        categories: result.aggregations.categories.buckets,
        brands: result.aggregations.brands.buckets,
        priceRanges: result.aggregations.price_ranges.buckets,
        avgPrice: result.aggregations.avg_price.value,
        inStockCount: result.aggregations.in_stock_count.doc_count
      };
    }
    
    console.log(`🔍 Search completed: "${query}" - ${hits.length} results (${result.took}ms)`);
    
    return response;
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    return {
      success: false,
      error: error.message,
      hits: [],
      total: 0
    };
  }
}

/**
 * Autocomplete suggestions
 */
async function autocomplete(query, limit = 10) {
  const client = getElasticsearchClient();
  if (!client) {
    return { success: false, suggestions: [] };
  }
  
  if (!query || query.trim().length < 2) {
    return { success: true, suggestions: [] };
  }
  
  try {
    const result = await client.search({
      index: INDEX_NAME,
      size: limit,
      body: {
        query: {
          bool: {
            should: [
              {
                match: {
                  'name.autocomplete': {
                    query: query,
                    boost: 3
                  }
                }
              },
              {
                match: {
                  brand: {
                    query: query,
                    boost: 2
                  }
                }
              },
              {
                match: {
                  'category.text': {
                    query: query,
                    boost: 1.5
                  }
                }
              }
            ]
          }
        },
        _source: ['id', 'name', 'category', 'brand', 'price', 'image']
      }
    });
    
    const suggestions = result.hits.hits.map(hit => ({
      id: hit._id,
      name: hit._source.name,
      category: hit._source.category,
      brand: hit._source.brand,
      price: hit._source.price,
      image: hit._source.image,
      score: hit._score
    }));
    
    return {
      success: true,
      suggestions
    };
  } catch (error) {
    console.error('❌ Autocomplete failed:', error.message);
    return {
      success: false,
      error: error.message,
      suggestions: []
    };
  }
}

/**
 * Similar products recommendation
 */
async function findSimilarProducts(productId, limit = 6) {
  const client = getElasticsearchClient();
  if (!client) {
    return { success: false, products: [] };
  }
  
  try {
    // Get the source product
    const sourceProduct = await client.get({
      index: INDEX_NAME,
      id: productId
    });
    
    const source = sourceProduct._source;
    
    // Find similar products
    const result = await client.search({
      index: INDEX_NAME,
      size: limit + 1, // +1 because we'll exclude the source product
      body: {
        query: {
          bool: {
            should: [
              {
                match: {
                  category: {
                    query: source.category,
                    boost: 3
                  }
                }
              },
              {
                match: {
                  brand: {
                    query: source.brand,
                    boost: 2
                  }
                }
              },
              {
                more_like_this: {
                  fields: ['name', 'description', 'tags'],
                  like: [
                    {
                      _index: INDEX_NAME,
                      _id: productId
                    }
                  ],
                  min_term_freq: 1,
                  min_doc_freq: 1
                }
              }
            ],
            must_not: [
              { term: { id: productId } } // Exclude source product
            ]
          }
        }
      }
    });
    
    const products = result.hits.hits.map(hit => ({
      id: hit._id,
      ...hit._source,
      score: hit._score
    }));
    
    return {
      success: true,
      products
    };
  } catch (error) {
    console.error('❌ Similar products search failed:', error.message);
    return {
      success: false,
      error: error.message,
      products: []
    };
  }
}

/**
 * Get popular search terms
 */
async function getPopularSearchTerms(limit = 10) {
  const client = getElasticsearchClient();
  if (!client) {
    return { success: false, terms: [] };
  }
  
  try {
    const result = await client.search({
      index: INDEX_NAME,
      size: 0,
      body: {
        aggs: {
          popular_categories: {
            terms: {
              field: 'category',
              size: limit
            }
          },
          popular_brands: {
            terms: {
              field: 'brand',
              size: limit
            }
          }
        }
      }
    });
    
    return {
      success: true,
      categories: result.aggregations.popular_categories.buckets,
      brands: result.aggregations.popular_brands.buckets
    };
  } catch (error) {
    console.error('❌ Popular terms failed:', error.message);
    return {
      success: false,
      terms: []
    };
  }
}

module.exports = {
  searchProducts,
  autocomplete,
  findSimilarProducts,
  getPopularSearchTerms
};
