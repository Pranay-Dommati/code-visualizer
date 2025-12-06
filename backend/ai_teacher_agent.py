"""
AI Teacher Agent - 3-Channel Industry-Standard Architecture
============================================================

CHANNEL 1: AUDIO AGENT (Gemini Realtime)
  - Voice conversation only
  - Speaks naturally with server-side turn detection
  - Does NOT send JSON or handle visualization
  - Modality: AUDIO only

CHANNEL 2: TEXT AGENT (Gemini Text API)
  - Generates JSON visualization commands
  - Triggered by keyword detection (draw/show/visualize)
  - No interruptions, no speech
  - Deterministic JSON output

CHANNEL 3: DATA PIPELINE
  - Sends DataPacket with JSON to frontend
  - Frontend canvas renders at 60fps
  - Never interferes with voice
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

# Backend API URL
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")

# Store context globally for the visualization generator
_current_context = {}

# Debounce visualization requests to prevent duplicates
_last_viz_request_time = 0
_viz_request_lock = asyncio.Lock() if hasattr(asyncio, 'Lock') else None


# =============================================================================
# CHANNEL 2: TEXT AGENT (Visualization JSON Generator)
# =============================================================================

async def fetch_context_from_backend() -> dict:
    """Fetch the current code context from the Backend API."""
    global _current_context
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/api/teacher/context") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("success"):
                        context = data.get("context", {})
                        _current_context = context
                        logger.info(f"📋 Fetched context: {len(context.get('steps', []))} steps, {len(context.get('code', ''))} chars")
                        return context
                logger.warning(f"Failed to fetch context: {response.status}")
                return {}
    except Exception as e:
        logger.error(f"Error fetching context from backend: {e}")
        return {}


async def generate_visualization_commands(user_request: str, step_number: int = None) -> list:
    """
    CHANNEL 2: Use Gemini TEXT API to generate rich visualization commands.
    This is completely separate from the voice channel.
    """
    import google.generativeai as genai
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("No GEMINI_API_KEY for visualization")
        return []
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    
    context = _current_context
    code = context.get("code", "")
    steps = context.get("steps", [])
    
    if not code and not steps:
        logger.warning("No code context available for visualization")
        return []
    
    # Determine which step(s) to focus on
    target_step = None
    if step_number and step_number <= len(steps):
        target_step = steps[step_number - 1]  # 1-indexed to 0-indexed
    
    # Build a rich visualization prompt
    prompt = f"""You are an expert code visualization generator for an educational whiteboard.
Your job is to create RICH, EDUCATIONAL visualizations that help students understand code execution.

=== THE CODE ===
{code}

=== EXECUTION TRACE ===
"""
    for i, step in enumerate(steps[:15]):
        line = step.get("line", step.get("lineNumber", "?"))
        step_code = step.get("code", "")
        variables = step.get("variables", step.get("locals", {}))
        marker = " ← FOCUS HERE" if step_number and (i + 1) == step_number else ""
        prompt += f"Step {i+1} (Line {line}): {step_code}{marker}\n"
        if variables:
            prompt += f"  Variables: {variables}\n"
    
    if len(steps) > 15:
        prompt += f"... ({len(steps) - 15} more steps)\n"

    prompt += f"""

=== USER REQUEST ===
"{user_request}"
{f"Focus specifically on Step {step_number}" if step_number else "Show an overview of the algorithm"}

=== YOUR TASK ===
Generate JSON visualization commands to create a RICH, EDUCATIONAL visualization.

VISUALIZATION COMMANDS AVAILABLE:
1. Draw the main data structure:
   {{"action": "draw_array", "id": "nums", "elements": [2, 4, 1], "x": 100, "y": 120, "label": "nums[]"}}

2. Highlight specific elements with colors (yellow, green, red, blue, purple, orange):
   {{"action": "highlight_index", "id": "nums", "index": 0, "color": "yellow"}}

3. Show pointers/iterators:
   {{"action": "draw_pointer", "id": "i", "targetId": "nums", "index": 0, "label": "i"}}

4. Show variable values:
   {{"action": "draw_variable", "name": "max_val", "value": 5, "x": 100, "y": 200, "highlight": true}}

5. Show comparisons being made:
   {{"action": "draw_comparison", "left": "n", "operator": ">", "right": "max_val", "result": true, "x": 100, "y": 250}}

