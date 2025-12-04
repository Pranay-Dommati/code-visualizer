// Resizing logic
const startResizing = useCallback((e) => {
    setIsResizing(true);
    e.preventDefault(); // Prevent text selection
}, []);

const stopResizing = useCallback(() => {
    setIsResizing(false);
}, []);

const resize = useCallback((e) => {
    if (isResizing) {
        // Calculate width from the right edge
        const newWidth = window.innerWidth - e.clientX;
        // Min width 300px, Max width 800px (or percentage of screen)
        if (newWidth > 300 && newWidth < window.innerWidth * 0.6) {
            setSidebarWidth(newWidth);
        }
    }
}, [isResizing]);

useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
        window.removeEventListener('mousemove', resize);
        window.removeEventListener('mouseup', stopResizing);
    };
}, [resize, stopResizing]);
