import React, { useState, useEffect } from 'react';
import { Stage, Layer, Circle, Rect, Line, Text, Group } from 'react-konva';
import LiveKitConnection from '../services/LiveKitConnection';
import { canvasStateManager } from '../services/CanvasStateManager';
import { commandProcessor } from '../services/CommandProcessor';

const VisualExplanationPanel = ({ width, height, code, steps, codeLines }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [status, setStatus] = useState('Disconnected');
    const [contextSent, setContextSent] = useState(false);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [textInput, setTextInput] = useState('');

    // Subscribe to canvas state changes
    useEffect(() => {
        const unsubscribe = canvasStateManager.subscribe((state) => {
            setNodes(state.nodes);
            setEdges(state.edges);
        });
        return () => unsubscribe();
    }, []);

    // Send context to backend API (not via LiveKit)
    const sendContextToBackend = async () => {
        if (!code && (!steps || steps.length === 0)) {
            console.log('📋 No context to send');
            return false;
        }
        
        try {
            const response = await fetch('http://localhost:5000/api/teacher/context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code || '',
                    codeLines: codeLines || [],
                    steps: steps || []
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Context sent to backend:', data);
                setContextSent(true);
                return true;
            } else {
                console.error('Failed to send context:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error sending context to backend:', error);
            return false;
        }
    };

    // Send context to backend whenever code/steps change
    useEffect(() => {
        if (code || (steps && steps.length > 0)) {
            sendContextToBackend();
        }
    }, [code, steps, codeLines]);

    const handleConnect = async () => {
        try {
            setStatus('Sending context...');
            
            // First, ensure context is sent to backend
            await sendContextToBackend();
            
            setStatus('Connecting...');

            // Get token from backend
            const response = await fetch('http://localhost:5000/livekit-token?identity=student');
            const data = await response.json();

            if (!data.token) {
                throw new Error('Failed to get token');
            }

            await LiveKitConnection.connect(
                data.token,
                data.url,
                (command) => {
                    // Handle drawing commands from the AI Teacher
                    console.log('📥 Received drawing command:', command);
                    commandProcessor.process(command);
                },
                (state) => {
                    // Handle connection state
                    console.log('🔌 Connection state:', state);
                    setStatus(`Status: ${state}`);
                    setIsConnected(state === 'connected');
                }
            );

            setStatus('Connected (Ready to Speak)');
        } catch (error) {
            console.error('Connection failed:', error);
            setStatus(`Error: ${error.message}`);
        }
    };

    const toggleMicrophone = async () => {
        if (!isConnected) return;

        if (isSpeaking) {
            await LiveKitConnection.stopMicrophone();
            setIsSpeaking(false);
        } else {
            await LiveKitConnection.startMicrophone();
            setIsSpeaking(true);
        }
    };

    const handleSendText = async () => {
        if (!textInput.trim() || !isConnected) return;
        await LiveKitConnection.sendText(textInput);
        setTextInput('');
    };

    // Render node based on type
    const renderNode = (node) => {
        const nodeType = node.type || 'circle';
        
        // Color mapping for highlights
        const colorMap = {
            'yellow': { fill: '#FCD34D', stroke: '#F59E0B' },
            'green': { fill: '#34D399', stroke: '#10B981' },
            'red': { fill: '#F87171', stroke: '#EF4444' },
            'blue': { fill: '#60A5FA', stroke: '#3B82F6' },
            'purple': { fill: '#A78BFA', stroke: '#8B5CF6' },
            'orange': { fill: '#FB923C', stroke: '#F97316' },
        };
        
        const highlightColor = node.color && colorMap[node.color] ? colorMap[node.color] : colorMap['purple'];
        const fillColor = node.highlight ? highlightColor.fill : '#1F2937';
        const strokeColor = node.highlight ? highlightColor.stroke : '#4B5563';

        if (nodeType === 'rect') {
            return (
                <Group key={node.id} x={node.x} y={node.y} draggable>
                    <Rect
                        width={50}
                        height={40}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={2}
                        cornerRadius={4}
                        shadowColor="black"
                        shadowBlur={10}
                        shadowOpacity={0.3}
                        offsetX={25}
                        offsetY={20}
                    />
                    <Text
                        text={String(node.value)}
                        fontSize={16}
                        fill={node.highlight ? '#1F2937' : 'white'}
                        align="center"
                        verticalAlign="middle"
                        width={50}
                        height={40}
                        offsetX={25}
                        offsetY={20}
                        fontFamily="monospace"
                        fontStyle="bold"
                    />
                </Group>
            );
        } else if (nodeType === 'pointer') {
            return (
                <Group key={node.id} x={node.x} y={node.y}>
                    {/* Pointer arrow */}
                    <Line
                        points={[0, 0, 0, 30]}
                        stroke="#10B981"
                        strokeWidth={3}
                    />
                    <Line
                        points={[-8, 22, 0, 30, 8, 22]}
                        stroke="#10B981"
                        strokeWidth={3}
                        lineCap="round"
                        lineJoin="round"
                    />
                    <Text
                        text={String(node.value)}
                        fontSize={14}
                        fill="#10B981"
                        align="center"
                        offsetX={15}
                        offsetY={18}
                        fontFamily="monospace"
                        fontStyle="bold"
                    />
                </Group>
            );
        } else if (nodeType === 'index') {
            return (
                <Group key={node.id} x={node.x} y={node.y}>
                    <Text
                        text={String(node.value)}
                        fontSize={12}
                        fill="#6B7280"
                        align="center"
                        fontFamily="monospace"
                    />
                </Group>
            );
        } else if (nodeType === 'label') {
            return (
                <Group key={node.id} x={node.x} y={node.y}>
                    <Text
                        text={String(node.value)}
                        fontSize={14}
                        fill={node.color || '#9CA3AF'}
                        fontFamily="monospace"
                        fontStyle="bold"
                    />
                </Group>
            );
        } else if (nodeType === 'variable') {
            return (
                <Group key={node.id} x={node.x} y={node.y}>
                    <Rect
                        width={Math.max(120, String(node.value).length * 10)}
                        height={32}
                        fill={node.highlight ? '#1E40AF' : '#1F2937'}
                        stroke={node.highlight ? '#3B82F6' : '#4B5563'}
                        strokeWidth={2}
                        cornerRadius={6}
                    />
                    <Text
                        text={String(node.value)}
                        fontSize={14}
                        fill="white"
                        x={10}
                        y={8}
                        fontFamily="monospace"
                    />
                </Group>
            );
        } else if (nodeType === 'comparison') {
            return (
                <Group key={node.id} x={node.x} y={node.y}>
                    <Rect
                        width={Math.max(180, String(node.value).length * 10)}
                        height={36}
                        fill={node.highlight ? '#065F46' : '#1F2937'}
                        stroke={node.highlight ? '#10B981' : '#4B5563'}
                        strokeWidth={2}
                        cornerRadius={8}
                    />
                    <Text
                        text={String(node.value)}
                        fontSize={14}
                        fill={node.highlight ? '#A7F3D0' : '#9CA3AF'}
                        x={12}
                        y={10}
                        fontFamily="monospace"
                        fontStyle="bold"
                    />
                </Group>
            );
        } else if (nodeType === 'loop') {
            return (
                <Group key={node.id} x={node.x} y={node.y}>
                    <Rect
                        width={120}
                        height={30}
                        fill="#7C3AED"
                        stroke="#A78BFA"
                        strokeWidth={2}
                        cornerRadius={15}
                    />
                    <Text
                        text={String(node.value)}
                        fontSize={12}
                        fill="white"
                        x={10}
                        y={8}
                        fontFamily="monospace"
                        fontStyle="bold"
                    />
                </Group>
            );
        }

        // Default circle
        return (
            <Group key={node.id} x={node.x} y={node.y} draggable>
                <Circle
                    radius={30}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={2}
                    shadowColor="black"
                    shadowBlur={10}
                    shadowOpacity={0.3}
                />
                <Text
                    text={String(node.value)}
                    fontSize={16}
                    fill={node.highlight ? '#1F2937' : 'white'}
                    align="center"
                    verticalAlign="middle"
                    offsetX={10}
                    offsetY={8}
                    fontFamily="monospace"
                    fontStyle="bold"
                />
            </Group>
        );
    };

    const canvasWidth = width || 800;
    const canvasHeight = height ? height - 200 : 400;

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white p-4 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    AI Teacher (LiveKit)
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleConnect}
                        disabled={isConnected}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${isConnected
                                ? 'bg-green-600 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                            }`}
                    >
                        {isConnected ? 'Connected' : 'Connect'}
                    </button>

                    <button
                        onClick={toggleMicrophone}
                        disabled={!isConnected}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${!isConnected
                                ? 'bg-gray-700 cursor-not-allowed opacity-50'
                                : isSpeaking
                                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                                    : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                    >
                        {isSpeaking ? 'Mute Mic' : 'Unmute Mic'}
                    </button>
                </div>
            </div>

            <div className="mb-2 text-sm text-gray-400 font-mono">
                {status}
                {contextSent && (
                    <span className="ml-2 text-green-400">✓ Code context sent</span>
                )}
                {!contextSent && isConnected && code && (
                    <span className="ml-2 text-yellow-400">⏳ Sending context...</span>
                )}
            </div>

            {/* Visualization Canvas */}
            <div className="flex-grow bg-gray-800 rounded-lg overflow-hidden border border-gray-700 relative">
                <Stage width={canvasWidth - 40} height={canvasHeight}>
                    <Layer>
                        {/* Edges */}
                        {edges.map((edge, i) => {
                            const fromNode = nodes.find(n => n.id === edge.from);
                            const toNode = nodes.find(n => n.id === edge.to);
                            if (!fromNode || !toNode) return null;
                            return (
                                <Line
                                    key={i}
                                    points={[fromNode.x, fromNode.y, toNode.x, toNode.y]}
                                    stroke="#4B5563"
                                    strokeWidth={2}
                                />
                            );
                        })}

                        {/* Nodes */}
                        {nodes.map((node) => renderNode(node))}
                    </Layer>
                </Stage>

                {nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
                        <p>AI visualizations will appear here...</p>
                    </div>
                )}
            </div>

            {/* Text Chat Input */}
            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                    placeholder="Type a message to the AI teacher..."
                    className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                    disabled={!isConnected}
                />
                <button
                    onClick={handleSendText}
                    disabled={!isConnected}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default VisualExplanationPanel;
