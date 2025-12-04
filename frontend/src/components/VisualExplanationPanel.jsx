import React, { useState, useEffect } from 'react';
import { Stage, Layer, Circle, Line, Text, Group } from 'react-konva';
import LiveKitConnection from '../services/LiveKitConnection';
import { canvasStateManager } from '../services/CanvasStateManager';
import { commandProcessor } from '../services/CommandProcessor';

const VisualExplanationPanel = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [status, setStatus] = useState('Disconnected');
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

    const handleConnect = async () => {
        try {
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
                    // Handle drawing commands
                    commandProcessor.process(command);
                },
                (state) => {
                    // Handle connection state
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
            </div>

            {/* Visualization Canvas */}
            <div className="flex-grow bg-gray-800 rounded-lg overflow-hidden border border-gray-700 relative">
                <Stage width={800} height={500}>
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
                        {nodes.map((node) => (
                            <Group key={node.id} x={node.x} y={node.y} draggable>
                                <Circle
                                    radius={30}
                                    fill={node.highlight ? '#8B5CF6' : '#1F2937'}
                                    stroke={node.highlight ? '#C4B5FD' : '#4B5563'}
                                    strokeWidth={2}
                                    shadowColor="black"
                                    shadowBlur={10}
                                    shadowOpacity={0.3}
                                />
                                <Text
                                    text={node.value}
                                    fontSize={16}
                                    fill="white"
                                    align="center"
                                    verticalAlign="middle"
                                    offsetX={10}
                                    offsetY={8}
                                    fontFamily="monospace"
                                    fontStyle="bold"
                                />
                            </Group>
                        ))}
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
