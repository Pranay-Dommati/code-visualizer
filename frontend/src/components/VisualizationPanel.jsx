import React from 'react';

const VisualizationPanel = ({
  steps,
  currentStepIndex,
  onNextStep,
  onPrevStep,
  isRunning,
  executionComplete
}) => {
  const currentStep = steps[currentStepIndex];
  const hasSteps = steps.length > 0;

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></div>
          <span className="text-sm text-slate-300 font-medium">Execution Flow</span>
        </div>
        {hasSteps && (
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            {/* Current Line Execution */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-teal-500/20 rounded-md flex items-center justify-center">
                  <span className="text-xs font-bold text-teal-400">#{currentStep?.lineNumber}</span>
                </div>
                <span className="text-sm font-medium text-slate-300">Executing Line</span>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700/50">
                <code className="text-sm font-mono text-teal-300">{currentStep?.code}</code>
              </div>
              {currentStep?.explanation && (
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  💡 {currentStep.explanation}
                </p>
              )}
            </div>

            {/* Variables Table */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
                <span className="text-sm font-medium text-slate-300">Variables</span>
              </div>
              
              {currentStep?.variables && Object.keys(currentStep.variables).length > 0 ? (
                <div className="bg-slate-900 rounded-lg border border-slate-700/50 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Name</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Value</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(currentStep.variables).map(([name, data], idx) => (
                        <tr 
                          key={name} 
                          className={`border-b border-slate-700/30 last:border-0 transition-colors ${
                            data.changed ? 'bg-teal-500/10' : ''
                          }`}
                        >
                          <td className="px-3 py-2">
                            <span className="font-mono text-sm text-purple-400">{name}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-mono text-sm ${data.changed ? 'text-teal-300' : 'text-slate-300'}`}>
                              {JSON.stringify(data.value)}
                            </span>
                            {data.changed && (
                              <span className="ml-2 text-xs text-teal-500">← updated</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{data.type}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No variables yet</p>
              )}
            </div>

            {/* Array Visualization */}
            {currentStep?.arrays && Object.keys(currentStep.arrays).length > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                    <rect x="1" y="6" width="5" height="12" rx="1"/>
                    <rect x="9.5" y="6" width="5" height="12" rx="1"/>
                    <rect x="18" y="6" width="5" height="12" rx="1"/>
                  </svg>
                  <span className="text-sm font-medium text-slate-300">Array Visualization</span>
                </div>
                
                {Object.entries(currentStep.arrays).map(([name, arr]) => (
                  <div key={name} className="mb-4 last:mb-0">
                    <span className="text-xs font-mono text-purple-400 mb-2 block">{name}:</span>
                    <div className="flex flex-wrap gap-2">
                      {arr.values.map((val, idx) => (
                        <div
                          key={idx}
                          className={`min-w-[40px] h-10 flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-300 ${
                            arr.highlightIndices?.includes(idx)
                              ? 'bg-teal-500/30 border-teal-400 scale-110'
                              : arr.compareIndices?.includes(idx)
                              ? 'bg-yellow-500/20 border-yellow-500'
                              : 'bg-slate-800 border-slate-600'
                          }`}
                        >
                          <span className={`text-sm font-mono font-semibold ${
                            arr.highlightIndices?.includes(idx) ? 'text-teal-300' : 'text-slate-200'
                          }`}>
                            {val}
                          </span>
                          <span className="text-[10px] text-slate-500">[{idx}]</span>
                        </div>
                      ))}
                    </div>
                    {/* Pointers */}
                    {arr.pointers && arr.pointers.length > 0 && (
                      <div className="flex gap-4 mt-2">
                        {arr.pointers.map((ptr, idx) => (
                          <span key={idx} className="text-xs text-slate-400">
                            <span className="text-orange-400 font-mono">{ptr.name}</span> → index {ptr.index}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Loop Information */}
            {currentStep?.loop && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400">
                    <polyline points="23,4 23,10 17,10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  <span className="text-sm font-medium text-slate-300">Loop Status</span>
                </div>
                <div className="bg-slate-900 rounded-lg p-3 border border-slate-700/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Iteration:</span>
                    <span className="text-sm font-mono text-orange-300">{currentStep.loop.iteration} / {currentStep.loop.total}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-300"
                      style={{ width: `${(currentStep.loop.iteration / currentStep.loop.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Output Console */}
            {currentStep?.output && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                    <polyline points="4,17 10,11 4,5"/>
                    <line x1="12" y1="19" x2="20" y2="19"/>
                  </svg>
                  <span className="text-sm font-medium text-slate-300">Output</span>
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
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onPrevStep}
              disabled={currentStepIndex === 0}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                currentStepIndex === 0
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
              Previous
            </button>
            
            <button
              onClick={onNextStep}
              disabled={currentStepIndex === steps.length - 1}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                currentStepIndex === steps.length - 1
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white shadow-lg'
              }`}
            >
              Next
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </button>
          </div>

          {/* Execution Complete Message */}
          {executionComplete && (
            <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
              <span>Execution Complete!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisualizationPanel;
