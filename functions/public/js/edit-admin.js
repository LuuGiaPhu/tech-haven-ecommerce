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
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let allProducts = [];
let filteredProducts = [];
let currentEditingProduct = null;
let newUploadedImages = []; // Store newly uploaded image URLs
let imagesToDelete = []; // Store image URLs to delete
let uploadHandlers = null; // Store event handlers to remove them later

// DOM elements
console.log('Finding DOM elements...');
const productsList = document.getElementById('productsList');
const loadingSpinner = document.getElementById('loadingSpinner');
const noProducts = document.getElementById('noProducts');
const productsCount = document.getElementById('productsCount');
const productSearch = document.getElementById('productSearch');
const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');
const brandFilter = document.getElementById('brandFilter');
const stockFilter = document.getElementById('stockFilter');
const sortFilter = document.getElementById('sortFilter');
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
    brandFilter.addEventListener('change', handleFilter);
    stockFilter.addEventListener('change', handleFilter);
    sortFilter.addEventListener('change', handleFilter);
    
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
        
        // Add spinning animation to refresh button
        const refreshIcon = refreshBtn.querySelector('i');
        if (refreshIcon) {
            refreshIcon.classList.add('fa-spin');
        }
        
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
        
        // Apply current filters after loading
        applyFilters();
        
        displayProducts();
        updateProductsCount();
        
        // Show success message
        showSuccess(`Đã tải ${allProducts.length} sản phẩm thành công!`);
        
    } catch (error) {
        console.error('❌ Error loading products:', error);
        console.error('Error details:', error.message);
        showError('Không thể tải danh sách sản phẩm: ' + error.message);
    } finally {
        showLoading(false);
        
        // Remove spinning animation from refresh button
        const refreshIcon = refreshBtn.querySelector('i');
        if (refreshIcon) {
            refreshIcon.classList.remove('fa-spin');
        }
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
    
    productsList.innerHTML = filteredProducts.map(product => {
        // Format created date
        const createdDate = product.created_at || product.createdAt;
        let dateDisplay = '';
        if (createdDate) {
            try {
                // Convert Firebase Timestamp to JavaScript Date
                let date;
                if (createdDate.toDate && typeof createdDate.toDate === 'function') {
                    // Firebase Timestamp object
                    date = createdDate.toDate();
                } else if (createdDate.seconds) {
                    // Firestore Timestamp format {seconds, nanoseconds}
                    date = new Date(createdDate.seconds * 1000);
                } else {
                    // ISO string or timestamp number
                    date = new Date(createdDate);
                }
                
                dateDisplay = `<div class="product-date" title="Ngày tạo: ${date.toLocaleString('vi-VN')}">
                    <i class="fas fa-calendar-alt"></i> ${formatDate(date)}
                </div>`;
            } catch (e) {
                console.error('Error parsing date:', e);
            }
        }
        
        return `
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
                ${dateDisplay}
                
                <div class="product-price-info">
                    <div class="current-price">${formatPrice(product.price)}đ</div>
                    ${product.oldPrice && product.oldPrice > product.price 
                        ? `<div class="old-price">${formatPrice(product.oldPrice)}đ</div>`
                        : ''
                    }
                </div>
                
                <div class="product-stock-info">
                    <span class="stock-count ${(product.stock || 0) === 0 ? 'out-of-stock' : (product.stock || 0) <= 10 ? 'low-stock' : ''}">
                        Tồn kho: ${product.stock || 0}
                    </span>
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
    `;
    }).join('');
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
    
    // Brand filter
    const selectedBrand = brandFilter.value;
    if (selectedBrand) {
        if (selectedBrand === 'other') {
            const knownBrands = ['ASUS', 'MSI', 'Gigabyte', 'Intel', 'AMD', 'Corsair', 'Samsung', 'Logitech', 'Razer', 'HyperX', 'Keychron'];
            filtered = filtered.filter(product => !knownBrands.includes(product.brand));
        } else {
            filtered = filtered.filter(product => product.brand === selectedBrand);
        }
    }
    
    // Stock filter
    const selectedStock = stockFilter.value;
    if (selectedStock) {
        if (selectedStock === 'in-stock') {
            filtered = filtered.filter(product => (product.stock || 0) > 0);
        } else if (selectedStock === 'low-stock') {
            filtered = filtered.filter(product => {
                const stock = product.stock || 0;
                return stock >= 1 && stock <= 10;
            });
        } else if (selectedStock === 'out-of-stock') {
            filtered = filtered.filter(product => (product.stock || 0) === 0);
        }
    }
    
    // Sort filter
    const selectedSort = sortFilter.value;
    if (selectedSort === 'newest') {
        filtered.sort((a, b) => {
            const dateA = a.created_at || a.createdAt || 0;
            const dateB = b.created_at || b.createdAt || 0;
            // Handle Firebase Timestamp objects
            const timeA = dateA.seconds ? dateA.seconds * 1000 : (dateA.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime());
            const timeB = dateB.seconds ? dateB.seconds * 1000 : (dateB.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime());
            return timeB - timeA;
        });
    } else if (selectedSort === 'oldest') {
        filtered.sort((a, b) => {
            const dateA = a.created_at || a.createdAt || 0;
            const dateB = b.created_at || b.createdAt || 0;
            // Handle Firebase Timestamp objects
            const timeA = dateA.seconds ? dateA.seconds * 1000 : (dateA.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime());
            const timeB = dateB.seconds ? dateB.seconds * 1000 : (dateB.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime());
            return timeA - timeB;
        });
    } else if (selectedSort === 'name-asc') {
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    } else if (selectedSort === 'name-desc') {
        filtered.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'vi'));
    } else if (selectedSort === 'price-asc') {
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (selectedSort === 'price-desc') {
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (selectedSort === 'stock-asc') {
        filtered.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    } else if (selectedSort === 'stock-desc') {
        filtered.sort((a, b) => (b.stock || 0) - (a.stock || 0));
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
        
        // Load specifications
        loadEditSpecs(product.specifications || {});
        
        // Reset image arrays
        newUploadedImages = [];
        imagesToDelete = [];
        
        // Display current images
        displayCurrentImages(product.images || []);
        
        // Setup image upload listener
        setupImageUploadListener();
        
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
    
    // Clear image data
    newUploadedImages = [];
    imagesToDelete = [];
    
    // Clear image preview
    const previewContainer = document.getElementById('editImagePreview');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
    
    // Reset file input
    const fileInput = document.getElementById('editProductImages');
    if (fileInput) {
        fileInput.value = '';
    }
    
    console.log('Edit modal closed');
}

// Handle save product
async function handleSaveProduct(e) {
    e.preventDefault();
    
    if (!currentEditingProduct) {
        showError('Không có sản phẩm để cập nhật');
        return;
    }
    
    try {
        // Calculate final images array
        const currentImages = currentEditingProduct.images || [];
        const remainingImages = currentImages.filter(img => !imagesToDelete.includes(img));
        const finalImages = [...remainingImages, ...newUploadedImages];
        
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
            specifications: getEditSpecifications(),
            images: finalImages, // Update images array
            updatedAt: new Date().toISOString()
        };
        
        console.log('Updating product with images:', {
            productId: currentEditingProduct.id,
            oldImages: currentImages.length,
            deletedImages: imagesToDelete.length,
            newImages: newUploadedImages.length,
            finalImages: finalImages.length
        });
        
        // Update in Firestore
        const productRef = doc(db, 'products', currentEditingProduct.id);
        await updateDoc(productRef, formData);
        
        // Delete old images from storage
        for (const imageUrl of imagesToDelete) {
            try {
                // Extract storage path from Firebase Storage URL
                // URL format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile.jpg?alt=media&token=...
                // We need to extract the path between /o/ and ?alt=
                const urlParts = imageUrl.split('/o/');
                if (urlParts.length > 1) {
                    const pathWithParams = urlParts[1];
                    const storagePath = decodeURIComponent(pathWithParams.split('?')[0]);
                    console.log('Attempting to delete image from storage:', storagePath);
                    
                    const imageRef = ref(storage, storagePath);
                    await deleteObject(imageRef);
                    console.log('✅ Successfully deleted image:', storagePath);
                } else {
                    console.warn('⚠️ Invalid Firebase Storage URL format:', imageUrl);
                }
            } catch (error) {
                console.error('❌ Error deleting image from storage:', error);
                console.error('Image URL:', imageUrl);
                // Continue even if delete fails (image might not exist)
            }
        }
        
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

function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) {
        return date.toLocaleDateString('vi-VN', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    } else if (days > 0) {
        return `${days} ngày trước`;
    } else if (hours > 0) {
        return `${hours} giờ trước`;
    } else if (minutes > 0) {
        return `${minutes} phút trước`;
    } else {
        return 'Vừa xong';
    }
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

// =====================================
// IMAGE UPLOAD FUNCTIONS
// =====================================

// Display current product images
function displayCurrentImages(images) {
    const container = document.getElementById('editCurrentImages');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!images || images.length === 0) {
        container.innerHTML = '<p style="color: #64748b; font-style: italic;">Chưa có ảnh nào</p>';
        return;
    }
    
    images.forEach((imageUrl, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.innerHTML = `
            <img src="${imageUrl}" alt="Product image ${index + 1}">
            <button type="button" class="image-remove-btn" onclick="markImageForDeletion('${imageUrl}', this)">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(imageItem);
    });
}

// Mark image for deletion
window.markImageForDeletion = function(imageUrl, button) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
        imagesToDelete.push(imageUrl);
        button.closest('.image-item').remove();
        
        // Check if no images left
        const container = document.getElementById('editCurrentImages');
        if (container.children.length === 0) {
            container.innerHTML = '<p style="color: #64748b; font-style: italic;">Chưa có ảnh nào</p>';
        }
    }
}

// Setup image upload listener
function setupImageUploadListener() {
    const fileInput = document.getElementById('editProductImages');
    const uploadArea = document.getElementById('uploadArea');
    
    if (!fileInput || !uploadArea) return;
    
    // Remove old event listeners if they exist
    if (uploadHandlers) {
        console.log('Removing old event listeners...');
        fileInput.removeEventListener('change', uploadHandlers.fileChange);
        uploadArea.removeEventListener('click', uploadHandlers.areaClick);
        uploadArea.removeEventListener('dragover', uploadHandlers.dragOver);
        uploadArea.removeEventListener('dragleave', uploadHandlers.dragLeave);
        uploadArea.removeEventListener('drop', uploadHandlers.drop);
    }
    
    // File input change event - only handle once
    let isProcessing = false;
    const fileChangeHandler = async (e) => {
        if (isProcessing) {
            console.log('Already processing, skipping...');
            return;
        }
        console.log('Starting image upload...');
        isProcessing = true;
        await handleImageUpload(e);
        isProcessing = false;
        console.log('Image upload completed');
    };
    
    // Click event on upload area
    const areaClickHandler = (e) => {
        e.stopPropagation();
        
        if (!isProcessing && e.target !== fileInput) {
            console.log('Opening file dialog...');
            fileInput.click();
        }
    };
    
    // Drag over event
    const dragOverHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('drag-over');
    };
    
    // Drag leave event
    const dragLeaveHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
    };
    
    // Drop event
    const dropHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
        
        if (isProcessing) return;
        isProcessing = true;
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const dataTransfer = new DataTransfer();
            Array.from(files).forEach(file => dataTransfer.items.add(file));
            fileInput.files = dataTransfer.files;
            
            const changeEvent = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(changeEvent);
        }
        
        isProcessing = false;
    };
    
    // Add new event listeners
    fileInput.addEventListener('change', fileChangeHandler);
    uploadArea.addEventListener('click', areaClickHandler);
    uploadArea.addEventListener('dragover', dragOverHandler);
    uploadArea.addEventListener('dragleave', dragLeaveHandler);
    uploadArea.addEventListener('drop', dropHandler);
    
    // Store handlers for later removal
    uploadHandlers = {
        fileChange: fileChangeHandler,
        areaClick: areaClickHandler,
        dragOver: dragOverHandler,
        dragLeave: dragLeaveHandler,
        drop: dropHandler
    };
    
    console.log('Upload listeners setup completed');
}

// Convert image to WebP format
async function convertToWebP(file, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = new Image();
            
            img.onload = function() {
                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image on canvas
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // Convert to WebP blob
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // Create new file with .webp extension
                            const webpFile = new File(
                                [blob], 
                                file.name.replace(/\.[^/.]+$/, '.webp'),
                                { type: 'image/webp' }
                            );
                            resolve(webpFile);
                        } else {
                            reject(new Error('Không thể chuyển đổi sang WebP'));
                        }
                    },
                    'image/webp',
                    quality
                );
            };
            
            img.onerror = function() {
                reject(new Error('Không thể tải ảnh'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = function() {
            reject(new Error('Không thể đọc file'));
        };
        
        reader.readAsDataURL(file);
    });
}

// Handle image upload
async function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Validate files
    const maxSize = 5 * 1024 * 1024; // 5MB
    const maxFiles = 5;
    
    if (files.length > maxFiles) {
        showError(`Chỉ được tải tối đa ${maxFiles} ảnh`);
        return;
    }
    
    for (const file of files) {
        if (file.size > maxSize) {
            showError(`File ${file.name} quá lớn (tối đa 5MB)`);
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            showError(`File ${file.name} không phải là ảnh`);
            return;
        }
    }
    
    // Show progress
    const progressContainer = document.getElementById('editUploadProgress');
    const progressFill = document.getElementById('editProgressFill');
    const progressText = document.getElementById('editProgressText');
    progressContainer.style.display = 'block';
    
    try {
        const uploadedUrls = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Convert to WebP format
            progressText.textContent = `Đang chuyển đổi ${i + 1}/${files.length}...`;
            const webpFile = await convertToWebP(file, 0.85); // 85% quality
            
            console.log(`Converted ${file.name}: ${file.size} bytes -> ${webpFile.size} bytes (${Math.round((1 - webpFile.size/file.size) * 100)}% nhỏ hơn)`);
            
            const timestamp = Date.now();
            const fileName = `${timestamp}_${i}_${webpFile.name}`;
            const storageRef = ref(storage, `products/${fileName}`);
            
            // Upload WebP file
            const uploadTask = uploadBytesResumable(storageRef, webpFile);
            
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        const overallProgress = ((i + progress / 100) / files.length) * 100;
                        progressFill.style.width = overallProgress + '%';
                        progressText.textContent = `${Math.round(overallProgress)}% - Đang tải ${i + 1}/${files.length}`;
                    },
                    (error) => {
                        console.error('Upload error:', error);
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        uploadedUrls.push(downloadURL);
                        resolve();
                    }
                );
            });
        }
        
        // Add to new images array
        newUploadedImages.push(...uploadedUrls);
        
        // Display preview
        displayImagePreview(uploadedUrls);
        
        // Hide progress
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
        }, 1000);
        
        showSuccess(`Đã tải lên ${files.length} ảnh (định dạng WebP) thành công!`);
        
    } catch (error) {
        console.error('Error uploading images:', error);
        showError('Không thể tải ảnh lên: ' + error.message);
        progressContainer.style.display = 'none';
    }
    
    // Clear file input
    event.target.value = '';
}

// Display image preview
function displayImagePreview(imageUrls) {
    const container = document.getElementById('editImagePreview');
    if (!container) return;
    
    imageUrls.forEach((imageUrl, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.innerHTML = `
            <img src="${imageUrl}" alt="New image ${index + 1}">
            <button type="button" class="image-remove-btn" onclick="removeNewImage('${imageUrl}', this)">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(imageItem);
    });
}

// Remove newly uploaded image
window.removeNewImage = async function(imageUrl, button) {
    if (confirm('Bạn có chắc muốn xóa ảnh mới này?')) {
        const index = newUploadedImages.indexOf(imageUrl);
        if (index > -1) {
            newUploadedImages.splice(index, 1);
        }
        button.closest('.image-item').remove();
        
        // Delete from Firebase Storage
        try {
            // Extract storage path from Firebase Storage URL
            const urlParts = imageUrl.split('/o/');
            if (urlParts.length > 1) {
                const pathWithParams = urlParts[1];
                const storagePath = decodeURIComponent(pathWithParams.split('?')[0]);
                console.log('Attempting to delete newly uploaded image:', storagePath);
                
                const imageRef = ref(storage, storagePath);
                await deleteObject(imageRef);
                console.log('✅ Successfully deleted newly uploaded image:', storagePath);
            } else {
                console.warn('⚠️ Invalid Firebase Storage URL format:', imageUrl);
            }
        } catch (error) {
            console.error('❌ Error deleting newly uploaded image from storage:', error);
            console.error('Image URL:', imageUrl);
        }
    }
}

// Confirm delete product
window.confirmDeleteProduct = function() {
    if (!currentEditingProduct) {
        showError('Không có sản phẩm để xóa');
        return;
    }
    
    openDeleteModal(currentEditingProduct.id, currentEditingProduct.name);
}