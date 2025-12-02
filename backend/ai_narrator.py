"""
AI Narrator Module using Google Gemini 2.5 Pro
===============================================
Generates friendly, educational narrations for each step of code execution.
This is what makes the visualization feel like a guided video tutorial.

The narrator explains:
- What line is being executed
- Current variable states
- Logic decisions being made
- Loop iterations
- Function calls and returns
"""

import os
import json
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Google Gemini API
import google.generativeai as genai

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# System prompt for the AI narrator
NARRATOR_SYSTEM_PROMPT = """You are a coding tutor explaining Python code execution with DRY-RUN style breakdowns.

For each step, provide TWO things:
1. A brief friendly explanation (1-2 sentences)
2. A DRY-RUN breakdown showing the actual values and evaluation

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

For assignments:
```
[explanation sentence]

DRY-RUN:
variable_name = expression
variable_name = [actual value]
```

For conditions (if/elif):
```
[explanation sentence]

DRY-RUN:
condition with variable names
[substitute actual values]
[result] → [True/False]
so [if block executes / if block skipped]
```

For loops (for n in nums):
```
[explanation sentence]

DRY-RUN:
loop_var = next value from iterable
loop_var = [actual value]
```

For return statements:
```
[explanation sentence]

DRY-RUN:
return variable_name
return [actual value] ✓
```

EXAMPLES:

For `max_val = nums[0]` with nums=[3,5,1,7]:
"We're initializing max_val with the first element of our list, assuming it's the largest for now.

DRY-RUN:
max_val = nums[0]
max_val = 3"

For `if n > max_val:` with n=5, max_val=3:
"Checking if our current number is bigger than our tracked maximum.

DRY-RUN:
n > max_val
5 > 3
True → if block executes
max_val will be updated!"

For `if n > max_val:` with n=2, max_val=3:
"Checking if the current number beats our maximum.

DRY-RUN:
n > max_val
2 > 3
False → if block skipped
max_val stays at 3"

For `for n in nums:` with n becoming 5:
"Moving to the next element in our list.

DRY-RUN:
n = next(nums)
n = 5"

For `max_val = n` with n=7:
"Found a bigger number! Updating our maximum.

DRY-RUN:
max_val = n
max_val = 7"

For `return max_val` with max_val=7:
"All done! Returning the largest value we found.

DRY-RUN:
return max_val
return 7 ✓"

CRITICAL RULES:
- Always include the DRY-RUN section with actual values
- Show the symbolic form first, then the evaluated form
- For conditions, ALWAYS show True/False result and what happens
- Keep explanations brief but the dry-run detailed
- Use the actual variable values from the context provided"""


