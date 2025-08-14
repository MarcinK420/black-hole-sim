// Black Hole Simulation
document.addEventListener('DOMContentLoaded', () => {
    // Get the canvas element
    const canvas = document.getElementById('view');
    const ctx = canvas.getContext('2d');
    
    // Get control elements
    const massSlider = document.getElementById('mass');
    const rotationSlider = document.getElementById('rotation');
    const zoomSlider = document.getElementById('zoom');
    const resetButton = document.getElementById('reset');
    const startPauseButton = document.getElementById('start-pause');
    
    // Set canvas dimensions
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Redraw after resize
        draw();
    }
    
    // Initialize the canvas size
    resizeCanvas();
    
    // Respond to window resize
    window.addEventListener('resize', resizeCanvas);
    
    // Variables for simulation state
    let isRunning = false;
    let animationFrameId = null;
    
    // Simulation parameters
    let params = {
        mass: 50,
        rotation: 0,
        zoom: 100
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
            zoom: 100
        };
        
        updateValueDisplays();
        draw();
    }
    
    // Toggle simulation running state
    function toggleSimulation() {
        isRunning = !isRunning;
        startPauseButton.textContent = isRunning ? 'Pause' : 'Start';
        
        if (isRunning) {
            animate();
        } else if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
    
    // Animation loop
    function animate() {
        // Update simulation state here
        
        draw();
        
        if (isRunning) {
            animationFrameId = requestAnimationFrame(animate);
        }
    }
    
    // Draw the current state to the canvas
    function draw() {
        // Clear canvas
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate center and radius
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
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
            const rotationAngle = (Date.now() / 1000) * (params.rotation / 50);
            
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(rotationAngle);
            
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
    
    // Initialize displays
    updateValueDisplays();
    
    // Initial draw
    draw();
});
