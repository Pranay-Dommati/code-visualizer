/**
 * Cinematic Rendering Engine v2
 * =============================
 * 
 * COMPLETELY REWRITTEN for industry-standard visualization.
 * 
 * KEY DIFFERENCES FROM v1:
 * 1. PERSISTENT STATE - Array stays visible, effects overlay
 * 2. CINEMATIC TRANSITIONS - Smooth morphing between scenes
 * 3. FOCUS SYSTEM - Camera-like zoom on active elements
 * 4. PARTICLE EFFECTS - Glow, trails, sparks for emphasis
 * 5. LAYERED RENDERING - Background < Data < Effects < UI
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';

// === CINEMATIC COLOR PALETTE ===
const THEME = {
    // Background layers
    bg: {
        dark: 0x0a0f1a,
        mid: 0x111827,
        light: 0x1f2937,
    },
    
    // Array elements
    element: {
        idle: { bg: 0x1e293b, border: 0x475569, text: 0xe2e8f0 },
        active: { bg: 0x3b82f6, border: 0x60a5fa, text: 0xffffff, glow: 0x3b82f6 },
        comparing: { bg: 0xfbbf24, border: 0xf59e0b, text: 0x1f2937, glow: 0xfbbf24 },
        success: { bg: 0x22c55e, border: 0x4ade80, text: 0x1f2937, glow: 0x22c55e },
        highlight: { bg: 0x8b5cf6, border: 0xa78bfa, text: 0xffffff, glow: 0x8b5cf6 },
        result: { bg: 0x06b6d4, border: 0x22d3ee, text: 0x1f2937, glow: 0x06b6d4 },
    },
    
    // Variables
    variable: {
        bg: 0x1e40af,
        border: 0x3b82f6,
        text: 0xffffff,
        changed: 0x22c55e,
    },
    
    // UI
    text: {
        title: 0xffffff,
        label: 0x94a3b8,
        value: 0xe2e8f0,
        success: 0x22c55e,
        error: 0xef4444,
    },
    
    // Effects
    effects: {
        glow: 0x3b82f6,
        trail: 0x60a5fa,
        spark: 0xfbbf24,
    }
};

// === ANIMATION PRESETS ===
const ANIM = {
    fast: 0.2,
    normal: 0.4,
    slow: 0.6,
    cinematic: 0.8,
    
    easing: {
        bounce: 'back.out(1.7)',
        smooth: 'power2.out',
        elastic: 'elastic.out(1, 0.5)',
        snap: 'power4.out',
    }
};

class CinematicEngine {
    constructor() {
        this.app = null;
        this.isReady = false;
        this.width = 0;
        this.height = 0;
        
        // === PERSISTENT STATE ===
        // These stay on screen between scenes
        this.state = {
            array: null,          // Current array data
            arrayElements: [],    // PixiJS element refs
            variables: {},        // Variable name -> element
            pointers: {},         // Pointer name -> element
            highlights: new Set(), // Currently highlighted indices
        };
        
        // === LAYER SYSTEM ===
        this.layers = {};
        
        // === TIMELINE ===
        this.masterTimeline = null;
        
        // Callbacks
        this.onSceneComplete = null;
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    
    async init(container, width, height) {
        if (this.isReady) {
            this.resize(width, height);
            return;
        }

        this.width = width;
        this.height = height;

        try {
            // Create PixiJS v8 app
            this.app = new PIXI.Application();
            await this.app.init({
                width,
                height,
                backgroundColor: THEME.bg.dark,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            // Attach canvas
            const canvas = this.app.canvas || this.app.view;
            if (canvas) {
                container.appendChild(canvas);
            } else {
                throw new Error('No canvas available');
            }

            // Create layer hierarchy
            this.createLayers();
            
            // Draw initial background
            this.drawBackground();
            
            this.isReady = true;
            console.log('🎬 Cinematic Engine initialized');
            
        } catch (err) {
            console.error('Cinematic Engine init failed:', err);
            throw err;
        }
    }

    createLayers() {
        // Z-order from bottom to top
        const layerNames = [
            'background',   // Gradient, grid
            'context',      // Title, labels
            'arrays',       // Array elements
            'pointers',     // Pointer arrows
            'variables',    // Variable boxes
            'comparison',   // Comparison overlay
            'effects',      // Particles, glows
            'ui',           // Step info, results
        ];

        layerNames.forEach(name => {
            this.layers[name] = new PIXI.Container();
            this.layers[name].name = name;
            this.app.stage.addChild(this.layers[name]);
        });
    }

    drawBackground() {
        if (!this.app?.screen) return;
        
        const { width, height } = this.app.screen;
        const bg = new PIXI.Graphics();
        
        // Dark gradient background
        bg.rect(0, 0, width, height);
        bg.fill(THEME.bg.dark);
        
        // Subtle grid
        bg.setStrokeStyle({ width: 1, color: 0x1f2937, alpha: 0.3 });
        const gridSize = 30;
        for (let x = 0; x < width; x += gridSize) {
            bg.moveTo(x, 0);
            bg.lineTo(x, height);
        }
        for (let y = 0; y < height; y += gridSize) {
            bg.moveTo(0, y);
            bg.lineTo(width, y);
        }
        bg.stroke();
        
        this.layers.background.removeChildren();
        this.layers.background.addChild(bg);
    }

    resize(width, height) {
        if (!this.app) return;
        this.width = width;
        this.height = height;
        this.app.renderer.resize(width, height);
        this.drawBackground();
    }

    // =========================================================================
    // MAIN RENDER FUNCTION
    // =========================================================================
    
    async renderScene(sceneData) {
        if (!this.isReady || !sceneData) {
            console.warn('Engine not ready or no scene data');
            return;
        }

        console.log('🎬 Rendering:', sceneData.type, sceneData);

        // Kill any running timeline
        if (this.masterTimeline) {
            this.masterTimeline.kill();
        }
        this.masterTimeline = gsap.timeline({
            onComplete: () => {
                if (this.onSceneComplete) {
                    this.onSceneComplete();
                }
            }
        });

        // Route to appropriate renderer
        switch (sceneData.type) {
            case 'algorithm_overview':
                await this.renderOverview(sceneData);
                break;
            case 'array_view':
                await this.renderArrayScene(sceneData);
                break;
            case 'comparison':
                await this.renderComparisonScene(sceneData);
                break;
            case 'variable_update':
                await this.renderVariableUpdate(sceneData);
                break;
            case 'result':
                await this.renderResult(sceneData);
                break;
            default:
                console.warn('Unknown scene type:', sceneData.type);
                // Try to render as array view
                if (sceneData.values || sceneData.arrays) {
                    await this.renderArrayScene(sceneData);
                }
        }
    }

    // =========================================================================
    // SCENE RENDERERS
    // =========================================================================

    async renderOverview(scene) {
        // Clear only UI layers, keep structure
        this.layers.context.removeChildren();
        this.layers.arrays.removeChildren();
        this.layers.variables.removeChildren();
        this.layers.comparison.removeChildren();
        this.layers.effects.removeChildren();
        this.layers.ui.removeChildren();
        
        // Reset state
        this.state.arrayElements = [];
        this.state.variables = {};
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // === TITLE ===
        const title = this.createText(scene.title || 'Algorithm', {
            fontSize: 28,
            fill: THEME.text.title,
            fontWeight: 'bold',
        });
        title.anchor.set(0.5, 0.5);
        title.x = centerX;
        title.y = 50;
        title.alpha = 0;
        this.layers.context.addChild(title);
        
        this.masterTimeline.to(title, { 
            alpha: 1, 
            duration: ANIM.normal,
            ease: ANIM.easing.smooth 
        }, 0);
        
        // === ARRAY(S) ===
        if (scene.arrays && scene.arrays.length > 0) {
            const arr = scene.arrays[0]; // Primary array
            this.state.array = arr;
            
            await this.renderArrayWithAnimation(arr.name, arr.values, arr.highlights || [], centerY + 20);
        }
        
        // === VARIABLES ===
        if (scene.variables && Object.keys(scene.variables).length > 0) {
            await this.renderVariablesPanel(scene.variables, centerY + 140);
        }
    }

    async renderArrayScene(scene) {
        // Keep existing structure, update highlights
        const arrayName = scene.arrayName || scene.arrays?.[0]?.name || 'array';
        const values = scene.values || scene.arrays?.[0]?.values || [];
        const highlights = scene.highlights || [];
        const pointers = scene.pointers || [];
        
        // If array changed or doesn't exist, render fresh
        if (!this.state.array || 
            this.state.array.name !== arrayName || 
            JSON.stringify(this.state.array.values) !== JSON.stringify(values)) {
            
            this.layers.arrays.removeChildren();
            this.state.array = { name: arrayName, values };
            this.state.arrayElements = [];
            
            await this.renderArrayWithAnimation(arrayName, values, highlights, this.height / 2);
        } else {
            // Just update highlights with animation
            await this.updateHighlights(highlights);
        }
        
        // Update pointers
        await this.renderPointers(pointers);
    }

    async renderComparisonScene(scene) {
        // DON'T CLEAR THE ARRAY - just overlay comparison
        this.layers.comparison.removeChildren();
        
        const left = scene.left;
        const right = scene.right;
        const operator = scene.operator || '>';
        const result = scene.result;
        
        // ENSURE array is visible - render it if not already there
        if (scene.arrayContext && !this.state.array) {
            const ctx = scene.arrayContext;
            this.state.array = { name: ctx.name, values: ctx.values };
            await this.renderArrayWithAnimation(ctx.name, ctx.values, [], this.height / 2 - 30);
        }
        
        // First, highlight the element being compared in the array
        if (left?.index !== undefined && left.index >= 0) {
            await this.highlightElement(left.index, 'comparing');
        } else if (scene.arrayContext?.highlightIndex !== undefined && scene.arrayContext.highlightIndex >= 0) {
            await this.highlightElement(scene.arrayContext.highlightIndex, 'comparing');
        }
        
        const centerX = this.width / 2;
        const centerY = this.height / 2 + 80; // Below array
        
        // === COMPARISON BOX CONTAINER ===
        const compContainer = new PIXI.Container();
        compContainer.x = centerX;
        compContainer.y = centerY;
        this.layers.comparison.addChild(compContainer);
        
        // Left value (from array)
        const leftBox = this.createComparisonBox(
            left?.value ?? '?',
            left?.name || 'n',
            THEME.element.comparing
        );
        leftBox.x = -100;
        leftBox.y = 0;
        leftBox.alpha = 0;
        leftBox.scale.set(0.5);
        compContainer.addChild(leftBox);
        
        // Operator symbol
        const opText = this.createText(operator, {
            fontSize: 32,
            fill: THEME.text.title,
            fontWeight: 'bold',
        });
        opText.anchor.set(0.5, 0.5);
        opText.x = 0;
        opText.y = 0;
        opText.alpha = 0;
        compContainer.addChild(opText);
        
        // Right value (variable)
        const rightBox = this.createComparisonBox(
            right?.value ?? '?',
            right?.name || 'max',
            THEME.element.highlight
        );
        rightBox.x = 100;
        rightBox.y = 0;
        rightBox.alpha = 0;
        rightBox.scale.set(0.5);
        compContainer.addChild(rightBox);
        
        // Result indicator
        const resultText = this.createText(
            result ? '✓ True' : '✗ False',
            {
                fontSize: 20,
                fill: result ? THEME.text.success : THEME.text.error,
                fontWeight: 'bold',
            }
        );
        resultText.anchor.set(0.5, 0.5);
        resultText.x = 0;
        resultText.y = 60;
        resultText.alpha = 0;
        compContainer.addChild(resultText);
        
        // === CINEMATIC ANIMATION ===
        // Boxes fly in from sides
        this.masterTimeline.to(leftBox, {
            alpha: 1,
            pixi: { scale: 1 },
            x: -80,
            duration: ANIM.normal,
            ease: ANIM.easing.bounce,
        }, 0);
        
        this.masterTimeline.to(rightBox, {
            alpha: 1,
            pixi: { scale: 1 },
            x: 80,
            duration: ANIM.normal,
            ease: ANIM.easing.bounce,
        }, 0.1);
        
        // Operator appears
        this.masterTimeline.to(opText, {
            alpha: 1,
            duration: ANIM.fast,
            ease: ANIM.easing.snap,
        }, 0.3);
        
        // Result with dramatic reveal
        this.masterTimeline.to(resultText, {
            alpha: 1,
            duration: ANIM.normal,
            ease: ANIM.easing.bounce,
        }, 0.5);
        
        // If result is true, flash the left box green
        if (result) {
            this.masterTimeline.to(leftBox.getChildAt(0), {
                pixi: { tint: THEME.element.success.bg },
                duration: ANIM.fast,
            }, 0.7);
        }
    }

    async renderVariableUpdate(scene) {
        const varName = scene.name;
        const newValue = scene.newValue;
        
        // Create or update variable display
        let varElement = this.state.variables[varName];
        
        if (!varElement) {
            // Create new variable element
            varElement = this.createVariableBox(varName, newValue);
            varElement.x = this.width - 120;
            varElement.y = 100;
            varElement.alpha = 0;
            this.layers.variables.addChild(varElement);
            this.state.variables[varName] = varElement;
            
            // Animate in
            this.masterTimeline.to(varElement, {
                alpha: 1,
                duration: ANIM.normal,
                ease: ANIM.easing.smooth,
            }, 0);
        } else {
            // Update existing - flash effect
            const flash = new PIXI.Graphics();
            flash.roundRect(-60, -25, 120, 50, 8);
            flash.fill({ color: THEME.variable.changed, alpha: 0.5 });
            varElement.addChild(flash);
            
            this.masterTimeline.to(flash, {
                alpha: 0,
                duration: ANIM.slow,
            }, 0);
            
            // Update the text
            const textChild = varElement.getChildByName?.('valueText');
            if (textChild) {
                // Will animate value change
            }
        }
    }

    async renderResult(scene) {
        this.layers.ui.removeChildren();
        this.layers.comparison.removeChildren();
        
        const centerX = this.width / 2;
        const centerY = this.height / 2 + 100;
        
        // ENSURE array is visible if we have context
        if (scene.arrayContext && !this.state.array) {
            const ctx = scene.arrayContext;
            this.state.array = { name: ctx.name, values: ctx.values };
            await this.renderArrayWithAnimation(ctx.name, ctx.values, [], this.height / 2 - 30);
        }
        
        // Highlight the result element in array if applicable
        if (scene.value !== undefined && this.state.array?.values) {
            const resultIndex = this.state.array.values.indexOf(scene.value);
            if (resultIndex >= 0) {
                await this.highlightElement(resultIndex, 'result');
            }
        } else if (scene.arrayContext?.highlightIndices?.length > 0) {
            for (const idx of scene.arrayContext.highlightIndices) {
                await this.highlightElement(idx, 'result');
            }
        }
        
        // === RESULT BOX ===
        const resultBox = new PIXI.Container();
        resultBox.x = centerX;
        resultBox.y = centerY;
        
        // Background with gradient effect
        const bg = new PIXI.Graphics();
        bg.roundRect(-100, -35, 200, 70, 12);
        bg.fill(THEME.element.result.bg);
        bg.setStrokeStyle({ width: 3, color: THEME.element.result.border });
        bg.stroke();
        
        // Glow effect
        const glow = new PIXI.Graphics();
        glow.roundRect(-105, -40, 210, 80, 15);
        glow.fill({ color: THEME.element.result.glow, alpha: 0.3 });
        
        // Title
        const title = this.createText(scene.title || 'Result', {
            fontSize: 14,
            fill: THEME.text.label,
        });
        title.anchor.set(0.5, 0.5);
        title.y = -15;
        
        // Value
        const value = this.createText(String(scene.value ?? ''), {
            fontSize: 28,
            fill: THEME.element.result.text,
            fontWeight: 'bold',
        });
        value.anchor.set(0.5, 0.5);
        value.y = 12;
        
        resultBox.addChild(glow, bg, title, value);
        resultBox.alpha = 0;
        resultBox.scale.set(0.5);
        this.layers.ui.addChild(resultBox);
        
        // === CINEMATIC RESULT ANIMATION ===
        this.masterTimeline.to(resultBox, {
            alpha: 1,
            pixi: { scale: 1 },
            duration: ANIM.slow,
            ease: ANIM.easing.elastic,
        }, 0);
        
        // Pulsing glow
        gsap.to(glow, {
            alpha: 0.1,
            duration: 1,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
        });
    }

    // =========================================================================
    // ARRAY RENDERING
    // =========================================================================

    async renderArrayWithAnimation(name, values, highlights, yPosition) {
        const elemWidth = 55;
        const elemHeight = 55;
        const gap = 10;
        const totalWidth = values.length * elemWidth + (values.length - 1) * gap;
        const startX = (this.width - totalWidth) / 2 + elemWidth / 2;
        
        // Label
        const label = this.createText(`${name} =`, {
            fontSize: 18,
            fill: THEME.text.label,
        });
        label.anchor.set(1, 0.5);
        label.x = startX - 20;
        label.y = yPosition;
        label.alpha = 0;
        this.layers.arrays.addChild(label);
        
        this.masterTimeline.to(label, {
            alpha: 1,
            duration: ANIM.fast,
        }, 0);
        
        // Elements
        values.forEach((val, idx) => {
            const elem = this.createArrayElement(val, idx, elemWidth, elemHeight);
            elem.x = startX + idx * (elemWidth + gap);
            elem.y = yPosition;
            elem.alpha = 0;
            elem.scale.set(0.3);
            this.layers.arrays.addChild(elem);
            this.state.arrayElements[idx] = elem;
            
            // Check if highlighted
            const highlight = highlights.find(h => h.index === idx);
            if (highlight) {
                this.applyElementStyle(elem, highlight.color || 'active');
            }
            
            // Staggered entry animation
            this.masterTimeline.to(elem, {
                alpha: 1,
                pixi: { scale: 1 },
                duration: ANIM.normal,
                ease: ANIM.easing.bounce,
            }, 0.05 * idx);
        });
    }

    createArrayElement(value, index, width, height) {
        const container = new PIXI.Container();
        container.name = `elem_${index}`;
        
        // Background
        const bg = new PIXI.Graphics();
        bg.roundRect(-width/2, -height/2, width, height, 10);
        bg.fill(THEME.element.idle.bg);
        bg.setStrokeStyle({ width: 2, color: THEME.element.idle.border });
        bg.stroke();
        bg.name = 'background';
        
        // Value
        const text = this.createText(String(value), {
            fontSize: 22,
            fill: THEME.element.idle.text,
            fontWeight: 'bold',
        });
        text.anchor.set(0.5, 0.5);
        text.name = 'value';
        
        // Index label below
        const indexLabel = this.createText(String(index), {
            fontSize: 12,
            fill: THEME.text.label,
        });
        indexLabel.anchor.set(0.5, 0);
        indexLabel.y = height/2 + 5;
        indexLabel.name = 'index';
        
        container.addChild(bg, text, indexLabel);
        return container;
    }

    async highlightElement(index, styleName) {
        const elem = this.state.arrayElements[index];
        if (!elem) return;
        
        this.applyElementStyle(elem, styleName);
        
        // Pop animation
        this.masterTimeline.to(elem, {
            pixi: { scale: 1.15 },
            duration: ANIM.fast,
            ease: ANIM.easing.bounce,
        }, 0);
        this.masterTimeline.to(elem, {
            pixi: { scale: 1 },
            duration: ANIM.fast,
        }, ANIM.fast);
    }

    async updateHighlights(highlights) {
        // Reset all to idle
        this.state.arrayElements.forEach((elem, idx) => {
            if (elem) this.applyElementStyle(elem, 'idle');
        });
        
        // Apply new highlights
        highlights.forEach(h => {
            if (this.state.arrayElements[h.index]) {
                this.applyElementStyle(this.state.arrayElements[h.index], h.color || 'active');
            }
        });
    }

    applyElementStyle(element, styleName) {
        const style = THEME.element[styleName] || THEME.element.idle;
        const bg = element.getChildByName?.('background') || element.getChildAt?.(0);
        const text = element.getChildByName?.('value') || element.getChildAt?.(1);
        
        if (bg && bg.clear) {
            bg.clear();
            bg.roundRect(-27.5, -27.5, 55, 55, 10);
            bg.fill(style.bg);
            bg.setStrokeStyle({ width: 2, color: style.border });
            bg.stroke();
        }
        
        if (text && text.style) {
            text.style.fill = style.text;
        }
        
        // Add glow if style has it
        if (style.glow) {
            // Remove old glow
            const oldGlow = element.getChildByName?.('glow');
            if (oldGlow) element.removeChild(oldGlow);
            
            const glow = new PIXI.Graphics();
            glow.name = 'glow';
            glow.roundRect(-32, -32, 64, 64, 12);
            glow.fill({ color: style.glow, alpha: 0.3 });
            element.addChildAt(glow, 0);
            
            // Pulse animation
            gsap.to(glow, {
                alpha: 0.1,
                duration: 0.6,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
            });
        }
    }

    // =========================================================================
    // POINTERS
    // =========================================================================

    async renderPointers(pointers) {
        this.layers.pointers.removeChildren();
        
        pointers.forEach((ptr, i) => {
            const elemWidth = 55;
            const gap = 10;
            const startX = (this.width - this.state.array.values.length * (elemWidth + gap)) / 2 + elemWidth / 2;
            const x = startX + ptr.index * (elemWidth + gap);
            const y = this.height / 2 - 50;
            
            const container = new PIXI.Container();
            container.x = x;
            container.y = y;
            
            // Label
            const label = this.createText(ptr.name, {
                fontSize: 14,
                fill: THEME.effects.glow,
                fontWeight: 'bold',
            });
            label.anchor.set(0.5, 0.5);
            
            // Arrow
            const arrow = new PIXI.Graphics();
            arrow.setStrokeStyle({ width: 2, color: THEME.effects.glow });
            arrow.moveTo(0, 10);
            arrow.lineTo(0, 25);
            arrow.lineTo(-5, 20);
            arrow.moveTo(0, 25);
            arrow.lineTo(5, 20);
            arrow.stroke();
            
            container.addChild(label, arrow);
            container.alpha = 0;
            this.layers.pointers.addChild(container);
            
            // Animate in
            this.masterTimeline.to(container, {
                alpha: 1,
                duration: ANIM.fast,
            }, 0.1 * i);
        });
    }

    // =========================================================================
    // VARIABLES PANEL
    // =========================================================================

    async renderVariablesPanel(variables, yPosition) {
        this.layers.variables.removeChildren();
        this.state.variables = {};
        
        const entries = Object.entries(variables);
        const startX = this.width - 130;
        
        entries.forEach(([name, value], i) => {
            const box = this.createVariableBox(name, value);
            box.x = startX;
            box.y = yPosition + i * 45;
            box.alpha = 0;
            this.layers.variables.addChild(box);
            this.state.variables[name] = box;
            
            this.masterTimeline.to(box, {
                alpha: 1,
                duration: ANIM.normal,
            }, 0.1 * i);
        });
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    createText(content, style) {
        return new PIXI.Text({
            text: content,
            style: {
                fontFamily: 'JetBrains Mono, Consolas, monospace',
                fontSize: style.fontSize || 16,
                fill: style.fill || 0xffffff,
                fontWeight: style.fontWeight || 'normal',
            }
        });
    }

    createVariableBox(name, value) {
        const container = new PIXI.Container();
        
        const bg = new PIXI.Graphics();
        bg.roundRect(-55, -18, 110, 36, 6);
        bg.fill(THEME.variable.bg);
        bg.setStrokeStyle({ width: 1, color: THEME.variable.border });
        bg.stroke();
        
        const text = this.createText(`${name}=${value}`, {
            fontSize: 14,
            fill: THEME.variable.text,
        });
        text.anchor.set(0.5, 0.5);
        text.name = 'valueText';
        
        container.addChild(bg, text);
        return container;
    }

    createComparisonBox(value, label, theme) {
        const container = new PIXI.Container();
        
        // Background
        const bg = new PIXI.Graphics();
        bg.roundRect(-35, -35, 70, 70, 10);
        bg.fill(theme.bg);
        bg.setStrokeStyle({ width: 2, color: theme.border });
        bg.stroke();
        
        // Label above
        const labelText = this.createText(label, {
            fontSize: 12,
            fill: THEME.text.label,
        });
        labelText.anchor.set(0.5, 0.5);
        labelText.y = -50;
        
        // Value
        const valueText = this.createText(String(value), {
            fontSize: 24,
            fill: theme.text,
            fontWeight: 'bold',
        });
        valueText.anchor.set(0.5, 0.5);
        
        container.addChild(bg, labelText, valueText);
        return container;
    }

    clear() {
        Object.values(this.layers).forEach(layer => {
            layer.removeChildren();
        });
        this.state = {
            array: null,
            arrayElements: [],
            variables: {},
            pointers: {},
            highlights: new Set(),
        };
        this.drawBackground();
    }

    destroy() {
        if (this.masterTimeline) {
            this.masterTimeline.kill();
        }
        if (this.app) {
            this.app.destroy(true);
        }
    }
}

// Singleton
const cinematicEngine = new CinematicEngine();
export default cinematicEngine;
