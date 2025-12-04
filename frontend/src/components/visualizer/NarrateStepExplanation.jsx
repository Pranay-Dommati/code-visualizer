export function createNarrateStepExplanation({
  API_BASE_URL,
  audioRef,
  setIsNarratingStep,
  currentNarrationStepRef,
  setStepExplanationText,
  setNarratedStepIndex,
  setWaitingForUserInput,
  shouldAutoListenRef,
  setIsConversationMode,
  stopStepSpeaking,  // Add function to stop step chat audio
}) {
  return async function narrateStepExplanation(
    stepIndex,
    explanation,
    isNarratingStep,
    isGuidedMode,
    steps
  ) {
    if (!explanation || isNarratingStep) return;

    // Stop any currently playing audio before starting narration
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (stopStepSpeaking) {
      stopStepSpeaking();
    }

    setIsNarratingStep(true);
    currentNarrationStepRef.current = stepIndex;
    setStepExplanationText(prev => ({ ...prev, [stepIndex]: '' }));

    const dryRunIndex = explanation.toUpperCase().indexOf("DRY-RUN:");
    const narrativeText =
      dryRunIndex > -1
        ? explanation.substring(0, dryRunIndex).trim()
        : explanation.trim();

    const sentences = narrativeText
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim());
    if (sentences.length === 0) sentences.push(narrativeText);

    let displayedText = "";

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      // Check if we've moved to a different step
      if (currentNarrationStepRef.current !== stepIndex) {
        console.log(`Stopping narration for step ${stepIndex} as we moved to ${currentNarrationStepRef.current}`);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/teacher/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sentence,
            format: "base64",
            with_timestamps: true,
          }),
        });

        if (!response.ok) {
          displayedText += (displayedText ? " " : "") + sentence;
          setStepExplanationText(prev => ({
            ...prev,
            [stepIndex]: displayedText,
          }));
          continue;
        }

        const data = await response.json();

        // Check again before playing audio
        if (currentNarrationStepRef.current !== stepIndex) {
           return;
        }

        if (data.success && data.audio) {
          const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
          audioRef.current = audio;

          const hasAlignment =
            data.alignment?.character_start_times_seconds?.length > 0;
          const characters = data.alignment?.characters || [];
          const charStartTimes =
            data.alignment?.character_start_times_seconds || [];

          await new Promise(resolve => {
            const baseText = displayedText;
            const prefix = baseText ? " " : "";
            let animationFrame = null;

            if (hasAlignment) {
              const updateText = () => {
                if (audio.paused || audio.ended) {
                  displayedText = baseText + prefix + sentence;
                  setStepExplanationText(prev => ({
                    ...prev,
                    [stepIndex]: displayedText,
                  }));
                  if (animationFrame) cancelAnimationFrame(animationFrame);
                  return;
                }

                const currentTime = audio.currentTime;
                let visibleChars = 0;

                for (let j = 0; j < charStartTimes.length; j++) {
                  if (charStartTimes[j] <= currentTime) visibleChars = j + 1;
                  else break;
                }

                const visibleText = characters
                  .slice(0, visibleChars)
                  .join("");

                setStepExplanationText(prev => ({
                  ...prev,
                  [stepIndex]: baseText + prefix + visibleText,
                }));

                animationFrame = requestAnimationFrame(updateText);
              };

              audio.onplay = () => {
                animationFrame = requestAnimationFrame(updateText);
              };
            } else {
              audio.onplay = () => {
                const duration = audio.duration || sentence.length * 0.06;
                const delayPerChar = Math.max(
                  15,
                  (duration * 1000) / sentence.length
                );

                let charIndex = 0;

                const animateChar = () => {
                  if (charIndex < sentence.length && !audio.paused && !audio.ended) {
                    charIndex++;
                    setStepExplanationText(prev => ({
                      ...prev,
                      [stepIndex]:
                        baseText + prefix + sentence.substring(0, charIndex),
                    }));
                    setTimeout(animateChar, delayPerChar);
                  }
                };

                animateChar();
              };
            }

            audio.onended = () => {
              if (animationFrame) cancelAnimationFrame(animationFrame);
              displayedText = baseText + prefix + sentence;
              setStepExplanationText(prev => ({
                ...prev,
                [stepIndex]: displayedText,
              }));
              resolve();
            };

            audio.onerror = () => {
              if (animationFrame) cancelAnimationFrame(animationFrame);
              displayedText = baseText + prefix + sentence;
              setStepExplanationText(prev => ({
                ...prev,
                [stepIndex]: displayedText,
              }));
              resolve();
            };

            audio.play().catch(() => {
              displayedText = baseText + prefix + sentence;
              setStepExplanationText(prev => ({
                ...prev,
                [stepIndex]: displayedText,
              }));
              resolve();
            });
          });
        } else {
          displayedText += (displayedText ? " " : "") + sentence;
          setStepExplanationText(prev => ({
            ...prev,
            [stepIndex]: displayedText,
          }));
        }
      } catch (err) {
        console.error("Narration error:", err);
        displayedText += (displayedText ? " " : "") + sentence;
        setStepExplanationText(prev => ({
          ...prev,
          [stepIndex]: displayedText,
        }));
      }
    }

    setIsNarratingStep(false);
    setNarratedStepIndex(stepIndex);
    currentNarrationStepRef.current = -1;

    if (isGuidedMode) {
      const isLast = stepIndex >= steps.length - 1;

      setWaitingForUserInput(true);
      shouldAutoListenRef.current = true;
      // setIsConversationMode(true); // Don't enable AI Teacher voice mode in guided mode

      setTimeout(() => {
        if (shouldAutoListenRef.current) {
          window.dispatchEvent(new CustomEvent("autoStartListening"));
        }
      }, 800);
    }
  };
}
