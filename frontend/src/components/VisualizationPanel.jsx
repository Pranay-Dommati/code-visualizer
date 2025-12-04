import React, { useEffect, useRef, useState } from 'react';

const VisualizationPanel = ({
    steps,
    currentStepIndex,
    onNextStep,
    onPrevStep,
    isRunning,
    executionComplete,
}) => {
    const currentStep = steps[currentStepIndex];
    const previousStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null;
    const hasSteps = steps.length > 0;
    const contentRef = useRef(null);
    const [animationKey, setAnimationKey] = useState(0);

    // Trigger animation on step change
    useEffect(() => {
        setAnimationKey(prev => prev + 1);
    }, [currentStepIndex]);

    // Auto-scroll to top on new step
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentStepIndex]);

    // Get previous value of a variable for showing transitions
    const getPreviousValue = (varName) => {
        if (previousStep?.variables?.[varName]) {
            return previousStep.variables[varName].value;
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col bg-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${hasSteps ? 'bg-teal-400 animate-pulse' : 'bg-slate-600'}`}></div>
                    <span className="text-sm text-slate-300 font-medium">Execution Flow</span>
                </div>
                {hasSteps && (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md">
                            Step {currentStepIndex + 1} of {steps.length}
                        </span>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 smooth-scroll" ref={contentRef}>
                {!hasSteps ? (
                    /* Empty State */
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 mb-6 bg-slate-800 rounded-2xl flex items-center justify-center">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                                <circle cx="12" cy="12" r="10" />
                                <polygon points="10,8 16,12 10,16" fill="currentColor" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-400 mb-2">Ready to Visualize</h3>
                        <p className="text-sm text-slate-500 max-w-xs">
                            Paste your Python code on the left and click "Start Visualization" to see the execution flow step by step.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Current Line Execution - Cinematic Style */}
                        <div
                            key={`line-${animationKey}`}
                            className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 animate-fade-in"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20 animate-glow-pulse">
                                    <span className="text-xs font-bold text-white">#{currentStep?.lineNumber}</span>
                                </div>
                                <span className="text-sm font-medium text-slate-300">Executing Line</span>
                                {currentStep?.event && currentStep.event !== 'line' && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full animate-scale-in ${currentStep.event === 'call' ? 'bg-blue-500/20 text-blue-400' :
                                        currentStep.event === 'return' ? 'bg-green-500/20 text-green-400' :
                                            currentStep.event === 'exception' ? 'bg-red-500/20 text-red-400' :
                                                'bg-slate-600/50 text-slate-400'
                                        }`}>
                                        {currentStep.event}
                                    </span>
                                )}
                            </div>
                            <div className="bg-slate-900 rounded-lg p-4 border border-teal-500/30 relative overflow-hidden">
                                {/* Animated background glow */}
                                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-blue-500/5 animate-pulse" />
                                <code className="relative text-base font-mono text-teal-300 font-semibold">
                                    {currentStep?.code}
                                </code>
                            </div>
                        </div>

                        {/* AI Tutor Narration - Cinematic Fade In */}
                        {currentStep?.explanation && (
                            <div
                                key={`explanation-${animationKey}`}
                                className="bg-gradient-to-r from-teal-500/10 to-blue-500/10 rounded-xl p-4 border border-teal-500/30 relative animate-fade-in-up"
                                style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
                            >
                                <div className="flex items-start gap-3">
                                    {/* AI Tutor Avatar */}
                                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/25">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                                            <path d="M19 10a7 7 0 0 1-14 0" />
                                            <path d="M12 17v4" />
                                            <path d="M8 21h8" />
                                        </svg>
                                    </div>

                                    {/* Speech Bubble */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-semibold text-teal-400">AI Tutor</span>
                                            <span className="text-xs text-slate-500">explaining...</span>
                                        </div>
                                        <p className="text-base text-slate-200 leading-relaxed">
                                            {currentStep.explanation}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Variables Table - With Smooth Transitions */}
                        <div
                            key={`vars-${animationKey}`}
                            className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 animate-slide-in-right"
                            style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <line x1="3" y1="9" x2="21" y2="9" />
                                    <line x1="9" y1="21" x2="9" y2="9" />
                                </svg>
                                <span className="text-sm font-medium text-slate-300">Variables</span>
                                {currentStep?.changedVars?.length > 0 && (
                                    <span className="text-xs bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full animate-pulse">
                                        {currentStep.changedVars.length} changed
                                    </span>
                                )}
                            </div>

                            {currentStep?.variables && Object.keys(currentStep.variables).length > 0 ? (
                                <div className="space-y-2">
                                    {Object.entries(currentStep.variables).map(([name, data], idx) => {
                                        const isChanged = currentStep?.changedVars?.includes(name);
                                        const prevValue = getPreviousValue(name);
                                        const valueStr = typeof data.value === 'object' ? JSON.stringify(data.value) : String(data.value);
                                        const prevValueStr = prevValue !== null ? (typeof prevValue === 'object' ? JSON.stringify(prevValue) : String(prevValue)) : null;

                                        return (
                                            <div
                                                key={name}
                                                className={`flex items-center justify-between p-3 rounded-lg transition-all duration-500 ${isChanged ? 'bg-teal-500/15 border border-teal-500/30 animate-var-flash' : 'bg-slate-900/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-mono text-sm font-semibold ${isChanged ? 'text-teal-400' : 'text-purple-400'}`}>
                                                        {name}
                                                    </span>
                                                    <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                                                        {data.type}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isChanged && prevValueStr !== null && prevValueStr !== valueStr && (
                                                        <>
                                                            <span className="font-mono text-sm text-slate-500 line-through">
                                                                {prevValueStr.length > 20 ? prevValueStr.slice(0, 20) + '...' : prevValueStr}
                                                            </span>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-400">
                                                                <polyline points="9,18 15,12 9,6" />
                                                            </svg>
                                                        </>
                                                    )}
                                                    <span className={`font-mono text-sm font-semibold ${isChanged ? 'text-teal-300' : 'text-slate-300'}`}>
                                                        {valueStr.length > 30 ? valueStr.slice(0, 30) + '...' : valueStr}
                                                    </span>
                                                    {isChanged && (
                                                        <span className="flex items-center gap-1 text-xs text-teal-500">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                                                                <polyline points="23,4 23,10 17,10" />
                                                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic text-center py-4">No variables yet</p>
                            )}
                        </div>

                        {/* Output Console */}
                        {currentStep?.output && (
                            <div
                                className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 animate-fade-in"
                                style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                                        <polyline points="4,17 10,11 4,5" />
                                        <line x1="12" y1="19" x2="20" y2="19" />
                                    </svg>
                                    <span className="text-sm font-medium text-slate-300">Console Output</span>
                                </div>
                                <div className="bg-slate-950 rounded-lg p-3 border border-slate-700/50">
                                    <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap">{currentStep.output}</pre>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Steps Timeline Controls */}
            {hasSteps && (
                <div className="px-4 py-4 bg-slate-800/30 border-t border-slate-700">
                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>Progress</span>
                            <span>{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500 ease-out"
                                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                            />
                        </div>
                        {/* Step markers */}
                        <div className="flex justify-between mt-1">
                            {steps.length <= 20 && steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx <= currentStepIndex ? 'bg-teal-400' : 'bg-slate-600'
                                        } ${idx === currentStepIndex ? 'scale-150' : ''}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onPrevStep}
                            disabled={currentStepIndex === 0}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${currentStepIndex === 0
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
                                }`}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="15,18 9,12 15,6" />
                            </svg>
                            Previous
                        </button>


                        <button
                            onClick={onNextStep}
                            disabled={currentStepIndex === steps.length - 1}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${currentStepIndex === steps.length - 1
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white shadow-lg'
                                }`}
                        >
                            Next
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9,18 15,12 9,6" />
                            </svg>
                        </button>
                    </div>


                    {/* Execution Complete Message */}
                    {executionComplete && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-sm animate-fade-in">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22,4 12,14.01 9,11.01" />
                            </svg>
                            <span>Execution Complete! 🎉</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VisualizationPanel;
