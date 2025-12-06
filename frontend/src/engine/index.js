/**
 * Rendering Engine Module
 * =======================
 * 
 * This module provides the complete visualization engine with:
 * - CinematicDirector for continuous animations (NEW!)
 * - PixiJS for GPU-accelerated rendering
 * - GSAP for smooth animations
 * - LayoutManager for automatic positioning
 * - SceneProcessor for converting timeline steps to scenes
 * - SceneTypes for semantic visualization commands
 */

// NEW: Cinematic Director - Object persistence + State transitions
export { default as cinematicDirector } from './CinematicDirector';

// Legacy exports (still available for compatibility)
export { default as renderingEngine } from './RenderingEngine';
export { default as LayoutManager } from './LayoutManager';
export { default as sceneProcessor } from './SceneProcessor';
export { default as SceneType, SceneCommands } from './SceneTypes';
