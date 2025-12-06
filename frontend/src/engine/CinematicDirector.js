/**
 * CINEMATIC DIRECTOR
 * ==================
 * 
 * This is the MISSING PIECE that makes animations cinematic.
 * 
 * KEY PRINCIPLES:
 * 1. OBJECT REGISTRY - Create objects ONCE, reuse forever
 * 2. STATE TRANSITIONS - Move/morph objects, never recreate
 * 3. MASTER TIMELINE - One continuous GSAP timeline for the entire story
 * 4. DELTA COMMANDS - "Move pointer to X" not "Here's a new scene"
 * 
 * This is how AlgoExpert, Khan Academy, and real animation tools work.
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';

// === THEME ===
const THEME = {
    bg: 0x0a0f1a,
    
    array: {
        idle: { bg: 0x1e293b, border: 0x475569, text: 0xe2e8f0 },
        active: { bg: 0x3b82f6, border: 0x60a5fa, text: 0xffffff, glow: 0x3b82f6 },
        comparing: { bg: 0xfbbf24, border: 0xf59e0b, text: 0x1f2937, glow: 0xfbbf24 },
        success: { bg: 0x22c55e, border: 0x4ade80, text: 0x1f2937, glow: 0x22c55e },
        result: { bg: 0x06b6d4, border: 0x22d3ee, text: 0x1f2937, glow: 0x06b6d4 },
    },
    
    variable: { bg: 0x8b5cf6, border: 0xa78bfa, text: 0xffffff },
    pointer: { color: 0x10b981, text: 0x10b981 },
    comparison: { true: 0x22c55e, false: 0xef4444 },
    text: { title: 0xffffff, label: 0x94a3b8 },
};

// === ANIMATION TIMING ===
const TIMING = {
    stagger: 0.08,      // Delay between array elements
    appear: 0.4,        // Object appear duration
    move: 0.5,          // Pointer/element movement
    morph: 0.3,         // Value change morph
    highlight: 0.25,    // Highlight transition
    comparison: 0.6,    // Comparison animation total
    result: 0.8,        // Result reveal
    pause: 0.3,         // Pause between steps
};

const EASE = {
    appear: 'back.out(1.7)',
    move: 'power2.inOut',
    morph: 'power2.out',
    bounce: 'elastic.out(1, 0.5)',
    smooth: 'power2.out',
};

class CinematicDirector {
    constructor() {
        this.app = null;
        this.isReady = false;
        this.width = 0;
        this.height = 0;
        
        // === PERSISTENT OBJECT REGISTRY ===
        // Objects created ONCE and reused
        this.registry = {
            title: null,
            arrayLabel: null,
            arrayElements: [],      // Array element containers
            pointer: null,          // Current position pointer
            variableBoxes: {},      // Variable display boxes (max_val, etc.)
            comparisonUI: null,     // Comparison display container
            resultBox: null,        // Final result container
        };
        
        // === CURRENT STATE ===
        this.state = {
            arrayName: '',
            arrayValues: [],
            pointerIndex: -1,
            variables: {},
            isInitialized: false,
        };
        
        // === LAYER CONTAINERS ===
        this.layers = {};
        
        // === MASTER TIMELINE ===
        // ONE timeline for the entire animation story
        this.masterTimeline = null;
        this.timelinePosition = 0;
        
        // Callbacks
        this.onComplete = null;
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
            this.app = new PIXI.Application();
            await this.app.init({
                width,
                height,
                backgroundColor: THEME.bg,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            const canvas = this.app.canvas || this.app.view;
            if (canvas) {
                container.appendChild(canvas);
            }

            // Create layer hierarchy
            this.createLayers();
            this.drawBackground();
            
            // Create master timeline
            this.masterTimeline = gsap.timeline({ paused: true });
            
            this.isReady = true;
            console.log('🎬 Cinematic Director ready');
            
        } catch (err) {
            console.error('Cinematic Director init failed:', err);
            throw err;
        }
    }

    createLayers() {
        const layerOrder = ['background', 'arrays', 'pointers', 'variables', 'comparison', 'result', 'ui'];
        layerOrder.forEach(name => {
            this.layers[name] = new PIXI.Container();
            this.layers[name].name = name;
            this.app.stage.addChild(this.layers[name]);
        });
    }

    drawBackground() {
        if (!this.app?.screen) return;
        const { width, height } = this.app.screen;
        
        const bg = new PIXI.Graphics();
        bg.rect(0, 0, width, height);
        bg.fill(THEME.bg);
        
        // Subtle grid
        bg.setStrokeStyle({ width: 1, color: 0x1f2937, alpha: 0.3 });
        for (let x = 0; x < width; x += 30) {
            bg.moveTo(x, 0).lineTo(x, height);
        }
        for (let y = 0; y < height; y += 30) {
            bg.moveTo(0, y).lineTo(width, y);
        }
        bg.stroke();
        
        this.layers.background.removeChildren();
        this.layers.background.addChild(bg);
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.app?.renderer?.resize(width, height);
        this.drawBackground();
    }

    // =========================================================================
    // MASTER TIMELINE CONTROL
    // =========================================================================
    
    /**
     * Start a new cinematic story.
     * Resets everything and prepares for a fresh animation sequence.
     */
    startNewStory() {
        // Kill old timeline
        if (this.masterTimeline) {
            this.masterTimeline.kill();
        }
        
        // Clear all objects
        this.clearAll();
        
        // Create fresh master timeline
        this.masterTimeline = gsap.timeline({
            paused: true,
            onComplete: () => {
                console.log('🎬 Story complete!');
                if (this.onComplete) this.onComplete();
            }
        });
        
        this.timelinePosition = 0;
        this.state.isInitialized = false;
        
        console.log('🎬 New story started');
    }

    /**
     * Play the entire timeline from current position
     */
    play() {
        this.masterTimeline?.play();
    }

    /**
     * Pause the timeline
     */
    pause() {
        this.masterTimeline?.pause();
    }

    /**
     * Seek to a specific time
     */
    seek(time) {
        this.masterTimeline?.seek(time);
    }

    // =========================================================================
    // TRANSITION COMMANDS
    // These are the DELTA operations - they animate from current state to new state
    // =========================================================================

    /**
     * TRANSITION: Introduce the array
     * Creates array elements and animates them in with stagger
     */
    introduceArray(arrayName, values) {
        this.state.arrayName = arrayName;
        this.state.arrayValues = values;
        
        const elemWidth = 55;
        const elemHeight = 55;
        const gap = 12;
        const totalWidth = values.length * elemWidth + (values.length - 1) * gap;
        const startX = (this.width - totalWidth) / 2 + elemWidth / 2;
        const arrayY = this.height * 0.35;
        
        // Create label (if not exists)
        if (!this.registry.arrayLabel) {
            this.registry.arrayLabel = this.createText(`${arrayName} =`, 18, THEME.text.label);
            this.registry.arrayLabel.anchor.set(1, 0.5);
            this.layers.arrays.addChild(this.registry.arrayLabel);
        }
        this.registry.arrayLabel.text = `${arrayName} =`;
        this.registry.arrayLabel.x = startX - 25;
        this.registry.arrayLabel.y = arrayY;
        this.registry.arrayLabel.alpha = 0;
        
        // Create array elements
        this.registry.arrayElements = [];
        values.forEach((val, idx) => {
            const elem = this.createArrayElement(val, idx, elemWidth, elemHeight);
            elem.x = startX + idx * (elemWidth + gap);
            elem.y = arrayY;
            elem.alpha = 0;
            elem.scale.set(0.5);
            this.layers.arrays.addChild(elem);
            this.registry.arrayElements.push(elem);
        });
        
        // Add to timeline: Staggered entrance
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        // Label fades in
        tl.to(this.registry.arrayLabel, {
            alpha: 1,
            duration: TIMING.appear,
            ease: EASE.smooth,
        }, pos);
        
        // Elements pop in with stagger
        this.registry.arrayElements.forEach((elem, idx) => {
            tl.to(elem, {
                alpha: 1,
                pixi: { scale: 1 },
                duration: TIMING.appear,
                ease: EASE.appear,
            }, pos + TIMING.stagger * idx);
        });
        
        this.timelinePosition += TIMING.appear + TIMING.stagger * values.length + TIMING.pause;
        this.state.isInitialized = true;
    }

    /**
     * TRANSITION: Move pointer to an index
     * If pointer doesn't exist, creates it. Otherwise smoothly moves it.
     */
    movePointerTo(index, label = 'n') {
        if (index < 0 || index >= this.registry.arrayElements.length) return;
        
        const targetElem = this.registry.arrayElements[index];
        const pointerY = targetElem.y - 45;
        
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        if (!this.registry.pointer) {
            // Create pointer
            this.registry.pointer = this.createPointer(label);
            this.registry.pointer.x = targetElem.x;
            this.registry.pointer.y = pointerY - 20;
            this.registry.pointer.alpha = 0;
            this.layers.pointers.addChild(this.registry.pointer);
            
            // Animate in
            tl.to(this.registry.pointer, {
                alpha: 1,
                y: pointerY,
                duration: TIMING.appear,
                ease: EASE.appear,
            }, pos);
            
            this.timelinePosition += TIMING.appear;
        } else {
            // Update label
            const labelText = this.registry.pointer.getChildByName('label');
            if (labelText) labelText.text = label;
            
            // Smooth movement
            tl.to(this.registry.pointer, {
                x: targetElem.x,
                y: pointerY,
                duration: TIMING.move,
                ease: EASE.move,
            }, pos);
            
            this.timelinePosition += TIMING.move;
        }
        
        this.state.pointerIndex = index;
        this.timelinePosition += TIMING.pause * 0.5;
    }

    /**
     * TRANSITION: Highlight an array element
     * Changes the element's style with smooth transition
     */
    highlightElement(index, style = 'active') {
        if (index < 0 || index >= this.registry.arrayElements.length) return;
        
        const elem = this.registry.arrayElements[index];
        const colors = THEME.array[style] || THEME.array.active;
        
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        // Get background graphic
        const bg = elem.getChildByName('bg');
        
        // Animate scale pop + color change
        tl.to(elem, {
            pixi: { scale: 1.15 },
            duration: TIMING.highlight,
            ease: EASE.bounce,
        }, pos);
        
        // Tint the background
        if (bg) {
            tl.to(bg, {
                pixi: { tint: colors.bg },
                duration: TIMING.highlight,
            }, pos);
        }
        
        // Add glow
        this.addGlowEffect(elem, colors.glow || colors.bg, pos);
        
        // Return to normal scale
        tl.to(elem, {
            pixi: { scale: 1 },
            duration: TIMING.highlight,
        }, pos + TIMING.highlight);
        
        this.timelinePosition += TIMING.highlight * 2;
    }

    /**
     * TRANSITION: Reset element to idle state
     */
    resetElement(index) {
        if (index < 0 || index >= this.registry.arrayElements.length) return;
        
        const elem = this.registry.arrayElements[index];
        const bg = elem.getChildByName('bg');
        const glow = elem.getChildByName('glow');
        
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        if (bg) {
            tl.to(bg, {
                pixi: { tint: 0xffffff }, // Reset tint
                duration: TIMING.morph,
            }, pos);
        }
        
        if (glow) {
            tl.to(glow, {
                alpha: 0,
                duration: TIMING.morph,
            }, pos);
        }
    }

    /**
     * TRANSITION: Show or update a variable box
     */
    showVariable(name, value, highlight = false) {
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        const varY = this.height * 0.6;
        const varX = this.width / 2;
        
        if (!this.registry.variableBoxes[name]) {
            // Create new variable box
            const box = this.createVariableBox(name, value);
            box.x = varX;
            box.y = varY;
            box.alpha = 0;
            box.scale.set(0.5);
            this.layers.variables.addChild(box);
            this.registry.variableBoxes[name] = box;
            
            // Animate in
            tl.to(box, {
                alpha: 1,
                pixi: { scale: 1 },
                duration: TIMING.appear,
                ease: EASE.appear,
            }, pos);
            
            this.timelinePosition += TIMING.appear;
        } else {
            // Update existing
            const box = this.registry.variableBoxes[name];
            const valueText = box.getChildByName('value');
            const bg = box.getChildByName('bg');
            
            if (highlight && bg) {
                // Flash effect
                tl.to(bg, {
                    pixi: { tint: THEME.array.success.bg },
                    duration: TIMING.morph,
                }, pos);
                tl.to(bg, {
                    pixi: { tint: 0xffffff },
                    duration: TIMING.morph,
                }, pos + TIMING.morph);
            }
            
            // Scale bounce
            tl.to(box, {
                pixi: { scale: 1.2 },
                duration: TIMING.morph,
                ease: EASE.bounce,
            }, pos);
            
            // Update value text mid-animation
            tl.call(() => {
                if (valueText) valueText.text = `${name} = ${value}`;
            }, [], pos + TIMING.morph * 0.5);
            
            tl.to(box, {
                pixi: { scale: 1 },
                duration: TIMING.morph,
            }, pos + TIMING.morph);
            
            this.timelinePosition += TIMING.morph * 2;
        }
        
        this.state.variables[name] = value;
        this.timelinePosition += TIMING.pause * 0.5;
    }

    /**
     * TRANSITION: Show comparison animation
     * Displays "n > max_val" with animated result
     */
    showComparison(leftVar, leftVal, operator, rightVar, rightVal, result) {
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        // Clear old comparison
        this.layers.comparison.removeChildren();
        
        const compY = this.height * 0.72;
        const centerX = this.width / 2;
        
        // Create comparison container
        const container = new PIXI.Container();
        container.x = centerX;
        container.y = compY;
        this.layers.comparison.addChild(container);
        this.registry.comparisonUI = container;
        
        // Left box
        const leftBox = this.createCompBox(leftVal, leftVar, THEME.array.comparing);
        leftBox.x = -80;
        leftBox.alpha = 0;
        leftBox.scale.set(0.5);
        container.addChild(leftBox);
        
        // Operator
        const opText = this.createText(operator, 28, THEME.text.title);
        opText.anchor.set(0.5, 0.5);
        opText.x = 0;
        opText.alpha = 0;
        container.addChild(opText);
        
        // Right box
        const rightBox = this.createCompBox(rightVal, rightVar, THEME.variable);
        rightBox.x = 80;
        rightBox.alpha = 0;
        rightBox.scale.set(0.5);
        container.addChild(rightBox);
        
        // Result text
        const resultText = this.createText(
            result ? '✓ True' : '✗ False',
            20,
            result ? THEME.comparison.true : THEME.comparison.false
        );
        resultText.anchor.set(0.5, 0.5);
        resultText.y = 55;
        resultText.alpha = 0;
        resultText.scale.set(0.5);
        container.addChild(resultText);
        
        // === CINEMATIC ANIMATION SEQUENCE ===
        
        // Left box slides in from left
        tl.to(leftBox, {
            alpha: 1,
            pixi: { scale: 1 },
            duration: TIMING.comparison * 0.3,
            ease: EASE.appear,
        }, pos);
        
        // Right box slides in from right
        tl.to(rightBox, {
            alpha: 1,
            pixi: { scale: 1 },
            duration: TIMING.comparison * 0.3,
            ease: EASE.appear,
        }, pos + 0.1);
        
        // Operator appears
        tl.to(opText, {
            alpha: 1,
            duration: TIMING.comparison * 0.2,
        }, pos + 0.25);
        
        // Dramatic pause, then result
        tl.to(resultText, {
            alpha: 1,
            pixi: { scale: 1 },
            duration: TIMING.comparison * 0.4,
            ease: EASE.bounce,
        }, pos + TIMING.comparison * 0.6);
        
        // If true, flash the left box green
        if (result) {
            const leftBg = leftBox.getChildByName('bg');
            if (leftBg) {
                tl.to(leftBg, {
                    pixi: { tint: THEME.array.success.bg },
                    duration: 0.2,
                }, pos + TIMING.comparison * 0.8);
            }
        }
        
        this.timelinePosition += TIMING.comparison + TIMING.pause;
    }

    /**
     * TRANSITION: Clear comparison UI
     */
    clearComparison() {
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        if (this.registry.comparisonUI) {
            tl.to(this.registry.comparisonUI, {
                alpha: 0,
                duration: TIMING.morph,
            }, pos);
            
            tl.call(() => {
                this.layers.comparison.removeChildren();
                this.registry.comparisonUI = null;
            }, [], pos + TIMING.morph);
            
            this.timelinePosition += TIMING.morph;
        }
    }

    /**
     * TRANSITION: Show final result
     */
    showResult(title, value) {
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        // Clear comparison first
        this.clearComparison();
        
        const resultY = this.height * 0.75;
        const centerX = this.width / 2;
        
        // Create result box
        const box = new PIXI.Container();
        box.x = centerX;
        box.y = resultY + 50; // Start below
        box.alpha = 0;
        box.scale.set(0.5);
        
        // Glow background
        const glow = new PIXI.Graphics();
        glow.roundRect(-110, -45, 220, 90, 18);
        glow.fill({ color: THEME.array.result.glow, alpha: 0.4 });
        glow.name = 'glow';
        
        // Main background
        const bg = new PIXI.Graphics();
        bg.roundRect(-100, -35, 200, 70, 14);
        bg.fill(THEME.array.result.bg);
        bg.setStrokeStyle({ width: 3, color: THEME.array.result.border });
        bg.stroke();
        
        // Title
        const titleText = this.createText(title, 14, THEME.text.label);
        titleText.anchor.set(0.5, 0.5);
        titleText.y = -12;
        
        // Value
        const valueText = this.createText(String(value), 28, THEME.array.result.text);
        valueText.anchor.set(0.5, 0.5);
        valueText.y = 14;
        
        box.addChild(glow, bg, titleText, valueText);
        this.layers.result.addChild(box);
        this.registry.resultBox = box;
        
        // === CINEMATIC RESULT ANIMATION ===
        
        // Fly up and scale in
        tl.to(box, {
            y: resultY,
            alpha: 1,
            pixi: { scale: 1 },
            duration: TIMING.result,
            ease: EASE.bounce,
        }, pos);
        
        // Pulsing glow
        tl.to(glow, {
            alpha: 0.15,
            duration: 0.8,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
        }, pos + TIMING.result);
        
        // Highlight result element in array
        if (this.state.arrayValues.includes(value)) {
            const idx = this.state.arrayValues.indexOf(value);
            this.highlightElement(idx, 'result');
        }
        
        this.timelinePosition += TIMING.result + TIMING.pause;
    }

    /**
     * TRANSITION: Fade out pointer
     */
    hidePointer() {
        const tl = this.masterTimeline;
        const pos = this.timelinePosition;
        
        if (this.registry.pointer) {
            tl.to(this.registry.pointer, {
                alpha: 0,
                y: this.registry.pointer.y - 20,
                duration: TIMING.appear,
                ease: EASE.smooth,
            }, pos);
            
            this.timelinePosition += TIMING.appear;
        }
    }

    // =========================================================================
    // HELPER METHODS - Create reusable objects
    // =========================================================================

    createText(content, size, color) {
        return new PIXI.Text({
            text: content,
            style: {
                fontFamily: 'JetBrains Mono, Consolas, monospace',
                fontSize: size,
                fill: color,
                fontWeight: 'bold',
            }
        });
    }

    createArrayElement(value, index, width, height) {
        const container = new PIXI.Container();
        container.name = `elem_${index}`;
        
        // Background
        const bg = new PIXI.Graphics();
        bg.roundRect(-width/2, -height/2, width, height, 10);
        bg.fill(THEME.array.idle.bg);
        bg.setStrokeStyle({ width: 2, color: THEME.array.idle.border });
        bg.stroke();
        bg.name = 'bg';
        
        // Value text
        const text = this.createText(String(value), 22, THEME.array.idle.text);
        text.anchor.set(0.5, 0.5);
        text.name = 'value';
        
        // Index label
        const indexLabel = this.createText(String(index), 12, THEME.text.label);
        indexLabel.anchor.set(0.5, 0);
        indexLabel.y = height/2 + 6;
        indexLabel.name = 'index';
        
        container.addChild(bg, text, indexLabel);
        return container;
    }

    createPointer(label) {
        const container = new PIXI.Container();
        
        // Label
        const labelText = this.createText(label, 14, THEME.pointer.text);
        labelText.anchor.set(0.5, 0.5);
        labelText.name = 'label';
        
        // Arrow
        const arrow = new PIXI.Graphics();
        arrow.setStrokeStyle({ width: 2, color: THEME.pointer.color });
        arrow.moveTo(0, 12);
        arrow.lineTo(0, 28);
        arrow.lineTo(-6, 22);
        arrow.moveTo(0, 28);
        arrow.lineTo(6, 22);
        arrow.stroke();
        
        container.addChild(labelText, arrow);
        return container;
    }

    createVariableBox(name, value) {
        const container = new PIXI.Container();
        
        const bg = new PIXI.Graphics();
        bg.roundRect(-70, -22, 140, 44, 8);
        bg.fill(THEME.variable.bg);
        bg.setStrokeStyle({ width: 2, color: THEME.variable.border });
        bg.stroke();
        bg.name = 'bg';
        
        const text = this.createText(`${name} = ${value}`, 16, THEME.variable.text);
        text.anchor.set(0.5, 0.5);
        text.name = 'value';
        
        container.addChild(bg, text);
        return container;
    }

    createCompBox(value, label, colors) {
        const container = new PIXI.Container();
        
        // Label above
        const labelText = this.createText(label, 12, THEME.text.label);
        labelText.anchor.set(0.5, 0.5);
        labelText.y = -35;
        
        // Box
        const bg = new PIXI.Graphics();
        bg.roundRect(-30, -30, 60, 60, 10);
        bg.fill(colors.bg);
        bg.setStrokeStyle({ width: 2, color: colors.border });
        bg.stroke();
        bg.name = 'bg';
        
        // Value
        const valueText = this.createText(String(value), 24, colors.text);
        valueText.anchor.set(0.5, 0.5);
        
        container.addChild(labelText, bg, valueText);
        return container;
    }

    addGlowEffect(element, color, timelinePos) {
        // Check if glow exists
        let glow = element.getChildByName('glow');
        
        if (!glow) {
            glow = new PIXI.Graphics();
            glow.roundRect(-32, -32, 64, 64, 12);
            glow.fill({ color: color, alpha: 0 });
            glow.name = 'glow';
            element.addChildAt(glow, 0);
        }
        
        // Animate glow in
        this.masterTimeline.to(glow, {
            alpha: 0.4,
            duration: TIMING.highlight,
        }, timelinePos);
        
        // Pulsing
        gsap.to(glow, {
            alpha: 0.15,
            duration: 0.6,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
        });
    }

    clearAll() {
        // Clear all layers except background
        ['arrays', 'pointers', 'variables', 'comparison', 'result', 'ui'].forEach(layer => {
            this.layers[layer]?.removeChildren();
        });
        
        // Reset registry
        this.registry = {
            title: null,
            arrayLabel: null,
            arrayElements: [],
            pointer: null,
            variableBoxes: {},
            comparisonUI: null,
            resultBox: null,
        };
        
        // Reset state
        this.state = {
            arrayName: '',
            arrayValues: [],
            pointerIndex: -1,
            variables: {},
            isInitialized: false,
        };
    }

    // =========================================================================
    // HIGH-LEVEL SCENE API
    // Translates scene data into transition commands
    // =========================================================================

    /**
     * Process a complete story sequence.
     * Takes an array of transition commands and builds the master timeline.
     */
    buildStory(transitions) {
        this.startNewStory();
        
        transitions.forEach(t => {
            switch (t.action) {
                case 'introduce_array':
                    this.introduceArray(t.name, t.values);
                    break;
                case 'move_pointer':
                    this.movePointerTo(t.index, t.label);
                    break;
                case 'highlight':
                    this.highlightElement(t.index, t.style);
                    break;
                case 'reset_element':
                    this.resetElement(t.index);
                    break;
                case 'show_variable':
                    this.showVariable(t.name, t.value, t.highlight);
                    break;
                case 'compare':
                    this.showComparison(t.leftVar, t.leftVal, t.operator, t.rightVar, t.rightVal, t.result);
                    break;
                case 'clear_comparison':
                    this.clearComparison();
                    break;
                case 'show_result':
                    this.showResult(t.title, t.value);
                    break;
                case 'hide_pointer':
                    this.hidePointer();
                    break;
                default:
                    console.warn('Unknown transition:', t.action);
            }
        });
        
        // Auto-play
        this.play();
    }
}

// Singleton
const cinematicDirector = new CinematicDirector();
export default cinematicDirector;
