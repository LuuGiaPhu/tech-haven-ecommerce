// =====================================
//       ADDRESS MANAGEMENT
// =====================================

// Global variables for address management
let userAddresses = [];
let selectedAddress = null;
let isEditingAddress = false;
let editingAddressIndex = -1;
let verifiedCoordinates = null; // Store verified coordinates from Google Maps
let isAddressVerified = false; // Flag to check if address is verified
let guestAddresses = []; // Store addresses loaded via OTP for guest users
let isGuestMode = false; // Flag to track if viewing addresses as guest
let currentGuestEmail = ''; // Store current guest email for OTP verification

// Load user addresses on page load
async function loadUserAddresses() {
    if (!window.currentUser) {
        console.log('👤 No authenticated user - loading guest temp address if exists');
        
        // Load guest temp address from localStorage
        const tempAddressStr = localStorage.getItem('guestTempAddress');
        if (tempAddressStr) {
            try {
                const tempAddress = JSON.parse(tempAddressStr);
                userAddresses = [{
                    address: tempAddress.address,
                    city: tempAddress.city,
                    district: tempAddress.district,
                    coordinates: tempAddress.coordinates,
                    isDefault: true,
                    isTemp: true // Mark as temporary address
                }];
                window.userAddresses = userAddresses;
                console.log('✅ Loaded guest temp address:', userAddresses);
                renderAddressList();
                // Auto-select the temp address
                selectAddress(0);
            } catch (e) {
                console.error('❌ Error parsing guest temp address:', e);
            }
        } else {
            console.log('📍 No guest temp address found');
        }
        return;
    }
    
    try {
        let response;
        
        // Check if user is manual login (has localStorage data) or Google login (has Firebase auth)
        const storedUser = localStorage.getItem('techHavenUser');
        const isManualUser = storedUser && window.currentUser.provider === 'manual';
        
        if (isManualUser) {
            // Use UID-based endpoint for manual users
            console.log('📍 Loading addresses for manual user via UID:', window.currentUser.uid);
            response = await fetch(`/api/user/addresses/by-uid/${window.currentUser.uid}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } else {
            // Use token-based endpoint for Google users
            console.log('📍 Loading addresses for Google user via token');
            const token = await window.getIdToken();
            response = await fetch('/api/user/addresses', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        
        if (response.ok) {
            const data = await response.json();
            userAddresses = data.addresses || [];
            window.userAddresses = userAddresses; // Export to global scope
            console.log('✅ Loaded user addresses:', userAddresses.length);
            renderAddressList();
            
            // Auto-select default address if exists
            const defaultAddress = userAddresses.find(addr => addr.isDefault);
            if (defaultAddress) {
                selectAddress(userAddresses.indexOf(defaultAddress));
            }
        } else {
            console.error('❌ Error loading addresses:', response.status);
        }
    } catch (error) {
        console.error('❌ Error loading addresses:', error);
    }
}

// Render address list in checkout modal
function renderAddressList() {
    const addressList = document.getElementById('addressList');
    const noAddresses = document.getElementById('noAddresses');
    
    if (!addressList) return;
    
    // Determine which addresses to display
    const addressesToRender = isGuestMode ? guestAddresses : userAddresses;
    
    if (addressesToRender.length === 0) {
        addressList.innerHTML = '';
        if (noAddresses) {
            if (isGuestMode) {
                noAddresses.innerHTML = '<p style="text-align: center; color: #666;">Không tìm thấy địa chỉ nào.</p>';
            }
            noAddresses.style.display = 'block';
        }
        return;
    }
    
    if (noAddresses) noAddresses.style.display = 'none';
    
    addressList.innerHTML = addressesToRender.map((address, index) => `
        <div class="address-item ${address.isDefault ? 'default' : ''} ${selectedAddress === index ? 'selected' : ''}" 
             onclick="selectAddress(${index})">
            <div class="address-details">
                <div class="address-text">
                    <strong>${address.address}</strong>
                    ${address.isTemp ? '<span style="background: #fbbf24; color: #78350f; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 8px;">💾 TẠM THỜI</span>' : ''}<br>
                    ${address.district}, ${getCityName(address.city)}
                </div>
                ${!isGuestMode && !address.isTemp ? `
                <div class="address-actions">
                    ${!address.isDefault ? `
                        <button class="address-action-btn set-default" onclick="event.stopPropagation(); setDefaultAddress(${index})" title="Đặt làm mặc định">
                            <i class="fas fa-star"></i>
                        </button>
                    ` : ''}
                    <button class="address-action-btn" onclick="event.stopPropagation(); editAddress(${index})" title="Chỉnh sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="address-action-btn delete" onclick="event.stopPropagation(); deleteAddress(${index})" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ` : address.isTemp ? `
                <div class="address-actions">
                    <button class="address-action-btn" onclick="event.stopPropagation(); editTempAddress()" title="Chỉnh sửa địa chỉ tạm">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="address-action-btn delete" onclick="event.stopPropagation(); deleteTempAddress()" title="Xóa địa chỉ tạm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    // Show guest mode notice if applicable
    if (isGuestMode && addressList.parentElement) {
        let guestNotice = addressList.parentElement.querySelector('.guest-mode-notice');
        if (!guestNotice) {
            guestNotice = document.createElement('div');
            guestNotice.className = 'guest-mode-notice';
            guestNotice.style.cssText = 'background: #e3f2fd; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #2196f3; font-size: 14px;';
            guestNotice.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-info-circle" style="color: #2196f3;"></i>
                    <strong>Chế độ khách:</strong> <span>Bạn đang xem địa chỉ từ email. Không thể chỉnh sửa hoặc xóa.</span>
                </div>
            `;
            addressList.parentElement.insertBefore(guestNotice, addressList);
        }
    }
}

// Select address for checkout
function selectAddress(index) {
    selectedAddress = index;
    window.selectedAddress = index; // Export to global scope
    renderAddressList();
    
    // Show selected address display
    const selectedAddressDisplay = document.getElementById('selectedAddressDisplay');
    const selectedAddressText = document.getElementById('selectedAddressText');
    const savedAddresses = document.getElementById('savedAddresses');
    
    if (selectedAddressDisplay && selectedAddressText && savedAddresses) {
        const address = userAddresses[index];
        selectedAddressText.innerHTML = `
            <strong>${address.address}</strong><br>
            ${address.district}, ${getCityName(address.city)}
        `;
        
        selectedAddressDisplay.style.display = 'block';
        savedAddresses.style.display = 'none';
    }
}

// Change selected address (show address list again)
function changeSelectedAddress() {
    const selectedAddressDisplay = document.getElementById('selectedAddressDisplay');
    const savedAddresses = document.getElementById('savedAddresses');
    
    if (selectedAddressDisplay && savedAddresses) {
        selectedAddressDisplay.style.display = 'none';
        savedAddresses.style.display = 'block';
    }
}

// Toggle new address form
function toggleNewAddressForm() {
    const newAddressForm = document.getElementById('newAddressForm');
    const addressFormTitle = document.getElementById('addressFormTitle');
    
    if (newAddressForm) {
        const isVisible = newAddressForm.style.display === 'block';
        newAddressForm.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Reset form for new address
            isEditingAddress = false;
            editingAddressIndex = -1;
            if (addressFormTitle) addressFormTitle.textContent = 'Thêm địa chỉ mới';
            clearAddressForm();
        }
    }
}

// Cancel address form
function cancelAddressForm() {
    const newAddressForm = document.getElementById('newAddressForm');
    if (newAddressForm) {
        newAddressForm.style.display = 'none';
        clearAddressForm();
        isEditingAddress = false;
        editingAddressIndex = -1;
        
        // Reload addresses to show temp address if exists
        loadUserAddresses();
    }
}

// Clear address form
function clearAddressForm() {
    const fields = ['newShippingAddress', 'newShippingCity', 'newShippingDistrict'];
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) field.value = '';
    });
    
    const setAsDefault = document.getElementById('setAsDefault');
    if (setAsDefault) setAsDefault.checked = false;
    
    // Reset verification status
    isAddressVerified = false;
    verifiedCoordinates = null;
    
    // Remove coordinates display
    const coordDisplay = document.querySelector('.coordinates-display');
    if (coordDisplay) coordDisplay.remove();
    
    // Hide save button and show verify button
    const saveBtn = document.querySelector('.save-address-btn');
    const verifyBtn = document.querySelector('.verify-address-btn');
    if (saveBtn) saveBtn.style.display = 'none';
    if (verifyBtn) verifyBtn.style.display = 'inline-flex';
}