6. Show loop iteration:
   {{"action": "draw_loop_indicator", "iteration": 1, "variable": "n=2", "x": 50, "y": 80}}

7. Add explanatory labels:
   {{"action": "draw_label", "id": "step_label", "text": "Step 1: Initialize max_val", "x": 100, "y": 50}}

8. Clear canvas before drawing:
   {{"action": "clear_canvas"}}

=== VISUALIZATION STRATEGY ===
1. Start with clear_canvas
2. Add a label explaining what's happening
3. Draw the main data structure (array, list, etc.)
4. Show current variable values
5. Highlight the current element being processed
6. Show pointers for loop variables
7. Show any comparisons or operations

Generate 4-8 commands for a clear visualization. Output ONLY valid JSON objects, one per line.
DO NOT include any explanatory text, markdown, or comments - ONLY JSON commands.

OUTPUT:"""

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text
        logger.info(f"🎨 Visualization response: {text[:200]}...")
        
        commands = extract_json_commands(text)
        logger.info(f"🎨 Extracted {len(commands)} visualization commands")
        return commands
    except Exception as e:
        logger.error(f"Error generating visualization: {e}")
        return []


def extract_json_commands(text: str) -> list:
    """Extract JSON visualization commands from text."""
    commands = []
    
    # Find JSON in code blocks
    pattern = r'```json\s*([\s\S]*?)```'
    for match in re.findall(pattern, text):
        try:
            cmd = json.loads(match.strip())
            if isinstance(cmd, dict) and cmd.get("action"):
                commands.append(cmd)
            elif isinstance(cmd, list):
                commands.extend([c for c in cmd if isinstance(c, dict) and c.get("action")])
        except json.JSONDecodeError:
            pass
    
    # Find inline JSON with action field
    inline = r'\{[^{}]*"action"\s*:\s*"[^"]+"\s*[^{}]*\}'
    for match in re.findall(inline, text):
        try:
            cmd = json.loads(match)
            if cmd.get("action") and cmd not in commands:
                commands.append(cmd)
        except json.JSONDecodeError:
            pass
    
    return commands


# =============================================================================
# CHANNEL 3: DATA PIPELINE (Send commands to frontend canvas)
# =============================================================================

async def send_command(room: rtc.Room, command: dict):
    """Send a visualization command via DataPacket to frontend."""
    try:
        data = json.dumps(command).encode('utf-8')
        await room.local_participant.publish_data(data, reliable=True)
        logger.info(f"📤 Sent command: {command.get('action')}")
    except Exception as e:
        logger.error(f"Failed to send command: {e}")


# =============================================================================
# CHANNEL 1: AUDIO AGENT (Gemini Realtime - Voice Only)
# =============================================================================

def build_voice_instructions(context: dict) -> str:
    """
    Build simple voice-only instructions for the audio agent.
    NO visualization commands - that's handled by Channel 2.
    """
    code = context.get("code", "")
    steps = context.get("steps", [])
    
    # Simple, clean instructions for voice-only teaching
    instructions = """You are a friendly, enthusiastic AI programming tutor.
Speak naturally and warmly, like a real teacher sitting next to the student.

IMPORTANT RULES:
1. Just talk naturally - no JSON, no code blocks, no technical formatting
2. When the student asks to "draw", "show", or "visualize" something, 
   simply say "Let me show you that on the whiteboard" and explain what they'll see
3. A visualization will appear automatically - you don't need to generate it
4. Be encouraging and patient
5. Use the execution trace to explain how variables change step by step

"""
    
    if not code and not steps:
        instructions += "Greet the student warmly and ask what they'd like to learn today.\n"
        return instructions
    
    # Add code context
    instructions += f"""=== THE STUDENT'S CODE ===
{code}

"""
    
    if steps:
        instructions += "=== WHAT HAPPENS WHEN IT RUNS ===\n"
        for i, step in enumerate(steps[:10]):
            line = step.get("line", step.get("lineNumber", "?"))
            step_code = step.get("code", "")
            variables = step.get("variables", step.get("locals", {}))
            instructions += f"Step {i+1} (Line {line}): {step_code}\n"
            if variables:
                var_str = ", ".join([f"{k}={v}" for k, v in list(variables.items())[:5]])
                instructions += f"  → Variables: {var_str}\n"
        if len(steps) > 10:
            instructions += f"... and {len(steps) - 10} more steps\n"
        instructions += "\n"
    
    instructions += """Remember: Just speak naturally! Explain the code step by step.
