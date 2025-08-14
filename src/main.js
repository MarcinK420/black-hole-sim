// Black Hole Simulation
document.addEventListener('DOMContentLoaded', () => {
    // Get the canvas element
    const canvas = document.getElementById('view');
    // Get the rendering context with options for alpha compositing and better performance
    const ctx = canvas.getContext('2d', { 
        alpha: false,             // No transparency needed for black hole sim background
        desynchronized: true,     // Potential performance boost on supported browsers
        willReadFrequently: false // We're not reading pixel data
    });
    
    // Get control elements
    const massSlider = document.getElementById('mass');
    const rotationSlider = document.getElementById('rotation');
    const zoomSlider = document.getElementById('zoom');
    const timeScaleSlider = document.getElementById('timeScale');
    const dragSlider = document.getElementById('drag');
    const particlesSlider = document.getElementById('particles');
    const trailsCheckbox = document.getElementById('trails');
    const trailLengthSlider = document.getElementById('trailLength');
    const seedInput = document.getElementById('seed');
    const actualMassInput = document.getElementById('actual-mass');
    const schwarzschildRadiusInput = document.getElementById('schwarzschild-radius');
    const resetButton = document.getElementById('reset');
    const startPauseButton = document.getElementById('start-pause');
    const advancedToggleButton = document.getElementById('advanced-toggle');
    
    // Get device pixel ratio
    function getDevicePixelRatio() {
        return window.devicePixelRatio || 1;
    }
    
    // Set canvas dimensions with proper DPR handling for high-DPI displays
    function resizeCanvas() {
        const container = canvas.parentElement;
        const dpr = getDevicePixelRatio();
        
        // Get the CSS dimensions (logical size)
        const displayWidth = container.clientWidth;
        const displayHeight = container.clientHeight;
        
        // Check if the canvas size actually changed to avoid unnecessary resets
        const sizeChanged = 
            canvas.displayWidth !== displayWidth || 
            canvas.displayHeight !== displayHeight;
            
        if (sizeChanged) {
            // Save the current transform state
            const prevTransform = ctx.getTransform();
            
            // Reset the canvas size
            canvas.width = Math.floor(displayWidth * dpr);
            canvas.height = Math.floor(displayHeight * dpr);
            
            // Set the canvas size in CSS pixels (for layout)
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
            
            // Reset and apply the device scale factor
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            ctx.scale(dpr, dpr);
            
            // Store the display dimensions for use in drawing
            canvas.displayWidth = displayWidth;
            canvas.displayHeight = displayHeight;
            
            if (DEBUG_MODE) {
                console.log(`Canvas resized: ${displayWidth}x${displayHeight} (DPR: ${dpr})`);
            }
            
            // Redraw after resize
            draw();
        }
    }
    
    // Handle orientation changes specially on mobile
    function handleOrientationChange() {
        // Add a small delay to allow the browser to update dimensions
        setTimeout(resizeCanvas, 300);
    }
    
    // Initialize the canvas size
    resizeCanvas();
    
    // Respond to window resize and orientation change
    window.addEventListener('resize', debounce(resizeCanvas, 250));
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Debounce function to prevent excessive resizing
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // Handle visibility changes to prevent rendering issues
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            resizeCanvas();
        }
    });
    
    // Variables for simulation state
    let isRunning = false;
    let animationFrameId = null;
    let lastFrameTime = 0;
    let accumulatedTime = 0;
    let fps = 0;
    let frameCount = 0;
    let lastFpsUpdateTime = 0;
    
    // Debug mode (can be toggled during development)
    const DEBUG_MODE = false; // Set to true to see debug info
    
    // Simulation parameters
    let params = {
        // Basic UI controls
        mass: 50,               // Mass slider value (0-100)
        rotation: 0,            // Rotation slider value (0-100)
        zoom: 100,              // Zoom slider value (10-200)
        
        // Internal calculated values
        rotationSpeed: 0,       // Actual rotation speed in radians per second
        diskAngle: 0,           // Current angle of accretion disk
        
        // Physics constants
        G: 6.67430e-11,         // Gravitational constant (m^3 kg^-1 s^-2)
        c: 299792458,           // Speed of light (m/s)
        solarMass: 1.989e30,    // Mass of the Sun (kg)
        
        // Black hole parameters
        M: 1.0e6,               // Black hole mass in solar masses
        
        // Other simulation parameters
        timeScale: 1.0,         // Simulation time scale factor
        
        // Particle system parameters
        drag: 0.02,             // Drag coefficient (0-1)
        trails: true,           // Whether to show particle trails
        trailLength: 50,        // Length of particle trails
        seed: 12345,            // Random seed for particle generation
        particles: 500,         // Number of particles in simulation
        
        // Calculate Schwarzschild radius (rs = 2GM/c^2)
        get schwarzschildRadius() {
            // Convert solar masses to kg, calculate in meters, then convert to kilometers
            const massInKg = this.M * this.solarMass;
            const rsInMeters = (2 * this.G * massInKg) / (this.c * this.c);
            return rsInMeters / 1000; // Convert to kilometers
        },
        
        // For UI slider, we use this to map the slider value to actual mass
        get blackHoleMass() {
            // Convert UI mass value to actual solar masses
            return this.M * (this.mass / 50);
        },
        
        // Set M based on the slider value
        set blackHoleMass(value) {
            this.M = value;
            this.updateUI(); // Update UI when M changes
        },
        
        // Method to update derived parameters when base parameters change
        updateDerivedParams() {
            // Update rotation speed based on rotation slider
            this.rotationSpeed = this.rotation * 0.05;
            
            // Update actual mass based on the UI slider
            // Note: This does not update M directly - that's handled separately now
        },
        
        // Method to update UI elements based on current parameter values
        updateUI() {
            // Update the actual mass display in the advanced controls
            const actualMassInput = document.getElementById('actual-mass');
            if (actualMassInput) {
                actualMassInput.value = this.M.toLocaleString();
            }
            
            // Update the Schwarzschild radius display
            const schwarzschildRadiusInput = document.getElementById('schwarzschild-radius');
            if (schwarzschildRadiusInput) {
                schwarzschildRadiusInput.value = this.schwarzschildRadius.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
        },
        
        // Method to load parameters from localStorage if available
        loadFromStorage() {
            try {
                const storedParams = localStorage.getItem('blackHoleParams');
                if (storedParams) {
                    const parsedParams = JSON.parse(storedParams);
                    
                    // Update only the serializable properties
                    this.mass = parsedParams.mass ?? this.mass;
                    this.rotation = parsedParams.rotation ?? this.rotation;
                    this.zoom = parsedParams.zoom ?? this.zoom;
                    this.M = parsedParams.M ?? this.M;
                    this.timeScale = parsedParams.timeScale ?? this.timeScale;
                    this.drag = parsedParams.drag ?? this.drag;
                    this.trails = parsedParams.trails ?? this.trails;
                    this.trailLength = parsedParams.trailLength ?? this.trailLength;
                    this.seed = parsedParams.seed ?? this.seed;
                    this.particles = parsedParams.particles ?? this.particles;
                    
                    // Update derived parameters
                    this.updateDerivedParams();
                    return true;
                }
            } catch (e) {
                console.error('Error loading parameters from storage:', e);
            }
            return false;
        },
        
        // Method to save parameters to localStorage
        saveToStorage() {
            try {
                const paramsToSave = {
                    mass: this.mass,
                    rotation: this.rotation,
                    zoom: this.zoom,
                    M: this.M,
                    timeScale: this.timeScale,
                    drag: this.drag,
                    trails: this.trails,
                    trailLength: this.trailLength,
                    seed: this.seed,
                    particles: this.particles
                };
                localStorage.setItem('blackHoleParams', JSON.stringify(paramsToSave));
                return true;
            } catch (e) {
                console.error('Error saving parameters to storage:', e);
                return false;
            }
        }
    };
    
    // Update value displays
    function updateValueDisplays() {
        document.querySelectorAll('.control-group').forEach(group => {
            const input = group.querySelector('input');
            const display = group.querySelector('.value-display');
            
            if (input && display && input.type !== 'checkbox' && input.type !== 'number') {
                let value = input.value;
                
                // Format different types of values
                switch(input.id) {
                    case 'zoom':
                        value += '%';
                        break;
                    case 'timeScale':
                        value += 'x';
                        break;
                    case 'drag':
                    case 'timeScale':
                        // For floating point values, show 2 decimal places
                        value = parseFloat(value).toFixed(2);
                        break;
                    case 'mass':
                        // Show equivalent mass in solar masses
                        // const equivalentMass = (params.M * (parseInt(value) / 50)).toExponential(2);
                        // value = `${value} (${equivalentMass} M☉)`;
                        break;
                }
                
                display.textContent = value;
            }
        });
        
        // Update seed input if it exists
        if (seedInput) {
            seedInput.value = params.seed;
        }
        
        // Update trails checkbox if it exists
        if (trailsCheckbox) {
            trailsCheckbox.checked = params.trails;
        }
    }
    
    // Add event listeners to basic controls
    massSlider.addEventListener('input', () => {
        params.mass = parseInt(massSlider.value);
        
        // When mass slider changes, also update the actual mass
        params.M = params.blackHoleMass;
        
        // Update UI displays
        updateValueDisplays();
        params.updateUI();
        draw();
    });
    
    rotationSlider.addEventListener('input', () => {
        params.rotation = parseInt(rotationSlider.value);
        params.updateDerivedParams(); // Update rotation speed
        updateValueDisplays();
        draw();
    });
    
    zoomSlider.addEventListener('input', () => {
        params.zoom = parseInt(zoomSlider.value);
        updateValueDisplays();
        draw();
    });
    
    // Add event listeners to advanced physics controls
    actualMassInput?.addEventListener('input', () => {
        // Parse the input value and update the black hole mass
        let newMass = parseFloat(actualMassInput.value.replace(/,/g, ''));
        
        // Validate the input
        if (isNaN(newMass) || newMass <= 0) {
            // Reset to default if invalid
            newMass = 1.0e6;
            actualMassInput.value = newMass.toLocaleString();
        }
        
        // Update the mass parameter
        params.M = newMass;
        
        // Update the UI display for Schwarzschild radius
        params.updateUI();
        
        // Update the visualization
        draw();
    });
    
    timeScaleSlider?.addEventListener('input', () => {
        params.timeScale = parseFloat(timeScaleSlider.value);
        updateValueDisplays();
    });
    
    dragSlider?.addEventListener('input', () => {
        params.drag = parseFloat(dragSlider.value);
        updateValueDisplays();
    });
    
    // Add event listeners to particle controls
    particlesSlider?.addEventListener('input', () => {
        params.particles = parseInt(particlesSlider.value);
        updateValueDisplays();
    });
    
    trailsCheckbox?.addEventListener('change', () => {
        params.trails = trailsCheckbox.checked;
    });
    
    trailLengthSlider?.addEventListener('input', () => {
        params.trailLength = parseInt(trailLengthSlider.value);
        updateValueDisplays();
    });
    
    seedInput?.addEventListener('change', () => {
        params.seed = parseInt(seedInput.value);
        // Regenerate particles when seed changes
        if (isRunning) {
            // If simulation is running, we might want to regenerate particles
            // This will be implemented in a future feature
        }
    });
    
    // Action buttons
    resetButton.addEventListener('click', resetSimulation);
    startPauseButton.addEventListener('click', toggleSimulation);
    
    // Toggle advanced settings visibility
    advancedToggleButton?.addEventListener('click', () => {
        const advancedSections = document.querySelectorAll('.advanced-controls');
        advancedSections.forEach(section => {
            section.classList.toggle('visible');
        });
        
        advancedToggleButton.textContent = 
            advancedToggleButton.textContent === 'Advanced' ? 'Basic' : 'Advanced';
    });
    
    // Reset simulation to default values
    function resetSimulation() {
        // Reset UI sliders
        massSlider.value = 50;
        rotationSlider.value = 0;
        zoomSlider.value = 100;
        
        // Reset all parameters to default values
        params = {
            // Basic UI controls
            mass: 50,
            rotation: 0,
            zoom: 100,
            
            // Internal calculated values
            rotationSpeed: 0,
            diskAngle: 0,
            
            // Physics constants
            G: 6.67430e-11,
            c: 299792458,
            solarMass: 1.989e30,
            
            // Black hole parameters
            M: 1.0e6,           // Reset to 1 million solar masses
            timeScale: 1.0,
            
            // Particle system parameters
            drag: 0.02,
            trails: true,
            trailLength: 50,
            seed: 12345,
            particles: 500,
            
            // Maintain the getter methods
            get schwarzschildRadius() {
                // Calculate rs = 2GM/c^2
                const massInKg = this.M * this.solarMass;
                const rsInMeters = (2 * this.G * massInKg) / (this.c * this.c);
                return rsInMeters / 1000; // Convert to kilometers
            },
            
            get blackHoleMass() {
                return this.M * (this.mass / 50);
            },
            
            set blackHoleMass(value) {
                this.M = value;
                this.updateUI();
            },
            
            updateDerivedParams() {
                this.rotationSpeed = this.rotation * 0.05;
            },
            
            updateUI() {
                const actualMassInput = document.getElementById('actual-mass');
                if (actualMassInput) {
                    actualMassInput.value = this.M.toLocaleString();
                }
                
                const schwarzschildRadiusInput = document.getElementById('schwarzschild-radius');
                if (schwarzschildRadiusInput) {
                    schwarzschildRadiusInput.value = this.schwarzschildRadius.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
            },
            
            loadFromStorage() {
                try {
                    const storedParams = localStorage.getItem('blackHoleParams');
                    if (storedParams) {
                        const parsedParams = JSON.parse(storedParams);
                        this.mass = parsedParams.mass ?? this.mass;
                        this.rotation = parsedParams.rotation ?? this.rotation;
                        this.zoom = parsedParams.zoom ?? this.zoom;
                        this.M = parsedParams.M ?? this.M;
                        this.rs = parsedParams.rs ?? this.rs;
                        this.timeScale = parsedParams.timeScale ?? this.timeScale;
                        this.drag = parsedParams.drag ?? this.drag;
                        this.trails = parsedParams.trails ?? this.trails;
                        this.trailLength = parsedParams.trailLength ?? this.trailLength;
                        this.seed = parsedParams.seed ?? this.seed;
                        this.particles = parsedParams.particles ?? this.particles;
                        this.updateDerivedParams();
                        return true;
                    }
                } catch (e) {
                    console.error('Error loading parameters from storage:', e);
                }
                return false;
            },
            
            saveToStorage() {
                try {
                    const paramsToSave = {
                        mass: this.mass,
                        rotation: this.rotation,
                        zoom: this.zoom,
                        M: this.M,
                        rs: this.rs,
                        timeScale: this.timeScale,
                        drag: this.drag,
                        trails: this.trails,
                        trailLength: this.trailLength,
                        seed: this.seed,
                        particles: this.particles
                    };
                    localStorage.setItem('blackHoleParams', JSON.stringify(paramsToSave));
                    return true;
                } catch (e) {
                    console.error('Error saving parameters to storage:', e);
                    return false;
                }
            }
        };
        
        // Reset animation timing variables
        lastFrameTime = performance.now();
        accumulatedTime = 0;
        frameCount = 0;
        
        // Remove any saved parameters
        try {
            localStorage.removeItem('blackHoleParams');
        } catch (e) {
            console.error('Error removing stored parameters:', e);
        }
        
        updateValueDisplays();
        draw();
    }
    
    // Toggle simulation running state
    function toggleSimulation() {
        isRunning = !isRunning;
        startPauseButton.textContent = isRunning ? 'Pause' : 'Start';
        
        if (isRunning) {
            // Reset time tracking when starting animation
            lastFrameTime = performance.now();
            animationFrameId = requestAnimationFrame(animate);
        } else if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
    
    // Animation loop with proper time calculations
    function animate(currentTime) {
        // Calculate delta time in seconds
        if (!lastFrameTime) lastFrameTime = currentTime;
        const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.1); // Seconds, capped at 0.1s
        lastFrameTime = currentTime;
        
        // Update FPS counter
        frameCount++;
        accumulatedTime += dt;
        
        // Update FPS once per second
        if (currentTime - lastFpsUpdateTime > 1000) {
            fps = Math.round(frameCount / accumulatedTime);
            frameCount = 0;
            accumulatedTime = 0;
            lastFpsUpdateTime = currentTime;
            // Uncomment to debug FPS: console.log(`FPS: ${fps}`);
        }
        
        // Update simulation state
        updateSimulation(dt);
        
        // Draw current state
        draw();
        
        // Continue animation loop if still running
        if (isRunning) {
            animationFrameId = requestAnimationFrame(animate);
        }
    }
    
    // Update simulation physics
    function updateSimulation(dt) {
        // Apply time scaling to dt
        const scaledDt = dt * params.timeScale;
        
        // Update rotation based on current rotation speed parameter
        params.updateDerivedParams(); // Update rotation speed from slider value
        params.diskAngle += params.rotationSpeed * scaledDt; // Increment angle based on scaled dt
        
        // Keep angle within 0-2π range to avoid floating point issues over time
        params.diskAngle = params.diskAngle % (Math.PI * 2);
        
        // Here we would update particle positions and apply physics
        // This will be implemented in a future feature when we add particles
    }
    
    // Draw the current state to the canvas
    function draw() {
        // Get the logical (CSS) display dimensions
        const displayWidth = canvas.displayWidth || canvas.width;
        const displayHeight = canvas.displayHeight || canvas.height;
        
        // Clear canvas - use displayWidth/Height for clearing
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, displayWidth, displayHeight);
        
        // Show debug stats if debug mode is enabled
        if (DEBUG_MODE) {
            ctx.font = '14px monospace';
            ctx.fillStyle = '#58a6ff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`FPS: ${fps}`, 10, 10);
            ctx.fillText(`Display: ${displayWidth}x${displayHeight}`, 10, 30);
            ctx.fillText(`Canvas: ${canvas.width}x${canvas.height}`, 10, 50);
            ctx.fillText(`DPR: ${getDevicePixelRatio()}`, 10, 70);
            ctx.fillText(`Rotation Speed: ${params.rotationSpeed.toFixed(2)} rad/s`, 10, 90);
            ctx.fillText(`Time Scale: ${params.timeScale.toFixed(1)}x`, 10, 110);
            ctx.fillText(`Black Hole Mass: ${params.M.toExponential(2)} M☉`, 10, 130);
            ctx.fillText(`Schwarzschild Radius: ${params.schwarzschildRadius.toFixed(2)} km`, 10, 150);
            ctx.fillText(`Formula: rs = 2GM/c² = ${(2 * params.G).toExponential(2)}×M/c²`, 10, 170);
            ctx.fillText(`Particles: ${params.particles}`, 10, 190);
            ctx.fillText(`Trails: ${params.trails ? 'On' : 'Off'}`, 10, 210);
        }
        
        // Calculate center and radius (use logical coordinates)
        const centerX = displayWidth / 2;
        const centerY = displayHeight / 2;
        const radius = params.mass * params.zoom / 100;
        
        // Draw a placeholder black hole (simple black circle with event horizon)
        // Event horizon
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius * 2
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(0.7, 'rgba(30, 30, 50, 0.8)');
        gradient.addColorStop(1, 'rgba(50, 50, 80, 0)');
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Black hole center
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'black';
        ctx.fill();
        
        // Add accretion disk effect if rotation is > 0
        if (params.rotation > 0) {
            const diskRadius = radius * 1.5;
            const diskThickness = radius * 0.2;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(params.diskAngle);
            
            // Draw accretion disk
            const diskGradient = ctx.createRadialGradient(
                0, 0, radius,
                0, 0, diskRadius + diskThickness
            );
            diskGradient.addColorStop(0, 'rgba(255, 160, 0, 0)');
            diskGradient.addColorStop(0.7, 'rgba(255, 120, 0, 0.7)');
            diskGradient.addColorStop(0.9, 'rgba(255, 80, 0, 0.5)');
            diskGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
            
            ctx.beginPath();
            ctx.ellipse(0, 0, diskRadius + diskThickness, (diskRadius + diskThickness) * 0.3, 0, 0, Math.PI * 2);
            ctx.fillStyle = diskGradient;
            ctx.fill();
            
            ctx.restore();
        }
    }
    
    // Add touch and mouse interaction for mobile
    let isDragging = false;
    let lastTouchX, lastTouchY;
    
    // Handle touch/mouse interactions
    function handleInteractionStart(clientX, clientY) {
        isDragging = true;
        lastTouchX = clientX;
        lastTouchY = clientY;
    }
    
    function handleInteractionMove(clientX, clientY) {
        if (!isDragging) return;
        
        // Calculate the distance from center
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Get client coordinates in CSS pixels (not affected by DPR)
        const currentX = clientX - rect.left;
        const currentY = clientY - rect.top;
        
        // Calculate distance from center (simple way to adjust rotation based on movement)
        const distFromCenter = Math.sqrt(
            Math.pow(currentX - centerX, 2) + 
            Math.pow(currentY - centerY, 2)
        );
        
        // Update rotation based on touch movement and distance from center
        const dx = currentX - lastTouchX;
        const dy = currentY - lastTouchY;
        const moveAmount = Math.sqrt(dx * dx + dy * dy);
        
        // Adjust rotation based on movement direction
        const rotationChange = moveAmount * 0.5; // Sensitivity factor
        const newRotation = Math.min(100, Math.max(0, 
            parseInt(rotationSlider.value) + (dx > 0 ? rotationChange : -rotationChange)
        ));
        
        rotationSlider.value = newRotation;
        params.rotation = newRotation;
        params.rotationSpeed = params.rotation * 0.05; // Update rotation speed
        updateValueDisplays();
        
        lastTouchX = currentX;
        lastTouchY = currentY;
    }
    
    function handleInteractionEnd() {
        isDragging = false;
    }
    
    // Mouse events
    canvas.addEventListener('mousedown', e => handleInteractionStart(e.clientX, e.clientY));
    canvas.addEventListener('mousemove', e => handleInteractionMove(e.clientX, e.clientY));
    canvas.addEventListener('mouseup', handleInteractionEnd);
    canvas.addEventListener('mouseleave', handleInteractionEnd);
    
    // Touch events
    canvas.addEventListener('touchstart', e => {
        e.preventDefault(); // Prevent scrolling when touching the canvas
        const touch = e.touches[0];
        handleInteractionStart(touch.clientX, touch.clientY);
    });
    
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        const touch = e.touches[0];
        handleInteractionMove(touch.clientX, touch.clientY);
    });
    
    canvas.addEventListener('touchend', handleInteractionEnd);
    canvas.addEventListener('touchcancel', handleInteractionEnd);
    
    // Try to load parameters from localStorage
    if (params.loadFromStorage()) {
        console.log('Parameters loaded from localStorage');
        
        // Update UI sliders to match loaded parameters
        if (massSlider) massSlider.value = params.mass;
        if (rotationSlider) rotationSlider.value = params.rotation;
        if (zoomSlider) zoomSlider.value = params.zoom;
        if (timeScaleSlider) timeScaleSlider.value = params.timeScale;
        if (dragSlider) dragSlider.value = params.drag;
        if (particlesSlider) particlesSlider.value = params.particles;
        if (trailsCheckbox) trailsCheckbox.checked = params.trails;
        if (trailLengthSlider) trailLengthSlider.value = params.trailLength;
        if (seedInput) seedInput.value = params.seed;
    }
    
    // Initialize displays
    updateValueDisplays();
    
    // Update physics values display
    params.updateUI();
    
    // Initial draw
    draw();
    
    // Auto-save parameters to localStorage when they change
    function autoSaveParams() {
        if (isRunning) {
            params.saveToStorage();
        }
        setTimeout(autoSaveParams, 5000); // Save every 5 seconds while running
    }
    autoSaveParams();
});
