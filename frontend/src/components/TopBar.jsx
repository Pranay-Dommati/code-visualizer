import React from 'react';

const TopBar = ({ onUploadExample }) => {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 shadow-lg">
      {/* Logo and Title */}
      <div className="flex items-center gap-3">
        {/* Bracket Icon Logo */}
        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md">
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            className="text-white"
          >
            <path 
              d="M9 3L5 12L9 21" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M15 3L19 12L15 21" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Python Code Visualizer
          </h1>
          <p className="text-xs text-slate-400">Learn by watching your code execute</p>
        </div>
      </div>

      {/* Right Actions */}
      <button
        onClick={onUploadExample}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all duration-200 border border-slate-600 hover:border-slate-500"
      >
        <svg 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17,8 12,3 7,8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="font-medium text-sm">Upload Example Code</span>
      </button>
    </header>
  );
};

export default TopBar;