// Verify address with Google Maps
async function verifyAddressWithGoogleMaps() {
    // Get form values
    const address = document.getElementById('newShippingAddress')?.value.trim();
    const city = document.getElementById('newShippingCity')?.value;
    const district = document.getElementById('newShippingDistrict')?.value.trim();
    
    // Validation
    if (!address || !city || !district) {
        alert('Vui lòng điền đầy đủ thông tin địa chỉ trước khi xác thực');
        return;
    }
    
    // Get city name for search
    const cityName = getCityName(city);
    const fullAddress = `${address}, ${district}, ${cityName}, Vietnam`;
    
    console.log('🗺️ Verifying address:', fullAddress);
    
    // Clear previous verification status
    localStorage.removeItem('addressVerified');
    localStorage.removeItem('verifiedAddress');
    
    // Create verification page URL
    const encodedAddress = encodeURIComponent(fullAddress);
    const verificationUrl = `/verify-address.html?address=${encodedAddress}&return=${encodeURIComponent(window.location.href)}`;
    
    // Show verification pending status
    showVerificationPending();
    
    // Open verification page in new window
    const verifyWindow = window.open(
        verificationUrl, 
        'AddressVerification',
        'width=1200,height=800,resizable=yes,scrollbars=yes'
    );
    
    // Listen for messages from verification window
    window.addEventListener('message', handleVerificationResponse, false);
    
    // Check verification status periodically (fallback for if postMessage doesn't work)
    const checkInterval = setInterval(() => {
        const verified = localStorage.getItem('addressVerified');
        const verifiedAddr = localStorage.getItem('verifiedAddress');
        const coordsStr = localStorage.getItem('verifiedCoordinates');
        
        if (verified === 'true' && verifiedAddr === fullAddress) {
            clearInterval(checkInterval);
            
            // Parse and store coordinates
            if (coordsStr) {
                try {
                    verifiedCoordinates = JSON.parse(coordsStr);
                    console.log('📍 Loaded coordinates from localStorage:', verifiedCoordinates);
                } catch (e) {
                    console.error('Error parsing coordinates:', e);
                }
            }
            
            handleSuccessfulVerification();
        } else if (verified === 'false') {
            clearInterval(checkInterval);
            handleCancelledVerification();
        }
        
        // Stop checking after 5 minutes
        if (Date.now() - (parseInt(localStorage.getItem('verificationTimestamp')) || 0) > 300000) {
            clearInterval(checkInterval);
        }
    }, 1000);
}

