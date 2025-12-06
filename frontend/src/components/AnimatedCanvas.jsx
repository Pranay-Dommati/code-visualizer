/**
 * Animated Visualization Components
 * Game-like smooth rendering with particles, glows, and transitions
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

// Color palette for the visualization
const COLORS = {
    background: '#0f172a',
    gridLine: 'rgba(71, 85, 105, 0.3)',
    node: {
        default: { fill: '#1e293b', stroke: '#475569', text: '#e2e8f0' },
        yellow: { fill: '#fbbf24', stroke: '#f59e0b', text: '#1f2937', glow: 'rgba(251, 191, 36, 0.6)' },
        green: { fill: '#22c55e', stroke: '#16a34a', text: '#1f2937', glow: 'rgba(34, 197, 94, 0.6)' },
        red: { fill: '#ef4444', stroke: '#dc2626', text: '#ffffff', glow: 'rgba(239, 68, 68, 0.6)' },
        blue: { fill: '#3b82f6', stroke: '#2563eb', text: '#ffffff', glow: 'rgba(59, 130, 246, 0.6)' },
        purple: { fill: '#8b5cf6', stroke: '#7c3aed', text: '#ffffff', glow: 'rgba(139, 92, 246, 0.6)' },
        orange: { fill: '#f97316', stroke: '#ea580c', text: '#1f2937', glow: 'rgba(249, 115, 22, 0.6)' },
    },
    pointer: '#10b981',
    label: '#94a3b8',
    variable: { fill: '#1e40af', stroke: '#3b82f6', text: '#ffffff' },
    comparison: { true: '#059669', false: '#dc2626' },
};

// Easing functions
const Easing = {
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeOutElastic: (t) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    easeOutBack: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
};

/**
 * Animated Canvas Visualization
 */
