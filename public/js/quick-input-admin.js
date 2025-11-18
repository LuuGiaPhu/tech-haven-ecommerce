// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDpzgsxZ1Jfs5hWAfS-gDbYfgkVte_jXoA",
  authDomain: "tech-haven-5368b.firebaseapp.com",
  projectId: "tech-haven-5368b",
  storageBucket: "tech-haven-5368b.firebasestorage.app",
  messagingSenderId: "442337591630",
  appId: "1:442337591630:web:7005525c7664f513a55e1f",
  measurementId: "G-N54V96PG4M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('🔥 Firebase initialized in quick-input-admin.js');

// Authentication check - must be admin to use this page
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log('⚠️ User not authenticated, redirecting to home...');
        alert('⚠️ Vui lòng đăng nhập để truy cập trang admin');
        window.location.href = '/';
        return;
    }

    // Check if user is admin
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || !userDoc.data().is_admin) {
            console.log('⚠️ User is not admin, redirecting to home...');
            alert('⚠️ Bạn không có quyền truy cập trang này');
            window.location.href = '/';
            return;
        }
        console.log('✅ User authenticated and is admin:', user.email);
    } catch (error) {
        console.error('❌ Error checking admin status:', error);
        alert('⚠️ Không thể xác thực quyền admin');
        window.location.href = '/';
    }
});

// DOM Elements
const quickInput = document.getElementById('quickInput');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const results = document.getElementById('results');
const resultsList = document.getElementById('resultsList');
const messageDiv = document.getElementById('message');

// Valid categories
const validCategories = [
    'laptop', 'pc', 'gpu', 'cpu', 'ram', 'storage', 
    'motherboard', 'psu', 'case', 'keyboard', 'mouse', 
    'headset', 'monitor', 'speaker', 'webcam', 'other'
];

// Valid statuses (updated to match Firebase data: in-stock, out-of-stock, pre-order)
const validStatuses = ['in-stock', 'out-of-stock', 'pre-order'];

// Check if SKU exists
async function checkSKUExists(sku) {
    try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('sku', '==', sku));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking SKU:', error);
        return false;
    }
}

// Find parent product by SKU
async function findParentProductBySKU(sku) {
    try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('sku', '==', sku));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error finding parent product:', error);
        return null;
    }
}

// Count existing variants for a parent product
async function countVariantsForParent(parentId) {
    try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('parent_id_product', '==', parentId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.size;
    } catch (error) {
        console.error('Error counting variants:', error);
        return 0;
    }
}

// Generate unique SKU for main product
async function generateUniqueSKU(brand, name) {
    const brandAbbr = brand.trim()
        .replace(/[^\p{L}\p{N}]/gu, '')
        .substring(0, 3)
        .toUpperCase();
    
    const nameAbbr = name.trim()
        .replace(/[^\p{L}\p{N}]/gu, '')
        .substring(0, 15);
    
    const nameFormatted = nameAbbr.charAt(0).toUpperCase() + nameAbbr.slice(1);
    
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
        const randomNum = Math.floor(Math.random() * 9999) + 1;
        const paddedNum = randomNum.toString().padStart(4, '0');
        const sku = `${brandAbbr}-${nameFormatted}-${paddedNum}`;
        
        const exists = await checkSKUExists(sku);
        if (!exists) {
            return sku;
        }
        
        attempts++;
    }
    
    // Fallback to timestamp
    const timestamp = Date.now().toString().slice(-4);
    return `${brandAbbr}-${nameFormatted}-${timestamp}`;
}

// Generate unique SKU for variant product (with -V1, -V2, etc. suffix)
async function generateVariantSKU(parentSKU, parentId) {
    // Count existing variants
    const variantCount = await countVariantsForParent(parentId);
    const variantNumber = variantCount + 1;
    
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
        const sku = `${parentSKU}-V${variantNumber + attempts}`;
        const exists = await checkSKUExists(sku);
        
        if (!exists) {
            return sku;
        }
        
        attempts++;
    }
    
    // Fallback with timestamp
    const timestamp = Date.now().toString().slice(-4);
    return `${parentSKU}-V${timestamp}`;
}

// Parse specifications from string (CPU:i7|RAM:16GB)
function parseSpecifications(specsStr) {
    const specs = {};
    if (!specsStr || !specsStr.trim()) return specs;
    
    const pairs = specsStr.split('|');
    pairs.forEach(pair => {
        const [key, value] = pair.split(':').map(s => s.trim());
        if (key && value) {
            specs[key] = value;
        }
    });
    
    return specs;
}

