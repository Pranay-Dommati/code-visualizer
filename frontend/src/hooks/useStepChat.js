import { useState, useCallback, useRef } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * useStepChat - Custom hook for managing step-level conversations
 * Handles message state, API calls, and voice integration for inline step chats
 */
const useStepChat = ({ 
  steps = [], 
  code = '', 
  codeLines = [],
  onSpeakText,
  onStopSpeaking,
  onResponseComplete,  // Callback when AI finishes responding (for auto-listen)
  sharedAudioRef       // Shared audio ref to prevent dual audio playback
}) => {
  // Conversation state per step: { [stepIndex]: { messages: [], isLoading: false, isSpeaking: false } }
  const [stepConversations, setStepConversations] = useState({});
  const [activeStepChat, setActiveStepChat] = useState(null); // Which step has active input
  const [isStepChatSpeaking, setIsStepChatSpeaking] = useState(false);
  const [speakingStepIndex, setSpeakingStepIndex] = useState(null);
  
  // Use shared audio ref if provided, otherwise create local one
  const localAudioRef = useRef(null);
  const audioRef = sharedAudioRef || localAudioRef;
  const audioQueueRef = useRef([]);
  const isPlayingQueueRef = useRef(false);
  const displayedTextRef = useRef('');

  /**
   * Get conversation for a specific step
   */
  const getStepConversation = useCallback((stepIndex) => {
    return stepConversations[stepIndex] || { messages: [], isLoading: false };
  }, [stepConversations]);

  /**
   * Add a message to a step's conversation
   */
  const addMessage = useCallback((stepIndex, from, text) => {
    setStepConversations(prev => ({
      ...prev,
      [stepIndex]: {
        ...prev[stepIndex],
        messages: [
          ...(prev[stepIndex]?.messages || []),
          { from, text, timestamp: Date.now() }
        ]
      }
    }));
  }, []);

  /**
   * Set loading state for a step
   */
  const setStepLoading = useCallback((stepIndex, isLoading) => {
    setStepConversations(prev => ({
      ...prev,
      [stepIndex]: {
        ...prev[stepIndex],
        messages: prev[stepIndex]?.messages || [],
        isLoading
      }
    }));
  }, []);

  /**
   * Play TTS audio with text sync
   */
  const speakStepResponse = useCallback(async (stepIndex, text) => {
    if (!text) return;

    // Stop any currently playing audio (shared ref handles both narration and step chat)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsStepChatSpeaking(true);
    setSpeakingStepIndex(stepIndex);
    displayedTextRef.current = '';

    // Split into sentences
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    if (sentences.length === 0) sentences.push(text);

    for (const sentence of sentences) {
      try {
        const response = await fetch(`${API_BASE_URL}/teacher/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: sentence, 
            format: 'base64',
            with_timestamps: true 
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.audio) {
            await playAudioWithSync(data.audio, sentence, data.alignment);
          }
        }
      } catch (err) {
        console.error('Step chat TTS error:', err);
      }
    }

    setIsStepChatSpeaking(false);
    setSpeakingStepIndex(null);
  }, [audioRef]);

  /**
   * Play audio with character-level sync
   */
  const playAudioWithSync = (audioBase64, text, alignment) => {
    return new Promise((resolve) => {
      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      audioRef.current = audio;

      audio.onended = () => {
        resolve();
      };

      audio.onerror = () => {
        resolve();
      };

      audio.play().catch(() => resolve());
    });
  };

  /**
   * Stop any playing audio
   */
  const stopStepSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsStepChatSpeaking(false);
    setSpeakingStepIndex(null);
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
  }, []);

  /**
   * Send a message in a step's chat
   */
  const sendStepMessage = useCallback(async (stepIndex, userMessage) => {
    if (!userMessage.trim()) return;

    const step = steps[stepIndex];
    if (!step) return;

    // Add user message
    addMessage(stepIndex, 'user', userMessage);
    setStepLoading(stepIndex, true);
    setActiveStepChat(stepIndex);

    try {
      // Build context for this specific step
      const stepContext = {
        stepIndex,
        currentLine: step.line,
        currentCode: step.code,
        explanation: step.explanation,
        variables: step.variables,
        previousMessages: getStepConversation(stepIndex).messages
      };

      const response = await fetch(`${API_BASE_URL}/teacher/step-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          stepContext,
          code,
          codeLines
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.response || "I couldn't generate a response. Please try again.";

      // Add AI response
      addMessage(stepIndex, 'ai', aiResponse);
      setStepLoading(stepIndex, false);

      // Speak the response
      await speakStepResponse(stepIndex, aiResponse);
      
      // Trigger callback to auto-listen for follow-up
      if (onResponseComplete) {
        onResponseComplete(stepIndex);
      }

    } catch (err) {
      console.error('Step chat error:', err);
      addMessage(stepIndex, 'ai', "Sorry, I encountered an error. Please try again.");
      setStepLoading(stepIndex, false);
      
      // Still trigger callback even on error so user can continue
      if (onResponseComplete) {
        onResponseComplete(stepIndex);
      }
    }
  }, [steps, code, codeLines, addMessage, setStepLoading, getStepConversation, speakStepResponse, onResponseComplete]);

  /**
   * Clear conversation for a step
   */
  const clearStepConversation = useCallback((stepIndex) => {
    setStepConversations(prev => {
      const newConversations = { ...prev };
      delete newConversations[stepIndex];
      return newConversations;
    });
  }, []);

  /**
   * Clear all conversations
   */
  const clearAllConversations = useCallback(() => {
    setStepConversations({});
    setActiveStepChat(null);
    stopStepSpeaking();
  }, [stopStepSpeaking]);

  return {
    // State
    stepConversations,
    activeStepChat,
    isStepChatSpeaking,
    speakingStepIndex,
    
    // Actions
    getStepConversation,
    sendStepMessage,
    clearStepConversation,
    clearAllConversations,
    stopStepSpeaking,
    setActiveStepChat,
    
    // Helpers
    addMessage,
  };
};

export default useStepChat;
