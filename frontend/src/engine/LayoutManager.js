/**
 * Layout Manager
 * ==============
 * 
 * This is the ARTIST. It decides:
 * - Where elements go (x, y coordinates)
 * - Element sizes
 * - Spacing
 * - Alignment
 * - Responsive scaling
 * 
 * AI NEVER touches this. Layout is automatic and perfect.
 */

class LayoutManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.padding = 40;
        this.zones = this.calculateZones();
    }

    /**
     * Define layout zones
     * The canvas is divided into semantic zones
     */
    calculateZones() {
        const { width, height, padding } = this;
        
        return {
            // Title at top
            title: {
                x: width / 2,
                y: padding + 30,
                width: width - padding * 2,
                height: 60,
            },
            
            // Main visualization area (center)
            main: {
                x: padding,
                y: 100,
                width: width - padding * 2,
                height: height - 250,
                centerX: width / 2,
                centerY: (height - 100) / 2 + 50,
            },
            
            // Variables panel (left side)
            variables: {
                x: padding,
                y: 100,
                width: 180,
                height: height - 250,
            },
            
            // Arrays area (center)
            arrays: {
                x: padding + 200,
                y: 150,
                width: width - 200 - padding * 2,
                height: height - 350,
            },
            
            // Comparison area (below arrays)
            comparison: {
                x: width / 2,
                y: height - 150,
                width: width - padding * 2,
                height: 80,
            },
            
            // Result area (bottom)
            result: {
                x: width / 2,
                y: height - 80,
                width: width - padding * 2,
                height: 60,
            },
            
            // Progress bar
            progress: {
                x: padding,
                y: height - 30,
                width: width - padding * 2,
                height: 10,
            },
        };
    }

    /**
     * Update dimensions
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.zones = this.calculateZones();
    }

    /**
     * Get array layout
     * Given array data, returns exact positions for each element
     */
    getArrayLayout(arrayName, values, options = {}) {
        const zone = this.zones.arrays;
        const elementWidth = 60;
        const elementHeight = 60;
        const gap = 10;
        const totalWidth = values.length * elementWidth + (values.length - 1) * gap;
        
        // Center the array
        const startX = zone.x + (zone.width - totalWidth) / 2;
        const startY = zone.y + (options.row || 0) * 120;
        
        const elements = values.map((value, index) => ({
            id: `${arrayName}_${index}`,
            x: startX + index * (elementWidth + gap) + elementWidth / 2,
            y: startY + elementHeight / 2,
            width: elementWidth,
            height: elementHeight,
            value: String(value),
            index,
        }));

        // Label position
        const label = {
            id: `${arrayName}_label`,
            x: startX - 60,
            y: startY + elementHeight / 2,
            text: `${arrayName} =`,
        };

        return { elements, label, startX, startY, totalWidth };
    }

    /**
     * Get pointer positions for an array
     */
    getPointerLayout(arrayLayout, pointers) {
        const { elements } = arrayLayout;
        
        return pointers.map((ptr, ptrIndex) => {
            const element = elements[ptr.index];
            if (!element) return null;
            
            return {
                id: `ptr_${ptr.name}`,
                name: ptr.name,
                x: element.x,
                y: element.y - element.height / 2 - 30 - ptrIndex * 25,
                targetX: element.x,
                targetY: element.y - element.height / 2 - 10,
            };
        }).filter(Boolean);
    }

    /**
     * Get variable panel layout
     */
    getVariablesLayout(variables) {
        const zone = this.zones.variables;
        const itemHeight = 50;
        const entries = Object.entries(variables);
        
        return entries.map(([name, value], index) => ({
            id: `var_${name}`,
            name,
            value: String(value),
            x: zone.x + zone.width / 2,
            y: zone.y + index * itemHeight + itemHeight / 2,
            width: zone.width - 20,
            height: 40,
        }));
    }

    /**
     * Get comparison layout
     */
    getComparisonLayout(left, operator, right, result) {
        const zone = this.zones.comparison;
        const boxWidth = 80;
        const operatorWidth = 50;
        const gap = 20;
        
        return {
            left: {
                x: zone.x - operatorWidth - gap - boxWidth / 2,
                y: zone.y,
                width: boxWidth,
                height: 60,
                value: String(left.value),
                label: left.source === 'array' ? `${left.name}[${left.index}]` : left.name,
            },
            operator: {
                x: zone.x,
                y: zone.y,
                text: operator,
            },
            right: {
                x: zone.x + operatorWidth + gap + boxWidth / 2,
                y: zone.y,
                width: boxWidth,
                height: 60,
                value: String(right.value),
                label: right.source === 'array' ? `${right.name}[${right.index}]` : right.name,
            },
            result: {
                x: zone.x,
                y: zone.y + 50,
                text: result ? '✓ True' : '✗ False',
                color: result ? '#22c55e' : '#ef4444',
            },
        };
    }

    /**
     * Get title layout
     */
    getTitleLayout(text) {
        const zone = this.zones.title;
        return {
            x: zone.x,
            y: zone.y,
            text,
            fontSize: 28,
        };
    }

    /**
     * Get result layout
     */
    getResultLayout(title, value, success) {
        const zone = this.zones.result;
        return {
            x: zone.x,
            y: zone.y,
            title,
            value: String(value),
            success,
            width: 300,
            height: 80,
        };
    }

    /**
     * Get progress layout
     */
    getProgressLayout(current, total) {
        const zone = this.zones.progress;
        return {
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
            progress: current / total,
            text: `Step ${current} / ${total}`,
        };
    }
}

export default LayoutManager;
