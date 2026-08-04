const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { applySecurityFilters, logSecurityAlert } = require('./security');

const PORT = 4000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/svg+xml'
};

const DB_PATH = path.join(__dirname, 'data', 'listings_db.json');
const SEED_PATH = path.join(__dirname, 'data', 'hyd_seed_data.js');
const ANALYTICS_PATH = path.join(__dirname, 'data', 'analytics.json');

let listingsDatabase = [];
let analyticsData = {
    totalPageViews: 0,
    dailyVisitors: {},
};

function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf-8');
            listingsDatabase = JSON.parse(data);
            console.log(`[DB] Loaded ${listingsDatabase.length} records from listings_db.json`);
        } else if (fs.existsSync(SEED_PATH)) {
            const seedContent = fs.readFileSync(SEED_PATH, 'utf-8');
            const match = seedContent.match(/const INITIAL_LISTINGS = (\[[\s\S]*?\]);/);
            if (match) {
                listingsDatabase = JSON.parse(match[1]);
                fs.writeFileSync(DB_PATH, JSON.stringify(listingsDatabase, null, 2), 'utf-8');
                console.log(`[DB] Saved ${listingsDatabase.length} seed listings to DB.`);
            }
        }
    } catch (err) {
        console.error(`[DB Error]`, err);
    }
}

function loadAnalytics() {
    try {
        if (fs.existsSync(ANALYTICS_PATH)) {
            const data = fs.readFileSync(ANALYTICS_PATH, 'utf-8');
            analyticsData = JSON.parse(data);
        }
    } catch (err) {}
}

function recordVisitor(ip) {
    const today = new Date().toISOString().split('T')[0];
    analyticsData.totalPageViews++;
    if (!analyticsData.dailyVisitors[today]) {
        analyticsData.dailyVisitors[today] = { views: 0, uniqueIPs: [] };
    }
    analyticsData.dailyVisitors[today].views++;
    if (!analyticsData.dailyVisitors[today].uniqueIPs.includes(ip)) {
        analyticsData.dailyVisitors[today].uniqueIPs.push(ip);
    }

    try {
        fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(analyticsData, null, 2), 'utf-8');
    } catch (e) {}
}

loadDatabase();
loadAnalytics();

// --- AUTOMATED 2-HOUR BACKGROUND SCRAPER SCHEDULER ---
const SCRAPE_INTERVAL_HOURS = 2;
const SCRAPE_INTERVAL_MS = SCRAPE_INTERVAL_HOURS * 60 * 60 * 1000;

function runAutoScraper() {
    console.log(`[AutoScraper] Running automated background data collection (Schedule: Every ${SCRAPE_INTERVAL_HOURS} hours)...`);
    const scraperScript = path.join(__dirname, 'real_data_scraper.js');
    
    exec(`node "${scraperScript}"`, (err, stdout, stderr) => {
        if (err) {
            console.error(`[AutoScraper Error]`, err.message);
            return;
        }
        console.log(`[AutoScraper Output]\n${stdout}`);
        loadDatabase();
    });
}

setInterval(runAutoScraper, SCRAPE_INTERVAL_MS);