// Handle verification response from popup
function handleVerificationResponse(event) {
    // Check if message is from our verification page
    if (event.data && event.data.type === 'addressVerified') {
        if (event.data.verified) {
            // Store coordinates from verification
            if (event.data.coordinates) {
                verifiedCoordinates = event.data.coordinates;
                console.log('📍 Received coordinates:', verifiedCoordinates);
            }
            handleSuccessfulVerification();
        } else {
            handleCancelledVerification();
        }
        
        // Remove listener
        window.removeEventListener('message', handleVerificationResponse);
    }
}

// Handle successful verification
function handleSuccessfulVerification() {
    // Mark as verified
    isAddressVerified = true;
    
    // Show save button
    showSaveButton();
    
    // Display coordinates if available
    if (verifiedCoordinates && verifiedCoordinates.lat && verifiedCoordinates.lng) {
        const coordDisplay = document.createElement('div');
        coordDisplay.className = 'coordinates-display';
        coordDisplay.style.cssText = 'background: #e8f5e9; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #4caf50;';
        coordDisplay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <i class="fas fa-map-marker-alt" style="color: #4caf50;"></i>
                <strong style="color: #2e7d32;">Tọa độ đã xác thực:</strong>
            </div>
            <div style="font-size: 13px; color: #555; margin-left: 24px;">
                <div>📍 Latitude: <strong>${verifiedCoordinates.lat}</strong></div>
                <div>📍 Longitude: <strong>${verifiedCoordinates.lng}</strong></div>
            </div>
        `;
        
        // Insert before form-actions
        const formActions = document.querySelector('.form-actions');
        if (formActions && formActions.parentNode) {
            // Remove old coordinate display if exists
            const oldDisplay = formActions.parentNode.querySelector('.coordinates-display');
            if (oldDisplay) oldDisplay.remove();
            
            formActions.parentNode.insertBefore(coordDisplay, formActions);
        }
        
        console.log('✅ Displaying coordinates:', verifiedCoordinates);
    }
    
    // Clear localStorage
    setTimeout(() => {
        localStorage.removeItem('addressVerified');
        localStorage.removeItem('verifiedAddress');
        localStorage.removeItem('verifiedCoordinates');
        localStorage.removeItem('verificationTimestamp');
    }, 1000);
    
    if (window.showNotification) {
        window.showNotification('✅ Địa chỉ đã được xác thực! Bạn có thể lưu địa chỉ.', 'success');
    } else {
        alert('✅ Địa chỉ đã được xác thực! Bạn có thể lưu địa chỉ.');
    }
}

// Handle cancelled verification
function handleCancelledVerification() {
    // Reset button state
    const verifyBtn = document.querySelector('.verify-address-btn');
    if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Xác thực địa chỉ trên Google Maps';
    }
    
    // Clear localStorage
    setTimeout(() => {
        localStorage.removeItem('addressVerified');
        localStorage.removeItem('verifiedAddress');
        localStorage.removeItem('verificationTimestamp');
    }, 1000);
    
    if (window.showNotification) {
        window.showNotification('⚠️ Xác thực địa chỉ đã bị hủy.', 'warning');
    }
}

// Show verification pending status
function showVerificationPending() {
    const verifyBtn = document.querySelector('.verify-address-btn');
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác thực...';
    }
}

// Show save button after verification
function showSaveButton() {
    const saveBtn = document.querySelector('.save-address-btn');
    const verifyBtn = document.querySelector('.verify-address-btn');
    
    if (saveBtn) {
        saveBtn.style.display = 'inline-flex';
        saveBtn.disabled = false;
    }
    
    if (verifyBtn) {
        verifyBtn.style.display = 'none';
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Xác thực địa chỉ';
    }
}

// Save new or edited address
async function saveNewAddress() {
    // Check if address is verified
    if (!isAddressVerified) {
        alert('Vui lòng xác thực địa chỉ trên Google Maps trước khi lưu!');
        return;
    }
    
    // Get form values
    const address = document.getElementById('newShippingAddress')?.value.trim();
    const city = document.getElementById('newShippingCity')?.value;
    const district = document.getElementById('newShippingDistrict')?.value.trim();
    const setAsDefault = document.getElementById('setAsDefault')?.checked || false;
    
    // Validation
    if (!address || !city || !district) {
        alert('Vui lòng điền đầy đủ thông tin địa chỉ');
        return;
    }
    
    // For guest users, store address temporarily in localStorage
    if (!window.currentUser) {
        console.log('💾 Guest user - storing address temporarily in localStorage');
        
        const guestAddress = {
            address,
            city,
            district,
            isDefault: setAsDefault,
            coordinates: verifiedCoordinates,
            timestamp: Date.now()
        };
        
        // Store in localStorage for later use after successful payment
        localStorage.setItem('guestTempAddress', JSON.stringify(guestAddress));
        
        // Show success notification
        if (window.showNotification) {
            window.showNotification('✅ Địa chỉ đã được lưu tạm thời. Sau khi thanh toán thành công, địa chỉ sẽ được tự động lưu vào tài khoản.', 'success');
        } else {
            alert('✅ Địa chỉ đã được lưu tạm thời. Sau khi thanh toán thành công, địa chỉ sẽ được tự động lưu vào tài khoản.');
        }
        
        // Close the form
        cancelAddressForm();
        
        console.log('✅ Guest address stored temporarily:', guestAddress);
        return;
    }
    
    // For logged-in users, save to database
    try {
        const addressData = {
            address,
            city,
            district,
            isDefault: setAsDefault,
            coordinates: verifiedCoordinates // Save verified coordinates
        };
        
        let response;
        
        // Check if user is manual login or Google login
        const storedUser = localStorage.getItem('techHavenUser');
        const isManualUser = storedUser && window.currentUser.provider === 'manual';
        
        if (isManualUser) {
            // Use UID-based endpoints for manual users
            if (isEditingAddress && editingAddressIndex >= 0) {
                console.log('📍 Updating address for manual user via UID');
                response = await fetch(`/api/user/addresses/by-uid/${window.currentUser.uid}/${editingAddressIndex}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(addressData)
                });
            } else {
                console.log('📍 Adding address for manual user via UID');
                response = await fetch(`/api/user/addresses/by-uid/${window.currentUser.uid}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(addressData)
                });
            }
        } else {
            // Use token-based endpoints for Google users
            const token = await window.getIdToken();
            if (isEditingAddress && editingAddressIndex >= 0) {
                console.log('📍 Updating address for Google user via token');
                response = await fetch(`/api/user/addresses/${editingAddressIndex}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(addressData)
                });
            } else {
                console.log('📍 Adding address for Google user via token');
                response = await fetch('/api/user/addresses', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(addressData)
                });
            }
        }
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Address saved successfully');
            
            // Reload addresses and update UI
            await loadUserAddresses();
            cancelAddressForm();
            
            // Show success message
            if (window.showNotification) {
                window.showNotification(
                    isEditingAddress ? 'Địa chỉ đã được cập nhật!' : 'Địa chỉ mới đã được lưu!', 
                    'success'
                );
            }
        } else {
            const error = await response.json();
            console.error('❌ Error saving address:', error);
            alert(error.error || 'Không thể lưu địa chỉ. Vui lòng thử lại.');
        }
    } catch (error) {
        console.error('❌ Error saving address:', error);
        alert('Có lỗi xảy ra khi lưu địa chỉ. Vui lòng thử lại.');
    }
}

