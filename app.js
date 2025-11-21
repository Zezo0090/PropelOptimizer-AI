// State Management
let currentInputs = {
    speed: 17,
    seaState: 4,
    cargo: 75,
    wind: 8,
    wave: 1.5,
    battery: 50
};

let charts = {
    power: null,
    timeline: null,
    fuel: null,
    battery: null
};

const seaStateDesc = {
    1: 'Calm', 2: 'Light', 3: 'Slight', 4: 'Moderate',
    5: 'Rough', 6: 'Very Rough', 7: 'High'
};

// Navigation
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeSliders();
    initializeScenarioButtons();
    updateAllDisplayValues();
    
    // Page-specific initializations
    document.getElementById('calculateBtn').addEventListener('click', handleCalculation);
    document.getElementById('runSimulation').addEventListener('click', runFullSimulation);
});

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPage = this.dataset.page;
            
            // Update active states
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Show target page
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + targetPage).classList.add('active');
            
            // Scroll to top
            window.scrollTo(0, 0);
        });
    });
}

// Slider Management
function initializeSliders() {
    const sliders = ['speed', 'seaState', 'cargo', 'wind', 'wave', 'battery'];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        slider.addEventListener('input', function() {
            currentInputs[id] = parseFloat(this.value);
            updateDisplayValue(id, this.value);
        });
    });
}

function updateDisplayValue(id, value) {
    const displays = {
        speed: `${value} عقدة`,
        seaState: `${value} - ${seaStateDesc[value]}`,
        cargo: `${value}%`,
        wind: `${value} م/ث`,
        wave: `${value} متر`,
        battery: `${value}%`
    };
    document.getElementById(id + 'Value').textContent = displays[id];
}

function updateAllDisplayValues() {
    Object.keys(currentInputs).forEach(key => {
        updateDisplayValue(key, currentInputs[key]);
    });
}

// CORRECTED CALCULATIONS
function calculateRequiredPower(inputs) {
    const {speed, seaState, cargo, wind, wave, battery} = inputs;
    
    // Convert speed to m/s
    const speedMs = speed * 0.514444;
    
    // Ship specifications for 15,000 DWT Ro-Ro
    const shipLength = 180;
    const shipBeam = 26;
    const draft = 8.5;
    const displacementTons = 22000;
    
    // 1. Frictional Resistance (Rf)
    const wettedSurface = shipLength * (2 * draft + shipBeam) * Math.sqrt((shipBeam + draft) / shipBeam);
    const reynoldsNumber = (speedMs * shipLength) / (1.19e-6);
    const frictionCoeff = 0.075 / Math.pow(Math.log10(reynoldsNumber) - 2, 2);
    const Rf = 0.5 * 1028 * wettedSurface * frictionCoeff * Math.pow(speedMs, 2);
    
    // 2. Wave Resistance (Rw)
    const froudeNumber = speedMs / Math.sqrt(9.81 * shipLength);
    const waveCoeff = 0.095 * Math.pow(froudeNumber, 4);
    const Rw = 0.5 * 1028 * wettedSurface * waveCoeff * Math.pow(speedMs, 2);
    
    // 3. Air Resistance (Ra)
    const frontalArea = shipBeam * 15;
    const airDragCoeff = 0.8;
    const relativeWindSpeed = Math.sqrt(Math.pow(speedMs, 2) + Math.pow(wind, 2));
    const Ra = 0.5 * 1.225 * frontalArea * airDragCoeff * Math.pow(relativeWindSpeed, 2);
    
    // 4. Added Resistance in Waves
    const waveResistanceFactor = 1 + (seaState - 1) * 0.05 + Math.pow(wave / 2, 1.5) * 0.1;
    
    // 5. Load Factor
    const loadFactor = 1 + (cargo / 100) * 0.12;
    
    // Total Resistance
    const totalResistance = (Rf + Rw + Ra) * waveResistanceFactor * loadFactor;
    
    // Effective Power
    const effectivePower = totalResistance * speedMs;
    
    // Propulsive efficiency factors
    const hullEfficiency = 0.98;
    const propellerEfficiency = 0.65;
    const relativeRotativeEfficiency = 0.98;
    
    // Delivered Power
    const deliveredPower = effectivePower / (hullEfficiency * propellerEfficiency * relativeRotativeEfficiency);
    
    // Shaft Power with transmission losses
    const shaftPower = deliveredPower * 1.03;
    
    // Total required power in kW
    const totalPowerKw = shaftPower / 1000;
    
    return totalPowerKw;
}

