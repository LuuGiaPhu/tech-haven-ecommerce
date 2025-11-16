// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Firebase config object
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
const db = getFirestore(app);
const storage = getStorage(app);

// Global variables
let selectedImages = [];
let uploadedImageUrls = [];

// DOM Elements
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const productForm = document.getElementById('productForm');
const submitBtn = document.getElementById('submitBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Input Page Initialized');
    console.log('📱 Firebase app:', app);
    console.log('🗄️ Firebase db:', db);
    console.log('📦 Firebase storage:', storage);
    
    // Test Firebase connection by checking if we can access Firestore
    try {
        const testCollection = collection(db, 'test');
        console.log('✅ Firebase Firestore connection successful');
    } catch (error) {
        console.error('❌ Firebase Firestore connection failed:', error);
    }
    
    // Check if required DOM elements exist
    console.log('🔍 Checking DOM elements...');
    console.log('Form element:', productForm ? '✅ Found' : '❌ Not found');
    console.log('Submit button:', submitBtn ? '✅ Found' : '❌ Not found');
    console.log('Success message:', successMessage ? '✅ Found' : '❌ Not found');
    console.log('Error message:', errorMessage ? '✅ Found' : '❌ Not found');
    
    setupEventListeners();
    addInitialSpecRows();
    
    console.log('🎉 Initialization complete!');
});

// Setup all event listeners
function setupEventListeners() {
    console.log('⚙️ Setting up event listeners...');
    
    // Image input change
    if (imageInput) {
        imageInput.addEventListener('change', handleImageSelection);
        console.log('✅ Image input listener attached');
    } else {
        console.warn('⚠️ Image input not found');
    }
    
    // Drag and drop for images
    const uploadArea = document.querySelector('.image-upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        console.log('✅ Drag & drop listeners attached');
    } else {
        console.warn('⚠️ Upload area not found');
    }
    
    // Form submission
    if (productForm) {
        productForm.addEventListener('submit', handleFormSubmit);
        console.log('✅ Form submit listener attached');
    } else {
        console.error('❌ Product form not found! Cannot attach submit listener');
    }
    
    // Auto-generate SKU based on name and brand
    const nameInput = document.getElementById('productName');
    const brandInput = document.getElementById('productBrand');
    
    if (nameInput && brandInput) {
        nameInput.addEventListener('input', generateSKU);
        brandInput.addEventListener('input', generateSKU);
        console.log('✅ SKU generation listeners attached');
    } else {
        console.warn('⚠️ Name or brand input not found for SKU generation');
    }
    
    console.log('🎛️ Event listeners setup complete!');
}

// Add initial specification rows
function addInitialSpecRows() {
    const specInputs = document.getElementById('specInputs');
    specInputs.innerHTML = ''; // Clear existing
    
    // Add common specification rows
    const commonSpecs = [
        { key: 'CPU', placeholder: 'VD: Intel Core i7-11800H' },
        { key: 'GPU', placeholder: 'VD: NVIDIA RTX 3060 6GB' },
        { key: 'RAM', placeholder: 'VD: 16GB DDR4 3200MHz' },
        { key: 'Storage', placeholder: 'VD: 512GB SSD NVMe' }
    ];
    
    commonSpecs.forEach(spec => {
        addSpecRow(spec.key, spec.placeholder);
    });
}

// Handle image selection
function handleImageSelection(event) {
    const files = Array.from(event.target.files);
    processImageFiles(files);
}

// Handle drag over
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

// Handle drag leave
function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
}

// Handle drop
function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
        processImageFiles(imageFiles);
    }
}

// Process selected image files
function processImageFiles(files) {
    // Validate file size and type
    const validFiles = files.filter(file => {
        if (!file.type.startsWith('image/')) {
            showError('Chỉ hỗ trợ file hình ảnh (JPG, PNG, GIF)');
            return false;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showError(`File ${file.name} quá lớn. Giới hạn 5MB.`);
            return false;
        }
        return true;
    });
    
    if (validFiles.length === 0) return;
    
    // Limit to 10 images total
    const totalImages = selectedImages.length + validFiles.length;
    if (totalImages > 10) {
        showError('Tối đa 10 hình ảnh cho mỗi sản phẩm');
        return;
    }
    
    // Add to selected images array
    selectedImages = [...selectedImages, ...validFiles];
    
    // Update preview
    updateImagePreview();
}

