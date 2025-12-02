import React from 'react';

const CodeEditor = ({ 
  code, 
  setCode, 
  onStartVisualization, 
  autoGenerateInput, 
  setAutoGenerateInput,
  isRunning,
  currentLine,
  error 
}) => {
  const lines = code.split('\n');
  
  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="ml-3 text-sm text-slate-400 font-medium">main.py</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span className="text-xs text-slate-500">Python</span>
        </div>
      </div>

      {/* Code Area with Line Numbers */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line Numbers */}
        <div className="w-12 bg-slate-850 border-r border-slate-700/50 py-4 select-none overflow-hidden">
          {lines.map((_, index) => (
            <div
              key={index}
              className={`h-6 flex items-center justify-end pr-3 text-xs font-mono transition-all duration-200 ${
                currentLine === index + 1
                  ? 'text-teal-400 font-semibold bg-teal-500/10'
                  : 'text-slate-500'
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>

        {/* Code Editor */}
        <div className="flex-1 relative">
          {/* Highlight overlay for current line */}
          {currentLine && (
            <div
              className="absolute left-0 right-0 h-6 bg-teal-500/10 border-l-2 border-teal-400 pointer-events-none transition-all duration-300"
              style={{ top: `${(currentLine - 1) * 24 + 16}px` }}
            />
          )}
          
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="# Paste your Python code here...

# Example:
arr = [64, 34, 25, 12, 22, 11, 90]
n = len(arr)

for i in range(n):
    for j in range(0, n-i-1):
        if arr[j] > arr[j+1]:
            arr[j], arr[j+1] = arr[j+1], arr[j]

print(arr)"
            className="w-full h-full bg-transparent text-slate-100 font-mono text-sm leading-6 p-4 resize-none outline-none placeholder:text-slate-600"
            spellCheck="false"
            disabled={isRunning}
          />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="px-4 py-4 bg-slate-800/30 border-t border-slate-700">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Auto-generate toggle */}
        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={autoGenerateInput}
                onChange={(e) => setAutoGenerateInput(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-teal-500 transition-colors duration-200"></div>
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-5"></div>
            </div>
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              Auto-Generate Random Input
            </span>
          </label>
          
          <span className="text-xs text-slate-500">
            {lines.length} lines
          </span>
        </div>

        {/* Start Button */}
        <button
          onClick={onStartVisualization}
          disabled={!code.trim() || isRunning}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-300 transform ${
            !code.trim() || isRunning
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {isRunning ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <span>Running...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              <span>Start Visualization</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CodeEditor;
