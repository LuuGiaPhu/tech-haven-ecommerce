// Import Firebase services
console.log('Edit admin script starting...');
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let allProducts = [];
let filteredProducts = [];
let currentEditingProduct = null;

// DOM elements
console.log('Finding DOM elements...');
const productsList = document.getElementById('productsList');
const loadingSpinner = document.getElementById('loadingSpinner');
const noProducts = document.getElementById('noProducts');
const productsCount = document.getElementById('productsCount');
const productSearch = document.getElementById('productSearch');
const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');
const searchBtn = document.getElementById('searchBtn');
const refreshBtn = document.getElementById('refreshBtn');
const editModal = document.getElementById('editModal');
const deleteModal = document.getElementById('deleteModal');
const editForm = document.getElementById('editForm');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');

console.log('DOM elements check:', {
    productsList: !!productsList,
    loadingSpinner: !!loadingSpinner,
    noProducts: !!noProducts,
    productSearch: !!productSearch
});

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing edit page...');
    loadProducts();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    searchBtn.addEventListener('click', handleSearch);
    refreshBtn.addEventListener('click', loadProducts);
    productSearch.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    categoryFilter.addEventListener('change', handleFilter);
    statusFilter.addEventListener('change', handleFilter);
    
    editForm.addEventListener('submit', handleSaveProduct);
    
    // Close modals when clicking outside
    editModal.addEventListener('click', function(e) {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
    
    deleteModal.addEventListener('click', function(e) {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });
}

// Load products from Firestore
async function loadProducts() {
    try {
        console.log('=== LOAD PRODUCTS STARTED ===');
        showLoading(true);
        console.log('Loading products from Firestore...');
        console.log('Firebase app:', !!app);
        console.log('Firestore db:', !!db);
        
        const productsRef = collection(db, 'products');
        console.log('Products collection reference created');
        
        const querySnapshot = await getDocs(productsRef);
        console.log('Query snapshot received, size:', querySnapshot.size);
        
        if (querySnapshot.empty) {
            console.log('❌ NO PRODUCTS FOUND IN FIRESTORE!');
            allProducts = [];
            filteredProducts = [];
            displayProducts();
            updateProductsCount();
            return;
        }
        
        allProducts = [];
        querySnapshot.forEach((doc) => {
            console.log('Found product:', doc.id, doc.data());
            allProducts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('✅ Total products loaded:', allProducts.length);
        console.log('Products data:', allProducts);
        filteredProducts = [...allProducts];
        displayProducts();
        updateProductsCount();
        
    } catch (error) {
        console.error('❌ Error loading products:', error);
        console.error('Error details:', error.message);
        showError('Không thể tải danh sách sản phẩm: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Display products in grid
function displayProducts() {
    console.log('=== DISPLAY PRODUCTS STARTED ===');
    console.log('Displaying products:', filteredProducts.length);
    
    if (filteredProducts.length > 0) {
        console.log('First product structure:', filteredProducts[0]);
    } else {
        console.log('❌ NO PRODUCTS TO DISPLAY - filteredProducts is empty!');
    }
    
    console.log('Products list element:', productsList);
    console.log('No products element:', noProducts);
    
    if (filteredProducts.length === 0) {
        console.log('Hiding products grid, showing no products message');
        productsList.style.display = 'none';
        noProducts.style.display = 'block';
        return;
    }
    
    console.log('✅ Showing products grid with', filteredProducts.length, 'products');
    noProducts.style.display = 'none';
    productsList.style.display = 'grid';
    
    productsList.innerHTML = filteredProducts.map(product => `
        <div class="product-edit-card" data-id="${product.id}">
            <div class="product-card-header">
                <div class="product-category-badge category-${product.category || 'other'}">
                    ${getCategoryName(product.category)}
                </div>
                <div class="product-status-badge status-${product.availability || 'unknown'}">
                    ${getStatusName(product.availability)}
                </div>
            </div>
            
            <div class="product-card-image">
                ${product.images && product.images.length > 0 
                    ? `<img src="${product.images[0]}" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                    : ''
                }
                <div class="product-placeholder ${product.images && product.images.length > 0 ? 'hidden' : ''}">
                    <i class="fas ${getCategoryIcon(product.category)}"></i>
                </div>
            </div>
            
            <div class="product-card-content">
                <h4 class="product-name">${product.name || 'Tên sản phẩm không xác định'}</h4>
                <div class="product-brand">${product.brand || 'Không xác định'}</div>
                <div class="product-sku">SKU: ${product.sku || 'N/A'}</div>
                
                <div class="product-price-info">
                    <div class="current-price">${formatPrice(product.price)}đ</div>
                    ${product.oldPrice && product.oldPrice > product.price 
                        ? `<div class="old-price">${formatPrice(product.oldPrice)}đ</div>`
                        : ''
                    }
                </div>
                
                <div class="product-stock-info">
                    <span class="stock-count">Tồn kho: ${product.stock || 0}</span>
                    ${product.rating ? `
                        <div class="product-rating-small">
                            ${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5-Math.floor(product.rating))}
                            <span>(${product.reviewCount || 0})</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="product-actions">
                    <button class="edit-btn" onclick="openEditModal('${product.id}')">
                        <i class="fas fa-edit"></i> Chỉnh Sửa
                    </button>
                    <button class="delete-btn" onclick="openDeleteModal('${product.id}', '${product.name}')">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Handle search
function handleSearch() {
    const searchTerm = productSearch.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredProducts = [...allProducts];
    } else {
        filteredProducts = allProducts.filter(product => 
            product.name?.toLowerCase().includes(searchTerm) ||
            product.brand?.toLowerCase().includes(searchTerm) ||
            product.sku?.toLowerCase().includes(searchTerm) ||
            product.category?.toLowerCase().includes(searchTerm) ||
            product.id.toLowerCase().includes(searchTerm)
        );
    }
    
    applyFilters();
    displayProducts();
    updateProductsCount();
}

// Handle filter
function handleFilter() {
    applyFilters();
    displayProducts();
    updateProductsCount();
}

// Apply filters
function applyFilters() {
    // Always start filtering from allProducts, not filteredProducts
    let filtered = [...allProducts];
    
    // Apply search if there's a search term
    const searchTerm = productSearch.value.toLowerCase().trim();
    if (searchTerm !== '') {
        filtered = filtered.filter(product => 
            product.name?.toLowerCase().includes(searchTerm) ||
            product.brand?.toLowerCase().includes(searchTerm) ||
            product.sku?.toLowerCase().includes(searchTerm) ||
            product.category?.toLowerCase().includes(searchTerm) ||
            product.id.toLowerCase().includes(searchTerm)
        );
    }
    
    // Category filter
    const selectedCategory = categoryFilter.value;
    if (selectedCategory) {
        filtered = filtered.filter(product => product.category === selectedCategory);
    }
    
    // Status filter
    const selectedStatus = statusFilter.value;
    if (selectedStatus) {
        filtered = filtered.filter(product => product.availability === selectedStatus);
    }
    
    filteredProducts = filtered;
    console.log('Applied filters, results:', filteredProducts.length);
}

// Open edit modal
window.openEditModal = async function(productId) {
    try {
        const product = allProducts.find(p => p.id === productId);
        if (!product) {
            showError('Không tìm thấy sản phẩm');
            return;
        }
        
        currentEditingProduct = product;
        
        // Fill form with product data
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductName').value = product.name || '';
        document.getElementById('editProductCategory').value = product.category || '';
        document.getElementById('editProductBrand').value = product.brand || '';
        document.getElementById('editProductSku').value = product.sku || '';
        document.getElementById('editProductDescription').value = product.description || '';
        document.getElementById('editProductPrice').value = product.price || '';
        document.getElementById('editProductOldPrice').value = product.oldPrice || '';
        document.getElementById('editProductStock').value = product.stock || '';
        document.getElementById('editProductAvailability').value = product.availability || '';
        document.getElementById('editProductRating').value = product.rating || '';
        document.getElementById('editProductReviews').value = product.reviewCount || '';
        
        // Load specifications
        loadEditSpecs(product.specifications || {});
        
        // Show modal
        editModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showError('Không thể mở form chỉnh sửa: ' + error.message);
    }
}

// Close edit modal
window.closeEditModal = function() {
    editModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentEditingProduct = null;
}

// Handle save product
async function handleSaveProduct(e) {
    e.preventDefault();
    
    if (!currentEditingProduct) {
        showError('Không có sản phẩm để cập nhật');
        return;
    }
    
    try {
        // Get form data
        const formData = {
            name: document.getElementById('editProductName').value,
            category: document.getElementById('editProductCategory').value,
            brand: document.getElementById('editProductBrand').value,
            sku: document.getElementById('editProductSku').value,
            description: document.getElementById('editProductDescription').value,
            price: parseFloat(document.getElementById('editProductPrice').value) || 0,
            oldPrice: parseFloat(document.getElementById('editProductOldPrice').value) || 0,
            stock: parseInt(document.getElementById('editProductStock').value) || 0,
            availability: document.getElementById('editProductAvailability').value,
            rating: parseFloat(document.getElementById('editProductRating').value) || 0,
            reviewCount: parseInt(document.getElementById('editProductReviews').value) || 0,
            specifications: getEditSpecifications(),
            updatedAt: new Date().toISOString()
        };
        
        // Update in Firestore
        const productRef = doc(db, 'products', currentEditingProduct.id);
        await updateDoc(productRef, formData);
        
        showSuccess('Cập nhật sản phẩm thành công!');
        closeEditModal();
        loadProducts(); // Reload products list
        
    } catch (error) {
        console.error('Error updating product:', error);
        showError('Không thể cập nhật sản phẩm: ' + error.message);
    }
}

// Open delete modal
window.openDeleteModal = function(productId, productName) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        showError('Không tìm thấy sản phẩm');
        return;
    }
    
    currentEditingProduct = product;
    document.getElementById('deleteProductName').textContent = productName;
    
    deleteModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Setup confirm delete button
    document.getElementById('confirmDeleteBtn').onclick = async function() {
        await handleDeleteProduct();
    };
}

// Close delete modal
window.closeDeleteModal = function() {
    deleteModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentEditingProduct = null;
}

// Handle delete product
async function handleDeleteProduct() {
    if (!currentEditingProduct) {
        showError('Không có sản phẩm để xóa');
        return;
    }
    
    try {
        // Delete from Firestore
        const productRef = doc(db, 'products', currentEditingProduct.id);
        await deleteDoc(productRef);
        
        showSuccess('Xóa sản phẩm thành công!');
        closeDeleteModal();
        loadProducts(); // Reload products list
        
    } catch (error) {
        console.error('Error deleting product:', error);
        showError('Không thể xóa sản phẩm: ' + error.message);
    }
}

// Load specifications for editing
function loadEditSpecs(specs) {
    const specsContainer = document.getElementById('editSpecInputs');
    specsContainer.innerHTML = '';
    
    if (specs && typeof specs === 'object') {
        Object.entries(specs).forEach(([key, value]) => {
            addEditSpecRow(key, value);
        });
    }
    
    // Add one empty row if no specs
    if (Object.keys(specs).length === 0) {
        addEditSpecRow();
    }
}

// Add specification row for editing
window.addEditSpecRow = function(key = '', value = '') {
    const specsContainer = document.getElementById('editSpecInputs');
    const specRow = document.createElement('div');
    specRow.className = 'spec-row';
    specRow.innerHTML = `
        <input type="text" class="spec-key" placeholder="Tên thông số" value="${key}">
        <input type="text" class="spec-value" placeholder="Giá trị" value="${value}">
        <button type="button" class="remove-spec-btn" onclick="removeEditSpecRow(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    specsContainer.appendChild(specRow);
}

// Remove specification row
window.removeEditSpecRow = function(button) {
    button.closest('.spec-row').remove();
}

// Get specifications from form
function getEditSpecifications() {
    const specs = {};
    const specRows = document.querySelectorAll('#editSpecInputs .spec-row');
    
    specRows.forEach(row => {
        const key = row.querySelector('.spec-key').value.trim();
        const value = row.querySelector('.spec-value').value.trim();
        
        if (key && value) {
            specs[key] = value;
        }
    });
    
    return specs;
}

// Utility functions
function showLoading(show) {
    loadingSpinner.style.display = show ? 'flex' : 'none';
}

function showSuccess(message) {
    successMessage.querySelector('span').textContent = message;
    successMessage.style.display = 'flex';
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 3000);
}

function showError(message) {
    document.getElementById('errorText').textContent = message;
    errorMessage.style.display = 'flex';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function updateProductsCount() {
    productsCount.textContent = filteredProducts.length;
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price);
}

function getCategoryName(category) {
    const categories = {
        laptop: 'Laptop',
        pc: 'PC',
        gpu: 'Card Đồ Họa',
        cpu: 'CPU',
        ram: 'RAM',
        storage: 'Ổ Cứng',
        motherboard: 'Bo Mạch Chủ',
        psu: 'Nguồn',
        case: 'Vỏ Case',
        keyboard: 'Bàn Phím',
        mouse: 'Chuột',
        headset: 'Tai Nghe',
        monitor: 'Màn Hình',
        speaker: 'Loa',
        webcam: 'Webcam',
        other: 'Khác'
    };
    return categories[category] || 'Không xác định';
}

function getStatusName(status) {
    const statuses = {
        'in-stock': 'Còn hàng',
        'out-of-stock': 'Hết hàng',
        'pre-order': 'Đặt trước'
    };
    return statuses[status] || 'Không xác định';
}

function getCategoryIcon(category) {
    const icons = {
        laptop: 'fa-laptop',
        pc: 'fa-desktop',
        gpu: 'fa-microchip',
        cpu: 'fa-processor',
        ram: 'fa-memory',
        storage: 'fa-hdd',
        motherboard: 'fa-circuit-board',
        psu: 'fa-plug',
        case: 'fa-cube',
        keyboard: 'fa-keyboard',
        mouse: 'fa-mouse',
        headset: 'fa-headset',
        monitor: 'fa-tv',
        speaker: 'fa-volume-up',
        webcam: 'fa-video',
        other: 'fa-box'
    };
    return icons[category] || 'fa-box';
}

// Confirm delete product
window.confirmDeleteProduct = function() {
    if (!currentEditingProduct) {
        showError('Không có sản phẩm để xóa');
        return;
    }
    
    openDeleteModal(currentEditingProduct.id, currentEditingProduct.name);
}