class AINarrator:
    """
    Generates AI-powered narrations for code execution steps.
    Uses Google Gemini 2.5 Pro for natural language generation.
    """
    
    def __init__(self):
        self.model = None
        self.is_available = False
        
        if GEMINI_API_KEY:
            try:
                # Use Gemini 2.0 Flash (latest fast model)
                self.model = genai.GenerativeModel(
                    model_name='gemini-2.0-flash',
                    system_instruction=NARRATOR_SYSTEM_PROMPT
                )
                self.is_available = True
                print("✓ AI Narrator initialized with Gemini 2.0 Flash")
            except Exception as e:
                print(f"⚠ AI Narrator initialization failed: {e}")
                self.is_available = False
        else:
            print("⚠ GEMINI_API_KEY not found - AI narration disabled")
    
    def _format_variables(self, variables: Dict[str, Any]) -> str:
        """Format variables for the prompt in a readable way."""
        if not variables:
            return "No variables yet"
        
        parts = []
        for name, data in variables.items():
            if isinstance(data, dict) and 'value' in data:
                value = data['value']
                var_type = data.get('type', 'unknown')
                parts.append(f"{name} = {value} ({var_type})")
            else:
                parts.append(f"{name} = {data}")
        
        return ", ".join(parts)
    
    def _format_changed_vars(self, changed: List[str], variables: Dict[str, Any]) -> str:
        """Format which variables changed and their new values."""
        if not changed:
            return "No variables changed"
        
        parts = []
        for var_name in changed:
            if var_name in variables:
                data = variables[var_name]
                if isinstance(data, dict) and 'value' in data:
                    parts.append(f"{var_name} → {data['value']}")
                else:
                    parts.append(f"{var_name} → {data}")
            else:
                parts.append(f"{var_name} (new)")
        
        return ", ".join(parts)
    
    def generate_narration(
        self,
        step: int,
        line: int,
        code: str,
        event: str,
        variables: Dict[str, Any],
        changed_vars: List[str],
        function_name: Optional[str] = None,
        return_value: Any = None,
        full_source: Optional[List[str]] = None
    ) -> str:
        """
        Generate a friendly narration for a single execution step.
        
        Args:
            step: Step number in execution
            line: Line number being executed
            code: The actual code on this line
            event: Event type (line, call, return, exception)
            variables: Current local variables
            changed_vars: Variables that changed in this step
            function_name: Name of current function (if any)
            return_value: Return value (for return events)
            full_source: Full source code lines for context
            
        Returns:
            A friendly narration string
        """
        if not self.is_available or not self.model:
            # Fallback to basic narration
            return self._generate_basic_narration(
                step, line, code, event, variables, 
                changed_vars, function_name, return_value
            )
        
        try:
            # Build the context for Gemini
            context_parts = [
                f"Step {step} of execution:",
                f"Line {line}: {code.strip()}",
                f"Event type: {event}",
            ]
            
            if function_name and function_name != '<module>':
                context_parts.append(f"Inside function: {function_name}")
            
            if variables:
                context_parts.append(f"Current variables: {self._format_variables(variables)}")
            
            if changed_vars:
                context_parts.append(f"Variables that changed: {self._format_changed_vars(changed_vars, variables)}")
            
            if event == 'return' and return_value is not None:
                context_parts.append(f"Returning value: {return_value}")
            
            # Add surrounding code context
            if full_source and 1 <= line <= len(full_source):
                start = max(0, line - 3)
                end = min(len(full_source), line + 2)
                context_code = []
                for i in range(start, end):
                    marker = ">>>" if i == line - 1 else "   "
                    context_code.append(f"{marker} {i+1}: {full_source[i]}")
                context_parts.append(f"\nCode context:\n" + "\n".join(context_code))
            
            prompt = "\n".join(context_parts)
            prompt += "\n\nGenerate a brief, friendly narration for this step:"
            
            # Call Gemini API
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=150,
                )
            )
            
            narration = response.text.strip()
            
            # Clean up any markdown or quotes that might slip through
            narration = narration.strip('"\'')
            if narration.startswith('Narration:'):
                narration = narration[10:].strip()
            
            return narration
            
        except Exception as e:
            print(f"AI narration error: {e}")
            # Fallback to basic narration on error
            return self._generate_basic_narration(
                step, line, code, event, variables,
                changed_vars, function_name, return_value
            )
    
    def _generate_basic_narration(
        self,
        step: int,
        line: int,
        code: str,
        event: str,
        variables: Dict[str, Any],
        changed_vars: List[str],
        function_name: Optional[str] = None,
        return_value: Any = None
    ) -> str:
        """
        Generate a basic narration without AI (fallback).
        """
        code = code.strip()
        
        # Handle different event types
        if event == 'call':
            return f"Calling function '{function_name}'"
        
        if event == 'return':
            if return_value is not None:
                return f"Returning {return_value} from '{function_name}'"
            return f"Returning from '{function_name}'"
        
        if event == 'exception':
            return f"An error occurred at this line"
        
        # Generate based on code patterns
        if '=' in code and '==' not in code and '!=' not in code and '<=' not in code and '>=' not in code:
            if changed_vars:
                var = changed_vars[0]
                if var in variables:
                    data = variables[var]
                    val = data['value'] if isinstance(data, dict) else data
                    return f"Setting {var} to {val}"
        
        if code.startswith('for '):
            if changed_vars:
                var = changed_vars[0]
                if var in variables:
                    data = variables[var]
                    val = data['value'] if isinstance(data, dict) else data
                    return f"Loop iteration: {var} is now {val}"
            return "Starting a loop iteration"
        
        if code.startswith('while '):
            return "Checking the while loop condition"
        
        if code.startswith('if '):
            return "Checking if condition"
        
        if code.startswith('elif '):
            return "Checking alternative condition"
        
        if code.startswith('else:'):
            return "Entering the else branch"
        
        if code.startswith('return '):
            return "Returning a value from the function"
        
        if code.startswith('print('):
            return "Printing output to console"
        
        if code.startswith('def '):
            return "Defining a function"
        
        if code.startswith('class '):
            return "Defining a class"
        
        return "Executing this line"
    
    def generate_batch_narrations(
        self,
        frames: List[Dict[str, Any]],
        source_lines: List[str]
    ) -> List[str]:
        """
        Generate narrations for multiple frames efficiently.
        Uses batch processing for better performance.
        
        Args:
            frames: List of trace frames
            source_lines: Full source code lines
            
        Returns:
            List of narration strings
        """
        narrations = []
        
        for frame in frames:
            narration = self.generate_narration(
                step=frame.get('step', 0),
                line=frame.get('line', 0),
                code=frame.get('code', ''),
                event=frame.get('event', 'line'),
                variables=frame.get('locals', {}),
                changed_vars=frame.get('changed_vars', []),
                function_name=frame.get('function_name'),
                return_value=frame.get('return_value'),
                full_source=source_lines
            )
            narrations.append(narration)
        
        return narrations