When they want to see something, tell them you're showing it on the whiteboard.
"""
    
    return instructions


class VoiceTeacher(Agent):
    """
    CHANNEL 1: Voice-only teaching agent.
    Uses Gemini Realtime AUDIO modality only.
    """
    
    def __init__(self, instructions: str):
        super().__init__(instructions=instructions)
        logger.info("🎤 VoiceTeacher initialized (audio-only mode)")


async def entrypoint(ctx: agents.JobContext):
    """
    Main entrypoint with 3-channel architecture.
    """
    logger.info(f"🚀 Agent starting for room: {ctx.room.name}")
    
    # Connect to the room (audio only for voice channel)
    await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)
    logger.info("✅ Connected to room")
    
    # Wait for participant
    logger.info("⏳ Waiting for participant...")
    participant = await ctx.wait_for_participant()
    logger.info(f"👤 Participant joined: {participant.identity}")
    
    # Fetch context from backend
    logger.info("📥 Fetching context from backend...")
    context = await fetch_context_from_backend()
    
    # Build voice-only instructions (no visualization commands)
    instructions = build_voice_instructions(context)
    logger.info(f"📝 Built voice instructions ({len(instructions)} chars)")
    
    # ==========================================================================
    # CHANNEL 1: Create Gemini Realtime model (AUDIO ONLY)
    # ==========================================================================
    logger.info("🎤 Creating Gemini Realtime model (audio-only)...")
    gemini_model = google_beta.realtime.RealtimeModel(
        model="gemini-2.0-flash-exp",
        api_key=os.getenv("GEMINI_API_KEY"),
        voice="Puck",
        # Uses server-side turn detection by default
        # Interruptions are enabled (required for server-side turn detection)
    )
    
    # Create voice-only agent
    agent = VoiceTeacher(instructions=instructions)
    
    # Create session with default settings for stability
    session = AgentSession(
        llm=gemini_model,
        allow_interruptions=True,  # Required for Gemini server-side turn detection
    )
    
    # ==========================================================================
    # Event handlers for visualization trigger (Channel 2 integration)
    # ==========================================================================
    
    # Track last visualization request to debounce
    last_viz_time = {"time": 0, "last_transcript": ""}
    
    @session.on("user_input_transcribed")
    def on_user_input(event):
        """Detect visualization requests and trigger Channel 2."""
        import time
        
        transcript = event.transcript
        is_final = getattr(event, 'is_final', False)
        
        # Only log final transcripts to reduce noise
        if is_final or len(transcript) > 20:
            logger.info(f"🎤 User: {transcript} (final={is_final})")
        
        # Only process if this looks like a complete sentence (ends with punctuation or is marked final)
        # OR if it's longer than the last transcript we processed
        if not is_final:
            # For streaming transcripts, only trigger if it ends with punctuation
            if not any(transcript.rstrip().endswith(p) for p in ['.', '?', '!']):
                return
        
        # Debounce: ignore if we just triggered visualization in the last 5 seconds
        current_time = time.time()
        if current_time - last_viz_time["time"] < 5.0:
            return
        
        # Skip if this is the same or shorter than what we already processed
        if len(transcript) <= len(last_viz_time["last_transcript"]):
            return
        
        # Keywords that trigger visualization generation (US + UK spelling)
        viz_keywords = [
            "draw", "show", "visualize", "visualise", "display",
            "diagram", "picture", "whiteboard", "illustrate"
        ]
        transcript_lower = transcript.lower()
        
        if any(kw in transcript_lower for kw in viz_keywords):
            logger.info(f"🎨 Visualization keyword detected in: {transcript}")
            last_viz_time["time"] = current_time
            last_viz_time["last_transcript"] = transcript
            
            # Extract one or more step numbers if mentioned
            step_nums = []
            # Numeric "step 2"
            for m in re.finditer(r'step\s*(\d+)', transcript_lower):
                try:
                    step_nums.append(int(m.group(1)))
                except Exception:
                    pass
            # Ordinals "second", "third" etc.
            ordinal_map = {
                "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
                "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10
            }
            for word, num in ordinal_map.items():
                if word in transcript_lower:
                    step_nums.append(num)
            # If none found, leave as None to generate a general visualization
            if not step_nums:
                step_nums = [None]

            # Deduplicate while preserving order
            seen = set()
            ordered_steps = []
            for n in step_nums:
                if n not in seen:
                    seen.add(n)
                    ordered_steps.append(n)

            logger.info(f"🎨 Triggering Channel 2 for steps {ordered_steps}")

            # Generate visualizations asynchronously for each requested step
            async def trigger_visualization_for(step_n: int | None):
                commands = await generate_visualization_commands(transcript, step_n)
                if commands:
                    logger.info(f"🎨 Channel 2 generated {len(commands)} commands for step {step_n} → Channel 3")
                    for cmd in commands:
                        await send_command(ctx.room, cmd)
                else:
                    logger.warning(f"Channel 2: No visualization commands generated for step {step_n}")

            for s in ordered_steps:
                asyncio.create_task(trigger_visualization_for(s))
    
    # Track speaking state to detect overlaps
    voice_state = {"current": "initializing", "speaking_count": 0, "last_change": 0}
    
    @session.on("agent_state_changed") 
    def on_state_change(event):
        import time
        current_time = time.time()
        time_since_last = current_time - voice_state["last_change"]
        voice_state["last_change"] = current_time
        
        old = str(event.old_state)
        new = str(event.new_state)
        
        # Track speaking count
        if "speaking" in new.lower():
            voice_state["speaking_count"] += 1
        
        # Detect anomalies
        if old == voice_state["current"]:
            logger.info(f"🔄 Voice agent state: {old} → {new} (after {time_since_last:.2f}s)")
        else:
            logger.warning(f"⚠️ State mismatch! Expected {voice_state['current']}, got old={old}. Transition: {old} → {new}")
        
        # Detect rapid speaking transitions (potential overlap)
        if "speaking" in new.lower() and "speaking" in old.lower():
            logger.error(f"🔴 OVERLAP DETECTED: speaking → speaking transition!")
        
        if "speaking" in new.lower() and time_since_last < 0.5 and "listening" not in old.lower():
            logger.warning(f"⚠️ Rapid transition to speaking ({time_since_last:.2f}s) - possible overlap")
        
        voice_state["current"] = new
        logger.info(f"📊 Speaking count so far: {voice_state['speaking_count']}")
    
    @session.on("error")
    def on_error(event):
        logger.error(f"❌ Session error: {event.error}")
    
    # ==========================================================================
    # Track audio publications to detect duplicates
    # ==========================================================================
    @ctx.room.on("track_published")
    def on_track_published(publication, participant):
        logger.info(f"📡 Track published: {publication.kind} by {participant.identity} (sid: {publication.sid})")
        if publication.kind == "audio":
            logger.info(f"🔊 Audio track details: source={publication.source}, muted={publication.muted}")
    
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        logger.info(f"📡 Track subscribed: {track.kind} from {participant.identity} (sid: {track.sid})")
    
    @ctx.room.on("track_unsubscribed")
    def on_track_unsubscribed(track, publication, participant):
        logger.info(f"📡 Track unsubscribed: {track.kind} from {participant.identity}")
    
    # Log current participants and their tracks
    logger.info(f"👥 Current participants in room: {len(ctx.room.remote_participants)}")
    for pid, p in ctx.room.remote_participants.items():
        logger.info(f"   - {p.identity}: {len(p.track_publications)} tracks")
        for tid, pub in p.track_publications.items():
            logger.info(f"     └─ {pub.kind}: {pub.source} (subscribed={pub.subscribed})")
    
    # ==========================================================================
    # Start the voice session
    # ==========================================================================
    logger.info("▶️ Starting voice session (Channel 1)...")
    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=True,
            audio_output=True,
        ),
    )
    
    logger.info("✅ AI Teacher is ready!")
    logger.info("   Channel 1: Voice (Gemini Realtime Audio)")
    logger.info("   Channel 2: Visualization (Gemini Text API)")
    logger.info("   Channel 3: DataPacket → Canvas")


if __name__ == "__main__":
    logger.info("🎓 Starting AI Teacher Agent (3-Channel Architecture)...")
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
