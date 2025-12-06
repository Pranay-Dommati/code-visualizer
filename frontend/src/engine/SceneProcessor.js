/**
 * Scene Processor
 * ================
 * 
 * Converts execution steps from the backend timeline
 * into semantic scene commands for the rendering engine.
 * 
 * This is the TRANSLATOR between:
 * - Backend timeline steps (code execution trace)
 * - Frontend scene commands (semantic visualization)
 */

import SceneType from './SceneTypes';

class SceneProcessor {
    constructor() {
        this.currentArrays = new Map();
        this.currentVariables = {};
        this.currentPointers = {};
    }

    /**
     * Process a timeline step and generate scene command
     * 
     * NEW: Handles both formats:
     * 1. Direct scene from agent: { scene: { type, arrays, variables, ... } }
     * 2. Legacy step format: { phase, variables, visualization_commands, ... }
     */
    processStep(step) {
        // NEW: If the step already contains a scene object from the agent, use it directly!
        if (step.scene) {
            console.log('🎬 Using direct scene from agent:', step.scene.type);
            // Map scene type strings to our constants
            const scene = step.scene;
            const mappedType = this.mapSceneType(scene.type);
            return {
                ...scene,
                type: mappedType,
            };
        }
        
        // Legacy format handling
        const { phase, variables, visualization_commands, highlight_indices } = step;
        
        // Update internal state
        if (variables) {
            this.currentVariables = { ...this.currentVariables, ...variables };
        }

        // Generate scene based on phase
        switch (phase) {
            case 'overview':
                return this.createOverviewScene(step);
            case 'initialization':
                return this.createInitializationScene(step);
            case 'iteration':
            case 'comparison':
            case 'update':
                return this.createExecutionScene(step);
            case 'result':
                return this.createResultScene(step);
            default:
                return this.createGenericScene(step);
        }
    }
    
    /**
     * Map scene type strings from backend to frontend constants
     */
    mapSceneType(typeString) {
        const typeMap = {
            'algorithm_overview': SceneType.ALGORITHM_OVERVIEW,
            'array_visualization': SceneType.ARRAY_VIEW,
            'array_view': SceneType.ARRAY_VIEW,
            'comparison': SceneType.COMPARISON,
            'step_execution': SceneType.STEP_EXECUTION,
            'result': SceneType.RESULT,
            'value_update': SceneType.STEP_EXECUTION,
            'swap': SceneType.STEP_EXECUTION,
            'pivot_selection': SceneType.COMPARISON,
            'initialization': SceneType.ALGORITHM_OVERVIEW,
        };
        return typeMap[typeString] || SceneType.ALGORITHM_OVERVIEW;
    }

    /**
     * Create algorithm overview scene
     */
    createOverviewScene(step) {
        const arrays = this.extractArrays(step);
        const variables = this.extractVariables(step);
        
        return {
            type: SceneType.ALGORITHM_OVERVIEW,
            title: step.description || 'Algorithm Overview',
            arrays,
            variables,
        };
    }

    /**
     * Create initialization scene
     */
    createInitializationScene(step) {
        const arrays = this.extractArrays(step);
        const variables = this.extractVariables(step);
        const highlights = this.extractHighlights(step);
        
        // If we have an array being initialized
        if (arrays.length > 0) {
            const arr = arrays[0];
            return {
                type: SceneType.ARRAY_VIEW,
                arrayName: arr.name,
                values: arr.values,
                highlights,
                pointers: this.extractPointers(step),
            };
        }
        
        // Variable initialization
        return {
            type: SceneType.ALGORITHM_OVERVIEW,
            title: step.description || 'Initialization',
            arrays,
            variables,
        };
    }

    /**
     * Create execution scene (iteration, comparison, update)
     */
    createExecutionScene(step) {
        const commands = step.visualization_commands || [];
        const phase = step.phase;
        
        // Look for comparison commands
        const comparisonCmd = commands.find(c => 
            c.action === 'draw_comparison' || 
            c.action === 'comparison'
        );
        
        if (comparisonCmd || phase === 'comparison') {
            return this.createComparisonScene(step, comparisonCmd);
        }
        
        // Look for pointer movement
        const pointerCmd = commands.find(c => 
            c.action === 'move_pointer' || 
            c.action === 'draw_pointer'
        );
        
        // Default: show current array state with highlights
        const arrays = this.extractArrays(step);
        const highlights = this.extractHighlights(step);
        
        if (arrays.length > 0) {
            const arr = arrays[0];
            return {
                type: SceneType.ARRAY_VIEW,
                arrayName: arr.name,
                values: arr.values,
                highlights,
                pointers: this.extractPointers(step),
            };
        }
        
        // Fallback
        return {
            type: SceneType.ALGORITHM_OVERVIEW,
            title: step.description,
            arrays,
            variables: this.extractVariables(step),
        };
    }

