import { canvasStateManager } from './CanvasStateManager';

class CommandProcessor {
    constructor() {
        // Track arrays and their positions for pointer references
        this.arrayPositions = new Map();
    }

    process(command) {
        if (!command || !command.action) return;

        console.log('🎨 Processing command:', command);

        switch (command.action) {
            case 'draw_node':
                canvasStateManager.addNode({
                    id: command.id,
                    x: command.x || 100,
                    y: command.y || 100,
                    value: String(command.value || ''),
                    type: command.type || 'circle',
                    highlight: command.highlight || false,
                    color: command.color || null
                });
                break;
                
            case 'draw_array':
                this.drawArray(command);
                break;
                
            case 'highlight_index':
                this.highlightArrayIndex(command);
                break;
                
            case 'draw_pointer':
                this.drawPointer(command);
                break;
            
            case 'draw_variable':
                this.drawVariable(command);
                break;
            
            case 'draw_comparison':
                this.drawComparison(command);
                break;
            
            case 'draw_loop_indicator':
                this.drawLoopIndicator(command);
                break;
            
            case 'draw_arrow':
                this.drawArrow(command);
                break;
            
            case 'draw_label':
                this.drawLabel(command);
                break;
            
            case 'animate_swap':
                this.animateSwap(command);
                break;
            
            case 'move_pointer':
                this.movePointer(command);
                break;
            
            case 'pulse_element':
                this.pulseElement(command);
                break;
            
            case 'show_message':
                this.showMessage(command);
                break;
            
            case 'highlight_code_line':
                this.highlightCodeLine(command);
                break;
                
            case 'update_node':
                canvasStateManager.updateNode(command.id, {
                    value: command.value !== undefined ? String(command.value) : undefined,
                    highlight: command.highlight,
                    x: command.x,
                    y: command.y,
                    color: command.color
                });
                break;
                
            case 'delete_node':
                canvasStateManager.deleteNode(command.id);
                break;
                
            case 'connect_nodes':
                canvasStateManager.addEdge({
                    id: command.id || `${command.from}-${command.to}`,
                    from: command.from,
                    to: command.to,
                    label: command.label || '',
                    type: command.type || 'arrow'
                });
                break;
                
            case 'clear_canvas':
                canvasStateManager.clear();
                this.arrayPositions.clear();
                break;
                
            default:
                console.warn('Unknown command action:', command.action);
        }
    }
    
    drawArray(command) {
        const { id, elements, x = 100, y = 100, label } = command;
        const nodeWidth = 60;
        const nodeGap = 10;
        
        if (!elements || !Array.isArray(elements)) return;
        
        // Store array position for pointer references
        this.arrayPositions.set(id, { x, y, nodeWidth, nodeGap, length: elements.length });
        
        // Clear previous array with same id if exists
        for (let i = 0; i < 100; i++) {
            canvasStateManager.deleteNode(`${id}_${i}`);
        }
        canvasStateManager.deleteNode(`${id}_label`);
        canvasStateManager.deleteNode(`${id}_indices`);
        
        // Draw array label if provided
        if (label) {
            canvasStateManager.addNode({
                id: `${id}_label`,
                x: x - 10,
                y: y - 35,
                value: label,
                type: 'label',
                highlight: false
            });
        }
        
        // Draw each element as a node
        elements.forEach((value, index) => {
            canvasStateManager.addNode({
                id: `${id}_${index}`,
                x: x + index * (nodeWidth + nodeGap),
                y: y,
                value: String(value),
                type: 'rect',
                arrayId: id,
                index: index,
                highlight: false
            });
            
            // Draw index number below each element
            canvasStateManager.addNode({
                id: `${id}_idx_${index}`,
                x: x + index * (nodeWidth + nodeGap),
                y: y + 45,
                value: String(index),
                type: 'index',
                highlight: false
            });
        });
        
        console.log(`📊 Drew array "${id}" with ${elements.length} elements`);
    }
    
    highlightArrayIndex(command) {
        const { id, array_id, index, color = 'yellow', highlight = true } = command;
        const arrayName = id || array_id;
        const nodeId = `${arrayName}_${index}`;
        canvasStateManager.updateNode(nodeId, { highlight, color });
        console.log(`✨ Highlighted index ${index} in array "${arrayName}" with color ${color}`);
    }
    
    drawPointer(command) {
        const { id, targetId, array_id, index, label, y_offset = -50 } = command;
        const arrayName = targetId || array_id;
        const pointerLabel = label || id;
        
        // Get array position
        const arrayPos = this.arrayPositions.get(arrayName);
        const nodeWidth = arrayPos?.nodeWidth || 60;
        const nodeGap = arrayPos?.nodeGap || 10;
        const baseX = arrayPos?.x || 100;
        const baseY = arrayPos?.y || 100;
        
        const pointerX = baseX + index * (nodeWidth + nodeGap);
        const pointerY = baseY + y_offset;
        
        canvasStateManager.addNode({
            id: `ptr_${id || pointerLabel}`,
            x: pointerX,
            y: pointerY,
            value: pointerLabel,
            type: 'pointer',
            targetIndex: index,
            highlight: true
        });
        
        console.log(`👆 Drew pointer "${pointerLabel}" at index ${index}`);
    }
    
