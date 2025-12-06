/**
 * Animation Engine - Game-like smooth animations for code visualization
 * Provides easing functions, transitions, and particle effects
 */

// Easing functions for smooth animations
export const Easing = {
    // Smooth acceleration and deceleration
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    
    // Elastic bounce effect
    easeOutElastic: (t) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    
    // Bounce effect
    easeOutBounce: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    
    // Quick start, slow finish
    easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
    
    // Overshoot effect
    easeOutBack: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    
    // Linear
    linear: (t) => t,
    
    // Smooth step
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

/**
 * AnimatedValue - Smoothly interpolates between values
 */
export class AnimatedValue {
    constructor(initialValue = 0) {
        this.current = initialValue;
        this.target = initialValue;
        this.startValue = initialValue;
        this.startTime = 0;
        this.duration = 300;
        this.easing = Easing.easeOutQuart;
        this.isAnimating = false;
    }
    
    animateTo(target, duration = 300, easing = Easing.easeOutQuart) {
        this.startValue = this.current;
        this.target = target;
        this.startTime = performance.now();
        this.duration = duration;
        this.easing = easing;
        this.isAnimating = true;
    }
    
    update() {
        if (!this.isAnimating) return this.current;
        
        const elapsed = performance.now() - this.startTime;
        const progress = Math.min(elapsed / this.duration, 1);
        const easedProgress = this.easing(progress);
        
        this.current = this.startValue + (this.target - this.startValue) * easedProgress;
        
        if (progress >= 1) {
            this.current = this.target;
            this.isAnimating = false;
        }
        
        return this.current;
    }
    
    set(value) {
        this.current = value;
        this.target = value;
        this.isAnimating = false;
    }
}

/**
 * Particle - For visual effects
 */
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1;
        this.decay = 0.02 + Math.random() * 0.02;
        this.size = 3 + Math.random() * 4;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.size *= 0.98;
    }
    
    isDead() {
        return this.life <= 0;
    }
}

/**
 * ParticleSystem - Manages particle effects
 */
export class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    
    emit(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    
    update() {
        this.particles = this.particles.filter(p => {
            p.update();
            return !p.isDead();
        });
    }
    
    getParticles() {
        return this.particles;
    }
    
    clear() {
        this.particles = [];
    }
}

/**
 * GlowEffect - Pulsing glow for highlights
 */
export class GlowEffect {
    constructor() {
        this.phase = 0;
        this.speed = 0.05;
    }
    
    update() {
        this.phase += this.speed;
        if (this.phase > Math.PI * 2) this.phase = 0;
    }
    
    getIntensity() {
        return 0.5 + Math.sin(this.phase) * 0.3;
    }
    
    getBlur() {
        return 8 + Math.sin(this.phase) * 4;
    }
}

/**
 * AnimatedNode - A node with animated properties
 */
export class AnimatedNode {
    constructor(id, initialProps = {}) {
        this.id = id;
        this.x = new AnimatedValue(initialProps.x || 0);
        this.y = new AnimatedValue(initialProps.y || 0);
        this.scale = new AnimatedValue(initialProps.scale || 1);
        this.opacity = new AnimatedValue(initialProps.opacity || 1);
        this.glowIntensity = new AnimatedValue(0);
        this.value = initialProps.value || '';
        this.type = initialProps.type || 'rect';
        this.color = initialProps.color || null;
        this.highlight = initialProps.highlight || false;
        this.arrayId = initialProps.arrayId || null;
        this.index = initialProps.index ?? null;
        this.createdAt = performance.now();
        this.glow = new GlowEffect();
    }
    
    moveTo(x, y, duration = 400) {
        this.x.animateTo(x, duration, Easing.easeOutBack);
        this.y.animateTo(y, duration, Easing.easeOutBack);
    }
    
    scaleTo(scale, duration = 200) {
        this.scale.animateTo(scale, duration, Easing.easeOutElastic);
    }
    
    fadeIn(duration = 300) {
        this.opacity.set(0);
        this.scale.set(0.5);
        this.opacity.animateTo(1, duration, Easing.easeOutQuart);
        this.scale.animateTo(1, duration, Easing.easeOutBack);
    }
    
    fadeOut(duration = 200) {
        this.opacity.animateTo(0, duration, Easing.easeInOutQuad);
        this.scale.animateTo(0.8, duration, Easing.easeInOutQuad);
    }
    
    pulse() {
        this.scale.animateTo(1.15, 150, Easing.easeOutQuart);
        setTimeout(() => {
            this.scale.animateTo(1, 150, Easing.easeOutQuart);
        }, 150);
    }
    
    setHighlight(highlight, color = null) {
        this.highlight = highlight;
        this.color = color;
        if (highlight) {
            this.glowIntensity.animateTo(1, 200, Easing.easeOutQuart);
            this.pulse();
        } else {
            this.glowIntensity.animateTo(0, 300, Easing.easeOutQuart);
        }
    }
    
