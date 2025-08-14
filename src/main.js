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
    const resetButton = document.getElementById('reset');
    const startPauseButton = document.getElementById('start-pause');
    
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
        mass: 50,
        rotation: 0,
        zoom: 100,
        rotationSpeed: 0, // Actual rotation speed in radians per second
        diskAngle: 0      // Current angle of accretion disk
    };
    
    // Update value displays
    function updateValueDisplays() {
        document.querySelectorAll('.control-group').forEach(group => {
            const input = group.querySelector('input');
            const display = group.querySelector('.value-display');
            
            if (input && display) {
                let value = input.value;
                if (input.id === 'zoom') value += '%';
                display.textContent = value;
            }
        });
    }
    
    // Add event listeners to controls
    massSlider.addEventListener('input', () => {
        params.mass = parseInt(massSlider.value);
        updateValueDisplays();
        draw();
    });
    
    rotationSlider.addEventListener('input', () => {
        params.rotation = parseInt(rotationSlider.value);
        params.rotationSpeed = params.rotation * 0.05; // Update rotation speed
        updateValueDisplays();
        draw();
    });
    
    zoomSlider.addEventListener('input', () => {
        params.zoom = parseInt(zoomSlider.value);
        updateValueDisplays();
        draw();
    });
    
    resetButton.addEventListener('click', resetSimulation);
    startPauseButton.addEventListener('click', toggleSimulation);
    
    // Reset simulation to default values
    function resetSimulation() {
        massSlider.value = 50;
        rotationSlider.value = 0;
        zoomSlider.value = 100;
        
        params = {
            mass: 50,
            rotation: 0,
            zoom: 100,
            rotationSpeed: 0,
            diskAngle: 0
        };
        
        // Reset animation timing variables
        lastFrameTime = performance.now();
        accumulatedTime = 0;
        frameCount = 0;
        
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
        // Update rotation based on current rotation speed parameter
        params.rotationSpeed = params.rotation * 0.05; // Scale rotation parameter to radians per second
        params.diskAngle += params.rotationSpeed * dt; // Increment angle based on dt
        
        // Keep angle within 0-2π range to avoid floating point issues over time
        params.diskAngle = params.diskAngle % (Math.PI * 2);
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
    
    // Initialize displays
    updateValueDisplays();
    
    // Initial draw
    draw();
});
