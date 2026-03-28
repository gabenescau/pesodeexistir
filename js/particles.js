/**
 * Anti-Gravity Particle Engine
 * Ported from React to Vanilla JS for O Peso de Existir
 */

class AntiGravityParticles {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        // Configurações
        this.PARTICLE_DENSITY = 0.00015;
        this.BG_PARTICLE_DENSITY = 0.00005;
        this.MOUSE_RADIUS = 180;
        this.RETURN_SPEED = 0.08;
        this.DAMPING = 0.90;
        this.REPULSION_STRENGTH = 1.2;
        
        this.particles = [];
        this.bgParticles = [];
        this.mouse = { x: -1000, y: -1000, isActive: false };
        
        this.init();
        this.addEventListeners();
        this.animate(0);
    }

    init() {
        const { width, height } = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.ctx.scale(dpr, dpr);

        this.width = width;
        this.height = height;

        // Interactive Particles
        const particleCount = Math.floor(width * height * this.PARTICLE_DENSITY);
        this.particles = [];
        for (let i = 0; i < particleCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            this.particles.push({
                x: x, y: y,
                originX: x, originY: y,
                vx: 0, vy: 0,
                size: Math.random() * 1.5 + 1,
                color: Math.random() > 0.9 ? '#4285F4' : '#ffffff'
            });
        }

        // Ambient Background Particles
        const bgCount = Math.floor(width * height * this.BG_PARTICLE_DENSITY);
        this.bgParticles = [];
        for (let i = 0; i < bgCount; i++) {
            this.bgParticles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                size: Math.random() * 1 + 0.5,
                alpha: Math.random() * 0.3 + 0.1,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    addEventListeners() {
        window.addEventListener('resize', () => this.init());
        
        const container = this.canvas.parentElement;
        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            this.mouse.isActive = true;
        });

        container.addEventListener('mouseleave', () => {
            this.mouse.isActive = false;
        });
    }

    animate(time) {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Radial Glow
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const pulseOpacity = Math.sin(time * 0.0008) * 0.035 + 0.085;
        
        const gradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.max(this.width, this.height) * 0.7
        );
        gradient.addColorStop(0, `rgba(66, 133, 244, ${pulseOpacity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // 2. Background Particles
        this.bgParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = this.width;
            if (p.x > this.width) p.x = 0;
            if (p.y < 0) p.y = this.height;
            if (p.y > this.height) p.y = 0;

            const twinkle = Math.sin(time * 0.002 + p.phase) * 0.5 + 0.5;
            this.ctx.globalAlpha = p.alpha * (0.3 + 0.7 * twinkle);
            this.ctx.fillStyle = "#ffffff";
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        // 3. Main Particles Physics
        this.particles.forEach(p => {
            const dx = this.mouse.x - p.x;
            const dy = this.mouse.y - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (this.mouse.isActive && distance < this.MOUSE_RADIUS) {
                const force = (this.MOUSE_RADIUS - distance) / this.MOUSE_RADIUS;
                const repulsion = force * this.REPULSION_STRENGTH;
                p.vx -= (dx / distance) * repulsion * 5;
                p.vy -= (dy / distance) * repulsion * 5;
            }

            p.vx += (p.originX - p.x) * this.RETURN_SPEED;
            p.vy += (p.originY - p.y) * this.RETURN_SPEED;

            p.vx *= this.DAMPING;
            p.vy *= this.DAMPING;
            p.x += p.vx;
            p.y += p.vy;

            const velocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            const opacity = Math.min(0.3 + velocity * 0.1, 1);
            
            this.ctx.fillStyle = p.color === '#ffffff' ? `rgba(255, 255, 255, ${opacity})` : p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        requestAnimationFrame((t) => this.animate(t));
    }
}

// Inicializar quando o documento carregar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('particles-canvas')) {
        new AntiGravityParticles('particles-canvas');
    }
});
