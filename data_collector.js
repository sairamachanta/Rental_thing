/**
 * ManaRent Natural Category Distribution Data Engine
 * 
 * Generates natural, real-world varied distribution across categories and subcities.
 */

const fs = require('fs');
const path = require('path');

const CITIES_REGISTRY = {
    hyderabad: {
        name: "Hyderabad",
        icon: "🏛️",
        subcities: [
            { id: "kukatpally", name: "Kukatpally / KPHB", landmarks: ["KPHB Phase 3 Metro", "Forum Sujana Mall", "JNTU College Gate", "Kukatpally Y Junction", "Phase 1 Housing Board", "KPHB Phase 5 Park", "Phase 9 Colony", "JNTU Back Gate"] },
            { id: "kondapur", name: "Kondapur", landmarks: ["Botanical Garden Main Gate", "Harsha Lines Colony", "Chirec International School", "Near RTA Office", "Kondapur Masjid Junction", "Raghavendra Colony"] },
            { id: "hitech", name: "Hitech City", landmarks: ["Cyber Towers Circle", "Mindspace IT Park Gate 2", "Shilparamam Craft Village", "Image Gardens Road", "Inorbit Mall Road", "Hard Rock Cafe"] },
            { id: "gachibowli", name: "Gachibowli", landmarks: ["DLF Cyber City Food Street", "IIIT Junction", "Gachibowli Stadium", "Financial District Wipro Circle", "Nanakramguda ORR Exit"] },
            { id: "madhapur", name: "Madhapur", landmarks: ["Durgam Cheruvu Cable Bridge", "Kavuri Hills Phase 1", "Jubilee Enclave", "100 Feet Road", "Madhapur Metro Gate 1"] },
            { id: "miyapur", name: "Miyapur", landmarks: ["Allwyn X Roads", "Miyapur Bus Depot", "Hafeezpet Railway Station", "JP Nagar Colony", "Miyapur Metro Terminal"] },
            { id: "ameerpet", name: "Ameerpet / SR Nagar", landmarks: ["Maitrivanam Coaching Center", "SR Nagar Metro Station", "BK Guda Park", "Elephant Circle"] },
            { id: "banjara", name: "Banjara & Jubilee Hills", landmarks: ["Road No 12 GVK One Mall", "Road No 36 Jubilee Hills Metro", "Film Nagar Temple Road", "KBR Park Gate"] },
            { id: "secunderabad", name: "Secunderabad & East", landmarks: ["Paradise Circle", "PG Road Secunderabad", "Tarnaka Metro", "ECIL X Roads"] },
            { id: "oldcity", name: "Old City & Charminar", landmarks: ["Charminar Bus Stand", "Falaknuma Palace Road", "Chandrayangutta Circle"] }
        ]
    },
    bengaluru: {
        name: "Bengaluru",
        icon: "🌳",
        subcities: [
            { id: "koramangala", name: "Koramangala", landmarks: ["Koramangala 5th Block", "Sony World Signal", "Forum Mall Hosur Road", "Jyoti Nivas College"] },
            { id: "indiranagar", name: "Indiranagar", landmarks: ["100 Feet Road", "12th Main Indiranagar", "CMH Road Metro"] },
            { id: "whitefield", name: "Whitefield", landmarks: ["ITPL Main Gate", "Phoenix Marketcity", "EPIP Zone"] },
            { id: "hsr", name: "HSR Layout", landmarks: ["HSR 27th Main", "HSR BDA Complex", "Sector 1 Park"] },
            { id: "marathahalli", name: "Marathahalli & Electronic City", landmarks: ["Marathahalli Multiplex", "Electronic City Phase 1 Wipro Gate"] }
        ]
    },
    mumbai: {
        name: "Mumbai",
        icon: "🌊",
        subcities: [
            { id: "andheri", name: "Andheri West & East", landmarks: ["Lokhandwala Complex", "Andheri Metro Station", "SEEPZ IT Zone"] },
            { id: "bandra", name: "Bandra & BKC", landmarks: ["Bandra Kurla Complex (BKC)", "Carter Road Promenade", "Linking Road"] },
            { id: "powai", name: "Powai", landmarks: ["IIT Bombay Main Gate", "Hiranandani Gardens", "Powai Lake Road"] },
            { id: "thane", name: "Thane & Navi Mumbai", landmarks: ["Thane Viviana Mall", "Vashi Sector 17 Navi Mumbai"] }
        ]
    }
};

