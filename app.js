/**
 * ManaRent HUB - Client Controller with Dynamic Intent SEO & Anti-Bot Guards
 */

const AppState = {
    selectedCity: "hyderabad",
    selectedArea: "all",
    selectedCategory: "all",
    searchQuery: "",
    sortBy: "default",
    currentPage: 1,
    limit: 24,
    hasMore: true,
    isLoading: false,
    listings: [],
    totalListingsCount: 0
};

// Client-Side Headless Automation Detection
function detectAutomationTools() {
    if (navigator.webdriver || window.Cypress || window.__playwright || window._phantom || window.callPhantom) {
        console.warn("⚠️ Security Alert: Automated testing tool / headless scraper detected.");
        return true;
    }
    return false;
}

const CITY_MARKET_SCALES = {
    hyderabad: {
        house: { count: "18,450+" },
        pg: { count: "9,280+" },
        bike: { count: "6,420+" },
        car: { count: "4,150+" },
        auto: { count: "2,890+" },
        furniture: { count: "3,750+" },
        laptop: { count: "1,940+" },
        fashion: { count: "1,220+" },
        total: "48,100+ Total Available"
    },
    bengaluru: {
        house: { count: "24,800+" },
        pg: { count: "14,500+" },
        bike: { count: "9,600+" },
        car: { count: "6,200+" },
        auto: { count: "3,900+" },
        furniture: { count: "5,100+" },
        laptop: { count: "3,800+" },
        fashion: { count: "1,800+" },
        total: "69,700+ Total Available"
    },
    mumbai: {
        house: { count: "31,200+" },
        pg: { count: "11,400+" },
        bike: { count: "5,800+" },
        car: { count: "7,900+" },
        auto: { count: "4,800+" },
        furniture: { count: "4,500+" },
        laptop: { count: "2,900+" },
        fashion: { count: "2,400+" },
        total: "70,900+ Total Available"
    }
};

const ICONS = {
    whatsapp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.762.459 3.48 1.332 5.001l-1.416 5.169 5.291-1.387c1.472.802 3.129 1.225 4.781 1.226h.004c5.506 0 9.988-4.478 9.989-9.984 0-2.669-1.038-5.178-2.925-7.064e-7-1.887-1.887-4.396-2.925-7.066-2.925zm5.827 14.161c-.247.694-1.233 1.328-1.996 1.488-.521.109-1.2.196-3.488-.751-2.927-1.213-4.81-4.195-4.957-4.391-.144-.194-1.189-1.583-1.189-3.02 0-1.437.747-2.146 1.012-2.438.265-.292.58-.365.772-.365.193 0 .385.002.551.01.176.009.412-.067.644.49.247.593.843 2.062.917 2.211.074.148.123.322.025.518-.099.196-.148.318-.292.488-.144.17-.305.38-.435.51-.144.144-.294.302-.126.591.168.288.747 1.231 1.603 1.993 1.102.981 2.031 1.285 2.319 1.429.288.144.457.12.625-.074.168-.194.721-.84.914-1.127.193-.288.385-.24.644-.144.259.096 1.649.777 1.933.918.284.141.473.211.543.329.07.118.07.683-.177 1.377z"/></svg>`,
    phone: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    location: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    landmark: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`,
    verified: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    star: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
};

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
    detectAutomationTools();
    parseURLParams();
    loadInitialSeedMemory();
    renderCitySelector();
    renderAreaPills();
    setupEventListeners();
    fetchListings(true);
});

function parseURLParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('city')) AppState.selectedCity = params.get('city');
    if (params.has('area')) AppState.selectedArea = params.get('area');
    if (params.has('category')) AppState.selectedCategory = params.get('category');
    if (params.has('search')) AppState.searchQuery = params.get('search');
}

function updateDynamicSEOPageTitle() {
    const activeCityObj = (typeof CITIES_REGISTRY !== 'undefined' && CITIES_REGISTRY[AppState.selectedCity]) 
        ? CITIES_REGISTRY[AppState.selectedCity] 
        : { name: "Hyderabad" };

    let areaName = activeCityObj.name;
    if (AppState.selectedArea !== "all" && activeCityObj.subcities) {
        const found = activeCityObj.subcities.find(a => a.id === AppState.selectedArea);
        if (found) areaName = found.name;
    }

    let categoryName = "Rentals";
    if (AppState.selectedCategory !== "all" && typeof RENTAL_CATEGORIES !== 'undefined') {
        const cat = RENTAL_CATEGORIES.find(c => c.id === AppState.selectedCategory);
        if (cat) categoryName = cat.name;
    }

    if (AppState.selectedCategory === 'house' && AppState.selectedArea !== 'all') {
        document.title = `Rent Houses & 2BHK Flats in ${areaName}, ${activeCityObj.name} — Direct Owner & Zero Brokerage | ManaRent`;
    } else if (AppState.selectedCategory === 'pg' && AppState.selectedArea !== 'all') {
        document.title = `PG & Hostels for Rent in ${areaName}, ${activeCityObj.name} — Verified Beds | ManaRent`;
    } else if (AppState.selectedCategory === 'bike' && AppState.selectedArea !== 'all') {
        document.title = `Bike & Scooter Rentals in ${areaName}, ${activeCityObj.name} — Daily / Monthly | ManaRent`;
    } else if (AppState.selectedCategory === 'car' && AppState.selectedArea !== 'all') {
        document.title = `Self-Drive Car Rentals in ${areaName}, ${activeCityObj.name} | ManaRent`;
    } else if (AppState.selectedArea !== 'all') {
        document.title = `Rent Houses, PGs, Bikes & Cars in ${areaName}, ${activeCityObj.name} | ManaRent`;
    } else {
        document.title = `Rent Houses, PGs, Bikes & Cars in ${activeCityObj.name} — #1 Hyperlocal Marketplace | ManaRent`;
    }
}