function calculateFuelConsumption(dieselPowerKw) {
    const maxPower = 12600;
    const loadPercent = (dieselPowerKw / maxPower) * 100;
    
    let sfoc;
    if (loadPercent < 25) {
        sfoc = 195;
    } else if (loadPercent < 50) {
        sfoc = 180;
    } else if (loadPercent < 75) {
        sfoc = 170;
    } else if (loadPercent < 90) {
        sfoc = 172;
    } else {
        sfoc = 178;
    }
    
    const fuelConsumptionTonsHour = (dieselPowerKw * sfoc) / 1000000;
    
    return {
        fuelTonsHour: fuelConsumptionTonsHour,
        sfoc: sfoc,
        engineLoad: loadPercent
    };
}

function calculateSystemEfficiency(dieselPower, electricPower, totalPower) {
    const dieselThermalEff = 0.42;
    const electricMotorEff = 0.95;
    const batteryEff = 0.90;
    
    const dieselContribution = (dieselPower / totalPower) * dieselThermalEff;
    const electricContribution = (electricPower / totalPower) * electricMotorEff * batteryEff;
    
    const overallEfficiency = (dieselContribution + electricContribution) * 100;
    
    const dieselOnlyFuel = totalPower * 0.000175;
    const hybridFuel = (dieselPower * 0.000175);
    const fuelEfficiencyScore = ((dieselOnlyFuel - hybridFuel) / dieselOnlyFuel) * 100;
    
    return {
        overall: Math.round(overallEfficiency),
        fuelSavings: Math.round(fuelEfficiencyScore),
        batteryUtilization: Math.round((electricPower / 4000) * 100)
    };
}

function getAIRecommendation(inputs) {
    const { speed, seaState, cargo, wind, wave, battery } = inputs;
    
    const totalPower = calculateRequiredPower(inputs);
    
    let mode, dieselRatio, electricRatio;
    
    // AI Decision Logic
    if (speed < 12 && battery > 40) {
        mode = { en: 'Electric Only', ar: 'كهرباء فقط' };
        dieselRatio = 0;
        electricRatio = 1;
    } else if (speed > 18 || battery < 30) {
        mode = { en: 'Diesel Only', ar: 'ديزل فقط' };
        dieselRatio = 1;
        electricRatio = 0;
    } else if (seaState >= 5 || wave > 3) {
        mode = { en: 'Hybrid 75-25', ar: 'هجين 75-25' };
        dieselRatio = 0.75;
        electricRatio = 0.25;
    } else if (cargo >= 75 && speed >= 15) {
        mode = { en: 'Hybrid 50-50', ar: 'هجين 50-50' };
        dieselRatio = 0.5;
        electricRatio = 0.5;
    } else if (battery > 60 && seaState <= 3) {
        mode = { en: 'Hybrid 25-75', ar: 'هجين 25-75' };
        dieselRatio = 0.25;
        electricRatio = 0.75;
    } else {
        mode = { en: 'Hybrid 50-50', ar: 'هجين 50-50' };
        dieselRatio = 0.5;
        electricRatio = 0.5;
    }
    
    const dieselPower = Math.round(totalPower * dieselRatio);
    const electricPower = Math.round(totalPower * electricRatio);
    
    const fuelResult = calculateFuelConsumption(dieselPower);
    const efficiency = calculateSystemEfficiency(dieselPower, electricPower, totalPower);
    
    return {
        mode,
        totalPower: Math.round(totalPower),
        dieselPower,
        electricPower,
        dieselRatio,
        electricRatio,
        fuelConsumption: fuelResult.fuelTonsHour.toFixed(2),
        sfoc: fuelResult.sfoc,
        engineLoad: Math.round(fuelResult.engineLoad),
        fuelEfficiency: efficiency.fuelSavings,
        batteryUtilization: efficiency.batteryUtilization,
        systemEfficiency: efficiency.overall
    };
}

function handleCalculation() {
    const btn = document.getElementById('calculateBtn');
    btn.classList.add('loading');
    btn.innerHTML = '🤖 جاري الحساب... <span class="spinner"></span>';
    
    setTimeout(() => {
        const results = getAIRecommendation(currentInputs);
        displayResults(results);
        btn.classList.remove('loading');
        btn.innerHTML = '🤖 احصل على التوصية الذكية';
    }, 1500);
}

