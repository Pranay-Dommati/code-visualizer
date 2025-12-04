import React, { useEffect, useRef, useState, useCallback } from 'react';
import VisualExplanationPanel from './VisualExplanationPanel';

const API_BASE_URL = 'http://localhost:5000/api';

const ImmersiveVisualizer = ({
    isOpen,
    onClose,
    steps,
    code,
    codeLines,
    isLoading,
    loadingPhase,
    isGenerating = false
}) => {
    const [visibleSteps, setVisibleSteps] = useState([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [isStreaming, setIsStreaming] = useState(false); // Track if we're receiving streamed data
    const [leftPanelTab, setLeftPanelTab] = useState('code'); // 'code' or 'teacher'

    // AI Teacher state
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isTeacherThinking, setIsTeacherThinking] = useState(false);
    const [teacherContextSet, setTeacherContextSet] = useState(false);

    // Resizable sidebar state
    const [sidebarWidth, setSidebarWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);

    const scrollContainerRef = useRef(null);
    const latestStepRef = useRef(null);
    const prevStepsLengthRef = useRef(0);
    const chatScrollRef = useRef(null);

    // Reset when opened
    useEffect(() => {
        if (isOpen && !isLoading) {
            setVisibleSteps([]);
            setCurrentStepIndex(-1);
            prevStepsLengthRef.current = 0;
            setChatMessages([]);
            setTeacherContextSet(false);
            // Wait for steps to stream in
        }
    }, [isOpen, isLoading]);

    // Set AI Teacher context when steps are loaded
    useEffect(() => {
        if (!isOpen || isLoading || steps.length === 0) return;

        const setContext = async () => {
            try {
                console.log('Setting AI Teacher context with', steps.length, 'steps');
                await fetch(`${API_BASE_URL}/teacher/context`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: code,
                        codeLines: codeLines,
                        steps: steps
                    })
                });
                setTeacherContextSet(true);

                // Add welcome message only if this is the first time
                if (chatMessages.length === 0) {
                    setChatMessages([{
                        role: 'assistant',
                        content: `Hi! I'm your AI coding teacher. I've analyzed this code and all ${steps.length} execution steps. Ask me anything about how it works, why certain things happen, or any programming concepts you'd like to understand better!`
                    }]);
                }
            } catch (err) {
                console.error('Failed to set teacher context:', err);
            }
        };

        // Wait for streaming to complete before setting context
        if (!isStreaming && steps.length > 0) {
            setContext();
        }
    }, [isOpen, isLoading, isStreaming, steps, code, codeLines]);

    // Handle streaming steps - show them as they arrive
    useEffect(() => {
        if (!isOpen || isLoading) return;

        const newStepsCount = steps.length - prevStepsLengthRef.current;

        if (newStepsCount > 0) {
            // New steps have arrived via streaming
            setIsStreaming(true);

            // Add the new steps to visible steps
            const newSteps = steps.slice(prevStepsLengthRef.current);
            setVisibleSteps(prev => [...prev, ...newSteps]);
            setCurrentStepIndex(steps.length - 1);

            prevStepsLengthRef.current = steps.length;
        }
    }, [steps, isOpen, isLoading]);

    // Stop streaming mode when all steps are received
    useEffect(() => {
        if (isStreaming && steps.length > 0 && visibleSteps.length === steps.length) {
            // All steps have been received and shown
            setIsStreaming(false);
        }
    }, [isStreaming, steps.length, visibleSteps.length]);


    // Auto-scroll to latest step only if user is near the bottom
    useEffect(() => {
        if (latestStepRef.current && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

            // Only auto-scroll if user is within 300px of the bottom (not reading previous content)
            if (scrollBottom < 300) {
                latestStepRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }, [visibleSteps]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            // Don't capture shortcuts when typing in an input field
            const activeElement = document.activeElement;
            const isTyping = activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable;

            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);


    // Auto-scroll chat to bottom
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages]);




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

    // Send message to AI Teacher (TEXT MODE - no voice)
    const sendMessage = useCallback(async () => {
        if (!chatInput.trim() || isTeacherThinking) return;

        const userMessage = chatInput.trim();
        setChatInput('');

        // Add user message
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsTeacherThinking(true);

        try {
            // Get streaming response
            const response = await fetch(`${API_BASE_URL}/teacher/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    currentStepIndex: currentStepIndex
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';

            // Add placeholder for assistant response
            setChatMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'text') {
                                fullResponse += data.content;

                                // Text mode: just show text streaming, no voice
                                setChatMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1] = {
                                        role: 'assistant',
                                        content: fullResponse,
                                        isStreaming: true
                                    };
                                    return newMessages;
                                });
                            } else if (data.type === 'done') {
                                setChatMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1] = {
                                        role: 'assistant',
                                        content: fullResponse,
                                        isStreaming: false
                                    };
                                    return newMessages;
                                });
                            }
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    }
                }
            }

            setIsTeacherThinking(false);

        } catch (err) {
            console.error('Chat error:', err);
            setIsTeacherThinking(false);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I encountered an error. Please try again."
            }]);
        }
    }, [chatInput, isTeacherThinking, currentStepIndex]);


    // Handle Enter key in chat input
    const handleChatKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Send a quick question (TEXT MODE - no voice)
    const sendQuickQuestion = useCallback(async (question) => {
        console.log('=== QUICK QUESTION START ===');
        console.log('Question:', question);

        if (isTeacherThinking) {
            console.log('Already thinking, returning');
            return;
        }


        // Add user message
        setChatMessages(prev => [...prev, { role: 'user', content: question }]);
        setIsTeacherThinking(true);

        try {
            console.log('Fetching from:', `${API_BASE_URL}/teacher/chat`);
            const response = await fetch(`${API_BASE_URL}/teacher/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: question,
                    currentStepIndex: currentStepIndex
                })
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';

            setChatMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

            console.log('Starting to read stream...');
            let chunkCount = 0;

            while (true) {
                const { done, value } = await reader.read();
                chunkCount++;
                console.log(`Chunk ${chunkCount}: done=${done}, bytes=${value?.length || 0}`);

                if (done) {
                    console.log('Stream finished, fullResponse length:', fullResponse.length);
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                console.log('Buffer:', buffer.substring(0, 100));

                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    console.log('Processing line:', line.substring(0, 80));
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log('Parsed data:', data.type, data.content?.substring(0, 30));
                            if (data.type === 'text') {
                                fullResponse += data.content;

                                // Text mode: just show streaming text, no voice
                                setChatMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1] = {
                                        role: 'assistant',
                                        content: fullResponse,
                                        isStreaming: true
                                    };
                                    return newMessages;
                                });
                            } else if (data.type === 'done') {
                                console.log('Received done signal');
                                setChatMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1] = {
                                        role: 'assistant',
                                        content: fullResponse,
                                        isStreaming: false
                                    };
                                    return newMessages;
                                });
                            }
                        } catch (e) {
                            console.error('Parse error:', e, 'line:', line);
                        }
                    }
                }
            }

            console.log('=== QUICK QUESTION COMPLETE ===');
            setIsTeacherThinking(false);

        } catch (err) {
            console.error('Chat error:', err);
            setIsTeacherThinking(false);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I encountered an error. Please try again."
            }]);
        }
    }, [isTeacherThinking, currentStepIndex]);

    // Get syntax highlighted code line - returns React elements
    const highlightSyntax = (codeLine) => {
        if (!codeLine) return <span>&nbsp;</span>;

        const keywords = ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'break', 'continue', 'pass', 'raise', 'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'self'];
        const builtins = ['print', 'range', 'len', 'int', 'str', 'list', 'dict', 'set', 'tuple', 'float', 'bool', 'type', 'input', 'open', 'map', 'filter', 'sorted', 'enumerate', 'zip', 'sum', 'max', 'min', 'abs'];

        const result = [];
        let remaining = codeLine;
        let key = 0;

        while (remaining.length > 0) {
            // Check for string (single or double quotes)
            const stringMatch = remaining.match(/^(["'])(?:(?!\1)[^\\]|\\.)*?\1/);
            if (stringMatch) {
                result.push(<span key={key++} className="text-green-400">{stringMatch[0]}</span>);
                remaining = remaining.slice(stringMatch[0].length);
                continue;
            }

            // Check for comment
            if (remaining.startsWith('#')) {
                result.push(<span key={key++} className="text-slate-500 italic">{remaining}</span>);
                break;
            }

            // Check for number
            const numMatch = remaining.match(/^\d+(\.\d+)?/);
            if (numMatch) {
                result.push(<span key={key++} className="text-orange-400">{numMatch[0]}</span>);
                remaining = remaining.slice(numMatch[0].length);
                continue;
            }

            // Check for word (keyword, builtin, or identifier)
            const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
            if (wordMatch) {
                const word = wordMatch[0];
                let className = 'text-slate-200';

                if (keywords.includes(word)) {
                    className = 'text-pink-400 font-semibold';
                } else if (builtins.includes(word)) {
                    className = 'text-blue-400';
                }

                result.push(<span key={key++} className={className}>{word}</span>);
                remaining = remaining.slice(word.length);
                continue;
            }

            // Check for operators and punctuation
            const opMatch = remaining.match(/^[+\-*/%=<>!&|^~@:,.\[\](){}]+/);
            if (opMatch) {
                result.push(<span key={key++} className="text-cyan-400">{opMatch[0]}</span>);
                remaining = remaining.slice(opMatch[0].length);
                continue;
            }

            // Default: take one character (whitespace or unknown)
            result.push(<span key={key++}>{remaining[0]}</span>);
            remaining = remaining.slice(1);
        }

        return result;
    };

    // Render explanation with styled dry-run section
    const renderExplanationWithDryRun = (explanation) => {
        if (!explanation) return null;

        // Check if the explanation contains a DRY-RUN section
        const dryRunMatch = explanation.match(/DRY-RUN:\s*([\s\S]*?)(?:$)/i);

        if (dryRunMatch) {
            // Split into explanation and dry-run parts
            const explanationPart = explanation.substring(0, explanation.indexOf('DRY-RUN:')).trim();
            const dryRunPart = dryRunMatch[1].trim();

            // Parse dry-run lines and style them
            const dryRunLines = dryRunPart.split('\n').filter(line => line.trim());

            return (
                <>
                    {/* Text explanation */}
                    <p className="mt-1 text-slate-200 leading-relaxed">
                        {explanationPart}
                    </p>

                    {/* Dry-run box */}
                    <div className="mt-3 bg-slate-900/80 rounded-xl p-4 border border-yellow-500/30">
                        <div className="flex items-center gap-2 mb-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                            <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Dry Run</span>
                        </div>
                        <div className="font-mono text-sm space-y-1">
                            {dryRunLines.map((line, idx) => {
                                // Style based on content
                                let lineClass = 'text-slate-300';
                                let content = line;

                                // True result - green
                                if (line.includes('True') || line.includes('✓') || line.includes('executes')) {
                                    lineClass = 'text-green-400 font-semibold';
                                }
                                // False result - red/orange
                                else if (line.includes('False') || line.includes('skipped')) {
                                    lineClass = 'text-orange-400';
                                }
                                // Arrow or assignment result
                                else if (line.includes('→') || (line.includes('=') && !line.includes('=='))) {
                                    lineClass = 'text-teal-300';
                                }
                                // Comparison/condition
                                else if (line.includes('>') || line.includes('<') || line.includes('==')) {
                                    lineClass = 'text-blue-300';
                                }
                                // "so" explanations
                                else if (line.toLowerCase().startsWith('so ')) {
                                    lineClass = 'text-slate-400 italic';
                                }

                                return (
                                    <div key={idx} className={lineClass}>
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            );
        }

        // No dry-run section, just render as plain text
        return (
            <p className="mt-1 text-slate-200 leading-relaxed">
                {explanation}
            </p>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden">
            {/* Top Header Bar */}
            <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15,18 9,12 15,6" />
                        </svg>
                        Back to Editor
                    </button>

                    <div className="h-6 w-px bg-slate-700" />

                    <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                        Code Execution Visualizer
                    </h1>
                </div>

            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-row-reverse overflow-hidden">
                {/* Left Side - Code Panel (Fixed) */}
                <div
                    style={{ width: `${sidebarWidth}px` }}
                    className="flex-shrink-0 bg-slate-900/50 border-l border-slate-800 flex flex-col relative"
                >
                    {/* Drag Handle */}
                    <div
                        onMouseDown={startResizing}
                        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-teal-500/50 transition-colors z-10 ${isResizing ? 'bg-teal-500' : 'bg-transparent'}`}
                        style={{ transform: 'translateX(-50%)' }}
                    />
                    <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-center">
                        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
                            <button
                                onClick={() => setLeftPanelTab('code')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${leftPanelTab === 'code'
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                Source Code
                            </button>
                            <button
                                onClick={() => setLeftPanelTab('visual')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${leftPanelTab === 'visual'
                                    ? 'bg-teal-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                                Visual Explanation
                            </button>
                            <button
                                onClick={() => setLeftPanelTab('teacher')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${leftPanelTab === 'teacher'
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                                    <path d="M19 10a7 7 0 0 1-14 0" />
                                    <path d="M12 17v4M8 21h8" strokeLinecap="round" />
                                </svg>
                                AI Teacher
                            </button>
                        </div>
                    </div>

                    {/* Source Code Tab */}
                    {leftPanelTab === 'code' && (
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
                            {codeLines.map((line, idx) => {
                                const lineNum = idx + 1;
                                const currentStep = visibleSteps[visibleSteps.length - 1];
                                const isCurrentLine = currentStep?.lineNumber === lineNum;
                                const wasExecuted = visibleSteps.some(s => s.lineNumber === lineNum);

                                return (
                                    <div
                                        key={idx}
                                        className={`flex transition-all duration-300 rounded-lg ${isCurrentLine
                                            ? 'bg-teal-500/20 border-l-4 border-teal-400 -ml-1 pl-1'
                                            : wasExecuted
                                                ? 'bg-slate-800/30'
                                                : ''
                                            }`}
                                    >
                                        <span className={`w-10 text-right pr-4 select-none ${isCurrentLine ? 'text-teal-400 font-bold' : 'text-slate-600'
                                            }`}>
                                            {lineNum}
                                        </span>
                                        <span
                                            className={`flex-1 whitespace-pre ${isCurrentLine
                                                ? 'text-white'
                                                : wasExecuted
                                                    ? 'text-slate-300'
                                                    : 'text-slate-500'
                                                }`}
                                        >
                                            {highlightSyntax(line)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* AI Teacher Tab */}
                    {leftPanelTab === 'teacher' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                                            <path d="M19 10a7 7 0 0 1-14 0" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-white">AI Teacher</span>
                                </div>
                            </div>

                            {/* Chat messages */}
                            <div
                                ref={chatScrollRef}
                                className="flex-1 overflow-y-auto p-4 space-y-4"
                            >
                                {chatMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${msg.role === 'user'
                                                ? 'bg-teal-500 text-white rounded-br-md'
                                                : 'bg-slate-700/50 text-slate-200 rounded-bl-md'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            {msg.isStreaming && (
                                                <span className="inline-flex gap-1 mt-1">
                                                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                    <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {isTeacherThinking && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                                            <span className="inline-flex gap-1">
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {chatMessages.length === 0 && !isTeacherThinking && (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-3">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            {teacherContextSet
                                                ? "Ask me anything about this code!"
                                                : "Loading context..."}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Quick questions */}
                            {chatMessages.length <= 1 && (
                                <div className="px-4 pb-2">
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            "What does this code do?",
                                            "Explain the current step",
                                            "What's the time complexity?"
                                        ].map((q, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => sendQuickQuestion(q)}
                                                disabled={isTeacherThinking}
                                                className="text-xs px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-all disabled:opacity-50"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Chat input */}
                            <div className="p-3 border-t border-slate-700/50">
                                <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={handleChatKeyDown}
                                        placeholder="Ask about the code..."
                                        className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                                        disabled={isTeacherThinking}
                                    />

                                    <button
                                        onClick={sendMessage}
                                        disabled={isTeacherThinking || !chatInput.trim()}
                                        className={`p-2 rounded-lg transition-all ${!chatInput.trim() || isTeacherThinking
                                            ? 'bg-slate-700 text-slate-500'
                                            : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600'
                                            }`}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="22" y1="2" x2="11" y2="13" />
                                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Visual Explanation Tab */}
                    {leftPanelTab === 'visual' && (
                        <div className="flex-1 bg-slate-900 relative">
                            <VisualExplanationPanel width={sidebarWidth} height={window.innerHeight - 150} />
                        </div>
                    )}
                </div>

                {/* Right Side - Execution Timeline (Scrollable) */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900"
                >
                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full border-4 border-slate-700 border-t-teal-500 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 animate-pulse" />
                                </div>
                            </div>
                            <p className="mt-6 text-lg text-slate-300 animate-pulse">
                                {loadingPhase === 1 && "📖 Reading your code..."}
                                {loadingPhase === 2 && "🧠 Analyzing execution flow..."}
                                {loadingPhase === 3 && "✨ Preparing visualization..."}
                                {loadingPhase === 4 && "🚀 Starting execution..."}
                            </p>
                        </div>
                    )}

                    {/* Timeline Content */}
                    {!isLoading && (
                        <div className="max-w-4xl mx-auto py-8 px-6">
                            {/* Start Marker */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                        <polygon points="5,3 19,12 5,21" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Execution Started</h2>
                                    <p className="text-sm text-slate-400">Watch your code come to life step by step</p>
                                </div>
                            </div>

                            {/* Timeline Items */}
                            <div className="relative">
                                {/* Timeline Line */}
                                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-500 via-blue-500 to-purple-500" />

                                {/* Steps */}
                                {visibleSteps.map((step, idx) => {
                                    const isLatest = idx === visibleSteps.length - 1;

                                    return (
                                        <div
                                            key={idx}
                                            ref={isLatest ? latestStepRef : null}
                                            className={`relative pl-16 pb-8 transition-all duration-500 ${isLatest ? 'animate-fade-in-up' : ''
                                                }`}
                                        >
                                            {/* Timeline Node */}
                                            <div className={`absolute left-4 w-5 h-5 rounded-full border-2 transition-all ${isLatest
                                                ? 'bg-teal-500 border-teal-400 shadow-lg shadow-teal-500/50 scale-125'
                                                : 'bg-slate-800 border-slate-600'
                                                }`}>
                                                {isLatest && (
                                                    <div className="absolute inset-0 rounded-full bg-teal-400 animate-ping opacity-50" />
                                                )}
                                            </div>

                                            {/* Step Card */}
                                            <div className={`bg-slate-800/50 rounded-2xl border transition-all ${isLatest
                                                ? 'border-teal-500/50 shadow-xl shadow-teal-500/10'
                                                : 'border-slate-700/50'
                                                }`}>
                                                {/* Card Header */}
                                                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                                            <span className="w-6 h-6 rounded-lg bg-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-400">
                                                                {step.lineNumber}
                                                            </span>
                                                            Line {step.lineNumber}
                                                        </span>
                                                        {step.event && step.event !== 'line' && (
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${step.event === 'call' ? 'bg-blue-500/20 text-blue-400' :
                                                                step.event === 'return' ? 'bg-green-500/20 text-green-400' :
                                                                    'bg-slate-600/50 text-slate-400'
                                                                }`}>
                                                                {step.event}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-500">Step {idx + 1}</span>
                                                </div>

                                                {/* Code Being Executed */}
                                                <div className="px-5 py-4 border-b border-slate-700/50">
                                                    <div className="bg-slate-900/80 rounded-xl p-4 font-mono text-sm">
                                                        <code className="text-teal-300 whitespace-pre">
                                                            {highlightSyntax(step.code)}
                                                        </code>
                                                    </div>
                                                </div>

                                                {/* AI Explanation with Dry-Run */}
                                                {step.explanation && (
                                                    <div className="px-5 py-4 border-b border-slate-700/50">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center">
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                                                    <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                                                                    <path d="M19 10a7 7 0 0 1-14 0" />
                                                                    <path d="M12 17v4M8 21h8" stroke="white" strokeWidth="2" fill="none" />
                                                                </svg>
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">AI Explanation</span>
                                                                {renderExplanationWithDryRun(step.explanation)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Variables State */}
                                                {step.variables && Object.keys(step.variables).length > 0 && (
                                                    <div className="px-5 py-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                                                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                                                <line x1="3" y1="9" x2="21" y2="9" />
                                                                <line x1="9" y1="21" x2="9" y2="9" />
                                                            </svg>
                                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Variables</span>
                                                            {step.changedVars?.length > 0 && (
                                                                <span className="text-xs bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full">
                                                                    {step.changedVars.length} changed
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(step.variables).map(([name, data]) => {
                                                                const isChanged = step.changedVars?.includes(name);
                                                                const valueStr = typeof data.value === 'object'
                                                                    ? JSON.stringify(data.value)
                                                                    : String(data.value);

                                                                return (
                                                                    <div
                                                                        key={name}
                                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${isChanged
                                                                            ? 'bg-teal-500/20 border border-teal-500/30'
                                                                            : 'bg-slate-900/50'
                                                                            }`}
                                                                    >
                                                                        <span className={`font-mono text-sm font-semibold ${isChanged ? 'text-teal-400' : 'text-purple-400'
                                                                            }`}>
                                                                            {name}
                                                                        </span>
                                                                        <span className="text-slate-500">=</span>
                                                                        <span className={`font-mono text-sm ${isChanged ? 'text-teal-300' : 'text-slate-300'
                                                                            }`}>
                                                                            {valueStr.length > 30 ? valueStr.slice(0, 30) + '...' : valueStr}
                                                                        </span>
                                                                        <span className="text-xs text-slate-600">
                                                                            ({data.type})
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Output */}
                                                {step.output && (
                                                    <div className="px-5 py-4 border-t border-slate-700/50">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                                                                <polyline points="4,17 10,11 4,5" />
                                                                <line x1="12" y1="19" x2="20" y2="19" />
                                                            </svg>
                                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Output</span>
                                                        </div>
                                                        <div className="bg-slate-950 rounded-lg p-3 font-mono text-sm text-green-400">
                                                            {step.output}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* End Marker - only show when not streaming and all steps are done */}
                                {!isStreaming && !isGenerating && currentStepIndex >= steps.length - 1 && visibleSteps.length > 0 && steps.length > 0 && (
                                    <div className="relative pl-16 pt-4 animate-fade-in">
                                        <div className="absolute left-4 w-5 h-5 rounded-full bg-green-500 border-2 border-green-400 shadow-lg shadow-green-500/50" />
                                        <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                                    <polyline points="20,6 9,17 4,12" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-green-400">Execution Complete! 🎉</h3>
                                                <p className="text-sm text-slate-400">
                                                    Successfully executed {steps.length} steps
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Waiting for more steps indicator - show during streaming */}
                                {(isStreaming || isGenerating) && (
                                    <div className="relative pl-16 pt-4">
                                        <div className={`absolute left-4 w-5 h-5 rounded-full border-2 animate-pulse ${isStreaming ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600'}`} />
                                        <div className="text-slate-500 text-sm flex items-center gap-2">
                                            <span className="inline-flex gap-1">
                                                <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isStreaming ? 'bg-blue-400' : 'bg-teal-400'}`} style={{ animationDelay: '0ms' }}></span>
                                                <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isStreaming ? 'bg-blue-400' : 'bg-teal-400'}`} style={{ animationDelay: '150ms' }}></span>
                                                <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isStreaming ? 'bg-blue-400' : 'bg-teal-400'}`} style={{ animationDelay: '300ms' }}></span>
                                            </span>
                                            {isStreaming ? 'Receiving steps from AI...' : 'Executing next step...'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Empty state */}
                            {visibleSteps.length === 0 && !isLoading && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v12M6 12h12" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-400 mb-2">Ready to Start</h3>
                                    <p className="text-slate-500">Waiting for execution to start...</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Progress Bar */}
            <div className="flex-shrink-0 h-1 bg-slate-800">
                <div
                    className={`h-full transition-all duration-300 ${isStreaming ? 'bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 animate-pulse' : 'bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500'}`}
                    style={{ width: isStreaming ? '100%' : `${steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0}%` }}
                />
            </div>
        </div>
    );
};

export default ImmersiveVisualizer;