// Edit existing address
function editAddress(index) {
    if (index < 0 || index >= userAddresses.length) return;
    
    const address = userAddresses[index];
    isEditingAddress = true;
    editingAddressIndex = index;
    
    // Fill form with existing data
    const addressField = document.getElementById('newShippingAddress');
    const cityField = document.getElementById('newShippingCity');
    const districtField = document.getElementById('newShippingDistrict');
    const defaultField = document.getElementById('setAsDefault');
    const formTitle = document.getElementById('addressFormTitle');
    
    if (addressField) addressField.value = address.address;
    if (cityField) cityField.value = address.city;
    if (districtField) districtField.value = address.district;
    if (defaultField) defaultField.checked = address.isDefault;
    if (formTitle) formTitle.textContent = 'Chỉnh sửa địa chỉ';
    
    // When editing, mark as verified (existing address)
    isAddressVerified = true;
    verifiedCoordinates = address.coordinates || null;
    
    // Show save button directly for editing
    const saveBtn = document.querySelector('.save-address-btn');
    const verifyBtn = document.querySelector('.verify-address-btn');
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    if (verifyBtn) verifyBtn.style.display = 'none';
    
    // Show form
    toggleNewAddressForm();
}

// Set address as default
async function setDefaultAddress(index) {
    if (!window.currentUser || index < 0 || index >= userAddresses.length) return;
    
    try {
        let response;
        
        // Check if user is manual login or Google login
        const storedUser = localStorage.getItem('techHavenUser');
        const isManualUser = storedUser && window.currentUser.provider === 'manual';
        
        if (isManualUser) {
            // Use UID-based endpoint for manual users
            console.log('📍 Setting default address for manual user via UID');
            response = await fetch(`/api/user/addresses/by-uid/${window.currentUser.uid}/${index}/set-default`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } else {
            // Use token-based endpoint for Google users
            console.log('📍 Setting default address for Google user via token');
            const token = await window.getIdToken();
            response = await fetch(`/api/user/addresses/${index}/set-default`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        
        if (response.ok) {
            console.log('✅ Default address updated');
            
            // Update UI immediately - remove default class from all addresses
            const addressItems = document.querySelectorAll('.address-item');
            addressItems.forEach((item, itemIndex) => {
                if (itemIndex === index) {
                    // Add default class to new default address
                    item.classList.add('default');
                    // Update the address data
                    userAddresses[itemIndex].isDefault = true;
                } else {
                    // Remove default class from other addresses
                    item.classList.remove('default');
                    // Update the address data
                    if (userAddresses[itemIndex]) {
                        userAddresses[itemIndex].isDefault = false;
                    }
                }
            });
            
            // Also reload addresses to ensure data consistency (but UI already updated)
            setTimeout(() => {
                loadUserAddresses();
            }, 1000);
            
            if (window.showNotification) {
                window.showNotification('Địa chỉ mặc định đã được cập nhật!', 'success');
            }
        } else {
            const error = await response.json();
            console.error('❌ Error setting default address:', error);
            alert(error.error || 'Không thể đặt địa chỉ mặc định.');
        }
    } catch (error) {
        console.error('❌ Error setting default address:', error);
        alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
}

// Delete address
async function deleteAddress(index) {
    if (!window.currentUser || index < 0 || index >= userAddresses.length) return;
    
    const address = userAddresses[index];
    if (!confirm(`Bạn có chắc chắn muốn xóa địa chỉ này?\n\n${address.address}\n${address.district}, ${getCityName(address.city)}`)) {
        return;
    }
    
    try {
        let response;
        
        // Check if user is manual login or Google login
        const storedUser = localStorage.getItem('techHavenUser');
        const isManualUser = storedUser && window.currentUser.provider === 'manual';
        
        if (isManualUser) {
            // Use UID-based endpoint for manual users
            console.log('📍 Deleting address for manual user via UID');
            response = await fetch(`/api/user/addresses/by-uid/${window.currentUser.uid}/${index}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } else {
            // Use token-based endpoint for Google users
            console.log('📍 Deleting address for Google user via token');
            const token = await window.getIdToken();
            response = await fetch(`/api/user/addresses/${index}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        
        if (response.ok) {
            console.log('✅ Address deleted successfully');
            await loadUserAddresses();
            
            // Reset selected address if it was deleted
            if (selectedAddress === index) {
                selectedAddress = null;
                const selectedAddressDisplay = document.getElementById('selectedAddressDisplay');
                const savedAddresses = document.getElementById('savedAddresses');
                
                if (selectedAddressDisplay && savedAddresses) {
                    selectedAddressDisplay.style.display = 'none';
                    savedAddresses.style.display = 'block';
                }
            } else if (selectedAddress > index) {
                selectedAddress--;
            }
            
            if (window.showNotification) {
                window.showNotification('Địa chỉ đã được xóa!', 'success');
            }
        } else {
            const error = await response.json();
            console.error('❌ Error deleting address:', error);
            alert(error.error || 'Không thể xóa địa chỉ.');
        }
    } catch (error) {
        console.error('❌ Error deleting address:', error);
        alert('Có lỗi xảy ra khi xóa địa chỉ. Vui lòng thử lại.');
    }
}

// Get city display name from city code
function getCityName(cityCode) {
    const cityMap = {
        'hanoi': 'Hà Nội',
        'hcm': 'TP. Hồ Chí Minh',
        'danang': 'Đà Nẵng',
        'haiphong': 'Hải Phòng',
        'cantho': 'Cần Thơ',
        'angiang': 'An Giang',
        'bacgiang': 'Bắc Giang',
        'backan': 'Bắc Kạn',
        'baclieu': 'Bạc Liêu',
        'bacninh': 'Bắc Ninh',
        'baria': 'Bà Rịa - Vũng Tàu',
        'bentre': 'Bến Tre',
        'binhdinh': 'Bình Định',
        'binhduong': 'Bình Dương',
        'binhphuoc': 'Bình Phước',
        'binhthuan': 'Bình Thuận',
        'camau': 'Cà Mau',
        'caobang': 'Cao Bằng',
        'daklak': 'Đắk Lắk',
        'daknong': 'Đắk Nông',
        'dienbien': 'Điện Biên',
        'dongnai': 'Đồng Nai',
        'dongthap': 'Đồng Tháp',
        'gialai': 'Gia Lai',
        'hagiang': 'Hà Giang',
        'hanam': 'Hà Nam',
        'hatinh': 'Hà Tĩnh',
        'haiduong': 'Hải Dương',
        'haugiang': 'Hậu Giang',
        'hoabinh': 'Hòa Bình',
        'hungyen': 'Hưng Yên',
        'khanhhoa': 'Khánh Hòa',
        'kiengiang': 'Kiên Giang',
        'kontum': 'Kon Tum',
        'laichau': 'Lai Châu',
        'lamdong': 'Lâm Đồng',
        'langson': 'Lạng Sơn',
        'laocai': 'Lào Cai',
        'longan': 'Long An',
        'namdinh': 'Nam Định',
        'nghean': 'Nghệ An',
        'ninhbinh': 'Ninh Bình',
        'ninhthuan': 'Ninh Thuận',
        'phutho': 'Phú Thọ',
        'phuyen': 'Phú Yên',
        'quangbinh': 'Quảng Bình',
        'quangnam': 'Quảng Nam',
        'quangngai': 'Quảng Ngãi',
        'quangninh': 'Quảng Ninh',
        'quangtri': 'Quảng Trị',
        'soctrang': 'Sóc Trăng',
        'sonla': 'Sơn La',
        'tayninh': 'Tây Ninh',
        'thaibinh': 'Thái Bình',
        'thainguyen': 'Thái Nguyên',
        'thanhhoa': 'Thanh Hóa',
        'thuathienhue': 'Thừa Thiên Huế',
        'tiengiang': 'Tiền Giang',
        'travinh': 'Trà Vinh',
        'tuyenquang': 'Tuyên Quang',
        'vinhlong': 'Vĩnh Long',
        'vinhphuc': 'Vĩnh Phúc',
        'yenbai': 'Yên Bái'
    };
    return cityMap[cityCode] || cityCode;
}

// Initialize address management when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Load addresses when checkout modal is opened
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (checkoutModal.classList.contains('active')) {
                        // Modal opened - load addresses
                        if (window.currentUser) {
                            loadUserAddresses();
                        } else {
                            // Guest mode - show OTP button
                            showGuestAddressOption();
                        }
                    }
                }
            });
        });
        
        observer.observe(checkoutModal, { attributes: true });
    }
});

