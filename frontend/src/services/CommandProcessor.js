import { canvasStateManager } from './CanvasStateManager';

class CommandProcessor {
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
                    highlight: command.highlight || false
                });
                break;
                
            case 'draw_array':
                // Draw an array as a series of nodes
                this.drawArray(command);
                break;
                
            case 'highlight_index':
                // Highlight a specific index in an array
                this.highlightArrayIndex(command);
                break;
                
            case 'draw_pointer':
                // Draw a pointer to an array index
                this.drawPointer(command);
                break;
                
            case 'update_node':
                canvasStateManager.updateNode(command.id, {
                    value: command.value !== undefined ? String(command.value) : undefined,
                    highlight: command.highlight,
                    x: command.x,
                    y: command.y
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
                break;
                
            default:
                console.warn('Unknown command action:', command.action);
        }
    }
    
    drawArray(command) {
        const { id, elements, x = 100, y = 100 } = command;
        const nodeWidth = 60;
        const nodeGap = 10;
        
        if (!elements || !Array.isArray(elements)) return;
        
        // Clear previous array with same id if exists
        for (let i = 0; i < 100; i++) {
            canvasStateManager.deleteNode(`${id}_${i}`);
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
        });
        
        console.log(`📊 Drew array "${id}" with ${elements.length} elements`);
    }
    
    highlightArrayIndex(command) {
        const { array_id, index, highlight = true } = command;
        const nodeId = `${array_id}_${index}`;
        canvasStateManager.updateNode(nodeId, { highlight });
        console.log(`✨ Highlighted index ${index} in array "${array_id}"`);
    }
    
    drawPointer(command) {
        const { id, from, to_index, array_id, y_offset = -40 } = command;
        const targetNodeId = `${array_id || 'arr'}_${to_index}`;
        
        // Get target node position (we'll approximate if not available)
        const nodeWidth = 60;
        const nodeGap = 10;
        const baseX = 100;
        const baseY = 100;
        
        canvasStateManager.addNode({
            id: `ptr_${id || from}`,
            x: baseX + to_index * (nodeWidth + nodeGap) + nodeWidth / 2,
            y: baseY + y_offset,
            value: from || id || 'ptr',
            type: 'pointer',
            highlight: true
        });
        
        console.log(`👆 Drew pointer "${from || id}" at index ${to_index}`);
    }
}

export const commandProcessor = new CommandProcessor();
