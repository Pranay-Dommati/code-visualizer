import React from "react";
import StepInlineChat from '../StepInlineChat';

const MainContentArea = ({
  leftPanelTab,
  setLeftPanelTab,
  codeLines,
  visibleSteps,
  highlightSyntax,
  chatMessages,
  isTeacherSpeaking,
  stopSpeaking,
  voiceEnabled,
  setVoiceEnabled,
  chatInput,
  setChatInput,
  handleChatKeyDown,
  isListening,
  startListening,
  stopListening,
  isConversationMode,
  isTeacherThinking,
  sendQuickQuestion,
  sendMessage,
  chatScrollRef,
  scrollContainerRef,
  isLoading,
  loadingPhase,
  teacherContextSet,
  shouldAutoListenRef,
  setIsConversationMode,
  currentNarrationStepRef,
  isNarratingStep,
  isGuidedMode,
  stepExplanationText,
  renderDryRunBox,
  extractDryRunSection,
  renderExplanationWithDryRun,
  waitingForUserInput,
  narratedStepIndex,
  steps,
  moveToNextStep,
  getStepConversation,
  sendStepMessage,
  isStepChatSpeaking,
  speakingStepIndex,
  stepChatListening,
  startStepChatListening,
  stopStepChatListening,
  latestStepRef,
  isStreaming,
  currentStepIndex,
  isPlaying,
}) => {
  return (
    <>
            <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Code Panel (Fixed) */}
        <div className="w-[400px] flex-shrink-0 bg-slate-900/50 border-r border-slate-800 flex flex-col">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setLeftPanelTab('code')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  leftPanelTab === 'code'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Source Code
              </button>
              <button
                onClick={() => setLeftPanelTab('teacher')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  leftPanelTab === 'teacher'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10a7 7 0 0 1-14 0"/>
                  <path d="M12 17v4M8 21h8" strokeLinecap="round"/>
                </svg>
                AI Teacher
              </button>
            </div>
          </div>
          
          {/* Source Code Tab */}
          {leftPanelTab === 'code' && (
          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
            {codeLines.map((line, idx) => {
              const lineNum = idx + 1;
              const currentStep = visibleSteps[visibleSteps.length - 1];
              const isCurrentLine = currentStep?.lineNumber === lineNum;
              const wasExecuted = visibleSteps.some(s => s.lineNumber === lineNum);
              
              return (
                <div
                  key={idx}
                  className={`flex transition-all duration-300 rounded-lg ${
                    isCurrentLine
                      ? 'bg-teal-500/20 border-l-4 border-teal-400 -ml-1 pl-1'
                      : wasExecuted
                      ? 'bg-slate-800/30'
                      : ''
                  }`}
                >
                  <span className={`w-10 text-right pr-4 select-none ${
                    isCurrentLine ? 'text-teal-400 font-bold' : 'text-slate-600'
                  }`}>
                    {lineNum}
                  </span>
                  <span
                    className={`flex-1 whitespace-pre ${
                      isCurrentLine
                        ? 'text-white'
                        : wasExecuted
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {highlightSyntax(line)}
                  </span>
                </div>
              );
            })}
          </div>
          )}

          {/* AI Teacher Tab */}
          {leftPanelTab === 'teacher' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header with voice toggle */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center ${isTeacherSpeaking ? 'animate-pulse' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                      <path d="M19 10a7 7 0 0 1-14 0"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-white">AI Teacher</span>
                  {isTeacherSpeaking && (
                    <span className="text-xs text-purple-400 animate-pulse">Speaking...</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isTeacherSpeaking && (
                    <button
                      onClick={stopSpeaking}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                      title="Stop speaking"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                    className={`p-1.5 rounded-lg transition-all ${
                      voiceEnabled
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-slate-700 text-slate-500'
                    }`}
                    title={voiceEnabled ? 'Voice on' : 'Voice off'}
                  >
                    {voiceEnabled ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
                        <line x1="23" y1="9" x2="17" y2="15"/>
                        <line x1="17" y1="9" x2="23" y2="15"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Chat messages */}
              <div 
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-teal-500 text-white rounded-br-md'
                          : 'bg-slate-700/50 text-slate-200 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.isStreaming && (
                        <span className="inline-flex gap-1 mt-1">
                          <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                          <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                          <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {isTeacherThinking && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                      <span className="inline-flex gap-1">
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                      </span>
                    </div>
                  </div>
                )}
                
                {chatMessages.length === 0 && !isTeacherThinking && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <p className="text-sm text-slate-400">
                      {teacherContextSet 
                        ? "Ask me anything about this code!"
                        : "Loading context..."}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Quick questions */}
              {chatMessages.length <= 1 && (
                <div className="px-4 pb-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "What does this code do?",
                      "Explain the current step",
                      "What's the time complexity?"
                    ].map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendQuickQuestion(q)}
                        disabled={isTeacherThinking}
                        className="text-xs px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-all disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Chat input */}
              <div className="p-3 border-t border-slate-700/50">
                <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={isListening ? "Listening..." : "Ask about the code..."}
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                    disabled={isTeacherThinking || isListening}
                  />
                  
                  {/* Show mic button when input is empty, send button when there's text */}
                  {chatInput.trim() ? (
                    <button
                      onClick={sendMessage}
                      disabled={isTeacherThinking}
                      className="p-2 rounded-lg transition-all bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={isListening ? stopListening : startListening}
                      disabled={isTeacherThinking}
                      className={`p-2 rounded-lg transition-all ${
                        isListening 
                          ? 'bg-red-500 text-white animate-pulse' 
                          : isConversationMode
                            ? 'bg-purple-600 text-white ring-2 ring-purple-400 ring-opacity-50'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title={isListening ? "Stop listening" : isConversationMode ? "Conversation mode active" : "Start voice input"}
                    >
                      {isListening ? (
                        /* Stop icon when listening */
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" rx="2"/>
                        </svg>
                      ) : (
                        /* Microphone icon when not listening */
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                          <line x1="12" y1="19" x2="12" y2="23"/>
                          <line x1="8" y1="23" x2="16" y2="23"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                
                {/* Listening / Conversation mode indicator */}
                {isListening && (
                  <div className="flex items-center justify-center gap-2 mt-2 text-xs text-red-400">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                    </span>
                    <span>Listening... Speak now</span>
                  </div>
                )}
                
                {/* Conversation mode indicator - shows when AI is speaking and will auto-listen */}
                {isConversationMode && isTeacherSpeaking && !isListening && (
                  <div className="flex items-center justify-center gap-2 mt-2 text-xs text-purple-400">
                    <svg className="w-3 h-3 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <span>Voice conversation active • Will listen after response</span>
                  </div>
                )}
                
                {/* Exit conversation mode button */}
                {isConversationMode && !isListening && !isTeacherSpeaking && !isTeacherThinking && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <button
                      onClick={() => {
                        shouldAutoListenRef.current = false;
                        setIsConversationMode(false);
                      }}
                      className="text-xs px-3 py-1 rounded-full bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition-all"
                    >
                      Exit voice mode
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Execution Timeline (Scrollable) */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-slate-700 border-t-teal-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 animate-pulse" />
                </div>
              </div>
              <p className="mt-6 text-lg text-slate-300 animate-pulse">
                {loadingPhase === 1 && "📖 Reading your code..."}
                {loadingPhase === 2 && "🧠 Analyzing execution flow..."}
                {loadingPhase === 3 && "✨ Preparing visualization..."}
                {loadingPhase === 4 && "🚀 Starting execution..."}
              </p>
            </div>
          )}

          {/* Timeline Content */}
          {!isLoading && (
            <div className="max-w-4xl mx-auto py-8 px-6">
              {/* Start Marker */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Execution Started</h2>
                  <p className="text-sm text-slate-400">Watch your code come to life step by step</p>
                </div>
              </div>

              {/* Timeline Items */}
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-500 via-blue-500 to-purple-500" />

                {/* Steps */}
                {visibleSteps.map((step, idx) => {
                  const isLatest = idx === visibleSteps.length - 1;
                  
                  return (
                    <div
                      key={idx}
                      ref={isLatest ? latestStepRef : null}
                      className={`relative pl-16 pb-8 transition-all duration-500 ${
                        isLatest ? 'animate-fade-in-up' : ''
                      }`}
                    >
                      {/* Timeline Node */}
                      <div className={`absolute left-4 w-5 h-5 rounded-full border-2 transition-all ${
                        isLatest
                          ? 'bg-teal-500 border-teal-400 shadow-lg shadow-teal-500/50 scale-125'
                          : 'bg-slate-800 border-slate-600'
                      }`}>
                        {isLatest && (
                          <div className="absolute inset-0 rounded-full bg-teal-400 animate-ping opacity-50" />
                        )}
                      </div>

                      {/* Step Card */}
                      <div className={`bg-slate-800/50 rounded-2xl border transition-all ${
                        isLatest
                          ? 'border-teal-500/50 shadow-xl shadow-teal-500/10'
                          : 'border-slate-700/50'
                      }`}>
                        {/* Card Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
                              <span className="w-6 h-6 rounded-lg bg-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-400">
                                {step.lineNumber}
                              </span>
                              Line {step.lineNumber}
                            </span>
                            {step.event && step.event !== 'line' && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                step.event === 'call' ? 'bg-blue-500/20 text-blue-400' :
                                step.event === 'return' ? 'bg-green-500/20 text-green-400' :
                                'bg-slate-600/50 text-slate-400'
                              }`}>
                                {step.event}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">Step {idx + 1}</span>
                        </div>

                        {/* Code Being Executed */}
                        <div className="px-5 py-4 border-b border-slate-700/50">
                          <div className="bg-slate-900/80 rounded-xl p-4 font-mono text-sm">
                            <code className="text-teal-300 whitespace-pre">
                              {highlightSyntax(step.code)}
                            </code>
                          </div>
                        </div>

                        {/* AI Explanation with Dry-Run - Animated during narration */}
                        {step.explanation && (
                          <div className="px-5 py-4 border-b border-slate-700/50">
                            <div className="flex items-start gap-3">
                              <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center ${
                                currentNarrationStepRef.current === idx ? 'animate-pulse' : ''
                              }`}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                  <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                                  <path d="M19 10a7 7 0 0 1-14 0"/>
                                  <path d="M12 17v4M8 21h8" stroke="white" strokeWidth="2" fill="none"/>
                                </svg>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">AI Explanation</span>
                                  {isNarratingStep && currentNarrationStepRef.current === idx && (
                                    <span className="flex items-center gap-1 text-xs text-purple-400">
                                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                                      Speaking...
                                    </span>
                                  )}
                                </div>
                                {/* Show animated text during narration, or full text after */}
                                {isGuidedMode && stepExplanationText[idx] !== undefined ? (
                                  <>
                                    {/* Animated text explanation */}
                                    <p className="mt-1 text-slate-200 leading-relaxed">
                                      {stepExplanationText[idx] || (
                                        <span className="text-slate-500 italic">Preparing explanation...</span>
                                      )}
                                      {isNarratingStep && currentNarrationStepRef.current === idx && (
                                        <span className="inline-block w-0.5 h-4 bg-teal-400 ml-0.5 animate-pulse"></span>
                                      )}
                                    </p>
                                    {/* Static dry-run box (always visible, not animated) */}
                                    {renderDryRunBox(extractDryRunSection(step.explanation))}
                                  </>
                                ) : (
                                  renderExplanationWithDryRun(step.explanation)
                                )}
                              </div>
                            </div>
                            
                            {/* "Continue" prompt when waiting for user input */}
                            {isGuidedMode && waitingForUserInput && narratedStepIndex === idx && (
                              <div className="mt-4 pt-4 border-t border-slate-700/30">
                                <div className="flex items-center justify-between">
                                  <div 
                                    className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-slate-300 transition-colors"
                                    onClick={() => {
                                      if (!isListening) {
                                        startListening();
                                      }
                                    }}
                                  >
                                    {isListening ? (
                                      <>
                                        <span className="flex gap-1">
                                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                                        </span>
                                        <span className="text-red-400">
                                          {idx < steps.length - 1 
                                            ? 'Listening... Say "next" or ask a question'
                                            : 'Listening... Ask me anything about this step'}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none"/>
                                        </svg>
                                        <span>
                                          {idx < steps.length - 1 
                                            ? 'Click here or say "next" to continue, or ask a question'
                                            : 'Click here to ask a question about this step'}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {/* Only show Next Step button if not the last step */}
                                  {idx < steps.length - 1 && (
                                    <button
                                      onClick={moveToNextStep}
                                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-blue-500 text-white text-sm font-medium hover:from-teal-400 hover:to-blue-400 transition-all"
                                    >
                                      <span>Next Step</span>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 18 15 12 9 6"/>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Inline Step Chat - Ask questions about this specific step */}
                            <StepInlineChat
                              stepIndex={idx}
                              messages={getStepConversation(idx).messages}
                              onSendMessage={(msg) => sendStepMessage(idx, msg)}
                              isLoading={getStepConversation(idx).isLoading}
                              isSpeaking={isStepChatSpeaking && speakingStepIndex === idx}
                              isListening={stepChatListening === idx}
                              onStartListening={() => startStepChatListening(idx)}
                              onStopListening={stopStepChatListening}
                              disabled={isNarratingStep || isTeacherThinking}
                              currentExplanation={step.explanation}
                            />
                          </div>
                        )}

                        {/* Variables State */}
                        {step.variables && Object.keys(step.variables).length > 0 && (
                          <div className="px-5 py-4">
                            <div className="flex items-center gap-2 mb-3">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                              </svg>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Variables</span>
                              {step.changedVars?.length > 0 && (
                                <span className="text-xs bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full">
                                  {step.changedVars.length} changed
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(step.variables).map(([name, data]) => {
                                const isChanged = step.changedVars?.includes(name);
                                const valueStr = typeof data.value === 'object' 
                                  ? JSON.stringify(data.value) 
                                  : String(data.value);
                                
                                return (
                                  <div
                                    key={name}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                      isChanged
                                        ? 'bg-teal-500/20 border border-teal-500/30'
                                        : 'bg-slate-900/50'
                                    }`}
                                  >
                                    <span className={`font-mono text-sm font-semibold ${
                                      isChanged ? 'text-teal-400' : 'text-purple-400'
                                    }`}>
                                      {name}
                                    </span>
                                    <span className="text-slate-500">=</span>
                                    <span className={`font-mono text-sm ${
                                      isChanged ? 'text-teal-300' : 'text-slate-300'
                                    }`}>
                                      {valueStr.length > 30 ? valueStr.slice(0, 30) + '...' : valueStr}
                                    </span>
                                    <span className="text-xs text-slate-600">
                                      ({data.type})
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Output */}
                        {step.output && (
                          <div className="px-5 py-4 border-t border-slate-700/50">
                            <div className="flex items-center gap-2 mb-2">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                                <polyline points="4,17 10,11 4,5"/>
                                <line x1="12" y1="19" x2="20" y2="19"/>
                              </svg>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Output</span>
                            </div>
                            <div className="bg-slate-950 rounded-lg p-3 font-mono text-sm text-green-400">
                              {step.output}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* End Marker - only show when not streaming and all steps are done */}
                {!isStreaming && currentStepIndex >= steps.length - 1 && visibleSteps.length > 0 && steps.length > 0 && (
                  <div className="relative pl-16 pt-4 animate-fade-in">
                    <div className="absolute left-4 w-5 h-5 rounded-full bg-green-500 border-2 border-green-400 shadow-lg shadow-green-500/50" />
                    <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20,6 9,17 4,12" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-400">Execution Complete! 🎉</h3>
                        <p className="text-sm text-slate-400">
                          Successfully executed {steps.length} steps
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Waiting for more steps indicator - show during streaming or playback */}
                {(isStreaming || (isPlaying && currentStepIndex < steps.length - 1)) && (
                  <div className="relative pl-16 pt-4">
                    <div className={`absolute left-4 w-5 h-5 rounded-full border-2 animate-pulse ${isStreaming ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600'}`} />
                    <div className="text-slate-500 text-sm flex items-center gap-2">
                      <span className="inline-flex gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isStreaming ? 'bg-blue-400' : 'bg-teal-400'}`} style={{animationDelay: '0ms'}}></span>
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isStreaming ? 'bg-blue-400' : 'bg-teal-400'}`} style={{animationDelay: '150ms'}}></span>
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isStreaming ? 'bg-blue-400' : 'bg-teal-400'}`} style={{animationDelay: '300ms'}}></span>
                      </span>
                      {isStreaming ? 'Receiving steps from AI...' : 'Executing next step...'}
                    </div>
                  </div>
                )}
              </div>

              {/* Empty state */}
              {visibleSteps.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="10,8 16,12 10,16" fill="currentColor" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-400 mb-2">Ready to Start</h3>
                  <p className="text-slate-500">Press play or spacebar to begin visualization</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </>
  );
};

export default MainContentArea;
