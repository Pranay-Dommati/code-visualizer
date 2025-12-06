/**
 * Semantic Scene Types
 * ====================
 * 
 * AI outputs WHAT to show, not WHERE.
 * These are the ONLY things AI can request.
 * The rendering engine decides layout, animation, and positioning.
 */

export const SceneType = {
    // Algorithm overview - shows initial state
    ALGORITHM_OVERVIEW: 'algorithm_overview',
    
    // Show array with optional highlights
    ARRAY_VIEW: 'array_view',
    
    // Show variable being created/updated
    VARIABLE_UPDATE: 'variable_update',
    
    // Show comparison between elements
    COMPARISON: 'comparison',
    
    // Show swap animation
    SWAP: 'swap',
    
    // Show pointer movement
    POINTER_MOVE: 'pointer_move',
    
    // Show loop iteration
    LOOP_ITERATION: 'loop_iteration',
    
    // Show function call
    FUNCTION_CALL: 'function_call',
    
    // Show result/conclusion
    RESULT: 'result',
    
    // Clear everything
    CLEAR: 'clear',
};

/**
 * Scene Command Schema
 * AI outputs these semantic instructions.
 * NO x,y coordinates. NO pixel values.
 */
export const SceneCommands = {
    /**
     * Algorithm Overview Scene
     * {
     *   type: 'algorithm_overview',
     *   title: 'Two Sum Algorithm',
     *   arrays: [{ name: 'nums', values: [3, 5, 7, 2] }],
     *   variables: { target: 9 }
     * }
     */
    algorithm_overview: {
        type: 'algorithm_overview',
        title: '',
        arrays: [],
        variables: {},
    },

    /**
     * Array View Scene
     * {
     *   type: 'array_view',
     *   arrayName: 'nums',
     *   values: [3, 5, 7, 2],
     *   highlights: [{ index: 0, color: 'yellow', label: 'current' }],
     *   pointers: [{ name: 'i', index: 0 }, { name: 'j', index: 3 }]
     * }
     */
    array_view: {
        type: 'array_view',
        arrayName: '',
        values: [],
        highlights: [],
        pointers: [],
    },

    /**
     * Variable Update Scene
     * {
     *   type: 'variable_update',
     *   name: 'max_val',
     *   oldValue: 5,
     *   newValue: 7,
     *   operation: 'assign' | 'increment' | 'decrement'
     * }
     */
    variable_update: {
        type: 'variable_update',
        name: '',
        oldValue: null,
        newValue: null,
        operation: 'assign',
    },

    /**
     * Comparison Scene
     * {
     *   type: 'comparison',
     *   left: { source: 'array', name: 'nums', index: 0, value: 3 },
     *   right: { source: 'variable', name: 'target', value: 9 },
     *   operator: '==',
     *   result: false
     * }
     */
    comparison: {
        type: 'comparison',
        left: {},
        right: {},
        operator: '==',
        result: null,
    },

    /**
     * Swap Scene
     * {
     *   type: 'swap',
     *   arrayName: 'nums',
     *   index1: 0,
     *   index2: 3
     * }
     */
    swap: {
        type: 'swap',
        arrayName: '',
        index1: 0,
        index2: 0,
    },

    /**
     * Pointer Move Scene
     * {
     *   type: 'pointer_move',
     *   arrayName: 'nums',
     *   pointerName: 'i',
     *   fromIndex: 0,
     *   toIndex: 1
     * }
     */
    pointer_move: {
        type: 'pointer_move',
        arrayName: '',
        pointerName: '',
        fromIndex: 0,
        toIndex: 0,
    },

    /**
     * Loop Iteration Scene
     * {
     *   type: 'loop_iteration',
     *   loopVar: 'i',
     *   currentValue: 2,
     *   maxValue: 5,
     *   progress: 0.4
     * }
     */
    loop_iteration: {
        type: 'loop_iteration',
        loopVar: '',
        currentValue: 0,
        maxValue: 0,
        progress: 0,
    },

    /**
     * Function Call Scene
     * {
     *   type: 'function_call',
     *   name: 'two_sum',
     *   args: { nums: [3, 5], target: 8 },
     *   returnValue: [0, 1]
     * }
     */
    function_call: {
        type: 'function_call',
        name: '',
        args: {},
        returnValue: null,
    },

    /**
     * Result Scene
     * {
     *   type: 'result',
     *   title: 'Solution Found!',
     *   value: [0, 1],
     *   success: true
     * }
     */
    result: {
        type: 'result',
        title: '',
        value: null,
        success: true,
    },
};

export default SceneType;
