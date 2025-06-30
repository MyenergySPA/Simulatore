console.log("S2.js loaded and running - " + new Date().toLocaleTimeString());

window.onload = function() {
    console.log("Clearing localStorage...");
    localStorage.clear();
};

// Global variables
let map;
let drawingManager;
let polygon = null;
let selectedPlace = null;
let autocomplete;
let communityParticipation = 1;

// Global variables for Step 3
let consumoSlider = 20; // Default value
let prevalenzaValue = 50; // Default to equilibrato
let detrazione = 36; // Default to prima casa
let inclinazione = 15; // Default value
let azimuth = 90; // Default value
let pompa = 0; // Changed from "No" to 0
let infissi = 0; // Changed from "No" to 0
let climatizzazione = 0; // Changed from "No" to 0
const price_kwh = 0.35;  // Price per kWh
const RID = 0.09;        // Feed-in tariff

// Global variables for calculation results
let risp_cumula = [];
let consumi_annui = 0;
let autoconsumo_diretto_kwh_anno_1 = 0;
let autoconsumo_batteria_kwh_anno_1 = 0;
let autoconsumo_totale_kwh_anno_1 = 0;
let autoconsumo_percentuale = 0;
let immissione_kwh_anno_1 = 0;
let prelievo_rete_dopo_impianto_anno_1 = 0;
let costo_mensile_bolletta_dopo_impianto = 0;
let risparmio_1_anno_bolletta = 0;
let risparmio_immisione_anno_1 = 0;
let risparmio_10_anni_detrazione = 0;
let risparmio_25_anni_totale = 0;
let alberiEquivalenti = 0;
let Co2 = 0;
let utile25Anni = 0;
let percentualeRisparmioEnergetico = 0;

// Global variables for Step 4
let ottimizzatori = 0;
let backup = 0;
let wallbox = 0;
let lineaVita = 0;
let piccioni = 0;

// Global variable to track selected power
let potenza = 0;

// Add global variable for total cost
let costResult = "0.00";

// JSON Data for power and panel configurations 
const potten = ["3.32", "4.15", "4.98", "6.23", "8.30"];

const pan = {
    "3.32": 8,
    "4.15": 10,
    "4.98": 12,
    "6.23": 15,
    "8.30": 20
};

const batt = {
    "3.32": { "0": "7150,00", "5": "12000,00", "10": "15000,00" },
    "4.15": { "0": "7800,00", "5": "12500,00", "10": "15400,00" },
    "4.98": { "0": "8550,00", "5": "13300,00", "10": "16150,00" },
    "6.23": { "0": "9650,00", "5": "14300,00", "10": "17150,00", "15": "19900,00" },
    "8.30": { "0": "11400,00", "5": "16000,00", "10": "18900,00", "15": "21800,00", "20": "25550,00" }
};

const default_batt = {
    "30": { "3.32": "7150,00", "4.15": "16000,00", "4.98": "8550,00", "6.23": "9650,00", "8.30": "11400,00" },
    "50": { "3.32": "7150,00", "4.15": "16000,00", "4.98": "8550,00", "6.23": "14300,00", "8.30": "16000,00" },
    "70": { "3.32": "15000,00", "4.15": "15400,00", "4.98": "16150,00", "6.23": "19900", "8.30": "21800,00" }
};

// Add these global variables to the top of your file
let baseMonthlyData = [];
let monthlyData = [];
let produzioneAnnuaTotale = 0;
let prod_table = [];

// Add this global variable to store lifetime production
let produzioneLifetime = 0;

// Function to calculate production table values over 26 years
function calculateProdTable() {
    if (!produzioneAnnuaTotale) {
        console.warn('⚠️ Production total not initialized');
        produzioneLifetime = 0;
        return Array(26).fill(0);
    }

    const anni = [...Array(26).keys()];
    const perfor_panelli = [
        100.00, 99.45, 98.90, 98.35, 97.80, 97.25, 96.70, 96.15, 95.60, 95.05,
        94.50, 93.95, 93.40, 92.85, 92.30, 91.75, 91.20, 90.65, 90.10, 89.55,
        89.00, 88.45, 87.90, 87.35, 86.80, 86.25
    ];

    const prodTable = anni.map(year => 
        produzioneAnnuaTotale * (perfor_panelli[year] / 100)
    );
    
    // Calculate the sum of all values in the production table
    produzioneLifetime = prodTable.reduce((sum, yearlyProduction) => sum + yearlyProduction, 0);
    console.log(`Total lifetime production calculated: ${produzioneLifetime.toFixed(2)} kWh over 26 years`);
    
    return prodTable;
}

// Function to update Produzione Annui Totali
function updateProduzioneAnnuiTotali(selectedPotenza) {
    if (!Array.isArray(baseMonthlyData) || baseMonthlyData.length !== 12) {
        console.warn("⚠️ Base monthly data not yet available");
        
        // Use default monthly values when baseMonthlyData is not available
        const defaultMonthlyData = [134.12, 222.76, 433.27, 590.72, 695.25, 784.3, 
                                   810.54, 670.08, 489.92, 268.25, 128.56, 107.04];
        
        // Calculate with default data
        monthlyData = defaultMonthlyData.map(value => value * selectedPotenza / 6.23); // Normalized to 6.23 kWp
        produzioneAnnuaTotale = monthlyData.reduce((sum, value) => sum + value, 0);
        
        console.log(`Produzione Annui Totali calculated with default data: ${produzioneAnnuaTotale.toFixed(2)} kWh`);
    } else {
        // Calculate with actual data from API
        monthlyData = baseMonthlyData.map(value => value * selectedPotenza);
        produzioneAnnuaTotale = monthlyData.reduce((sum, value) => sum + value, 0);
        
        console.log(`Produzione Annui Totali calculated: ${produzioneAnnuaTotale.toFixed(2)} kWh`);
    }

    // Now produzioneAnnuaTotale is always initialized before this call
    prod_table = calculateProdTable();
    
    console.log("Production over 26 years:", prod_table);
}


// Function to check if a point is inside a polygon
function isPointInPolygon(point, polygon) {
    let inside = false;
    const x = point[0], y = point[1];
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        const intersect = ((yi > y) !== (yj > y)) && 
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
        if (intersect) inside = !inside;
    }
    
    return inside;
}

// Function to check if the codArea matches any cabinaprimaria in the JSON data
async function checkIfCodAreaInCabinaPrimaria(codArea) {
    try {
        console.log("%c🔍 Checking if code area exists in cabina primaria list", "color: blue; font-weight: bold");
        console.log("Current COD_AC value:", codArea);
        
        // Fetch the JSON data
        const response = await fetch('https://bittumon.github.io/iveco/mappa_impianti.json');
        const data = await response.json();
        
        // Extract all cabinaprimaria values for debugging
        const allCabinaPrimaria = data.map(item => item.cabinaprimaria).filter(Boolean);
        console.log("All available cabinaprimaria values:", allCabinaPrimaria);
        
        // Check if the codArea matches any cabinaprimaria value
        const match = data.some(item => item.cabinaprimaria === codArea);
        
        // Log the result with styling based on match result
        if (match) {
            console.log(
                `%c✅ MATCH FOUND: "${codArea}" exists in the cabinaprimaria list!`, 
                "color: green; font-weight: bold"
            );
        } else {
            console.log(
                `%c❌ NO MATCH: "${codArea}" does not exist in the cabinaprimaria list`, 
                "color: red; font-weight: bold"
            );
        }
        
        // Show or hide the Comunita section based on the result
        toggleComunitaSection(match);
        
        return match;
    } catch (error) {
        console.error("Error checking cabina primaria list:", error);
        // Hide the section on error
        toggleComunitaSection(false);
        return false;
    }
}

// Helper function to toggle the Comunita section
function toggleComunitaSection(show) {
    // Find all sections that might contain the Comunita label
    const sections = document.querySelectorAll('.section');
    let comunitaSection = null;
    
    // Loop through sections to find the one with "Comunita" label
    for (const section of sections) {
        const labels = section.querySelectorAll('label');
        for (const label of labels) {
            if (label.textContent.trim() === 'Comunita') {
                comunitaSection = section;
                break;
            }
        }
        if (comunitaSection) break;
    }
    
    if (comunitaSection) {
        comunitaSection.style.display = show ? 'block' : 'none';
        console.log(`Comunita section ${show ? "shown" : "hidden"}`);
    } else {
        console.warn('Comunita section not found in the DOM');
    }
}


// Update the loadGeoJSONAndFindCODAC function to call checkIfCodAreaInCabinaPrimaria
async function loadGeoJSONAndFindCODAC() {
    const lat = parseFloat(localStorage.getItem("latitude"));
    const lng = parseFloat(localStorage.getItem("longitude"));
    
    if (isNaN(lat) || isNaN(lng)) {
        document.getElementById('cod-ac-value').textContent = "Posizione non disponibile";
        // Hide the Comunita section if no position is available
        toggleComunitaSection(false);
        return;
    }
    
    document.getElementById('cod-ac-value').textContent = "Ricerca in corso...";
    
    // Loop through all the split files (1-25)
    for (let i = 1; i <= 25; i++) {
        try {
            const response = await fetch(`https://bittumon.github.io/iveco/Dataset_mappa/split_${i}.geojson`);
            const geojson = await response.json();
            
            // Check each feature in the GeoJSON
            for (const feature of geojson.features) {
                if (feature.geometry && feature.geometry.type === 'Polygon') {
                    // For each polygon in the feature
                    const coordinates = feature.geometry.coordinates[0]; // First array of coordinates
                    
                    // Check if the user's location is inside this polygon
                    if (isPointInPolygon([lng, lat], coordinates)) {
                        // Found a match! Get the COD_AC value
                        const codAC = feature.properties.COD_AC;
                        document.getElementById('cod-ac-value').textContent = codAC || "Non disponibile";
                        
                        // Check if this codAC is in the cabina primaria list
                        await checkIfCodAreaInCabinaPrimaria(codAC);
                        return; // Exit the function since we found a match
                    }
                }
            }
        } catch (error) {
            console.error(`Error loading GeoJSON file ${i}:`, error);
        }
    }
    
    // If no match was found after checking all files
    document.getElementById('cod-ac-value').textContent = "Area non trovata";
    // Hide the Comunita section if no area is found
    toggleComunitaSection(false);
}

// Add this to your existing event listeners for step navigation
document.addEventListener('DOMContentLoaded', function() {
    // Existing code...
    
    // Add event listener for Step 4 navigation
    const step3NextBtn = document.getElementById('step3Next');
    if (step3NextBtn) {
        step3NextBtn.addEventListener('click', function() {
            // Hide step 3, show step 4
            document.getElementById('section-step3').style.display = 'none';
            document.getElementById('section-step4').style.display = 'block';
            
            // Load GeoJSON and find COD_AC when step 4 is shown
            loadGeoJSONAndFindCODAC();
        });
    }
    
    // Also load GeoJSON if user refreshes page while on step 4
    if (document.getElementById('section-step4').style.display !== 'none') {
        loadGeoJSONAndFindCODAC();
    }
});


// Add this function to check which file to load based on rough coordinates
async function findAndDisplayCODAC() {
    const lat = parseFloat(localStorage.getItem("latitude"));
    const lng = parseFloat(localStorage.getItem("longitude"));
    
    if (isNaN(lat) || isNaN(lng)) {
        document.getElementById('cod-ac-value').textContent = "Posizione non disponibile";
        return;
    }
    
    document.getElementById('cod-ac-value').textContent = "Ricerca in corso...";
    
    try {
        // First, load a small index file that contains bounding boxes for each split file
        // This is an optimization you could implement later
        // For now, we'll try each file until we find a match
        
        let foundMatch = false;
        
        // Start with files that are more likely to contain the user's location
        // This is a simple optimization based on Italian geography
        // You can adjust this based on your specific data
        const fileOrder = Array.from({length: 25}, (_, i) => i + 1);
        
        for (const fileNum of fileOrder) {
            try {
                console.log(`Checking file split_${fileNum}.geojson`);
                const response = await fetch(`https://bittumon.github.io/iveco/Dataset_mappa/split_${fileNum}.geojson`);
                const geojson = await response.json();
                
                for (const feature of geojson.features) {
                    if (feature.geometry && feature.geometry.type === 'Polygon') {
                        const coordinates = feature.geometry.coordinates[0];
                        
                        if (isPointInPolygon([lng, lat], coordinates)) {
                            const codAC = feature.properties.COD_AC;
                            document.getElementById('cod-ac-value').textContent = codAC || "Non disponibile";
                            console.log(`Found match in file ${fileNum}: ${codAC}`);
                            foundMatch = true;
                            break;
                        }
                    }
                }
                
                if (foundMatch) break;
                
            } catch (error) {
                console.error(`Error checking file ${fileNum}:`, error);
            }
        }
        
        if (!foundMatch) {
            document.getElementById('cod-ac-value').textContent = "Area non trovata";
        }
    } catch (error) {
        console.error("Error in findAndDisplayCODAC:", error);
        document.getElementById('cod-ac-value').textContent = "Errore nella ricerca";
    }
}

// Call this function when step 4 is shown
// Update your existing step navigation handlers to include this call

