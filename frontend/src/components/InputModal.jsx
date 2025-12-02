import React, { useState, useEffect } from 'react';

const InputModal = ({ isOpen, onClose, inputs, onSubmit, codeType, functionName, className }) => {
  const [inputValues, setInputValues] = useState({});

  // Initialize input values when modal opens
  useEffect(() => {
    if (isOpen && inputs.length > 0) {
      const initialValues = {};
      inputs.forEach((input, index) => {
        initialValues[index] = '';
      });
      setInputValues(initialValues);
    }
  }, [isOpen, inputs]);

  const handleInputChange = (index, value) => {
    setInputValues(prev => ({
      ...prev,
      [index]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Convert to array of values in order
    const values = inputs.map((_, index) => inputValues[index] || '');
    onSubmit(values);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Move to next input or submit
      if (index < inputs.length - 1) {
        document.getElementById(`input-${index + 1}`)?.focus();
      } else {
        handleSubmit(e);
      }
    }
  };

  const getPlaceholder = (input) => {
    switch (input.type) {
      case 'integer':
        return 'e.g., 42';
      case 'float':
        return 'e.g., 3.14';
      case 'list_int':
        return 'e.g., 1, 2, 3, 4, 5';
      case 'list_str':
        return 'e.g., apple, banana, cherry';
      case 'list':
        return 'e.g., 1 2 3 4 5';
      case 'expression':
        return 'e.g., [1, 2, 3]';
      default:
        return 'Enter value...';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'integer':
        return '123';
      case 'float':
        return '1.5';
      case 'list_int':
      case 'list_str':
      case 'list':
        return '[ ]';
      case 'expression':
        return '{ }';
      default:
        return 'Aa';
    }
  };

  const getTitle = () => {
    if (codeType === 'class_method' && className && functionName) {
      return `Run ${className}.${functionName}()`;
    } else if (codeType === 'function' && functionName) {
      return `Run ${functionName}()`;
    }
    return 'Input Required';
  };

  const getDescription = () => {
    if (codeType === 'class_method') {
      return `Enter the parameters for the ${functionName} method`;
    } else if (codeType === 'function') {
      return `Enter the parameters for the ${functionName} function`;
    }
    return `Your code needs ${inputs.length} input${inputs.length > 1 ? 's' : ''} to run`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-500 rounded-xl flex items-center justify-center">
                {codeType === 'class_method' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 9h6" />
                    <path d="M9 13h6" />
                    <path d="M9 17h4" />
                  </svg>
                ) : codeType === 'function' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <line x1="12" y1="6" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12" y2="16" />
                  </svg>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{getTitle()}</h2>
                <p className="text-sm text-slate-400">{getDescription()}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Code context badge */}
        {(codeType === 'class_method' || codeType === 'function') && (
          <div className="px-6 pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-500">Calling:</span>
              <code className="text-sm font-mono text-teal-400">
                {codeType === 'class_method' 
                  ? `${className}().${functionName}(...)` 
                  : `${functionName}(...)`
                }
              </code>
            </div>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-4">
            {inputs.map((input, index) => (
              <div key={index} className="space-y-2">
                <label 
                  htmlFor={`input-${index}`}
                  className="flex items-center gap-2 text-sm font-medium text-slate-300"
                >
                  <span className="flex items-center justify-center w-6 h-6 bg-slate-800 rounded-md text-xs font-mono text-teal-400">
                    {index + 1}
                  </span>
                  <span>{input.label || input.variable || `Input ${index + 1}`}</span>
                  {input.isParameter && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-md">
                      parameter
                    </span>
                  )}
                </label>
                
                <div className="relative">
                  <input
                    id={`input-${index}`}
                    type="text"
                    value={inputValues[index] || ''}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder={getPlaceholder(input)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 font-mono text-sm transition-all"
                    autoFocus={index === 0}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-700 rounded text-xs text-slate-400 font-mono">
                    {getTypeIcon(input.type)}
                  </div>
                </div>

                {input.type === 'list_int' && (
                  <p className="text-xs text-slate-500 pl-8">
                    💡 Enter comma-separated integers: 1, 2, 3, 4, 5
                  </p>
                )}

                {input.prompt && (
                  <p className="text-xs text-slate-500 pl-8">
                    Prompt: "{input.prompt}"
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-800/30 border-t border-slate-700 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Press Enter to move to next input
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white rounded-lg font-medium text-sm shadow-lg shadow-teal-500/25 transition-all"
              >
                Run Visualization
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputModal;
