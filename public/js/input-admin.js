// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
let skuGenerationTimeout = null; // For debouncing SKU generation

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
        nameInput.addEventListener('input', debouncedGenerateSKU);
        brandInput.addEventListener('input', debouncedGenerateSKU);
        console.log('✅ SKU generation listeners attached (with debounce)');
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

// Check if SKU exists in Firestore
async function checkSKUExists(sku) {
    try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('sku', '==', sku));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty; // Returns true if SKU exists
    } catch (error) {
        console.error('Error checking SKU:', error);
        return false;
    }
}

// Generate unique SKU number
async function generateUniqueSKUNumber(brandAbbr, nameFormatted) {
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop
    
    while (attempts < maxAttempts) {
        // Generate random 4-digit number (0001-9999)
        const randomNum = Math.floor(Math.random() * 9999) + 1;
        const paddedNum = randomNum.toString().padStart(4, '0');
        
        // Create SKU: BRAND-Name-0001
        const generatedSKU = `${brandAbbr}-${nameFormatted}-${paddedNum}`;
        
        // Check if this SKU already exists
        const exists = await checkSKUExists(generatedSKU);
        
        if (!exists) {
            return generatedSKU; // Found unique SKU
        }
        
        attempts++;
        console.log(`⚠️ SKU ${generatedSKU} already exists, generating new one... (Attempt ${attempts})`);
    }
    
    // Fallback: use timestamp if couldn't find unique number after max attempts
    const timestamp = Date.now().toString().slice(-4);
    return `${brandAbbr}-${nameFormatted}-${timestamp}`;
}

// Auto-generate SKU with Vietnamese character support and duplicate check
async function generateSKU() {
    const name = document.getElementById('productName').value;
    const brand = document.getElementById('productBrand').value;
    const skuField = document.getElementById('productSku');
    
    if (!skuField) {
        console.warn('⚠️ SKU field not found');
        return;
    }
    
    // Only auto-generate if both name and brand have values
    if (name && brand) {
        // Show loading indicator
        const originalPlaceholder = skuField.placeholder;
        skuField.placeholder = 'Đang tạo mã SKU...';
        skuField.disabled = true;
        
        try {
            // Extract first 3 characters from brand (uppercase, remove special chars but keep Vietnamese)
            const brandAbbr = brand.trim()
                .replace(/[^\p{L}\p{N}]/gu, '') // Remove special characters but keep letters and numbers (including Vietnamese)
                .substring(0, 3)
                .toUpperCase();
            
            // Get name abbreviation (keep Vietnamese characters)
            const nameAbbr = name.trim()
                .replace(/[^\p{L}\p{N}]/gu, '') // Remove special characters but keep letters and numbers (including Vietnamese)
                .substring(0, 15); // Take up to 15 characters from name
            
            // Capitalize first letter of each word in name
            const nameFormatted = nameAbbr.charAt(0).toUpperCase() + nameAbbr.slice(1);
            
            // Generate unique SKU with database check
            const generatedSKU = await generateUniqueSKUNumber(brandAbbr, nameFormatted);
            
            skuField.value = generatedSKU;
            console.log(`✅ Auto-generated unique SKU: ${generatedSKU}`);
            
        } catch (error) {
            console.error('Error generating SKU:', error);
            skuField.value = '';
        } finally {
            // Restore field state
            skuField.placeholder = originalPlaceholder;
            skuField.disabled = false;
        }
    } else if (!name && !brand) {
        // Clear SKU if both fields are empty
        skuField.value = '';
    }
}

