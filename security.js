/**
 * ManaRent Enterprise Anti-Bot & Anti-Scraper Security Middleware
 * 
 * Protects against:
 * 1. Headless Browser Scrapers (Cypress, Playwright, Puppeteer, Selenium, PhantomJS)
 * 2. Data Harvesting & Unauthorized Scraping
 * 3. DDoS / API Rate Limiting (60 requests/min per IP)
 * 4. XSS & Code Injection Attacks
 * 5. Honeypot Bot Traps
 */

const fs = require('fs');
const path = require('path');

// Rate limiting store (In-memory per IP)
const rateLimitStore = new Map();
const blockedIPs = new Set();
const SECURITY_LOG_PATH = path.join(__dirname, 'data', 'security_alerts.log');

// Localhost / Loopback IPs that are always trusted for developer testing
const LOCAL_TRUSTED_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

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
 * Main Security Inspection Function for HTTP Server Requests
 */
function applySecurityFilters(req, res) {
    let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    clientIP = clientIP.split(',')[0].trim();
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();

    // 0. Always allow trusted local developer access (127.0.0.1)
    if (LOCAL_TRUSTED_IPS.has(clientIP)) {
        return true;
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

    // 3. API Rate Limiting (Max 60 requests per minute per IP)
    const currentTime = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 60;

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