// Parse features from string (title:desc:icon|title:desc:icon)
function parseFeatures(featuresStr) {
    const features = [];
    if (!featuresStr || !featuresStr.trim()) return features;
    
    const items = featuresStr.split('|');
    items.forEach(item => {
        const [title, description, icon] = item.split(':').map(s => s.trim());
        if (title && description) {
            features.push({
                title,
                description,
                icon: icon || 'fas fa-star'
            });
        }
    });
    
    return features;
}

// Parse attributes from string (color:Black|size:15.6 inch)
function parseAttributes(attrsStr) {
    const attrs = {};
    if (!attrsStr || !attrsStr.trim()) return attrs;
    
    const pairs = attrsStr.split('|');
    pairs.forEach(pair => {
        const [key, value] = pair.split(':').map(s => s.trim());
        if (key && value) {
            attrs[key] = value;
        }
    });
    
    return attrs;
}

// Parse single line for MAIN PRODUCT
function parseMainProduct(line, lineNumber) {
    const parts = line.split(';').map(p => p.trim());
    
    // Main product needs at least 7 fields: name, category, brand, price, oldPrice, stock, status
    // Fields 8-10 are optional: description, specs, features
    if (parts.length < 7) {
        return {
            success: false,
            error: `Dòng ${lineNumber}: Sản phẩm chính thiếu dữ liệu (cần ít nhất 7 trường)`
        };
    }
    
    const [name, category, brand, priceStr, oldPriceStr, stockStr, status, description, specsStr, featuresStr] = parts;
    
    // Validate required fields
    if (!name) {
        return { success: false, error: `Dòng ${lineNumber}: Thiếu tên sản phẩm` };
    }
    
    if (!category || !validCategories.includes(category.toLowerCase())) {
        return { 
            success: false, 
            error: `Dòng ${lineNumber}: Danh mục không hợp lệ (${category})` 
        };
    }
    
    if (!brand) {
        return { success: false, error: `Dòng ${lineNumber}: Thiếu thương hiệu` };
    }
    
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
        return { success: false, error: `Dòng ${lineNumber}: Giá không hợp lệ (${priceStr})` };
    }
    
    const stock = parseInt(stockStr);
    if (isNaN(stock) || stock < 0) {
        return { success: false, error: `Dòng ${lineNumber}: Tồn kho không hợp lệ (${stockStr})` };
    }
    
    if (!status || !validStatuses.includes(status.toLowerCase())) {
        return { 
            success: false, 
            error: `Dòng ${lineNumber}: Trạng thái không hợp lệ (${status})` 
        };
    }
    
    // Parse optional fields
    const oldPrice = oldPriceStr ? parseFloat(oldPriceStr) : null;
    const specifications = parseSpecifications(specsStr);
    const features = parseFeatures(featuresStr);
    
    return {
        success: true,
        isVariant: false,
        data: {
            name: name.trim(),
            category: category.toLowerCase(),
            brand: brand.trim(),
            price,
            oldPrice,
            stock,
            availability: status.toLowerCase(),
            status: status.toLowerCase(),
            description: description || '',
            specifications,
            features,
            lineNumber
        }
    };
}

// Parse single line for VARIANT PRODUCT
function parseVariantProduct(line, lineNumber) {
    // Remove [VARIANT] prefix
    const cleanLine = line.replace(/^\[VARIANT\];?/i, '').trim();
    const parts = cleanLine.split(';').map(p => p.trim());
    
    // Variant needs: parentSKU, name, price, oldPrice, stock, status, attributes
    if (parts.length < 7) {
        return {
            success: false,
            error: `Dòng ${lineNumber}: Biến thể thiếu dữ liệu (cần ít nhất 7 trường sau [VARIANT])`
        };
    }
    
    const [parentSKU, name, priceStr, oldPriceStr, stockStr, status, attributesStr] = parts;
    
    // Validate required fields
    if (!parentSKU) {
        return { success: false, error: `Dòng ${lineNumber}: Thiếu SKU sản phẩm chính` };
    }
    
    // Allow [SKU_VỪA_TẠO] as valid placeholder
    const isUsingLastSKU = parentSKU.toUpperCase() === '[SKU_VỪA_TẠO]' || parentSKU.toUpperCase() === '[SKU_VỪA_TẠO]';
    
    if (!name) {
        return { success: false, error: `Dòng ${lineNumber}: Thiếu tên biến thể` };
    }
    
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
        return { success: false, error: `Dòng ${lineNumber}: Giá không hợp lệ (${priceStr})` };
    }
    
    const stock = parseInt(stockStr);
    if (isNaN(stock) || stock < 0) {
        return { success: false, error: `Dòng ${lineNumber}: Tồn kho không hợp lệ (${stockStr})` };
    }
    
    if (!status || !validStatuses.includes(status.toLowerCase())) {
        return { 
            success: false, 
            error: `Dòng ${lineNumber}: Trạng thái không hợp lệ (${status})` 
        };
    }
    
    if (!attributesStr) {
        return { 
            success: false, 
            error: `Dòng ${lineNumber}: Biến thể phải có attributes (VD: color:Black|size:15.6 inch)` 
        };
    }
    
    // Parse attributes
    const attributes = parseAttributes(attributesStr);
    const variant_attributes = parseAttributes(attributesStr); // Same data, both fields
    
    if (Object.keys(attributes).length === 0) {
        return { 
            success: false, 
            error: `Dòng ${lineNumber}: Attributes không hợp lệ (${attributesStr})` 
        };
    }
    
    // Parse old price (optional)
    const oldPrice = oldPriceStr ? parseFloat(oldPriceStr) : null;
    
    return {
        success: true,
        isVariant: true,
        data: {
            parentSKU: parentSKU.trim(),
            name: name.trim(),
            price,
            oldPrice,
            stock,
            availability: status.toLowerCase(),
            status: status.toLowerCase(),
            attributes,
            variant_attributes,
            lineNumber
        }
    };
}