// Fetch PVWatts API data
async function fetchPVWattsData(latitude, longitude, azimuth, inclinazione) {
    console.log("Fetching PVWatts data with parameters:", {
        latitude, longitude, azimuth, inclinazione
    });
    
    const apiUrl = `https://developer.nrel.gov/api/pvwatts/v8.json?api_key=q8FeOId3P75qkcCNJLYVWccY2jHBF23XooQpl9Mx&azimuth=${azimuth}&tilt=${inclinazione}&system_capacity=1&dataset=nsrdb&albedo=0.3&bifaciality=0.7&format=json&module_type=0&losses=14&array_type=1&use_wf_albedo=1&lat=${latitude}&lon=${longitude}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data && data.outputs && data.outputs.ac_monthly) {
            baseMonthlyData = data.outputs.ac_monthly; // Store values for 1 kW
            console.log("📊 API Data for 1 kW:", baseMonthlyData);
            return true;
        } else {
            console.error("❌ Invalid API response format:", data);
            return false;
        }
    } catch (error) {
        console.error("⚠️ Error fetching PVWatts data:", error);
        return false;
    }
}

// Calculate Potenza Based on Area
function calculatePotenza(area) {
    if (area >= 16 && area < 20) return "3.32";
    if (area >= 20 && area < 24) return "4.15";
    if (area >= 24 && area < 30) return "4.98";
    if (area >= 30 && area < 40) return "6.23";
    if (area >= 40) return "8.30";
    return null;
}

// Get minimum area required for a potenza value
function getMinAreaForPotenza(potenza) {
    switch(potenza) {
        case "3.32": return 16;
        case "4.15": return 20;
        case "4.98": return 24;
        case "6.23": return 30;
        case "8.30": return 40;
        default: return 0;
    }
}

// Calculate Default Battery Cost
function calculateDefaultBatteryCost(night, potenza) {
    if (night == 30) return default_batt["30"][potenza];
    if (night == 50) return default_batt["50"][potenza];
    if (night == 70) return default_batt["70"][potenza];
    return "0,00";
}

// Add global variables
let panelCount = 0;
let basecost = "0,00";
let night = 50; // Default value, will be set to prevalenza

// Function to calculate and update total cost
function updateTotalCost() {
    // Convert string costs with comma to numeric values
    const baseValue = parseFloat(basecost.replace(/\./g, "").replace(",", "."));
    
    // Sum all cost components
    const total = baseValue + ottimizzatori + wallbox + lineaVita + piccioni + backup;
    
    // Format back to Italian style number with comma as decimal and dot as thousand separator
    costResult = formatNumberIT(total);
    
    // Update the display if it exists
    const costResultDisplay = document.querySelector('.cost-result-value');
    if (costResultDisplay) {
        costResultDisplay.textContent = costResult + " €";
    }
    
    // Also update the basecost display
    const basecostDisplay = document.querySelector('.basecost-value');
    if (basecostDisplay) {
        basecostDisplay.textContent = formatNumberIT(baseValue) + " €";
    }
    
    console.log("Total cost updated:", {
        basecost: formatNumberIT(baseValue) + " €",
        ottimizzatori: formatNumberIT(ottimizzatori) + " €",
        wallbox: formatNumberIT(wallbox) + " €",
        lineaVita: formatNumberIT(lineaVita) + " €",
        piccioni: formatNumberIT(piccioni) + " €",
        backup: formatNumberIT(backup) + " €",
        totalCost: costResult + " €"
    });

    return costResult;
}

// Handle power button clicks
// Fix the handlePowerButton function to properly update battery options
function handlePowerButton(btn) {
    console.log("handlePowerButton called with:", btn);
    
    // Get the selected value from the button's data attribute
    const value = btn.dataset.value;
    
    // Reset all power buttons
    const powerBtns = document.querySelectorAll('.power-btn');
    powerBtns.forEach(b => {
        b.classList.remove("active");
        b.style.backgroundColor = 'transparent';
        b.style.color = '#B9B7B7';
        b.style.borderColor = '#B9B7B7';
    });
    
    // Activate clicked button
    btn.classList.add("active");
    btn.style.backgroundColor = '#112B3F';
    btn.style.color = '#fff';
    btn.style.borderColor = '#112B3F';
    
    // Set potenza value and log it
    potenza = parseFloat(value);
    console.log('Potenza set to:', potenza, 'kWp');
    
    // Update related UI elements
    updateModuliCount(potenza);
    
    // Run FLIP animation if the function exists
    if (typeof runFLIP === 'function') {
        runFLIP();
    }
    
    // Important: Update battery options based on selected power
    updateBatteryOptions(value);
    
    // Update other components based on power selection
    updateBaseCost();
    if (Array.isArray(baseMonthlyData) && baseMonthlyData.length === 12) {
        updateProduzioneAnnuiTotali(potenza);
        calculateCompleteResults();
    }
}


// New function to handle optimizer button
// Function to toggle optimizers button
function toggleOptimizers(btn) {
    // Toggle active class
    btn.classList.toggle('active');
    
    // Update ottimizzatori value based on button state
    ottimizzatori = btn.classList.contains('active') ? 720 : 0;
    console.log("Ottimizzatori set to:", ottimizzatori);
    
    // Update cost calculations
    updateTotalCost();
}

// Add event listener for optimizer button
document.addEventListener('DOMContentLoaded', function() {
    const optButton = document.getElementById('btnOpt');
    if (optButton) {
        optButton.addEventListener('click', function() {
            toggleOptimizers(this);
        });
    }
});

const decreaseAreaBtn = document.getElementById('decreaseArea');
const increaseAreaBtn = document.getElementById('increaseArea');
const areaValue = document.getElementById('step-box-area-value');
const step2NextBtn = document.getElementById('step2Next');

// Initialize with stored area value or default to 0
let currentArea = parseInt(localStorage.getItem('area') || '0');
if (areaValue) areaValue.textContent = currentArea;

// Check if the proceed button should be visible on load
if (step2NextBtn && currentArea >= 16) {
    step2NextBtn.style.display = 'block';
} else if (step2NextBtn) {
    step2NextBtn.style.display = 'none';
}

// Update function to keep code DRY
function updateAreaValue(newValue) {
    // Ensure we don't go below 0
    currentArea = Math.max(0, newValue);

    // Update display and localStorage
    if (areaValue) areaValue.textContent = currentArea;
    localStorage.setItem('area', currentArea.toString());

    // Show/hide proceed button based on value
    if (step2NextBtn) {
        step2NextBtn.style.display = currentArea >= 16 ? 'block' : 'none';
    }
}

// Ensure area value from inline input is saved before leaving Step 2
function finalizeAreaInput() {
    const span = document.getElementById('step-box-area-value');
    if (!span) return;
    const input = span.querySelector('input');
    if (input) {
        const newValue = parseInt(input.value) || 0;
        span.textContent = newValue;
        updateAreaValue(newValue);
    }
}

// Decrease area button
if (decreaseAreaBtn) {
    decreaseAreaBtn.addEventListener('click', function() {
        updateAreaValue(currentArea - 1);
    });
}

// Increase area button
if (increaseAreaBtn) {
    increaseAreaBtn.addEventListener('click', function() {
        updateAreaValue(currentArea + 1);
    });
}

// Add tracking variables to know if user has made selections
let userSelectedConsumo = false;
let userSelectedPrevalenza = false;
let userSelectedDetrazione = false;
let userSelectedSuperficie = false;

// Initialize Google Maps and Autocomplete
function initMap() {
    console.log("Initializing map...");

    // Check if Google Maps API is loaded
    if (typeof google === 'undefined') {
        console.warn("Google Maps API not loaded yet. Retrying in 1 second...");
        setTimeout(initMap, 1000);
        return;
    }
    
    // Get coordinates from localStorage or use default Italy center
    let lat = 41.9028;
    let lng = 12.4964;
    
    if (localStorage.getItem("latitude") && localStorage.getItem("longitude")) {
        lat = parseFloat(localStorage.getItem("latitude"));
        lng = parseFloat(localStorage.getItem("longitude"));
        console.log("Using coordinates from localStorage:", lat, lng);
    }
    
    // Create the map with satellite view
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat, lng },
        zoom: 20,
        mapTypeId: 'satellite',
        tilt: 0,
        disableDefaultUI: true,  // Disable all default UI controls
        zoomControl: true,        // But keep zoom controls
    });
    
    console.log("Map created successfully");
    
    // Initialize autocomplete for the address search
    const addressInput = document.getElementById('address');
    if (addressInput) {
        autocomplete = new google.maps.places.Autocomplete(addressInput, {
            types: ['address'],
            componentRestrictions: { country: 'it' }
        });
        
        // Bind autocomplete to map bounds for better results
        autocomplete.bindTo('bounds', map);
        
        // Listen for place selection
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();
            selectedPlace = place;
            
            if (!place.geometry) {
                console.log("No place geometry available");
                return;
            }
            
            // Store the selected place
            localStorage.setItem("address", place.formatted_address);
            localStorage.setItem("latitude", place.geometry.location.lat());
            localStorage.setItem("longitude", place.geometry.location.lng());
            
            // Show next button
            document.getElementById('step1Next').style.display = 'block';
        });
        
        console.log("Autocomplete initialized");
    }
    
    // Initialize drawing manager
    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: {
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.35,
            editable: true
        }
    });
    
    // Set the drawing manager on the map
    drawingManager.setMap(map);
    
    // Listen for polygon completion
    google.maps.event.addListener(drawingManager, 'polygoncomplete', function(poly) {
        // Store the polygon
        polygon = poly;
        
        // Disable drawing mode
        drawingManager.setDrawingMode(null);
        
        // Calculate and display area
        calculateArea(polygon);
        
        // Add listeners for polygon modifications
        google.maps.event.addListener(polygon.getPath(), 'set_at', function() {
            calculateArea(polygon);
        });
        
        google.maps.event.addListener(polygon.getPath(), 'insert_at', function() {
            calculateArea(polygon);
        });
        
        // Show the proceed and redo buttons
        document.getElementById('redoButton').style.display = 'block';
        document.getElementById('step2Next').style.display = 'block';
        document.getElementById('area').style.display = 'block';
        document.getElementById('startDesign').style.display = 'none';
    });
    
    console.log("Drawing manager initialized");
}

// Update the calculateArea function to show the right panel button
function calculateArea(polygon) {
    const area = google.maps.geometry.spherical.computeArea(polygon.getPath());
    const areaInSquareMeters = Math.round(area);
    
    // Update all area displays
    document.getElementById('areaValue').textContent = areaInSquareMeters;
    if (document.getElementById('step-box-area-value')) {
        document.getElementById('step-box-area-value').textContent = areaInSquareMeters;
    }
    
    // Store in localStorage
    localStorage.setItem("area", areaInSquareMeters);
    
    // Show area display and the button in right panel
    document.getElementById('area').style.display = 'block';
    document.getElementById('step2Next').style.display = 'block';
    
    console.log("Area calculated:", areaInSquareMeters);
}

// Updated startDrawing function - remove alert and improve overlay hiding
function startDrawing() {
    console.log("Starting drawing mode");
    
    // Get the mapOverlay element
    const overlay = document.getElementById('mapOverlay');
    
    // Hide it using multiple approaches to ensure it works
    if (overlay) {
        overlay.style.cssText = "display: none !important; visibility: hidden !important; opacity: 0 !important;";
        console.log("Overlay hidden");
    } else {
        console.error("Could not find map overlay element");
    }
    
    // Clear existing polygon if any
    if (polygon) {
        polygon.setMap(null);
        polygon = null;
    }
    
    // Enter polygon drawing mode
    drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    
    // Hide buttons until drawing complete
    const areaEl = document.getElementById('area');
    const nextBtn = document.getElementById('step2Next');
    if (areaEl) areaEl.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    
    console.log("Drawing mode activated");
}

// Replace the broken redrawPolygon function with this corrected version
function redrawPolygon() {
    console.log("Redrawing polygon");
    
    // Clear existing polygon
    if (polygon) {
        polygon.setMap(null);
        polygon = null;
    }
    
    // Enter drawing mode
    drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    
    // Hide buttons until drawing is complete
    document.getElementById('step2Next').style.display = 'none';
    document.getElementById('area').style.display = 'none';
    
    // Reset area value if the element exists
    if (document.getElementById('step-box-area-value')) {
        document.getElementById('step-box-area-value').textContent = '0';
    }
}

// Replace the broken goToStep2 function with this corrected version
function goToStep2() {
    if (!localStorage.getItem("address")) {
        showError('Seleziona un indirizzo valido prima di procedere.');
        return;
    }
    
    // Hide step 1, show step 2
    document.getElementById('section-step1').style.display = 'none';
    document.getElementById('section-step2').style.display = 'block';
    
    // Update the address display
    const addressElement = document.getElementById('selected-address');
    if (addressElement) {
        addressElement.textContent = localStorage.getItem('address') || "--";
    }
    
    
}

// First, add a function to update the global variables before saving
function updateEfficiencyOptionsFromDOM() {
    // Get the current checked state directly from the DOM elements
    const pompaCheckbox = document.getElementById('pompa-di-calore');
    const infissiCheckbox = document.getElementById('infissi');
    const climatizzazioneCheckbox = document.getElementById('climatizzazione');
    
    // Update global variables with current checkbox states
    pompa = pompaCheckbox && pompaCheckbox.checked ? 1 : 0;
    infissi = infissiCheckbox && infissiCheckbox.checked ? 1 : 0; 
    climatizzazione = climatizzazioneCheckbox && climatizzazioneCheckbox.checked ? 1 : 0;
    
    console.log("FORM SUBMISSION: Updated efficiency values from DOM:", {
        pompa, 
        infissi, 
        climatizzazione
    });

    const pompaSelected = localStorage.getItem("pompa") === "1";
    const infissiSelected = localStorage.getItem("infissi") === "1";
    const climatizzazioneSelected = localStorage.getItem("climatizzazione") === "1";

    // Get the message element
    const efficiencyMessage = document.getElementById('efficiency-message');

    // Show the message if any option was selected
    if (pompaSelected || infissiSelected || climatizzazioneSelected) {
        if (efficiencyMessage) {
            efficiencyMessage.style.display = "flex";
        }
    } else {
        if (efficiencyMessage) {
            efficiencyMessage.style.display = "none";
        }
    }

    console.log("Efficiency options status:", {
        pompa: pompaSelected ? "Selected" : "Not selected",
        infissi: infissiSelected ? "Selected" : "Not selected",
        climatizzazione: climatizzazioneSelected ? "Selected" : "Not selected",
        messageShown: (pompaSelected || infissiSelected || climatizzazioneSelected)
    });

}

// Update saveStep3Variables function to first update from DOM
function saveStep3Variables() {
    // Update values from DOM first
    updateEfficiencyOptionsFromDOM();
    
    // Then save to localStorage
    localStorage.setItem("consumoSlider", consumoSlider);
    localStorage.setItem("prevalenzaValue", prevalenzaValue);
    localStorage.setItem("detrazione", detrazione);
    localStorage.setItem("inclinazione", inclinazione);
    localStorage.setItem("azimuth", azimuth);
    localStorage.setItem("pompa", pompa);
    localStorage.setItem("infissi", infissi);
    localStorage.setItem("climatizzazione", climatizzazione);
    
    console.log("Step 3 variables saved to localStorage:", {
        consumoSlider,
        prevalenzaValue,
        detrazione,
        inclinazione,
        azimuth,
        pompa,
        infissi,
        climatizzazione
    });
}

// Update the checkStep3Required function to log all selected values
function checkStep3Required() {
    // Check if user has made all required selections
    const allFieldsSelected = 
        userSelectedConsumo && 
        userSelectedPrevalenza && 
        userSelectedDetrazione && 
        userSelectedSuperficie;
    
    // Log all current values regardless of selection status
    console.log("Current Step 3 values:", {
        consumoSlider: `${consumoSlider} €`,
        prevalenzaValue: `${prevalenzaValue} (${getPrevalenzaLabel(prevalenzaValue)})`,
        detrazione: `${detrazione}% (${detrazione === 36 ? 'Prima Casa' : 'Seconda Casa'})`,
        superficie: `${getSuperficieLabel(inclinazione, azimuth)}`,
        inclinazione: `${inclinazione}°`,
        azimuth: `${azimuth}°`,
        pompa,
        infissi,
        climatizzazione,
        selectionStatus: {
            userSelectedConsumo,
            userSelectedPrevalenza,
            userSelectedDetrazione,
            userSelectedSuperficie
        }
    });
    
    // Get the Step 3 Procedi button
    const step3NextBtn = document.getElementById('step3Next');
    
    if (step3NextBtn) {
        // Only show the button if user has made all required selections
        if (allFieldsSelected) {
            step3NextBtn.style.display = 'block';
            console.log("All required Step 3 fields selected, showing Procedi button");
        } else {
            step3NextBtn.style.display = 'none';
            console.log("Not all Step 3 fields selected, hiding Procedi button");
        }
    }
    
    return allFieldsSelected;
}

// Helper functions to get nice labels for prevalenza and superficie
function getPrevalenzaLabel(value) {
    if (value === 30) return 'Giorno';
    if (value === 50) return 'Equilibrato';
    if (value === 70) return 'Notte';
    return 'Non selezionato';
}

function getSuperficieLabel(inclinazione, azimuth) {
    if (inclinazione === 5 && azimuth === 45) return 'Tetto Piano';
    if (inclinazione === 15 && azimuth === 90) return 'Tetto a Falda';
    if (inclinazione === 5 && azimuth === 30) return 'Pensilina';
    if (inclinazione === 5 && azimuth === 90) return 'Terreno';
    return 'Non selezionato';
}

// Fix goToStep3 function to pre-select Prima Casa and set up proper event listeners
function goToStep3() {
    console.log("Entering Step 3");
    
    // Reset user selection tracking
    userSelectedConsumo = false;
    userSelectedPrevalenza = false;
    userSelectedDetrazione = false;
    userSelectedSuperficie = false;
    
    // Hide step 2, show step 3
    document.getElementById('section-step2').style.display = 'none';
    document.getElementById('section-step3').style.display = 'block';
    
    // Pre-select Prima Casa by default
    const primaCasa = document.getElementById('primo-casa');
    if (primaCasa) {
        primaCasa.checked = true;
        userSelectedDetrazione = true; // Mark as selected by default
        console.log("Prima Casa pre-selected");
    }
    
    // Set up all button event listeners for Step 3
    setupStep3EventListeners();
    
    // Check initial state
    checkStep3Required();
}

// Add this new function to properly set up all Step 3 event listeners
function setupStep3EventListeners() {
    console.log("Setting up Step 3 event listeners");
    
    // Set up slider event listeners
    const slider = document.getElementById('consumoSlider');
    if (slider) {
        slider.addEventListener('input', function(e) {
            consumoSlider = parseInt(e.target.value);
            document.getElementById('rangeValue').textContent = e.target.value + ' €';
            userSelectedConsumo = true;
            console.log("Consumo slider set to:", consumoSlider);
            checkStep3Required();
        });
    }
    
    // Set up detrazione radio buttons
    const primaCasa = document.getElementById('primo-casa');
    const secondaCasa = document.getElementById('seconda-casa');
    
    if (primaCasa) {
        primaCasa.addEventListener('change', function() {
            if (this.checked) {
                detrazione = 36;
                userSelectedDetrazione = true;
                console.log("Detrazione set to Primera Casa:", detrazione);
                checkStep3Required();
            }
        });
    }
    
    if (secondaCasa) {
        secondaCasa.addEventListener('change', function() {
            if (this.checked) {
                detrazione = 50;
                userSelectedDetrazione = true;
                console.log("Detrazione set to Segunda Casa:", detrazione);
                checkStep3Required();
            }
        });
    }
    
    // Set up prevalenza buttons with click listeners
    const prevalenzaButtons = document.querySelectorAll('#prevalenzaValue .btn-toggle');
    prevalenzaButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Handle UI changes
            prevalenzaButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Set values based on button content
            const buttonText = this.textContent.trim();
            userSelectedPrevalenza = true;
            
            if (buttonText.includes('Giorno')) {
                prevalenzaValue = 30;
            } else if (buttonText.includes('Equilibrato')) {
                prevalenzaValue = 50;
            } else if (buttonText.includes('Notte')) {
                prevalenzaValue = 70;
            }
            
            console.log("Prevalenza set to:", prevalenzaValue);
            checkStep3Required();
        });
    });
    
    // Set up superficie buttons with click listeners
    const superficieButtons = document.querySelectorAll('#group2 .btn-toggle');
    superficieButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Handle UI changes
            superficieButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Set values based on button content
            const buttonText = this.textContent.trim();
            userSelectedSuperficie = true;
            
            if (buttonText.includes('Tetto Piano')) {
                inclinazione = 5;
                azimuth = 45;
            } else if (buttonText.includes('Tetto a Falda')) {
                inclinazione = 15;
                azimuth = 90;
            } else if (buttonText.includes('Pensilina')) {
                inclinazione = 5;
                azimuth = 30;
            } else if (buttonText.includes('Terreno')) {
                inclinazione = 5;
                azimuth = 90;
            }
            
            console.log("Superficie set to:", {inclinazione, azimuth});
            checkStep3Required();
        });
    });
    
    // Add direct event listeners for efficiency option checkboxes
    const efficiencyCheckboxes = document.querySelectorAll('.additional-option, input[type="checkbox"]');
    console.log("Found efficiency checkboxes:", efficiencyCheckboxes.length);

    efficiencyCheckboxes.forEach((checkbox, index) => {
        console.log(`Checkbox ${index}:`, {
            id: checkbox.id,
            name: checkbox.name,
            type: checkbox.type,
            className: checkbox.className
        });
        
        checkbox.addEventListener('change', function() {
            console.log("Checkbox changed:", this.id, "Checked:", this.checked);
            highlightCheckbox(this);
        });
        
        checkbox.addEventListener('click', function(e) {
            console.log("Checkbox clicked:", this.id);
        });
        
        // Initialize values based on initial checkbox state
        if (checkbox.checked) {
            highlightCheckbox(checkbox);
        }
    });
}

// Add this function to fix the updateProgress reference error
function updateProgress() {
    // Get the current autoconsumo percentage value
    const percentageElement = document.getElementById('autoconsumoPercentuale');
    if (!percentageElement) return;
    
    const percentage = parseInt(percentageElement.textContent) || 0;
    console.log("Updating progress ring with percentage:", percentage);
    
    // Get ring elements if they exist
    const progressRing = document.querySelector('.progress-ring-circle');
    const progressValue = document.getElementById('progressValue');
    
    if (progressRing) {
        // Calculate the circumference of the circle
        const radius = progressRing.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        
        // Calculate the dash offset based on the percentage
        const offset = circumference - (percentage / 100 * circumference);
        
        // Update the stroke-dashoffset property
        progressRing.style.strokeDashoffset = offset;
        
        // Update the progress color based on the percentage
        if (percentage < 30) {
            progressRing.style.stroke = '#FF5252'; // Red for low percentages
        } else if (percentage < 70) {
            progressRing.style.stroke = '#FFC107'; // Yellow for medium percentages
        } else {
            progressRing.style.stroke = '#4CAF50'; // Green for high percentages
        }
    }
    
    // Update the text value if present
    if (progressValue) {
        progressValue.textContent = percentage + "%";
    }
}

// Add to the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    initMap();
    
    // Single, clean setup for all buttons
    const startDesignBtn = document.getElementById('startDesign');
    const redoBtn = document.getElementById('redoButton');
    const step1NextBtn = document.getElementById('step1Next');
    const step2NextBtn = document.getElementById('step2Next');
    const step3NextBtn = document.getElementById('step3Next');
    const step4NextButton = document.getElementById('step4Next');
    
    // Use only one event listener per button
    if (startDesignBtn) {
        startDesignBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent any other handlers
            console.log("Disegna button clicked");
            startDrawing();
        });
    }
    
    if (redoBtn) redoBtn.addEventListener('click', redrawPolygon);
    if (step1NextBtn) step1NextBtn.addEventListener('click', goToStep2);
    if (step2NextBtn) step2NextBtn.addEventListener('click', function() {
        finalizeAreaInput();
        goToStep3();
    });
    if (step3NextBtn) step3NextBtn.addEventListener('click', goToStep4);
    if (step4NextButton) {
        step4NextButton.addEventListener('click', function() {
            saveStep4Options();
            // The existing code will handle navigation to step 5
        });
    }
    
    // Display the selected address in Step 2
    const addressElement = document.getElementById('selected-address');
    if (addressElement && localStorage.getItem('address')) {
        addressElement.textContent = localStorage.getItem('address');
    }

    // Add click event for Sistema di Backup button
    const backupButton = document.getElementById('backupSystem');
    if (backupButton) {
        backupButton.addEventListener('click', function() {
            // Toggle active state
            this.classList.toggle('active');
            
            // Update value based on active state
            backup = this.classList.contains('active') ? 1000 : 0;
            console.log("Backup system set to:", backup);
            
            // Update visual appearance
            if (this.classList.contains('active')) {
                this.style.backgroundColor = '#112B3F';
                this.style.color = '#fff';
            } else {
                this.style.backgroundColor = 'transparent';
                this.style.color = '#B9B7B7';
            }
            
            // Update total cost
            updateTotalCost();
        });
    }

    // Add change events for the checkboxes
    const wallboxCheckbox = document.getElementById('wallbox');
    if (wallboxCheckbox) {
        wallboxCheckbox.addEventListener('change', function() {
            wallbox = this.checked ? 1500 : 0;
            console.log("Wallbox set to:", wallbox);
            updateTotalCost(); // Update total cost
        });
    }

    const lineaVitaCheckbox = document.getElementById('linea-vita');
    if (lineaVitaCheckbox) {
        lineaVitaCheckbox.addEventListener('change', function() {
            lineaVita = this.checked ? 2200 : 0;
            console.log("Linea Vita set to:", lineaVita);
            updateTotalCost(); // Update total cost
        });
    }

    const piccioniCheckbox = document.getElementById('piccioni');
    if (piccioniCheckbox) {
        piccioniCheckbox.addEventListener('change', function() {
            piccioni = this.checked ? 320 : 0;
            console.log("Rete Antipiccioni set to:", piccioni);
            updateTotalCost(); // Update total cost
        });
    }
    
    // Battery capacity controls - make globally accessible
    window.batteryCapacities = ["Senza batteria", "5 kWh", "10 kWh", "15 kWh", "20 kWh"]; // Default full set
    window.currentBatteryIndex = 0; // Start with "Senza batteria"
    window.Kwaccum = 0; // Initialize to 0
    
    // Function to update battery capacity display and Kwaccum value
    function updateBatteryCapacity() {
        const batteryCapacity = document.getElementById("batteryCapacity");
        
        if (batteryCapacity && window.batteryCapacities && window.batteryCapacities.length > 0) {
            batteryCapacity.textContent = window.batteryCapacities[window.currentBatteryIndex];
            
            // Update Kwaccum value based on selection
            if (window.currentBatteryIndex === 0) {
                window.Kwaccum = 0; // "Senza batteria"
            } else {
                // Extract the number from the string (e.g., "5 kWh" -> 5)
                window.Kwaccum = parseFloat(window.batteryCapacities[window.currentBatteryIndex]);
            }
            
            console.log("Kwaccum set to:", window.Kwaccum);
            
            // Update the stats-box with current Kwaccum value
            updateAccumuloDisplay(window.Kwaccum);
            
            // Update visual appearance based on selection
            const batteryContainer = document.getElementById("batteryContainer");
            if (batteryContainer) {
                if (window.currentBatteryIndex > 0) {
                    batteryContainer.style.backgroundColor = "#112B3F";
                    batteryContainer.style.color = "#fff";
                    batteryContainer.style.borderColor = "#112B3F";
                } else {
                    batteryContainer.style.backgroundColor = "transparent";
                    batteryContainer.style.color = "#B9B7B7";
                    batteryContainer.style.borderColor = "#B9B7B7";
                }
            }
            
            // Update basecost based on Kwaccum and potenza if possible
            updateBaseCost();
            
            // IMPORTANT: Recalculate values to update autoconsumo percentage
            if (Array.isArray(baseMonthlyData) && baseMonthlyData.length === 12) {
                calculateCompleteResults();
                
                // Make sure to update the progress ring/value
                updateProgress();
            }
        }
    }
    // Add event listeners for + and - buttons
    const increaseButton = document.getElementById("increaseBattery");
    if (increaseButton) {
        increaseButton.addEventListener("click", function() {
            if (window.currentBatteryIndex < window.batteryCapacities.length - 1) {
                window.currentBatteryIndex++;
                updateBatteryCapacity();
                console.log("Battery increased to:", window.batteryCapacities[window.currentBatteryIndex]);
            } else {
                console.log("Already at maximum battery capacity for this power level");
            }
        });
    }
        
    const decreaseButton = document.getElementById("decreaseBattery");
    if (decreaseButton) {
        decreaseButton.addEventListener("click", function() {
            if (window.currentBatteryIndex > 0) {
                window.currentBatteryIndex--;
                updateBatteryCapacity();
            }
        });
    }
    
    // Initialize battery capacity display and make function globally accessible
    window.updateBatteryCapacity = updateBatteryCapacity;
    updateBatteryCapacity();
    
    // Setup ottimizzatori button with proper event handling
    const optButton = document.getElementById('btnOpt');
    if (optButton) {
        // Fixed: Use the toggleOptimizers function that's already defined
        optButton.addEventListener('click', function() {
            toggleOptimizers(this);
        });
    }

    // Get modal elements
    const successModal = document.getElementById('successModal');
    const closeButtons = successModal.querySelectorAll('.close-modal, .modal-close');
    
    // Add click handlers to all close buttons in the success modal
    closeButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            // Hide the modal
            successModal.style.display = 'none';
            
            // Redirect to MyEnergy website
            window.location.href = "https://www.myenergy.it/casa-condominio/fotovoltaico";
        });
    });
    
    // Also handle form submission to show the success modal
    document.getElementById('contactForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Show spinner
        document.getElementById('spinnerOverlay').style.display = 'flex';
        
        // Simulate form submission (replace with your actual submission logic)
        setTimeout(function() {
            // Hide spinner
            document.getElementById('spinnerOverlay').style.display = 'none';
            
            // Show success modal
            successModal.style.display = 'block';
            
            // Clear form
            document.getElementById('contactForm').reset();
        }, 1500);
    });


});

// Function to update moduli count display based on potenza
function updateModuliCount(selectedPotenza) {
    // Format the potenza for lookup
    let potenzaKey;
    if (typeof selectedPotenza === 'number') {
        // Convert number to string with correct format (e.g., "3.32", "4.15", etc.)
        potenzaKey = selectedPotenza.toFixed(2);
        // Remove trailing zeros after decimal point if needed
        if (potenzaKey.endsWith('0')) {
            potenzaKey = selectedPotenza.toFixed(1);
        }
    } else {
        potenzaKey = selectedPotenza;
    }

    // Lookup panel count for this potenza
    let moduliCount = 0;
    if (pan[potenzaKey]) {
        moduliCount = pan[potenzaKey];
    } else {
        // Try alternate formats if direct lookup fails
        const alternateKeys = Object.keys(pan);
        for (const key of alternateKeys) {
            if (parseFloat(key) === parseFloat(potenzaKey)) {
                moduliCount = pan[key];
                break;
            }
        }
    }

    // Update display elements
    const moduliDisplayElements = document.querySelectorAll('.moduli-value');
    moduliDisplayElements.forEach(element => {
        element.textContent = moduliCount;
    });

    console.log(`Updated moduli count for potenza ${selectedPotenza} to ${moduliCount} panels`);
    
    // Update panelCount global variable
    panelCount = moduliCount;
    
    return moduliCount;
}

// Check if the map API is ready before initializing
function initializeMapWhenReady() {
  if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
    setTimeout(initializeMapWhenReady, 100);
    return;
  }
  
  // Google Maps API is loaded, now initialize the map
  initMap(lat, lng);
}


// Add this to your step navigation functions
function showMap() {
  setTimeout(function() {
    if (typeof google !== 'undefined' && google.maps && map) {
      google.maps.event.trigger(map, 'resize');
      
      // If you have center coordinates stored
      const lat = parseFloat(localStorage.getItem("latitude"));
      const lng = parseFloat(localStorage.getItem("longitude"));
      if (lat && lng) {
        map.setCenter({lat: lat, lng: lng});
      }
    }
  }, 100);
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('address-error-container');
    const errorMessage = errorContainer.querySelector('p');
    errorMessage.textContent = message;
    errorContainer.style.display = 'flex';
}

// Navigation functions
async function goToStep4() {

    document.getElementById('section-step3').style.display = 'none';

    // Show a spinner while calculations are happening
    const spinnerOverlay = document.getElementById('calculationSpinnerOverlay') || createCalculationSpinner();
    spinnerOverlay.style.display = 'flex';

    updateEfficiencyOptionsFromDOM();
    

    // Save all Step 3 variables
    saveStep3Variables();


    // Check current values directly instead of just localStorage
    const pompaSelected = pompa === 1;
    const infissiSelected = infissi === 1;
    const climatizzazioneSelected = climatizzazione === 1;

    console.log("Current efficiency values:", {
        pompa, infissi, climatizzazione,
        pompaSelected, infissiSelected, climatizzazioneSelected
    });

    // Get the message element
    const efficiencyMessage = document.getElementById('efficiency-message');

    // Show the message if any option was selected
    if (pompaSelected || infissiSelected || climatizzazioneSelected) {
        if (efficiencyMessage) {
            efficiencyMessage.style.display = "flex";
            console.log("Efficiency message displayed in Step 4");
        } else {
            console.warn("Efficiency message element not found but should be displayed");
        }
    } else {
        if (efficiencyMessage) {
            efficiencyMessage.style.display = "none";
            console.log("No efficiency options selected, hiding message");
        }
    }
    
    // Get area value
    const area = parseFloat(localStorage.getItem("area") || "0");
    
    // Set night = prevalenza
    night = prevalenzaValue;
    
    // Calculate potenza based on area
    const calculatedPotenza = calculatePotenza(area);
    
    // Set global potenza variable
    if (calculatedPotenza) {
        potenza = parseFloat(calculatedPotenza);
        
        // Calculate panel count
        panelCount = pan[calculatedPotenza] || 0;
        
        // Calculate basecost
        basecost = calculateDefaultBatteryCost(night, calculatedPotenza);
        
        console.log("Initial calculations:", {
            area: area + "m²",
            calculatedPotenza: calculatedPotenza + " kWp",
            panelCount: panelCount + " panels", 
            night: night,
            basecost: basecost
        });

        // Fetch PVWatts data
        const latitude = parseFloat(localStorage.getItem("latitude"));
        const longitude = parseFloat(localStorage.getItem("longitude"));
        const apiSuccess = await fetchPVWattsData(latitude, longitude, azimuth, inclinazione);
        
        if (apiSuccess) {
            updateProduzioneAnnuiTotali(potenza);
            
            // Run our new comprehensive calculations
            calculateCompleteResults();
        } else {
            console.error("Failed to fetch PVWatts data. Proceeding without production data.");
        }
        
        // Update the UI with relevant potenza buttons
        updatePotenzaButtons(calculatedPotenza);
        
        // Update battery options based on potenza
        updateBatteryOptions(calculatedPotenza);
        
        // Initialize accumulo display to 0
        updateAccumuloDisplay(0);
        
        // Update moduli count display
        updateModuliCount(potenza);
        
        // Initialize total cost
        updateTotalCost();
    }

    await loadGeoJSONAndFindCODAC();
    
    // Fetch PVWatts data
    const latitude = parseFloat(localStorage.getItem("latitude"));
    const longitude = parseFloat(localStorage.getItem("longitude"));
    const apiSuccess = await fetchPVWattsData(latitude, longitude, azimuth, inclinazione);
    
    if (apiSuccess) {
        updateProduzioneAnnuiTotali(potenza);
    } else {
        console.error("Failed to fetch PVWatts data. Proceeding without production data.");
    }
    
    // Log comprehensive data before moving to Step 4  
    console.log("COMPLETE DATA SUMMARY FOR STEP 3:", {
        // Step 1 & 2 data
        address: localStorage.getItem("address"),
        area: area + " m²",
        latitude: localStorage.getItem("latitude"),
        longitude: localStorage.getItem("longitude"),
        
        // Step 3 data
        consumo: consumoSlider + " €",
        prevalenza: prevalenzaValue + " (" + getPrevalenzaLabel(prevalenzaValue) + ")",
        detrazione: detrazione + "% (" + (detrazione === 36 ? 'Prima Casa' : 'Seconda Casa') + ")",
        superficie: getSuperficieLabel(inclinazione, azimuth),
        inclinazione: inclinazione + "°",
        azimuth: azimuth + "°",
        pompa,
        infissi,
        climatizzazione,
        selectionStatus: {
            userSelectedConsumo,
            userSelectedPrevalenza,
            userSelectedDetrazione,
            userSelectedSuperficie
        }
    });

    // Hide spinner// Hide spinner and show Step 4 after all calculations are complete
    spinnerOverlay.style.display = 'none';
    document.getElementById('section-step4').style.display = 'block';

    
    // Proceed to Step 4
    document.getElementById('section-step3').style.display = 'none';
    document.getElementById('section-step4').style.display = 'block';
}

// Create a calculation spinner if it doesn't exist
function createCalculationSpinner() {
    const spinnerOverlay = document.createElement('div');
    spinnerOverlay.id = 'calculationSpinnerOverlay';
    spinnerOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        flex-direction: column;
    `;
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.cssText = `
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #112B3F;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    `;
    
    const message = document.createElement('div');
    message.textContent = 'Calcolo in corso...';
    message.style.cssText = `
        margin-top: 20px;
        font-size: 18px;
        font-weight: 500;
        color: #112B3F;
    `;
    
    // Add the animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    spinnerOverlay.appendChild(spinner);
    spinnerOverlay.appendChild(message);
    document.body.appendChild(spinnerOverlay);
    
    return spinnerOverlay;
}

