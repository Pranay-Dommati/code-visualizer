/**
 * Visual Explanation Panel (v2)
 * =============================
 * 
 * This panel now uses CINEMATIC DIRECTOR for continuous animations:
 * - Object persistence (array stays, pointer moves)
 * - State transitions (morph, not recreate)
 * - GSAP master timeline for smooth playback
 * - Speech synchronized with visuals
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import LiveKitConnection from '../services/LiveKitConnection';
import PixiVisualization from './PixiVisualization';
import cinematicDirector from '../engine/CinematicDirector';

const VisualExplanationPanelV2 = ({ width, height, code, steps, codeLines }) => {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [status, setStatus] = useState('Disconnected');
    const [contextSent, setContextSent] = useState(false);
    
    // Timeline state
    const [timeline, setTimeline] = useState([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [currentStep, setCurrentStep] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    
    // Cinematic state
    const [cinematicReady, setCinematicReady] = useState(false);
    
    // UI state
    const [textInput, setTextInput] = useState('');
    
    // Refs
    const playTimeoutRef = useRef(null);
    const pixiRef = useRef(null);

    // Calculate dimensions
    const canvasWidth = width ? width - 40 : 760;
    const canvasHeight = height ? height - 280 : 400;

    // Send context to backend and get timeline
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
                console.log('✅ Context sent, got semantic timeline:', data);
                setContextSent(true);
                
                // Fetch the full timeline
                const timelineRes = await fetch('http://localhost:5000/api/teacher/timeline');
                if (timelineRes.ok) {
                    const timelineData = await timelineRes.json();
                    setTimeline(timelineData.timeline || []);
                    console.log('📋 Loaded timeline with', timelineData.timeline?.length, 'steps');
                }
                
                return true;
            }
        } catch (error) {
            console.error('Error sending context:', error);
        }
        return false;
    };

    // Send context when code/steps change
    useEffect(() => {
        if (code || (steps && steps.length > 0)) {
            sendContextToBackend();
        }
    }, [code, steps, codeLines]);

    // Handle step change
    const goToStep = useCallback((index) => {
        if (index >= 0 && index < timeline.length) {
            setCurrentStepIndex(index);
            const step = timeline[index];
            setCurrentStep(step);
            console.log(`📍 Step ${index}: ${step.phase} -`, step.scene?.type);
        }
    }, [timeline]);

    // Auto-play through timeline
    const playTimeline = useCallback(() => {
        if (timeline.length === 0) return;
        
        setIsPlaying(true);
        let idx = 0;
        
        const playNext = () => {
            if (idx >= timeline.length) {
                setIsPlaying(false);
                return;
            }
            
            goToStep(idx);
            const step = timeline[idx];
            const duration = (step.duration_hint || 3) * 1000;
            
            idx++;
            playTimeoutRef.current = setTimeout(playNext, duration);
        };
        
        playNext();
    }, [timeline, goToStep]);

    // Stop playback
    const stopPlayback = useCallback(() => {
        if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
            playTimeoutRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPlayback();
        };
    }, [stopPlayback]);

    // Handle LiveKit connection
    const handleConnect = async () => {
        try {
            setStatus('Sending context...');
            await sendContextToBackend();
            
            setStatus('Connecting...');

            const response = await fetch('http://localhost:5000/livekit-token?identity=student');
            const data = await response.json();

            if (!data.token) {
                throw new Error('Failed to get token');
            }

            await LiveKitConnection.connect(
                data.token,
                data.url,
                (command) => {
                    // Handle visualization commands from AI
                    console.log('📥 Command from AI:', command);
                    
                    // ============================================================
                    // NEW: CINEMATIC STORY - ONE CONTINUOUS ANIMATION
                    // This is the KEY handler for the new architecture!
                    // ============================================================
                    if (command.action === 'build_cinematic_story' && command.transitions) {
                        console.log('🎬🎬🎬 BUILDING CINEMATIC STORY with', command.transitions.length, 'transitions');
                        setIsPlaying(true);
                        setCinematicReady(true);
                        
                        // Build and play the continuous animation
                        cinematicDirector.buildStory(command.transitions);
                        
                        // Mark as playing
                        setStatus('🎬 Playing cinematic story...');
                    }
                    // Handle visual step rendering (legacy - uses tracer data like left panel)
                    else if (command.action === 'render_visual_step') {
                        console.log('🎬 Rendering visual step:', command.scene_type, command);
                        // Pass the visual step directly to the renderer
                        setCurrentStep({
                            visual: true,
                            scene_type: command.scene_type,
                            array_name: command.array_name,
                            array_values: command.array_values,
                            highlight_indices: command.highlight_indices,
                            highlight_colors: command.highlight_colors,
                            comparison: command.comparison,
                            variables: command.variables,
                            code: command.code,
                            line_number: command.line_number,
                            step_num: command.step_num,
                            total: command.total,
                        });
                        setCurrentStepIndex(command.step_num || 0);
                    }
                    // Handle semantic scene rendering from agent (legacy)
                    else if (command.action === 'render_scene' && command.scene) {
                        console.log('🎬 Rendering scene:', command.scene.type);
                        // Create a step-like object for the renderer
                        const stepData = {
                            scene: command.scene,
                            phase: command.phase || 'unknown',
                            step_number: command.step || 0,
                        };
                        setCurrentStep(stepData);
                        setCurrentStepIndex(command.step || 0);
                    }
                    // Playback control
                    else if (command.action === 'pause_cinematic') {
                        cinematicDirector.pause();
                        setIsPlaying(false);
                    }
                    else if (command.action === 'resume_cinematic') {
                        cinematicDirector.play();
                        setIsPlaying(true);
                    }
                    // If it's a step navigation command
                    else if (command.action === 'show_step' && command.step !== undefined) {
                        goToStep(command.step);
                    } else if (command.action === 'next_step') {
                        goToStep(Math.min(currentStepIndex + 1, timeline.length - 1));
                    } else if (command.action === 'previous_step') {
                        goToStep(Math.max(currentStepIndex - 1, 0));
                    } else if (command.action === 'play_all') {
                        playTimeline();
                    }
                },
                (state) => {
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
        if (!textInput.trim()) return;
        
        // Local handling of navigation commands
        const text = textInput.toLowerCase().trim();
        
        if (text.includes('everything') || text.includes('walkthrough') || text.includes('all')) {
            playTimeline();
        } else if (text.includes('next')) {
            goToStep(Math.min(currentStepIndex + 1, timeline.length - 1));
        } else if (text.includes('previous') || text.includes('prev') || text.includes('back')) {
            goToStep(Math.max(currentStepIndex - 1, 0));
        } else if (text.match(/step\s*(\d+)/)) {
            const match = text.match(/step\s*(\d+)/);
            const stepNum = parseInt(match[1]) - 1; // Convert to 0-indexed
            if (stepNum >= 0 && stepNum < timeline.length) {
                goToStep(stepNum);
            }
        } else if (text.includes('first')) {
            goToStep(0);
        } else if (text.includes('last')) {
            goToStep(timeline.length - 1);
        } else if (text.includes('stop')) {
            stopPlayback();
        }
        
        // Also send to AI if connected
        if (isConnected) {
            await LiveKitConnection.sendText(textInput);
        }
        
        setTextInput('');
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white p-4 rounded-lg shadow-xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    AI Teacher (PixiJS Engine)
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleConnect}
                        disabled={isConnected}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                            isConnected
                                ? 'bg-green-600 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        }`}
                    >
                        {isConnected ? 'Connected' : 'Connect'}
                    </button>

                    <button
                        onClick={toggleMicrophone}
                        disabled={!isConnected}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                            !isConnected
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

            {/* Status Bar */}
            <div className="mb-2 text-sm text-gray-400 font-mono flex flex-wrap items-center gap-2">
                <span>{status}</span>
                {contextSent && (
                    <span className="text-green-400">✓ Context sent</span>
                )}
                {timeline.length > 0 && (
                    <span className="text-blue-400">
                        📋 Step {currentStepIndex + 1}/{timeline.length}
                    </span>
                )}
                {isPlaying && (
                    <span className="text-purple-400 animate-pulse">▶️ Playing</span>
                )}
            </div>

            {/* Navigation Controls */}
            {timeline.length > 0 && (
                <div className="mb-3 flex gap-2 flex-wrap">
                    <button
                        onClick={isPlaying ? stopPlayback : playTimeline}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            isPlaying 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                    >
                        {isPlaying ? '⏹️ Stop' : '🎬 Full Walkthrough'}
                    </button>
                    <button
                        onClick={() => goToStep(0)}
                        disabled={currentStepIndex === 0}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-all"
                    >
                        ⏮️ First
                    </button>
                    <button
                        onClick={() => goToStep(Math.max(0, currentStepIndex - 1))}
                        disabled={currentStepIndex === 0}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-all"
                    >
                        ◀️ Prev
                    </button>
                    <button
                        onClick={() => goToStep(Math.min(timeline.length - 1, currentStepIndex + 1))}
                        disabled={currentStepIndex >= timeline.length - 1}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-all"
                    >
                        Next ▶️
                    </button>
                    <button
                        onClick={() => goToStep(timeline.length - 1)}
                        disabled={currentStepIndex >= timeline.length - 1}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-all"
                    >
                        Last ⏭️
                    </button>
                </div>
            )}

            {/* Current Step Info */}
            {currentStep && (
                <div className="mb-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            currentStep.phase === 'overview' ? 'bg-blue-600' :
                            currentStep.phase === 'initialization' ? 'bg-yellow-600' :
                            currentStep.phase === 'comparison' ? 'bg-purple-600' :
                            currentStep.phase === 'update' ? 'bg-green-600' :
                            currentStep.phase === 'result' ? 'bg-emerald-600' :
                            'bg-gray-600'
                        }`}>
                            {currentStep.phase?.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-sm">{currentStep.description}</span>
                    </div>
                    <p className="text-gray-300 text-sm italic">
                        "{currentStep.speech_script}"
                    </p>
                </div>
            )}

            {/* Visualization Canvas */}
            <div className="flex-grow bg-gray-800 rounded-lg overflow-hidden border border-gray-700 relative">
                <PixiVisualization
                    ref={pixiRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    currentStep={currentStep}
                    onAnimationComplete={() => {
                        console.log('🎬 Animation complete!');
                        setIsPlaying(false);
                    }}
                />

                {timeline.length === 0 && !currentStep && !cinematicReady && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
                        <div className="text-center">
                            <div className="text-4xl mb-2">🎬</div>
                            <p className="text-lg">Cinematic Animation Engine</p>
                            <p className="text-sm text-gray-600 mt-1">
                                Run code → Connect → Watch the magic!
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Cinematic playback indicator */}
                {cinematicReady && isPlaying && (
                    <div className="absolute top-2 right-2 bg-purple-600/80 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                        🎬 Playing Cinematic Story
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            {timeline.length > 0 && (
                <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${((currentStepIndex + 1) / timeline.length) * 100}%` }}
                    />
                </div>
            )}

            {/* Text Input */}
            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                    placeholder="Type: 'next', 'step 3', 'walkthrough', etc..."
                    className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                    onClick={handleSendText}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default VisualExplanationPanelV2;