// Realistic category weights (Flats high, PGs high, Bikes high, Cars med, Auto med, Furniture med, Laptop med, Fashion niche)
const CATEGORY_DISTRIBUTION = [
    { cat: "house", multiplier: 12, templates: [
        { title: "Furnished 2BHK Flat with Balcony", price: [22000, 34000], period: "month", specs: "2 Beds • 2 Baths • 1150 sqft • Elevator & Parking" },
        { title: "Luxury 3BHK Apartment in Gated Community", price: [38000, 58000], period: "month", specs: "3 Beds • 3 Baths • 1750 sqft • Swimming Pool & Gym" },
        { title: "Compact 1BHK Flat for IT Professionals", price: [14000, 20000], period: "month", specs: "1 Bed • 1 Bath • 680 sqft • 24/7 Power Backup" },
        { title: "Spacious Independent House 1st Floor", price: [25000, 36000], period: "month", specs: "2 Beds • 2 Baths • 1300 sqft • Manjeera Water" }
    ]},
    { cat: "pg", multiplier: 8, templates: [
        { title: "Sri Sai Luxury Gents PG & Hostel", price: [8500, 11500], period: "month", specs: "2-Share & 3-Share Beds • 3 Times Food • High Speed WiFi" },
        { title: "Executive Women's PG & Co-Living", price: [9500, 13500], period: "month", specs: "Single & Double Rooms • Biometric Entry • Housekeeping" }
    ]},
    { cat: "bike", multiplier: 7, templates: [
        { title: "Honda Activa 6G Scooter (2023 Model)", price: [350, 450], period: "day", specs: "110cc • Automatic • 50+ kmpl • Free Helmet Included" },
        { title: "Royal Enfield Classic 350 (Dark Stealth)", price: [850, 1200], period: "day", specs: "350cc • Dual ABS • Tour Ready • 2 Helmets Provided" },
        { title: "TVS Jupiter 125 Scooter for Monthly Commute", price: [4200, 5400], period: "month", specs: "125cc • Mobile Charging Slot • Boot Storage" }
    ]},
    { cat: "car", multiplier: 5, templates: [
        { title: "Maruti Swift ZXi (Petrol Manual) Self-Drive", price: [1400, 1800], period: "day", specs: "5 Seater • Bluetooth & Rear Camera • Unlimited KMs Option" },
        { title: "Mahindra Thar 4x4 Automatic (Hard Top)", price: [3500, 4800], period: "day", specs: "Automatic 4x4 • Diesel • Convertable Vibe • Outstation Allowed" }
    ]},
    { cat: "auto", multiplier: 3, templates: [
        { title: "Passenger Auto Rickshaw (LPG/CNG) Hire", price: [400, 550], period: "day", specs: "Bajaj RE 4-Stroke • Metered Verified • Daily/Monthly Rental" },
        { title: "Tata Ace Mini Truck for House Shifting & Luggage", price: [1100, 1700], period: "day", specs: "1 Ton Loading Capacity • Driver Optional • Inter-City Permit" }
    ]},
    { cat: "furniture", multiplier: 4, templates: [
        { title: "Full Bedroom Set (King Bed + Mattress + Wardrobe)", price: [2500, 3800], period: "month", specs: "Solid Wood King Bed • 6-Inch Orthopedic Mattress • 3-Door Wardrobe" },
        { title: "Double Door Refrigerator (240L Frost Free)", price: [900, 1400], period: "month", specs: "240 Liter Capacity • 3 Star Energy Rating • Free Maintenance" }
    ]},
    { cat: "laptop", multiplier: 3, templates: [
        { title: "Apple MacBook Pro M2 (16GB RAM, 512GB SSD)", price: [2500, 3800], period: "month", specs: "M2 Chip • Retina XDR Display • Free Charger & Bag" },
        { title: "Dell XPS 15 Intel i7 High-Performance Laptop", price: [2200, 3200], period: "month", specs: "Intel Core i7 12th Gen • 32GB RAM • 1TB SSD • RTX 3050" }
    ]},
    { cat: "fashion", multiplier: 2, templates: [
        { title: "Designer Royal Silk Sherwani with Dupatta & Safa", price: [1500, 2800], period: "day", specs: "Heavy Embroidered Silk • Size 40-42 • Matching Turban & Stole" },
        { title: "Bridal Velvet Heavy Work Lehenga Choli", price: [2500, 4500], period: "day", specs: "Deep Red Zardozi Work • Double Dupatta • Dry Cleaned & Fitted" }
    ]}
];