// Updated highlightCheckbox function to handle named checkboxes
function highlightCheckbox(checkbox) {
    // Log to verify which checkbox was clicked
    console.log("Checkbox clicked:", checkbox.id);
    
    // Update the visual appearance
    const span = checkbox.nextElementSibling;
    if (checkbox.checked) {
        span.classList.add('selected');
        span.parentElement.classList.add('btn-yellow');
    } else {
        span.classList.remove('selected');
        span.parentElement.classList.remove('btn-yellow');
    }
    
    // Set the values based on ID
    switch(checkbox.id) {
        case "pompa-di-calore":
            pompa = checkbox.checked ? 1 : 0;
            console.log("Pompa di Calore set to:", pompa);
            break;
        case "infissi":
            infissi = checkbox.checked ? 1 : 0;
            console.log("Infissi set to:", infissi);
            break;
        case "climatizzazione":
            climatizzazione = checkbox.checked ? 1 : 0;
            console.log("Climatizzazione set to:", climatizzazione);
            break;
        case "participate-community":
            communityParticipation = checkbox.checked ? 1 : 0;
            console.log("Community participation set to:", communityParticipation);
            break;
    }
    
    // Log all current values for verification
    console.log("Current options:", {pompa, infissi, climatizzazione, communityParticipation});
    
    // Check if all required fields are selected to show Procedi button
    checkStep3Required();
}

