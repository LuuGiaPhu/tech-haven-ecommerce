# SEO Test Script for TECH HAVEN
# Run this script to quickly test SEO elements

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     TECH HAVEN SEO TEST SCRIPT" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "https://tech-haven-5368b.web.app"

# Test 1: Check Sitemap
Write-Host "[1] Testing Sitemap.xml..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/sitemap.xml" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ Sitemap accessible (Status: $($response.StatusCode))" -ForegroundColor Green
        Write-Host "   ✓ Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Sitemap not accessible: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Check Robots.txt
Write-Host "[2] Testing Robots.txt..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/robots.txt" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ Robots.txt accessible (Status: $($response.StatusCode))" -ForegroundColor Green
        Write-Host "   Content:" -ForegroundColor Cyan
        $response.Content -split "`n" | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
    }
} catch {
    Write-Host "   ✗ Robots.txt not accessible: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Check Homepage Meta Tags
Write-Host "[3] Testing Homepage Meta Tags..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $baseUrl -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ Homepage accessible (Status: $($response.StatusCode))" -ForegroundColor Green
        
        # Check for important meta tags
        $content = $response.Content
        
        if ($content -match '<meta name="description"') {
            Write-Host "   ✓ Meta description found" -ForegroundColor Green
        } else {
            Write-Host "   ✗ Meta description missing" -ForegroundColor Red
        }
        
        if ($content -match 'og:title') {
            Write-Host "   ✓ Open Graph tags found" -ForegroundColor Green
        } else {
            Write-Host "   ✗ Open Graph tags missing" -ForegroundColor Red
        }
        
        if ($content -match 'twitter:card') {
            Write-Host "   ✓ Twitter Card tags found" -ForegroundColor Green
        } else {
            Write-Host "   ✗ Twitter Card tags missing" -ForegroundColor Red
        }
        
        if ($content -match '@type.*Product|@type.*Organization') {
            Write-Host "   ✓ JSON-LD Structured Data found" -ForegroundColor Green
        } else {
            Write-Host "   ✗ JSON-LD Structured Data missing" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   ✗ Homepage not accessible: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Check Shop Page
Write-Host "[4] Testing Shop Page..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/shop" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ Shop page accessible (Status: $($response.StatusCode))" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Shop page not accessible: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: SSL Certificate
Write-Host "[5] Testing SSL Certificate..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $baseUrl -UseBasicParsing
    Write-Host "   ✓ HTTPS working correctly" -ForegroundColor Green
} catch {
    Write-Host "   ✗ SSL issue detected" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     ONLINE TESTING TOOLS" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open these URLs in your browser for detailed testing:" -ForegroundColor White
Write-Host ""
Write-Host "1. SEO Test Tool (Local):" -ForegroundColor Cyan
Write-Host "   $baseUrl/test-seo.html" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Google Rich Results Test:" -ForegroundColor Cyan
Write-Host "   https://search.google.com/test/rich-results?url=$baseUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. PageSpeed Insights:" -ForegroundColor Cyan
Write-Host "   https://pagespeed.web.dev/analysis?url=$baseUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Facebook Debugger:" -ForegroundColor Cyan
Write-Host "   https://developers.facebook.com/tools/debug/?q=$baseUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "5. Meta Tags Analyzer:" -ForegroundColor Cyan
Write-Host "   https://metatags.io/?url=$baseUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan

# Ask to open SEO test tool
Write-Host ""
$open = Read-Host "Open SEO Test Tool in browser? (Y/N)"
if ($open -eq "Y" -or $open -eq "y") {
    Start-Process "$baseUrl/test-seo.html"
}