    drawVariable(command) {
        const { id, name, value, x = 100, y = 200, highlight = false } = command;
        
        canvasStateManager.addNode({
            id: `var_${id || name}`,
            x: x,
            y: y,
            value: `${name} = ${value}`,
            type: 'variable',
            highlight: highlight
        });
        
        console.log(`📦 Drew variable "${name}" = ${value}`);
    }
    
    drawComparison(command) {
        const { id, left, operator, right, result, x = 100, y = 250 } = command;
        
        const compText = `${left} ${operator} ${right} → ${result}`;
        
        canvasStateManager.addNode({
            id: `comp_${id || 'comparison'}`,
            x: x,
            y: y,
            value: compText,
            type: 'comparison',
            highlight: result === true || result === 'true'
        });
        
        console.log(`⚖️ Drew comparison: ${compText}`);
    }
    
    drawLoopIndicator(command) {
        const { id, iteration, variable, x = 50, y = 100 } = command;
        
        canvasStateManager.addNode({
            id: `loop_${id || 'loop'}`,
            x: x,
            y: y,
            value: `Loop ${iteration}: ${variable}`,
            type: 'loop',
            highlight: true
        });
        
        console.log(`🔄 Drew loop indicator: iteration ${iteration}`);
    }
    
    drawArrow(command) {
        const { id, fromX, fromY, toX, toY, label, color = '#10B981' } = command;
        
        canvasStateManager.addEdge({
            id: `arrow_${id || Date.now()}`,
            fromX, fromY,
            toX, toY,
            label: label || '',
            type: 'arrow',
            color: color
        });
        
        console.log(`➡️ Drew arrow from (${fromX},${fromY}) to (${toX},${toY})`);
    }
    
    drawLabel(command) {
        const { id, text, x, y, color = '#FFFFFF' } = command;
        
        canvasStateManager.addNode({
            id: `label_${id || Date.now()}`,
            x: x,
            y: y,
            value: text,
            type: 'label',
            color: color,
            highlight: false
        });
        
        console.log(`🏷️ Drew label: "${text}"`);
    }
    
    animateSwap(command) {
        const { array_id, index1, index2, duration = 500 } = command;
        
        // Get current values
        const node1Id = `${array_id}_${index1}`;
        const node2Id = `${array_id}_${index2}`;
        
        // Highlight both nodes being swapped
        canvasStateManager.updateNode(node1Id, { highlight: true, color: 'purple' });
        canvasStateManager.updateNode(node2Id, { highlight: true, color: 'purple' });
        
        // Get positions
        const arrayPos = this.arrayPositions.get(array_id);
        if (arrayPos) {
            const nodeWidth = arrayPos.nodeWidth;
            const nodeGap = arrayPos.nodeGap;
            const baseX = arrayPos.x;
            const baseY = arrayPos.y;
            
            // Swap positions with animation delay
            setTimeout(() => {
                canvasStateManager.updateNode(node1Id, { 
                    x: baseX + index2 * (nodeWidth + nodeGap),
                    highlight: true, 
                    color: 'green' 
                });
                canvasStateManager.updateNode(node2Id, { 
                    x: baseX + index1 * (nodeWidth + nodeGap),
                    highlight: true, 
                    color: 'green' 
                });
            }, duration / 2);
            
            // Clear highlight after animation
            setTimeout(() => {
                canvasStateManager.updateNode(node1Id, { highlight: false });
                canvasStateManager.updateNode(node2Id, { highlight: false });
            }, duration);
        }
        
        console.log(`🔄 Animating swap in "${array_id}": index ${index1} ↔ ${index2}`);
    }
    
    // Animate pointer movement
    movePointer(command) {
        const { id, targetId, newIndex, duration = 300 } = command;
        const pointerId = `ptr_${id}`;
        
        const arrayPos = this.arrayPositions.get(targetId);
        if (arrayPos) {
            const nodeWidth = arrayPos.nodeWidth;
            const nodeGap = arrayPos.nodeGap;
            const newX = arrayPos.x + newIndex * (nodeWidth + nodeGap);
            const newY = arrayPos.y - 50;
            
            canvasStateManager.updateNode(pointerId, { 
                x: newX, 
                y: newY,
                targetIndex: newIndex 
            });
            
            console.log(`👆 Moving pointer "${id}" to index ${newIndex}`);
        }
    }
    
    // Pulse/flash an element for emphasis
    pulseElement(command) {
        const { id, color = 'yellow', duration = 400 } = command;
        
        canvasStateManager.updateNode(id, { highlight: true, color });
        
        setTimeout(() => {
            canvasStateManager.updateNode(id, { highlight: false });
        }, duration);
        
        console.log(`✨ Pulsing element "${id}"`);
    }
    
    // Show a temporary message/annotation
    showMessage(command) {
        const { id, text, x, y, color = '#22c55e', duration = 3000 } = command;
        const msgId = `msg_${id || Date.now()}`;
        
        canvasStateManager.addNode({
            id: msgId,
            x, y,
            value: text,
            type: 'label',
            color,
            highlight: true
        });
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                canvasStateManager.deleteNode(msgId);
            }, duration);
        }
        
        console.log(`💬 Showing message: "${text}"`);
    }
    
    // Highlight a code line (for future integration)
    highlightCodeLine(command) {
        const { lineNumber } = command;
        console.log(`📍 Highlight code line ${lineNumber}`);
        // This could emit an event to highlight source code
    }
}

export const commandProcessor = new CommandProcessor();
