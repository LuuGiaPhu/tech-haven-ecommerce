// =====================================
//    REVENUE STATISTICS PAGE
// =====================================

let revenueChart, ordersChart, topProductsChart, categoryChart;
let currentPeriod = 'week';
let billsData = [];
let usersData = []; // Store users data
let productsData = {}; // Store products info by ID for category lookup

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 Revenue page loaded');
    initializePage();
});

async function initializePage() {
    // Set default date range
    setDefaultDateRange();
    
    // Setup event listeners
    setupEventListeners();
    
    // Wait for Firebase Auth to be ready
    console.log('⏳ Waiting for Firebase Auth...');
    await new Promise((resolve) => {
        const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
            console.log('🔐 Auth state changed:', user ? user.email : 'No user');
            unsubscribe();
            resolve();
        });
    });
    
    // Load products data first (for category mapping)
    await loadProductsData();
    
    // Load users data
    await loadUsersData();
    
    // Load bills data
    await loadBillsData();
    
    // Initialize charts
    initializeCharts();
    
    // Update statistics
    updateStatistics();
}

// Set default date range based on period
function setDefaultDateRange() {
    const endDate = new Date();
    const startDate = new Date();
    
    switch(currentPeriod) {
        case 'week':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
        case 'quarter':
            startDate.setMonth(endDate.getMonth() - 3);
            break;
        case 'year':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
    }
    
    document.getElementById('startDate').valueAsDate = startDate;
    document.getElementById('endDate').valueAsDate = endDate;
}

// Setup event listeners
function setupEventListeners() {
    // Period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPeriod = this.dataset.period;
            setDefaultDateRange();
            updateStatistics();
        });
    });
}

// Load products data for category mapping
async function loadProductsData() {
    try {
        console.log('📦 Loading products data for category mapping...');
        
        const response = await fetch('/api/products', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.warn('⚠️ Failed to load products data:', response.status);
            return;
        }
        
        const data = await response.json();
        const products = data.products || [];
        
        console.log('📦 Raw products API response:', {
            success: data.success,
            totalProducts: products.length,
            sampleProduct: products[0]
        });
        
        // Create a map of product ID -> product info
        products.forEach(product => {
            productsData[product.id] = {
                name: product.name,
                category: product.category || 'Other',
                price: product.price
            };
        });
        
        console.log(`✅ Loaded ${products.length} products for category mapping`);
        console.log('📊 Products data sample:', Object.keys(productsData).slice(0, 5).map(id => ({
            id,
            name: productsData[id].name,
            category: productsData[id].category
        })));
        
        // Show all unique categories found
        const uniqueCategories = [...new Set(Object.values(productsData).map(p => p.category))];
        console.log('📂 All categories found in products:', uniqueCategories);
        
    } catch (error) {
        console.error('❌ Error loading products data:', error);
        productsData = {}; // Use empty object on error
    }
}

// Load users data from Firebase
async function loadUsersData() {
    try {
        console.log('👥 Loading users data...');
        
        // Get Firebase Auth token
        let idToken = null;
        try {
            const currentUser = window.firebaseAuth?.currentUser;
            if (currentUser) {
                idToken = await currentUser.getIdToken(true);
                console.log('✅ Got auth token for users API');
            } else {
                console.warn('⚠️ No current user, attempting API call without token');
            }
        } catch (authError) {
            console.error('❌ Auth error:', authError);
            throw new Error('Failed to authenticate. Please log in again.');
        }
        
        const headers = {
            'Accept': 'application/json'
        };
        
        if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
        }
        
        const response = await fetch('/api/users', {
            credentials: 'include',
            headers: headers
        });
        
        console.log('📥 Users response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Users response error:', errorText);
            
            if (response.status === 401) {
                throw new Error('Unauthorized. Please log in as admin.');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        
        const data = await response.json();
        console.log('👥 Raw users API response:', data);
        
        usersData = data.users || [];
        
        console.log(`✅ Loaded ${usersData.length} users`);
        if (usersData.length > 0) {
            console.log('👤 First user sample:', usersData[0]);
            console.log('👤 Last user sample:', usersData[usersData.length - 1]);
        }
        
    } catch (error) {
        console.error('❌ Error loading users:', error);
        usersData = [];
    }
}

