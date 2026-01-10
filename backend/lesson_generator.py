"""
Lesson Generator Module
=======================

V1 Teaching Mode: LLM generates everything.
No sys.settrace, no code execution.

Uses Gemini to generate:
- intro_speech: Opening explanation
- code: Representative code snippet  
- steps: Execution steps with variables
- outro_speech: Closing summary
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("lesson-generator")

# Import Gemini
try:
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    GEMINI_AVAILABLE = True
except Exception as e:
    logger.warning(f"Gemini not available: {e}")
    GEMINI_AVAILABLE = False


# Teaching mode constraints
TEACHING_CONFIG = {
    "max_code_lines": 15,
    "max_steps": 25,
    "max_variables_per_step": 1,
}


def sanitize_lesson_output(response: dict) -> dict:
    """
    Hard fail-safe to guarantee visual purity.
    LLMs may violate constraints - this is the post-processing gate.
    """
    # Limit code lines
    if "code" in response and isinstance(response["code"], list):
        response["code"] = response["code"][:TEACHING_CONFIG["max_code_lines"]]
    
    # Limit steps
    if "steps" in response and isinstance(response["steps"], list):
        response["steps"] = response["steps"][:TEACHING_CONFIG["max_steps"]]
        
        # Limit variables per step
        for step in response["steps"]:
            if "variables" in step and isinstance(step["variables"], dict):
                items = list(step["variables"].items())[:TEACHING_CONFIG["max_variables_per_step"]]
                step["variables"] = dict(items)
    
    return response


def build_lesson_prompt(
    course: str,
    section: str,
    lesson: str,
    language: str,
    user_question: str,
    lesson_context: Dict[str, Any]
) -> str:
    """Build the prompt for Gemini to generate lesson content."""
    
    lang_instruction = ""
    if language == "te":
        lang_instruction = """
LANGUAGE: Respond in conversational Telugu, mixing English programming terms naturally.
- Keep technical tokens (for, while, range, print, def, return) in English
- Use Telugu script for explanations
- Example style: "ఈ for loop ఎలా work అవుతుందో చూద్దాం."
"""
    else:
        lang_instruction = """
LANGUAGE: Respond in clear, friendly English suitable for beginners.
"""
    
    concepts = ", ".join(lesson_context.get("concepts", []))
    common_confusion = lesson_context.get("common_confusion", "")
    
    prompt = f"""You are an expert programming teacher creating a visual lesson.

LESSON CONTEXT:
- Course: {course}
- Section: {section}  
- Topic: {lesson}
- Key concepts: {concepts}
- Common student confusion: {common_confusion}

STUDENT'S QUESTION: "{user_question}"

{lang_instruction}

STRICT CONSTRAINTS (MUST FOLLOW):
❌ Do not use input()
❌ Do not use recursion
❌ Do not define nested functions
❌ Do not use imports
❌ Do not use try/except
❌ Maximum 10 lines of code
❌ Maximum 20 execution steps
❌ Only 1 variable change per step

TASK: Generate a teaching response in this EXACT JSON format:
{{
    "intro_speech": "Brief friendly intro (2-3 sentences) explaining what we'll learn",
    "code": ["line1", "line2", "..."],
    "steps": [
        {{"line": 1, "code": "the code on this line", "variables": {{"var_name": value}}, "explanation": "what happens here"}}
    ],
    "outro_speech": "Brief summary (1-2 sentences) reinforcing the key concept"
}}

If the student's question is vague (like "I don't understand"), explain the most common confusion point for this topic.