// Show message
function showMessage(text, type = 'success') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type} show`;
    
    setTimeout(() => {
        messageDiv.classList.remove('show');
    }, 5000);
}

// Update progress
function updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    progressBar.style.width = percent + '%';
    progressBar.textContent = `${percent}% (${current}/${total})`;
}

// Add result item
function addResult(text, type = 'success') {
    const item = document.createElement('div');
    item.className = `result-item ${type}`;
    item.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${text}`;
    resultsList.appendChild(item);
}

// Process input and add products
async function processInput() {
    const input = quickInput.value.trim();
    
    if (!input) {
        showMessage('Vui lòng nhập dữ liệu sản phẩm!', 'error');
        return;
    }
    
    // Clear previous results
    resultsList.innerHTML = '';
    results.classList.remove('show');
    
    // Parse all lines
    const lines = input.split('\n').filter(line => line.trim());
    const products = [];
    const errors = [];
    
    console.log(`📝 Parsing ${lines.length} lines...`);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if this is a variant product
        const isVariantLine = line.toUpperCase().startsWith('[VARIANT]');
        
        let result;
        if (isVariantLine) {
            result = parseVariantProduct(line, i + 1);
        } else {
            result = parseMainProduct(line, i + 1);
        }
        
        if (result.success) {
            products.push(result);
        } else {
            errors.push(result.error);
        }
    }
    
    if (errors.length > 0) {
        showMessage(`Có ${errors.length} lỗi định dạng. Vui lòng kiểm tra lại!`, 'error');
        results.classList.add('show');
        errors.forEach(err => addResult(err, 'error'));
        return;
    }
    
    if (products.length === 0) {
        showMessage('Không có sản phẩm hợp lệ nào để thêm!', 'error');
        return;
    }
    
    // Show progress
    progress.classList.add('show');
    results.classList.add('show');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    console.log(`🚀 Adding ${products.length} products...`);
    
    let successCount = 0;
    let failCount = 0;
    let lastCreatedSKU = null; // Track last created main product SKU
    let lastCreatedProductId = null; // Track last created main product ID
    
    // Process each product
    for (let i = 0; i < products.length; i++) {
        const productParsed = products[i];
        const product = productParsed.data;
        updateProgress(i + 1, products.length);
        
        try {
            if (productParsed.isVariant) {
                // ===== VARIANT PRODUCT =====
                console.log(`Processing variant ${i + 1}: ${product.name}`);
                
                // Check if using [SKU_VỪA_TẠO] placeholder
                let parentSKU = product.parentSKU;
                let parentProduct = null;
                
                if (parentSKU.toUpperCase() === '[SKU_VỪA_TẠO]' || parentSKU.toUpperCase() === '[SKU_VỪA_TẠO]') {
                    if (!lastCreatedSKU || !lastCreatedProductId) {
                        failCount++;
                        addResult(
                            `❌ Dòng ${product.lineNumber}: Không thể sử dụng [SKU_VỪA_TẠO] vì chưa có sản phẩm chính nào được tạo trước đó`,
                            'error'
                        );
                        console.error(`No previous main product created`);
                        continue;
                    }
                    parentSKU = lastCreatedSKU;
                    parentProduct = { id: lastCreatedProductId };
                    console.log(`Using last created SKU: ${parentSKU} (ID: ${lastCreatedProductId})`);
                    
                    // Fetch full parent product data
                    const fullParentProduct = await findParentProductBySKU(parentSKU);
                    if (fullParentProduct) {
                        parentProduct = fullParentProduct;
                    }
                } else {
                    // Find parent product by SKU
                    parentProduct = await findParentProductBySKU(parentSKU);
                }
                
                if (!parentProduct) {
                    failCount++;
                    addResult(
                        `❌ Dòng ${product.lineNumber}: Không tìm thấy sản phẩm chính với SKU "${parentSKU}"`,
                        'error'
                    );
                    console.error(`Parent product not found: ${parentSKU}`);
                    continue;
                }
                
                console.log(`Found parent product:`, parentProduct);
                
                // Generate variant SKU
                const variantSKU = await generateVariantSKU(parentSKU, parentProduct.id);
                
                // Automatically add " - biến thể" suffix to variant name
                const variantName = product.name.includes(' - biến thể') 
                    ? product.name 
                    : `${product.name} - biến thể`;
                
                // Prepare variant product data (inherit from parent)
                const variantData = {
                    // Core fields
                    name: variantName,
                    category: parentProduct.category,
                    brand: parentProduct.brand,
                    sku: variantSKU,
                    description: parentProduct.description || '',
                    
                    // Variant-specific pricing and stock
                    price: product.price,
                    oldPrice: product.oldPrice,
                    stock: product.stock,
                    availability: product.availability,
                    status: product.status,
                    
                    // Inherit from parent
                    rating: 0,
                    reviewCount: 0,
                    images: parentProduct.images || [],
                    specifications: parentProduct.specifications || {},
                    features: parentProduct.features || [],
                    
                    // Variant-specific fields
                    has_variant: true,
                    parent_id_product: parentProduct.id,
                    attributes: product.attributes,
                    variant_attributes: product.variant_attributes,
                    
                    // Timestamps
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                
                // Add to Firestore
                const docRef = await addDoc(collection(db, 'products'), variantData);
                
                successCount++;
                addResult(
                    `✅ Dòng ${product.lineNumber}: Đã thêm biến thể "${variantName}" (ID: ${docRef.id}, SKU: ${variantSKU}, Parent: ${parentProduct.id})`,
                    'success'
                );
                
                console.log(`✅ Added variant ${i + 1}/${products.length}:`, product.name);
                
            } else {
                // ===== MAIN PRODUCT =====
                console.log(`Processing main product ${i + 1}: ${product.name}`);
                
                // Generate unique SKU
                const sku = await generateUniqueSKU(product.brand, product.name);
                
                // Prepare product data
                const productData = {
                    name: product.name,
                    category: product.category,
                    brand: product.brand,
                    sku: sku,
                    description: product.description,
                    price: product.price,
                    oldPrice: product.oldPrice,
                    stock: product.stock,
                    availability: product.availability,
                    status: product.status,
                    rating: 0,
                    reviewCount: 0,
                    images: [],
                    specifications: product.specifications,
                    features: product.features,
                    has_variant: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                
                // Add to Firestore
                const docRef = await addDoc(collection(db, 'products'), productData);
                
                // Save last created main product SKU and ID for [SKU_VỪA_TẠO] reference
                lastCreatedSKU = sku;
                lastCreatedProductId = docRef.id;
                
                successCount++;
                addResult(
                    `✅ Dòng ${product.lineNumber}: Đã thêm sản phẩm chính "${product.name}" (ID: ${docRef.id}, SKU: ${sku})`,
                    'success'
                );
                
                console.log(`✅ Added main product ${i + 1}/${products.length}:`, product.name);
                console.log(`💾 Saved SKU for variants: ${sku}`);
            }
            
        } catch (error) {
            failCount++;
            addResult(
                `❌ Dòng ${product.lineNumber}: Lỗi thêm "${product.name}" - ${error.message}`,
                'error'
            );
            
            console.error(`❌ Error adding product ${i + 1}:`, error);
        }
    }
    
    // Show final message
    progress.classList.remove('show');
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    
    if (failCount === 0) {
        showMessage(`🎉 Thành công! Đã thêm ${successCount} sản phẩm.`, 'success');
        quickInput.value = '';
    } else {
        showMessage(
            `Hoàn tất: ${successCount} thành công, ${failCount} thất bại.`,
            'error'
        );
    }
}

// Event Listeners
submitBtn.addEventListener('click', processInput);

clearBtn.addEventListener('click', () => {
    quickInput.value = '';
    resultsList.innerHTML = '';
    results.classList.remove('show');
    messageDiv.classList.remove('show');
    progress.classList.remove('show');
});

// Auto-resize textarea
quickInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.max(200, this.scrollHeight) + 'px';
});

console.log('🚀 Quick Input Admin initialized - Main Products & Variants support enabled');
