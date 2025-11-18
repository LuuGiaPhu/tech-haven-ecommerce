/**
 * Performance Monitor
 * Tracks Core Web Vitals and sends to Analytics
 */

// Function to report Web Vitals to Google Analytics
function sendToAnalytics({ name, delta, value, id }) {
    if (typeof gtag !== 'undefined') {
        gtag('event', name, {
            event_category: 'Web Vitals',
            value: Math.round(name === 'CLS' ? delta * 1000 : delta),
            event_label: id,
            non_interaction: true,
        });
    }
}

// Load Web Vitals library dynamically
function loadWebVitals() {
    if (!window.webVitals) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js';
        script.onload = () => {
            // Report Core Web Vitals
            if (window.webVitals) {
                webVitals.onLCP(sendToAnalytics);
                webVitals.onFID(sendToAnalytics);
                webVitals.onCLS(sendToAnalytics);
                webVitals.onFCP(sendToAnalytics);
                webVitals.onTTFB(sendToAnalytics);
            }
        };
        document.head.appendChild(script);
    }
}

// Load after page is interactive
if (document.readyState === 'complete') {
    loadWebVitals();
} else {
    window.addEventListener('load', loadWebVitals);
}

// Performance observer for long tasks
if ('PerformanceObserver' in window) {
    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration > 50) {
                    console.warn('Long task detected:', entry.duration + 'ms', entry);
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'long_task', {
                            event_category: 'Performance',
                            value: Math.round(entry.duration),
                            non_interaction: true,
                        });
                    }
                }
            }
        });
        observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
        // Long task API not supported
    }
}

// Resource timing observer
if ('PerformanceObserver' in window) {
    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                // Track slow resources (>3s) - increased threshold to reduce noise
                if (entry.duration > 3000) {
                    console.warn('⚠️ Slow resource:', entry.name, entry.duration + 'ms');
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'slow_resource', {
                            event_category: 'Performance',
                            event_label: entry.name,
                            value: Math.round(entry.duration),
                            non_interaction: true,
                        });
                    }
                }
            }
        });
        observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
        // Resource timing not supported
    }
}

// Page visibility tracking
let pageHideTime;
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        pageHideTime = Date.now();
    } else {
        const timeHidden = Date.now() - pageHideTime;
        if (typeof gtag !== 'undefined' && timeHidden > 5000) {
            gtag('event', 'page_return', {
                event_category: 'Engagement',
                value: Math.round(timeHidden / 1000),
                non_interaction: true,
            });
        }
    }
});

// Network information
if ('connection' in navigator) {
    const conn = navigator.connection;
    if (conn) {
        console.info('Network:', {
            effectiveType: conn.effectiveType,
            downlink: conn.downlink,
            rtt: conn.rtt,
            saveData: conn.saveData
        });
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'network_info', {
                event_category: 'Performance',
                event_label: conn.effectiveType,
                value: Math.round(conn.downlink),
                non_interaction: true,
            });
        }
    }
}

// Console performance summary
window.addEventListener('load', () => {
    setTimeout(() => {
        if ('performance' in window) {
            const perf = performance.getEntriesByType('navigation')[0];
            if (perf) {
                console.group('📊 Performance Summary');
                console.log('DNS:', Math.round(perf.domainLookupEnd - perf.domainLookupStart) + 'ms');
                console.log('TCP:', Math.round(perf.connectEnd - perf.connectStart) + 'ms');
                console.log('Request:', Math.round(perf.responseStart - perf.requestStart) + 'ms');
                console.log('Response:', Math.round(perf.responseEnd - perf.responseStart) + 'ms');
                console.log('DOM Processing:', Math.round(perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart) + 'ms');
                console.log('Load Event:', Math.round(perf.loadEventEnd - perf.loadEventStart) + 'ms');
                console.log('Total:', Math.round(perf.loadEventEnd - perf.fetchStart) + 'ms');
                console.groupEnd();
            }
        }
    }, 0);
});
