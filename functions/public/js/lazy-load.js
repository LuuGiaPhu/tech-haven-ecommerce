/**
 * Advanced Lazy Loading
 * Lazy load images, iframes, and components
 */

class LazyLoader {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        // Use Intersection Observer if available
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.loadElement(entry.target);
                            this.observer.unobserve(entry.target);
                        }
                    });
                },
                {
                    rootMargin: '50px 0px', // Load 50px before entering viewport
                    threshold: 0.01
                }
            );

            this.observeElements();
        } else {
            // Fallback for browsers without IntersectionObserver
            this.loadAllElements();
        }
    }

    observeElements() {
        // Lazy load images with data-src
        document.querySelectorAll('img[data-src]').forEach(img => {
            this.observer.observe(img);
        });

        // Lazy load background images
        document.querySelectorAll('[data-bg]').forEach(el => {
            this.observer.observe(el);
        });

        // Lazy load iframes (videos, maps)
        document.querySelectorAll('iframe[data-src]').forEach(iframe => {
            this.observer.observe(iframe);
        });

        // Lazy load components
        document.querySelectorAll('[data-component]').forEach(comp => {
            this.observer.observe(comp);
        });
    }

    loadElement(el) {
        // Load image
        if (el.tagName === 'IMG' && el.dataset.src) {
            el.src = el.dataset.src;
            if (el.dataset.srcset) {
                el.srcset = el.dataset.srcset;
            }
            el.classList.add('loaded');
            delete el.dataset.src;
            delete el.dataset.srcset;
        }

        // Load background image
        if (el.dataset.bg) {
            el.style.backgroundImage = `url(${el.dataset.bg})`;
            el.classList.add('loaded');
            delete el.dataset.bg;
        }

        // Load iframe
        if (el.tagName === 'IFRAME' && el.dataset.src) {
            el.src = el.dataset.src;
            delete el.dataset.src;
        }

        // Load component
        if (el.dataset.component) {
            this.loadComponent(el, el.dataset.component);
        }
    }

    loadComponent(el, componentName) {
        // Dynamic component loading
        switch (componentName) {
            case 'comments':
                this.loadComments(el);
                break;
            case 'related-products':
                this.loadRelatedProducts(el);
                break;
            case 'reviews':
                this.loadReviews(el);
                break;
            default:
                console.warn('Unknown component:', componentName);
        }
        delete el.dataset.component;
    }

    loadComments(el) {
        // Load comments section
        console.log('Loading comments...');
        el.innerHTML = '<div class="comments-loaded">Comments loaded!</div>';
    }

    loadRelatedProducts(el) {
        // Load related products
        console.log('Loading related products...');
    }

    loadReviews(el) {
        // Load reviews
        console.log('Loading reviews...');
    }

    loadAllElements() {
        // Fallback: load everything immediately
        document.querySelectorAll('img[data-src]').forEach(img => {
            this.loadElement(img);
        });
        document.querySelectorAll('[data-bg]').forEach(el => {
            this.loadElement(el);
        });
        document.querySelectorAll('iframe[data-src]').forEach(iframe => {
            this.loadElement(iframe);
        });
    }

    // Add new elements to observer
    observe(elements) {
        if (!this.observer) return;
        
        const els = elements.length ? elements : [elements];
        els.forEach(el => this.observer.observe(el));
    }
}

// Initialize lazy loader
const lazyLoader = new LazyLoader();

// Export for use in other scripts
window.lazyLoader = lazyLoader;

// Auto-observe dynamically added images
if ('MutationObserver' in window) {
    const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if node itself should be lazy loaded
                        if (node.dataset && (node.dataset.src || node.dataset.bg)) {
                            lazyLoader.observe(node);
                        }
                        // Check children
                        const lazyElements = node.querySelectorAll 
                            ? node.querySelectorAll('[data-src], [data-bg], [data-component]')
                            : [];
                        lazyElements.forEach(el => lazyLoader.observe(el));
                    }
                });
            }
        });
    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Preload critical images on hover
document.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a[href]');
    if (link && link.href) {
        // Preload next page resources
        const linkHref = new URL(link.href, window.location.origin);
        if (linkHref.origin === window.location.origin) {
            // Create prefetch link
            const prefetchLink = document.createElement('link');
            prefetchLink.rel = 'prefetch';
            prefetchLink.href = link.href;
            document.head.appendChild(prefetchLink);
        }
    }
}, { passive: true });
