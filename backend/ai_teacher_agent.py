"""
AI Teacher Agent - Synchronized Speech + Visualization
=======================================================

This agent creates a seamless teaching experience where:
1. The AI SPEAKS the exact timeline scripts
2. Visualization commands are sent WHILE the AI speaks
3. Both are perfectly synchronized

Architecture:
- Timeline Engine generates {speech_script, visualization_commands} for each step
- When user requests visualization, we:
  1. Send visualization commands to frontend
  2. Inject the speech script into the agent's context
  3. The AI naturally speaks what we tell it to say
"""

import logging
import os
import sys
import json
import re
import aiohttp
import asyncio
from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import Agent, AgentSession, room_io
from livekit.plugins.google import beta as google_beta

load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

logger = logging.getLogger("ai-teacher")
logger.setLevel(logging.INFO)

# Reduce noise from LiveKit
logging.getLogger("livekit").setLevel(logging.WARNING)
logging.getLogger("livekit.agents").setLevel(logging.INFO)
logging.getLogger("root").setLevel(logging.WARNING)  # Silence transcription warnings

# Backend API URL
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")

# Global state - singleton tracking
_current_context = {}
_current_timeline = []
_visual_timeline = []
_cinematic_transitions = []  # NEW: State transition commands for smooth animation
_current_step_index = 0
_room = None
_session = None
_active_rooms = set()  # Track active room sessions to prevent duplicates
_is_cinematic_mode = False  # NEW: Flag to prevent legacy commands during cinematic playback


# =============================================================================
# BACKEND API
# =============================================================================

async def fetch_context_and_timeline() -> dict:
    """Fetch context AND the pre-generated timeline from backend."""
    global _current_context, _current_timeline, _visual_timeline, _cinematic_transitions
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/api/teacher/context") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("success"):
                        context = data.get("context", {})
                        _current_context = context
                        _current_timeline = context.get("timeline", [])
                        _visual_timeline = context.get("visual_timeline", [])
                        _cinematic_transitions = context.get("cinematic_transitions", [])  # NEW
                        logger.info(f"📋 Fetched: {len(context.get('steps', []))} exec, {len(_cinematic_transitions)} cinematic transitions")
                        return context
                logger.warning(f"Failed to fetch context: {response.status}")
                return {}
    except Exception as e:
        logger.error(f"Error fetching context: {e}")
        return {}


# =============================================================================
# VISUALIZATION COMMANDS
# =============================================================================

async def send_command(room: rtc.Room, command: dict):
    """Send a visualization command via DataPacket to frontend."""
    try:
        data = json.dumps(command).encode('utf-8')
        await room.local_participant.publish_data(data, reliable=True)
        logger.info(f"📤 Sent: {command.get('action')}")
    except Exception as e:
        logger.error(f"Failed to send command: {e}")


async def execute_visualization(room: rtc.Room, commands: list):
    """Execute a list of visualization commands with smooth timing."""
    for cmd in commands:
        await send_command(room, cmd)
        await asyncio.sleep(0.1)  # Small delay between commands


# =============================================================================
# CINEMATIC ANIMATION - SEND ALL TRANSITIONS AT ONCE
# =============================================================================

async def send_cinematic_story(room: rtc.Room):
    """
    Send the complete cinematic story to the frontend.
    The frontend will build ONE master timeline and play it continuously.
    """
    global _cinematic_transitions
    
    if not _cinematic_transitions:
        logger.warning("No cinematic transitions available!")
        return
    
    logger.info(f"🎬 Sending {len(_cinematic_transitions)} cinematic transitions as ONE story")
    
    await send_command(room, {
        "action": "build_cinematic_story",
        "transitions": _cinematic_transitions
    })


# =============================================================================
# SYNCHRONIZED TEACHING
# =============================================================================