# Singleton instance
_narrator = None

def get_narrator() -> AINarrator:
    """Get the singleton AI narrator instance."""
    global _narrator
    if _narrator is None:
        _narrator = AINarrator()
    return _narrator


def generate_narration(frame: Dict[str, Any], source_lines: List[str] = None) -> str:
    """
    Convenience function to generate narration for a single frame.
    
    Args:
        frame: A trace frame dictionary
        source_lines: Optional full source code
        
    Returns:
        Narration string
    """
    narrator = get_narrator()
    return narrator.generate_narration(
        step=frame.get('step', 0),
        line=frame.get('line', 0),
        code=frame.get('code', ''),
        event=frame.get('event', 'line'),
        variables=frame.get('locals', {}),
        changed_vars=frame.get('changed_vars', []),
        function_name=frame.get('function_name'),
        return_value=frame.get('return_value'),
        full_source=source_lines
    )


# For testing
if __name__ == "__main__":
    narrator = AINarrator()
    
    # Test frame
    test_frame = {
        "step": 5,
        "line": 7,
        "code": "            if num > max_val:",
        "event": "line",
        "locals": {
            "nums": {"value": [3, 1, 4, 1, 5, 9, 2, 6], "type": "list"},
            "max_val": {"value": 3, "type": "int"},
            "num": {"value": 4, "type": "int"}
        },
        "changed_vars": ["num"],
        "function_name": "findMax"
    }
    
    test_source = [
        "from typing import List",
        "",
        "class Solution:",
        "    def findMax(self, nums: List[int]) -> int:",
        "        max_val = nums[0]",
        "        for num in nums:",
        "            if num > max_val:",
        "                max_val = num",
        "        return max_val"
    ]
    
    narration = narrator.generate_narration(
        step=test_frame["step"],
        line=test_frame["line"],
        code=test_frame["code"],
        event=test_frame["event"],
        variables=test_frame["locals"],
        changed_vars=test_frame["changed_vars"],
        function_name=test_frame["function_name"],
        full_source=test_source
    )
    
    print("Test narration:")
    print(narration)