// Load bills data from Firebase
async function loadBillsData() {
    showLoading();
    
    try {
        console.log('📦 Loading bills data...');
        
        // Get Firebase Auth token
        let idToken = null;
        try {
            const currentUser = window.firebaseAuth?.currentUser;
            if (currentUser) {
                idToken = await currentUser.getIdToken();
                console.log('🔑 Got auth token for user:', currentUser.email);
            } else {
                console.warn('⚠️ No user logged in, waiting for auth state...');
                
                // Wait for auth state to be ready
                await new Promise((resolve) => {
                    const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
                        unsubscribe();
                        resolve(user);
                    });
                });
                
                const user = window.firebaseAuth.currentUser;
                if (user) {
                    idToken = await user.getIdToken();
                    console.log('🔑 Got auth token after waiting:', user.email);
                } else {
                    console.error('❌ No authenticated user found');
                    throw new Error('Authentication required. Please log in.');
                }
            }
        } catch (authError) {
            console.error('❌ Auth error:', authError);
            throw new Error('Failed to authenticate. Please log in again.');
        }
        
        const headers = {
            'Accept': 'application/json'
        };
        
        if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
        }
        
        const response = await fetch('/api/bills', {
            credentials: 'include',
            headers: headers
        });
        
        console.log('📥 Response status:', response.status, response.statusText);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Response error:', errorText);
            
            if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            } else if (response.status === 403) {
                throw new Error('Admin access required. You do not have permission.');
            }
            
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📦 Raw API response:', data);
        console.log('📊 API response details:', {
            success: data.success,
            totalBills: data.total,
            uniqueUsers: data.uniqueUsers,
            billsArrayLength: data.bills?.length
        });
        
        billsData = data.bills || [];
        
        console.log(`✅ Loaded ${billsData.length} bills`);
        if (billsData.length > 0) {
            console.log('📋 First bill sample:', billsData[0]);
            console.log('📋 Last bill sample:', billsData[billsData.length - 1]);
        }
        
        // Debug: Show unique userIds
        const uniqueUserIds = [...new Set(billsData.map(bill => bill.userId))];
        console.log(`👥 Unique users in bills: ${uniqueUserIds.length}`, uniqueUserIds);
        
        // Debug: Show bill distribution by user
        const userBillCounts = {};
        billsData.forEach(bill => {
            const userId = bill.userId || 'NO_USER_ID';
            userBillCounts[userId] = (userBillCounts[userId] || 0) + 1;
        });
        console.log('📊 Bills by user:', userBillCounts);
        
        // Debug: Show bill distribution by email
        const emailBillCounts = {};
        billsData.forEach(bill => {
            const email = bill.email || bill.customerEmail || 'NO_EMAIL';
            emailBillCounts[email] = (emailBillCounts[email] || 0) + 1;
        });
        console.log('📧 Bills by email:', emailBillCounts);
        
    } catch (error) {
        console.error('❌ Error loading bills:', error);
        
        // More user-friendly error messages
        let errorMessage = 'Không thể tải dữ liệu. ';
        if (error.message.includes('Authentication')) {
            errorMessage += 'Vui lòng đăng nhập lại.';
        } else if (error.message.includes('permission')) {
            errorMessage += 'Bạn không có quyền truy cập trang này.';
        } else {
            errorMessage += 'Vui lòng thử lại sau.';
        }
        
        showError(errorMessage);
        billsData = [];
    } finally {
        hideLoading();
    }
}