const AnimatedCanvas = ({ width, height, nodes, onFrame }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const stateRef = useRef({
        nodes: new Map(),
        particles: [],
        time: 0,
    });

    // Particle class
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.vx = (Math.random() - 0.5) * 6;
            this.vy = (Math.random() - 0.5) * 6;
            this.life = 1;
            this.decay = 0.015 + Math.random() * 0.015;
            this.size = 2 + Math.random() * 4;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.1; // Gravity
            this.life -= this.decay;
            this.vx *= 0.98;
        }

        draw(ctx) {
            ctx.save();
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Emit particles
    const emitParticles = useCallback((x, y, color, count = 12) => {
        const state = stateRef.current;
        for (let i = 0; i < count; i++) {
            state.particles.push(new Particle(x, y, color));
        }
    }, []);

    // Animation node wrapper with smooth interpolation
    class AnimNode {
        constructor(props) {
            this.id = props.id;
            this.targetX = props.x;
            this.targetY = props.y;
            this.currentX = props.x;
            this.currentY = props.y;
            this.targetScale = 1;
            this.currentScale = 0.5;
            this.targetOpacity = 1;
            this.currentOpacity = 0;
            this.value = props.value;
            this.type = props.type;
            this.color = props.color;
            this.highlight = props.highlight;
            this.glowPhase = Math.random() * Math.PI * 2;
            this.pulseTime = 0;
            this.isNew = true;
        }

        update(dt, target) {
            const speed = 0.12;
            
            // Smooth interpolation
            this.currentX += (this.targetX - this.currentX) * speed;
            this.currentY += (this.targetY - this.currentY) * speed;
            this.currentScale += (this.targetScale - this.currentScale) * speed;
            this.currentOpacity += (this.targetOpacity - this.currentOpacity) * speed;
            
            // Update from target props
            if (target) {
                if (target.x !== this.targetX || target.y !== this.targetY) {
                    this.targetX = target.x;
                    this.targetY = target.y;
                }
                this.value = target.value;
                this.color = target.color;
                
                if (target.highlight && !this.highlight) {
                    this.pulseTime = performance.now();
                }
                this.highlight = target.highlight;
            }
            
            // Glow animation
            this.glowPhase += 0.08;
            
            // New node animation
            if (this.isNew && this.currentOpacity > 0.9) {
                this.isNew = false;
            }
        }
    }

    // Main render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let lastTime = performance.now();

        const render = (currentTime) => {
            const dt = (currentTime - lastTime) / 1000;
            lastTime = currentTime;
            
            const state = stateRef.current;
            state.time = currentTime;

            // Clear canvas with gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(1, '#1e293b');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Draw subtle grid
            ctx.strokeStyle = COLORS.gridLine;
            ctx.lineWidth = 1;
            for (let x = 0; x < width; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += 40) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Update and sync nodes from props
            const nodeIds = new Set(nodes.map(n => n.id));
            
            // Add new nodes
            nodes.forEach(nodeProps => {
                if (!state.nodes.has(nodeProps.id)) {
                    const animNode = new AnimNode(nodeProps);
                    state.nodes.set(nodeProps.id, animNode);
                    
                    // Emit particles for new highlighted nodes
                    if (nodeProps.highlight) {
                        const color = COLORS.node[nodeProps.color || 'blue']?.glow || COLORS.node.blue.glow;
                        emitParticles(nodeProps.x, nodeProps.y, color);
                    }
                }
            });

            // Remove deleted nodes
            state.nodes.forEach((node, id) => {
                if (!nodeIds.has(id)) {
                    state.nodes.delete(id);
                }
            });

            // Update and draw nodes
            state.nodes.forEach((animNode, id) => {
                const targetProps = nodes.find(n => n.id === id);
                animNode.update(dt, targetProps);
                drawNode(ctx, animNode, state.time);
            });

            // Update and draw particles
            state.particles = state.particles.filter(p => {
                p.update();
                if (p.life > 0) {
                    p.draw(ctx);
                    return true;
                }
                return false;
            });

            animationRef.current = requestAnimationFrame(render);
        };

        animationRef.current = requestAnimationFrame(render);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [width, height, nodes, emitParticles]);

    // Draw a node with effects
    const drawNode = (ctx, node, time) => {
        const { currentX: x, currentY: y, currentScale: scale, currentOpacity: opacity,
                value, type, color, highlight, glowPhase } = node;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        const colorScheme = highlight && color ? COLORS.node[color] : COLORS.node.default;
        
        // Pulsing glow effect for highlighted nodes
        if (highlight && colorScheme.glow) {
            const glowIntensity = 0.5 + Math.sin(glowPhase) * 0.3;
            const glowSize = 12 + Math.sin(glowPhase) * 4;
            
            ctx.shadowColor = colorScheme.glow;
            ctx.shadowBlur = glowSize;
            ctx.globalAlpha = opacity * glowIntensity;
            
            // Draw glow layer
            if (type === 'rect') {
                drawRoundedRect(ctx, -30, -22, 60, 44, 8, colorScheme.fill, colorScheme.stroke);
            } else if (type === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, 25, 0, Math.PI * 2);
                ctx.fillStyle = colorScheme.fill;
                ctx.fill();
            }
            
            ctx.shadowBlur = 0;
            ctx.globalAlpha = opacity;
        }

        // Draw based on type
        switch (type) {
            case 'rect':
                drawRoundedRect(ctx, -30, -22, 60, 44, 8, colorScheme.fill, colorScheme.stroke);
                drawCenteredText(ctx, value, 0, 0, colorScheme.text, 18, 'bold');
                break;

            case 'pointer':
                drawPointer(ctx, value);
                break;

            case 'index':
                ctx.fillStyle = '#64748b';
                ctx.font = '12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(value, 0, 0);
                break;

            case 'label':
                drawLabel(ctx, value, color);
                break;

            case 'variable':
                drawVariableBox(ctx, value, highlight);
                break;

            case 'comparison':
                drawComparisonBox(ctx, value, highlight);
                break;

            case 'loop':
                drawLoopIndicator(ctx, value);
                break;

            default:
                // Circle
                ctx.beginPath();
                ctx.arc(0, 0, 24, 0, Math.PI * 2);
                ctx.fillStyle = colorScheme.fill;
                ctx.strokeStyle = colorScheme.stroke;
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
                drawCenteredText(ctx, value, 0, 0, colorScheme.text, 16, 'bold');
        }

        ctx.restore();
    };

    // Helper: Rounded rectangle
    const drawRoundedRect = (ctx, x, y, w, h, r, fill, stroke) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
    };

    // Helper: Centered text
    const drawCenteredText = (ctx, text, x, y, color, size, weight = 'normal') => {
        ctx.font = `${weight} ${size}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(text), x, y);
    };

    // Helper: Draw pointer arrow
    const drawPointer = (ctx, label) => {
        ctx.strokeStyle = COLORS.pointer;
        ctx.fillStyle = COLORS.pointer;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Arrow shaft
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(0, 20);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(-8, 12);
        ctx.lineTo(0, 22);
        ctx.lineTo(8, 12);
        ctx.stroke();

        // Label
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, -24);
    };

    // Helper: Draw label
    const drawLabel = (ctx, text, color) => {
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = color || COLORS.label;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, 0, 0);
    };

    // Helper: Draw variable box
    const drawVariableBox = (ctx, text, highlight) => {
        const width = Math.max(120, ctx.measureText(text).width + 24);
        const scheme = highlight ? COLORS.variable : COLORS.node.default;
        
        // Box with gradient
        const gradient = ctx.createLinearGradient(0, -16, 0, 16);
        gradient.addColorStop(0, scheme.fill);
        gradient.addColorStop(1, highlight ? '#1e3a8a' : '#0f172a');
        
        drawRoundedRect(ctx, 0, -16, width, 32, 6, gradient, scheme.stroke);
        
        ctx.font = '14px monospace';
        ctx.fillStyle = scheme.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 10, 0);
    };

    // Helper: Draw comparison box
    const drawComparisonBox = (ctx, text, isTrue) => {
        const width = Math.max(160, ctx.measureText(text).width + 24);
        const bgColor = isTrue ? '#065f46' : '#7f1d1d';
        const borderColor = isTrue ? '#10b981' : '#ef4444';
        const textColor = isTrue ? '#a7f3d0' : '#fecaca';
        
        drawRoundedRect(ctx, 0, -18, width, 36, 8, bgColor, borderColor);
        
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 12, 0);
    };

    // Helper: Draw loop indicator
    const drawLoopIndicator = (ctx, text) => {
        const gradient = ctx.createLinearGradient(0, -15, 0, 15);
        gradient.addColorStop(0, '#7c3aed');
        gradient.addColorStop(1, '#5b21b6');
        
        drawRoundedRect(ctx, 0, -15, 100, 30, 15, gradient, '#a78bfa');
        
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 10, 0);
    };

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                width: '100%',
                height: '100%',
                borderRadius: '8px',
            }}
        />
    );
};

export default AnimatedCanvas;