// Debounced version of generateSKU to avoid excessive API calls
function debouncedGenerateSKU() {
    // Clear existing timeout
    if (skuGenerationTimeout) {
        clearTimeout(skuGenerationTimeout);
    }
    
    // Set new timeout - wait 800ms after user stops typing
    skuGenerationTimeout = setTimeout(() => {
        generateSKU();
    }, 800);
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
                status: formData.availability // Use availability status instead of hardcoded 'active'
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
    
    // Check if this is a variant product - ONLY use checkbox state, ignore form visibility
    const isVariant = document.getElementById('isVariant') && document.getElementById('isVariant').checked;
    const variantFormVisible = document.getElementById('variantForm') && 
                              document.getElementById('variantForm').style.display === 'block';
    
    console.log('validateAndGetFormData: isVariant =', isVariant);
    console.log('validateAndGetFormData: variantFormVisible =', variantFormVisible);
    
    let name, category, brand, price, stock, availability, sku;
    
    // IMPORTANT: Distinguish between main product with variants vs variant product
    if (isVariant && variantFormVisible) {
        console.log('validateAndGetFormData: Creating VARIANT PRODUCT (child) from variant form...');
        
        // For variant products (child), get specific values from variant form
        name = document.getElementById('variantName').value.trim();
        sku = document.getElementById('variantSku').value.trim();
        price = parseFloat(document.getElementById('variantPrice').value);
        stock = parseInt(document.getElementById('variantStock').value);
        
        // Inherit category, brand, availability from main form
        category = document.getElementById('productCategory').value;
        brand = document.getElementById('productBrand').value.trim();
        availability = document.getElementById('productAvailability').value;
        
        console.log('validateAndGetFormData: Variant child values - name:', name, 'price:', price, 'stock:', stock);
        console.log('validateAndGetFormData: Inherited from main - category:', category, 'brand:', brand, 'availability:', availability);
    } else {
        console.log('validateAndGetFormData: Creating MAIN PRODUCT from main form...');
        // Get values from main form (either regular product OR main product with variants)
        name = document.getElementById('productName').value.trim();
        category = document.getElementById('productCategory').value;
        brand = document.getElementById('productBrand').value.trim();
        price = parseFloat(document.getElementById('productPrice').value);
        stock = parseInt(document.getElementById('productStock').value);
        availability = document.getElementById('productAvailability').value;
        
        if (isVariant) {
            console.log('validateAndGetFormData: This will be main product WITH VARIANTS capability');
        } else {
            console.log('validateAndGetFormData: This will be regular product WITHOUT VARIANTS');
        }
        console.log('validateAndGetFormData: Main form values - name:', name, 'price:', price, 'stock:', stock);
    }
    
    // Required field validation - FIX: use isNaN() instead of !price
    console.log('validateAndGetFormData: Checking required fields...');
    console.log('validateAndGetFormData: name:', name, 'category:', category, 'brand:', brand, 'price:', price, 'stock:', stock, 'availability:', availability);
    
    // Unified validation for all products
    console.log('validateAndGetFormData: Checking required fields...');
    console.log('validateAndGetFormData: name:', name, 'category:', category, 'brand:', brand, 'price:', price, 'stock:', stock, 'availability:', availability);
    
    if (!name || !category || !brand || isNaN(price) || isNaN(stock) || !availability) {
        console.log('validateAndGetFormData: Required field validation failed');
        console.log('validateAndGetFormData: Validation details - name empty:', !name, 'category empty:', !category, 'brand empty:', !brand, 'price invalid:', isNaN(price), 'stock invalid:', isNaN(stock), 'availability empty:', !availability);
        
        if (isVariant && variantFormVisible) {
            showError('Vui lòng điền đầy đủ thông tin biến thể: Tên, Giá, Tồn kho và thông tin kế thừa từ form chính');
        } else {
            showError('Vui lòng điền đầy đủ các trường bắt buộc (*)');
        }
        return null;
    }
    
    if (price <= 0) {
        console.log('validateAndGetFormData: Price validation failed, price:', price);
        showError('Giá sản phẩm phải lớn hơn 0');
        return null;
    }
    
    if (stock < 0) {
        console.log('validateAndGetFormData: Stock validation failed, stock:', stock);
        showError('Số lượng tồn kho không được âm');
        return null;
    }
    
    // Additional validation for variant products (REMOVED parent product requirement)
    if (isVariant) {
        console.log('validateAndGetFormData: Validating variant product...');
        
            const attributeRows = document.querySelectorAll('.attribute-row');
            let hasAttributes = false;
            
            attributeRows.forEach(row => {
                const nameInput = row.querySelector('.variant-attr-name');
                const valueInput = row.querySelector('.variant-attr-value');
                
                if (nameInput && valueInput && nameInput.value.trim() && valueInput.value.trim()) {
                    hasAttributes = true;
                }
            });
            
            // Only require attributes if variant form is being used for detailed variants
            // For simple variant products (just has_variant flag), attributes are optional
            if (!hasAttributes) {
                console.log('validateAndGetFormData: No variant attributes defined, but allowing it for simple variant products');
                // showError('Vui lòng thêm ít nhất một thuộc tính biến thể (VD: Màu sắc, Kích thước)');
                // return null;
            }
        }
    
    // Get optional fields
    if (!sku) {
        sku = document.getElementById('productSku').value.trim();
    }
    const description = document.getElementById('productDescription').value.trim();
    const oldPrice = parseFloat(document.getElementById('productOldPrice').value) || null;
    
    // Set default rating and review count to 0
    const rating = 0;
    const reviewCount = 0;
    
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

    // Get features
    const features = [];
    const featureRows = document.querySelectorAll('.feature-row');
    featureRows.forEach(row => {
        const title = row.querySelector('.feature-title').value.trim();
        const description = row.querySelector('.feature-description').value.trim();
        if (title && description) {
            features.push({
                title: title,
                description: description,
                icon: 'fas fa-star' // default icon
            });
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
        rating: 0, // Default rating is 0 (no ratings yet)
        reviewCount: 0, // Default review count is 0
        specifications,
        features,
        images: []
    };
    
    console.log('validateAndGetFormData: Base product data prepared:', productData);
    
    // Add variant-specific fields based on form state
    if (isVariant && variantFormVisible) {
        console.log('validateAndGetFormData: Processing CHILD VARIANT product...');
        productData.has_variant = true;
        
        // This is a child variant, must have parent ID
        const parentProductId = document.getElementById('parentProductId');
        if (parentProductId && parentProductId.value.trim()) {
            productData.parent_id_product = parentProductId.value.trim();
            console.log('validateAndGetFormData: Child variant with parent ID:', productData.parent_id_product);
        } else {
            showError('Lỗi: Không tìm thấy ID sản phẩm gốc để tạo biến thể');
            return null;
        }
        
        // Collect variant attributes
        const variantAttributes = collectVariantAttributes();
        console.log('validateAndGetFormData: Collected variant attributes:', variantAttributes);
        if (Object.keys(variantAttributes).length > 0) {
            productData.variant_attributes = variantAttributes;
        }
        
    } else if (isVariant && !variantFormVisible) {
        console.log('validateAndGetFormData: Processing MAIN PRODUCT with variants capability...');
        productData.has_variant = true;
        // No parent ID - this is the main product that can have variants
        
    } else {
        console.log('validateAndGetFormData: Processing REGULAR PRODUCT...');
        productData.has_variant = false;
    }
    
    console.log('validateAndGetFormData: Final product data:', productData);
    console.log('validateAndGetFormData: Validation successful!');
    return productData;
}

// Convert image to WebP format with optional resizing
async function convertToWebP(file, quality = 0.85, maxWidth = 1920, maxHeight = 1080) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions while maintaining aspect ratio
            let { width, height } = img;
            
            // Resize if image is too large
            if (width > maxWidth || height > maxHeight) {
                const aspectRatio = width / height;
                
                if (width > height) {
                    width = Math.min(width, maxWidth);
                    height = width / aspectRatio;
                } else {
                    height = Math.min(height, maxHeight);
                    width = height * aspectRatio;
                }
                
                console.log(`Resizing image from ${img.width}x${img.height} to ${Math.round(width)}x${Math.round(height)}`);
            }
            
            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;
            
            // Draw image on canvas with high quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to WebP blob
            canvas.toBlob(
                (blob) => {
                    // Create new file with WebP extension
                    const webpFileName = file.name.replace(/\.[^/.]+$/, '.webp');
                    const webpFile = new File([blob], webpFileName, {
                        type: 'image/webp',
                        lastModified: Date.now()
                    });
                    resolve(webpFile);
                },
                'image/webp',
                quality
            );
        };
        
        img.onerror = function() {
            console.error('Error loading image for conversion');
            resolve(file); // Return original file if conversion fails
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Upload images to Firebase Storage
async function uploadImages() {
    const imageUrls = [];
    
    for (let i = 0; i < selectedImages.length; i++) {
        const originalFile = selectedImages[i];
        
        try {
            // Update progress for conversion
            updateProgress((i / selectedImages.length) * 50, `Đang chuyển đổi ảnh ${i + 1}/${selectedImages.length} sang WebP...`);
            
            // Convert to WebP if it's an image
            let fileToUpload = originalFile;
            if (originalFile.type.startsWith('image/')) {
                console.log(`Converting ${originalFile.name} to WebP...`);
                fileToUpload = await convertToWebP(originalFile, 0.85); // 85% quality
                
                const originalSizeKB = (originalFile.size / 1024).toFixed(1);
                const webpSizeKB = (fileToUpload.size / 1024).toFixed(1);
                const savedKB = (originalSizeKB - webpSizeKB).toFixed(1);
                
                console.log(`Converted to WebP. Original: ${originalSizeKB}KB, WebP: ${webpSizeKB}KB, Saved: ${savedKB}KB`);
            }
            
            // Create filename with WebP extension
            const filename = `products/${Date.now()}_${i}_${fileToUpload.name}`;
            const storageRef = ref(storage, filename);
            
            // Update progress for upload
            updateProgress(50 + (i / selectedImages.length) * 50, `Đang tải lên ảnh ${i + 1}/${selectedImages.length}...`);
            
            // Upload file
            const snapshot = await uploadBytes(storageRef, fileToUpload);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            imageUrls.push(downloadURL);
            
        } catch (error) {
            console.error('Error uploading image:', error);
            throw new Error(`Lỗi upload ảnh ${originalFile.name}: ${error.message}`);
        }
    }
    
    // Complete progress with compression stats
    let totalOriginalSize = 0;
    let totalWebpSize = 0;
    
    // Calculate total savings (approximation)
    for (let i = 0; i < selectedImages.length; i++) {
        const originalFile = selectedImages[i];
        if (originalFile.type.startsWith('image/')) {
            totalOriginalSize += originalFile.size;
            // Estimate WebP size (approximately 25-35% smaller on average)
            totalWebpSize += originalFile.size * 0.7; // Assuming 30% reduction
        }
    }
    
    const savedSize = ((totalOriginalSize - totalWebpSize) / 1024).toFixed(1);
    const compressionRatio = (((totalOriginalSize - totalWebpSize) / totalOriginalSize) * 100).toFixed(1);
    
    updateProgress(100, `Hoàn tất! Đã tiết kiệm ~${savedSize}KB (${compressionRatio}%) nhờ WebP.`);
    
    return imageUrls;
}

// Update upload progress with status message
function updateProgress(percent, message = '') {
    uploadProgress.style.display = 'block';
    progressFill.style.width = percent + '%';
    
    // Update progress text if message is provided
    const progressText = uploadProgress.querySelector('.progress-text');
    if (progressText && message) {
        progressText.textContent = message;
    }
    
    if (percent >= 100) {
        setTimeout(() => {
            uploadProgress.style.display = 'none';
            progressFill.style.width = '0%';
            if (progressText) {
                progressText.textContent = '';
            }
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
    
    // Scroll to top để user thấy thông báo
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Show success message with animation
    successMessage.style.display = 'flex';
    successMessage.style.opacity = '0';
    successMessage.style.transform = 'translateY(-20px) scale(0.9)';
    
    // Animate in with bounce effect
    setTimeout(() => {
        successMessage.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        successMessage.style.opacity = '1';
        successMessage.style.transform = 'translateY(0) scale(1)';
    }, 10);
    
    // Add confetti effect
    createConfetti();
    
    // Play success sound (optional - commented out to avoid audio issues)
    // playSuccessSound();
    
    // Auto hide after 15 seconds with countdown
    let countdown = 15;
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 3 && countdown > 0) {
            const originalMessage = message.split(' (Tự động ẩn')[0]; // Remove existing countdown text
            messageSpan.textContent = `${originalMessage} (Tự động ẩn sau ${countdown}s)`;
        } else if (countdown === 0) {
            clearInterval(countdownInterval);
            hideSuccessMessage();
        }
    }, 1000);
    
    // Store countdown interval for cleanup
    successMessage.countdownInterval = countdownInterval;
}

// Hide success message with animation
window.hideSuccessMessage = function() {
    // Clear countdown interval
    if (successMessage.countdownInterval) {
        clearInterval(successMessage.countdownInterval);
        successMessage.countdownInterval = null;
    }
    
    successMessage.style.transition = 'all 0.3s ease';
    successMessage.style.opacity = '0';
    successMessage.style.transform = 'translateY(-20px) scale(0.9)';
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 300);
}

// Create confetti effect
function createConfetti() {
    // Simple confetti effect using CSS
    const confettiCount = 50;
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-10px';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.borderRadius = '50%';
        confetti.style.pointerEvents = 'none';
        confetti.style.zIndex = '9999';
        confetti.style.animation = `confettiFall ${Math.random() * 2 + 2}s ease-out forwards`;
        
        document.body.appendChild(confetti);
        
        // Remove after animation
        setTimeout(() => {
            confetti.remove();
        }, 4000);
    }
}