// Update image preview
function updateImagePreview() {
    imagePreview.innerHTML = '';
    
    if (selectedImages.length === 0) {
        imagePreview.style.display = 'none';
        return;
    }
    
    imagePreview.style.display = 'block';
    
    selectedImages.forEach((file, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        const img = document.createElement('img');
        img.className = 'preview-image';
        img.src = URL.createObjectURL(file);
        img.alt = `Preview ${index + 1}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.onclick = () => removeImage(index);
        
        previewItem.appendChild(img);
        previewItem.appendChild(removeBtn);
        imagePreview.appendChild(previewItem);
    });
}

// Remove image from selection
function removeImage(index) {
    selectedImages.splice(index, 1);
    updateImagePreview();
}

// Add specification row
function addSpecRow(keyValue = '', placeholder = '') {
    const specInputs = document.getElementById('specInputs');
    
    const specRow = document.createElement('div');
    specRow.className = 'spec-row';
    
    specRow.innerHTML = `
        <input type="text" class="form-input spec-key" 
               placeholder="Tên thông số" value="${keyValue}">
        <input type="text" class="form-input spec-value" 
               placeholder="${placeholder || 'Giá trị thông số'}">
        <button type="button" class="remove-spec-btn" onclick="removeSpecRow(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    specInputs.appendChild(specRow);
}

// Remove specification row
function removeSpecRow(button) {
    const specRow = button.closest('.spec-row');
    const specInputs = document.getElementById('specInputs');
    
    // Keep at least one spec row
    if (specInputs.children.length > 1) {
        specRow.remove();
    } else {
        showError('Cần ít nhất một thông số kỹ thuật');
    }
}

// Auto-generate SKU
function generateSKU() {
    const name = document.getElementById('productName').value;
    const brand = document.getElementById('productBrand').value;
    const skuField = document.getElementById('productSku');
    
    if (name && brand && !skuField.value) {
        const nameAbbr = name.replace(/[^A-Za-z0-9]/g, '').substring(0, 6).toUpperCase();
        const brandAbbr = brand.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        
        skuField.value = `${brandAbbr}-${nameAbbr}-${timestamp}`;
    }
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    console.log('Form submitted! Preventing default submission...');
    
    try {
        setSubmitLoading(true);
        hideMessages();
        
        console.log('Starting form submission process...');
        
        // Validate form
        const formData = validateAndGetFormData();
        if (!formData) {
            console.log('Form validation failed');
            return;
        }
        
        console.log('Form validation passed:', formData);
        
        // Upload images first
        if (selectedImages.length > 0) {
            console.log('Uploading images...');
            uploadedImageUrls = await uploadImages();
            formData.images = uploadedImageUrls;
            console.log('Images uploaded successfully:', uploadedImageUrls);
        }
        
        // Check if this is a main product with variants
        const willCreateVariants = document.getElementById('isVariant') && 
                                 document.getElementById('isVariant').checked;
        
        if (willCreateVariants) {
            console.log('Creating main product with variants workflow...');
            await handleMainProductWithVariants(formData);
        } else {
            console.log('Creating regular product...');
            // Add product to Firestore
            console.log('Attempting to add product to Firestore...');
            console.log('Form data:', formData);
            
            const docRef = await addDoc(collection(db, 'products'), {
                ...formData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: 'active'
            });
            
            console.log('Product added with ID: ', docRef.id);
            showSuccess(`Sản phẩm "${formData.name}" đã được thêm thành công! ID: ${docRef.id}`);
            
            // Reset form after successful submission
            setTimeout(() => {
                resetForm();
            }, 3000);
        }
        
    } catch (error) {
        console.error('Error adding product: ', error);
        showError('Có lỗi xảy ra khi thêm sản phẩm: ' + error.message);
    } finally {
        setSubmitLoading(false);
    }
}

// Validate and get form data
function validateAndGetFormData() {
    console.log('validateAndGetFormData: Starting validation...');
    
    // Check if this is a variant product
    const isVariant = document.getElementById('isVariant') && document.getElementById('isVariant').checked;
    const variantFormVisible = document.getElementById('variantForm') && 
                              document.getElementById('variantForm').style.display === 'block';
    
    console.log('validateAndGetFormData: isVariant =', isVariant);
    console.log('validateAndGetFormData: variantFormVisible =', variantFormVisible);
    
    let name, category, brand, price, stock, availability, sku;
    
    if (isVariant && variantFormVisible) {
        console.log('validateAndGetFormData: Getting variant form values...');
        
        // Get values from variant form
        name = document.getElementById('variantName').value.trim();
        sku = document.getElementById('variantSku').value.trim();
        price = parseFloat(document.getElementById('variantPrice').value);
        stock = parseInt(document.getElementById('variantStock').value);
        
        // Get parent product values for other fields
        category = document.getElementById('productCategory').value;
        brand = document.getElementById('productBrand').value.trim();
        availability = document.getElementById('productAvailability').value;
        
        console.log('validateAndGetFormData: Variant values - name:', name, 'price:', price, 'stock:', stock);
    } else {
        console.log('validateAndGetFormData: Getting main form values...');
        
        // Get values from main form
        name = document.getElementById('productName').value.trim();
        category = document.getElementById('productCategory').value;
        brand = document.getElementById('productBrand').value.trim();
        price = parseFloat(document.getElementById('productPrice').value);
        stock = parseInt(document.getElementById('productStock').value);
        availability = document.getElementById('productAvailability').value;
    }
    
    console.log('validateAndGetFormData: Checking required fields...');
    console.log('validateAndGetFormData: name:', name, 'category:', category, 'brand:', brand, 'price:', price, 'stock:', stock, 'availability:', availability);
    
    // Required field validation
    if (!name || !category || !brand || isNaN(price) || isNaN(stock) || !availability) {
        console.log('validateAndGetFormData: Missing required fields');
        showError('Vui lòng điền đầy đủ các trường bắt buộc (*)');
        return null;
    }
    
    if (price <= 0) {
        console.log('validateAndGetFormData: Invalid price');
        showError('Giá sản phẩm phải lớn hơn 0');
        return null;
    }
    
    if (stock < 0) {
        console.log('validateAndGetFormData: Invalid stock');
        showError('Số lượng tồn kho phải >= 0');
        return null;
    }
    
    // Get optional fields
    if (!sku) {
        sku = document.getElementById('productSku').value.trim();
    }
    const description = document.getElementById('productDescription').value.trim();
    const oldPrice = parseFloat(document.getElementById('productOldPrice').value) || null;
    const rating = parseFloat(document.getElementById('productRating').value) || 5.0;
    const reviewCount = parseInt(document.getElementById('productReviews').value) || 0;
    
    // Get specifications
    const specifications = {};
    const specRows = document.querySelectorAll('.spec-row');
    specRows.forEach(row => {
        const key = row.querySelector('.spec-key').value.trim();
        const value = row.querySelector('.spec-value').value.trim();
        if (key && value) {
            specifications[key] = value;
        }
    });
    
    // Prepare the base product data
    const productData = {
        name,
        category,
        brand,
        sku,
        description,
        price,
        oldPrice,
        stock,
        availability,
        rating: Math.min(Math.max(rating, 1), 5), // Ensure rating is between 1-5
        reviewCount: Math.max(reviewCount, 0),
        specifications,
        images: []
    };
    
    console.log('validateAndGetFormData: Base product data:', productData);
    
    // Add variant-specific fields if this is a variant
    if (isVariant) {
        productData.has_variant = true;
        
        // Check if this is a variant of another product
        const parentProductId = document.getElementById('parentProductId');
        if (parentProductId && parentProductId.value.trim()) {
            productData.parent_id_product = parentProductId.value.trim();
            
            // Collect variant attributes if creating a variant
            if (variantFormVisible) {
                const attributeRows = document.querySelectorAll('.attribute-row');
                const variantAttributes = {};
                
                attributeRows.forEach(row => {
                    const nameInput = row.querySelector('.variant-attr-name');
                    const valueInput = row.querySelector('.variant-attr-value');
                    
                    if (nameInput && valueInput && nameInput.value.trim() && valueInput.value.trim()) {
                        variantAttributes[nameInput.value.trim()] = valueInput.value.trim();
                    }
                });
                
                if (Object.keys(variantAttributes).length > 0) {
                    productData.variant_attributes = variantAttributes;
                }
            }
        }
    } else {
        productData.has_variant = false;
    }
    
    console.log('validateAndGetFormData: Final product data:', productData);
    console.log('validateAndGetFormData: Validation successful!');
    
    return productData;
}

// Upload images to Firebase Storage
async function uploadImages() {
    const imageUrls = [];
    
    for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        const filename = `products/${Date.now()}_${i}_${file.name}`;
        const storageRef = ref(storage, filename);
        
        try {
            // Update progress
            updateProgress((i / selectedImages.length) * 100);
            
            // Upload file
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            imageUrls.push(downloadURL);
            
        } catch (error) {
            console.error('Error uploading image:', error);
            throw new Error(`Lỗi upload ảnh ${file.name}: ${error.message}`);
        }
    }
    
    // Complete progress
    updateProgress(100);
    
    return imageUrls;
}

// Update upload progress
function updateProgress(percent) {
    uploadProgress.style.display = 'block';
    progressFill.style.width = percent + '%';
    
    if (percent >= 100) {
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            progressFill.style.width = '0%';
        }, 1000);
    }
}

