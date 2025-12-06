/**
 * PixiJS Rendering Engine
 * =======================
 * 
 * This is the REAL graphics engine.
 * - GPU-accelerated via WebGL
 * - 60 FPS smooth animations
 * - Perfect layout via LayoutManager
 * - Timeline-synchronized animations via GSAP
 * 
 * AI is the DIRECTOR (says what to show)
 * This engine is the ARTIST (decides how to show it)
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import LayoutManager from './LayoutManager';
import SceneType from './SceneTypes';

// Color palette
const COLORS = {
    background: 0x0f172a,
    backgroundGradientEnd: 0x1e293b,
    gridLine: 0x334155,
    
    // Node colors
    node: {
        default: { fill: 0x1e293b, stroke: 0x475569, text: 0xe2e8f0 },
        yellow: { fill: 0xfbbf24, stroke: 0xf59e0b, text: 0x1f2937, glow: 0xfbbf24 },
        green: { fill: 0x22c55e, stroke: 0x16a34a, text: 0x1f2937, glow: 0x22c55e },
        red: { fill: 0xef4444, stroke: 0xdc2626, text: 0xffffff, glow: 0xef4444 },
        blue: { fill: 0x3b82f6, stroke: 0x2563eb, text: 0xffffff, glow: 0x3b82f6 },
        purple: { fill: 0x8b5cf6, stroke: 0x7c3aed, text: 0xffffff, glow: 0x8b5cf6 },
        orange: { fill: 0xf97316, stroke: 0xea580c, text: 0x1f2937, glow: 0xf97316 },
    },
    
    pointer: 0x10b981,
    label: 0x94a3b8,
    variable: { fill: 0x1e40af, stroke: 0x3b82f6, text: 0xffffff },
    success: 0x22c55e,
    failure: 0xef4444,
};

class RenderingEngine {
    constructor() {
        this.app = null;
        this.layout = null;
        this.containers = {};
        this.elements = new Map();
        this.currentScene = null;
        this.isInitialized = false;
        
        // Animation timeline
        this.timeline = null;
        
        // Callbacks
        this.onAnimationComplete = null;
        this.onSceneChange = null;
    }

    /**
     * Initialize the engine with a canvas container
     */
    async init(container, width, height) {
        if (this.isInitialized) {
            this.resize(width, height);
            return;
        }

        try {
            // Create PixiJS application - v8 API
            this.app = new PIXI.Application();
            await this.app.init({
                width,
                height,
                backgroundColor: COLORS.background,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            // In PixiJS v8, canvas is accessed via app.canvas
            if (this.app.canvas) {
                container.appendChild(this.app.canvas);
            } else if (this.app.view) {
                // Fallback for older versions
                container.appendChild(this.app.view);
            } else {
                throw new Error('PixiJS canvas not available');
            }

            // Create layout manager
            this.layout = new LayoutManager(width, height);

            // Create layer containers (z-order)
            this.containers = {
                background: new PIXI.Container(),
                grid: new PIXI.Container(),
                arrays: new PIXI.Container(),
                pointers: new PIXI.Container(),
                variables: new PIXI.Container(),
                comparison: new PIXI.Container(),
                effects: new PIXI.Container(),
                ui: new PIXI.Container(),
            };

            // Add containers in order
            Object.values(this.containers).forEach(c => this.app.stage.addChild(c));

            // Draw background and grid
            this.drawBackground();
            this.drawGrid();

            this.isInitialized = true;
            console.log('🎮 PixiJS Rendering Engine initialized');
        } catch (err) {
            console.error('PixiJS initialization failed:', err);
            throw err;
        }
    }

    /**
     * Draw gradient background
     */
    drawBackground() {
        if (!this.app || !this.app.screen) return;
        
        const { width, height } = this.app.screen;
        
        // Create gradient using a graphics object
        const bg = new PIXI.Graphics();
        bg.rect(0, 0, width, height);
        bg.fill(COLORS.background);
        
        this.containers.background.removeChildren();
        this.containers.background.addChild(bg);
    }

    /**
     * Draw subtle grid
     */
    drawGrid() {
        if (!this.app || !this.app.screen) return;
        
        const { width, height } = this.app.screen;
        const grid = new PIXI.Graphics();
        
        grid.setStrokeStyle({ width: 1, color: COLORS.gridLine, alpha: 0.3 });
        
        const gridSize = 40;
        
        for (let x = 0; x < width; x += gridSize) {
            grid.moveTo(x, 0);
            grid.lineTo(x, height);
        }
        for (let y = 0; y < height; y += gridSize) {
            grid.moveTo(0, y);
            grid.lineTo(width, y);
        }
        grid.stroke();
        
        this.containers.grid.removeChildren();
        this.containers.grid.addChild(grid);
    }

    /**
     * Resize the engine
     */
    resize(width, height) {
        if (!this.app) return;
        
        this.app.renderer.resize(width, height);
        this.layout?.resize(width, height);
        this.drawBackground();
        this.drawGrid();
        
        // Re-render current scene with new layout
        if (this.currentScene) {
            this.renderScene(this.currentScene, { animate: false });
        }
    }

    /**
     * Main scene rendering method
     * This is the ONLY entry point for rendering
     */
    async renderScene(sceneData, options = {}) {
        const { animate = true, duration = 0.5 } = options;
        
        if (!this.isInitialized) {
            console.warn('Engine not initialized');
            return;
        }

        this.currentScene = sceneData;
        
        // Kill any running animations
        if (this.timeline) {
            this.timeline.kill();
        }
        this.timeline = gsap.timeline({
            onComplete: () => {
                if (this.onAnimationComplete) {
                    this.onAnimationComplete();
                }
            }
        });

        switch (sceneData.type) {
            case SceneType.ALGORITHM_OVERVIEW:
                await this.renderAlgorithmOverview(sceneData, animate, duration);
                break;
            case SceneType.ARRAY_VIEW:
                await this.renderArrayView(sceneData, animate, duration);
                break;
            case SceneType.VARIABLE_UPDATE:
                await this.renderVariableUpdate(sceneData, animate, duration);
                break;
            case SceneType.COMPARISON:
                await this.renderComparison(sceneData, animate, duration);
                break;
            case SceneType.SWAP:
                await this.renderSwap(sceneData, animate, duration);
                break;
            case SceneType.POINTER_MOVE:
                await this.renderPointerMove(sceneData, animate, duration);
                break;
            case SceneType.RESULT:
                await this.renderResult(sceneData, animate, duration);
                break;
            case SceneType.CLEAR:
                this.clear();
                break;
            default:
                console.warn('Unknown scene type:', sceneData.type);
        }

        if (this.onSceneChange) {
            this.onSceneChange(sceneData);
        }
    }

    /**
     * Render Algorithm Overview scene
     */
    async renderAlgorithmOverview(scene, animate, duration) {
        this.clear();
        
        // Title
        const titleLayout = this.layout.getTitleLayout(scene.title || 'Algorithm Overview');
        const title = this.createText(titleLayout.text, {
            fontSize: titleLayout.fontSize,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        title.anchor.set(0.5, 0.5);
        title.x = titleLayout.x;
        title.y = titleLayout.y;
        
        if (animate) {
            title.alpha = 0;
            title.y -= 20;
            this.timeline.to(title, { alpha: 1, y: titleLayout.y, duration: 0.4, ease: 'back.out' }, 0);
        }
        
        this.containers.ui.addChild(title);
        
        // Arrays
        if (scene.arrays && scene.arrays.length > 0) {
            scene.arrays.forEach((arr, rowIndex) => {
                const layout = this.layout.getArrayLayout(arr.name, arr.values, { row: rowIndex });
                this.renderArray(layout, arr.highlights || [], animate, duration, rowIndex * 0.1);
            });
        }
        
        // Variables
        if (scene.variables && Object.keys(scene.variables).length > 0) {
            const varsLayout = this.layout.getVariablesLayout(scene.variables);
            this.renderVariables(varsLayout, animate, duration);
        }
    }

    /**
     * Render Array View scene
     */
    async renderArrayView(scene, animate, duration) {
        const layout = this.layout.getArrayLayout(scene.arrayName, scene.values);
        
        // Clear existing array
        this.clearContainer(this.containers.arrays);
        this.clearContainer(this.containers.pointers);
        
        // Render array
        this.renderArray(layout, scene.highlights || [], animate, duration);
        
        // Render pointers
        if (scene.pointers && scene.pointers.length > 0) {
            const pointerLayout = this.layout.getPointerLayout(layout, scene.pointers);
            this.renderPointers(pointerLayout, animate, duration);
        }
    }

    /**
     * Render an array with elements
     */
    renderArray(layout, highlights, animate, duration, delay = 0) {
        // Array label
        const label = this.createText(layout.label.text, {
            fontSize: 18,
            fill: COLORS.label,
        });
        label.anchor.set(1, 0.5);
        label.x = layout.label.x;
        label.y = layout.label.y;
        
        if (animate) {
            label.alpha = 0;
            this.timeline.to(label, { alpha: 1, duration: 0.3 }, delay);
        }
        
        this.containers.arrays.addChild(label);
        
        // Array elements
        layout.elements.forEach((elem, idx) => {
            const highlight = highlights.find(h => h.index === idx);
            const colorName = highlight?.color || 'default';
            const colors = COLORS.node[colorName] || COLORS.node.default;
            
            // Element container
            const container = new PIXI.Container();
            container.x = elem.x;
            container.y = elem.y;
            container.name = elem.id;
            
            // Background
            const bg = new PIXI.Graphics();
            bg.roundRect(-elem.width / 2, -elem.height / 2, elem.width, elem.height, 8);
            bg.fill(colors.fill);
            bg.setStrokeStyle({ width: 2, color: colors.stroke });
            bg.stroke();
            
            // Value text
            const text = this.createText(elem.value, {
                fontSize: 20,
                fill: colors.text,
                fontWeight: 'bold',
            });
            text.anchor.set(0.5, 0.5);
            
            // Index below
            const indexText = this.createText(String(elem.index), {
                fontSize: 14,
                fill: COLORS.label,
            });
            indexText.anchor.set(0.5, 0);
            indexText.y = elem.height / 2 + 5;
            
            container.addChild(bg, text, indexText);
            
            // Glow effect for highlighted elements
            if (highlight && colors.glow) {
                const glow = new PIXI.Graphics();
                glow.roundRect(-elem.width / 2 - 4, -elem.height / 2 - 4, elem.width + 8, elem.height + 8, 10);
                glow.fill({ color: colors.glow, alpha: 0.3 });
                container.addChildAt(glow, 0);
                
                // Pulsing glow animation
                gsap.to(glow, {
                    alpha: 0.1,
                    duration: 0.8,
                    repeat: -1,
                    yoyo: true,
                    ease: 'sine.inOut',
                });
            }
            
            // Animate in
            if (animate) {
                container.alpha = 0;
                container.scale.set(0.5);
                this.timeline.to(container, {
                    alpha: 1,
                    pixi: { scale: 1 },
                    duration: 0.4,
                    ease: 'back.out(1.7)',
                }, delay + idx * 0.05);
            }
            
            this.containers.arrays.addChild(container);
            this.elements.set(elem.id, container);
        });
    }

    /**
     * Render pointers above array
     */
    renderPointers(pointerLayout, animate, duration) {
        pointerLayout.forEach((ptr, idx) => {
            const container = new PIXI.Container();
            container.x = ptr.x;
            container.y = ptr.y;
            container.name = ptr.id;
            
            // Pointer label
            const label = this.createText(ptr.name, {
                fontSize: 16,
                fill: COLORS.pointer,
                fontWeight: 'bold',
            });
            label.anchor.set(0.5, 0.5);
            
            // Arrow pointing down
            const arrow = new PIXI.Graphics();
            arrow.setStrokeStyle({ width: 2, color: COLORS.pointer });
            arrow.moveTo(0, 12);
            arrow.lineTo(0, 25);
            arrow.lineTo(-5, 20);
            arrow.moveTo(0, 25);
            arrow.lineTo(5, 20);
            arrow.stroke();
            
            container.addChild(label, arrow);
            
            if (animate) {
                container.alpha = 0;
                container.y -= 15;
                this.timeline.to(container, {
                    alpha: 1,
                    y: ptr.y,
                    duration: 0.4,
                    ease: 'back.out',
                }, idx * 0.1);
            }
            
            this.containers.pointers.addChild(container);
            this.elements.set(ptr.id, container);
        });
    }

    /**
     * Render variables panel
     */
    renderVariables(varsLayout, animate, duration) {
        this.clearContainer(this.containers.variables);
        
        varsLayout.forEach((v, idx) => {
            const container = new PIXI.Container();
            container.x = v.x;
            container.y = v.y;
            container.name = v.id;
            
            // Background box
            const bg = new PIXI.Graphics();
            bg.roundRect(-v.width / 2, -v.height / 2, v.width, v.height, 6);
            bg.fill(COLORS.variable.fill);
            bg.setStrokeStyle({ width: 1, color: COLORS.variable.stroke });
            bg.stroke();
            
            // Name = value text
            const text = this.createText(`${v.name} = ${v.value}`, {
                fontSize: 14,
                fill: COLORS.variable.text,
            });
            text.anchor.set(0.5, 0.5);
            
            container.addChild(bg, text);
            
            if (animate) {
                container.alpha = 0;
                container.x -= 20;
                this.timeline.to(container, {
                    alpha: 1,
                    x: v.x,
                    duration: 0.3,
                    ease: 'power2.out',
                }, idx * 0.05);
            }
            
            this.containers.variables.addChild(container);
            this.elements.set(v.id, container);
        });
    }

    /**
     * Render variable update with animation
     */
    async renderVariableUpdate(scene, animate, duration) {
        const varId = `var_${scene.name}`;
        const existing = this.elements.get(varId);
        
        if (existing) {
            // Flash effect
            const flash = new PIXI.Graphics();
            flash.rect(-50, -25, 100, 50);
            flash.fill({ color: 0xfbbf24, alpha: 0.5 });
            existing.addChild(flash);
            
            this.timeline.to(flash, { alpha: 0, duration: 0.5 }, 0);
            
            // Update text
            const textChild = existing.children.find(c => c instanceof PIXI.Text);
            if (textChild) {
                this.timeline.to(textChild, {
                    pixi: { scale: 1.2 },
                    duration: 0.2,
                    yoyo: true,
                    repeat: 1,
                }, 0);
                
                setTimeout(() => {
                    textChild.text = `${scene.name} = ${scene.newValue}`;
                }, duration * 500);
            }
        }
    }

    /**
     * Render comparison visualization
     */
    async renderComparison(scene, animate, duration) {
        this.clearContainer(this.containers.comparison);
        
        const layout = this.layout.getComparisonLayout(
            scene.left,
            scene.operator,
            scene.right,
            scene.result
        );
        
        // Left value box
        const leftBox = this.createValueBox(layout.left);
        
        // Operator
        const operator = this.createText(layout.operator.text, {
            fontSize: 24,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        operator.anchor.set(0.5, 0.5);
        operator.x = layout.operator.x;
        operator.y = layout.operator.y;
        
        // Right value box
        const rightBox = this.createValueBox(layout.right);
        
        // Result
        const result = this.createText(layout.result.text, {
            fontSize: 20,
            fill: layout.result.color === '#22c55e' ? COLORS.success : COLORS.failure,
            fontWeight: 'bold',
        });
        result.anchor.set(0.5, 0.5);
        result.x = layout.result.x;
        result.y = layout.result.y;
        
        [leftBox, operator, rightBox, result].forEach(el => {
            this.containers.comparison.addChild(el);
        });
        
        if (animate) {
            [leftBox, rightBox].forEach(box => {
                box.alpha = 0;
                box.scale.set(0.8);
            });
            operator.alpha = 0;
            result.alpha = 0;
            
            this.timeline.to(leftBox, { alpha: 1, pixi: { scale: 1 }, duration: 0.3, ease: 'back.out' }, 0);
            this.timeline.to(rightBox, { alpha: 1, pixi: { scale: 1 }, duration: 0.3, ease: 'back.out' }, 0.1);
            this.timeline.to(operator, { alpha: 1, duration: 0.2 }, 0.2);
            this.timeline.to(result, { alpha: 1, duration: 0.3, ease: 'back.out' }, 0.4);
        }
    }

    /**
     * Render swap animation
     */
    async renderSwap(scene, animate, duration) {
        const elem1 = this.elements.get(`${scene.arrayName}_${scene.index1}`);
        const elem2 = this.elements.get(`${scene.arrayName}_${scene.index2}`);
        
        if (!elem1 || !elem2) return;
        
        const x1 = elem1.x;
        const x2 = elem2.x;
        
        // Swap animation with arc
        this.timeline.to(elem1, {
            x: x2,
            y: elem1.y - 40,
            duration: duration / 2,
            ease: 'power2.inOut',
        }, 0);
        this.timeline.to(elem1, {
            y: elem1.y,
            duration: duration / 2,
            ease: 'power2.inOut',
        }, duration / 2);
        
        this.timeline.to(elem2, {
            x: x1,
            y: elem2.y + 40,
            duration: duration / 2,
            ease: 'power2.inOut',
        }, 0);
        this.timeline.to(elem2, {
            y: elem2.y,
            duration: duration / 2,
            ease: 'power2.inOut',
        }, duration / 2);
        
        // Swap references
        this.elements.set(`${scene.arrayName}_${scene.index1}`, elem2);
        this.elements.set(`${scene.arrayName}_${scene.index2}`, elem1);
    }

    /**
     * Render pointer move animation
     */
    async renderPointerMove(scene, animate, duration) {
        const ptr = this.elements.get(`ptr_${scene.pointerName}`);
        if (!ptr) return;
        
        const layout = this.layout.getArrayLayout(scene.arrayName, 
            Array(Math.max(scene.fromIndex, scene.toIndex) + 1).fill(0));
        const targetElem = layout.elements[scene.toIndex];
        
        if (targetElem && animate) {
            this.timeline.to(ptr, {
                x: targetElem.x,
                duration: duration,
                ease: 'power2.inOut',
            }, 0);
        }
    }

    /**
     * Render result/conclusion
     */
    async renderResult(scene, animate, duration) {
        const layout = this.layout.getResultLayout(scene.title, scene.value, scene.success);
        
        const container = new PIXI.Container();
        container.x = layout.x;
        container.y = layout.y;
        
        // Background
        const bg = new PIXI.Graphics();
        bg.roundRect(-layout.width / 2, -layout.height / 2, layout.width, layout.height, 12);
        bg.fill(scene.success ? COLORS.success : COLORS.failure);
        
        // Title
        const title = this.createText(layout.title, {
            fontSize: 18,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        title.anchor.set(0.5, 0.5);
        title.y = -15;
        
        // Value
        const value = this.createText(layout.value, {
            fontSize: 24,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        value.anchor.set(0.5, 0.5);
        value.y = 15;
        
        container.addChild(bg, title, value);
        
        if (animate) {
            container.alpha = 0;
            container.scale.set(0.5);
            this.timeline.to(container, {
                alpha: 1,
                pixi: { scale: 1 },
                duration: 0.5,
                ease: 'elastic.out(1, 0.5)',
            }, 0);
        }
        
        this.containers.ui.addChild(container);
    }

    /**
     * Create a value box for comparisons
     */
    createValueBox(layout) {
        const container = new PIXI.Container();
        container.x = layout.x;
        container.y = layout.y;
        
        const bg = new PIXI.Graphics();
        bg.roundRect(-layout.width / 2, -layout.height / 2, layout.width, layout.height, 8);
        bg.fill(COLORS.node.blue.fill);
        bg.setStrokeStyle({ width: 2, color: COLORS.node.blue.stroke });
        bg.stroke();
        
        const label = this.createText(layout.label, {
            fontSize: 12,
            fill: COLORS.label,
        });
        label.anchor.set(0.5, 0.5);
        label.y = -18;
        
        const value = this.createText(layout.value, {
            fontSize: 22,
            fill: COLORS.node.blue.text,
            fontWeight: 'bold',
        });
        value.anchor.set(0.5, 0.5);
        value.y = 5;
        
        container.addChild(bg, label, value);
        return container;
    }

    /**
     * Create text helper
     */
    createText(content, style = {}) {
        return new PIXI.Text({
            text: content,
            style: {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: style.fontSize || 16,
                fill: style.fill || 0xffffff,
                fontWeight: style.fontWeight || 'normal',
            },
        });
    }

    /**
     * Clear a container
     */
    clearContainer(container) {
        while (container.children.length > 0) {
            const child = container.children[0];
            container.removeChild(child);
            child.destroy({ children: true });
        }
    }

    /**
     * Clear all visualization
     */
    clear() {
        Object.entries(this.containers).forEach(([name, container]) => {
            if (name !== 'background' && name !== 'grid') {
                this.clearContainer(container);
            }
        });
        this.elements.clear();
    }

    /**
     * Destroy the engine
     */
    destroy() {
        if (this.timeline) {
            this.timeline.kill();
        }
        if (this.app) {
            this.app.destroy(true, { children: true });
        }
        this.isInitialized = false;
    }
}

// Singleton
const renderingEngine = new RenderingEngine();
export default renderingEngine;
