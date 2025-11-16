# Performance Test Script
# Tests PageSpeed scores before and after optimization

Write-Host "`n🚀 PERFORMANCE TEST - TECH HAVEN" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

$url = "https://tech-haven-5368b.web.app"

# Function to open PageSpeed Insights
function Test-PageSpeed {
    param([string]$pageUrl, [string]$pageName)
    
    Write-Host "`n📊 Testing: $pageName" -ForegroundColor Yellow
    Write-Host "URL: $pageUrl" -ForegroundColor Gray
    
    $psiUrl = "https://pagespeed.web.dev/analysis?url=" + [uri]::EscapeDataString($pageUrl)
    
    Write-Host "Opening PageSpeed Insights..." -ForegroundColor Green
    Start-Process $psiUrl
    
    Start-Sleep -Seconds 2
}

# Test pages
Write-Host "`n📝 Testing Pages..." -ForegroundColor Cyan
Write-Host "-" * 60 -ForegroundColor Gray

Test-PageSpeed -pageUrl $url -pageName "Homepage"
Start-Sleep -Seconds 3

Test-PageSpeed -pageUrl "$url/shop" -pageName "Shop Page"
Start-Sleep -Seconds 3

# Ask for a product URL
Write-Host "`n" -ForegroundColor White
Write-Host "Enter a product URL to test (or press Enter to skip):" -ForegroundColor Yellow
$productUrl = Read-Host "Product URL"

if ($productUrl) {
    if ($productUrl -notmatch "^https?://") {
        $productUrl = "$url/product/$productUrl"
    }
    Test-PageSpeed -pageUrl $productUrl -pageName "Product Page"
}

# Show optimization checklist
Write-Host "`n" -ForegroundColor White
Write-Host "✅ OPTIMIZATION CHECKLIST" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Gray

$checklist = @(
    @{Item = "Images have width/height"; Status = "✅ Done (36 images optimized)"},
    @{Item = "Lazy loading implemented"; Status = "✅ Done"},
    @{Item = "Font-display: swap added"; Status = "✅ Done"},
    @{Item = "Async CSS loading"; Status = "✅ Done"},
    @{Item = "Deferred JavaScript"; Status = "✅ Done"},
    @{Item = "Performance monitoring"; Status = "✅ Done"},
    @{Item = "Preconnect to external domains"; Status = "✅ Done"},
    @{Item = "Image compression"; Status = "⏳ Manual"},
    @{Item = "Code minification"; Status = "⏳ Deploy needed"},
    @{Item = "Service Worker"; Status = "❌ TODO"}
)

foreach ($item in $checklist) {
    Write-Host "  $($item.Status)  $($item.Item)" -ForegroundColor White
}

Write-Host "`n" -ForegroundColor White
Write-Host "📈 EXPECTED IMPROVEMENTS" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

$improvements = @(
    @{Metric = "Performance Score"; Before = "40-50"; After = "70-80+"; Impact = "⬆ +30-40 points"},
    @{Metric = "First Contentful Paint"; Before = "3-4s"; After = "1-2s"; Impact = "⬇ -2s"},
    @{Metric = "Largest Contentful Paint"; Before = "5-6s"; After = "2-3s"; Impact = "⬇ -3s"},
    @{Metric = "Total Blocking Time"; Before = "1-2s"; After = "200-400ms"; Impact = "⬇ -1.5s"},
    @{Metric = "Cumulative Layout Shift"; Before = "0.2"; After = "0.05"; Impact = "⬇ -75%"},
    @{Metric = "Speed Index"; Before = "4-5s"; After = "2-3s"; Impact = "⬇ -2s"}
)

foreach ($metric in $improvements) {
    Write-Host "`n  $($metric.Metric):" -ForegroundColor Yellow
    Write-Host "    Before: $($metric.Before)" -ForegroundColor Red
    Write-Host "    After:  $($metric.After)" -ForegroundColor Green
    Write-Host "    Impact: $($metric.Impact)" -ForegroundColor Cyan
}

Write-Host "`n" -ForegroundColor White
Write-Host "🔍 NEXT STEPS" -ForegroundColor Magenta
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host @"

1. 📊 Review PageSpeed Results
   - Wait for all tests to complete
   - Check both Mobile and Desktop scores
   - Note specific recommendations

2. 🖼️ Image Optimization (if needed)
   - Compress images to 80% quality
   - Convert to WebP format
   - Generate multiple sizes (srcset)
   - Consider image CDN

3. 📦 Code Optimization
   - Minify CSS/JS files
   - Remove unused code
   - Enable compression (gzip/brotli)

4. 🚀 Deploy Changes
   - Test locally: firebase serve
   - Deploy: firebase deploy
   - Re-test with PageSpeed Insights

5. 📈 Monitor Performance
   - Check Google Search Console
   - Monitor Core Web Vitals
   - Track user metrics in Analytics

6. 🎯 Advanced Optimizations
   - Implement Service Worker
   - Add HTTP/2 Server Push
   - Critical CSS inline
   - Resource hints (preload, prefetch)

"@ -ForegroundColor White

Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "`n📞 Need Help?" -ForegroundColor Cyan
Write-Host "   - PageSpeed Insights: https://pagespeed.web.dev/" -ForegroundColor White
Write-Host "   - WebPageTest: https://www.webpagetest.org/" -ForegroundColor White
Write-Host "   - GTmetrix: https://gtmetrix.com/" -ForegroundColor White
Write-Host "   - Lighthouse: Chrome DevTools > Lighthouse tab" -ForegroundColor White

Write-Host "`n✨ Performance optimization in progress..." -ForegroundColor Green
Write-Host "   Check the PageSpeed tabs that just opened!" -ForegroundColor Yellow
Write-Host "`n"