// Optional: Play success sound
function playSuccessSound() {
    try {
        // Create a simple success beep using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.log('Could not play success sound:', error);
    }
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

// =====================================
// VARIANT MANAGEMENT FUNCTIONS
// =====================================

// Toggle variant mode
function toggleVariantMode() {
    const isVariant = document.getElementById('isVariant').checked;
    const variantForm = document.getElementById('variantForm');
    const variantActions = document.getElementById('variantActions');
    const variantQuantitySelector = document.getElementById('variantQuantitySelector');
    
    console.log('toggleVariantMode: isVariant =', isVariant);
    
    if (isVariant) {
        // Validate that main form has required fields before enabling variant
        const category = document.getElementById('productCategory').value;
        const brand = document.getElementById('productBrand').value.trim();
        const availability = document.getElementById('productAvailability').value;
        
        if (!category || !brand || !availability) {
            // Uncheck the checkbox and show error
            document.getElementById('isVariant').checked = false;
            showError('Vui lòng điền thông tin cơ bản (Danh mục, Thương hiệu, Trạng thái) trước khi tạo biến thể');
            return;
        }
        
        // Show instructions, quantity selector and variant creation actions
        const variantInstructions = document.getElementById('variantInstructions');
        if (variantInstructions) variantInstructions.style.display = 'block';
        if (variantQuantitySelector) variantQuantitySelector.style.display = 'block';
        if (variantActions) variantActions.style.display = 'block';
        
        // Do NOT show variant form automatically - user must click "Tạo Biến Thể Mới"
        if (variantForm) variantForm.style.display = 'none';
        
        console.log('toggleVariantMode: Enabled variant mode, showing instructions, quantity selector and action buttons');
    } else {
        // Hide variant form, actions, instructions, and quantity selector
        const variantInstructions = document.getElementById('variantInstructions');
        if (variantForm) variantForm.style.display = 'none';
        if (variantActions) variantActions.style.display = 'none';
        if (variantInstructions) variantInstructions.style.display = 'none';
        if (variantQuantitySelector) variantQuantitySelector.style.display = 'none';
        
        // Clear variant form data
        clearVariantForm();
    }
}

// Open variant creator
function openVariantCreator() {
    // First, we need to create the main product before creating variants
    const mainName = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const brand = document.getElementById('productBrand').value.trim();
    
    if (!mainName || !category || !brand) {
        showError('Vui lòng điền đầy đủ thông tin sản phẩm chính trước khi tạo biến thể');
        return;
    }
    
    // Show a message that user should create main product first
    const confirmCreate = confirm(
        'Để tạo biến thể, bạn cần tạo sản phẩm chính trước.\n\n' +
        'Bước 1: Tạo sản phẩm chính với thông tin hiện tại\n' +
        'Bước 2: Sau đó tạo các biến thể\n\n' +
        'Bạn có muốn tiếp tục không?'
    );
    
    if (!confirmCreate) {
        return;
    }
    
    // Show variant form for creating variant
    const variantForm = document.getElementById('variantForm');
    if (variantForm) {
        variantForm.style.display = 'block';
        
        // Pre-fill variant name
        const variantName = document.getElementById('variantName');
        if (variantName && !variantName.value) {
            variantName.value = mainName + ' - Biến thể';
        }
        
        // Scroll to variant form
        variantForm.scrollIntoView({ behavior: 'smooth' });
    }
}

// Close variant form
function closeVariantForm() {
    const variantForm = document.getElementById('variantForm');
    if (variantForm) {
        variantForm.style.display = 'none';
    }
    
    // Clear variant form data
    clearVariantForm();
}

// Clear variant form data
function clearVariantForm() {
    // Clear variant-specific fields
    const variantName = document.getElementById('variantName');
    const variantSku = document.getElementById('variantSku');
    const variantPrice = document.getElementById('variantPrice');
    const variantStock = document.getElementById('variantStock');
    const variantDescription = document.getElementById('variantDescription');
    
    if (variantName) variantName.value = '';
    if (variantSku) variantSku.value = '';
    if (variantPrice) variantPrice.value = '';
    if (variantStock) variantStock.value = '';
    if (variantDescription) variantDescription.value = '';
    
    // Clear all attribute rows except the first one
    const variantAttributes = document.getElementById('variantAttributes');
    if (variantAttributes) {
        const attributeRows = variantAttributes.querySelectorAll('.attribute-row');
        attributeRows.forEach((row, index) => {
            if (index > 0) { // Keep first row, remove others
                row.remove();
            } else {
                // Clear values in first row
                const nameSelect = row.querySelector('.variant-attr-name');
                const valueInput = row.querySelector('.variant-attr-value');
                if (nameSelect) nameSelect.value = '';
                if (valueInput) valueInput.value = '';
            }
        });
    }
}

// Add attribute row
function addAttributeRow() {
    const variantAttributes = document.getElementById('variantAttributes');
    if (!variantAttributes) return;
    
    const attributeId = 'attr_' + Date.now();
    
    const attributeRow = document.createElement('div');
    attributeRow.className = 'attribute-row';
    attributeRow.id = attributeId;
    
    attributeRow.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label>Thuộc Tính</label>
                <select class="variant-attr-name">
                    <option value="">Chọn thuộc tính</option>
                    <option value="color">Màu Sắc</option>
                    <option value="size">Kích Thước</option>
                    <option value="storage">Dung Lượng</option>
                    <option value="ram">RAM</option>
                    <option value="cpu">CPU</option>
                    <option value="gpu">GPU</option>
                    <option value="custom">Khác...</option>
                </select>
            </div>
            <div class="form-group">
                <label>Giá Trị</label>
                <input type="text" class="variant-attr-value" placeholder="VD: Đỏ, 128GB, 16GB RAM...">
            </div>
            <button type="button" class="remove-attr-btn" onclick="removeAttributeRow('${attributeId}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    const addButton = variantAttributes.querySelector('.add-attr-btn');
    variantAttributes.insertBefore(attributeRow, addButton);
}

// Remove attribute row
function removeAttributeRow(attributeId) {
    const attributeRow = document.getElementById(attributeId);
    if (attributeRow) {
        attributeRow.remove();
    }
}

// Collect variant attributes
function collectVariantAttributes() {
    const attributes = {};
    const attributeRows = document.querySelectorAll('#variantAttributes .attribute-row');
    
    attributeRows.forEach(row => {
        const nameElement = row.querySelector('.variant-attr-name');
        const valueElement = row.querySelector('.variant-attr-value');
        
        if (nameElement && valueElement) {
            const name = nameElement.value.trim();
            const value = valueElement.value.trim();
            
            if (name && value) {
                attributes[name] = value;
            }
        }
    });
    
    return attributes;
}

// Handle main product creation with variants workflow
async function handleMainProductWithVariants(formData) {
    try {
        console.log('Creating main product for variants workflow:', formData);
        
        // Mark as main product with variants
        formData.has_variant = true;
        
        // Create main product
        const docRef = await addDoc(collection(db, 'products'), {
            ...formData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: formData.availability // Use availability status instead of hardcoded 'active'
        });
        
        console.log('Main product created with ID:', docRef.id);
        
        // Call the global function to generate variant forms
        if (window.generateVariantForms) {
            window.generateVariantForms(docRef.id, formData);
            showSuccess(`Sản phẩm chính "${formData.name}" đã được tạo! Vui lòng điền thông tin các biến thể.`);
        } else {
            console.error('generateVariantForms function not found');
            showError('Có lỗi với hệ thống biến thể');
        }
        
    } catch (error) {
        console.error('Error creating main product with variants:', error);
        showError('Có lỗi khi tạo sản phẩm chính: ' + error.message);
        throw error;
    }
}

// View existing variants (placeholder)
function viewExistingVariants() {
    showError('Chức năng xem các biến thể đang được phát triển');
}

// Export functions to global scope for onclick handlers
window.addSpecRow = addSpecRow;
window.removeSpecRow = removeSpecRow;
window.toggleVariantMode = toggleVariantMode;
window.openVariantCreator = openVariantCreator;
window.closeVariantForm = closeVariantForm;
window.addAttributeRow = addAttributeRow;
window.removeAttributeRow = removeAttributeRow;
window.viewExistingVariants = viewExistingVariants;
window.handleMainProductWithVariants = handleMainProductWithVariants;