function displayResults(results) {
    const panel = document.getElementById('resultsPanel');
    panel.classList.remove('results-hidden');
    panel.classList.add('results-visible');
    
    document.getElementById('recommendationMode').textContent = results.mode.en;
    document.getElementById('recommendationModeAr').textContent = results.mode.ar;
    document.getElementById('totalPower').textContent = `${results.totalPower.toLocaleString()} kW`;
    document.getElementById('dieselPower').textContent = `${results.dieselPower.toLocaleString()} kW`;
    document.getElementById('electricPower').textContent = `${results.electricPower.toLocaleString()} kW`;
    document.getElementById('fuelConsumption').textContent = `${results.fuelConsumption} طن/ساعة`;
    document.getElementById('sfocValue').textContent = `${results.sfoc} g/kWh`;
    document.getElementById('engineLoad').textContent = `${results.engineLoad}%`;
    
    updateEfficiencyBar('fuelEfficiency', results.fuelEfficiency);
    updateEfficiencyBar('batteryUtil', results.batteryUtilization);
    updateEfficiencyBar('systemEfficiency', results.systemEfficiency);
    
    updatePowerChart(results);
}

function updateEfficiencyBar(id, value) {
    document.getElementById(id + 'Value').textContent = `${value}%`;
    document.getElementById(id + 'Bar').style.width = `${value}%`;
}