// Add this function to save the option values
function saveStep4Options() {
    localStorage.setItem("ottimizzatori", ottimizzatori);
    localStorage.setItem("backup", backup);
    localStorage.setItem("wallbox", wallbox);
    localStorage.setItem("lineaVita", lineaVita);
    localStorage.setItem("piccioni", piccioni);
    
    console.log("Step 4 options saved:", {
        ottimizzatori,
        backup,
        wallbox,
        lineaVita,
        piccioni
    });
}

// Function to update moduli count based on potenza
// Fix the updatePotenzaButtons function to use the correct event handler (around line 915)
function updatePotenzaButtons(currentPotenza) {
    const buttonsContainer = document.getElementById('buttonsContainer');
    if (!buttonsContainer) return;
    
    // Clear existing buttons
    buttonsContainer.innerHTML = "";
    
    // Determine which buttons to show based on current potenza
    let buttonValues = [];
    
    if (currentPotenza === "3.32" || currentPotenza === "4.15") {
        buttonValues = ["3.32", "4.15", "4.98"];
    } else {
        buttonValues = ["4.98", "6.23", "8.30"];
    }
    
    // Create buttons with new styling
    buttonValues.forEach((value, index) => {
        const button = document.createElement('button');
        button.type = "button";
        button.id = `btn${index+1}`;
        button.className = "power-btn";
        button.dataset.value = value;
        button.style.borderRadius = "100px !important";
        button.textContent = `${value.replace(".", ",")} kWp`;
        
        // Use correct onclick handler - this was the problem!
        button.onclick = function() { handlePowerButton(this); };
        
        // Set active state for current potenza
        if (value === currentPotenza) {
            button.classList.add('active');
            button.style.backgroundColor = '#112B3F';
            button.style.color = '#fff';
            button.style.borderColor = '#112B3F';
        }
        
        buttonsContainer.appendChild(button);
    });
    
    // Add the ottimizzatori button with new styling
    const optButton = document.createElement('button');
    optButton.type = "button";
    optButton.id = "btnOpt";
    optButton.className = "opt-btn";
    optButton.style.borderRadius = "100px !important";
    optButton.onclick = function() { toggleOptimizers(this); };
    
    // Create the tooltip span
    const questionSpan = document.createElement('span');
    questionSpan.className = 'question-button';
    questionSpan.dataset.tooltip = "Gli ottimizzatori di potenza massimizzano la resa dell'impianto, garantendo una maggiore produzione.";
    questionSpan.textContent = "?";
    
    // Add text and tooltip to the button
    optButton.textContent = 'Ottimizzatori di potenza ';
    optButton.appendChild(questionSpan);
    
    // Add button to container
    buttonsContainer.appendChild(optButton);
    
    // Add the SVG element
    const svgHTML = `
        <svg id="svgImage" width="80" height="10" viewBox="0 0 96 10">
            <path d="M0,0 L25,0 A5,5 0 0,1 30,5 A5,5 0 0,1 25,10 L0,10 Z" fill="#112B3F"></path>
            <rect x="32" y="0" width="14" height="10" rx="10" ry="10" fill="#112B3F"></rect>
            <rect x="48" y="0" width="9" height="10" rx="10" ry="10" fill="#112B3F"></rect>
            <rect x="59" y="1" width="7" height="8" rx="10" ry="10" fill="#112B3F"></rect>
            <rect fill="#112B3F" ry="10" rx="10" height="4" width="3" y="3" x="70"></rect>
        </svg>
    `;
    buttonsContainer.insertAdjacentHTML('beforeend', svgHTML);
}