async def teach_visual_step(room: rtc.Room, session: AgentSession, visual_step: dict, step_num: int, total: int):
    """
    Teach using VISUAL steps that mirror the tracer data.
    This uses the same data structure that works on the left panel!
    """
    if not visual_step:
        return None
    
    scene_type = visual_step.get("scene_type", "")
    speech = visual_step.get("speech", "")
    array_name = visual_step.get("array_name", "array")
    array_values = visual_step.get("array_values", [])
    highlights = visual_step.get("highlight_indices", [])
    colors = visual_step.get("highlight_colors", [])
    comparison = visual_step.get("comparison")
    variables = visual_step.get("variables", {})
    
    logger.info(f"🎬 Visual Step {step_num + 1}/{total}: [{scene_type}]")
    logger.info(f"   📢 Speech: {speech[:60] if speech else 'none'}...")
    logger.info(f"   🎨 Array: {array_name}={array_values}, highlights={highlights}")
    
    # Send visual step to frontend
    await send_command(room, {
        "action": "render_visual_step",
        "step_num": step_num,
        "total": total,
        "scene_type": scene_type,
        "array_name": array_name,
        "array_values": array_values,
        "highlight_indices": highlights,
        "highlight_colors": colors,
        "comparison": comparison,
        "variables": variables,
        "code": visual_step.get("code", ""),
        "line_number": visual_step.get("line_number", 0),
    })
    
    return speech


async def teach_step(room: rtc.Room, session: AgentSession, step: dict, step_num: int, total: int):
    """
    Teach a single timeline step with synchronized speech + visualization.
    
    This is the KEY function that creates the seamless experience:
    1. Sends SEMANTIC scene to frontend (not pixel coords!)
    2. Generates speech for the AI to speak
    """
    global _is_cinematic_mode
    
    if not step:
        return
    
    speech = step.get("speech_script", "")
    scene = step.get("scene", {})  # NEW: semantic scene data
    phase = step.get("phase", "")
    duration = step.get("duration_hint", 3.0)
    
    logger.info(f"🎬 Step {step_num + 1}/{total}: [{phase}]")
    logger.info(f"   📢 Speech: {speech[:60]}...")
    logger.info(f"   🎨 Scene: {scene.get('type', 'none')}")
    
    # Send SEMANTIC scene command to frontend
    # The frontend rendering engine handles layout and animation
    # CRITICAL: Do NOT send legacy scene commands if we are in cinematic mode!
    if scene and not _is_cinematic_mode:
        await send_command(room, {
            "action": "render_scene",
            "scene": scene,
            "step": step_num,
            "total": total,
            "phase": phase,
        })
    elif _is_cinematic_mode:
        logger.info("   🚫 Skipping render_scene (Cinematic Mode Active)")
    
    # Return the speech script - caller will inject it into the agent
    return speech


async def run_full_walkthrough(room: rtc.Room, session: AgentSession):
    """
    Run the full cinematic walkthrough.
    
    NEW APPROACH:
    1. Send ALL cinematic transitions at once to frontend
    2. Frontend builds ONE master timeline and plays it continuously
    3. Speech can be added alongside (but animation is continuous)
    """
    global _cinematic_transitions, _current_timeline, _is_cinematic_mode
    
    # Set cinematic mode to TRUE to block legacy commands
    _is_cinematic_mode = True
    
    # Re-fetch context to ensure we have latest transitions
    logger.info("🎬 Fetching latest context for walkthrough...")
    await fetch_context_and_timeline()
    
    logger.info(f"🎬 Cinematic transitions available: {len(_cinematic_transitions)}")
    
    # FIRST: Send the cinematic story to frontend
    # This builds ONE continuous animation, not separate scenes
    if _cinematic_transitions:
        logger.info(f"🎬 Sending cinematic story ({len(_cinematic_transitions)} transitions)")
        await send_cinematic_story(room)
    else:
        logger.warning("⚠️ No cinematic transitions found! Check if context was sent to backend.")
    
    # Collect speeches from timeline for narration
    if not _current_timeline:
        logger.warning("No timeline available for speech!")
        return []
    
    total = len(_current_timeline)
    speeches = []
    
    for i, step in enumerate(_current_timeline):
        speech = step.get("speech_script", "")
        if speech:
            speeches.append(speech)
    
    logger.info(f"✅ Cinematic walkthrough started with {len(speeches)} speech lines")
    return speeches