Generate the JSON response:"""

    return prompt


async def generate_lesson_content(
    course: str,
    section: str,
    lesson: str,
    language: str,
    user_question: str,
    lesson_context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate lesson content using Gemini.
    
    Returns:
        {
            "success": True/False,
            "intro_speech": "...",
            "code": ["line1", "line2"],
            "steps": [...],
            "outro_speech": "..."
        }
    """
    if not GEMINI_AVAILABLE:
        return {
            "success": False,
            "error": "Gemini API not available"
        }
    
    try:
        # Build prompt
        prompt = build_lesson_prompt(
            course, section, lesson, language, user_question, lesson_context
        )
        
        # Call Gemini
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 2000,
            }
        )
        
        # Parse response
        response_text = response.text
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        response_text = response_text.strip()
        
        # Parse JSON
        lesson_data = json.loads(response_text)
        
        # Apply safety sanitization
        lesson_data = sanitize_lesson_output(lesson_data)
        
        lesson_data["success"] = True
        return lesson_data
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        return {
            "success": False,
            "error": f"Invalid response format: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Lesson generation failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


# Fallback lesson content for testing
FALLBACK_LESSONS = {
    "for_loop": {
        "intro_speech": "Let me show you how a for loop works in Python. We'll iterate through a range of numbers.",
        "code": [
            "total = 0",
            "for i in range(3):",
            "    total = total + i",
            "print(total)"
        ],
        "steps": [
            {"line": 1, "code": "total = 0", "variables": {"total": 0}, "explanation": "We start by creating a variable called total and setting it to 0."},
            {"line": 2, "code": "for i in range(3):", "variables": {"i": 0}, "explanation": "The for loop starts. i gets the first value from range(3), which is 0."},
            {"line": 3, "code": "    total = total + i", "variables": {"total": 0}, "explanation": "We add i (which is 0) to total. So total stays 0."},
            {"line": 2, "code": "for i in range(3):", "variables": {"i": 1}, "explanation": "Loop continues. i becomes 1."},
            {"line": 3, "code": "    total = total + i", "variables": {"total": 1}, "explanation": "We add i (which is 1) to total. Now total is 1."},
            {"line": 2, "code": "for i in range(3):", "variables": {"i": 2}, "explanation": "Loop continues. i becomes 2."},
            {"line": 3, "code": "    total = total + i", "variables": {"total": 3}, "explanation": "We add i (which is 2) to total. Now total is 3."},
            {"line": 4, "code": "print(total)", "variables": {"total": 3}, "explanation": "The loop is done! We print the final total, which is 3."}
        ],
        "outro_speech": "That's how a for loop iterates through values. range(3) gives us 0, 1, 2 - notice it stops before 3!"
    },
    "while_loop": {
        "intro_speech": "Let's learn about while loops. They keep running as long as a condition is true.",
        "code": [
            "count = 0",
            "while count < 3:",
            "    count = count + 1",
            "print(count)"
        ],
        "steps": [
            {"line": 1, "code": "count = 0", "variables": {"count": 0}, "explanation": "We create a variable count and set it to 0."},
            {"line": 2, "code": "while count < 3:", "variables": {"count": 0}, "explanation": "Check: is count (0) less than 3? Yes! So we enter the loop."},
            {"line": 3, "code": "    count = count + 1", "variables": {"count": 1}, "explanation": "We add 1 to count. Now count is 1."},
            {"line": 2, "code": "while count < 3:", "variables": {"count": 1}, "explanation": "Check again: is count (1) less than 3? Yes! Continue."},
            {"line": 3, "code": "    count = count + 1", "variables": {"count": 2}, "explanation": "We add 1 to count. Now count is 2."},
            {"line": 2, "code": "while count < 3:", "variables": {"count": 2}, "explanation": "Check: is count (2) less than 3? Yes! One more time."},
            {"line": 3, "code": "    count = count + 1", "variables": {"count": 3}, "explanation": "We add 1 to count. Now count is 3."},
            {"line": 2, "code": "while count < 3:", "variables": {"count": 3}, "explanation": "Check: is count (3) less than 3? No! Loop stops."},
            {"line": 4, "code": "print(count)", "variables": {"count": 3}, "explanation": "We print count, which is now 3."}
        ],
        "outro_speech": "The while loop keeps checking its condition each time. When count became 3, the condition became false and we exited."
    }
}


def get_fallback_lesson(lesson_id: str, language: str = "en") -> Dict[str, Any]:
    """Get fallback lesson if Gemini fails."""
    lesson = FALLBACK_LESSONS.get(lesson_id)
    if lesson:
        return {"success": True, **lesson}
    
    # Generic fallback
    return {
        "success": True,
        "intro_speech": "Let me explain this concept with a simple example.",
        "code": ["x = 5", "y = x + 3", "print(y)"],
        "steps": [
            {"line": 1, "code": "x = 5", "variables": {"x": 5}, "explanation": "We create variable x and set it to 5."},
            {"line": 2, "code": "y = x + 3", "variables": {"y": 8}, "explanation": "We create y by adding 3 to x. So y is 8."},
            {"line": 3, "code": "print(y)", "variables": {"y": 8}, "explanation": "We print y, which shows 8."}
        ],
        "outro_speech": "This is how variables and basic operations work in Python."
    }