// Function to handle potenza button changes
function handlePotenzaChange(value) {
    // Parse value to float
    const newPotenza = parseFloat(value);
    
    // Check if area is sufficient for this potenza
    const area = parseFloat(localStorage.getItem("area") || "0");
    const minArea = getMinAreaForPotenza(value);
    
    // Store the original calculated potenza for possible reversion
    const originalPotenza = calculatePotenza(area);
    
    if (area < minArea) {
        // Show warning popup with option to revert
        showAreaWarning(value, minArea, area, originalPotenza);
    }
    
    // Update potenza variable
    potenza = newPotenza;
    
    // Update UI
    updatePotenzaButtons(value);
    
    // Update panel count
    panelCount = pan[value] || 0;
    updateModuliCount(newPotenza);
    
    // Update battery options
    updateBatteryOptions(value);
    
    // Update basecost
    basecost = calculateDefaultBatteryCost(night, value);
    
    // Update total cost
    updateTotalCost();
    
    // Update production values based on new potenza
    if (Array.isArray(baseMonthlyData) && baseMonthlyData.length === 12) {
        updateProduzioneAnnuiTotali(newPotenza);
        console.log("Production values updated for new potenza:", {
            potenza: newPotenza + " kWp",
            annualProduction: produzioneAnnuaTotale.toFixed(2) + " kWh",
        });
        
        // Run comprehensive calculations
        calculateCompleteResults();
    } else {
        console.warn("Cannot update production values - baseMonthlyData not available");
    }
    
    console.log(`Potenza changed to ${value} kWp, Panel count: ${panelCount}, Basecost: ${basecost} €`);
}

