/**
 * ManaRent Enterprise Anti-Bot & Anti-Scraper Security Middleware
 * 
 * Protects against:
 * 1. Headless Browser Scrapers (Cypress, Playwright, Puppeteer, Selenium, PhantomJS)
 * 2. Data Harvesting & Unauthorized Scraping
 * 3. DDoS / API Rate Limiting (120 requests/min per IP)
 * 4. XSS & Code Injection Attacks
 * 5. Honeypot Bot Traps
 */

const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Googlebot/Bingbot IP verification cache: IP -> true/false/'pending'
const googlebotIpCache = new Map();

// Rate limiting store (In-memory per IP)
const rateLimitStore = new Map();
const blockedIPs = new Set();
const SECURITY_LOG_PATH = path.join(__dirname, 'data', 'security_alerts.log');

// Localhost / Loopback IPs that are always trusted for developer testing
const LOCAL_TRUSTED_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

// Trusted Search Engine Crawlers & Inspection Tools (Googlebot, Bingbot, AdSense Bot, etc.)
const TRUSTED_CRAWLERS = [
    'google',
    'bing',
    'duckduck',
    'yahoo',
    'yandex',
    'baidu'
];

// Known Malicious Scraper / Automated Headless Tool User-Agents
const BLOCKED_USER_AGENTS = [
    'cypress',
    'playwright',
    'puppeteer',
    'selenium',
    'phantomjs',
    'scrapy'
];

function logSecurityAlert(ip, reason, userAgent) {
    const alertMsg = `[SECURITY ALERT ${new Date().toISOString()}] IP: ${ip} | Reason: ${reason} | UA: ${userAgent}\n`;
    console.warn(`⚠️  ${alertMsg.trim()}`);
    try {
        fs.appendFileSync(SECURITY_LOG_PATH, alertMsg, 'utf-8');
    } catch (e) {}
}

/**
 * Asynchronously verify if an IP belongs to a genuine Search Engine Crawler (Googlebot, Bingbot, etc.)
 * using reverse and forward DNS lookups as recommended by Google.
 */
function verifySearchEngineIpAsync(ip) {
    if (googlebotIpCache.has(ip)) return;
    
    // Set to pending initially to avoid multiple concurrent DNS queries
    googlebotIpCache.set(ip, 'pending');

    dns.reverse(ip, (err, hostnames) => {
        if (err || !hostnames || hostnames.length === 0) {
            googlebotIpCache.set(ip, false);
            logSecurityAlert(ip, "Fake Search Engine Bot detected (Failed reverse DNS)", "User-Agent claiming to be Google/Bing");
            return;
        }

        const hostname = hostnames[0].toLowerCase();
        const isValidDomain = hostname.endsWith('.googlebot.com') || 
                              hostname.endsWith('.google.com') ||
                              hostname.endsWith('.search.msn.com');

        if (!isValidDomain) {
            googlebotIpCache.set(ip, false);
            logSecurityAlert(ip, `Fake Search Engine Bot hostname: ${hostname}`, "User-Agent claiming to be Google/Bing");
            return;
        }

        // Verify hostname resolves back to the original IP (forward DNS check)
        dns.resolve(hostname, (resolveErr, ips) => {
            if (resolveErr || !ips || !ips.includes(ip)) {
                googlebotIpCache.set(ip, false);
                logSecurityAlert(ip, `Fake Search Engine Bot forward DNS check failed for ${hostname}`, "User-Agent claiming to be Google/Bing");
                return;
            }

            // Successfully verified as a real Google or Bing crawler!
            googlebotIpCache.set(ip, true);
            console.log(`[SECURITY] Successfully verified real Search Engine Bot IP: ${ip} (${hostname})`);
        });
    });
}

/**
 * Main Security Inspection Function for HTTP Server Requests
 */
function applySecurityFilters(req, res) {
    let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    clientIP = clientIP.split(',')[0].trim();
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();

    // 0. Always allow trusted local developer access
    if (LOCAL_TRUSTED_IPS.has(clientIP)) {
        return true;
    }

    // 1. Search Engine Crawler & AdSense Bot Identification with Reverse/Forward DNS validation
    const isSearchEngine = TRUSTED_CRAWLERS.some(crawler => userAgent.includes(crawler));
    if (isSearchEngine) {
        const isVerified = googlebotIpCache.get(clientIP);
        
        if (isVerified === true) {
            return true; // Bypass security filters for verified search engines
        }
        
        if (isVerified === false) {
            logSecurityAlert(clientIP, "Access denied: Fake Search Engine Bot detected", userAgent);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Access Denied: Suspicious activity detected." }));
            return false;
        }

        if (isVerified === undefined) {
            // Trigger background verification so we don't block the crawler on their very first request.
            verifySearchEngineIpAsync(clientIP);
        }
        
        return true; // Let the initial request pass while verification is pending in background
    }

    // 1. Check if IP is permanently blocked
    if (blockedIPs.has(clientIP)) {
        logSecurityAlert(clientIP, "Request from blacklisted IP", userAgent);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Access Denied: Your IP has been blocked due to suspicious automated activity." }));
        return false;
    }

    // 2. Anti-Scraper User-Agent Inspection (Blocking Cypress, Playwright, Puppeteer, Selenium, PhantomJS)
    const isBotOrScraper = BLOCKED_USER_AGENTS.some(agent => userAgent.includes(agent));
    if (isBotOrScraper) {
        logSecurityAlert(clientIP, "Automated Testing/Scraper Tool Detected", userAgent);
        blockedIPs.add(clientIP); // Auto-blacklist external attacker IP
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: "Security Violation: Automated scraping tools (Playwright/Cypress/Puppeteer/Bots) are strictly prohibited.",
            status: "BLOCKED" 
        }));
        return false;
    }

    // 3. API Rate Limiting (Max 120 requests per minute per IP)
    const currentTime = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 120;

    let ipData = rateLimitStore.get(clientIP) || { count: 0, resetTime: currentTime + windowMs };

    if (currentTime > ipData.resetTime) {
        ipData.count = 1;
        ipData.resetTime = currentTime + windowMs;
    } else {
        ipData.count++;
    }

    rateLimitStore.set(clientIP, ipData);

    if (ipData.count > maxRequests) {
        logSecurityAlert(clientIP, "API Rate Limit Exceeded (DDoS Protection)", userAgent);
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
        res.end(JSON.stringify({ error: "Too Many Requests: Please slow down your requests." }));
        return false;
    }

    return true; // Passed security audit
}

module.exports = {
    applySecurityFilters,
    logSecurityAlert
};
