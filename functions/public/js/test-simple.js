// Simple test script
console.log('Simple test script loaded successfully');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded in simple test');
    
    const testDiv = document.createElement('div');
    testDiv.innerHTML = 'JavaScript is working!';
    testDiv.style.color = 'red';
    testDiv.style.fontSize = '20px';
    testDiv.style.padding = '20px';
    
    document.body.insertBefore(testDiv, document.body.firstChild);
});