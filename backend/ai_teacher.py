"""
AI Teacher Module - Real-time Voice Chat
==========================================
Integrates Gemini 2.5 Flash for context-aware conversations
and ElevenLabs for text-to-speech responses.

Features:
- Maintains conversation context from code execution
- Answers questions about code, algorithms, and concepts
- Generates natural voice responses via ElevenLabs
"""

import os
import json
import base64
from typing import Dict, List, Any, Optional, Generator
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv()

# Google Gemini API
import google.generativeai as genai

# Configure APIs
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
ELEVEN_LABS_API_KEY = os.getenv('ELEVEN_LABS_API_KEY')

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ElevenLabs configuration
ELEVEN_LABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel - clear, friendly voice
ELEVEN_LABS_API_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_LABS_VOICE_ID}"

# System prompt for AI Teacher
AI_TEACHER_SYSTEM_PROMPT = """You are an expert coding tutor helping students understand Python code execution. You have access to the complete execution context of their code.

Your personality:
- Friendly, patient, and encouraging
- Explain concepts simply but accurately
- Use analogies and real-world examples when helpful
- Keep responses concise (2-4 sentences for simple questions, more for complex ones)
- If asked about specific lines or steps, reference the execution data you have

You have access to:
1. The complete source code being visualized
2. All execution steps with variable states
3. The current step the user is viewing

When answering:
- Reference specific line numbers and variable values when relevant
- Explain WHY things happen, not just WHAT happens
- Connect concepts to broader programming principles
- If the user seems confused, offer to explain from a different angle

Remember: You're speaking out loud, so use natural conversational language. Avoid code blocks in speech - describe code verbally instead."""