// Function to show area warning popup with option to revert
function showAreaWarning(potenza, minArea, actualArea, originalPotenza) {
    // First, remove any existing warning popups and overlays
    const existingWarnings = document.querySelectorAll('.warning-popup, .warning-overlay');
    existingWarnings.forEach(element => {
        document.body.removeChild(element);
    });
    
    // Create blocking overlay to prevent interaction with the page
    const overlay = document.createElement('div');
    overlay.className = 'warning-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;
    
    // Create warning popup
    const warning = document.createElement('div');
    warning.className = 'warning-popup';
    warning.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: white;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        z-index: 1000;
        max-width: 400px;
        text-align: center;
    `;
    
    warning.innerHTML = `
        <h3>Attenzione</h3>
        <p>L'area necessaria per un impianto da ${potenza.replace(".", ",")} kWp è di ${minArea} m², ma hai solo ${actualArea} m² disponibili.</p>
        <div style="display: flex; justify-content: space-around; margin-top: 15px;">
            <button id="continueBtn" style="
                padding: 8px 15px; 
                background-color: #112B3F; 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer;">OK</button>
            <button id="revertBtn" style="
                padding: 8px 15px; 
                background-color: #e74c3c; 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer;">Keep potenza unchanged</button>
        </div>
    `;
    
    // Add to body - overlay first, then warning
    document.body.appendChild(overlay);
    document.body.appendChild(warning);
    
    // Function to remove both warning and overlay
    const removeWarningElements = () => {
        document.body.removeChild(warning);
        document.body.removeChild(overlay);
    };
    
    // Add click handler to OK button
    warning.querySelector('#continueBtn').addEventListener('click', function() {
        removeWarningElements();
    });
    
    // Add click handler to revert button
    warning.querySelector('#revertBtn').addEventListener('click', function() {
        // Revert to original potenza value
        potenza = parseFloat(originalPotenza);
        console.log(`Reverting to original potenza: ${originalPotenza} kWp`);
        
        // Update UI
        updatePotenzaButtons(originalPotenza);
        
        // Update panel count
        panelCount = pan[originalPotenza] || 0;
        updateModuliCount(potenza);
        console.log(`Panel count reverted to: ${panelCount} panels`);
        
        // Update battery options
        updateBatteryOptions(originalPotenza);
        
        // Update basecost
        basecost = calculateDefaultBatteryCost(night, originalPotenza);
        console.log(`Basecost reverted to: ${basecost} €`);
        
        // Close warning and overlay
        removeWarningElements();
    });
}

// Function to update battery options based on potenza
// Fix the updateBatteryOptions function (around line 994)
// Enhanced function to properly handle battery options when changing power level
function updateBatteryOptions(currentPotenza) {
    console.log("Updating battery options for potenza:", currentPotenza);
    
    // Store the current battery selection before changing options
    const currentBatterySelection = window.batteryCapacities && window.currentBatteryIndex >= 0 ? 
        window.batteryCapacities[window.currentBatteryIndex] : "Senza batteria";
    console.log("Current battery selection:", currentBatterySelection);
    
    // Get available battery options for this potenza
    let batteryOptions = ["Senza batteria", "5 kWh", "10 kWh"];
    
    // Convert potenza to string for comparison if it's a number
    if (typeof currentPotenza === 'number') {
        currentPotenza = currentPotenza.toString();
        // Handle floating point precision
        if (currentPotenza === "8.3") currentPotenza = "8.30";
    }
    
    // Debug log current potenza for comparison
    console.log("Checking battery options for potenza:", currentPotenza, "Type:", typeof currentPotenza);
    
    // Add additional options based on potenza (with more flexible comparison)
    const potenza623 = ["6.23", "6.2", "6.230"];
    const potenza830 = ["8.30", "8.3", "8.300"];
    
    if (potenza623.includes(currentPotenza) || potenza830.includes(currentPotenza)) {
        batteryOptions.push("15 kWh");
        console.log("Added 15 kWh option for power:", currentPotenza);
    }
    
    if (potenza830.includes(currentPotenza)) {
        batteryOptions.push("20 kWh");
        console.log("Added 20 kWh option for power:", currentPotenza);
    }
    
    // Store the options globally
    window.batteryCapacities = batteryOptions;
    console.log("Battery options set to:", batteryOptions);
    
    // Check if the current selection is still available in new options
    let newIndex = batteryOptions.indexOf(currentBatterySelection);
    
    // If current selection is not in the new options
    if (newIndex === -1) {
        // Select the maximum available battery
        if (currentBatterySelection !== "Senza batteria") {
            // User had a battery selected, so choose the highest available
            newIndex = batteryOptions.length - 1;
            console.log(`Previous battery selection (${currentBatterySelection}) not available, selecting max: ${batteryOptions[newIndex]}`);
        } else {
            // User had no battery, keep it that way
            newIndex = 0;
            console.log("Keeping 'Senza batteria' selection");
        }
    } else {
        console.log(`Keeping current battery selection: ${currentBatterySelection}`);
    }
    
    // Set the new index
    window.currentBatteryIndex = newIndex;
    
    // Update Kwaccum value based on selection
    if (window.currentBatteryIndex === 0) {
        window.Kwaccum = 0; // "Senza batteria"
    } else {
        // Extract the number from the string (e.g., "5 kWh" -> 5)
        window.Kwaccum = parseFloat(window.batteryCapacities[window.currentBatteryIndex]);
    }
    console.log("Kwaccum set to:", window.Kwaccum);
    
    // Update the display
    const batteryCapacity = document.getElementById("batteryCapacity");
    if (batteryCapacity) {
        batteryCapacity.textContent = batteryOptions[window.currentBatteryIndex];
    }
    
    // Update batteryContainer style
    const batteryContainer = document.getElementById("batteryContainer");
    if (batteryContainer) {
        if (window.currentBatteryIndex > 0) {
            batteryContainer.style.backgroundColor = "#112B3F";
            batteryContainer.style.color = "#fff";
            batteryContainer.style.borderColor = "#112B3F";
        } else {
            batteryContainer.style.backgroundColor = "transparent";
            batteryContainer.style.color = "#B9B7B7";
            batteryContainer.style.borderColor = "#B9B7B7";
        }
    }
    
    // Update the stats-box with current Kwaccum value
    updateAccumuloDisplay(window.Kwaccum);
    
    console.log("Battery options updated for potenza", currentPotenza, ":", 
                "Selected:", batteryOptions[window.currentBatteryIndex]);
    
    return window.currentBatteryIndex;
}
// New function to update the Accumulo display in the stats-box
function updateAccumuloDisplay(Kwaccum) {
    // Find the Accumulo value display element
    const accumuloDisplay = document.querySelector('.accumulo-value');
    
    if (accumuloDisplay) {
        if (Kwaccum === 0) {
            accumuloDisplay.textContent = "0 kWh";
        } else {
            accumuloDisplay.textContent = Kwaccum + " kWh";
        }
        console.log("Accumulo display updated to:", accumuloDisplay.textContent);
    } else {
        console.log("Accumulo display element not found");
    }
}

// Update global basecost based on current potenza and Kwaccum
function updateBaseCost() {
    if (potenza) {
        // Convert potenza to string with exactly the format in our data structure
        let potenzaStr;
        if (potenza === 3.32) potenzaStr = "3.32";
        else if (potenza === 4.15) potenzaStr = "4.15";
        else if (potenza === 4.98) potenzaStr = "4.98";
        else if (potenza === 6.23) potenzaStr = "6.23";
        else if (potenza === 8.3 || potenza === 8.30) potenzaStr = "8.30";
        else potenzaStr = potenza.toString();
        
        // Get Kwaccum as string to match our data structure
        const kwaccumStr = window.Kwaccum.toString();
        
        console.log(`Looking up basecost for potenza ${potenzaStr} and Kwaccum ${kwaccumStr}`);
        
        if (batt[potenzaStr] && batt[potenzaStr][kwaccumStr]) {
            // Update the global basecost value
            basecost = batt[potenzaStr][kwaccumStr];
            console.log(`%c Basecost updated to: ${basecost} €`, 'color: purple; font-weight: bold;');
            
            // Update the base cost display if it exists
            const basecostDisplay = document.querySelector('.basecost-value');
            if (basecostDisplay) {
                basecostDisplay.textContent = basecost + " €";
            }
            
            // Update total cost
            updateTotalCost();
        } else {
            console.log(`Could not find matching cost for potenza ${potenzaStr} and Kwaccum ${kwaccumStr}`);
        }
    }
}

function setAutoconsumoValue(percentage) {
    // This is now just a placeholder function since we removed the progress ring
    // We can still store the value for other parts of the code that might need it
    console.log(`Autoconsumo percentage set to: ${percentage}%`);
    
    // Update the text display if it still exists
    const progressValue = document.getElementById('progressValue');
    if (progressValue) {
        progressValue.textContent = `${percentage}%`;
    }
    
    // Store the value for potential future use
    window.autoconsumoPercentage = percentage;
}

// Update the autoconsumoPercentuale value from the calculated results
function updateAutoconsumoValue() {
    if (window.calculatedValues && window.calculatedValues.autoconsumo_percentuale) {
        const value = Math.round(window.calculatedValues.autoconsumo_percentuale);
        document.getElementById("autoconsumoPercentuale").textContent = value;
    }
}

document.addEventListener("DOMContentLoaded", function() {
    updateProgress();
    
    // Set up the observer for changes
    const targetNode = document.getElementById("autoconsumoPercentuale");
    if (targetNode) {
        const observer = new MutationObserver(updateProgress);
        observer.observe(targetNode, { childList: true, characterData: true, subtree: true });
    }
});

// Combined calculation function
function calculateCompleteResults() {
    // Assign values from global variables
    const consumoResult = consumoSlider;
    const accumulo = window.Kwaccum || 0;
    
    console.log("%c🧮 Starting comprehensive calculations...", "color: green; font-weight: bold");
    
    if (!produzioneAnnuaTotale) {
        console.warn('⚠️ Production data not yet initialized');
        return;
    }
    
    // Log basic inputs
    console.log("Basic inputs:", {
        consumoResult: consumoResult + " €",
        accumulo: accumulo + " kWh",
        potenza: potenza + " kWp",
        night: night + "%",
        detrazione: detrazione + "%",
        produzioneAnnuaTotale: produzioneAnnuaTotale.toFixed(2) + " kWh"
    });

    // === CONSUMPTION CALCULATIONS ===
    consumi_annui = (consumoResult / price_kwh) * 12;
    const consumi_annui_giorno = consumi_annui * (1 - (night / 100));
    const consumi_annui_notte = consumi_annui * (night / 100);

    // === PRODUCTION AND CONSUMPTION EFFICIENCY ===
    autoconsumo_diretto_kwh_anno_1 = Math.min(
        (consumi_annui_giorno * 0.9 + consumi_annui_notte * 0.1),
        produzioneAnnuaTotale * 0.95 
    ) * 0.85;

    autoconsumo_batteria_kwh_anno_1 = Math.min(
        (consumi_annui_notte * 0.9 + consumi_annui_giorno * 0.1) * 0.85,
        accumulo * 365 * 0.75
    );

    autoconsumo_totale_kwh_anno_1 = autoconsumo_batteria_kwh_anno_1 + autoconsumo_diretto_kwh_anno_1;
    autoconsumo_percentuale = Math.min((autoconsumo_totale_kwh_anno_1 / produzioneAnnuaTotale) * 100, 85);
    
    // === GRID INTERACTION ===
    immissione_kwh_anno_1 = produzioneAnnuaTotale - autoconsumo_totale_kwh_anno_1;
    prelievo_rete_dopo_impianto_anno_1 = consumi_annui - autoconsumo_totale_kwh_anno_1;

    // === FINANCIAL CALCULATIONS ===
    costo_mensile_bolletta_dopo_impianto = (prelievo_rete_dopo_impianto_anno_1 * price_kwh / 12);
    risparmio_1_anno_bolletta = (consumoResult - costo_mensile_bolletta_dopo_impianto) * 12;
    risparmio_immisione_anno_1 = immissione_kwh_anno_1 * RID;
    
    // Get proper base cost value (handling different formats)
    let baseValue = 0;
    if (typeof basecost === 'string') {
        baseValue = parseFloat(basecost.replace(".", "").replace(",", ".")) || 0;
    } else {
        baseValue = basecost || 0;
    }
    
    const massimale = potenza * 2400 + accumulo * 1000;
    risparmio_10_anni_detrazione = Math.min(massimale, baseValue) * (detrazione / 100);
    
    // === PERFORMANCE TABLES OVER 26 YEARS ===
    const anni = [...Array(26).keys()];
    const perfor_panelli = [
        100.00, 99.45, 98.90, 98.35, 97.80, 97.25, 96.70, 96.15, 95.60, 95.05,
        94.50, 93.95, 93.40, 92.85, 92.30, 91.75, 91.20, 90.65, 90.10, 89.55,
        89.00, 88.45, 87.90, 87.35, 86.80, 86.25
    ];

    const perfor_batteria = [
        100.00, 98.50, 97.00, 95.50, 94.00, 92.50, 91.00, 89.50, 88.00, 86.50,
        85.00, 83.50, 82.00, 80.50, 79.00, 77.50, 76.00, 74.50, 73.00, 71.50,
        70.00, 68.50, 67.00, 65.50, 64.00, 62.50
    ];

    // Use already calculated prod_table if available, or calculate it
    if (!Array.isArray(prod_table) || prod_table.length !== 26) {
        prod_table = anni.map(year => 
            produzioneAnnuaTotale * (perfor_panelli[year] / 100)
        );
    }

    const autoconsumo_table = anni.map(year => 
        year === 0 ? 0 : (
            (autoconsumo_batteria_kwh_anno_1 * perfor_batteria[year] / 100) + 
            (autoconsumo_diretto_kwh_anno_1 * perfor_panelli[year] / 100)
        )
    );

    const immi_table = anni.map((year, index) => 
        year === 0 ? 0 : (prod_table[index] - autoconsumo_table[index])
    );

    const risp_autocons = anni.map((year, index) => 
        year === 0 ? 0 : (autoconsumo_table[index] * price_kwh)
    );

    const risp_rid = anni.map((year, index) => 
        year === 0 ? 0 : (immi_table[index] * RID)
    );

    const detra = anni.map(year => 
        year > 0 && year <= 10 ? risparmio_10_anni_detrazione / 10 : 0
    );

    const risp_totale = anni.map((year, index) => 
        year === 0 ? 0 : (risp_autocons[index] + risp_rid[index] + detra[index])
    );
    

    // Calculate cumulative savings
    risp_cumula = anni.reduce((acc, year, index) => {
    if (year === 0) {
        // Convert costResult to a proper number before using it
        let costResultNumber;
        if (typeof costResult === 'string') {
            // Handle Italian number format (e.g. "20.740,00")
            costResultNumber = parseFloat(costResult.replace(/\./g, '').replace(',', '.')) || 0;
        } else {
            costResultNumber = parseFloat(costResult) || 0;
        }
        acc.push(-costResultNumber);
    } else {
        acc.push(acc[index - 1] + risp_totale[index]);
    }
    return acc;
}, []);

    // === ADDITIONAL METRICS CALCULATIONS ===
    produzioneLifetime = prod_table.reduce((sum, val) => sum + val, 0);
    alberiEquivalenti = (produzioneLifetime * 0.255) / 21;
    Co2 = (produzioneLifetime * 0.255);
    risparmio_25_anni_totale = (risparmio_1_anno_bolletta + risparmio_immisione_anno_1) * 25 * 0.9285 + risparmio_10_anni_detrazione;
    const negativeValuesCount = risp_cumula.filter(value => value < 0).length;

    let costResultValue = 0;
    if (typeof costResult === 'string') {
        // Convert from Italian format (24.920,00) to a number
        costResultValue = parseFloat(costResult.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
        costResultValue = parseFloat(costResult) || 0;
    }

    utile25Anni = risparmio_25_anni_totale - costResultValue;
    percentualeRisparmioEnergetico = (1 - (prelievo_rete_dopo_impianto_anno_1 / consumi_annui)) * 100;

    // For debugging - log the values used in calculation
    console.log("Profit calculation:", {
        risparmio_25_anni_totale: risparmio_25_anni_totale,
        costResult: costResult,
        costResultValue: costResultValue,
        utile25Anni: utile25Anni
    });

    // Update UI display elements with calculated values
    const risparmioTotaleElement = document.getElementById('risparmioTotale');
    if (risparmioTotaleElement) {
        // Format the value with thousand separator and round to whole number
        risparmioTotaleElement.textContent = Math.round(risparmio_25_anni_totale).toLocaleString('it-IT');
    }
    
    // Update the autoconsumo progress indicator
    const autoconsumoElement = document.getElementById('autoconsumoPercentuale');
    if (autoconsumoElement) {
        autoconsumoElement.textContent = Math.round(autoconsumo_percentuale);
    }
    
    // Update other UI elements with their respective values
    const produzioneLifetimeElement = document.getElementById('produzioneLifetime');
    if (produzioneLifetimeElement) {
        produzioneLifetimeElement.textContent = Math.round(produzioneLifetime).toLocaleString('it-IT');
    }
    
    const co2Element = document.getElementById('Co2');
    if (co2Element) {
        co2Element.textContent = Math.round(Co2).toLocaleString('it-IT');
    }
    
    const alberiEquivalentiElement = document.getElementById('alberiEquivalenti');
    if (alberiEquivalentiElement) {
        alberiEquivalentiElement.textContent = Math.round(alberiEquivalenti);
    }

    const autoconsumoPercentageRounded = Math.round(autoconsumo_percentuale);
    setAutoconsumoValue(autoconsumoPercentageRounded);



    // Store all calculated values for form submission and reuse
    window.calculatedValues = {
        consumi_annui,
        consumi_annui_giorno,
        consumi_annui_notte,
        produzioneAnnuaTotale,
        produzioneLifetime,
        autoconsumo_diretto_kwh_anno_1,
        autoconsumo_batteria_kwh_anno_1,
        autoconsumo_totale_kwh_anno_1,
        autoconsumo_percentuale,
        immissione_kwh_anno_1,
        prelievo_rete_dopo_impianto_anno_1,
        costo_mensile_bolletta_dopo_impianto,
        risparmio_1_anno_bolletta,
        risparmio_immisione_anno_1,
        risparmio_10_anni_detrazione,
        risparmio_25_anni_totale,
        alberiEquivalenti,
        Co2,
        utile25Anni,
        detrazione,
        negativeValuesCount,
        percentualeRisparmioEnergetico,
        panelCount: pan[potenza] || 0,
        anni,
        perfor_panelli,
        perfor_batteria,
        prod_table,
        autoconsumo_table,
        immi_table,
        risp_autocons,
        risp_rid,
        detra,
        risp_totale,
        risp_cumula
    };
    
    // === COMPREHENSIVE CONSOLE LOGGING ===
    console.group("%c📊 Complete Analysis Results", "color: blue; font-weight: bold; font-size: 14px");
    
    console.log("%c💡 Energy Production & Consumption", "font-weight: bold");
    console.table({
        "Annual Consumption": consumi_annui.toFixed(2) + " kWh",
        "Day Consumption": consumi_annui_giorno.toFixed(2) + " kWh",
        "Night Consumption": consumi_annui_notte.toFixed(2) + " kWh",
        "Annual Production": produzioneAnnuaTotale.toFixed(2) + " kWh",
        "Lifetime Production (26y)": produzioneLifetime.toFixed(2) + " kWh",
        "Direct Self-consumption": autoconsumo_diretto_kwh_anno_1.toFixed(2) + " kWh",
        "Battery Self-consumption": autoconsumo_batteria_kwh_anno_1.toFixed(2) + " kWh",
        "Total Self-consumption": autoconsumo_totale_kwh_anno_1.toFixed(2) + " kWh",
        "Self-consumption Rate": autoconsumo_percentuale.toFixed(2) + "%",
        "Grid Feed-in": immissione_kwh_anno_1.toFixed(2) + " kWh",
        "Grid Withdrawal": prelievo_rete_dopo_impianto_anno_1.toFixed(2) + " kWh",
        "Energy Independence": percentualeRisparmioEnergetico.toFixed(2) + "%"
    });
    
    console.log("%c💰 Financial Analysis", "font-weight: bold");
    console.table({
        "System Cost": costResult + " €",
        "Tax Deduction Maximum": massimale.toFixed(2) + " €",
        "Tax Deduction Rate": detrazione + "%",
        "Monthly Bill After PV": costo_mensile_bolletta_dopo_impianto.toFixed(2) + " €",
        "Annual Bill Savings": risparmio_1_anno_bolletta.toFixed(2) + " €",
        "Annual Feed-in Revenue": risparmio_immisione_anno_1.toFixed(2) + " €",
        "10-Year Tax Deduction": risparmio_10_anni_detrazione.toFixed(2) + " €",
        "25-Year Total Savings": risparmio_25_anni_totale.toFixed(2) + " €",
        "25-Year Net Profit": utile25Anni.toFixed(2) + " €",
        "Payback Period": negativeValuesCount + " years"
    });
    
    console.log("%c🌍 Environmental Impact", "font-weight: bold");
    console.table({
        "CO2 Avoided": Co2.toFixed(2) + " kg",
        "Equivalent Trees": Math.round(alberiEquivalenti) + " trees"
    });
    
    console.log("%c📈 Year-by-year Results", "font-weight: bold");
    const yearlyResults = anni.map((year, i) => ({
        Year: year,
        Production: prod_table[i]?.toFixed(2) + " kWh" || "N/A",
        "Self-consumption": autoconsumo_table[i]?.toFixed(2) + " kWh" || "N/A",
        "Grid Feed-in": immi_table[i]?.toFixed(2) + " kWh" || "N/A",
        "Self-cons. Savings": risp_autocons[i]?.toFixed(2) + " €" || "N/A",
        "Feed-in Revenue": risp_rid[i]?.toFixed(2) + " €" || "N/A",
        "Tax Deduction": detra[i]?.toFixed(2) + " €" || "N/A",
        "Annual Savings": risp_totale[i]?.toFixed(2) + " €" || "N/A",
        "Cumulative Savings": risp_cumula[i]?.toFixed(2) + " €" || "N/A"
    }));
    console.table(yearlyResults);
    
    console.groupEnd();
    
    return window.calculatedValues;
}


// Add this function right after the validateForm function in your script
function getAddressInfo() {
    // Log all address-related values in localStorage
    console.log("Address info from localStorage:", {
        address: localStorage.getItem("address"),
        latitude: localStorage.getItem("latitude"),
        longitude: localStorage.getItem("longitude")
    });

    // Create a fallback object with the best available values
    return {
        address: localStorage.getItem("address") || 
                document.getElementById('selected-address')?.textContent || 
                document.getElementById('address')?.value || "",
        
        latitude: localStorage.getItem("latitude") || "0",
        longitude: localStorage.getItem("longitude") || "0"
    };
}

console.log("Checking critical form values:", {
    powerLevel: window.potenza,
    powerType: typeof window.potenza,
    panelMapping: window.pan,
    azimuth: window.azimuth,
    inclinazione: window.inclinazione,
    nightValue: window.night,
    prevalenzaValue: prevalenzaValue
});

// Ensure proper panel count calculation
if (window.pan && window.potenza) {
    const potenzaKey = window.potenza.toString();
    panelCount = window.pan[potenzaKey] || 0;
    console.log(`Panel count for ${potenzaKey}: ${panelCount}`);
} else {
    console.warn("Cannot calculate panel count - missing power level or panel mapping");
}

// Ensure proper nightValue 
let nightValue = 50;


// Make sure window.azimuth has a fallback
if (typeof window.azimuth === 'undefined') {
    window.azimuth = parseInt(localStorage.getItem("azimuth") || "180");
    console.log("Using azimuth fallback:", window.azimuth);
}

// Make sure window.inclinazione has a fallback
if (typeof window.inclinazione === 'undefined') {
    window.inclinazione = parseInt(localStorage.getItem("inclinazione") || "30");
    console.log("Using inclinazione fallback:", window.inclinazione);
}

// Make sure window.potenza has a fallback
if (typeof window.potenza === 'undefined' || window.potenza === 0) {
    // Try getting from localStorage or use a default
    window.potenza = parseFloat(localStorage.getItem("potenza") || "3.32");
    console.log("Using potenza fallback:", window.potenza);
}

if (typeof window.prevalenzaValue === 'number') {
    // If we have a numeric value already set (30, 50, 70)
    nightValue = window.prevalenzaValue;
} else if (typeof prevalenzaValue === 'string') {
    // If we have a string value from button text
    if (prevalenzaValue === 'Giorno') {
        nightValue = 30;
    } else if (prevalenzaValue === 'Equilibrato') {
        nightValue = 50;
    } else if (prevalenzaValue === 'Notte') {
        nightValue = 70;
    }
} else if (typeof night !== 'undefined') {
    // Use the night variable if it's defined
    nightValue = night;
}

// Function to format numbers in Italian style (comma as decimal separator)  BITTUMON
function formatNumberIT(number) {
    if (typeof number === 'undefined' || number === null) return "0";
    
    // If it's already a string with comma and proper formatting, return it
    if (typeof number === 'string' && number.includes(',') && number.includes('.')) return number;
    
    // Convert to a number if it's a string
    if (typeof number === 'string') {
        number = parseFloat(number.replace(',', '.'));
    }
    
    // Return formatted with Italian locale (comma as decimal separator AND dot as thousand separator)
    return number.toFixed(2)
        .replace('.', ',')                      // Replace decimal point with comma
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Add dots as thousand separators
}

// Function to format integers in Italian style BITTUMON
function formatIntegerIT(number) {
    if (typeof number === 'undefined' || number === null) return "0";
    
    // Convert to a number if it's a string
    if (typeof number === 'string') {
        number = parseInt(number.replace('.', '').replace(',', '.'));
    }
    
    // Return formatted integer with dot thousand separators and no decimals
    return Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

console.log("Using nightValue for form submission:", nightValue);

// Contact form validation and submission
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateForm()) {
            return false;
        }

        // IMPORTANT: Get these values directly from the DOM to ensure they're current
        const communityParticipation = document.getElementById('participate-community').checked ? 1 : 0;
        const codArea = document.getElementById('cod-ac-value').textContent || "Area non trovata";
        
        console.log("Form submission values:", {
            communityParticipation: communityParticipation,
            codArea: codArea
        });
        
        // Show loading spinner
        document.getElementById('spinnerOverlay').style.display = 'flex';

        // Get address and location details with fallbacks
        const addressInfo = getAddressInfo();
        console.log("Using address info:", addressInfo);
                    
        // Show loading spinner
        document.getElementById('spinnerOverlay').style.display = 'flex';
        
        // Get proper values for submission
        const values = window.calculatedValues || {};
        const firstName = document.getElementById('name').value;
        const lastName = document.getElementById('surname').value;
        
        // Get consumo slider value (not the element)
        const consumoSlider = document.getElementById('consumoSlider')?.value || "0";
        
        // Add these functions before your form submission code
        function formatProductionData() {
            // Create months array
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            
            // Get monthly production data if available, or use default values
            const production = Array.isArray(baseMonthlyData) && baseMonthlyData.length === 12 
                ? baseMonthlyData.map(val => parseFloat((val * potenza).toFixed(2)))
                : monthlyData && monthlyData.length === 12 
                    ? monthlyData.map(val => parseFloat(val.toFixed(2))) 
                    : [134.12, 222.76, 433.27, 590.72, 695.25, 784.3, 810.54, 670.08, 489.92, 268.25, 128.56, 107.04];
            
            // Create the formatted object
            return JSON.stringify({
                months: months,
                production: production
            });
        }

        function formatSavingsData() {
            // Create years array
            const anni = Array.from({ length: 26 }, (_, i) => i);
            
            // Get cumulative savings data or use default array
            const risparmio_cumulativo = Array.isArray(window.calculatedValues?.risp_cumula)
                ? window.calculatedValues.risp_cumula.map(val => parseFloat(val.toFixed(2)))
                : Array.from({ length: 26 }, (_, i) => i === 0 ? -14290 : -14290 + (i * 1200));
            
            // Create the formatted object
            return JSON.stringify({
                anni: anni,
                risparmio_cumulativo: risparmio_cumulativo
            });
        }
                
        // Get cost result from display
        const costResultElement = document.querySelector('.cost-result-value');
        if (costResultElement) {
            costResultElement.textContent = costResult + " €";
        }
        // Get detrazione value
        const detrazioneValue = document.getElementById('primo-casa')?.checked ? 50 : 
                              document.getElementById('seconda-casa')?.checked ? 36 : 0;
        
        // Generate report ID
        const tempo = getCurrentTimestamp();
        const rep_file = generateReportID(firstName, lastName, tempo);
        
        // Construct the Google Form URL with all parameters
        const formUrl = `https://docs.google.com/forms/d/e/1FAIpQLSee10XOVRM2hrskYjU3MerIuZI2wp7_Y5FXTILM4JP81_dfqA/formResponse?usp=pp_url`
            // Basic Information
            + `&entry.49209369=${encodeURIComponent(firstName)}`
            + `&entry.1372551180=${encodeURIComponent(lastName)}`
            + `&entry.1843687495=${encodeURIComponent(document.getElementById('email').value)}`
            + `&entry.1738069916=${encodeURIComponent(document.getElementById('phone').value)}`
            + `&entry.1505658450=${encodeURIComponent(addressInfo.address)}`
            
            // Location Details
            + `&entry.1305223479=${encodeURIComponent(addressInfo.latitude)}`
            + `&entry.1238272703=${encodeURIComponent(addressInfo.longitude)}`
            
            // Installation Details
            + `&entry.1927567924=${encodeURIComponent((localStorage.getItem("area") || "0") + " m²")}`
            + `&entry.1609859917=${encodeURIComponent(consumoSlider + "€")}`
            + `&entry.647173530=${encodeURIComponent((window.potenza || "0")+ " kWp")}`
            + `&entry.235331739=${encodeURIComponent(window.inclinazione || "0")}`
            + `&entry.68571336=${encodeURIComponent(prevalenzaValue)}`
            + `&entry.1647761942=${encodeURIComponent(window.azimuth || "0")}`
            + `&entry.1393245675=${encodeURIComponent(nightValue)}`
            
            // Technical Details
            + `&entry.1734614655=${encodeURIComponent(panelCount || "0")}`
            + `&entry.1984629278=${encodeURIComponent(rep_file)}`
            
            // Consumption and Production
            + `&entry.918715533=${encodeURIComponent(values.consumi_annui?.toFixed(2) || "0")}`
            + `&entry.774788600=${encodeURIComponent(values.consumi_annui_giorno?.toFixed(2) || "0")}`
            + `&entry.1023535803=${encodeURIComponent(values.consumi_annui_notte?.toFixed(2) || "0")}`
            + `&entry.71988620=${encodeURIComponent(values.produzioneAnnuaTotale?.toFixed(2) || "0")}`
            + `&entry.150449002=${encodeURIComponent(values.produzioneLifetime?.toFixed(2) || "0")}`
            
            // Efficiency Metrics
            + `&entry.472438144=${encodeURIComponent(values.autoconsumo_diretto_kwh_anno_1?.toFixed(2) || "0")}`
            + `&entry.815981441=${encodeURIComponent(values.autoconsumo_batteria_kwh_anno_1?.toFixed(2) || "0")}`
            + `&entry.1864664582=${encodeURIComponent(values.autoconsumo_totale_kwh_anno_1?.toFixed(2) || "0")}`
            + `&entry.668099502=${encodeURIComponent(values.autoconsumo_percentuale?.toFixed(2) || "0")}`
            
            // Grid Interaction
            + `&entry.488621106=${encodeURIComponent(values.immissione_kwh_anno_1?.toFixed(2) || "0")}`
            + `&entry.997238363=${encodeURIComponent(values.prelievo_rete_dopo_impianto_anno_1?.toFixed(2) || "0")}`
            
            // Financial Metrics
            + `&entry.1707183499=${encodeURIComponent(values.costo_mensile_bolletta_dopo_impianto?.toFixed(2) || "0")}`
            + `&entry.722810239=${encodeURIComponent(values.risparmio_1_anno_bolletta?.toFixed(2) || "0")}`
            + `&entry.1949209604=${encodeURIComponent(values.risparmio_10_anni_detrazione?.toFixed(2) || "0")}`
            + `&entry.977732916=${encodeURIComponent(values.risparmio_25_anni_totale?.toFixed(2) || "0")}`
            
            // Environmental Impact
            + `&entry.1088637358=${encodeURIComponent(values.alberiEquivalenti?.toFixed(2) || "0")}`
            + `&entry.1299198343=${encodeURIComponent(values.utile25Anni?.toFixed(2) || "0")}`
            
            // Additional Options
            + `&entry.460881334=${encodeURIComponent(window.Kwaccum || "0")}`
            + `&entry.1335972009=${encodeURIComponent(document.getElementById('wallbox')?.checked ? "1500" : "0")}`
            + `&entry.1356805433=${encodeURIComponent(ottimizzatori || "0")}`
            + `&entry.929000443=${encodeURIComponent(backup || "0")}`
            + `&entry.25120544=${encodeURIComponent(document.getElementById('piccioni')?.checked ? "320" : "0")}`
            + `&entry.1949265544=${encodeURIComponent(document.getElementById('linea-vita')?.checked ? "2200" : "0")}`
                    
            // Efficiency Options
            + `&entry.1764548391=${encodeURIComponent(getEfficiencyOptions())}`
            + `&entry.262233617=${encodeURIComponent(rep_file)}`
            
            // Data for Charts
            + `&entry.616870084=${encodeURIComponent(formatProductionData())}`
            + `&entry.1028386922=${encodeURIComponent(formatSavingsData())}`
            + `&entry.1674486922=${encodeURIComponent(communityParticipation)}`
            + `&entry.1564770763=${encodeURIComponent(codArea)}`
            
            // Cost and Performance
            + `&entry.698925198=${encodeURIComponent(costResult)}`
            + `&entry.68661976=${encodeURIComponent(detrazioneValue)}`
            + `&entry.1730771752=${encodeURIComponent(values.negativeValuesCount || "0")}`
            + `&entry.319440111=${encodeURIComponent(values.percentualeRisparmioEnergetico?.toFixed(2) || "0")}`
            
            + `&submit=Submit`;
        
        // Log the report ID for verification
        console.log('Generated Report ID:', rep_file);
        
        // Make the POST request to Google Forms
        fetch(formUrl, {
            method: 'POST',
            mode: 'no-cors'
        }).then(response => {
            // Hide spinner
            document.getElementById('spinnerOverlay').style.display = 'none';
            
            // Show success modal
            document.getElementById('successModal').style.display = 'block';
            
            // Reset form after successful submission
            contactForm.reset();
        }).catch(error => {
            // Hide spinner
            document.getElementById('spinnerOverlay').style.display = 'none';
            console.error('Error submitting the form:', error);
            
            // Show failure modal
            document.getElementById('failureModal').style.display = 'block';
        });
    });
}

