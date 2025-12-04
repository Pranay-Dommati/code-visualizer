import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Stage, Layer, Circle, Text, Arrow, Group, Rect } from 'react-konva';
import { canvasStateManager } from '../services/CanvasStateManager';
import { teacherConnection } from '../services/TeacherConnection';

const VisualExplanationPanel = ({ width = 400, height = 600 }) => {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isMicActive, setIsMicActive] = useState(false);
    const [textInput, setTextInput] = useState('');

    useEffect(() => {
        // Subscribe to canvas state changes
        const unsubscribe = canvasStateManager.subscribe((state) => {
            setNodes(state.nodes);
            setEdges(state.edges);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        // Subscribe to connection status
        const unsubscribe = teacherConnection.subscribe((status) => {
            if (status === 'connected') setIsConnected(true);
            if (status === 'disconnected') {
                setIsConnected(false);
                setIsMicActive(false);
            }
        });
        return unsubscribe;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            teacherConnection.stop();
        };
    }, []);

    const toggleConnection = useCallback(async () => {
        if (isConnected) {
            teacherConnection.stop();
        } else {
            await teacherConnection.connect();
        }
    }, [isConnected]);

    const handleSendText = useCallback(() => {
        if (textInput.trim()) {
            teacherConnection.sendText(textInput);
            setTextInput('');
        }
    }, [textInput]);

    return (
        <div className="w-full h-full bg-slate-900 flex flex-col overflow-hidden">
            {/* Header with Controls */}
            <div className="flex-shrink-0 p-4 border-b border-slate-800 bg-slate-900/80">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Visual Explanation</h3>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                                <span className="text-[10px] font-medium text-slate-400">{isConnected ? 'Live' : 'Offline'}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={toggleConnection}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${isConnected
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                                : 'bg-gradient-to-r from-teal-600 to-blue-600 text-white hover:shadow-lg hover:shadow-teal-500/25'
                            }`}
                    >
                        {isConnected ? (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="4" y="4" width="16" height="16" rx="2" />
                                </svg>
                                End Session
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                                Start Live
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative overflow-hidden">
                <Stage width={width} height={height - 180}>
                    <Layer>
                        {/* Edges */}
                        {edges.map((edge, i) => {
                            const fromNode = nodes.find(n => n.id === edge.from);
                            const toNode = nodes.find(n => n.id === edge.to);
                            if (!fromNode || !toNode) return null;

                            return (
                                <Arrow
                                    key={edge.id || i}
                                    points={[fromNode.x, fromNode.y, toNode.x, toNode.y]}
                                    stroke="#4fd1c5"
                                    strokeWidth={2}
                                    fill="#4fd1c5"
                                    pointerLength={10}
                                    pointerWidth={10}
                                />
                            );
                        })}

                        {/* Nodes */}
                        {nodes.map((node) => (
                            <Group key={node.id} x={node.x} y={node.y} draggable>
                                <Circle
                                    radius={30}
                                    fill="#1e293b"
                                    stroke="#38bdf8"
                                    strokeWidth={2}
                                    shadowColor="black"
                                    shadowBlur={10}
                                    shadowOpacity={0.5}
                                />
                                <Text
                                    text={node.value.toString()}
                                    fontSize={16}
                                    fill="#f8fafc"
                                    align="center"
                                    verticalAlign="middle"
                                    offsetX={10}
                                    offsetY={8}
                                />
                            </Group>
                        ))}
                    </Layer>
                </Stage>

                {/* Empty State */}
                {nodes.length === 0 && !isConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-4">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-400">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </div>
                        <p className="text-slate-400 text-sm mb-1">Start a live session to visualize</p>
                        <p className="text-slate-500 text-xs">The AI will draw diagrams as it explains</p>
                    </div>
                )}

                {/* Connected but waiting */}
                {nodes.length === 0 && isConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mb-4 animate-pulse">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-400">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            </svg>
                        </div>
                        <p className="text-teal-400 text-sm mb-1">Listening...</p>
                        <p className="text-slate-500 text-xs">Speak or type to ask the AI Teacher</p>
                    </div>
                )}
            </div>

            {/* Input Area */}
            {isConnected && (
                <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900/80">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                            placeholder="Type a request (e.g., 'Draw a linked list')"
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                        />
                        <button
                            onClick={handleSendText}
                            disabled={!textInput.trim()}
                            className="p-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisualExplanationPanel;
