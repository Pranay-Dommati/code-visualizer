/**
 * PixiJS Visualization Component v3
 * ==================================
 * 
 * NOW USES: CinematicDirector for CONTINUOUS ANIMATIONS
 * 
 * KEY CHANGE: Instead of rendering individual scenes, we build
 * ONE master timeline with transition commands and play it continuously.
 * 
 * The AI is the DIRECTOR - it sends transition commands.
 * The CinematicDirector is the ARTIST - it renders and animates.
 */

import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import cinematicDirector from '../engine/CinematicDirector';

const PixiVisualization = forwardRef(({ 
    width, 
    height, 
    currentStep,
    onAnimationComplete,
    className = '' 
}, ref) => {
    const containerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState(null);
    const initAttempted = useRef(false);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        /**
         * BUILD AND PLAY a complete cinematic story.
         * This is the KEY method - receives ALL transitions at once
         * and builds ONE continuous animation.
         */
        buildCinematicStory: (transitions) => {
            if (!isReady) {
                console.warn('🎬 Director not ready yet!');
                return;
            }
            console.log('🎬 Building cinematic story with', transitions.length, 'transitions');
            cinematicDirector.buildStory(transitions);
        },
        
        /**
         * Play the current timeline
         */
        play: () => cinematicDirector.play(),
        
        /**
         * Pause the current timeline
         */
        pause: () => cinematicDirector.pause(),
        
        /**
         * Seek to a specific time in the timeline
         */
        seek: (time) => cinematicDirector.seek(time),
        
        /**
         * Check if director is ready
         */
        isReady: () => isReady,
    }));

    // Initialize CinematicDirector
    useEffect(() => {
        const init = async () => {
            if (!containerRef.current || initAttempted.current) return;
            initAttempted.current = true;
            
            // Wait a frame for container to be fully mounted
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            if (!containerRef.current) return;
            
            try {
                console.log('🎬 Initializing Cinematic Director...', { width, height });
                await cinematicDirector.init(containerRef.current, width || 760, height || 400);
                cinematicDirector.onComplete = onAnimationComplete;
                setIsReady(true);
                setError(null);
                console.log('🎬 Cinematic Director ready for continuous animation!');
            } catch (err) {
                console.error('Failed to initialize Cinematic Director:', err);
                setError(err.message || 'Failed to initialize visualization');
                initAttempted.current = false; // Allow retry
            }
        };

        init();

        return () => {
            // On unmount, just clear the story
            try {
                cinematicDirector.clearAll?.();
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, [width, height, onAnimationComplete]);

    // Handle resize
    useEffect(() => {
        if (isReady && width && height) {
            cinematicDirector.resize(width, height);
        }
    }, [width, height, isReady]);

    // Handle legacy currentStep changes (for backward compatibility)
    // NEW APPROACH: We prefer buildCinematicStory(), but still support old step-by-step
    useEffect(() => {
        if (!isReady || !currentStep) return;

        // If it's a build_story command, use the new approach
        if (currentStep.action === 'build_cinematic_story' && currentStep.transitions) {
            console.log('🎬 Received cinematic story via currentStep!');
            cinematicDirector.buildStory(currentStep.transitions);
            return;
        }

        // Legacy: Try to convert old step formats to transitions
        // (This is fallback for old code paths)
        const handleLegacyStep = async () => {
            try {
                console.log('🎬 Processing legacy step:', currentStep);
                // For now, we just log - the new approach is buildCinematicStory
            } catch (err) {
                console.error('Failed to process step:', err);
            }
        };

        handleLegacyStep();
    }, [currentStep, isReady]);

    if (error) {
        return (
            <div 
                className={`flex items-center justify-center bg-gray-900 text-red-400 ${className}`}
                style={{ width, height }}
            >
                <div className="text-center p-4">
                    <div className="text-xl mb-2">⚠️ Visualization Error</div>
                    <div className="text-sm">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className={`pixi-visualization ${className}`}
            style={{ 
                width, 
                height,
                backgroundColor: '#0a0f1a',
                borderRadius: '8px',
                overflow: 'hidden',
            }}
        />
    );
});

// Also export a hook for direct CinematicDirector control
export const useCinematicDirector = () => {
    const buildStory = useCallback((transitions) => {
        cinematicDirector.buildStory(transitions);
    }, []);

    const play = useCallback(() => {
        cinematicDirector.play();
    }, []);

    const pause = useCallback(() => {
        cinematicDirector.pause();
    }, []);

    const seek = useCallback((time) => {
        cinematicDirector.seek(time);
    }, []);

    return {
        buildStory,
        play,
        pause,
        seek,
        director: cinematicDirector,
    };
};

export default PixiVisualization;