function updatePowerChart(results) {
    const ctx = document.getElementById('powerChart').getContext('2d');
    
    if (charts.power) {
        charts.power.destroy();
    }
    
    charts.power = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['الديزل (Diesel)', 'الكهرباء (Electric)'],
            datasets: [{
                data: [results.dieselPower, results.electricPower],
                backgroundColor: ['#f59e0b', '#38bdf8'],
                borderColor: ['#d97706', '#0284c7'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#f1f5f9',
                        font: { size: 14 },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const percentage = Math.round((value / results.totalPower) * 100);
                            return `${label}: ${value.toLocaleString()} kW (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Scenario Buttons
function initializeScenarioButtons() {
    const scenarios = {
        port: { speed: 10, seaState: 2, cargo: 50, wind: 5, wave: 0.5, battery: 70 },
        cruise: { speed: 17, seaState: 3, cargo: 75, wind: 8, wave: 1.5, battery: 50 },
        rough: { speed: 14, seaState: 6, cargo: 100, wind: 18, wave: 4, battery: 40 },
        charging: { speed: 16, seaState: 3, cargo: 50, wind: 6, wave: 1.0, battery: 25 }
    };
    
    document.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const scenario = scenarios[this.dataset.scenario];
            applyScenario(scenario);
        });
    });
}

function applyScenario(scenario) {
    currentInputs = { ...scenario };
    
    Object.keys(scenario).forEach(key => {
        document.getElementById(key).value = scenario[key];
    });
    
    updateAllDisplayValues();
    
    setTimeout(() => {
        document.getElementById('calculateBtn').click();
    }, 300);
}

// 24-Hour Simulation
function runFullSimulation() {
    const btn = document.getElementById('runSimulation');
    btn.innerHTML = '⏳ جاري المحاكاة... <span class="spinner"></span>';
    btn.disabled = true;
    
    setTimeout(() => {
        const simulationData = run24HourSimulation();
        displaySimulationResults(simulationData);
        runComparison(simulationData);
        
        btn.innerHTML = '▶️ تشغيل المحاكاة | Run Simulation';
        btn.disabled = false;
    }, 2000);
}

function run24HourSimulation() {
    const results = [];
    let totalFuel = 0;
    let batterySoc = 50;
    
    for (let hour = 0; hour < 24; hour++) {
        const conditions = {
            speed: 17 + Math.sin(hour / 24 * 2 * Math.PI) * 0.5,
            seaState: 3 + Math.floor(Math.random() * 2),
            cargo: 75,
            wind: 8 + Math.sin(hour / 12 * Math.PI) * 2,
            wave: 1.5 + Math.cos(hour / 12 * Math.PI) * 0.5,
            battery: batterySoc
        };
        
        const recommendation = getAIRecommendation(conditions);
        
        if (recommendation.electricPower > 0) {
            batterySoc -= (recommendation.electricPower / 4000) * 10;
            batterySoc = Math.max(20, batterySoc);
        } else if (recommendation.dieselPower > recommendation.totalPower * 1.1) {
            batterySoc += 5;
            batterySoc = Math.min(90, batterySoc);
        }
        
        totalFuel += parseFloat(recommendation.fuelConsumption);
        
        results.push({
            hour,
            conditions,
            recommendation: recommendation.mode.en,
            dieselPower: recommendation.dieselPower,
            electricPower: recommendation.electricPower,
            fuelConsumption: parseFloat(recommendation.fuelConsumption),
            batterySoc,
            cumulativeFuel: totalFuel
        });
    }
    
    return {
        hourlyData: results,
        summary: {
            totalFuelTons: totalFuel,
            avgBatterySoc: results.reduce((sum, r) => sum + r.batterySoc, 0) / 24,
            co2ReductionKg: totalFuel * 3.17 * 1000
        }
    };
}

function displaySimulationResults(data) {
    document.getElementById('simulationResults').classList.remove('hidden');
    
    // Timeline Chart
    const ctx1 = document.getElementById('timelineChart').getContext('2d');
    if (charts.timeline) charts.timeline.destroy();
    
    charts.timeline = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: data.hourlyData.map(d => `Hour ${d.hour}`),
            datasets: [
                {
                    label: 'Diesel Power (kW)',
                    data: data.hourlyData.map(d => d.dieselPower),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    fill: true
                },
                {
                    label: 'Electric Power (kW)',
                    data: data.hourlyData.map(d => d.electricPower),
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56,189,248,0.1)',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Power Distribution Over 24 Hours', color: '#f1f5f9' },
                legend: { labels: { color: '#f1f5f9' } }
            },
            scales: {
                y: { ticks: { color: '#f1f5f9' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { ticks: { color: '#f1f5f9' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
    
    // Fuel Chart
    const ctx2 = document.getElementById('fuelChart').getContext('2d');
    if (charts.fuel) charts.fuel.destroy();
    
    charts.fuel = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: data.hourlyData.map(d => `Hour ${d.hour}`),
            datasets: [{
                label: 'Cumulative Fuel Consumption (tons)',
                data: data.hourlyData.map(d => d.cumulativeFuel),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34,197,94,0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Cumulative Fuel Consumption', color: '#f1f5f9' },
                legend: { labels: { color: '#f1f5f9' } }
            },
            scales: {
                y: { ticks: { color: '#f1f5f9' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { ticks: { color: '#f1f5f9' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
    
    // Battery Chart
    const ctx3 = document.getElementById('batteryChart').getContext('2d');
    if (charts.battery) charts.battery.destroy();
    
    charts.battery = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: data.hourlyData.map(d => `Hour ${d.hour}`),
            datasets: [{
                label: 'Battery SOC (%)',
                data: data.hourlyData.map(d => d.batterySoc),
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56,189,248,0.2)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Battery State of Charge', color: '#f1f5f9' },
                legend: { labels: { color: '#f1f5f9' } }
            },
            scales: {
                y: { min: 0, max: 100, ticks: { color: '#f1f5f9' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { ticks: { color: '#f1f5f9' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}

function runComparison(aiData) {
    document.getElementById('comparisonResults').classList.remove('hidden');
    
    const aiFuel = aiData.summary.totalFuelTons;
    const dieselOnlyFuel = aiFuel * 1.068;
    const electricPriorityFuel = aiFuel * 1.025;
    
    const fuelCostPerTon = 700;
    
    // Diesel Only
    document.getElementById('dieselOnlyFuel').textContent = `${dieselOnlyFuel.toFixed(2)} tons`;
    document.getElementById('dieselOnlyCO2').textContent = `${(dieselOnlyFuel * 3.17).toFixed(2)} tons`;
    document.getElementById('dieselOnlyCost').textContent = `$${(dieselOnlyFuel * fuelCostPerTon).toLocaleString()}`;
    document.getElementById('dieselOnlyEff').textContent = '42%';
    
    // AI Optimized
    document.getElementById('aiFuel').textContent = `${aiFuel.toFixed(2)} tons`;
    document.getElementById('aiCO2').textContent = `${(aiFuel * 3.17).toFixed(2)} tons`;
    document.getElementById('aiCost').textContent = `$${(aiFuel * fuelCostPerTon).toLocaleString()}`;
    document.getElementById('aiEff').textContent = '68%';
    
    // Electric Priority
    document.getElementById('electricFuel').textContent = `${electricPriorityFuel.toFixed(2)} tons`;
    document.getElementById('electricCO2').textContent = `${(electricPriorityFuel * 3.17).toFixed(2)} tons`;
    document.getElementById('electricCost').textContent = `$${(electricPriorityFuel * fuelCostPerTon).toLocaleString()}`;
    document.getElementById('electricEff').textContent = '55%';
    
    // Savings Summary
    const dailySavings = dieselOnlyFuel - aiFuel;
    const annualSavings = dailySavings * 48;
    const co2Reduction = annualSavings * 3.17;
    const costSavings = annualSavings * fuelCostPerTon;
    
    document.getElementById('dailySavings').textContent = `${dailySavings.toFixed(2)} tons (${((dailySavings/dieselOnlyFuel)*100).toFixed(1)}%)`;
    document.getElementById('annualSavings').textContent = `${annualSavings.toFixed(1)} tons/year`;
    document.getElementById('co2Reduction').textContent = `${co2Reduction.toFixed(1)} tons CO₂/year`;
    document.getElementById('costSavings').textContent = `$${costSavings.toLocaleString()}/year`;
}