const OWNER_NAMES = [
    "Venkat Rao (Owner)", "Suresh Reddy (Direct Owner)", "Laxmi Devi", "Krishna Mohan", 
    "Anitha Reddy", "Srikanth Auto Hub", "Hyderabad Riderz", "ManaBike Rentals", 
    "Ramesh Babu", "Venkatesh Naidu", "Balaji Travels", "Srinivas Rao", "Mahesh Kumar"
];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateVariedDataset() {
    console.log("==================================================");
    console.log("🚀 ManaRent Natural Category Distribution Data Engine");
    console.log("==================================================");

    const allListings = [];
    let idCounter = 20000;

    Object.keys(CITIES_REGISTRY).forEach(cityKey => {
        const city = CITIES_REGISTRY[cityKey];
        console.log(`\n🏙️ Processing City: ${city.name}...`);

        city.subcities.forEach(subcity => {
            let countForSubcity = 0;

            CATEGORY_DISTRIBUTION.forEach(dist => {
                const numItemsToGenerate = getRandomInt(Math.max(1, dist.multiplier - 2), dist.multiplier + 2);
                
                for (let k = 0; k < numItemsToGenerate; k++) {
                    const landmark = getRandomItem(subcity.landmarks);
                    const tpl = getRandomItem(dist.templates);
                    const rawPrice = getRandomInt(tpl.price[0], tpl.price[1]);
                    const step = tpl.period === "day" ? 50 : 500;
                    const price = Math.round(rawPrice / step) * step;

                    allListings.push({
                        id: `mana-${cityKey}-${subcity.id}-${dist.cat}-${idCounter++}`,
                        cityKey: cityKey,
                        cityName: city.name,
                        title: `${tpl.title}`,
                        category: dist.cat,
                        areaId: subcity.id,
                        areaName: subcity.name,
                        landmark: `${landmark}`,
                        price: price,
                        period: tpl.period,
                        deposit: tpl.period === "day" ? 1000 : Math.round((price * 2) / 1000) * 1000,
                        specs: tpl.specs,
                        tags: ["Verified Listing", "Direct Owner"],
                        image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
                        ownerName: getRandomItem(OWNER_NAMES),
                        phone: `9198${getRandomInt(10000000, 99999999)}`,
                        whatsapp: `9198${getRandomInt(10000000, 99999999)}`,
                        verified: true,
                        rating: (4.5 + Math.random() * 0.5).toFixed(1),
                        featured: Math.random() > 0.75
                    });
                    countForSubcity++;
                }
            });

            console.log(`   └─ Generated ${countForSubcity} diverse items for ${subcity.name}`);
        });
    });

    console.log(`\n🎉 Total Varied Listings Generated: ${allListings.length}`);

    const hydSubcitiesList = CITIES_REGISTRY.hyderabad.subcities.map(s => ({
        id: s.id,
        name: s.name,
        icon: s.id === 'kukatpally' ? '🏙️' : (s.id === 'hitech' ? '🏢' : (s.id === 'gachibowli' ? '🚀' : '📍'))
    }));

    const jsContent = `/**
 * ManaRent Natural Category Distribution Seed Dataset
 * Total Active Listings: ${allListings.length}
 */

const CITIES_REGISTRY = ${JSON.stringify(CITIES_REGISTRY, null, 4)};

const HYD_AREAS = [
    { id: "all", name: "All Areas", icon: "📍" },
    ${hydSubcitiesList.map(s => JSON.stringify(s)).join(',\n    ')}
];

const RENTAL_CATEGORIES = [
    { id: "all", name: "All Categories", icon: "⚡" },
    { id: "house", name: "Flats & Houses", icon: "🏡" },
    { id: "pg", name: "PGs & Hostels", icon: "🛏️" },
    { id: "bike", name: "Bikes & Scooters", icon: "🏍️" },
    { id: "car", name: "Self-Drive Cars", icon: "🚗" },
    { id: "auto", name: "Autos & Commercial", icon: "🛺" },
    { id: "furniture", name: "Furniture & Appliances", icon: "🛋️" },
    { id: "laptop", name: "Laptops & IT Gear", icon: "💻" },
    { id: "fashion", name: "Event & Bridal Fashion", icon: "👔" }
];

const INITIAL_LISTINGS = ${JSON.stringify(allListings, null, 4)};
`;

    const outputPath = path.join(__dirname, 'data', 'hyd_seed_data.js');
    fs.writeFileSync(outputPath, jsContent, 'utf-8');

    const dbPath = path.join(__dirname, 'data', 'listings_db.json');
    fs.writeFileSync(dbPath, JSON.stringify(allListings, null, 2), 'utf-8');
    console.log(`💾 Saved updated natural dataset (${allListings.length} records) to DB!`);
}

generateVariedDataset();