// =====================================
// GUEST ADDRESS OTP FUNCTIONS
// =====================================

// Show guest address option (OTP button)
function showGuestAddressOption() {
    const noAddresses = document.getElementById('noAddresses');
    if (!noAddresses) return;
    
    noAddresses.style.display = 'block';
    noAddresses.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <i class="fas fa-map-marker-alt" style="font-size: 48px; color: #667eea; margin-bottom: 15px;"></i>
            <p style="color: #666; margin-bottom: 20px;">
                Bạn chưa đăng nhập. Nếu bạn đã có tài khoản và muốn sử dụng địa chỉ đã lưu:
            </p>
            <button onclick="showGuestOTPModal()" class="btn btn-primary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; color: white; display: inline-flex; align-items: center; gap: 8px;">
                <i class="fas fa-envelope"></i>
                Xem địa chỉ từ email
            </button>
        </div>
    `;
}

// Show OTP modal for guest users
function showGuestOTPModal() {
    // Remove old modal if exists
    const oldModal = document.getElementById('guestOTPModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // Create modal HTML
    const modalHTML = `
        <div id="guestOTPModal" class="modal-overlay active" style="z-index: 10000;">
            <div class="modal-content" style="max-width: 500px; animation: slideDown 0.3s ease;">
                <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-envelope-open-text"></i>
                        Xem địa chỉ từ email
                    </h3>
                    <button onclick="closeGuestOTPModal()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; position: absolute; right: 20px; top: 20px;">
                        ×
                    </button>
                </div>
                <div class="modal-body" style="padding: 30px;">
                    <!-- Step 1: Email Input -->
                    <div id="otpStep1">
                        <p style="color: #666; margin-bottom: 20px;">
                            Nhập email của tài khoản để nhận mã OTP xem địa chỉ đã lưu:
                        </p>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                                <i class="fas fa-envelope" style="color: #667eea;"></i> Email
                            </label>
                            <input type="email" id="guestOTPEmail" class="form-control" placeholder="email@example.com" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;" />
                        </div>
                        <button onclick="sendGuestOTP()" id="sendOTPBtn" class="btn btn-primary" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 14px; border-radius: 8px; cursor: pointer; font-size: 16px; color: white; font-weight: 600;">
                            <i class="fas fa-paper-plane"></i> Gửi mã OTP
                        </button>
                    </div>
                    
                    <!-- Step 2: OTP Input (Hidden by default) -->
                    <div id="otpStep2" style="display: none;">
                        <p style="color: #666; margin-bottom: 20px;">
                            Mã OTP đã được gửi đến email <strong id="sentToEmail"></strong>
                        </p>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                                <i class="fas fa-key" style="color: #667eea;"></i> Nhập mã OTP (6 số)
                            </label>
                            <input type="text" id="guestOTPCode" class="form-control" placeholder="000000" maxlength="6" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 24px; text-align: center; letter-spacing: 8px; font-family: 'Courier New', monospace;" />
                        </div>
                        <button onclick="verifyGuestOTP()" id="verifyOTPBtn" class="btn btn-primary" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 14px; border-radius: 8px; cursor: pointer; font-size: 16px; color: white; font-weight: 600; margin-bottom: 10px;">
                            <i class="fas fa-check-circle"></i> Xác thực
                        </button>
                        <button onclick="showOTPStep1()" class="btn btn-secondary" style="width: 100%; background: #6c757d; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px; color: white;">
                            <i class="fas fa-arrow-left"></i> Gửi lại
                        </button>
                    </div>
                    
                    <!-- Countdown Timer (Hidden by default) -->
                    <div id="otpCountdown" style="display: none; text-align: center; margin-top: 15px; color: #ff9800; font-weight: 500;">
                        <i class="fas fa-clock"></i> Mã OTP hết hạn sau: <span id="countdownTimer">5:00</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close guest OTP modal
function closeGuestOTPModal() {
    const modal = document.getElementById('guestOTPModal');
    if (modal) {
        modal.remove();
    }
}

// Show OTP step 1 (email input)
function showOTPStep1() {
    const step1 = document.getElementById('otpStep1');
    const step2 = document.getElementById('otpStep2');
    const countdown = document.getElementById('otpCountdown');
    
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (countdown) countdown.style.display = 'none';
    
    // Reset form
    const emailInput = document.getElementById('guestOTPEmail');
    const otpInput = document.getElementById('guestOTPCode');
    const sendBtn = document.getElementById('sendOTPBtn');
    
    if (emailInput) emailInput.value = '';
    if (otpInput) otpInput.value = '';
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi mã OTP';
    }
}

