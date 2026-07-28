const http = require('http');
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
    '.svg': 'image/svg+xml'
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

    // Google Search Console Ownership Verification Route
    if (pathname === '/googlee96d2a214376ff98.html') {
        const verifyFilePath = path.join(__dirname, 'googlee96d2a214376ff98.html');
        fs.readFile(verifyFilePath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); }
            else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data); }
        });
        return;
    }

    // SEO Routes
    if (pathname === '/sitemap.xml') {
        const sitemapPath = path.join(__dirname, 'sitemap.xml');
        fs.readFile(sitemapPath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); }
            else { res.writeHead(200, { 'Content-Type': 'application/xml' }); res.end(data); }
        });
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
        
        const summary = {
            totalPageViewsAllTime: analyticsData.totalPageViews,
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
                    image: escapeHtml(raw.image || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'),
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

    // Static File Serving
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 ManaRent Google Search Console Verification Server running at http://localhost:${PORT}`);
});