async def show_specific_step(room: rtc.Room, session: AgentSession, step_num: int):
    """Show a specific step by number."""
    global _visual_timeline, _current_timeline, _current_step_index, _is_cinematic_mode
    
    # If user manually asks for a step, disable cinematic mode
    _is_cinematic_mode = False
    
    timeline = _visual_timeline if _visual_timeline else _current_timeline
    
    if not timeline:
        return None
    
    if 0 <= step_num < len(_current_timeline):
        _current_step_index = step_num
        step = _current_timeline[step_num]
        speech = await teach_step(room, session, step, step_num, len(_current_timeline))
        return speech
    
    return None


async def advance_step(room: rtc.Room, session: AgentSession, direction: int = 1):
    """Advance to next (direction=1) or previous (direction=-1) step."""
    global _current_timeline, _current_step_index
    
    new_index = _current_step_index + direction
    if 0 <= new_index < len(_current_timeline):
        return await show_specific_step(room, session, new_index)
    
    return None


# =============================================================================
# VOICE INSTRUCTIONS
# =============================================================================

def build_instructions(context: dict, timeline: list) -> str:
    """
    Build voice instructions that include:
    1. Teaching persona
    2. Timeline scripts (what to say for each step)
    3. Interaction guidelines
    """
    code = context.get("code", "")
    
    instructions = """You are a friendly, enthusiastic AI programming tutor named Alex!
You're teaching a student how their code works, step by step, with visualizations.

🎭 YOUR PERSONALITY:
- Warm, encouraging, patient
- Use phrases like "Great question!", "Let me show you...", "Notice how..."
- Speak naturally, as if explaining to a friend
- Be concise but clear

🎓 HOW YOU TEACH:
When the student asks you to explain or visualize the code, you explain each step.
The visualization appears on the canvas automatically while you speak.
You should reference what's on screen: "As you can see...", "Look at the highlighted element..."

"""

    if code:
        instructions += f"""📝 THE STUDENT'S CODE:
```python
{code}
```

"""

    # Add the timeline scripts - these are what the AI should say
    if timeline:
        instructions += """📋 TEACHING SCRIPT (follow these for each step):

When the student asks for the full walkthrough or says "show me everything", 
go through these explanations naturally, one after another:

"""
        for i, step in enumerate(timeline):
            speech = step.get("speech_script", "")
            phase = step.get("phase", "")
            if speech:
                instructions += f"""Step {i + 1} ({phase}):
"{speech}"

"""

    instructions += """
🎤 RESPONDING TO THE STUDENT:

1. "Show me everything" / "Visualize" / "Walk me through":
   - Start with enthusiasm: "Let me walk you through this algorithm!"
   - Follow the teaching script above, speaking each step naturally
   - Reference the visualizations: "As you can see on the canvas..."

2. "Show step X" / "First step" / "Next step":
   - Jump to that specific step
   - Explain what's happening using the script for that step

3. General questions:
   - Answer naturally based on the code and your teaching experience
   - Keep it friendly and encouraging

Remember: You're a patient teacher. The student learns best when you're clear and enthusiastic!
"""

    return instructions


# =============================================================================
# MAIN AGENT
# =============================================================================

class TeachingAgent(Agent):
    """AI Teacher with synchronized teaching capabilities."""
    
    def __init__(self, instructions: str):
        super().__init__(instructions=instructions)
        logger.info("🎓 TeachingAgent initialized")