    /**
     * Create comparison scene
     */
    createComparisonScene(step, command) {
        const variables = step.variables || {};
        const highlights = step.highlight_indices || [];
        
        // Try to extract comparison info from command or description
        let left = { source: 'literal', value: '?' };
        let right = { source: 'literal', value: '?' };
        let operator = '==';
        let result = null;
        
        if (command) {
            left = {
                source: command.left_source || 'array',
                name: command.left_name || 'nums',
                index: command.left_index,
                value: command.left_value,
            };
            right = {
                source: command.right_source || 'variable',
                name: command.right_name || 'target',
                value: command.right_value,
            };
            operator = command.operator || '==';
            result = command.result;
        } else {
            // Extract from description or variables
            // e.g., "Comparing nums[0] (3) with target (9)"
            const desc = step.description || '';
            const match = desc.match(/(\w+)\[(\d+)\]\s*\((\d+)\)\s*(?:with|to|==)\s*(\w+)\s*\((\d+)\)/i);
            if (match) {
                left = { source: 'array', name: match[1], index: parseInt(match[2]), value: parseInt(match[3]) };
                right = { source: 'variable', name: match[4], value: parseInt(match[5]) };
            }
        }
        
        return {
            type: SceneType.COMPARISON,
            left,
            right,
            operator,
            result,
        };
    }

    /**
     * Create result scene
     */
    createResultScene(step) {
        const variables = step.variables || {};
        const success = step.description?.toLowerCase().includes('found') ||
                       step.description?.toLowerCase().includes('success') ||
                       step.description?.toLowerCase().includes('complete');
        
        // Try to find the result value
        let resultValue = 'Done';
        if (variables.result !== undefined) {
            resultValue = JSON.stringify(variables.result);
        } else if (variables.return_value !== undefined) {
            resultValue = JSON.stringify(variables.return_value);
        }
        
        return {
            type: SceneType.RESULT,
            title: step.description || 'Result',
            value: resultValue,
            success,
        };
    }

    /**
     * Create generic scene
     */
    createGenericScene(step) {
        return {
            type: SceneType.ALGORITHM_OVERVIEW,
            title: step.description || 'Step',
            arrays: this.extractArrays(step),
            variables: this.extractVariables(step),
        };
    }

    /**
     * Extract arrays from step
     */
    extractArrays(step) {
        const arrays = [];
        const variables = step.variables || {};
        const commands = step.visualization_commands || [];
        
        // Look for array drawing commands
        const arrayCmd = commands.find(c => c.action === 'draw_array');
        if (arrayCmd) {
            arrays.push({
                name: arrayCmd.label || arrayCmd.id || 'array',
                values: arrayCmd.elements || [],
            });
            // Cache for later
            this.currentArrays.set(arrayCmd.id || 'array', arrayCmd.elements);
        }
        
        // Look for arrays in variables
        for (const [name, value] of Object.entries(variables)) {
            if (Array.isArray(value)) {
                // Check if we already added this
                if (!arrays.find(a => a.name === name)) {
                    arrays.push({ name, values: value });
                    this.currentArrays.set(name, value);
                }
            }
        }
        
        // If no arrays found but we have cached ones, use them
        if (arrays.length === 0 && this.currentArrays.size > 0) {
            for (const [name, values] of this.currentArrays) {
                arrays.push({ name, values });
            }
        }
        
        return arrays;
    }

    /**
     * Extract non-array variables
     */
    extractVariables(step) {
        const variables = step.variables || {};
        const result = {};
        
        for (const [name, value] of Object.entries(variables)) {
            if (!Array.isArray(value) && typeof value !== 'object') {
                result[name] = value;
            }
        }
        
        return result;
    }

    /**
     * Extract highlights from step
     */
    extractHighlights(step) {
        const highlights = [];
        const indices = step.highlight_indices || [];
        const commands = step.visualization_commands || [];
        
        // From highlight indices
        indices.forEach((idx, i) => {
            highlights.push({
                index: idx,
                color: i === 0 ? 'yellow' : 'blue',
                label: '',
            });
        });
        
        // From commands
        commands
            .filter(c => c.action === 'highlight_index')
            .forEach(c => {
                if (!highlights.find(h => h.index === c.index)) {
                    highlights.push({
                        index: c.index,
                        color: c.color || 'yellow',
                        label: c.label || '',
                    });
                }
            });
        
        return highlights;
    }

    /**
     * Extract pointers from step
     */
    extractPointers(step) {
        const pointers = [];
        const commands = step.visualization_commands || [];
        const variables = step.variables || {};
        
        // From commands
        commands
            .filter(c => c.action === 'draw_pointer' || c.action === 'move_pointer')
            .forEach(c => {
                pointers.push({
                    name: c.label || c.id || 'ptr',
                    index: c.index ?? c.targetIndex ?? 0,
                });
            });
        
        // Common pointer variable names
        const pointerNames = ['i', 'j', 'left', 'right', 'start', 'end', 'idx', 'index'];
        for (const name of pointerNames) {
            if (typeof variables[name] === 'number' && !pointers.find(p => p.name === name)) {
                pointers.push({ name, index: variables[name] });
            }
        }
        
        return pointers;
    }

    /**
     * Reset processor state
     */
    reset() {
        this.currentArrays.clear();
        this.currentVariables = {};
        this.currentPointers = {};
    }
}

export const sceneProcessor = new SceneProcessor();
export default sceneProcessor;