    update() {
        this.x.update();
        this.y.update();
        this.scale.update();
        this.opacity.update();
        this.glowIntensity.update();
        if (this.highlight) {
            this.glow.update();
        }
    }
    
    isAnimating() {
        return this.x.isAnimating || this.y.isAnimating || 
               this.scale.isAnimating || this.opacity.isAnimating;
    }
    
    getProps() {
        return {
            id: this.id,
            x: this.x.current,
            y: this.y.current,
            scale: this.scale.current,
            opacity: this.opacity.current,
            value: this.value,
            type: this.type,
            color: this.color,
            highlight: this.highlight,
            glowIntensity: this.glowIntensity.current,
            glowBlur: this.highlight ? this.glow.getBlur() : 0,
            arrayId: this.arrayId,
            index: this.index,
        };
    }
}

/**
 * AnimationEngine - Main controller for all animations
 */
class AnimationEngine {
    constructor() {
        this.nodes = new Map();
        this.particleSystem = new ParticleSystem();
        this.subscribers = [];
        this.isRunning = false;
        this.frameId = null;
    }
    
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }
    
    notify() {
        const state = this.getState();
        this.subscribers.forEach(cb => cb(state));
    }
    
    getState() {
        return {
            nodes: Array.from(this.nodes.values()).map(node => node.getProps()),
            particles: this.particleSystem.getParticles(),
        };
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.loop();
    }
    
    stop() {
        this.isRunning = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }
    
    loop = () => {
        if (!this.isRunning) return;
        
        // Update all nodes
        this.nodes.forEach(node => node.update());
        
        // Update particles
        this.particleSystem.update();
        
        // Notify subscribers
        this.notify();
        
        // Continue loop
        this.frameId = requestAnimationFrame(this.loop);
    }
    
    addNode(id, props) {
        const node = new AnimatedNode(id, props);
        node.fadeIn();
        this.nodes.set(id, node);
        
        // Emit particles on creation
        if (props.highlight) {
            this.emitParticles(props.x, props.y, props.color || 'blue');
        }
        
        return node;
    }
    
    getNode(id) {
        return this.nodes.get(id);
    }
    
    updateNode(id, props) {
        const node = this.nodes.get(id);
        if (!node) return;
        
        if (props.x !== undefined && props.x !== node.x.target) {
            node.moveTo(props.x, props.y !== undefined ? props.y : node.y.target);
        } else if (props.y !== undefined && props.y !== node.y.target) {
            node.moveTo(node.x.target, props.y);
        }
        
        if (props.value !== undefined) {
            node.value = props.value;
        }
        
        if (props.highlight !== undefined) {
            const wasHighlighted = node.highlight;
            node.setHighlight(props.highlight, props.color);
            
            // Emit particles when highlighting
            if (props.highlight && !wasHighlighted) {
                this.emitParticles(node.x.current, node.y.current, props.color || 'yellow');
            }
        }
        
        if (props.color !== undefined) {
            node.color = props.color;
        }
    }
    
    deleteNode(id) {
        const node = this.nodes.get(id);
        if (node) {
            // Could add fade out animation here
            this.nodes.delete(id);
        }
    }
    
    emitParticles(x, y, color, count = 8) {
        const colorMap = {
            'yellow': '#FCD34D',
            'green': '#34D399',
            'red': '#F87171',
            'blue': '#60A5FA',
            'purple': '#A78BFA',
            'orange': '#FB923C',
        };
        this.particleSystem.emit(x, y, colorMap[color] || color, count);
    }
    
    clear() {
        this.nodes.clear();
        this.particleSystem.clear();
        this.notify();
    }
    
    // Animate a swap between two array elements
    animateSwap(nodeId1, nodeId2, duration = 400) {
        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);
        
        if (!node1 || !node2) return;
        
        const x1 = node1.x.target;
        const y1 = node1.y.target;
        const x2 = node2.x.target;
        const y2 = node2.y.target;
        
        // Animate swap with arc motion
        node1.moveTo(x2, y1 - 30, duration / 2);
        node2.moveTo(x1, y2 + 30, duration / 2);
        
        setTimeout(() => {
            node1.moveTo(x2, y2, duration / 2);
            node2.moveTo(x1, y1, duration / 2);
            
            // Emit particles at swap completion
            this.emitParticles(x1, y1, 'purple');
            this.emitParticles(x2, y2, 'purple');
        }, duration / 2);
    }
    
    // Move pointer smoothly to new index
    movePointer(pointerId, newX, newY, duration = 300) {
        const node = this.nodes.get(pointerId);
        if (node) {
            node.moveTo(newX, newY, duration);
        }
    }
}

export const animationEngine = new AnimationEngine();