async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint with synchronized teaching."""
    global _room, _session, _current_timeline, _current_step_index, _active_rooms
    
    room_name = ctx.room.name
    
    # CRITICAL: Prevent multiple agents for the same room
    if room_name in _active_rooms:
        logger.warning(f"⚠️ Agent already active for room: {room_name}, skipping duplicate")
        return
    
    _active_rooms.add(room_name)
    logger.info(f"🚀 Agent starting for room: {room_name}")
    
    try:
        # Connect to the room
        await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)
        logger.info("✅ Connected to room")
        _room = ctx.room
        
        # Wait for participant
        logger.info("⏳ Waiting for participant...")
        participant = await ctx.wait_for_participant()
        logger.info(f"👤 Participant joined: {participant.identity}")
        
        # Fetch context and timeline
        logger.info("📥 Fetching context and timeline...")
        context = await fetch_context_and_timeline()
        
        # Build instructions with timeline scripts
        instructions = build_instructions(context, _current_timeline)
        logger.info(f"📝 Built instructions ({len(instructions)} chars)")
        
        # Create Gemini Realtime model
        logger.info("🎤 Creating Gemini Realtime model...")
        gemini_model = google_beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",
            api_key=os.getenv("GEMINI_API_KEY"),
            voice="Puck",
        )
        
        # Create agent and session
        agent = TeachingAgent(instructions=instructions)
        session = AgentSession(
            llm=gemini_model,
            allow_interruptions=True,
        )
        _session = session
        
        # ======================================================================
        # Event Handlers
        # ======================================================================
        
        last_action_time = {"time": 0}
        last_transcript = {"text": "", "time": 0}
        is_visualizing = {"active": False}
        agent_speaking = {"active": False}
        
        @session.on("user_input_transcribed")
        def on_user_input(event):
            """Handle user requests and trigger synchronized visualization."""
            import time
            
            transcript = event.transcript.strip()
            is_final = getattr(event, 'is_final', False)
            
            # Only process final transcripts
            if not is_final:
                return
            
            # Filter out very short or empty transcripts
            if len(transcript) < 3:
                return
            
            # Filter out non-English transcripts (echo from AI speaking)
            ascii_chars = sum(1 for c in transcript if ord(c) < 128)
            if ascii_chars < len(transcript) * 0.5:
                logger.debug(f"🔇 Ignoring non-English: {transcript}")
                return
            
            # Normalize transcript for matching
            transcript_lower = transcript.lower()
            
            # Filter out common echo phrases (AI speaking back)
            # Only filter if agent is CURRENTLY speaking
            if agent_speaking["active"]:
                echo_phrases = [
                    "excuse me", "i'm using", "excuse me i'm",
                    "let me walk", "let's find", "algorithm", "maximum value", 
                    "checking", "comparing", "initialize", "updating",
                    "step one", "step two", "step three", "step four", "step five",
                    "step 1", "step 2", "step 3", "step 4", "step 5",
                    "as you can see", "notice how", "look at"
                ]
                if any(phrase in transcript_lower for phrase in echo_phrases):
                    logger.debug(f"🔇 Ignoring echo (agent speaking): {transcript}")
                    return
            
            # Debounce - prevent duplicate processing
            current_time = time.time()
            if current_time - last_action_time["time"] < 3.0:
                logger.debug(f"🔇 Debounced: {transcript}")
                return
            
            # Check for duplicate transcript
            if transcript_lower == last_transcript["text"] and current_time - last_transcript["time"] < 5.0:
                logger.debug(f"🔇 Duplicate: {transcript}")
                return
            
            last_transcript["text"] = transcript_lower
            last_transcript["time"] = current_time
            
            # Skip if already visualizing
            if is_visualizing["active"]:
                logger.debug(f"🔇 Already visualizing, skipping: {transcript}")
                return
            
            logger.info(f"🎤 User: {transcript}")
            
            # Detect full visualization request - EXPANDED KEYWORDS
            full_viz_keywords = [
                # Exact matches
                "show me everything", "visualize", "walk me through",
                "show the whole", "entire algorithm", "full walkthrough",
                "show all", "from the beginning", "explain the code",
                "go through", "show me how", "how does it work",
                # Common misheard variations
                "walk through", "walkthrough", "walk me", "visual",
                "show everything", "explain everything", "teach me",
                "run through", "demonstrate", "demo", "start from",
                "all steps", "every step", "complete", "whole thing",
                # Even more relaxed
                "show", "explain", "teach", "help me understand",
                "how it works", "what happens", "trace"
            ]
            
            if any(kw in transcript_lower for kw in full_viz_keywords):
                logger.info("🎬 FULL VISUALIZATION triggered!")
                last_action_time["time"] = current_time
                is_visualizing["active"] = True
                
                async def do_full_walkthrough():
                    try:
                        await run_full_walkthrough(ctx.room, session)
                    finally:
                        is_visualizing["active"] = False
                
                asyncio.create_task(do_full_walkthrough())
                return
            
            # Detect specific step requests
            step_match = re.search(r'step\s*(\d+)', transcript_lower)
            if step_match:
                step_num = int(step_match.group(1)) - 1
                logger.info(f"🎬 Showing step {step_num + 1}")
                last_action_time["time"] = current_time
                asyncio.create_task(show_specific_step(ctx.room, session, step_num))
                return
            
            # Detect ordinals
            ordinal_map = {
                "first": 0, "second": 1, "third": 2, "fourth": 3, "fifth": 4,
                "sixth": 5, "seventh": 6, "eighth": 7, "ninth": 8, "tenth": 9
            }
            for word, idx in ordinal_map.items():
                if word in transcript_lower:
                    if any(kw in transcript_lower for kw in ["step", "show", "explain", "the " + word]):
                        logger.info(f"🎬 Showing {word} step")
                        last_action_time["time"] = current_time
                        asyncio.create_task(show_specific_step(ctx.room, session, idx))
                        return
            
            # Detect next/previous
            if any(kw in transcript_lower for kw in ["next", "continue", "go on", "proceed"]):
                logger.info("🎬 Next step")
                last_action_time["time"] = current_time
                asyncio.create_task(advance_step(ctx.room, session, 1))
                return
            
            if any(kw in transcript_lower for kw in ["previous", "back", "go back", "before"]):
                logger.info("🎬 Previous step")
                last_action_time["time"] = current_time
                asyncio.create_task(advance_step(ctx.room, session, -1))
                return
        
        @session.on("agent_state_changed")
        def on_state_change(event):
            logger.info(f"🔄 State: {event.old_state} → {event.new_state}")
            if event.new_state == "speaking":
                agent_speaking["active"] = True
            elif event.old_state == "speaking":
                async def clear_speaking_flag():
                    await asyncio.sleep(1.5)
                    agent_speaking["active"] = False
                asyncio.create_task(clear_speaking_flag())
        
        @session.on("error")
        def on_error(event):
            logger.error(f"❌ Error: {event.error}")
        
        # ======================================================================
        # Start Session
        # ======================================================================
        
        logger.info("▶️ Starting voice session...")
        await session.start(
            agent=agent,
            room=ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=True,
                audio_output=True,
            ),
        )
        
        logger.info("✅ AI Teacher is ready!")
        logger.info(f"   📋 Timeline: {len(_current_timeline)} steps")
        logger.info("   🎤 Say 'show me everything' for full walkthrough")
        logger.info("   🎤 Say 'show step 1' for specific steps")
        
        # Keep the session alive
        while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            await asyncio.sleep(1)
            
    finally:
        # Cleanup
        _active_rooms.discard(room_name)
        logger.info(f"🧹 Agent session ended for room: {room_name}")


if __name__ == "__main__":
    logger.info("🎓 Starting AI Teacher Agent (Synchronized)...")
    # Use num_idle_processes=1 to prevent multiple workers
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            num_idle_processes=1,  # Only 1 idle process
        )
    )