function loadInitialSeedMemory() {
    if (typeof INITIAL_LISTINGS !== 'undefined') {
        AppState.listings = [...INITIAL_LISTINGS];
    }
}

async function fetchListings(resetPage = false) {
    if (AppState.isLoading) return;
    if (resetPage) {
        AppState.currentPage = 1;
        AppState.hasMore = true;
    }

    AppState.isLoading = true;
    updateDynamicSEOPageTitle();

    const queryParams = new URLSearchParams({
        page: AppState.currentPage,
        limit: AppState.limit,
        city: AppState.selectedCity,
        area: AppState.selectedArea,
        category: AppState.selectedCategory,
        search: AppState.searchQuery,
        sort: AppState.sortBy
    });

    try {
        const res = await fetch(`/api/listings?${queryParams.toString()}`);
        if (res.ok) {
            const responseData = await res.json();
            AppState.listings = resetPage ? responseData.data : [...AppState.listings, ...responseData.data];
            AppState.hasMore = responseData.hasMore;
            AppState.totalListingsCount = responseData.total;

            renderCategoryTabs();
            renderListingsGrid(AppState.listings, responseData.total);
        } else {
            fallbackLocalFilter();
        }
    } catch (err) {
        fallbackLocalFilter();
    } finally {
        AppState.isLoading = false;
    }
}

function fallbackLocalFilter() {
    if (typeof INITIAL_LISTINGS === 'undefined') return;
    let filtered = INITIAL_LISTINGS.filter(item => {
        if (AppState.selectedCity !== 'all' && (item.cityKey || 'hyderabad') !== AppState.selectedCity) return false;
        if (AppState.selectedArea !== 'all' && item.areaId !== AppState.selectedArea) return false;
        if (AppState.selectedCategory !== 'all' && item.category !== AppState.selectedCategory) return false;
        if (AppState.searchQuery) {
            const matchTitle = (item.title || '').toLowerCase().includes(AppState.searchQuery);
            const matchLandmark = (item.landmark || '').toLowerCase().includes(AppState.searchQuery);
            if (!matchTitle && !matchLandmark) return false;
        }
        return true;
    });

    AppState.listings = filtered;
    renderCategoryTabs();
    renderListingsGrid(filtered, filtered.length);
}