// Filter bills by date range
function getFilteredBills() {
    const startDateInput = document.getElementById('startDate').value;
    const endDateInput = document.getElementById('endDate').value;
    
    console.log('🔍 Filtering bills:', { startDateInput, endDateInput, totalBills: billsData.length });
    
    // If no date range selected, return all bills
    if (!startDateInput || !endDateInput) {
        console.log('⚠️ No date range selected, returning all bills');
        return billsData;
    }
    
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);
    endDate.setHours(23, 59, 59, 999); // Include the whole end date
    
    const filtered = billsData.filter(bill => {
        // Convert createdAt to Date object (handle both ISO string and Timestamp object)
        let billDate;
        if (typeof bill.createdAt === 'string') {
            billDate = new Date(bill.createdAt);
        } else if (bill.createdAt?.toDate) {
            billDate = bill.createdAt.toDate();
        } else if (bill.createdAt?._seconds) {
            billDate = new Date(bill.createdAt._seconds * 1000);
        } else {
            console.warn('⚠️ Invalid createdAt format:', bill.createdAt);
            return false;
        }
        
        return billDate >= startDate && billDate <= endDate;
    });
    
    console.log(`✅ Filtered ${filtered.length} bills from ${billsData.length} total`);
    return filtered;
}

// Apply date filter
function applyDateFilter() {
    console.log('🔍 Applying date filter...');
    updateStatistics();
}

// Update all statistics
function updateStatistics() {
    const filteredBills = getFilteredBills();
    
    // Update summary cards
    updateSummaryCards(filteredBills);
    
    // Update charts
    updateRevenueChart(filteredBills);
    updateOrdersChart(filteredBills);
    updateTopProductsChart(filteredBills);
    updateCategoryChart(filteredBills);
    
    // Update table
    updateTable(filteredBills);
}

// Update summary cards
function updateSummaryCards(bills) {
    // Only count completed bills for revenue calculations
    const completedBills = bills.filter(bill => bill.status === 'completed');
    
    console.log('📊 Summary cards calculation:', {
        totalBills: bills.length,
        completedBills: completedBills.length,
        statuses: bills.reduce((acc, bill) => {
            acc[bill.status] = (acc[bill.status] || 0) + 1;
            return acc;
        }, {})
    });
    
    // Total revenue (only completed orders)
    const totalRevenue = completedBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
    // Display shortened value, but keep full value in title (tooltip)
    const totalRevenueEl = document.getElementById('totalRevenue');
    if (totalRevenueEl) {
        totalRevenueEl.textContent = formatPriceShort(totalRevenue) + ' ₫';
        // Provide native title and a data attribute for a custom CSS tooltip
        const fullTotal = formatPrice(totalRevenue);
        totalRevenueEl.setAttribute('title', fullTotal);
        totalRevenueEl.setAttribute('data-full', fullTotal);
        totalRevenueEl.setAttribute('tabindex', '0');
    }
    
    // Total orders (all bills including all statuses)
    document.getElementById('totalOrders').textContent = bills.length;
    
    // Average order value (only completed orders)
    const avgOrderValue = completedBills.length > 0 ? totalRevenue / completedBills.length : 0;
    const avgOrderEl = document.getElementById('avgOrderValue');
    if (avgOrderEl) {
        avgOrderEl.textContent = formatPriceShort(avgOrderValue) + ' ₫';
        const fullAvg = formatPrice(avgOrderValue);
        avgOrderEl.setAttribute('title', fullAvg);
        avgOrderEl.setAttribute('data-full', fullAvg);
        avgOrderEl.setAttribute('tabindex', '0');
    }
    
    // Top product (based on quantity sold, only completed orders)
    const productCounts = {};
    completedBills.forEach(bill => {
        // Check both 'products' (correct field) and 'items' (legacy field) for compatibility
        const productList = bill.products || bill.items;
        if (productList && Array.isArray(productList)) {
            productList.forEach(item => {
                const productName = item.name || item.productName || 'Unknown';
                productCounts[productName] = (productCounts[productName] || 0) + (item.quantity || 1);
            });
        }
    });
    
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topProduct').textContent = topProduct ? topProduct[0] : '---';
    
    // Update user statistics
    updateUserStatistics();
}