// Reset OTP modal to step 1 with prefilled email
function resetOTPModal(email) {
    const modalBody = document.querySelector('#guestOTPModal .modal-body');
    if (modalBody) {
        modalBody.innerHTML = `
            <!-- Step 1: Email Input -->
            <div id="otpStep1">
                <p style="color: #666; margin-bottom: 20px;">
                    Nhập email của tài khoản để nhận mã OTP xem địa chỉ đã lưu:
                </p>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                        <i class="fas fa-envelope" style="color: #667eea;"></i> Email
                    </label>
                    <input type="email" id="guestOTPEmail" class="form-control" placeholder="email@example.com" value="${email || ''}" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;" />
                </div>
                <button onclick="sendGuestOTP()" id="sendOTPBtn" class="btn btn-primary" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 14px; border-radius: 8px; cursor: pointer; font-size: 16px; color: white; font-weight: 600;">
                    <i class="fas fa-paper-plane"></i> Gửi mã OTP mới
                </button>
            </div>
        `;
    }
}

// Send OTP to guest email
async function sendGuestOTP() {
    const email = document.getElementById('guestOTPEmail').value.trim();
    
    if (!email) {
        alert('Vui lòng nhập email');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Email không hợp lệ');
        return;
    }
    
    const sendBtn = document.getElementById('sendOTPBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    
    try {
        const response = await fetch('/api/guest/send-address-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const result = await response.json();
        
        console.log('📧 OTP send response:', result);
        
        if (response.ok && result.success) {
            console.log('✅ OTP sent successfully, switching to step 2');
            
            // Store email for verification
            currentGuestEmail = email;
            
            // Rebuild modal to ensure clean state
            const modalBody = document.querySelector('#guestOTPModal .modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <!-- Step 2: OTP Input -->
                    <div id="otpStep2">
                        <p style="color: #666; margin-bottom: 20px;">
                            Mã OTP đã được gửi đến email <strong style="color: #667eea;">${email}</strong>
                        </p>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                                <i class="fas fa-key" style="color: #667eea;"></i> Nhập mã OTP (6 số)
                            </label>
                            <input type="text" id="guestOTPCode" class="form-control" placeholder="000000" maxlength="6" autofocus style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 24px; text-align: center; letter-spacing: 8px; font-family: 'Courier New', monospace;" />
                        </div>
                        <button onclick="verifyGuestOTP()" id="verifyOTPBtn" class="btn btn-primary" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 14px; border-radius: 8px; cursor: pointer; font-size: 16px; color: white; font-weight: 600; margin-bottom: 10px;">
                            <i class="fas fa-check-circle"></i> Xác thực
                        </button>
                        <button onclick="resetOTPModal('${email}')" class="btn btn-secondary" style="width: 100%; background: #6c757d; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px; color: white;">
                            <i class="fas fa-arrow-left"></i> Gửi lại
                        </button>
                    </div>
                    
                    <!-- Countdown Timer -->
                    <div id="otpCountdown" style="text-align: center; margin-top: 15px; color: #ff9800; font-weight: 500;">
                        <i class="fas fa-clock"></i> Mã OTP hết hạn sau: <span id="countdownTimer">5:00</span>
                    </div>
                `;
                
                console.log('✅ Modal body rebuilt with step 2, email stored:', email);
                
                // Start countdown
                startOTPCountdown(result.expiresIn || 300);
                
                // Focus on OTP input
                setTimeout(() => {
                    const otpInput = document.getElementById('guestOTPCode');
                    if (otpInput) {
                        otpInput.focus();
                        console.log('✅ OTP input focused');
                    }
                }, 100);
            }
            
            if (window.showNotification) {
                window.showNotification('✅ Mã OTP đã được gửi đến email của bạn', 'success');
            } else {
                alert('✅ Mã OTP đã được gửi đến email của bạn');
            }
        } else {
            alert(result.error || 'Không thể gửi mã OTP');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi mã OTP';
        }
    } catch (error) {
        console.error('Error sending OTP:', error);
        alert('Có lỗi xảy ra khi gửi mã OTP');
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi mã OTP';
    }
}

// Start OTP countdown timer
function startOTPCountdown(seconds) {
    const timerElement = document.getElementById('countdownTimer');
    let remaining = seconds;
    
    const interval = setInterval(() => {
        remaining--;
        
        const minutes = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        if (remaining <= 0) {
            clearInterval(interval);
            timerElement.parentElement.style.color = '#dc3545';
            timerElement.parentElement.innerHTML = '<i class="fas fa-times-circle"></i> Mã OTP đã hết hạn';
        }
    }, 1000);
}

// Verify guest OTP and load addresses
async function verifyGuestOTP() {
    // Use stored email from global variable
    const email = currentGuestEmail;
    const otp = document.getElementById('guestOTPCode')?.value.trim() || '';
    
    console.log('🔐 Verifying OTP for email:', email);
    
    if (!email) {
        alert('Không tìm thấy email. Vui lòng thử lại.');
        console.error('❌ No email found in currentGuestEmail variable');
        return;
    }
    
    if (!otp || otp.length !== 6) {
        alert('Vui lòng nhập mã OTP 6 số');
        return;
    }
    
    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác thực...';
    }
    
    try {
        console.log('📤 Sending verification request:', { email, otp });
        
        const response = await fetch('/api/guest/verify-address-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, otp })
        });
        
        const result = await response.json();
        console.log('📥 Verification response:', result);
        
        if (response.ok && result.success) {
            // Load guest addresses
            guestAddresses = result.addresses || [];
            isGuestMode = true;
            userAddresses = guestAddresses; // Set for compatibility
            
            console.log('✅ Loaded', guestAddresses.length, 'addresses for', result.userName);
            
            // Close OTP modal
            closeGuestOTPModal();
            
            // Render addresses
            renderAddressList();
            
            if (window.showNotification) {
                window.showNotification(`✅ Đã tải ${guestAddresses.length} địa chỉ của ${result.userName}`, 'success');
            }
            
            // Auto-select default address if exists
            const defaultAddress = guestAddresses.find(addr => addr.isDefault);
            if (defaultAddress) {
                selectAddress(guestAddresses.indexOf(defaultAddress));
            }
        } else {
            console.error('❌ Verification failed:', result.error);
            alert(result.error || 'Mã OTP không đúng');
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = '<i class="fas fa-check-circle"></i> Xác thực';
            }
        }
    } catch (error) {
        console.error('❌ Error verifying OTP:', error);
        alert('Có lỗi xảy ra khi xác thực mã OTP');
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fas fa-check-circle"></i> Xác thực';
        }
    }
}

// Delete temporary guest address from localStorage
function deleteTempAddress() {
    if (confirm('Bạn có chắc chắn muốn xóa địa chỉ tạm thời này?')) {
        localStorage.removeItem('guestTempAddress');
        console.log('🗑️ Guest temp address deleted');
        
        // Clear the address list
        userAddresses = [];
        window.userAddresses = [];
        selectedAddress = null;
        window.selectedAddress = null;
        
        // Re-render the address list (will show empty)
        renderAddressList();
        
        // Show notification
        if (window.showNotification) {
            window.showNotification('✅ Đã xóa địa chỉ tạm thời', 'success');
        } else {
            alert('✅ Đã xóa địa chỉ tạm thời');
        }
    }
}

// Edit temporary guest address
function editTempAddress() {
    const tempAddressStr = localStorage.getItem('guestTempAddress');
    if (!tempAddressStr) {
        console.error('❌ No temp address found');
        return;
    }
    
    try {
        const tempAddress = JSON.parse(tempAddressStr);
        
        // Fill form with temp address data
        const addressField = document.getElementById('newShippingAddress');
        const cityField = document.getElementById('newShippingCity');
        const districtField = document.getElementById('newShippingDistrict');
        const defaultField = document.getElementById('setAsDefault');
        const formTitle = document.getElementById('addressFormTitle');
        
        if (addressField) addressField.value = tempAddress.address || '';
        if (cityField) cityField.value = tempAddress.city || '';
        if (districtField) districtField.value = tempAddress.district || '';
        if (defaultField) defaultField.checked = tempAddress.isDefault || false;
        if (formTitle) formTitle.textContent = 'Chỉnh sửa địa chỉ tạm';
        
        // Mark as verified since it's an existing temp address
        isAddressVerified = true;
        verifiedCoordinates = tempAddress.coordinates || null;
        
        // Show save button directly for editing
        const saveBtn = document.querySelector('.save-address-btn');
        const verifyBtn = document.querySelector('.verify-address-btn');
        if (saveBtn) saveBtn.style.display = 'inline-flex';
        if (verifyBtn) verifyBtn.style.display = 'none';
        
        // Show form
        toggleNewAddressForm();
        
        console.log('✏️ Editing temp address:', tempAddress);
    } catch (e) {
        console.error('❌ Error parsing temp address:', e);
        alert('Có lỗi khi tải địa chỉ tạm. Vui lòng thử lại.');
    }
}

// Make address management functions globally available
window.toggleNewAddressForm = toggleNewAddressForm;
window.cancelAddressForm = cancelAddressForm;
window.saveNewAddress = saveNewAddress;
window.verifyAddressWithGoogleMaps = verifyAddressWithGoogleMaps;
window.selectAddress = selectAddress;
window.changeSelectedAddress = changeSelectedAddress;
window.editAddress = editAddress;
window.setDefaultAddress = setDefaultAddress;
window.deleteAddress = deleteAddress;
window.deleteTempAddress = deleteTempAddress;
window.editTempAddress = editTempAddress;
window.loadUserAddresses = loadUserAddresses;

// Guest OTP functions
window.showGuestOTPModal = showGuestOTPModal;
window.closeGuestOTPModal = closeGuestOTPModal;
window.showOTPStep1 = showOTPStep1;
window.resetOTPModal = resetOTPModal;
window.sendGuestOTP = sendGuestOTP;
window.verifyGuestOTP = verifyGuestOTP;

// Export address data for checkout
window.userAddresses = userAddresses;
window.selectedAddress = selectedAddress;
window.verifiedCoordinates = verifiedCoordinates;