class AITeacher:
    """
    AI Teacher for real-time voice conversations about code execution.
    Uses Gemini 2.5 Flash for understanding and ElevenLabs for speech.
    """
    
    def __init__(self):
        self.gemini_model = None
        self.gemini_available = False
        self.elevenlabs_available = False
        self.conversation_history = []
        self.code_context = None
        self.execution_steps = []
        
        # Initialize Gemini
        if GEMINI_API_KEY:
            try:
                self.gemini_model = genai.GenerativeModel(
                    model_name='gemini-2.0-flash',
                    system_instruction=AI_TEACHER_SYSTEM_PROMPT
                )
                self.gemini_available = True
                print("✓ AI Teacher: Gemini 2.0 Flash initialized")
            except Exception as e:
                print(f"⚠ AI Teacher: Gemini initialization failed: {e}")
        else:
            print("⚠ AI Teacher: GEMINI_API_KEY not found")
        
        # Check ElevenLabs
        if ELEVEN_LABS_API_KEY:
            self.elevenlabs_available = True
            print("✓ AI Teacher: ElevenLabs TTS available")
        else:
            print("⚠ AI Teacher: ELEVEN_LABS_API_KEY not found - voice disabled")
    
    def set_context(
        self,
        code: str,
        code_lines: List[str],
        execution_steps: List[Dict[str, Any]],
        current_step_index: int = 0
    ):
        """
        Set the code execution context for the conversation.
        This gives the AI full understanding of what's happening.
        """
        self.code_context = {
            "code": code,
            "code_lines": code_lines,
            "total_lines": len(code_lines)
        }
        self.execution_steps = execution_steps
        
        # Build a summary of the execution for context
        execution_summary = self._build_execution_summary(execution_steps)
        
        # Reset conversation with new context
        self.conversation_history = []
        
        # Add context as the first message
        context_message = f"""[EXECUTION CONTEXT]
Source Code:
```python
{code}
```

Execution Summary ({len(execution_steps)} steps):
{execution_summary}

The student is visualizing this code execution. Answer their questions about any aspect of it."""
        
        self.conversation_history.append({
            "role": "user",
            "parts": [context_message]
        })
        self.conversation_history.append({
            "role": "model", 
            "parts": ["I understand! I've analyzed the code and its execution. I can see all the steps, variable changes, and the flow of the program. Feel free to ask me anything about how this code works!"]
        })
    
    def _build_execution_summary(self, steps: List[Dict[str, Any]]) -> str:
        """Build a detailed summary of all execution steps."""
        if not steps:
            return "No execution steps available yet."
        
        summary_parts = []
        for i, step in enumerate(steps):  # Include ALL steps
            line_num = step.get('lineNumber', step.get('line', '?'))
            code = step.get('code', '').strip()
            variables = step.get('variables', step.get('locals', {}))
            changed = step.get('changedVars', step.get('changed_vars', []))
            explanation = step.get('explanation', '')
            
            var_str = ""
            if changed and variables:
                changes = []
                for var in changed:
                    if var in variables:
                        val = variables[var]
                        if isinstance(val, dict) and 'value' in val:
                            val = val['value']
                        changes.append(f"{var}={val}")
                if changes:
                    var_str = f" | Changed: {', '.join(changes)}"
            
            # Include all current variable states
            all_vars = ""
            if variables:
                var_list = []
                for name, val in variables.items():
                    if isinstance(val, dict) and 'value' in val:
                        var_list.append(f"{name}={val['value']}")
                    else:
                        var_list.append(f"{name}={val}")
                if var_list:
                    all_vars = f" | State: {', '.join(var_list[:5])}"  # Limit to 5 vars per step
            
            summary_parts.append(f"Step {i+1} (Line {line_num}): `{code}`{var_str}{all_vars}")
        
        return "\n".join(summary_parts)
    
    def chat(
        self,
        user_message: str,
        current_step_index: Optional[int] = None
    ) -> Generator[str, None, None]:
        """
        Send a message and get a streaming response.
        Yields chunks of the response text.
        """
        if not self.gemini_available or not self.gemini_model:
            yield "I'm sorry, but I'm not available right now. Please make sure the AI service is configured."
            return
        
        try:
            # Add current step context if provided
            if current_step_index is not None and self.execution_steps:
                if 0 <= current_step_index < len(self.execution_steps):
                    step = self.execution_steps[current_step_index]
                    step_context = f"\n[Currently viewing Step {current_step_index + 1}: Line {step.get('lineNumber', step.get('line', '?'))} - {step.get('code', '')[:50]}]"
                    user_message = user_message + step_context
            
            # Add to conversation history
            self.conversation_history.append({
                "role": "user",
                "parts": [user_message]
            })
            
            # Create chat session
            chat = self.gemini_model.start_chat(history=self.conversation_history[:-1])
            
            # Get streaming response
            response = chat.send_message(
                user_message,
                generation_config=genai.GenerationConfig(
                    temperature=0.8,
                    max_output_tokens=300,
                ),
                stream=True
            )
            
            full_response = ""
            for chunk in response:
                if chunk.text:
                    full_response += chunk.text
                    yield chunk.text
            
            # Add response to history
            self.conversation_history.append({
                "role": "model",
                "parts": [full_response]
            })
            
        except Exception as e:
            print(f"AI Teacher chat error: {e}")
            yield f"I encountered an error: {str(e)}. Let me try again."
    
    def chat_sync(
        self,
        user_message: str,
        current_step_index: Optional[int] = None
    ) -> str:
        """
        Send a message and get a complete response (non-streaming).
        """
        full_response = ""
        for chunk in self.chat(user_message, current_step_index):
            full_response += chunk
        return full_response
    
    def text_to_speech(self, text: str) -> Optional[bytes]:
        """
        Convert text to speech using ElevenLabs.
        Returns audio data as bytes (MP3 format).
        """
        if not self.elevenlabs_available or not ELEVEN_LABS_API_KEY:
            return None
        
        try:
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVEN_LABS_API_KEY
            }
            
            data = {
                "text": text,
                "model_id": "eleven_turbo_v2",  # Fast, low latency
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.5,
                    "use_speaker_boost": True
                }
            }
            
            response = requests.post(
                ELEVEN_LABS_API_URL,
                json=data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.content
            else:
                print(f"ElevenLabs API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"TTS error: {e}")
            return None
    
    def text_to_speech_stream(self, text: str) -> Generator[bytes, None, None]:
        """
        Stream text-to-speech audio using ElevenLabs streaming API.
        Yields audio chunks for real-time playback.
        """
        if not self.elevenlabs_available or not ELEVEN_LABS_API_KEY:
            return
        
        try:
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVEN_LABS_API_KEY
            }
            
            data = {
                "text": text,
                "model_id": "eleven_turbo_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75
                }
            }
            
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_LABS_VOICE_ID}/stream"
            
            response = requests.post(
                url,
                json=data,
                headers=headers,
                stream=True,
                timeout=30
            )
            
            if response.status_code == 200:
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        yield chunk
            else:
                print(f"ElevenLabs stream error: {response.status_code}")
                
        except Exception as e:
            print(f"TTS stream error: {e}")
    
    def text_to_speech_with_timestamps(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Convert text to speech with word-level timestamps for real-time sync.
        Uses ElevenLabs with-timestamps endpoint.
        
        Returns:
            {
                "audio": base64_encoded_audio,
                "alignment": {
                    "characters": ["H", "e", "l", "l", "o", ...],
                    "character_start_times_seconds": [0.0, 0.1, ...],
                    "character_end_times_seconds": [0.1, 0.2, ...]
                }
            }
        """
        if not self.elevenlabs_available or not ELEVEN_LABS_API_KEY:
            return None
        
        try:
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "xi-api-key": ELEVEN_LABS_API_KEY
            }
            
            data = {
                "text": text,
                "model_id": "eleven_turbo_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.5,
                    "use_speaker_boost": True
                }
            }
            
            # Use the with-timestamps endpoint
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_LABS_VOICE_ID}/with-timestamps"
            
            response = requests.post(
                url,
                json=data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                # The response contains audio_base64 and alignment data
                return {
                    "audio": result.get("audio_base64"),
                    "alignment": result.get("alignment", {})
                }
            else:
                print(f"ElevenLabs timestamps API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"TTS with timestamps error: {e}")
            return None
    
    def clear_history(self):
        """Clear conversation history but keep code context."""
        if self.code_context:
            # Keep the initial context messages
            self.conversation_history = self.conversation_history[:2] if len(self.conversation_history) >= 2 else []
        else:
            self.conversation_history = []
    
    def step_chat(
        self,
        user_message: str,
        step_context: dict,
        code: str = "",
        code_lines: list = None
    ) -> str:
        """
        Answer a question about a specific step in the execution.
        This is for inline step-level conversations.
        """
        if not self.gemini_available:
            return "AI Teacher is not available. Please check your API key."
        
        try:
            step_index = step_context.get('stepIndex', 0)
            current_line = step_context.get('currentLine', '')
            current_code = step_context.get('currentCode', '')
            explanation = step_context.get('explanation', '')
            variables = step_context.get('variables', {})
            previous_messages = step_context.get('previousMessages', [])
            
            # Build a focused prompt for this specific step
            step_prompt = f"""You are an AI coding tutor. The user is viewing a specific step in code execution and has a question.

CURRENT STEP CONTEXT:
- Step {step_index + 1}, Line {current_line}
- Code: {current_code}
- Original Explanation: {explanation}
- Current Variables: {json.dumps(variables, default=str) if variables else 'None'}

FULL CODE:
```python
{code}
```

PREVIOUS CONVERSATION ABOUT THIS STEP:
{self._format_previous_messages(previous_messages)}

USER'S QUESTION: {user_message}

Instructions:
- Answer specifically about THIS step and line of code
- Be concise (2-3 sentences max for simple questions)
- Reference the variable values shown above when relevant
- Use natural conversational language (this will be spoken aloud)
- If the question is about something not related to this step, briefly explain and connect it back to the current context
"""
            
            # Use a fresh chat for step-specific questions (don't pollute main conversation)
            chat = self.gemini_model.start_chat(history=[])
            
            response = chat.send_message(
                step_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=250,
                )
            )
            
            return response.text
            
        except Exception as e:
            print(f"Step chat error: {e}")
            return f"I encountered an error while answering your question. Please try again."
    
    def _format_previous_messages(self, messages: list) -> str:
        """Format previous messages for context."""
        if not messages:
            return "No previous messages"
        
        formatted = []
        for msg in messages[-4:]:  # Only keep last 4 messages for context
            role = "User" if msg.get('from') == 'user' else "AI"
            text = msg.get('text', '')[:200]  # Truncate long messages
            formatted.append(f"{role}: {text}")
        
        return "\n".join(formatted)


# Singleton instance
_teacher = None

def get_teacher() -> AITeacher:
    """Get the singleton AI Teacher instance."""
    global _teacher
    if _teacher is None:
        _teacher = AITeacher()
    return _teacher


# For testing
if __name__ == "__main__":
    teacher = AITeacher()
    
    # Test with sample code
    test_code = """class Solution:
    def findMax(self, nums):
        max_val = nums[0]
        for n in nums:
            if n > max_val:
                max_val = n
        return max_val"""
    
    test_steps = [
        {"lineNumber": 3, "code": "max_val = nums[0]", "variables": {"nums": {"value": [3, 5, 1], "type": "list"}}, "changedVars": ["max_val"]},
        {"lineNumber": 4, "code": "for n in nums:", "variables": {"nums": {"value": [3, 5, 1], "type": "list"}, "n": {"value": 3, "type": "int"}}, "changedVars": ["n"]},
    ]
    
    teacher.set_context(test_code, test_code.split('\n'), test_steps)
    
    print("\nTesting chat...")
    response = teacher.chat_sync("What does this code do?")
    print(f"Response: {response}")
    
    if teacher.elevenlabs_available:
        print("\nTesting TTS...")
        audio = teacher.text_to_speech("Hello! I'm your AI coding teacher.")
        if audio:
            print(f"Generated {len(audio)} bytes of audio")
