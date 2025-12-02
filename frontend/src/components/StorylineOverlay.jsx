import React, { useEffect, useState } from 'react';

const StorylineOverlay = ({ isVisible, phase, inputs, codeMetadata }) => {
  const [displayText, setDisplayText] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  // Typing animation effect
  useEffect(() => {
    if (!isVisible) return;
    
    const messages = {
      1: "Hey! 👋 Reading your code...",
      2: inputs && inputs.length > 0 
        ? `Got it! Using your inputs: ${inputs.join(', ')}`
        : "Analyzing the code structure... done! ✓",
      3: "Let's dry-run this step by step! 🚀",
      4: "Starting visualization..."
    };
    
    const targetText = messages[phase] || '';
    let currentIndex = 0;
    setDisplayText('');
    
    const typeInterval = setInterval(() => {
      if (currentIndex <= targetText.length) {
        setDisplayText(targetText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
      }
    }, 30);
    
    return () => clearInterval(typeInterval);
  }, [phase, isVisible, inputs]);

  // Cursor blink effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center storyline-overlay">
      <div className="max-w-2xl w-full mx-4">
        {/* Main Content Card */}
        <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-8 shadow-2xl animate-scale-in">
          {/* AI Avatar */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 animate-glow-pulse">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10a7 7 0 0 1-14 0"/>
                  <path d="M12 17v4"/>
                  <path d="M8 21h8"/>
                  {/* Eyes */}
                  <circle cx="9" cy="10" r="1" fill="white"/>
                  <circle cx="15" cy="10" r="1" fill="white"/>
                </svg>
              </div>
              {/* Animated rings */}
              <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-teal-400/30 animate-ping" />
              <div className="absolute -inset-2 w-24 h-24 rounded-full border border-teal-400/20" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-white text-center mb-2">
            AI Code Tutor
          </h2>
          <p className="text-slate-400 text-sm text-center mb-6">
            {codeMetadata?.codeType === 'class_method' 
              ? `Analyzing ${codeMetadata.className}.${codeMetadata.functionName}()` 
              : codeMetadata?.codeType === 'function'
              ? `Analyzing ${codeMetadata.functionName}()`
              : 'Analyzing your Python code'}
          </p>

          {/* Typing Text Area */}
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 min-h-[80px] flex items-center">
            <p className="text-lg text-slate-200 leading-relaxed">
              {displayText}
              <span className={`ml-0.5 inline-block w-0.5 h-5 bg-teal-400 ${showCursor ? 'opacity-100' : 'opacity-0'}`} />
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">Preparing visualization</span>
              <span className="text-xs text-slate-500">{Math.min(phase * 25, 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(phase * 25, 100)}%` }}
              />
            </div>
          </div>

          {/* Phase Steps */}
          <div className="mt-6 flex items-center justify-center gap-3">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  phase >= step 
                    ? 'bg-teal-500 text-white scale-110' 
                    : 'bg-slate-700 text-slate-500'
                }`}>
                  {phase > step ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                {step < 4 && (
                  <div className={`w-8 h-0.5 transition-all duration-300 ${
                    phase > step ? 'bg-teal-500' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Phase Labels */}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <span className={`text-xs ${phase >= 1 ? 'text-teal-400' : 'text-slate-500'}`}>Read</span>
            <span className={`text-xs ${phase >= 2 ? 'text-teal-400' : 'text-slate-500'}`}>Analyze</span>
            <span className={`text-xs ${phase >= 3 ? 'text-teal-400' : 'text-slate-500'}`}>Prepare</span>
            <span className={`text-xs ${phase >= 4 ? 'text-teal-400' : 'text-slate-500'}`}>Run</span>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
};

export default StorylineOverlay;
