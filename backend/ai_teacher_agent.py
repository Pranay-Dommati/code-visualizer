"""
AI Teacher Agent - Dual Modality Voice + Visualization
=======================================================
This agent uses Gemini's dual modality output:
- AUDIO: Natural speech for explanations
- TEXT: JSON commands for visualizations (parsed silently)

Architecture: 
  User speaks → Gemini (audio + text) → Agent parses text for JSON → Frontend draws
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
from livekit.agents import Agent, AgentSession, RoomInputOptions, RoomOutputOptions, room_io
from livekit.plugins.google import beta as google_beta
from livekit.plugins.google.realtime import api_proto

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
                        _current_context = context  # Cache for visualization
                        logger.info(f"📋 Fetched context: {len(context.get('steps', []))} steps, {len(context.get('code', ''))} chars")
                        return context
                logger.warning(f"Failed to fetch context: {response.status}")
                return {}
    except Exception as e:
        logger.error(f"Error fetching context from backend: {e}")
        return {}


async def generate_visualization_commands(user_request: str, step_number: int = None) -> list:
    """
    Use Gemini TEXT API to generate visualization commands.
    This is a separate call from the realtime audio.
    """
    import google.generativeai as genai
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("No GEMINI_API_KEY for visualization")
        return []
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash-exp")
    
    context = _current_context
    code = context.get("code", "")
    steps = context.get("steps", [])
    
    if not code and not steps:
        return []
    
    # Build visualization prompt
    prompt = f"""You are generating JSON visualization commands for a code teaching whiteboard.

CODE:
{code}

EXECUTION TRACE:
"""
    for i, step in enumerate(steps[:15]):
        line = step.get("line", step.get("lineNumber", "?"))
        step_code = step.get("code", "")
        variables = step.get("variables", step.get("locals", {}))
        prompt += f"Step {i+1} (Line {line}): {step_code}\n"
        if variables:
            prompt += f"  Variables: {variables}\n"

    prompt += f"""

USER REQUEST: {user_request}
{f"Focus on step {step_number}" if step_number else ""}

Generate JSON visualization commands to help explain this code.
Output ONLY valid JSON objects, one per line, no explanation.

Available commands:
1. {{"action": "draw_array", "id": "arrayName", "elements": [1, 2, 3], "x": 100, "y": 100}}
2. {{"action": "highlight_index", "id": "arrayName", "index": 0, "color": "yellow"}}  
3. {{"action": "draw_pointer", "id": "ptr", "targetId": "arrayName", "index": 0, "label": "i"}}
4. {{"action": "clear_canvas"}}

Output the commands now:"""

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text
        logger.info(f"🎨 Visualization response: {text[:200]}...")
        
        # Extract JSON commands
        commands = extract_json_commands(text)
        return commands
    except Exception as e:
        logger.error(f"Error generating visualization: {e}")
        return []


def build_system_instructions(context: dict) -> str:
    """Build Gemini system instructions for teaching (visualization is handled separately)."""
    code = context.get("code", "")
    steps = context.get("steps", [])
    
    # Base instructions - just for voice teaching
    instructions = """You are a friendly, enthusiastic AI Teacher explaining code to students.
Speak naturally, warmly, and encouragingly - like a real tutor sitting next to them.

IMPORTANT: When the student asks you to "draw" or "show" or "visualize" something, 
just SAY that you're showing it on the whiteboard. A visualization will appear automatically.
Don't describe JSON or technical commands - just say "Let me show you that on the whiteboard" 
and then explain what they're seeing.

"""
    
    if not code and not steps:
        instructions += "Greet the user warmly and ask what they'd like to learn today.\n"
        return instructions
    
    # Add code context
    instructions += f"""=== STUDENT'S CODE ===
{code}

"""
    
    if steps:
        instructions += "=== EXECUTION TRACE (what happens when code runs) ===\n"
        for i, step in enumerate(steps[:10]):
            line = step.get("line", step.get("lineNumber", "?"))
            step_code = step.get("code", "")
            variables = step.get("variables", step.get("locals", {}))
            instructions += f"Step {i+1} (Line {line}): {step_code}\n"
            if variables:
                var_str = ", ".join([f"{k}={v}" for k, v in list(variables.items())[:5]])
                instructions += f"  Variables: {var_str}\n"
        if len(steps) > 10:
            instructions += f"... and {len(steps) - 10} more steps\n"
        instructions += "\n"
    
    instructions += """=== TEACHING STYLE ===
1. Be warm, encouraging, and patient
2. Explain step-by-step what the code does
3. When asked to visualize, say "Let me show you on the whiteboard" - a drawing will appear
4. Use the execution trace to explain how variables change
5. Celebrate when the student understands something!
"""
    
    return instructions


def extract_json_commands(text: str) -> list:
    """Extract JSON visualization commands from AI response."""
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


def strip_json_from_text(text: str) -> str:
    """Remove JSON blocks from text so they aren't spoken aloud."""
    # Remove ```json ... ``` blocks
    text = re.sub(r'```json\s*[\s\S]*?```', '', text)
    # Remove inline JSON objects with action field
    text = re.sub(r'\{[^{}]*"action"\s*:\s*"[^"]+"\s*[^{}]*\}', '', text)
    # Clean up extra whitespace
    text = re.sub(r'\n\s*\n', '\n', text)
    text = re.sub(r'  +', ' ', text)
    return text.strip()


