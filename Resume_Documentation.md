# AI-Powered Code Visualizer & Real-Time Teacher

This document provides a comprehensive overview of the **Code Visualizer** project, specifically tailored for inclusion in your professional resume. It highlights the architecture, technology stack, and engineering challenges you solved.

## 📌 Project Overview
**Name:** AI Code Visualizer & Real-Time Teacher
**Role:** Full Stack AI Engineer 
**Description:** A real-time, interactive educational platform that traces Python code execution line-by-line and provides a synchronized graphical visualization paired with voice narration from a real-time AI tutor.

## 🛠️ Technology Stack
- **Backend:** Python, FastAPI, LiveKit Server SDK, AST (Abstract Syntax Trees), `sys.settrace`
- **Frontend:** React.js, Vite, TailwindCSS, PixiJS / Konva (Canvas Rendering), GSAP (Animations), LiveKit Client
- **AI & Real-Time Communication:** Gemini 2.0 Flash EXP (Realtime API), WebSockets, WebRTC (LiveKit)

## 🚀 Key Features & Engineering Highlights

### 1. Python Code Tracer Engine (Backend)
- Designed a custom execution tracer using Python's `sys.settrace` and AST parsing to capture line-by-line execution state in an isolated sandbox.
- Extracted local variables, execution frames, variable mutations, and call stacks securely and formatted them as chronological JSON frames.

### 2. Real-Time AI Teacher (Gemini + LiveKit)
- Built a synchronized voice agent leveraging the Gemini 2.0 Realtime API and LiveKit WebRTC.
- The AI dynamically interprets code execution steps and generates contextual, beginner-friendly narrations.
- Handled voice interruptibility, WebSocket stream state management, and real-time audio transcriptions.

### 3. Cinematic Visual rendering & Animation Engine (Frontend)
- Engineered a high-performance graphical engine using React, PixiJS/Konva, and GSAP to translate backend execution frames into smooth, animated visuals (e.g., array manipulations, variable state changes).
- Designed "Semantic Scenes" and "Cinematic Transitions" where frontend graphical changes perfectly synchronize with the AI's real-time voice narration.

### 4. Interactive Learning Workspace
- Built an IDE-like interface with a code editor, real-time input detection, timeline scrubbing, and step-by-step debugger controls.

---

## 💼 Ready-to-Use Resume Bullet Points
*Choose 3-4 bullet points that best align with the specific job you are applying for.*

**Software Engineer / Full-Stack Focus:**
- Developed a full-stack educational platform using React, FastAPI, and Python that visually animates algorithmic execution line-by-line.
- Engineered a custom Python execution tracer utilizing `sys.settrace` and Abstract Syntax Trees (AST) to securely capture local variable mutations and stack frames in an isolated sandbox environment.
- Architected a high-performance Canvas rendering engine using PixiJS, Konva, and GSAP, achieving seamless graphical transitions for algorithm visualizations.
- Integrated WebRTC and LiveKit to support bi-directional, low-latency WebSocket communication between the client workspace and the Python backend.

**AI Engineer / AI Integration Focus:**
- Built an interactive AI tutor leveraging the Gemini 2.0 Flash Realtime API to generate synchronized voice narrations corresponding to specific code execution frames.
- Designed a "Cinematic Transition" pipeline that synchronizes LLM-generated speech scripts with frontend graphical animation ticks over LiveKit WebRTC.
- Implemented state-managed AI prompt engineering to grant the AI "Teacher" contextual awareness of the user's specific execution timeline, allowing for dynamic Q&A and code explanation.
- Handled real-time user audio transcriptions, debouncing, and voice interruptibility to create a natural conversational AI experience.

---

## 🏗️ High-Level System Architecture

1. **User Input:** User writes code in the React Frontend and requests visualization.
2. **Execution & Tracing:** The FastAPI backend securely evaluates the code using a sandboxed `sys.settrace` runner, generating an array of execution frames (lines, variables).
3. **Scene & Script Generation:** The backend generates visualization/animation commands ("Cinematic Transitions") and contextual speech scripts for the AI.
4. **LiveKit Sync:** The backend pushes the execution context to a LiveKit Room. The LiveKit Agent (Gemini 2.0) receives the speech scripts.
5. **Real-time Playback:** The frontend reads the visualization commands and renders GSAP/PixiJS animations, while the Gemini Agent concurrently speaks the contextual narration over WebRTC.
