"""
AI Teacher Agent - Stateless Voice Transport Layer
===================================================
This agent is a TRANSPORT layer only. It:
1. Fetches context from the Backend API (source of truth)
2. Forwards audio to/from Gemini
3. Forwards JSON visualization commands to frontend

It does NOT:
- Store context internally
- Process complex logic  
- Maintain conversation state

Architecture: Frontend → Backend (context) → Agent (voice) → Gemini → Agent → Frontend
"""

import logging
import os
import sys
import json
import re
import aiohttp
from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import Agent, AgentSession, RoomInputOptions, RoomOutputOptions
from livekit.plugins.google import beta as google_beta

load_dotenv()

# Set up logging - less verbose for stability
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


async def fetch_context_from_backend() -> dict:
    """Fetch the current code context from the Backend API."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/api/teacher/context") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("success"):
                        context = data.get("context", {})
                        logger.info(f"📋 Fetched context: {len(context.get('steps', []))} steps, {len(context.get('code', ''))} chars")
                        return context
                logger.warning(f"Failed to fetch context: {response.status}")
                return {}
    except Exception as e:
        logger.error(f"Error fetching context from backend: {e}")
        return {}


def build_system_instructions(context: dict) -> str:
    """Build Gemini system instructions with code context."""
    base = (
        "You are an enthusiastic AI Teacher that explains Data Structures and Algorithms. "
        "Speak naturally, clearly, and encouragingly.\n\n"
    )
    
    code = context.get("code", "")
    steps = context.get("steps", [])
    
    if not code and not steps:
        return base + "Greet the user and ask what they'd like to learn about today."
    
    # Build context-aware instructions
    instructions = base + (
        "IMPORTANT: You have access to the user's Python code and execution trace.\n\n"
        f"=== USER'S CODE ===\n{code}\n\n"
    )
    
    if steps:
        instructions += "=== EXECUTION TRACE (first 10 steps) ===\n"
        for i, step in enumerate(steps[:10]):
            line = step.get("line", step.get("lineNumber", "?"))
            step_code = step.get("code", "")
            variables = step.get("variables", step.get("locals", {}))
            instructions += f"Step {i+1}, Line {line}: {step_code}\n"
            if variables:
                var_str = ", ".join([f"{k}={v}" for k, v in list(variables.items())[:3]])
                instructions += f"  Variables: {var_str}\n"
        if len(steps) > 10:
            instructions += f"... and {len(steps) - 10} more steps\n"
        instructions += "\n"
    
    instructions += (
        "=== YOUR ROLE ===\n"
        "1. When asked about 'the code' or 'my code', refer to the code shown above\n"
        "2. Explain step-by-step what the code does using the execution trace\n"
        "3. You CAN generate JSON visualization commands in ```json blocks\n"
        "4. Available commands: draw_array, draw_node, highlight_index, connect_nodes, clear_canvas\n"
        "5. Example: ```json\n{\"action\": \"draw_array\", \"id\": \"nums\", \"elements\": [3, 6], \"x\": 100, \"y\": 100}\n```\n"
        "6. Be enthusiastic and helpful! You have the full context.\n"
    )
    
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
    
    # Create Gemini model
    logger.info("🤖 Creating Gemini model...")
    gemini_model = google_beta.realtime.RealtimeModel(
        model="gemini-2.0-flash-exp",
        api_key=os.getenv("GEMINI_API_KEY"),
    )
    
    # Create agent with context-aware instructions
    agent = TeacherAgent(instructions=instructions)
    
    # Create session
    session = AgentSession(
        llm=gemini_model,
        allow_interruptions=True,
    )
    
    # Simple event handlers
    @session.on("user_input_transcribed")
    def on_user_input(event):
        logger.info(f"🎤 User: {event.transcript}")
    
    @session.on("agent_state_changed") 
    def on_state_change(event):
        logger.info(f"🔄 State: {event.old_state} → {event.new_state}")
    
    @session.on("agent_speech_committed")
    def on_speech(event):
        # Extract and forward visualization commands
        if hasattr(event, 'text') and event.text:
            text = event.text
            logger.info(f"🗣️ Agent said: {text[:100]}...")
            commands = extract_json_commands(text)
            if commands:
                logger.info(f"🎨 Found {len(commands)} visualization commands")
                import asyncio
                for cmd in commands:
                    asyncio.create_task(send_command(ctx.room, cmd))
    
    @session.on("error")
    def on_error(event):
        logger.error(f"❌ Session error: {event.error}")
    
    # Start the session
    logger.info("▶️ Starting session...")
    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(audio_enabled=True, text_enabled=True),
        room_output_options=RoomOutputOptions(audio_enabled=True, transcription_enabled=True),
    )
    logger.info("✅ AI Teacher is ready! Listening for voice input...")


if __name__ == "__main__":
    logger.info("🎓 Starting AI Teacher Agent...")
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