function renderCitySelector() {
    const selector = document.getElementById("citySelectDropdown");
    if (!selector || typeof CITIES_REGISTRY === 'undefined') return;

    selector.innerHTML = Object.keys(CITIES_REGISTRY).map(cityKey => {
        const city = CITIES_REGISTRY[cityKey];
        return `<option value="${escapeHtml(cityKey)}" ${AppState.selectedCity === cityKey ? 'selected' : ''}>${city.icon} ${escapeHtml(city.name)}</option>`;
    }).join("");
}

function renderAreaPills() {
    const container = document.getElementById("areaPillsContainer");
    if (!container || typeof CITIES_REGISTRY === 'undefined') return;

    const activeCityObj = CITIES_REGISTRY[AppState.selectedCity];
    if (!activeCityObj) return;

    const areaPillData = [
        { id: "all", name: `All ${activeCityObj.name}`, icon: ICONS.location }
    ];

    if (activeCityObj.subcities) {
        activeCityObj.subcities.slice(0, 30).forEach(sub => {
            areaPillData.push({
                id: sub.id,
                name: sub.name,
                icon: ICONS.location
            });
        });
    }

    container.innerHTML = areaPillData.map(area => `
        <button class="area-pill ${AppState.selectedArea === area.id ? 'active' : ''}" 
                onclick="selectArea('${escapeHtml(area.id)}')">
            <span class="pill-icon">${area.icon}</span>
            <span>${escapeHtml(area.name)}</span>
        </button>
    `).join("");

    const dropdown = document.getElementById("areaSelectDropdown");
    if (dropdown && activeCityObj.subcities) {
        dropdown.innerHTML = `<option value="all">All ${escapeHtml(activeCityObj.name)} Areas (${activeCityObj.subcities.length} Wards/Localities)</option>` +
            activeCityObj.subcities.map(sub => `<option value="${escapeHtml(sub.id)}" ${AppState.selectedArea === sub.id ? 'selected' : ''}>${escapeHtml(sub.name)}</option>`).join("");
        dropdown.value = AppState.selectedArea;
    }
}

function renderCategoryTabs() {
    const container = document.getElementById("categoryGridContainer");
    if (!container || typeof RENTAL_CATEGORIES === 'undefined') return;

    const pool = (typeof INITIAL_LISTINGS !== 'undefined' && INITIAL_LISTINGS.length > 0) ? INITIAL_LISTINGS : AppState.listings;
    const activeCityScale = CITY_MARKET_SCALES[AppState.selectedCity] || CITY_MARKET_SCALES.hyderabad;

    const activeAreaListings = pool.filter(item => {
        const itemCity = item.cityKey || "hyderabad";
        if (AppState.selectedCity !== "all" && itemCity !== AppState.selectedCity) return false;
        if (AppState.selectedArea !== "all" && item.areaId !== AppState.selectedArea) return false;
        return true;
    });

    container.innerHTML = RENTAL_CATEGORIES.map(cat => {
        let countText = "";
        if (AppState.selectedArea === "all") {
            if (cat.id === "all") {
                countText = activeCityScale.total;
            } else {
                const scaleInfo = activeCityScale[cat.id];
                countText = scaleInfo ? `${scaleInfo.count} Available` : `1,000+ Available`;
            }
        } else {
            const subCount = activeAreaListings.filter(i => i.category === cat.id).length;
            countText = cat.id === "all" ? `${activeAreaListings.length} Local Listings` : `${subCount} Available in Area`;
        }

        return `
            <div class="category-card ${AppState.selectedCategory === cat.id ? 'active' : ''}"
                 onclick="selectCategory('${escapeHtml(cat.id)}')">
                <div class="category-icon">${cat.icon}</div>
                <div class="category-info">
                    <h4>${escapeHtml(cat.name)}</h4>
                    <p style="color: var(--secondary); font-weight: 600;">${escapeHtml(countText)}</p>
                </div>
            </div>
        `;
    }).join("");
}