// Set submit button loading state
function setSubmitLoading(loading) {
    submitBtn.disabled = loading;
    loadingSpinner.style.display = loading ? 'inline-block' : 'none';
    submitBtn.innerHTML = loading ? 
        '<span class="loading-spinner" style="display: inline-block;"></span>ĐANG XỬ LÝ...' :
        '<i class="fas fa-save"></i> THÊM SẢN PHẨM';
}

// Show success message
function showSuccess(message) {
    const messageSpan = successMessage.querySelector('span');
    messageSpan.textContent = message;
    successMessage.style.display = 'flex';
    successMessage.style.opacity = '0';
    successMessage.style.transform = 'translateY(-10px)';
    
    // Animate in
    setTimeout(() => {
        successMessage.style.transition = 'all 0.3s ease';
        successMessage.style.opacity = '1';
        successMessage.style.transform = 'translateY(0)';
    }, 10);
    
    // Auto hide after 8 seconds
    setTimeout(() => {
        successMessage.style.transition = 'all 0.3s ease';
        successMessage.style.opacity = '0';
        successMessage.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 300);
    }, 8000);
}

// Show error message
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    errorMessage.style.opacity = '0';
    errorMessage.style.transform = 'translateY(-10px)';
    
    // Animate in
    setTimeout(() => {
        errorMessage.style.transition = 'all 0.3s ease';
        errorMessage.style.opacity = '1';
        errorMessage.style.transform = 'translateY(0)';
    }, 10);
    
    // Auto hide after 10 seconds
    setTimeout(() => {
        errorMessage.style.transition = 'all 0.3s ease';
        errorMessage.style.opacity = '0';
        errorMessage.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 300);
    }, 10000);
}

// Hide all messages
function hideMessages() {
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
}

// Reset form
function resetForm() {
    productForm.reset();
    selectedImages = [];
    uploadedImageUrls = [];
    updateImagePreview();
    addInitialSpecRows();
}

// Note: Variant submission now handled directly in EJS with Firebase imports

// Export functions to global scope for onclick handlers
window.addSpecRow = addSpecRow;
window.removeSpecRow = removeSpecRow;