// Update user statistics (total users and new users)
function updateUserStatistics() {
    // Total users
    const totalUsers = usersData.length;
    document.getElementById('totalUsers').textContent = totalUsers;
    
    // New users in selected date range
    const startDateInput = document.getElementById('startDate').value;
    const endDateInput = document.getElementById('endDate').value;
    
    if (!startDateInput || !endDateInput) {
        // If no date range selected, count all users as new
        document.getElementById('newUsers').textContent = totalUsers;
        return;
    }
    
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);
    endDate.setHours(23, 59, 59, 999);
    
    const newUsers = usersData.filter(user => {
        const userCreatedDate = convertToDate(user.createdAt);
        return userCreatedDate >= startDate && userCreatedDate <= endDate;
    });
    
    console.log('👥 User statistics:', {
        totalUsers,
        newUsersCount: newUsers.length,
        dateRange: { startDate, endDate }
    });
    
    document.getElementById('newUsers').textContent = newUsers.length;
}

// Initialize charts
function initializeCharts() {
    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    revenueChart = new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Doanh Thu',
                data: [],
                borderColor: '#FF9CEE',
                backgroundColor: 'rgba(255, 156, 238, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#FF9CEE',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#333',
                    bodyColor: '#666',
                    borderColor: '#FFB5E8',
                    borderWidth: 2,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return 'Doanh thu: ' + formatPrice(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatPriceShort(value);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Orders Chart
    const ordersCtx = document.getElementById('ordersChart').getContext('2d');
    ordersChart = new Chart(ordersCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Đơn Hàng',
                data: [],
                backgroundColor: 'rgba(197, 179, 255, 0.8)',
                borderColor: '#C5B3FF',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#333',
                    bodyColor: '#666',
                    borderColor: '#DCD3FF',
                    borderWidth: 2,
                    padding: 12,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Top Products Chart
    const topProductsCtx = document.getElementById('topProductsChart').getContext('2d');
    topProductsChart = new Chart(topProductsCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#FFB5E8',
                    '#DCD3FF',
                    '#AEC6FF',
                    '#FFE5F4',
                    '#F0EBFF'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#333',
                    bodyColor: '#666',
                    borderColor: '#FFB5E8',
                    borderWidth: 2,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `Đã bán: ${value} sản phẩm (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Category Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#FFB5E8',
                    '#DCD3FF',
                    '#AEC6FF',
                    '#FFE5F4',
                    '#F0EBFF',
                    '#E3ECFF'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#333',
                    bodyColor: '#666',
                    borderColor: '#DCD3FF',
                    borderWidth: 2,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            const categoryName = context.label;
                            
                            // Get revenue for this category from the global categoryRevenues
                            // This is a workaround since we're displaying quantity but want to show revenue in tooltip
                            return `Số lượng: ${value} sản phẩm (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update Revenue Chart
function updateRevenueChart(bills) {
    // Only include completed bills in revenue chart
    const completedBills = bills.filter(bill => bill.status === 'completed');
    const groupedData = groupBillsByPeriod(completedBills);
    
    revenueChart.data.labels = groupedData.labels;
    revenueChart.data.datasets[0].data = groupedData.revenues;
    revenueChart.update();
}

// Update Orders Chart
function updateOrdersChart(bills) {
    // Only include completed bills in orders chart
    const completedBills = bills.filter(bill => bill.status === 'completed');
    const groupedData = groupBillsByPeriod(completedBills);
    
    ordersChart.data.labels = groupedData.labels;
    ordersChart.data.datasets[0].data = groupedData.counts;
    ordersChart.update();
}

// Update Top Products Chart
function updateTopProductsChart(bills) {
    // Only include completed bills
    const completedBills = bills.filter(bill => bill.status === 'completed');
    
    console.log('📊 Analyzing Top Products Chart:', { 
        totalBills: bills.length, 
        completedBills: completedBills.length 
    });
    
    // Use product ID + name as unique key to distinguish products with same name
    const productData = {};
    
    completedBills.forEach(bill => {
        // Check both 'products' (correct field) and 'items' (legacy field) for compatibility
        const productList = bill.products || bill.items;
        if (productList && Array.isArray(productList)) {
            productList.forEach(item => {
                const productId = item.id || 'unknown';
                const productName = item.name || item.productName || 'Unknown';
                const quantity = item.quantity || 1;
                
                // Use ID as unique key, but display name for user
                const key = `${productId}`;
                
                if (!productData[key]) {
                    productData[key] = {
                        id: productId,
                        name: productName,
                        totalQuantity: 0
                    };
                }
                
                productData[key].totalQuantity += quantity;
            });
        }
    });
    
    // Get top 5 products by quantity sold
    const top5 = Object.values(productData)
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 5);
    
    console.log('📊 Top 5 Products by Quantity (completed only):', 
        top5.map(product => `${product.name} (ID: ${product.id}): ${product.totalQuantity} sản phẩm`)
    );
    
    // If multiple products have same name, add ID suffix
    const nameCount = {};
    top5.forEach(product => {
        nameCount[product.name] = (nameCount[product.name] || 0) + 1;
    });
    
    const labels = top5.map(product => {
        if (nameCount[product.name] > 1) {
            // Add ID suffix if duplicate names exist
            return `${product.name} (${product.id.substring(0, 6)}...)`;
        }
        return product.name;
    });
    
    topProductsChart.data.labels = labels;
    topProductsChart.data.datasets[0].data = top5.map(item => item.totalQuantity);
    topProductsChart.update();
}

// Update Category Chart
function updateCategoryChart(bills) {
    // Only include completed bills
    const completedBills = bills.filter(bill => bill.status === 'completed');
    
    console.log('📊 Analyzing Category Chart:', { 
        totalBills: bills.length, 
        completedBills: completedBills.length,
        productsDataLoaded: Object.keys(productsData).length 
    });
    
    const categoryRevenues = {};
    const categoryQuantities = {};
    const productIdsMissing = [];
    
    completedBills.forEach((bill, billIndex) => {
        // Check both 'products' (correct field) and 'items' (legacy field) for compatibility
        const productList = bill.products || bill.items;
        if (productList && Array.isArray(productList)) {
            console.log(`📦 Bill ${billIndex + 1} products:`, productList.map(p => ({ 
                id: p.id, 
                name: p.name,
                hasProductData: !!productsData[p.id],
                productCategory: productsData[p.id]?.category
            })));
            
            productList.forEach(item => {
                const productId = item.id;
                const price = item.price || 0;
                const quantity = item.quantity || 1;
                
                // Get category from productsData map using product ID
                let category = 'Other';
                let categorySource = 'default';
                
                if (productId && productsData[productId]) {
                    const rawCategory = productsData[productId].category;
                    category = formatCategoryName(rawCategory);
                    categorySource = 'productsData';
                    console.log(`✅ Product ${productId} (${item.name}): ${rawCategory} → ${category}`);
                } else {
                    // Fallback: try to get category from item directly (legacy)
                    if (item.category) {
                        const rawCategory = item.category;
                        category = formatCategoryName(rawCategory);
                        categorySource = 'item.category';
                        console.log(`⚠️ Product ${productId} using fallback category from item: ${rawCategory} → ${category}`);
                    } else {
                        category = 'Other';
                        categorySource = 'default';
                        if (productId) {
                            productIdsMissing.push(productId);
                            console.warn(`❌ Product ID ${productId} (${item.name}) not found in productsData and no item.category, using: Other`);
                        }
                    }
                }
                
                categoryRevenues[category] = (categoryRevenues[category] || 0) + (price * quantity);
                categoryQuantities[category] = (categoryQuantities[category] || 0) + quantity;
            });
        }
    });
    
    if (productIdsMissing.length > 0) {
        console.error('❌ Missing product IDs in productsData:', [...new Set(productIdsMissing)]);
    }
    
    console.log('📊 Category Distribution (completed only):', {
        revenues: categoryRevenues,
        quantities: categoryQuantities
    });
    
    // Sort by revenue (highest first)
    const sortedCategories = Object.entries(categoryRevenues)
        .sort((a, b) => b[1] - a[1]);
    
    console.log('📊 Sorted Categories:', sortedCategories.map(([name, revenue]) => 
        `${name}: ${formatPrice(revenue)} (${categoryQuantities[name]} items)`
    ));
    
    // Sort by quantity instead of revenue for better representation
    const sortedByQuantity = Object.entries(categoryQuantities)
        .sort((a, b) => b[1] - a[1]);
    
    console.log('📊 Categories by Quantity:', sortedByQuantity.map(([name, qty]) => 
        `${name}: ${qty} sản phẩm (${formatPrice(categoryRevenues[name])})`
    ));
    
    categoryChart.data.labels = sortedByQuantity.map(item => item[0]);
    categoryChart.data.datasets[0].data = sortedByQuantity.map(item => item[1]);
    categoryChart.update();
}

// Group bills by period
function groupBillsByPeriod(bills) {
    const grouped = {};
    
    console.log('📊 Grouping', bills.length, 'bills by period:', currentPeriod);
    
    bills.forEach(bill => {
        const billDate = convertToDate(bill.createdAt);
        let key;
        
        switch(currentPeriod) {
            case 'week':
                key = formatDate(billDate, 'day');
                break;
            case 'month':
                key = formatDate(billDate, 'day');
                break;
            case 'quarter':
                key = formatDate(billDate, 'week');
                break;
            case 'year':
                key = formatDate(billDate, 'month');
                break;
        }
        
        if (!grouped[key]) {
            grouped[key] = {
                revenue: 0,
                count: 0
            };
        }
        
        grouped[key].revenue += bill.totalAmount || 0;
        grouped[key].count += 1;
    });
    
    // Sort by date
    const sortedKeys = Object.keys(grouped).sort();
    
    console.log('✅ Grouped into', sortedKeys.length, 'periods:', sortedKeys);
    
    return {
        labels: sortedKeys,
        revenues: sortedKeys.map(key => grouped[key].revenue),
        counts: sortedKeys.map(key => grouped[key].count)
    };
}

// Format date based on period
function formatDate(date, format) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    switch(format) {
        case 'day':
            return `${day}/${month}`;
        case 'week':
            const weekNum = getWeekNumber(date);
            return `T${weekNum}`;
        case 'month':
            return `${month}/${year}`;
        default:
            return `${day}/${month}/${year}`;
    }
}

// Get week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Update table
function updateTable(bills) {
    const tableBody = document.getElementById('tableBody');
    
    console.log('📋 Updating table with', bills.length, 'bills');
    
    if (bills.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-inbox"></i>
                    Không có dữ liệu trong khoảng thời gian này
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort bills by date (newest first)
    const sortedBills = [...bills].sort((a, b) => {
        const dateA = convertToDate(a.createdAt);
        const dateB = convertToDate(b.createdAt);
        return dateB - dateA;
    });
    
    tableBody.innerHTML = sortedBills.map(bill => {
        const billDate = convertToDate(bill.createdAt);
        // Check both 'products' (correct field) and 'items' (legacy field) for compatibility
        const productList = bill.products || bill.items || [];
        const products = productList.map(item => item.name || item.productName || 'Unknown').join(', ');
        const totalQuantity = productList.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        // Status mapping - handle all possible statuses
        const statusMap = {
            'pending': { class: 'status-pending', text: 'Chờ Xử Lý' },
            'processing': { class: 'status-processing', text: 'Đang Xử Lý' },
            'shipping': { class: 'status-shipping', text: 'Đang Giao' },
            'delivered': { class: 'status-delivered', text: 'Đã Giao' },
            'completed': { class: 'status-completed', text: 'Hoàn Thành' },
            'cancelled': { class: 'status-cancelled', text: 'Đã Hủy' }
        };
        
        const status = statusMap[bill.status] || { class: 'status-pending', text: bill.status || 'N/A' };
        
        return `
            <tr>
                <td>${bill.id || 'N/A'}</td>
                <td>${formatDate(billDate, 'full')}</td>
                <td>${bill.name || bill.customerName || bill.email || 'N/A'}</td>
                <td title="${products}">${products.length > 50 ? products.substring(0, 50) + '...' : products}</td>
                <td>${totalQuantity}</td>
                <td>${formatPrice(bill.totalAmount || 0)}</td>
                <td><span class="status-badge ${status.class}">${status.text}</span></td>
            </tr>
        `;
    }).join('');
    
    console.log('✅ Table updated successfully');
}

// Export to CSV
function exportToCSV() {
    const filteredBills = getFilteredBills();
    
    if (filteredBills.length === 0) {
        alert('Không có dữ liệu để xuất');
        return;
    }
    
    // CSV Header
    let csv = 'Mã Đơn,Ngày,Khách Hàng,Sản Phẩm,Số Lượng,Tổng Tiền,Trạng Thái\n';
    
    // CSV Data
    filteredBills.forEach(bill => {
        const billDate = convertToDate(bill.createdAt);
        // Check both 'products' (correct field) and 'items' (legacy field) for compatibility
        const productList = bill.products || bill.items || [];
        const products = productList.map(item => item.name || item.productName || 'Unknown').join('; ');
        const totalQuantity = productList.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        // Status mapping for CSV
        const statusTextMap = {
            'pending': 'Chờ Xử Lý',
            'processing': 'Đang Xử Lý',
            'shipping': 'Đang Giao',
            'delivered': 'Đã Giao',
            'completed': 'Hoàn Thành',
            'cancelled': 'Đã Hủy'
        };
        const statusText = statusTextMap[bill.status] || bill.status || 'N/A';
        
        csv += `${bill.id || 'N/A'},${formatDate(billDate, 'full')},${bill.name || bill.customerName || bill.email || 'N/A'},"${products}",${totalQuantity},${bill.totalAmount || 0},${statusText}\n`;
    });
    
    // Download CSV
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue_${formatDate(new Date(), 'full').replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ CSV exported successfully');
}

// Utility Functions
// Convert various date formats to Date object
function convertToDate(dateValue) {
    if (!dateValue) return new Date();
    
    // If already a Date object
    if (dateValue instanceof Date) {
        return dateValue;
    }
    
    // If ISO string
    if (typeof dateValue === 'string') {
        return new Date(dateValue);
    }
    
    // If Firestore Timestamp object with toDate method
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
    }
    
    // If Firestore Timestamp object with _seconds
    if (dateValue._seconds) {
        return new Date(dateValue._seconds * 1000);
    }
    
    // Fallback
    console.warn('⚠️ Unknown date format:', dateValue);
    return new Date(dateValue);
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
}

function formatPriceShort(price) {
    if (price >= 1000000) {
        return (price / 1000000).toFixed(1) + 'M';
    } else if (price >= 1000) {
        return (price / 1000).toFixed(0) + 'K';
    }
    return price.toString();
}

function formatCategoryName(category) {
    if (!category) return 'Other';
    
    // Map of common category names to display names
    const categoryMap = {
        'laptop': 'Laptop',
        'pc': 'PC',
        'desktop': 'Desktop',
        'gaming': 'Gaming',
        'accessories': 'Phụ Kiện',
        'monitor': 'Màn Hình',
        'keyboard': 'Bàn Phím',
        'mouse': 'Chuột',
        'headphone': 'Tai Nghe',
        'speaker': 'Loa',
        'webcam': 'Webcam',
        'other': 'Khác'
    };
    
    // Check if exact match exists
    const lowerCategory = category.toLowerCase().trim();
    if (categoryMap[lowerCategory]) {
        return categoryMap[lowerCategory];
    }
    
    // If no exact match, capitalize first letter of each word
    return category
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function showError(message) {
    alert(message);
}

// Admin navigation function
async function navigateToAdmin(page) {
    console.log('🚀 Navigating to admin page:', page);
    
    // Get the current auth token
    const idToken = localStorage.getItem('idToken');
    
    if (!idToken) {
        console.error('❌ No auth token found');
        alert('⚠️ Vui lòng đăng nhập để truy cập trang admin');
        window.location.href = '/';
        return;
    }
    
    // Check admin status from API to get fresh data
    try {
        console.log('🔍 Checking admin status from server...');
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('❌ Failed to verify admin status:', response.status);
            alert('⚠️ Không thể xác thực quyền admin. Vui lòng đăng nhập lại.');
            window.location.href = '/';
            return;
        }
        
        const data = await response.json();
        console.log('👤 User data from server:', data.user);
        
        const isAdmin = data.user && (data.user.is_admin === true || data.user.isAdmin === true);
        
        if (!isAdmin) {
            console.error('❌ User is not admin. Server says:', data.user);
            alert('⚠️ Bạn không có quyền admin để truy cập trang này');
            return;
        }
        
        // Store user data with admin status for future use
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            window.currentUser = data.user;
            console.log('💾 User data saved to localStorage with admin status:', data.user.is_admin);
        }
        
        console.log('✅ Admin confirmed by server, navigating with token to:', page);
        window.location.href = `${page}?token=${encodeURIComponent(idToken)}`;
        
    } catch (error) {
        console.error('❌ Error checking admin status:', error);
        alert('⚠️ Có lỗi xảy ra khi kiểm tra quyền admin. Vui lòng thử lại.');
    }
}

// Make functions globally available
window.applyDateFilter = applyDateFilter;
window.exportToCSV = exportToCSV;
window.navigateToAdmin = navigateToAdmin;

// Debug function for mobile dropdown
window.toggleAdminDropdown = function() {
    const adminDropdown = document.querySelector('.admin-dropdown');
    if (adminDropdown) {
        adminDropdown.classList.toggle('open');
        console.log('🔄 Admin dropdown toggled:', adminDropdown.classList.contains('open') ? 'OPEN' : 'CLOSED');
        return adminDropdown.classList.contains('open');
    } else {
        console.error('❌ Admin dropdown not found');
        return false;
    }
};

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle menu
            navMenu.classList.toggle('active');
            
            // Toggle icon
            const icon = this.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                const icon = mobileMenuToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        });
        
        // Close menu when clicking on a link (except dropdown toggle)
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function(e) {
                // Don't close menu if clicking dropdown toggle
                if (this.classList.contains('dropdown-toggle')) {
                    return;
                }
                
                navMenu.classList.remove('active');
                const icon = mobileMenuToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            });
        });
    }
    
    // Handle admin dropdown toggle on mobile
    const adminDropdown = document.querySelector('.admin-dropdown');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    
    console.log('🔍 Admin dropdown elements:', { 
        adminDropdown: !!adminDropdown, 
        dropdownToggle: !!dropdownToggle,
        windowWidth: window.innerWidth,
        isMobile: window.innerWidth <= 768
    });
    
    if (adminDropdown && dropdownToggle) {
        // Use 'touchstart' for better mobile response, with fallback to 'click'
        const eventType = 'ontouchstart' in window ? 'touchstart' : 'click';
        
        dropdownToggle.addEventListener(eventType, function(e) {
            console.log('📱 Dropdown toggle triggered via:', eventType, '- width:', window.innerWidth);
            
            // Only toggle on mobile (width <= 768px)
            if (window.innerWidth <= 768) {
                e.preventDefault();
                e.stopPropagation();
                
                const wasOpen = adminDropdown.classList.contains('open');
                adminDropdown.classList.toggle('open');
                
                console.log('✅ Dropdown toggled from', wasOpen ? 'OPEN' : 'CLOSED', 'to', !wasOpen ? 'OPEN' : 'CLOSED');
                console.log('📋 Current classes:', adminDropdown.className);
                
                // Force style update
                if (!wasOpen) {
                    const dropdownMenu = adminDropdown.querySelector('.dropdown-menu');
                    if (dropdownMenu) {
                        console.log('📐 Dropdown menu computed styles:', {
                            display: window.getComputedStyle(dropdownMenu).display,
                            opacity: window.getComputedStyle(dropdownMenu).opacity,
                            maxHeight: window.getComputedStyle(dropdownMenu).maxHeight
                        });
                    }
                }
            } else {
                console.log('ℹ️ Not on mobile, using hover behavior');
            }
        }, { passive: false });
        
        // Also add click listener as fallback
        if (eventType !== 'click') {
            dropdownToggle.addEventListener('click', function(e) {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { passive: false });
        }
        
        console.log('✅ Admin dropdown', eventType, 'handler attached');
    } else {
        console.error('❌ Admin dropdown elements not found!');
        if (!adminDropdown) console.error('  - .admin-dropdown not found');
        if (!dropdownToggle) console.error('  - .dropdown-toggle not found');
    }
});