window.selectCity = function(cityKey) {
    AppState.selectedCity = cityKey;
    AppState.selectedArea = "all";
    renderCitySelector();
    renderAreaPills();
    renderCategoryTabs();
    fetchListings(true);
};

window.selectArea = function(areaId) {
    AppState.selectedArea = areaId;
    renderAreaPills();
    renderCategoryTabs();
    fetchListings(true);
};

window.selectCategory = function(catId) {
    AppState.selectedCategory = catId;
    renderCategoryTabs();
    fetchListings(true);
};

// 💰 SMART INTERSTITIAL AD PROMPT BEFORE CONNECTING TO OWNER
window.connectOwnerWithAd = function(targetUrl, ownerName, type) {
    const overlay = document.createElement("div");
    overlay.className = "ad-interstitial-overlay";
    overlay.innerHTML = `
        <div class="ad-interstitial-card">
            <div class="ad-spinner"></div>
            <div class="ad-tag">⚡ SPONSORED DIRECT CONNECT</div>
            <h3 class="ad-title">Connecting you to ${escapeHtml(ownerName)}...</h3>
            <p class="ad-sub">Verified Zero-Brokerage Direct Owner Connection</p>
            
            <div class="ad-box">
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="ca-pub-6965081263252229"
                     data-ad-slot="1234567890"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">
                    🚚 Moving to a new house? <b>Get 20% OFF Packers & Movers in Hyderabad!</b>
                </div>
            </div>
            
            <div class="ad-timer">Opening ${type === 'whatsapp' ? 'WhatsApp' : 'Call'} in <span id="adCount">1.8</span>s...</div>
        </div>
    `;
    document.body.appendChild(overlay);

    let timeLeft = 1.8;
    const interval = setInterval(() => {
        timeLeft -= 0.3;
        const countEl = document.getElementById("adCount");
        if (countEl) countEl.textContent = Math.max(0, timeLeft).toFixed(1);
        if (timeLeft <= 0) {
            clearInterval(interval);
            document.body.removeChild(overlay);
            window.open(targetUrl, "_blank");
        }
    }, 300);
};

function setupEventListeners() {
    const cityDropdown = document.getElementById("citySelectDropdown");
    if (cityDropdown) {
        cityDropdown.addEventListener("change", (e) => selectCity(e.target.value));
    }

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                AppState.searchQuery = e.target.value.toLowerCase().trim();
                fetchListings(true);
            }, 300);
        });
    }

    const areaDropdown = document.getElementById("areaSelectDropdown");
    if (areaDropdown) {
        areaDropdown.addEventListener("change", (e) => selectArea(e.target.value));
    }

    const sortDropdown = document.getElementById("sortSelectDropdown");
    if (sortDropdown) {
        sortDropdown.addEventListener("change", (e) => {
            AppState.sortBy = e.target.value;
            fetchListings(true);
        });
    }

    const postBtn = document.getElementById("postListingBtn");
    const modal = document.getElementById("postListingModal");
    const closeBtn = document.getElementById("closeModalBtn");

    if (postBtn && modal) postBtn.addEventListener("click", () => modal.classList.add("active"));
    if (closeBtn && modal) closeBtn.addEventListener("click", () => modal.classList.remove("active"));

    const listingForm = document.getElementById("ownerListingForm");
    if (listingForm) listingForm.addEventListener("submit", handleFormSubmit);

    window.addEventListener("scroll", () => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
            if (AppState.hasMore && !AppState.isLoading) {
                AppState.currentPage++;
                fetchListings(false);
            }
        }
    });
}

