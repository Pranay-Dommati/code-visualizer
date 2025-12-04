class CanvasStateManager {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.listeners = new Set();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        const state = {
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values())
        };
        this.listeners.forEach(listener => listener(state));
    }

    // Command: draw_node
    addNode(node) {
        this.nodes.set(node.id, {
            ...node,
            x: node.x || 0,
            y: node.y || 0,
            value: node.value || '',
            type: node.type || 'circle'
        });
        this.notify();
    }

    // Command: update_node
    updateNode(id, props) {
        if (this.nodes.has(id)) {
            const node = this.nodes.get(id);
            this.nodes.set(id, { ...node, ...props });
            this.notify();
        }
    }

    // Command: delete_node
    deleteNode(id) {
        this.nodes.delete(id);
        // Remove connected edges
        for (const [edgeId, edge] of this.edges) {
            if (edge.from === id || edge.to === id) {
                this.edges.delete(edgeId);
            }
        }
        this.notify();
    }

    // Command: connect_nodes
    addEdge(edge) {
        const id = edge.id || `${edge.from}-${edge.to}`;
        this.edges.set(id, {
            id,
            from: edge.from,
            to: edge.to,
            label: edge.label || '',
            type: edge.type || 'arrow'
        });
        this.notify();
    }

    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.notify();
    }
}

export const canvasStateManager = new CanvasStateManager();
