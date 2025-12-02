import React, { useEffect, useRef, useState, useCallback } from 'react';
import StepInlineChat from './StepInlineChat';
import useStepChat from '../hooks/useStepChat';
import MainContentArea from "./visualizer/MainContentArea";
const API_BASE_URL = 'http://localhost:5000/api';
import { createNarrateStepExplanation } from "./visualizer/NarrateStepExplanation";
const ImmersiveVisualizer = ({
  isOpen,
  onClose,
  steps,
  code,
  codeLines,
  isLoading,
  loadingPhase
}) => {
  const [visibleSteps, setVisibleSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(2000); // ms per step
  const [isStreaming, setIsStreaming] = useState(false); // Track if we're receiving streamed data
  const [leftPanelTab, setLeftPanelTab] = useState('code'); // 'code' or 'teacher'
  
  // AI Teacher state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isTeacherThinking, setIsTeacherThinking] = useState(false);
  const [isTeacherSpeaking, setIsTeacherSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [teacherContextSet, setTeacherContextSet] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false); // Track if current message is voice mode
  const [isConversationMode, setIsConversationMode] = useState(false); // Continuous voice loop
  
  // Guided narration state
  const [isGuidedMode, setIsGuidedMode] = useState(true); // Enable guided narration by default
  const [isNarratingStep, setIsNarratingStep] = useState(false); // Currently narrating a step
  const [narratedStepIndex, setNarratedStepIndex] = useState(-1); // Which step has been narrated
  const [waitingForUserInput, setWaitingForUserInput] = useState(false); // Waiting for "next" or question
  const [stepExplanationText, setStepExplanationText] = useState({}); // Text being typed for each step
  
  // Step inline chat state
  const [stepChatListening, setStepChatListening] = useState(null); // Which step is listening for voice
  
  const scrollContainerRef = useRef(null);
  const latestStepRef = useRef(null);
  const playIntervalRef = useRef(null);
  const prevStepsLengthRef = useRef(0);
  const chatScrollRef = useRef(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingQueueRef = useRef(false);
  const pendingTextRef = useRef('');
  const displayedTextRef = useRef(''); // For voice mode - text shown so far
  const shouldAutoListenRef = useRef(false); // Track if we should auto-listen after speaking
  const currentNarrationStepRef = useRef(-1); // Track which step is being narrated
  const stepChatRecognitionRef = useRef(null); // Separate recognition for step chats
  
  // Callback when step chat AI finishes responding - restart listening
  const handleStepChatResponseComplete = useCallback((stepIndex) => {
    console.log('Step chat response complete for step', stepIndex, '- restarting listening');
    // Only auto-listen if we're in guided mode and waiting for input
    if (isGuidedMode && waitingForUserInput) {
      shouldAutoListenRef.current = true;
      // Dispatch auto-listen event after a short delay
      setTimeout(() => {
        if (shouldAutoListenRef.current) {
          const listenEvent = new CustomEvent('autoStartListening');
          window.dispatchEvent(listenEvent);
        }
      }, 500);
    }
  }, [isGuidedMode, waitingForUserInput]);
  
  // Use the step chat hook
  const {
    stepConversations,
    activeStepChat,
    isStepChatSpeaking,
    speakingStepIndex,
    getStepConversation,
    sendStepMessage,
    clearAllConversations,
    stopStepSpeaking,
    setActiveStepChat,
  } = useStepChat({ 
    steps, 
    code, 
    codeLines,
    onResponseComplete: handleStepChatResponseComplete,
    sharedAudioRef: audioRef  // Share audio ref to prevent dual playback
  });

  // Step chat voice input functions
  const startStepChatListening = useCallback((stepIndex) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }
    
    // Stop any other listening
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (stepChatRecognitionRef.current) {
      stepChatRecognitionRef.current.stop();
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    let finalTranscript = '';
    
    recognition.onstart = () => {
      setStepChatListening(stepIndex);
    };
    
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
    };
    
    recognition.onend = () => {
      setStepChatListening(null);
      if (finalTranscript.trim()) {
        sendStepMessage(stepIndex, finalTranscript.trim());
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Step chat recognition error:', event.error);
      setStepChatListening(null);
    };
    
    stepChatRecognitionRef.current = recognition;
    recognition.start();
  }, [sendStepMessage]);

  const stopStepChatListening = useCallback(() => {
    if (stepChatRecognitionRef.current) {
      stepChatRecognitionRef.current.stop();
      stepChatRecognitionRef.current = null;
    }
    setStepChatListening(null);
  }, []);

  // Reset when opened
  useEffect(() => {
    if (isOpen && !isLoading) {
      setVisibleSteps([]);
      setCurrentStepIndex(-1);
      prevStepsLengthRef.current = 0;
      setChatMessages([]);
      setTeacherContextSet(false);
      // Reset guided narration state
      setIsNarratingStep(false);
      setNarratedStepIndex(-1);
      setWaitingForUserInput(false);
      setStepExplanationText({});
      currentNarrationStepRef.current = -1;
      // Clear step conversations
      clearAllConversations();
      // Don't auto-play yet, wait for steps to stream in
    }
  }, [isOpen, isLoading, clearAllConversations]);

  // Set AI Teacher context when steps are loaded
  useEffect(() => {
    if (!isOpen || isLoading || steps.length === 0) return;
    
    const setContext = async () => {
      try {
        console.log('Setting AI Teacher context with', steps.length, 'steps');
        await fetch(`${API_BASE_URL}/teacher/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code,
            codeLines: codeLines,
            steps: steps
          })
        });
        setTeacherContextSet(true);
        
        // Add welcome message only if this is the first time
        if (chatMessages.length === 0) {
          setChatMessages([{
            role: 'assistant',
            content: `Hi! I'm your AI coding teacher. I've analyzed this code and all ${steps.length} execution steps. Ask me anything about how it works, why certain things happen, or any programming concepts you'd like to understand better!`
          }]);
        }
      } catch (err) {
        console.error('Failed to set teacher context:', err);
      }
    };
    
    // Wait for streaming to complete before setting context
    if (!isStreaming && steps.length > 0) {
      setContext();
    }
  }, [isOpen, isLoading, isStreaming, steps, code, codeLines]);

  // Handle streaming steps - in guided mode, only show first step initially
  useEffect(() => {
    if (!isOpen || isLoading) return;
    
    const newStepsCount = steps.length - prevStepsLengthRef.current;
    
    if (newStepsCount > 0) {
      // New steps have arrived via streaming
      setIsStreaming(true);
      
      if (isGuidedMode) {
        // In guided mode, only show first step when it arrives
        if (prevStepsLengthRef.current === 0 && steps.length > 0) {
          setVisibleSteps([steps[0]]);
          setCurrentStepIndex(0);
        }
        // Don't auto-add more steps - they'll be added when user says "next"
      } else {
        // Not guided mode - add all new steps
        const newSteps = steps.slice(prevStepsLengthRef.current);
        setVisibleSteps(prev => [...prev, ...newSteps]);
        setCurrentStepIndex(steps.length - 1);
      }
      
      prevStepsLengthRef.current = steps.length;
    }
  }, [steps, isOpen, isLoading, isGuidedMode]);

  // Start auto-play after streaming is done (user can still pause/play)
  useEffect(() => {
    if (isStreaming && steps.length > 0 && (visibleSteps.length === steps.length || isGuidedMode)) {
      // All steps have been received (or in guided mode, we've started)
      setIsStreaming(false);
    }
  }, [isStreaming, steps.length, visibleSteps.length]);

  // Auto-play logic (for manual playback control after streaming) - disabled in guided mode
  useEffect(() => {
    // Skip auto-play in guided mode
    if (isGuidedMode) {
      return () => clearTimeout(playIntervalRef.current);
    }
    
    if (isPlaying && !isStreaming && currentStepIndex < steps.length - 1) {
      playIntervalRef.current = setTimeout(() => {
        const nextIndex = currentStepIndex + 1;
        setCurrentStepIndex(nextIndex);
        setVisibleSteps(prev => {
          // Only add if not already visible
          if (prev.length <= nextIndex) {
            return [...prev, steps[nextIndex]];
          }
          return prev;
        });
      }, currentStepIndex === -1 ? 300 : playbackSpeed);
    } else if (!isStreaming && currentStepIndex >= steps.length - 1) {
      setIsPlaying(false);
    }

    return () => clearTimeout(playIntervalRef.current);
  }, [isPlaying, isStreaming, currentStepIndex, steps, playbackSpeed, isGuidedMode]);

  // Auto-scroll to latest step only if user is near the bottom
  useEffect(() => {
    if (latestStepRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      
      // Only auto-scroll if user is within 300px of the bottom (not reading previous content)
      if (scrollBottom < 300) {
        latestStepRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  }, [visibleSteps]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      // Don't capture shortcuts when typing in an input field
      const activeElement = document.activeElement;
      const isTyping = activeElement.tagName === 'INPUT' || 
                       activeElement.tagName === 'TEXTAREA' || 
                       activeElement.isContentEditable;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && !isTyping) {
        e.preventDefault();
        if (!isStreaming) {
          setIsPlaying(prev => !prev);
        }
      } else if (e.key === 'ArrowRight' && !isPlaying && !isStreaming && !isTyping) {
        // Manual next step
        if (currentStepIndex < steps.length - 1) {
          const nextIndex = currentStepIndex + 1;
          setCurrentStepIndex(nextIndex);
          setVisibleSteps(prev => {
            if (prev.length <= nextIndex) {
              return [...prev, steps[nextIndex]];
            }
            return prev;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, isStreaming, currentStepIndex, steps, onClose]);

  const togglePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
  };

  const handleRestart = () => {
    setVisibleSteps([]);
    setCurrentStepIndex(-1);
    setIsStreaming(false);
    // Replay all steps one by one with playback
    setTimeout(() => {
      setIsPlaying(true);
    }, 100);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Animate text using precise character timestamps from ElevenLabs
  const animateTextWithTimestamps = useCallback((textToAnimate, alignment, audio, onComplete) => {
    const baseDisplayed = displayedTextRef.current;
    const prefix = baseDisplayed ? ' ' : '';
    
    // Get character timing arrays
    const charStartTimes = alignment?.character_start_times_seconds || [];
    const characters = alignment?.characters || [];
    
    if (charStartTimes.length === 0 || characters.length === 0) {
      // Fallback to simple animation if no alignment data
      return null;
    }
    
    let animationFrame = null;
    let lastCharIndex = 0;
    
    const updateText = () => {
      if (!audio || audio.paused || audio.ended) {
        // Audio stopped - show remaining text
        displayedTextRef.current = baseDisplayed + prefix + textToAnimate;
        setChatMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: displayedTextRef.current,
              isStreaming: true
            };
          }
          return newMessages;
        });
        if (onComplete) onComplete();
        return;
      }
      
      const currentTime = audio.currentTime;
      
      // Find how many characters should be visible at current time
      let visibleChars = 0;
      for (let i = 0; i < charStartTimes.length; i++) {
        if (charStartTimes[i] <= currentTime) {
          visibleChars = i + 1;
        } else {
          break;
        }
      }
      
      // Only update if we have new characters to show
      if (visibleChars > lastCharIndex) {
        lastCharIndex = visibleChars;
        const visibleText = characters.slice(0, visibleChars).join('');
        const currentText = baseDisplayed + prefix + visibleText;
        
        setChatMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: currentText,
              isStreaming: true
            };
          }
          return newMessages;
        });
      }
      
      // Continue animation
      animationFrame = requestAnimationFrame(updateText);
    };
    
    // Start the animation loop
    animationFrame = requestAnimationFrame(updateText);
    
    // Return cleanup function
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  // Fallback: Animate text character by character based on audio duration
  const animateTextWithDuration = useCallback((textToAnimate, audioDuration, onComplete) => {
    const baseDisplayed = displayedTextRef.current;
    const prefix = baseDisplayed ? ' ' : '';
    const fullText = prefix + textToAnimate;
    const charCount = fullText.length;
    
    // Calculate delay per character based on audio duration
    const totalDuration = audioDuration ? audioDuration * 1000 : charCount * 60;
    const delayPerChar = Math.max(15, totalDuration / charCount);
    
    let currentIndex = 0;
    let timeoutId = null;
    
    const animateNext = () => {
      if (currentIndex < charCount) {
        currentIndex++;
        const currentText = baseDisplayed + fullText.substring(0, currentIndex);
        
        setChatMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: currentText,
              isStreaming: true
            };
          }
          return newMessages;
        });
        
        timeoutId = setTimeout(animateNext, delayPerChar);
      } else {
        displayedTextRef.current = baseDisplayed + fullText;
        if (onComplete) onComplete();
      }
    };
    
    animateNext();
    
    // Return cleanup function
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Auto-start listening for conversation mode
  const autoStartListening = useCallback(() => {
    if (shouldAutoListenRef.current && !isTeacherThinking) {
      // Small delay before starting to listen again
      setTimeout(() => {
        if (shouldAutoListenRef.current && !isTeacherThinking && !isTeacherSpeaking) {
          // Trigger startListening
          const listenEvent = new CustomEvent('autoStartListening');
          window.dispatchEvent(listenEvent);
        }
      }, 500);
    }
  }, [isTeacherThinking, isTeacherSpeaking]);

  // Play next audio in queue - reveals text in sync with speech
  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      setIsTeacherSpeaking(false);
      setIsVoiceMode(false);
      setChatMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
          newMessages[newMessages.length - 1] = {
            ...newMessages[newMessages.length - 1],
            isStreaming: false
          };
        }
        return newMessages;
      });
      
      // Auto-restart listening in conversation mode
      autoStartListening();
      return;
    }
    
    isPlayingQueueRef.current = true;
    setIsTeacherSpeaking(true);
    
    const textToSpeak = audioQueueRef.current.shift();
    let cleanupAnimation = null;
    
    try {
      // Request audio WITH timestamps for precise sync
      const response = await fetch(`${API_BASE_URL}/teacher/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: textToSpeak, 
          format: 'base64',
          with_timestamps: true 
        })
      });
      
      if (!response.ok) {
        cleanupAnimation = animateTextWithDuration(textToSpeak, null, () => {
          setTimeout(() => playNextInQueue(), 200);
        });
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.audio) {
        // Stop any currently playing audio before starting new segment
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audioRef.current = audio;
        
        // Check if we have alignment data for precise sync
        const hasAlignment = data.alignment && 
          data.alignment.character_start_times_seconds && 
          data.alignment.character_start_times_seconds.length > 0;
        
        audio.onplay = () => {
          if (hasAlignment) {
            // Use precise character-level sync
            cleanupAnimation = animateTextWithTimestamps(textToSpeak, data.alignment, audio, null);
          } else {
            // Fallback to duration-based animation
            const duration = audio.duration || (textToSpeak.length * 0.06);
            cleanupAnimation = animateTextWithDuration(textToSpeak, duration, null);
          }
        };
        
        audio.onended = () => {
          if (cleanupAnimation) cleanupAnimation();
          // Ensure full text is shown
          displayedTextRef.current += (displayedTextRef.current ? ' ' : '') + textToSpeak;
          setChatMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
              newMessages[newMessages.length - 1] = {
                role: 'assistant',
                content: displayedTextRef.current,
                isStreaming: audioQueueRef.current.length > 0
              };
            }
            return newMessages;
          });
          playNextInQueue();
        };
        
        audio.onerror = () => {
          if (cleanupAnimation) cleanupAnimation();
          displayedTextRef.current += (displayedTextRef.current ? ' ' : '') + textToSpeak;
          setChatMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
              newMessages[newMessages.length - 1] = {
                role: 'assistant',
                content: displayedTextRef.current,
                isStreaming: true
              };
            }
            return newMessages;
          });
          setTimeout(() => playNextInQueue(), 300);
        };
        
        try {
          await audio.play();
        } catch (playErr) {
          console.error('Audio play failed:', playErr);
          cleanupAnimation = animateTextWithDuration(textToSpeak, null, () => {
            setTimeout(() => playNextInQueue(), 200);
          });
        }
      } else {
        cleanupAnimation = animateTextWithDuration(textToSpeak, null, () => {
          setTimeout(() => playNextInQueue(), 200);
        });
      }
    } catch (err) {
      console.error('TTS fetch error:', err);
      cleanupAnimation = animateTextWithDuration(textToSpeak, null, () => {
        setTimeout(() => playNextInQueue(), 200);
      });
    }
  }, [animateTextWithTimestamps, animateTextWithDuration]);

  // Queue text for TTS (splits by sentences) - only used in voice mode
  const queueForSpeech = useCallback((fullText) => {
    if (!fullText) return;
    
    // Split by sentence endings (., !, ?) - handle edge cases better
    const sentences = fullText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    
    // If no sentences found (no punctuation), just use the whole text
    if (sentences.length === 0) {
      sentences.push(fullText);
    }
    
    for (const sentence of sentences) {
      if (sentence.trim()) {
        audioQueueRef.current.push(sentence.trim());
      }
    }
    
    // Start playing if not already
    if (!isPlayingQueueRef.current && audioQueueRef.current.length > 0) {
      isPlayingQueueRef.current = true;
      playNextInQueue();
    }
  }, [playNextInQueue]);

  // Flush remaining text at end of stream (not needed in new approach)
  const flushPendingText = useCallback(() => {
    // Not used anymore - keeping for compatibility
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    // Clear the queue
    audioQueueRef.current = [];
    pendingTextRef.current = '';
    displayedTextRef.current = '';
    isPlayingQueueRef.current = false;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsTeacherSpeaking(false);
    setIsVoiceMode(false);
  }, []);

  // ============ GUIDED STEP NARRATION ============
  
  // Narrate a step's explanation with synchronized text and voice
  const narrateStepExplanation = useCallback(
  createNarrateStepExplanation({
    API_BASE_URL,
    audioRef,
    setIsNarratingStep,
    currentNarrationStepRef,
    setStepExplanationText,
    setNarratedStepIndex,
    setWaitingForUserInput,
    shouldAutoListenRef,
    setIsConversationMode,
    stopStepSpeaking,
  }),
  [stopStepSpeaking]
);


  // Handle user response during guided mode
  const handleGuidedUserInput = useCallback((userMessage) => {
    const lowerMessage = userMessage.toLowerCase().trim();
    
    // Check if user wants to continue to next step
    const continueKeywords = ['next', 'continue', 'go on', 'proceed', 'yes', 'okay', 'ok', 'sure', 'move on', 'next step'];
    const wantsToContinue = continueKeywords.some(kw => lowerMessage.includes(kw));
    
    if (wantsToContinue && waitingForUserInput) {
      // Move to next step
      setWaitingForUserInput(false);
      moveToNextStep();
    } else {
      // User has a question - open AI Teacher and answer it
      setLeftPanelTab('teacher');
      // The voice message will be handled by the regular sendVoiceMessage
    }
  }, [waitingForUserInput]);

  // Move to next step (called after user says "next" or clicks button)
  const moveToNextStep = useCallback(() => {
    setWaitingForUserInput(false);
    
    // Stop any currently playing audio (narration or step chat)
    stopSpeaking();
    stopStepSpeaking();
    setIsNarratingStep(false); // Force reset narration state
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
      setVisibleSteps(prev => {
        if (prev.length <= nextIndex) {
          return [...prev, steps[nextIndex]];
        }
        return prev;
      });
      
      // Auto-scroll to the new step after it renders
      setTimeout(() => {
        if (latestStepRef.current) {
          latestStepRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
      
      // Narrate the new step after a short delay
      setTimeout(() => {
       if (steps[nextIndex]?.explanation) {
        narrateStepExplanation(
            nextIndex,
            steps[nextIndex].explanation,
            false, // Force start by passing false for isNarratingStep
            isGuidedMode,
            steps
        );
        }

      }, 500);
    }
  }, [currentStepIndex, steps, narrateStepExplanation, stopSpeaking, stopStepSpeaking, isGuidedMode]);

  // Start guided narration when first step appears
  useEffect(() => {
    if (isGuidedMode && visibleSteps.length === 1 && narratedStepIndex === -1 && !isNarratingStep && !isLoading) {
      const firstStep = visibleSteps[0];
      if (firstStep?.explanation) {
        // Small delay to let the UI render
        setTimeout(() => {
        narrateStepExplanation(
            0,
            firstStep.explanation,
            isNarratingStep,
            isGuidedMode,
            steps
        );
        }, 1000);

      }
    }
  }, [isGuidedMode, visibleSteps, narratedStepIndex, isNarratingStep, isLoading, narrateStepExplanation]);

  // Send message to AI Teacher (TEXT MODE - no voice)
  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || isTeacherThinking) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    
    // Stop any ongoing speech before new message
    stopSpeaking();
    
    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTeacherThinking(true);
    
    try {
      // Get streaming response
      const response = await fetch(`${API_BASE_URL}/teacher/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          currentStepIndex: currentStepIndex
        })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      
      // Add placeholder for assistant response
      setChatMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                fullResponse += data.content;
                
                // Text mode: just show text streaming, no voice
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: fullResponse,
                    isStreaming: true
                  };
                  return newMessages;
                });
              } else if (data.type === 'done') {
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: fullResponse,
                    isStreaming: false
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
      
      setIsTeacherThinking(false);
      
    } catch (err) {
      console.error('Chat error:', err);
      setIsTeacherThinking(false);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again."
      }]);
    }
  }, [chatInput, isTeacherThinking, currentStepIndex]);

  // Voice input - Start listening (enables conversation mode)
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    // Stop any current audio playback
    stopSpeaking();
    
    // Enable conversation mode - will auto-listen after AI responds
    shouldAutoListenRef.current = true;
    
    // Only enable AI Teacher conversation mode if NOT in guided mode
    if (!isGuidedMode) {
      setIsConversationMode(true);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    let finalTranscriptResult = '';
    
    recognition.onstart = () => {
      setIsListening(true);
      setChatInput('');
    };
    
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          finalTranscriptResult = finalTranscript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update input with what's being heard
      setChatInput(finalTranscript || interimTranscript);
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      // Don't disable conversation mode on error - just stop this session
      if (event.error === 'not-allowed') {
        shouldAutoListenRef.current = false;
        setIsConversationMode(false);
        alert('Microphone access was denied. Please allow microphone access to use voice input.');
      } else if (event.error === 'no-speech') {
        // No speech detected - if in guided mode, move to next step automatically
        if (isGuidedMode && waitingForUserInput && currentStepIndex < steps.length - 1) {
          console.log('No speech detected - moving to next step automatically');
          moveToNextStep();
        }
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      // Auto-send if we got a final transcript
      if (finalTranscriptResult.trim()) {
        setChatInput(finalTranscriptResult.trim());
        setTimeout(() => {
          const sendEvent = new CustomEvent('voiceSendMessage', { detail: finalTranscriptResult.trim() });
          window.dispatchEvent(sendEvent);
        }, 50);
      } else {
        // No speech was captured - if in guided mode, move to next step
        if (isGuidedMode && waitingForUserInput && currentStepIndex < steps.length - 1) {
          console.log('Empty transcript - moving to next step automatically');
          moveToNextStep();
        }
      }
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  }, [stopSpeaking, isGuidedMode, waitingForUserInput, currentStepIndex, steps.length, moveToNextStep]);

  // Voice input - Stop listening and exit conversation mode
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    // Disable conversation mode when manually stopping
    shouldAutoListenRef.current = false;
    setIsConversationMode(false);
  }, []);

  // Handle auto-listen event
  useEffect(() => {
    const handleAutoListen = () => {
      console.log('Auto-listen event received. Checking conditions:', {
        shouldAutoListen: shouldAutoListenRef.current,
        isTeacherThinking,
        isTeacherSpeaking,
        isStepChatSpeaking,
        isListening,
        isNarratingStep
      });
      
      if (shouldAutoListenRef.current && !isTeacherThinking && !isTeacherSpeaking && !isStepChatSpeaking && !isListening && !isNarratingStep) {
        console.log('Starting listening...');
        startListening();
      }
    };
    
    window.addEventListener('autoStartListening', handleAutoListen);
    return () => window.removeEventListener('autoStartListening', handleAutoListen);
  }, [startListening, isTeacherThinking, isTeacherSpeaking, isStepChatSpeaking, isListening, isNarratingStep]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      shouldAutoListenRef.current = false;
    };
  }, []);

  // Send voice message directly (VOICE MODE - speak and show text together)
  const sendVoiceMessage = useCallback(async (message) => {
    if (!message.trim() || isTeacherThinking) return;
    
    console.log('=== VOICE MESSAGE START ===');
    console.log('Voice message sending:', message);
    
    // Stop any ongoing speech
    stopSpeaking();
    
    // Ensure conversation mode stays active for continuous voice interaction
    shouldAutoListenRef.current = true;
    setIsConversationMode(true);
    
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsTeacherThinking(true);
    setIsVoiceMode(true);
    
    // Reset for voice mode
    displayedTextRef.current = '';
    audioQueueRef.current = [];
    
    // Add placeholder - will be filled as we speak
    setChatMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
    
    try {
      console.log('Fetching chat response (sync)...');
      // Use sync endpoint for voice mode - simpler and more reliable
      const response = await fetch(`${API_BASE_URL}/teacher/chat-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          currentStepIndex: currentStepIndex
        })
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      const fullResponse = data.response || '';
      console.log('Full response length:', fullResponse.length);
      
      setIsTeacherThinking(false);
      
      // Now start speaking - text will be revealed as each sentence plays
      if (fullResponse) {
        console.log('Calling queueForSpeech...');
        queueForSpeech(fullResponse);
      } else {
        console.log('No response, showing error');
        setIsVoiceMode(false);
        setChatMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: 'Sorry, I couldn\'t generate a response.',
              isStreaming: false
            };
          }
          return newMessages;
        });
      }
      
    } catch (err) {
      console.error('Voice chat error:', err);
      setIsTeacherThinking(false);
      setIsVoiceMode(false);
      setChatMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: "Sorry, I encountered an error. Please try again.",
            isStreaming: false
          };
        }
        return newMessages;
      });
    }
  }, [isTeacherThinking, currentStepIndex, queueForSpeech, stopSpeaking]);

  // Handle voice message send event - use AI to classify intent
  useEffect(() => {
    const handleVoiceSend = async (e) => {
      const message = e.detail;
      console.log('Voice send event received:', message);
      
      if (!message) return;
      
      // Check if we're in guided mode waiting for input
      if (isGuidedMode && waitingForUserInput) {
        try {
          // Use AI to classify intent
          console.log('Classifying intent with AI...');
          const response = await fetch(`${API_BASE_URL}/teacher/classify-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Intent classification result:', data);
            
            if (data.success && data.intent === 'continue' && currentStepIndex < steps.length - 1) {
              console.log('AI determined user wants to continue to next step');
              moveToNextStep();
              return;
            }
          }
        } catch (err) {
          console.error('Intent classification failed, falling back to question:', err);
        }
        
        // If AI says question, or classification failed, treat as a question
        console.log('User has a question about step', currentStepIndex, '- sending to inline step chat');
        sendStepMessage(currentStepIndex, message);
        // Keep listening mode active for follow-up
        shouldAutoListenRef.current = true;
        return;
      }
      
      // Normal voice message handling (ONLY when not in guided mode)
      if (!isTeacherThinking && !isGuidedMode) {
        sendVoiceMessage(message);
      }
    };
    
    window.addEventListener('voiceSendMessage', handleVoiceSend);
    return () => window.removeEventListener('voiceSendMessage', handleVoiceSend);
  }, [isTeacherThinking, sendVoiceMessage, isGuidedMode, waitingForUserInput, moveToNextStep, currentStepIndex, steps.length, sendStepMessage]);

  // Handle Enter key in chat input
  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Send a quick question (TEXT MODE - no voice)
  const sendQuickQuestion = useCallback(async (question) => {
    console.log('=== QUICK QUESTION START ===');
    console.log('Question:', question);
    
    if (isTeacherThinking) {
      console.log('Already thinking, returning');
      return;
    }
    
    // Stop any ongoing speech
    stopSpeaking();
    
    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsTeacherThinking(true);
    
    try {
      console.log('Fetching from:', `${API_BASE_URL}/teacher/chat`);
      const response = await fetch(`${API_BASE_URL}/teacher/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          currentStepIndex: currentStepIndex
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
      
      console.log('Starting to read stream...');
      let chunkCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        chunkCount++;
        console.log(`Chunk ${chunkCount}: done=${done}, bytes=${value?.length || 0}`);
        
        if (done) {
          console.log('Stream finished, fullResponse length:', fullResponse.length);
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        console.log('Buffer:', buffer.substring(0, 100));
        
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          console.log('Processing line:', line.substring(0, 80));
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('Parsed data:', data.type, data.content?.substring(0, 30));
              if (data.type === 'text') {
                fullResponse += data.content;
                
                // Text mode: just show streaming text, no voice
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: fullResponse,
                    isStreaming: true
                  };
                  return newMessages;
                });
              } else if (data.type === 'done') {
                console.log('Received done signal');
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: fullResponse,
                    isStreaming: false
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Parse error:', e, 'line:', line);
            }
          }
        }
      }
      
      console.log('=== QUICK QUESTION COMPLETE ===');
      setIsTeacherThinking(false);
      
    } catch (err) {
      console.error('Chat error:', err);
      setIsTeacherThinking(false);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again."
      }]);
    }
  }, [isTeacherThinking, currentStepIndex]);

  // Get syntax highlighted code line - returns React elements
  const highlightSyntax = (codeLine) => {
    if (!codeLine) return <span>&nbsp;</span>;
    
    const keywords = ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'break', 'continue', 'pass', 'raise', 'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'self'];
    const builtins = ['print', 'range', 'len', 'int', 'str', 'list', 'dict', 'set', 'tuple', 'float', 'bool', 'type', 'input', 'open', 'map', 'filter', 'sorted', 'enumerate', 'zip', 'sum', 'max', 'min', 'abs'];
    
    const result = [];
    let remaining = codeLine;
    let key = 0;
    
    while (remaining.length > 0) {
      // Check for string (single or double quotes)
      const stringMatch = remaining.match(/^(["'])(?:(?!\1)[^\\]|\\.)*?\1/);
      if (stringMatch) {
        result.push(<span key={key++} className="text-green-400">{stringMatch[0]}</span>);
        remaining = remaining.slice(stringMatch[0].length);
        continue;
      }
      
      // Check for comment
      if (remaining.startsWith('#')) {
        result.push(<span key={key++} className="text-slate-500 italic">{remaining}</span>);
        break;
      }
      
      // Check for number
      const numMatch = remaining.match(/^\d+(\.\d+)?/);
      if (numMatch) {
        result.push(<span key={key++} className="text-orange-400">{numMatch[0]}</span>);
        remaining = remaining.slice(numMatch[0].length);
        continue;
      }
      
      // Check for word (keyword, builtin, or identifier)
      const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      if (wordMatch) {
        const word = wordMatch[0];
        let className = 'text-slate-200';
        
        if (keywords.includes(word)) {
          className = 'text-pink-400 font-semibold';
        } else if (builtins.includes(word)) {
          className = 'text-blue-400';
        }
        
        result.push(<span key={key++} className={className}>{word}</span>);
        remaining = remaining.slice(word.length);
        continue;
      }
      
      // Check for operators and punctuation
      const opMatch = remaining.match(/^[+\-*/%=<>!&|^~@:,.\[\](){}]+/);
      if (opMatch) {
        result.push(<span key={key++} className="text-cyan-400">{opMatch[0]}</span>);
        remaining = remaining.slice(opMatch[0].length);
        continue;
      }
      
      // Default: take one character (whitespace or unknown)
      result.push(<span key={key++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
    
    return result;
  };

  // Extract just the text explanation (before DRY-RUN) for narration
  const extractNarrativeText = (explanation) => {
    if (!explanation) return '';
    const dryRunIndex = explanation.toUpperCase().indexOf('DRY-RUN:');
    if (dryRunIndex > -1) {
      return explanation.substring(0, dryRunIndex).trim();
    }
    return explanation.trim();
  };

  // Extract just the DRY-RUN section from explanation
  const extractDryRunSection = (explanation) => {
    if (!explanation) return null;
    const dryRunMatch = explanation.match(/DRY-RUN:\s*([\s\S]*?)(?:$)/i);
    return dryRunMatch ? dryRunMatch[1].trim() : null;
  };

  // Render just the dry-run box (for use when text is animated separately)
  const renderDryRunBox = (dryRunContent) => {
    if (!dryRunContent) return null;
    
    const dryRunLines = dryRunContent.split('\n').filter(line => line.trim());
    
    return (
      <div className="mt-3 bg-slate-900/80 rounded-xl p-4 border border-yellow-500/30">
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Dry Run</span>
        </div>
        <div className="font-mono text-sm space-y-1">
          {dryRunLines.map((line, idx) => {
            // Style based on content
            let lineClass = 'text-slate-300';
            
            // True result - green
            if (line.includes('True') || line.includes('✓') || line.includes('executes')) {
              lineClass = 'text-green-400 font-semibold';
            }
            // False result - red/orange
            else if (line.includes('False') || line.includes('skipped')) {
              lineClass = 'text-orange-400';
            }
            // Arrow or assignment result
            else if (line.includes('→') || (line.includes('=') && !line.includes('=='))) {
              lineClass = 'text-teal-300';
            }
            // Comparison/condition
            else if (line.includes('>') || line.includes('<') || line.includes('==')) {
              lineClass = 'text-blue-300';
            }
            // "so" explanations
            else if (line.toLowerCase().startsWith('so ')) {
              lineClass = 'text-slate-400 italic';
            }
            
            return (
              <div key={idx} className={lineClass}>
                {line}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render explanation with styled dry-run section
  const renderExplanationWithDryRun = (explanation) => {
    if (!explanation) return null;
    
    // Check if the explanation contains a DRY-RUN section
    const dryRunMatch = explanation.match(/DRY-RUN:\s*([\s\S]*?)(?:$)/i);
    
    if (dryRunMatch) {
      // Split into explanation and dry-run parts
      const explanationPart = explanation.substring(0, explanation.indexOf('DRY-RUN:')).trim();
      const dryRunPart = dryRunMatch[1].trim();
      
      // Parse dry-run lines and style them
      const dryRunLines = dryRunPart.split('\n').filter(line => line.trim());
      
      return (
        <>
          {/* Text explanation */}
          <p className="mt-1 text-slate-200 leading-relaxed">
            {explanationPart}
          </p>
          
          {/* Dry-run box */}
          <div className="mt-3 bg-slate-900/80 rounded-xl p-4 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Dry Run</span>
            </div>
            <div className="font-mono text-sm space-y-1">
              {dryRunLines.map((line, idx) => {
                // Style based on content
                let lineClass = 'text-slate-300';
                let content = line;
                
                // True result - green
                if (line.includes('True') || line.includes('✓') || line.includes('executes')) {
                  lineClass = 'text-green-400 font-semibold';
                }
                // False result - red/orange
                else if (line.includes('False') || line.includes('skipped')) {
                  lineClass = 'text-orange-400';
                }
                // Arrow or assignment result
                else if (line.includes('→') || (line.includes('=') && !line.includes('=='))) {
                  lineClass = 'text-teal-300';
                }
                // Comparison/condition
                else if (line.includes('>') || line.includes('<') || line.includes('==')) {
                  lineClass = 'text-blue-300';
                }
                // "so" explanations
                else if (line.toLowerCase().startsWith('so ')) {
                  lineClass = 'text-slate-400 italic';
                }
                
                return (
                  <div key={idx} className={lineClass}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      );
    }
    
    // No dry-run section, just render as plain text
    return (
      <p className="mt-1 text-slate-200 leading-relaxed">
        {explanation}
      </p>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6" />
            </svg>
            Back to Editor
          </button>
          
          <div className="h-6 w-px bg-slate-700" />
          
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            Code Execution Visualizer
          </h1>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          {/* Guided Mode Toggle */}
          <button
            onClick={() => {
              const newMode = !isGuidedMode;
              setIsGuidedMode(newMode);
              
              // Always disable AI Teacher conversation mode when switching
              setIsConversationMode(false);
              
              if (isGuidedMode) {
                // Turning off guided mode - stop narration
                shouldAutoListenRef.current = false;
                setWaitingForUserInput(false);
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              isGuidedMode
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-slate-300'
            }`}
            title={isGuidedMode ? "Guided mode: AI narrates each step" : "Enable guided narration"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            </svg>
            <span>{isGuidedMode ? 'Guided' : 'Auto'}</span>
          </button>

          {/* Speed Control - only shown when not in guided mode */}
          {!isGuidedMode && (
            <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-xs text-slate-400">Speed:</span>
              {[
                { label: '0.5x', value: 4000 },
                { label: '1x', value: 2000 },
                { label: '2x', value: 1000 },
                { label: '3x', value: 600 },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleSpeedChange(value)}
                  className={`px-2 py-0.5 text-xs rounded-lg transition-all ${
                    playbackSpeed === value
                      ? 'bg-teal-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Play/Pause - disabled during streaming */}
          <button
            onClick={togglePlayPause}
            disabled={isStreaming || currentStepIndex >= steps.length - 1}
            className={`p-3 rounded-xl transition-all ${
              isStreaming
                ? 'bg-blue-500 text-white animate-pulse'
                : isPlaying
                ? 'bg-teal-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            } ${(isStreaming || currentStepIndex >= steps.length - 1) ? 'opacity-50' : ''}`}
            title={isStreaming ? 'Receiving steps...' : isPlaying ? 'Pause' : 'Play'}
          >
            {isStreaming ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            disabled={isStreaming}
            className={`p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all ${isStreaming ? 'opacity-50' : ''}`}
            title="Restart"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1,4 1,10 7,10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {/* Progress - fixed width to prevent layout shift */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-4 py-2 min-w-[150px] justify-center">
            {isStreaming ? (
              <>
                <span className="text-sm text-slate-400">Loaded</span>
                <span className="text-sm font-bold text-blue-400 tabular-nums">
                  {visibleSteps.length}
                </span>
                <span className="text-sm text-slate-500">steps</span>
              </>
            ) : (
              <>
                <span className="text-sm text-slate-400">Step</span>
                <span className="text-sm font-bold text-teal-400 w-[24px] text-right tabular-nums">
                  {visibleSteps.length}
                </span>
                <span className="text-sm text-slate-500">/</span>
                <span className="text-sm text-slate-400 w-[24px] text-left tabular-nums">
                  {steps.length}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <MainContentArea
      leftPanelTab={leftPanelTab}
      setLeftPanelTab={setLeftPanelTab}
      codeLines={codeLines}
      visibleSteps={visibleSteps}
      highlightSyntax={highlightSyntax}
      chatMessages={chatMessages}
      isTeacherSpeaking={isTeacherSpeaking}
      stopSpeaking={stopSpeaking}
      voiceEnabled={voiceEnabled}
      setVoiceEnabled={setVoiceEnabled}
      chatInput={chatInput}
      setChatInput={setChatInput}
      handleChatKeyDown={handleChatKeyDown}
      isListening={isListening}
      startListening={startListening}
      stopListening={stopListening}
      isConversationMode={isConversationMode}
      isTeacherThinking={isTeacherThinking}
      sendQuickQuestion={sendQuickQuestion}
      sendMessage={sendMessage}
      chatScrollRef={chatScrollRef}
      scrollContainerRef={scrollContainerRef}
      isLoading={isLoading}
      loadingPhase={loadingPhase}
      teacherContextSet={teacherContextSet}
      shouldAutoListenRef={shouldAutoListenRef}
      setIsConversationMode={setIsConversationMode}
      currentNarrationStepRef={currentNarrationStepRef}
      isNarratingStep={isNarratingStep}
      isGuidedMode={isGuidedMode}
      stepExplanationText={stepExplanationText}
      renderDryRunBox={renderDryRunBox}
      extractDryRunSection={extractDryRunSection}
      renderExplanationWithDryRun={renderExplanationWithDryRun}
      waitingForUserInput={waitingForUserInput}
      narratedStepIndex={narratedStepIndex}
      steps={steps}
      moveToNextStep={moveToNextStep}
      getStepConversation={getStepConversation}
      sendStepMessage={sendStepMessage}
      isStepChatSpeaking={isStepChatSpeaking}
      speakingStepIndex={speakingStepIndex}
      stepChatListening={stepChatListening}
      startStepChatListening={startStepChatListening}
      stopStepChatListening={stopStepChatListening}
      latestStepRef={latestStepRef}
      isStreaming={isStreaming}
      currentStepIndex={currentStepIndex}
      isPlaying={isPlaying}
    />

      {/* Bottom Progress Bar */}
      <div className="flex-shrink-0 h-1 bg-slate-800">
        <div
          className={`h-full transition-all duration-300 ${isStreaming ? 'bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 animate-pulse' : 'bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500'}`}
          style={{ width: isStreaming ? '100%' : `${steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
};

export default ImmersiveVisualizer;