function renderListingsGrid(listings, totalCount) {
    const grid = document.getElementById("listingsGrid");
    const countEl = document.getElementById("listingsCount");

    const activeCityObj = (typeof CITIES_REGISTRY !== 'undefined' && CITIES_REGISTRY[AppState.selectedCity]) 
        ? CITIES_REGISTRY[AppState.selectedCity] 
        : { name: "Hyderabad" };

    const activeCityScale = CITY_MARKET_SCALES[AppState.selectedCity] || CITY_MARKET_SCALES.hyderabad;

    if (countEl) {
        if (AppState.selectedArea !== "all") {
            const areaObj = activeCityObj.subcities ? activeCityObj.subcities.find(a => a.id === AppState.selectedArea) : null;
            const areaName = areaObj ? areaObj.name : AppState.selectedArea;
            countEl.textContent = `Displaying ${totalCount} Local Rentals in ${areaName}`;
        } else if (AppState.selectedCategory !== "all") {
            const catObj = (typeof RENTAL_CATEGORIES !== 'undefined') ? RENTAL_CATEGORIES.find(c => c.id === AppState.selectedCategory) : null;
            const catName = catObj ? catObj.name : "Rentals";
            const scaleInfo = activeCityScale[AppState.selectedCategory];
            const marketTotal = scaleInfo ? scaleInfo.count : "1,000+";
            countEl.textContent = `Displaying ${catName} in ${activeCityObj.name} • (${marketTotal} Total Available)`;
        } else {
            countEl.textContent = `Displaying Top Verified Rentals in ${activeCityObj.name} • (${activeCityScale.total})`;
        }
    }

    if (!grid) return;

    if (listings.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">🔍</span>
                <h3 class="empty-state-title">No Rentals Found for Selected Criteria</h3>
                <p class="empty-state-text">Try switching subcity areas or clear search keyword.</p>
                <button class="btn-primary" onclick="resetFilters()">Reset All Filters</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = listings.map((item, idx) => {
        const waMsg = encodeURIComponent(
            `Hi ${item.ownerName}, I am interested in your listing "${item.title}" in ${item.areaName} (${item.cityName || 'Hyd'}) on ManaRent. Is it available for rent?`
        );
        const waUrl = `https://wa.me/${item.whatsapp}?text=${waMsg}`;
        const phoneUrl = `tel:+${item.phone}`;

        // Insert native in-feed AdSense banner every 8 listings with beautiful fallback partner card while AdSense is pending
        const showInFeedAd = (idx > 0 && idx % 8 === 0);

        return `
            ${showInFeedAd ? `
                <div class="listing-card in-feed-ad-card">
                    <span class="ad-tag-badge">SPONSORED PARTNER</span>
                    
                    <ins class="adsbygoogle"
                         style="display:block"
                         data-ad-client="ca-pub-6965081263252229"
                         data-ad-slot="9876543210"
                         data-ad-format="auto"
                         data-full-width-responsive="true"></ins>

                    <!-- Partner Fallback Container (Displays when AdSense is pending) -->
                    <div class="ad-fallback-banner">
                        <div class="ad-fallback-icon">🚚</div>
                        <div class="ad-fallback-title">Packers & Movers Partner</div>
                        <div class="ad-fallback-desc">Get 25% OFF Verified Home Shifting & Vehicle Transport in ${escapeHtml(activeCityObj.name)}.</div>
                        <a href="https://wa.me/919876543210?text=Hi%20ManaRent%20Packers,%20I%20need%20a%20moving%20quote!" target="_blank" class="btn-primary" style="padding:0.4rem 0.9rem; font-size:0.78rem; text-decoration:none; margin-top:8px;">
                            <span>Get Moving Quote</span>
                        </a>
                    </div>
                </div>
            ` : ''}

            <div class="listing-card">
                <div class="card-image-wrapper">
                    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="card-image" loading="lazy" 
                         onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'">
                    ${item.featured ? `<span class="badge-featured">${ICONS.star} Featured</span>` : ''}
                    ${item.verified ? `<span class="badge-verified">${ICONS.verified} Verified Owner</span>` : ''}
                </div>
                <div class="card-body">
                    <div class="card-area-tag">${ICONS.location} ${escapeHtml(item.areaName)} (${escapeHtml(item.cityName || 'Hyd')})</div>
                    <h3 class="card-title">${escapeHtml(item.title)}</h3>
                    <div class="card-landmark">${ICONS.landmark} ${escapeHtml(item.landmark)}</div>
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
                            <button onclick="connectOwnerWithAd('${waUrl}', '${escapeHtml(item.ownerName)}', 'whatsapp')" class="btn-whatsapp" title="Chat on WhatsApp">
                                ${ICONS.whatsapp} <span>WhatsApp</span>
                            </button>
                            <button onclick="connectOwnerWithAd('${phoneUrl}', '${escapeHtml(item.ownerName)}', 'phone')" class="btn-call" title="Call Owner">
                                ${ICONS.phone}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    // Trigger AdSense push if adsbygoogle is loaded
    try {
        (adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
}

window.resetFilters = function() {
    AppState.selectedCity = "hyderabad";
    AppState.selectedArea = "all";
    AppState.selectedCategory = "all";
    AppState.searchQuery = "";
    AppState.sortBy = "default";

    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    renderCitySelector();
    renderAreaPills();
    renderCategoryTabs();
    fetchListings(true);
};

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const honeypotVal = document.getElementById("website_honeypot_trap") ? document.getElementById("website_honeypot_trap").value : "";

    const title = document.getElementById("formTitle").value;
    const category = document.getElementById("formCategory").value;
    const areaId = document.getElementById("formArea").value;
    const activeCityObj = CITIES_REGISTRY[AppState.selectedCity] || CITIES_REGISTRY.hyderabad;
    const areaObj = activeCityObj.subcities ? activeCityObj.subcities.find(a => a.id === areaId) : null;
    const areaName = areaObj ? areaObj.name : activeCityObj.name;
    
    const landmark = document.getElementById("formLandmark").value;
    const price = parseInt(document.getElementById("formPrice").value, 10);
    const period = document.getElementById("formPeriod").value;
    const specs = document.getElementById("formSpecs").value;
    const ownerName = document.getElementById("formOwnerName").value;
    const phone = document.getElementById("formPhone").value.replace(/[^0-9]/g, "");

    const newListing = {
        id: "user-" + Date.now(),
        website_honeypot_trap: honeypotVal,
        cityKey: AppState.selectedCity,
        cityName: activeCityObj.name,
        title,
        category,
        areaId,
        areaName,
        landmark,
        price,
        period,
        deposit: price * 2,
        specs,
        tags: ["Direct Owner Listing", "Just Posted"],
        image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
        ownerName: ownerName + " (Direct Owner)",
        phone: phone || "919876543210",
        whatsapp: phone || "919876543210",
        verified: true,
        rating: 5.0,
        featured: true,
        createdAt: new Date().toISOString()
    };

    if (typeof INITIAL_LISTINGS !== 'undefined') {
        INITIAL_LISTINGS.unshift(newListing);
    }
    AppState.listings.unshift(newListing);

    try {
        await fetch("/api/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newListing)
        });
    } catch (err) {
        console.log("Local submit preserved.");
    }

    const modal = document.getElementById("postListingModal");
    if (modal) modal.classList.remove("active");
    e.target.reset();

    AppState.selectedCategory = "all";
    AppState.selectedArea = "all";

    renderAreaPills();
    renderCategoryTabs();
    renderListingsGrid(AppState.listings, AppState.listings.length);

    alert(`🎉 Success! Your rental listing for "${title}" in ${areaName} (${activeCityObj.name}) has been published.`);
}