class TeacherAgent(Agent):
    """Simple teaching agent with context-aware instructions."""
    
    def __init__(self, instructions: str):
        super().__init__(instructions=instructions)
        logger.info("📚 TeacherAgent initialized")


async def send_command(room: rtc.Room, command: dict):
    """Send a visualization command to the frontend."""
    try:
        data = json.dumps(command).encode('utf-8')
        await room.local_participant.publish_data(data, reliable=True)
        logger.info(f"📤 Sent command: {command.get('action')}")
    except Exception as e:
        logger.error(f"Failed to send command: {e}")


async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint - simplified and stable."""
    logger.info(f"🚀 Agent starting for room: {ctx.room.name}")
    
    # Connect to the room
    await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)
    logger.info("✅ Connected to room")
    
    # Wait for participant
    logger.info("⏳ Waiting for participant...")
    participant = await ctx.wait_for_participant()
    logger.info(f"👤 Participant joined: {participant.identity}")
    
    # Fetch context from backend (the source of truth)
    logger.info("📥 Fetching context from backend API...")
    context = await fetch_context_from_backend()
    
    # Build instructions with context
    instructions = build_system_instructions(context)
    logger.info(f"📝 Built instructions ({len(instructions)} chars)")
    
    # Create Gemini model with audio output + transcription
    # The transcription gives us text of what was spoken - we can extract JSON from there
    logger.info("🤖 Creating Gemini model with audio output + transcription...")
    gemini_model = google_beta.realtime.RealtimeModel(
        model="gemini-2.0-flash-exp",
        api_key=os.getenv("GEMINI_API_KEY"),
        voice="Puck",
        # Use AUDIO modality (default) - Gemini will speak
        # Enable output transcription to capture what was said as text
        output_audio_transcription=api_proto.types.AudioTranscriptionConfig(),
    )
    
    # Create agent with context-aware instructions
    agent = TeacherAgent(instructions=instructions)
    
    # Create session
    session = AgentSession(
        llm=gemini_model,
        allow_interruptions=True,
    )
    
    # Event handlers
    @session.on("user_input_transcribed")
    def on_user_input(event):
        transcript = event.transcript
        logger.info(f"🎤 User: {transcript}")
        
        # Detect visualization requests and trigger separate API call
        viz_keywords = ["draw", "show", "visualize", "display", "diagram", "picture", "whiteboard"]
        transcript_lower = transcript.lower()
        
        if any(kw in transcript_lower for kw in viz_keywords):
            logger.info("🎨 Detected visualization request - generating commands...")
            
            # Extract step number if mentioned
            step_num = None
            import re as re_module
            step_match = re_module.search(r'step\s*(\d+)', transcript_lower)
            if step_match:
                step_num = int(step_match.group(1))
            
            # Generate visualization in background
            async def gen_and_send_viz():
                commands = await generate_visualization_commands(transcript, step_num)
                if commands:
                    logger.info(f"🎨 Generated {len(commands)} visualization commands")
                    for cmd in commands:
                        await send_command(ctx.room, cmd)
                else:
                    logger.warning("No visualization commands generated")
            
            asyncio.create_task(gen_and_send_viz())
    
    @session.on("agent_state_changed") 
    def on_state_change(event):
        logger.info(f"🔄 State: {event.old_state} → {event.new_state}")
    
    @session.on("conversation_item_added")
    def on_conversation_item(event):
        # This event fires when a complete message is added to the conversation
        item = event.item
        logger.info(f"📝 Conversation item added: {item}")
        
        # Try to extract content for JSON commands
        if hasattr(item, 'content') and item.content:
            content_list = item.content if isinstance(item.content, list) else [item.content]
            for content in content_list:
                if isinstance(content, str):
                    logger.info(f"📝 Content text: {content[:200]}...")
                    # Extract JSON commands from the text content
                    commands = extract_json_commands(content)
                    if commands:
                        logger.info(f"🎨 Found {len(commands)} visualization commands")
                        for cmd in commands:
                            asyncio.create_task(send_command(ctx.room, cmd))
    
    @session.on("error")
    def on_error(event):
        logger.error(f"❌ Session error: {event.error}")
    
    # Start the session with text output enabled to capture transcription
    logger.info("▶️ Starting session...")
    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(audio_enabled=True, text_enabled=True),
        room_output_options=RoomOutputOptions(audio_enabled=True, transcription_enabled=True),
        room_options=room_io.RoomOptions(
            text_output=room_io.TextOutputOptions(),  # Enable text output for transcription
        ),
    )
    
    logger.info("✅ AI Teacher is ready! Listening for voice input...")


if __name__ == "__main__":
    logger.info("🎓 Starting AI Teacher Agent...")
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
