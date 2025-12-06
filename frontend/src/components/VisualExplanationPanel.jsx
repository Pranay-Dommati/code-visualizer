import React, { useState, useEffect } from 'react';
import LiveKitConnection from '../services/LiveKitConnection';
import { canvasStateManager } from '../services/CanvasStateManager';
import { commandProcessor } from '../services/CommandProcessor';
import AnimatedCanvas from './AnimatedCanvas';

const VisualExplanationPanel = ({ width, height, code, steps, codeLines }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [status, setStatus] = useState('Disconnected');
    const [contextSent, setContextSent] = useState(false);
    const [nodes, setNodes] = useState([]);
    const [textInput, setTextInput] = useState('');
    const [timelineInfo, setTimelineInfo] = useState({ current: 0, total: 0 });

    // Subscribe to canvas state changes
    useEffect(() => {
        const unsubscribe = canvasStateManager.subscribe((state) => {
            setNodes(state.nodes);
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
                // Update timeline info
                if (data.timeline_steps) {
                    setTimelineInfo({ current: 0, total: data.timeline_steps });
                }
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
                {timelineInfo.total > 0 && (
                    <span className="ml-2 text-blue-400">📋 {timelineInfo.total} teaching steps ready</span>
                )}
            </div>

            {/* Quick Action Buttons */}
            {isConnected && timelineInfo.total > 0 && (
                <div className="mb-3 flex gap-2 flex-wrap">
                    <button
                        onClick={() => setTextInput("Show me everything")}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-all"
                    >
                        🎬 Full Walkthrough
                    </button>
                    <button
                        onClick={() => setTextInput("Show step 1")}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-all"
                    >
                        1️⃣ Step 1
                    </button>
                    <button
                        onClick={() => setTextInput("Next")}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-all"
                    >
                        ▶️ Next
                    </button>
                    <button
                        onClick={() => setTextInput("Previous")}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-medium transition-all"
                    >
                        ◀️ Previous
                    </button>
                </div>
            )}

            {/* Visualization Canvas - Animated Game-like Experience */}
            <div className="flex-grow bg-gray-800 rounded-lg overflow-hidden border border-gray-700 relative">
                <AnimatedCanvas 
                    width={canvasWidth - 40} 
                    height={canvasHeight}
                    nodes={nodes}
                />

                {nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
                        <div className="text-center">
                            <div className="text-4xl mb-2">🎨</div>
                            <p>Ask the AI to visualize something!</p>
                            <p className="text-sm text-gray-600 mt-1">Try: "Show me step 1" or "Visualize the array"</p>
                        </div>
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
