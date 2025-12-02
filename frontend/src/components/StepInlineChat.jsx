import React, { useState, useRef, useEffect } from 'react';

/**
 * StepInlineChat - Inline conversational chat for each step block
 * Shows conversation thread within the AI Explanation section
 */
const StepInlineChat = ({
  stepIndex,
  messages = [],
  onSendMessage,
  isLoading = false,
  isSpeaking = false,
  isListening = false,
  onStartListening,
  onStopListening,
  disabled = false,
  currentExplanation = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Expand when there are user messages
  useEffect(() => {
    if (messages.some(m => m.from === 'user')) {
      setIsExpanded(true);
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (inputValue.trim() && !isLoading && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      setIsExpanded(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      onStopListening?.();
    } else {
      onStartListening?.();
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-700/30">
      {/* Conversation Thread */}
      {messages.length > 0 && (
        <div 
          className={`mb-4 space-y-3 overflow-hidden transition-all duration-300 ${
            isExpanded ? 'max-h-96 overflow-y-auto' : 'max-h-0'
          }`}
        >
          {messages.map((msg, idx) => (
            <MessageBubble 
              key={idx} 
              message={msg} 
              isLatest={idx === messages.length - 1}
              isSpeaking={isSpeaking && idx === messages.length - 1 && msg.from === 'ai'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Collapse/Expand toggle if there are messages */}
      {messages.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mb-3 text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1 transition-colors"
        >
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {isExpanded ? 'Hide conversation' : `Show ${messages.length} messages`}
        </button>
      )}

      {/* Input Section */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Ask about this step..."}
            disabled={disabled || isLoading || isListening}
            className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 disabled:opacity-50 transition-all"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <LoadingDots />
            </div>
          )}
        </div>

        {/* Mic Button */}
        <button
          onClick={handleMicClick}
          disabled={disabled || isLoading}
          className={`p-2.5 rounded-xl transition-all ${
            isListening
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:text-teal-400 hover:border-teal-500/30'
          } disabled:opacity-50`}
          title={isListening ? "Stop listening" : "Voice input"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none"/>
            <path d="M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
        </button>

        {/* Send Button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || isLoading || !inputValue.trim()}
          className="p-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:from-teal-400 hover:to-blue-400 transition-all"
          title="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {/* Quick prompts */}
      <div className="mt-3 flex flex-wrap gap-2">
        {getQuickPrompts(currentExplanation).map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => {
              setInputValue(prompt);
              inputRef.current?.focus();
            }}
            disabled={disabled || isLoading}
            className="px-3 py-1.5 text-xs bg-slate-800/40 text-slate-400 rounded-lg border border-slate-700/30 hover:bg-slate-700/40 hover:text-slate-300 hover:border-slate-600/50 transition-all disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * MessageBubble - Individual message in the conversation
 */
const MessageBubble = ({ message, isLatest, isSpeaking }) => {
  const isAI = message.from === 'ai';
  
  return (
    <div 
      className={`flex gap-2 ${isLatest ? 'animate-fadeIn' : ''}`}
      style={{
        animation: isLatest ? 'fadeSlideIn 0.3s ease-out' : 'none'
      }}
    >
      {isAI ? (
        // AI Message
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10a7 7 0 0 1-14 0"/>
          </svg>
        </div>
      ) : (
        // User Message
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      )}
      
      <div className={`flex-1 ${isAI ? '' : 'text-right'}`}>
        <div 
          className={`inline-block px-3 py-2 rounded-xl text-sm ${
            isAI 
              ? 'bg-slate-800/60 text-slate-200 rounded-tl-none' 
              : 'bg-purple-500/20 text-purple-200 rounded-tr-none'
          }`}
        >
          <p className="leading-relaxed">{message.text}</p>
          {isSpeaking && (
            <span className="inline-flex items-center gap-1 ml-2 text-xs text-teal-400">
              <span className="w-1 h-1 bg-teal-400 rounded-full animate-pulse"></span>
              Speaking...
            </span>
          )}
        </div>
        {message.timestamp && (
          <span className="text-xs text-slate-600 mt-1 block">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * LoadingDots - Animated loading indicator
 */
const LoadingDots = () => (
  <span className="flex gap-1">
    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
  </span>
);

/**
 * Get contextual quick prompts based on explanation content
 */
const getQuickPrompts = (explanation) => {
  const prompts = ['Why this approach?', 'What happens next?'];
  
  if (explanation?.toLowerCase().includes('loop') || explanation?.toLowerCase().includes('for')) {
    prompts.push('Explain the loop');
  }
  if (explanation?.toLowerCase().includes('if') || explanation?.toLowerCase().includes('condition')) {
    prompts.push('Why this condition?');
  }
  if (explanation?.toLowerCase().includes('return')) {
    prompts.push('What does it return?');
  }
  if (explanation?.toLowerCase().includes('variable') || explanation?.toLowerCase().includes('assign')) {
    prompts.push('Why this variable?');
  }
  
  return prompts.slice(0, 3); // Max 3 prompts
};

/**
 * Format timestamp for display
 */
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Add CSS keyframes for animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
if (!document.querySelector('#step-chat-animations')) {
  styleSheet.id = 'step-chat-animations';
  document.head.appendChild(styleSheet);
}

export default StepInlineChat;
