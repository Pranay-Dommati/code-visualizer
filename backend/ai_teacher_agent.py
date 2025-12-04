import logging
import os
import sys
from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import Agent, AgentSession, RoomInputOptions, RoomOutputOptions, function_tool
from livekit.plugins.google import beta as google_beta

load_dotenv()

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

logger = logging.getLogger("ai-teacher")
logger.setLevel(logging.DEBUG)

# Also enable LiveKit debug logs
logging.getLogger("livekit").setLevel(logging.DEBUG)
logging.getLogger("livekit.agents").setLevel(logging.DEBUG)


class TeacherAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=(
                "You are an AI Teacher that explains Data Structures and Algorithms. "
                "When explaining concepts, speak naturally and clearly. "
                "Start by greeting the user and asking what they would like to learn about. "
                "Be enthusiastic and encouraging!"
            ),
        )
        logger.info("📚 TeacherAgent initialized with instructions")

    async def on_enter(self):
        logger.info("🎓 TeacherAgent on_enter called - agent is starting")
        await super().on_enter()

    async def on_exit(self):
        logger.info("👋 TeacherAgent on_exit called - agent is stopping")
        await super().on_exit()

    async def on_user_turn_completed(self, turn_ctx, new_message):
        logger.info(f"🗣️ User finished speaking: {new_message}")
        await super().on_user_turn_completed(turn_ctx, new_message)


async def entrypoint(ctx: agents.JobContext):
    logger.info(f"🔗 Connecting to room: {ctx.room.name}")
    
    # Set up room event handlers for detailed logging
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        logger.info(f"📡 Track subscribed: {track.kind} from {participant.identity}")
    
    @ctx.room.on("track_published")
    def on_track_published(publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        logger.info(f"📢 Track published: {publication.kind} from {participant.identity}")

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f"👤 Participant connected: {participant.identity}")

    @ctx.room.on("data_received")
    def on_data_received(data: bytes, participant: rtc.Participant, kind, topic):
        logger.info(f"📨 Data received from {participant.identity if participant else 'unknown'}: {data[:100]}")

    await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)
    logger.info("✅ Connected to room with audio subscription")

    # Wait for participant
    participant = await ctx.wait_for_participant()
    logger.info(f"✅ Participant joined: {participant.identity}")

    # Create the Gemini Realtime model
    logger.info("🤖 Creating Gemini Realtime model...")
    gemini_model = google_beta.realtime.RealtimeModel(
        model="gemini-2.0-flash-exp",
        api_key=os.getenv("GEMINI_API_KEY"),
    )
    logger.info("✅ Gemini model created")

    # Create the agent
    agent = TeacherAgent()
    logger.info("🎓 Teacher agent created")

    # Create an AgentSession
    logger.info("🚀 Starting AgentSession...")
    session = AgentSession(
        llm=gemini_model,
        allow_interruptions=True,
    )
    
    # Add event handlers for the session
    @session.on("user_input_transcribed")
    def on_user_input(event):
        logger.info(f"🎤 User said: {event.transcript}")

    @session.on("agent_state_changed")
    def on_agent_state_changed(event):
        logger.info(f"🔄 Agent state changed: {event.old_state} -> {event.new_state}")

    @session.on("speech_created")
    def on_speech_created(event):
        logger.info(f"🔊 Speech created - agent is speaking")

    @session.on("error")
    def on_error(event):
        logger.error(f"❌ Error in session: {event.error}")

    # Start the session
    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(
            audio_enabled=True,
            text_enabled=True,
        ),
        room_output_options=RoomOutputOptions(
            audio_enabled=True,
            transcription_enabled=True,
        ),
    )
    logger.info("✅ AgentSession started and ready!")

    # Keep the agent running
    logger.info("🎧 Agent is now listening for audio input...")


if __name__ == "__main__":
    logger.info("🚀 Starting AI Teacher Agent...")
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