// --- KEEP-ALIVE PING LOOP TO PREVENT RENDER SLEEP ---
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
function sendKeepAlivePing() {
    https.get('https://manarent.onrender.com/sitemap.xml', (res) => {
        console.log(`[KeepAlive] Ping sent to https://manarent.onrender.com/sitemap.xml. Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.log(`[KeepAlive Error] ${err.message}`);
    });
}
setInterval(sendKeepAlivePing, KEEP_ALIVE_INTERVAL_MS);

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const server = http.createServer((req, res) => {
    if (!applySecurityFilters(req, res)) {
        return;
    }

    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:4000'}`);
    const pathname = reqUrl.pathname;

    recordVisitor(clientIP);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Googlebot Favicon Route
    if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
        const faviconPath = path.join(__dirname, 'favicon.svg');
        fs.readFile(faviconPath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); }
            else { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); res.end(data); }
        });
        return;
    }

    // Google AdSense ads.txt Route
    if (pathname === '/ads.txt') {
        const adsTxtPath = path.join(__dirname, 'ads.txt');
        fs.readFile(adsTxtPath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); }
            else { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(data); }
        });
        return;
    }

    // Google Search Console Ownership Verification Route
    if (pathname === '/googlee96d2a214376ff98.html') {
        const verifyFilePath = path.join(__dirname, 'googlee96d2a214376ff98.html');
        fs.readFile(verifyFilePath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); }
            else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data); }
        });
        return;
    }

    // SEO Dynamic Sitemap Route with All Subcity Landing Pages, Guides & Listing URLs
    if (pathname === '/sitemap.xml') {
        const domain = "https://manarent.onrender.com";
        const staticPages = [
            "",
            "/index.html",
            "/about.html",
            "/privacy.html",
            "/terms.html",
            "/contact.html",
            "/guides/best-areas-to-rent-in-hyderabad",
            "/guides/kondapur-vs-gachibowli-rentals",
            "/guides/hyderabad-pg-vs-flat-guide"
        ];

        const subcities = [
            "kukatpally", "kondapur", "hitech", "gachibowli", "madhapur", "miyapur", "secunderabad", "keesara", "dammaiguda", "nagaram", "ghatkesar", "boduppal", "kapra", "kushaiguda", "cherlapally", "begumpet", "banjara", "jubilee"
        ];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        staticPages.forEach(p => {
            xml += `  <url>\n    <loc>${domain}${p}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${p === '' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
        });

        // Add Subcity SEO Landing Pages
        subcities.forEach(area => {
            xml += `  <url>\n    <loc>${domain}/rent/hyderabad/${area}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
        });

        // Add Individual Listings
        listingsDatabase.slice(0, 500).forEach(item => {
            const dateStr = item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
            xml += `  <url>\n    <loc>${domain}/listing/${encodeURIComponent(item.id)}</loc>\n    <lastmod>${dateStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
        });

        xml += `</urlset>`;

        res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
        res.end(xml);
        return;
    }

    // SEO Subcity Locality Landing Pages (/rent/:city/:area)
    if (pathname.startsWith('/rent/')) {
        const parts = pathname.split('/').filter(Boolean); // ['rent', 'hyderabad', 'kukatpally']
        const cityKey = parts[1] || 'hyderabad';
        const areaId = parts[2] || 'all';

        const areaNameFormatted = areaId.charAt(0).toUpperCase() + areaId.slice(1);
        const cityNameFormatted = cityKey.charAt(0).toUpperCase() + cityKey.slice(1);

        const matchingListings = listingsDatabase.filter(item => {
            if (item.cityKey !== cityKey) return false;
            if (areaId !== 'all' && item.areaId !== areaId) return false;
            return true;
        });

        const displayItems = matchingListings.length > 0 ? matchingListings.slice(0, 24) : listingsDatabase.slice(0, 24);

        const title = `Flats, PGs, Bikes & Rentals in ${areaNameFormatted}, ${cityNameFormatted} (Zero Brokerage) | ManaRent`;
        const description = `Browse verified 1 BHK, 2 BHK flats, PGs, bike rentals & self-drive cars in ${areaNameFormatted}, ${cityNameFormatted}. Direct owner contact via WhatsApp or Call.`;
        const canonicalUrl = `https://manarent.onrender.com/rent/${cityKey}/${areaId}`;

        const cardsHtml = displayItems.map(item => {
            const waMsg = encodeURIComponent(`Hi ${item.ownerName}, I am interested in your listing "${item.title}" in ${item.areaName} on ManaRent.`);
            const waUrl = `https://wa.me/${item.whatsapp}?text=${waMsg}`;
            const phoneUrl = `tel:+${item.phone}`;
            const listingDetailUrl = `/listing/${encodeURIComponent(item.id)}`;

            return `
                <div class="listing-card">
                    <div class="card-image-wrapper">
                        <a href="${listingDetailUrl}">
                            <img src="${item.image}" alt="${escapeHtml(item.title)}" class="card-image" loading="lazy">
                        </a>
                        ${item.featured ? `<span class="badge-featured">⭐ Featured</span>` : ''}
                        ${item.verified ? `<span class="badge-verified">✓ Verified Owner</span>` : ''}
                    </div>
                    <div class="card-body">
                        <div class="card-area-tag">📍 ${escapeHtml(item.areaName)} (${escapeHtml(item.cityName || 'Hyd')})</div>
                        <h3 class="card-title">
                            <a href="${listingDetailUrl}" style="color:#fff; text-decoration:none;">${escapeHtml(item.title.replace(/^Real Business:\s*/i, ''))}</a>
                        </h3>
                        <div class="card-landmark">📍 ${escapeHtml(item.landmark)}</div>
                        <div class="card-specs">${escapeHtml(item.specs)}</div>
                        <div class="card-footer">
                            <div class="price-wrapper">
                                <span class="price-amount">₹${item.price.toLocaleString("en-IN")}</span>
                                <span class="price-period">per ${escapeHtml(item.period)}</span>
                            </div>
                            <div class="card-actions">
                                <a href="${waUrl}" target="_blank" class="btn-whatsapp" style="text-decoration:none;">💬 WhatsApp</a>
                                <a href="${phoneUrl}" class="btn-call" style="text-decoration:none;">📞 Call</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${canonicalUrl}">
    <link rel="stylesheet" href="/styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body style="background:#070a12; color:#fff; font-family:'Outfit',sans-serif;">
    <div style="max-width:1320px; margin:0 auto; padding:2rem 1.5rem;">
        <a href="/" style="color:#c084fc; text-decoration:none; font-weight:700; display:inline-block; margin-bottom:1.5rem;">← Home</a>
        <h1 style="font-size:2.2rem; font-weight:900; margin-bottom:0.5rem;">Verified Rentals in ${escapeHtml(areaNameFormatted)}, ${escapeHtml(cityNameFormatted)}</h1>
        <p style="color:#94a3b8; margin-bottom:2rem;">Find 1 BHK, 2 BHK flats, PGs, bike rentals & self-drive cars in ${escapeHtml(areaNameFormatted)} with direct owner contact.</p>
        
        <div class="listings-grid">
            ${cardsHtml}
        </div>
    </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
    }

    // SEO Hyderabad Locality Guides Route (/guides/:slug)
    if (pathname.startsWith('/guides/')) {
        const slug = pathname.replace('/guides/', '').trim();
        let articleTitle = "Hyderabad Rental Guide 2026";
        let articleContent = "";

        if (slug === "best-areas-to-rent-in-hyderabad") {
            articleTitle = "Best Areas to Rent a Flat or PG in Hyderabad (2026 Locality Guide)";
            articleContent = `
                <h2>Top IT & Residential Rental Hubs in Hyderabad</h2>
                <p>Choosing the right area to rent in Hyderabad depends on your work location, metro connectivity, and budget. Here is a breakdown of top IT hubs:</p>
                <ul>
                    <li><b>Kondapur & Madhapur:</b> Ideal for IT professionals working in Mindspace and Cyber Towers. Average 2 BHK rent ranges from ₹22,000 to ₹35,000 per month.</li>
                    <li><b>Gachibowli & Financial District:</b> Best for employees at Google, Microsoft, and Amazon. Offers high-end gated community flats and luxury PGs.</li>
                    <li><b>Kukatpally / KPHB Colony:</b> Excellent budget-friendly area with direct Red Line metro connectivity to Ameerpet and Hitech City. Average 2 BHK rent ranges from ₹15,000 to ₹24,000 per month.</li>
                    <li><b>Miyapur & Chanda Nagar:</b> Quiet residential areas offering spacious 2 BHK and 3 BHK houses at affordable rates.</li>
                </ul>
            `;
        } else if (slug === "kondapur-vs-gachibowli-rentals") {
            articleTitle = "Kondapur vs Gachibowli: Rental Price & Lifestyle Comparison";
            articleContent = `
                <h2>Kondapur vs Gachibowli Rental Breakdown</h2>
                <p>Both Kondapur and Gachibowli are premier IT corridor residential areas in Hyderabad. Here is how they compare:</p>
                <ul>
                    <li><b>Kondapur:</b> More vibrant street life, abundant grocery markets, close to Botanical Garden. Rent for 2 BHK: ₹20,000 - ₹30,000.</li>
                    <li><b>Gachibowli:</b> Wider roads, proximity to Financial District, larger gated communities. Rent for 2 BHK: ₹25,000 - ₹40,000.</li>
                </ul>
            `;
        } else {
            articleTitle = "PG vs Flat for Rent in Hyderabad: Cost & Convenience Guide";
            articleContent = `
                <h2>PG vs Flat Comparison for IT Employees</h2>
                <p>Deciding between a Paying Guest (PG) hostel and an independent flat in Hyderabad depends on your lifestyle:</p>
                <ul>
                    <li><b>PG Hostels:</b> All-inclusive (food, Wi-Fi, housekeeping). Cost: ₹7,000 to ₹14,000 per month. Perfect for solo bachelor IT professionals.</li>
                    <li><b>Flats:</b> Full privacy, cooking freedom. Rent: ₹16,000 to ₹30,000 per month (plus maintenance and electricity). Ideal for families or friends sharing.</li>
                </ul>
            `;
        }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(articleTitle)} | ManaRent Guides</title>
    <meta name="description" content="${escapeHtml(articleTitle)} - Complete guide to rents, locality comparison, and zero brokerage owner contacts in Hyderabad.">
    <link rel="canonical" href="https://manarent.onrender.com${pathname}">
    <link rel="stylesheet" href="/styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body style="background:#070a12; color:#fff; font-family:'Outfit',sans-serif; padding: 2rem 1rem;">
    <div style="max-width:800px; margin:0 auto; background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:2rem; box-shadow:0 12px 35px rgba(0,0,0,0.5);">
        <a href="/" style="color:#c084fc; text-decoration:none; font-weight:700; display:inline-block; margin-bottom:1.5rem;">← Back to Home</a>
        <h1 style="font-size:2.2rem; font-weight:900; margin-bottom:1.5rem; color:#fff;">${escapeHtml(articleTitle)}</h1>
        <div style="color:#cbd5e1; line-height:1.8; font-size:1.05rem;">
            ${articleContent}
        </div>
        <div style="margin-top:2.5rem; text-align:center; background:rgba(139,92,246,0.15); border:1px solid var(--primary); padding:1.5rem; border-radius:12px;">
            <h3 style="margin:0 0 0.5rem 0; color:#fff;">Looking for a Rental in Hyderabad?</h3>
            <p style="margin:0 0 1rem 0; color:#94a3b8;">Browse 100% Zero-Brokerage Verified Owner Listings</p>
            <a href="/" class="btn-primary" style="text-decoration:none; padding:0.65rem 1.5rem;">Explore All Rentals Now</a>
        </div>
    </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
    }

    // Individual Listing Detail Page SSR Route (/listing/:id)
    if (pathname.startsWith('/listing/')) {
        const listingId = pathname.replace('/listing/', '').trim();
        const item = listingsDatabase.find(l => l.id === listingId) || listingsDatabase[0];
        const cleanTitle = (item.title || '').replace(/^Real Business:\s*/i, '');

        const title = `${cleanTitle} for Rent in ${item.areaName}, ${item.cityName || 'Hyderabad'} | ManaRent`;
        const description = `Rent ${cleanTitle} in ${item.areaName}, ${item.landmark}, ${item.cityName || 'Hyderabad'} for ₹${item.price.toLocaleString("en-IN")}/${item.period}. Zero brokerage direct owner contact via WhatsApp or Call.`;
        const canonicalUrl = `https://manarent.onrender.com/listing/${item.id}`;

        const waMsg = encodeURIComponent(`Hi ${item.ownerName}, I am interested in your listing "${cleanTitle}" in ${item.areaName} on ManaRent.`);
        const waUrl = `https://wa.me/${item.whatsapp}?text=${waMsg}`;
        const phoneUrl = `tel:+${item.phone}`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${canonicalUrl}">

    <!-- Open Graph SEO -->
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${item.image}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:type" content="website">

    <!-- Schema.org JSON-LD Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": "${escapeHtml(cleanTitle)}",
      "image": "${item.image}",
      "description": "${escapeHtml(item.specs)} - ${escapeHtml(item.landmark)}, ${escapeHtml(item.areaName)}",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "INR",
        "price": "${item.price}",
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Person",
          "name": "${escapeHtml(item.ownerName)}"
        }
      }
    }
    </script>

    <link rel="stylesheet" href="/styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body style="background:#070a12; color:#fff; font-family:'Outfit',sans-serif; padding: 2rem 1rem;">
    <div style="max-width:800px; margin:0 auto; background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:2rem; box-shadow:0 12px 35px rgba(0,0,0,0.5);">
        <a href="/" style="color:#c084fc; text-decoration:none; font-weight:700; display:inline-block; margin-bottom:1.5rem;">← Back to All ManaRent Listings</a>
        <img src="${item.image}" alt="${escapeHtml(cleanTitle)}" style="width:100%; height:380px; object-fit:cover; border-radius:12px; margin-bottom:1.5rem;">
        <span style="background:rgba(139,92,246,0.2); color:#c084fc; padding:4px 12px; border-radius:20px; font-weight:700; font-size:0.8rem; text-transform:uppercase;">📍 ${escapeHtml(item.areaName)} (${escapeHtml(item.cityName || 'Hyderabad')})</span>
        <h1 style="font-size:2rem; margin:1rem 0 0.5rem 0; font-weight:800;">${escapeHtml(cleanTitle)}</h1>
        <p style="color:#94a3b8; font-size:1rem; margin-bottom:1rem;">📍 ${escapeHtml(item.landmark)}</p>
        
        <div style="font-size:1.8rem; font-weight:900; color:#22c55e; margin-bottom:1.5rem;">₹${item.price.toLocaleString("en-IN")} <span style="font-size:0.9rem; color:#94a3b8;">per ${escapeHtml(item.period)}</span></div>

        <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:1rem; margin-bottom:1.5rem;">
            <h4 style="margin:0 0 0.5rem 0; color:#c084fc;">Property Specifications</h4>
            <p style="margin:0; color:#cbd5e1;">${escapeHtml(item.specs)}</p>
        </div>

        <div style="background:linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.1)); border:1px solid rgba(239, 68, 68, 0.35); padding:0.8rem 1rem; border-radius:8px; margin-bottom:1.5rem; color:#fca5a5; font-size:0.85rem;">
            🛡️ <b>Tenant Safety Warning:</b> Never pay any online token advance before visiting & inspecting the property physically!
        </div>

        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
            <a href="${waUrl}" target="_blank" style="flex:1; background:#25d366; color:#fff; text-align:center; padding:0.85rem; border-radius:8px; font-weight:800; text-decoration:none; display:inline-block;">💬 Chat on WhatsApp</a>
            <a href="${phoneUrl}" style="flex:1; background:#8b5cf6; color:#fff; text-align:center; padding:0.85rem; border-radius:8px; font-weight:800; text-decoration:none; display:inline-block;">📞 Call Owner (${escapeHtml(item.ownerName)})</a>
        </div>
    </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
    }

    if (pathname === '/robots.txt') {
        const robotsPath = path.join(__dirname, 'robots.txt');
        fs.readFile(robotsPath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); }
            else { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(data); }
        });
        return;
    }

    // GET /api/analytics
    if (pathname === '/api/analytics' && req.method === 'GET') {
        const today = new Date().toISOString().split('T')[0];
        const todayData = analyticsData.dailyVisitors[today] || { views: 0, uniqueIPs: [] };

        const allUniqueIPs = new Set();
        Object.values(analyticsData.dailyVisitors).forEach(day => {
            if (day.uniqueIPs) day.uniqueIPs.forEach(ip => allUniqueIPs.add(ip));
        });

        const summary = {
            totalPageViewsAllTime: analyticsData.totalPageViews,
            totalUniqueVisitorsAllTime: allUniqueIPs.size,
            todayDate: today,
            todayTotalViews: todayData.views,
            todayUniqueVisitors: todayData.uniqueIPs.length,
            dailyHistory: Object.keys(analyticsData.dailyVisitors).map(date => ({
                date,
                pageViews: analyticsData.dailyVisitors[date].views,
                uniqueVisitors: analyticsData.dailyVisitors[date].uniqueIPs.length
            }))
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(summary, null, 2));
        return;
    }

    // GET /api/stats
    if (pathname === '/api/stats' && req.method === 'GET') {
        const today = new Date().toISOString().split('T')[0];
        const todayData = analyticsData.dailyVisitors[today] || { views: 0, uniqueIPs: [] };
        
        const stats = {
            totalListings: listingsDatabase.length,
            securityEngine: "Anti-Bot & Anti-Scraper Shield Active",
            todayUniqueVisitors: todayData.uniqueIPs.length,
            todayTotalViews: todayData.views,
            targetCapacity: "100,000+ Listings Architecture",
            citiesCount: 6,
            autoScraperInterval: "Every 2 Hours",
            lastUpdated: new Date().toISOString()
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
        return;
    }

    // GET /api/trigger-scrape
    if (pathname === '/api/trigger-scrape' && req.method === 'GET') {
        runAutoScraper();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: "Automated background scraper triggered!" }));
        return;
    }

    // GET /api/listings
    if (pathname === '/api/listings' && req.method === 'GET') {
        const queryParams = reqUrl.searchParams;
        const page = parseInt(queryParams.get('page') || '1', 10);
        const limit = parseInt(queryParams.get('limit') || '24', 10);
        const city = queryParams.get('city') || 'hyderabad';
        const area = queryParams.get('area') || 'all';
        const category = queryParams.get('category') || 'all';
        const search = (queryParams.get('search') || '').toLowerCase().trim();
        const sort = queryParams.get('sort') || 'default';

        let results = listingsDatabase.filter(item => {
            const itemCity = item.cityKey || 'hyderabad';
            if (city !== 'all' && itemCity !== city) return false;
            if (area !== 'all' && item.areaId !== area) return false;
            if (category !== 'all' && item.category !== category) return false;

            if (search) {
                const matchTitle = (item.title || '').toLowerCase().includes(search);
                const matchLandmark = (item.landmark || '').toLowerCase().includes(search);
                const matchArea = (item.areaName || '').toLowerCase().includes(search);
                const matchTags = item.tags && item.tags.some(t => t.toLowerCase().includes(search));
                if (!matchTitle && !matchLandmark && !matchArea && !matchTags) return false;
            }

            return true;
        });

        if (sort === 'lowToHigh') results.sort((a, b) => a.price - b.price);
        if (sort === 'highToLow') results.sort((a, b) => b.price - a.price);
        if (sort === 'rating') results.sort((a, b) => (b.rating || 0) - (a.rating || 0));

        const total = results.length;
        const startIndex = (page - 1) * limit;
        const paginatedItems = results.slice(startIndex, startIndex + limit);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: startIndex + limit < total,
            data: paginatedItems
        }));
        return;
    }

    // POST /api/submit
    if (pathname === '/api/submit' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const raw = JSON.parse(body);

                if (raw.website_honeypot_trap) {
                    logSecurityAlert(req.socket.remoteAddress, "Honeypot Bot Trap Triggered", req.headers['user-agent']);
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Access Denied: Automated bot activity detected." }));
                    return;
                }

                const newListing = {
                    id: 'real-user-' + Date.now(),
                    cityKey: escapeHtml(raw.cityKey || 'hyderabad'),
                    cityName: escapeHtml(raw.cityName || 'Hyderabad'),
                    title: escapeHtml(raw.title || 'Untitled Rental'),
                    category: escapeHtml(raw.category || 'house'),
                    areaId: escapeHtml(raw.areaId || 'all'),
                    areaName: escapeHtml(raw.areaName || 'Hyderabad'),
                    landmark: escapeHtml(raw.landmark || 'City Center'),
                    price: parseInt(raw.price || '0', 10),
                    period: escapeHtml(raw.period || 'month'),
                    deposit: parseInt(raw.price || '0', 10) * 2,
                    specs: escapeHtml(raw.specs || 'Verified Rental Specs'),
                    tags: ["Direct Owner Listing", "Just Posted"],
                    image: raw.image || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
                    ownerName: escapeHtml(raw.ownerName || 'Owner'),
                    phone: escapeHtml(raw.phone || '919876543210'),
                    whatsapp: escapeHtml(raw.whatsapp || '919876543210'),
                    verified: true,
                    rating: 5.0,
                    featured: true,
                    createdAt: new Date().toISOString()
                };

                listingsDatabase.unshift(newListing);
                fs.writeFileSync(DB_PATH, JSON.stringify(listingsDatabase, null, 2), 'utf-8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: newListing.id, total: listingsDatabase.length }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // Helper: Pre-Render SSR HTML for Top 24 Listings for Google Crawlers
    function getPreRenderedListingsHtml() {
        const top24 = listingsDatabase.slice(0, 24);
        return top24.map(item => {
            const waMsg = encodeURIComponent(`Hi ${item.ownerName}, I am interested in your listing "${item.title}" in ${item.areaName} on ManaRent.`);
            const waUrl = `https://wa.me/${item.whatsapp}?text=${waMsg}`;
            const phoneUrl = `tel:+${item.phone}`;
            const listingDetailUrl = `/listing/${encodeURIComponent(item.id)}`;

            return `
                <div class="listing-card">
                    <div class="card-image-wrapper">
                        <a href="${listingDetailUrl}">
                            <img src="${item.image}" alt="${escapeHtml(item.title)}" class="card-image" loading="lazy">
                        </a>
                        ${item.featured ? `<span class="badge-featured">⭐ Featured</span>` : ''}
                        ${item.verified ? `<span class="badge-verified">✓ Verified Owner</span>` : ''}
                    </div>
                    <div class="card-body">
                        <div class="card-area-tag">📍 ${escapeHtml(item.areaName)} (${escapeHtml(item.cityName || 'Hyd')})</div>
                        <h3 class="card-title">
                            <a href="${listingDetailUrl}" style="color:#fff; text-decoration:none;">${escapeHtml(item.title)}</a>
                        </h3>
                        <div class="card-landmark">📍 ${escapeHtml(item.landmark)}</div>
                        <div class="card-specs">${escapeHtml(item.specs)}</div>
                        
                        <div class="card-tags">
                            ${(item.tags || []).map(tag => `<span class="card-tag-item">${escapeHtml(tag)}</span>`).join('')}
                        </div>

                        <div class="card-footer">
                            <div class="price-wrapper">
                                <span class="price-amount">₹${item.price.toLocaleString("en-IN")}</span>
                                <span class="price-period">per ${escapeHtml(item.period)}</span>
                            </div>

                            <div class="card-actions">
                                <button onclick="connectOwnerWithAd('${waUrl}', '${escapeHtml(item.ownerName)}', 'whatsapp')" class="btn-whatsapp">
                                    💬 <span>WhatsApp</span>
                                </button>
                                <button onclick="connectOwnerWithAd('${phoneUrl}', '${escapeHtml(item.ownerName)}', 'phone')" class="btn-call">
                                    📞
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Static File Serving (Supporting Query Parameters on Root & Files)
    const isRoot = (pathname === '/' || pathname === '/index.html');
    let filePath = path.join(__dirname, isRoot ? 'index.html' : pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'text/html';

    fs.readFile(filePath, 'utf-8', (err, content) => {
        if (err) {
            if (err.code === 'ENOENT' || err.code === 'EISDIR') {
                fs.readFile(path.join(__dirname, 'index.html'), 'utf-8', (indexErr, indexContent) => {
                    if (indexErr) {
                        res.writeHead(500);
                        res.end('Server Error: Missing index.html');
                    } else {
                        const ssrHtml = indexContent.replace(
                            '<div class="listings-grid" id="listingsGrid">',
                            `<div class="listings-grid" id="listingsGrid">${getPreRenderedListingsHtml()}`
                        );
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(ssrHtml, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            if (isRoot) {
                const ssrHtml = content.replace(
                    '<div class="listings-grid" id="listingsGrid">',
                    `<div class="listings-grid" id="listingsGrid">${getPreRenderedListingsHtml()}`
                );
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(ssrHtml, 'utf-8');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 ManaRent Query Parameter Fix Server running at http://localhost:${PORT}`);
});