// Close modals when clicking the close button or outside
document.querySelectorAll('.close-modal, .modal-close').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    });
});

function handleAddressSelect(place) {
    if (place && place.geometry) {
        const address = place.formatted_address || document.getElementById('address').value;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        // Save to localStorage
        localStorage.setItem("address", address);
        localStorage.setItem("latitude", lat.toString());
        localStorage.setItem("longitude", lng.toString());
        
        console.log("Saved address to localStorage:", {
            address: address,
            latitude: lat,
            longitude: lng
        });
        
        // Show the next button
        document.getElementById('step1Next').style.display = 'block';
    }
}

// Add these helper functions for report ID generation
function getCurrentTimestamp() {
    return new Date().toISOString();
}

function generateReportID(firstName, lastName, timestamp) {
    const date = new Date(timestamp);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const formattedTime = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    return `RES-${firstName.substring(0, 2).toUpperCase()}${lastName.substring(0, 2).toUpperCase()}-${formattedDate}-${formattedTime}`;
}

// Function to get selected efficiency options
function getEfficiencyOptions() {
    let options = [];
    if (document.getElementById('pompa-di-calore')?.checked) options.push('Pompa di Calore');
    if (document.getElementById('infissi')?.checked) options.push('Infissi');
    if (document.getElementById('climatizzazione')?.checked) options.push('Climatizzazione');
    return options.length > 0 ? options.join(', ') : 'Nessuna opzione selezionata';
    
}

