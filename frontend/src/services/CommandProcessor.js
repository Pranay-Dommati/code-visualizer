import { canvasStateManager } from './CanvasStateManager';

class CommandProcessor {
    process(command) {
        if (!command || !command.action) return;

        console.log('Processing command:', command);

        switch (command.action) {
            case 'draw_node':
                canvasStateManager.addNode(command);
                break;
            case 'update_node':
                canvasStateManager.updateNode(command.id, command);
                break;
            case 'delete_node':
                canvasStateManager.deleteNode(command.id);
                break;
            case 'connect_nodes':
                canvasStateManager.addEdge(command);
                break;
            case 'clear_canvas':
                canvasStateManager.clear();
                break;
            default:
                console.warn('Unknown command action:', command.action);
        }
    }
}

export const commandProcessor = new CommandProcessor();