// Form validation function
function validateForm() {
    let isValid = true;

    
    // Validate email
    const email = document.getElementById('email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.value.trim()) {
        document.getElementById('email-error').textContent = 'L\'email è obbligatoria';
        isValid = false;
    } else if (!emailRegex.test(email.value)) {
        document.getElementById('email-error').textContent = 'Inserisci un indirizzo email valido';
        isValid = false;
    }
    
    // Validate phone
    const phone = document.getElementById('phone');
    const phoneRegex = /^[0-9+\s]{8,15}$/;
    if (!phone.value.trim()) {
        document.getElementById('phone-error').textContent = 'Il numero di telefono è obbligatorio';
        isValid = false;
    } else if (!phoneRegex.test(phone.value)) {
        document.getElementById('phone-error').textContent = 'Inserisci un numero di telefono valido';
        isValid = false;
    }
    
    // Validate privacy consent
    const privacyConsent = document.getElementById('privacy-consent');
    if (!privacyConsent.checked) {
        document.getElementById('privacy-error').textContent = 'Devi accettare la Privacy Policy';
        isValid = false;
    }
    
    return isValid;
}


// Function to set up tooltips
function setupTooltips() {
    document.querySelectorAll('.question-button').forEach(btn => {
        // Skip if tooltip is already set up
        if (btn.dataset.tooltipSetup) return;
        
        btn.dataset.tooltipSetup = 'true';
        
        const tip = document.createElement('div');
        tip.className = 'fixed-tooltip';
        tip.innerHTML = btn.dataset.tooltip || ""; // Support HTML in tooltips
        document.body.appendChild(tip);
        
        btn.addEventListener('mouseenter', e => {
            const r = btn.getBoundingClientRect();
            tip.style.top = (r.bottom + 6) + 'px';
            tip.style.left = (r.left + r.width/2 - tip.offsetWidth/2) + 'px';
            tip.style.opacity = 1;
        });
        
        btn.addEventListener('mouseleave', () => {
            tip.style.opacity = 0;
        });
    });
}


// Add this to your existing JavaScript
document.addEventListener("DOMContentLoaded", function() {
    // Hide all steps except the first one on page load
    const allSteps = document.querySelectorAll('.section-step');
    allSteps.forEach(function(step, index) {
        if (index !== 0) {
            step.style.display = 'none';
        }
    });

    // Add FLIP animation code
    const container = document.getElementById("buttonsContainer");
    
    if (container) {
        const svgEl = document.getElementById("svgImage");
        const DURATION = 400;
        
        // Save original order when buttons are initialized
        let originalOrder = [];
        setTimeout(() => {
            if (container) {
                originalOrder = Array.from(container.children)
                    .filter(el => el.id)
                    .map(el => el.id);
                
                if (svgEl) {
                    svgEl.style.top = "calc(50% - 5px)";
                }
            }
        }, 500);  // Give time for buttons to be created
        
        // Add runFLIP function to window object
        window.runFLIP = function() {
            if (!container) return;
            
            const optBtn = document.getElementById("btnOpt");
            if (!optBtn) return;
            
            const svgEl = document.getElementById("svgImage");
            if (!svgEl) return;
            
            const powerBtns = Array.from(container.querySelectorAll(".power-btn"));
            const activePower = powerBtns.find(b => b.classList.contains("active"));
            const optimActive = optBtn.classList.contains("active");
            const elems = Array.from(container.children).filter(el => el.tagName !== 'SVG');
            
            const firstRects = elems.map(el => el.getBoundingClientRect());
            
            if (!(optimActive && activePower)) {
                elems.forEach(el => {
                    el.style.transform = '';
                    el.style.transition = '';
                });
                svgEl.style.transform = 'translate(-50%, -50%)';
                svgEl.style.opacity = '0';
                return;
            }
            
            container.insertBefore(activePower, optBtn);
            
            const lastRects = elems.map(el => el.getBoundingClientRect());
            elems.forEach((el, i) => {
                const dx = firstRects[i].left - lastRects[i].left;
                el.style.transform = `translateX(${dx}px)`;
            });
            
            // Force reflow
            void container.offsetHeight;
            
            elems.forEach(el => {
                el.style.transition = `transform ${DURATION}ms ease`;
                el.style.transform = '';
            });
            
            const powRect = activePower.getBoundingClientRect();
            const contRect = container.getBoundingClientRect();
            const startX = powRect.left - contRect.left;
            const finalX = startX + powRect.width - 4;
            
            svgEl.style.transition = '';
            svgEl.style.left = `${startX}px`;
            svgEl.style.transform = 'translateX(0)';
            svgEl.style.opacity = "0";
            
            setTimeout(() => {
                svgEl.style.transition = 'transform 0.4s ease, opacity 0.3s ease';
                svgEl.style.transform = `translateX(${finalX - startX}px)`;
                svgEl.style.opacity = '1';
            }, DURATION);
            
            setTimeout(() => {
                elems.forEach(el => el.style.transition = '');
            }, DURATION + 50);
        };
        
        // Add resetOrder function to window object
        window.resetOrder = function() {
            if (!container || !originalOrder.length) return;
            
            originalOrder.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    container.appendChild(el);
                    el.style.transform = '';
                    el.style.transition = '';
                }
            });
        };
        
        // Add tooltip handling
        setupTooltips();
    }
    

    
    // Add CSS to prevent scrolling to hidden sections
    const style = document.createElement('style');
    style.textContent = `
        .section-step {
            position: relative;
            min-height: 100vh;
            width: 100%;
            overflow: hidden;
        }
        
        .section-step[style*="display: none"] {
            position: absolute;
            top: -9999px;
            left: -9999px;
            height: 0;
            overflow: hidden;
            z-index: -1;
            visibility: hidden;
        }
        
        body {
            overflow-x: hidden;
        }
    `;
    document.head.appendChild(style);
    
    // Override any existing navigation functions to properly manage step visibility
    window.goToStep2 = function() {
        if (!localStorage.getItem("address")) {
            showError('Seleziona un indirizzo valido prima di procedere.');
            return;
        }
        
        hideAllSteps();
        document.getElementById('section-step2').style.display = 'block';
        window.scrollTo(0, 0);
        
        // Update the address display
        const addressElement = document.getElementById('selected-address');
        if (addressElement) {
            addressElement.textContent = localStorage.getItem('address') || "--";
        }
    };
    
    window.goToStep3 = function() {
        console.log("Entering Step 3");
        
        hideAllSteps();
        document.getElementById('section-step3').style.display = 'block';
        window.scrollTo(0, 0);
        
        // Reset user selection tracking
        userSelectedConsumo = false;
        userSelectedPrevalenza = false;
        userSelectedDetrazione = false;
        userSelectedSuperficie = false;
        
        // Pre-select Prima Casa by default
        const primaCasa = document.getElementById('primo-casa');
        if (primaCasa) {
            primaCasa.checked = true;
            userSelectedDetrazione = true; // Mark as selected by default
            console.log("Prima Casa pre-selected");
        }
        
        // Set up all button event listeners for Step 3
        setupStep3EventListeners();
        
        // Check initial state
        checkStep3Required();
    };
    
    window.goToStep4 = async function() {
       
        hideAllSteps();
        document.getElementById('section-step4').style.display = 'block';
        window.scrollTo(0, 0);
        
        // Save all Step 3 variables
        saveStep3Variables();
        
        // Get area value
        const area = parseFloat(localStorage.getItem("area") || "0");
        
        // Set night = prevalenza
        night = prevalenzaValue;
        
        // Calculate potenza based on area
        const calculatedPotenza = calculatePotenza(area);
        
        // Set global potenza variable
        if (calculatedPotenza) {
            potenza = parseFloat(calculatedPotenza);
            
            // Calculate panel count
            panelCount = pan[calculatedPotenza] || 0;
            
            // Calculate basecost
            basecost = calculateDefaultBatteryCost(night, calculatedPotenza);
            
            console.log("Initial calculations:", {
                area: area + "m²",
                calculatedPotenza: calculatedPotenza + " kWp",
                panelCount: panelCount + " panels", 
                night: night,
                basecost: basecost
            });

            // Fetch PVWatts data
            const latitude = parseFloat(localStorage.getItem("latitude"));
            const longitude = parseFloat(localStorage.getItem("longitude"));
            const apiSuccess = await fetchPVWattsData(latitude, longitude, azimuth, inclinazione);
            
            if (apiSuccess) {
                updateProduzioneAnnuiTotali(potenza);
                
                // Run our new comprehensive calculations
                calculateCompleteResults();
            } else {
                console.error("Failed to fetch PVWatts data. Proceeding without production data.");
            }
            
            // Update the UI with relevant potenza buttons
            updatePotenzaButtons(calculatedPotenza);
            
            // Update battery options based on potenza
            updateBatteryOptions(calculatedPotenza);
            
            // Initialize accumulo display to 0
            updateAccumuloDisplay(0);
            
            // Update moduli count display
            updateModuliCount(potenza);
            
            // Initialize total cost
            updateTotalCost();
        }
        
        // Fetch PVWatts data
        const latitude = parseFloat(localStorage.getItem("latitude"));
        const longitude = parseFloat(localStorage.getItem("longitude"));
        const apiSuccess = await fetchPVWattsData(latitude, longitude, azimuth, inclinazione);
        
        if (apiSuccess) {
            updateProduzioneAnnuiTotali(potenza);
        } else {
            console.error("Failed to fetch PVWatts data. Proceeding without production data.");
        }
        
        // Log comprehensive data before moving to Step 4  
        console.log("COMPLETE DATA SUMMARY FOR STEP 3:", {
            // Step 1 & 2 data
            address: localStorage.getItem("address"),
            area: area + " m²",
            latitude: localStorage.getItem("latitude"),
            longitude: localStorage.getItem("longitude"),
            
            // Step 3 data
            consumo: consumoSlider + " €",
            prevalenza: prevalenzaValue + " (" + getPrevalenzaLabel(prevalenzaValue) + ")",
            detrazione: detrazione + "% (" + (detrazione === 36 ? 'Prima Casa' : 'Seconda Casa') + ")",
            superficie: getSuperficieLabel(inclinazione, azimuth),
            inclinazione: inclinazione + "°",
            azimuth: azimuth + "°",
            pompa,
            infissi,
            climatizzazione,
            selectionStatus: {
                userSelectedConsumo,
                userSelectedPrevalenza,
                userSelectedDetrazione,
                userSelectedSuperficie
            }
        });
    };
    
    window.goToStep5 = function() {
        hideAllSteps();
        document.getElementById('section-step5').style.display = 'block';
        window.scrollTo(0, 0);
        
        // Any initialization for step 5
    };
    
    // Helper function to hide all steps
    function hideAllSteps() {
        const steps = document.querySelectorAll('.section-step');
        steps.forEach(step => {
            step.style.display = 'none';
        });
    }
});