"""
Timeline Engine - Orchestrates synchronized speech and visualization
=====================================================================

This is the CORE component that enables seamless AI teaching experience.
It generates a unified timeline that both the voice agent and visualization
agent consume, ensuring perfect synchronization.

The Timeline Engine:
1. Takes execution trace (steps) and generates a teaching timeline
2. Each timeline entry has:
   - What to visualize (drawing commands)
   - What to say (speech script)
   - Current state (variables, highlights)
3. Both agents consume the SAME timeline step
4. Progression is controlled (auto-advance or user-triggered)
"""

import json
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger("timeline-engine")


def extract_value(val):
    """Extract actual value from tracer's {value, type} format."""
    if isinstance(val, dict) and 'value' in val:
        return val['value']
    return val


def format_value(val):
    """Format a value for display in speech."""
    extracted = extract_value(val)
    if isinstance(extracted, list):
        if len(extracted) > 5:
            return f"[{', '.join(str(x) for x in extracted[:5])}, ...]"
        return str(extracted)
    return str(extracted)


@dataclass
class TimelineStep:
    """A single synchronized step in the teaching timeline."""
    step_number: int
    phase: str  # 'overview', 'initialization', 'iteration', 'comparison', 'update', 'result'
    
    # What to say
    speech_script: str
    
    # What to visualize (list of drawing commands)
    visualization_commands: List[Dict[str, Any]]
    
    # Current state
    variables: Dict[str, Any]
    current_line: int
    highlight_indices: List[int]  # Which array indices to highlight
    
    # Metadata
    description: str
    duration_hint: float  # Suggested duration in seconds
    
    def to_dict(self) -> dict:
        return asdict(self)


class TimelineEngine:
    """
    Generates and manages the teaching timeline.
    
    Usage:
        engine = TimelineEngine()
        timeline = engine.generate_timeline(code, execution_steps)
        
        # Get current step
        step = engine.get_current_step()
        
        # Advance to next
        engine.next_step()
    """
    
    def __init__(self):
        self.timeline: List[TimelineStep] = []
        self.current_index: int = 0
        self.code: str = ""
        self.execution_steps: List[Dict] = []
        
    def generate_timeline(self, code: str, execution_steps: List[Dict]) -> List[TimelineStep]:
        """
        Generate a complete teaching timeline from code and execution trace.
        
        This creates a structured sequence that includes:
        1. Overview step (algorithm explanation)
        2. Initialization steps
        3. Iteration steps with comparisons
        4. Result/conclusion step
        """
        self.code = code
        self.execution_steps = execution_steps
        self.timeline = []
        self.current_index = 0
        
        if not execution_steps:
            return self.timeline
        
        # Analyze the code to understand its structure
        analysis = self._analyze_code(code, execution_steps)
        
        # Step 0: Overview
        self.timeline.append(self._create_overview_step(analysis))
        
        # Generate steps from execution trace
        prev_loop_index = -1
        for i, step in enumerate(execution_steps):
            timeline_step = self._create_execution_step(i, step, analysis, prev_loop_index)
            if timeline_step:
                self.timeline.append(timeline_step)
                # Track loop progress
                if timeline_step.highlight_indices:
                    prev_loop_index = timeline_step.highlight_indices[0]
        
        # Final step: Conclusion
        self.timeline.append(self._create_conclusion_step(analysis))
        
        logger.info(f"📋 Generated timeline with {len(self.timeline)} steps")
        return self.timeline
    
    def _analyze_code(self, code: str, steps: List[Dict]) -> Dict[str, Any]:
        """Analyze code to understand its structure and purpose."""
        analysis = {
            "has_loop": False,
            "loop_type": None,
            "main_variable": None,
            "array_name": None,
            "array_values": [],
            "purpose": "unknown",
            "final_result": None,
            "loop_var": None,
        }
        
        # Detect loops
        if "for " in code:
            analysis["has_loop"] = True
            analysis["loop_type"] = "for"
        elif "while " in code:
            analysis["has_loop"] = True
            analysis["loop_type"] = "while"
        
        # Find array/list variables from first step
        for step in steps:
            variables = step.get("variables", step.get("locals", {}))
            for var_name, var_value in variables.items():
                actual_val = extract_value(var_value)
                if isinstance(actual_val, list) and len(actual_val) > 0:
                    analysis["array_name"] = var_name
                    analysis["array_values"] = actual_val
                    break
            if analysis["array_values"]:
                break
        
        # Detect algorithm purpose from variable names
        code_lower = code.lower()
        if "max" in code_lower:
            analysis["purpose"] = "find_maximum"
            analysis["main_variable"] = "max_val" if "max_val" in code else "maximum"
        elif "min" in code_lower:
            analysis["purpose"] = "find_minimum"
            analysis["main_variable"] = "min_val" if "min_val" in code else "minimum"
        elif "sum" in code_lower:
            analysis["purpose"] = "calculate_sum"
            analysis["main_variable"] = "total" if "total" in code else "sum"
        elif "sort" in code_lower:
            analysis["purpose"] = "sorting"
        elif "search" in code_lower or "find" in code_lower:
            analysis["purpose"] = "searching"
        
        # Detect loop variable
        for var in ['n', 'num', 'element', 'item', 'x', 'i', 'j']:
            if var in code:
                analysis["loop_var"] = var
                break
        
        # Get final result from last step
        if steps:
            last_step = steps[-1]
            last_vars = last_step.get("variables", last_step.get("locals", {}))
            if analysis["main_variable"] and analysis["main_variable"] in last_vars:
                analysis["final_result"] = extract_value(last_vars[analysis["main_variable"]])
        
        return analysis
    
    def _create_overview_step(self, analysis: Dict) -> TimelineStep:
        """Create the overview/introduction step."""
        array_name = analysis.get("array_name", "nums")
        array_values = analysis.get("array_values", [])
        purpose = analysis.get("purpose", "unknown")
        
        # Generate speech based on purpose
        purpose_speeches = {
            "find_maximum": f"Let's find the maximum value in this array. We have {len(array_values)} elements: {format_value(array_values)}. I'll walk through the algorithm step by step.",
            "find_minimum": f"Let's find the minimum value in this array. We have {len(array_values)} elements: {format_value(array_values)}.",
            "calculate_sum": f"Let's calculate the sum of all {len(array_values)} elements in the array: {format_value(array_values)}.",
            "sorting": f"Let's sort this array of {len(array_values)} elements step by step.",
            "searching": f"Let's search through this array of {len(array_values)} elements.",
            "unknown": f"Let's trace through this code step by step. We have an array with {len(array_values)} elements: {format_value(array_values)}.",
        }
        
        speech = purpose_speeches.get(purpose, purpose_speeches["unknown"])
        
        # Visualization commands for overview - rich animated experience
        commands = [
            {"action": "clear_canvas"},
            {"action": "draw_label", "id": "title", "text": "🔍 Algorithm Overview", "x": 50, "y": 30, "color": "#60A5FA", "fontSize": 24},
            {"action": "draw_array", "id": array_name, "elements": array_values, "x": 50, "y": 120, "label": f"{array_name} = {array_values}"},
        ]
        
        # Add purpose-specific goal label
        goal_text = {
            "find_maximum": "🎯 Goal: Find the LARGEST value",
            "find_minimum": "🎯 Goal: Find the SMALLEST value",
            "calculate_sum": "🎯 Goal: Calculate the SUM",
            "sorting": "🎯 Goal: Sort the array",
            "searching": "🎯 Goal: Search for a value",
            "unknown": "🎯 Goal: Trace execution"
        }
        
        commands.append({
            "action": "draw_label", 
            "id": "goal", 
            "text": goal_text.get(purpose, goal_text["unknown"]), 
            "x": 50, 
            "y": 250, 
            "color": "#22C55E",
            "fontSize": 18
        })
        
        return TimelineStep(
            step_number=0,
            phase="overview",
            speech_script=speech,
            visualization_commands=commands,
            variables={},
            current_line=0,
            highlight_indices=[],
            description="Algorithm overview and initialization",
            duration_hint=4.0
        )
    
    def _create_execution_step(self, index: int, step: Dict, analysis: Dict, prev_loop_index: int) -> Optional[TimelineStep]:
        """Create a timeline step from an execution trace step."""
        line_num = step.get("line", step.get("lineNumber", 0))
        code_line = step.get("code", "")
        variables = step.get("variables", step.get("locals", {}))
        changed_vars = step.get("changed_vars", step.get("changedVars", []))
        
        array_name = analysis.get("array_name", "nums")
        array_values = analysis.get("array_values", [])
        main_var = analysis.get("main_variable")
        loop_var = analysis.get("loop_var")
        
        # Determine the phase based on what's happening
        phase = "iteration"
        speech = ""
        commands = []
        highlight_indices = []
        
        # Extract current loop element value
        current_element = None
        current_index = None
        
        if loop_var and loop_var in variables:
            current_element = extract_value(variables[loop_var])
            if current_element in array_values:
                current_index = array_values.index(current_element)
        
        # Get main variable value
        main_val = None
        if main_var and main_var in variables:
            main_val = extract_value(variables[main_var])
        
        # Generate speech and visualization based on code pattern
        if main_var and main_var in changed_vars and (index == 0 or "=" in code_line and "[0]" in code_line):
            # First initialization (e.g., max_val = nums[0])
            phase = "initialization"
            speech = f"First, we initialize {main_var} to {main_val}. This is the first element of our array - our starting point for comparison."
            commands = [
                {"action": "draw_variable", "name": main_var, "value": main_val, "x": 450, "y": 80, "highlight": True, "color": "#FBBF24"},
            ]
            if array_values:
                highlight_indices = [0]
                commands.append({"action": "highlight_index", "id": array_name, "index": 0, "color": "#FBBF24"})
                commands.append({"action": "draw_pointer", "id": "init", "array_id": array_name, "index": 0, "label": f"{main_var}={main_val}"})
                
        elif "for " in code_line and loop_var:
            # Loop iteration start
            phase = "iteration"
            if current_element is not None and current_index is not None:
                speech = f"Now we look at element {current_element} at index {current_index}."
                highlight_indices = [current_index]
                commands = [
                    {"action": "highlight_index", "id": array_name, "index": current_index, "color": "#60A5FA"},
                    {"action": "draw_pointer", "id": loop_var, "array_id": array_name, "index": current_index, "label": f"{loop_var}={current_element}"},
                ]
            else:
                speech = f"Starting iteration with the loop."
                
        elif ">" in code_line or "<" in code_line or "==" in code_line:
            # Comparison
            phase = "comparison"
            if current_element is not None and main_val is not None:
                if ">" in code_line:
                    is_greater = current_element > main_val if isinstance(current_element, (int, float)) and isinstance(main_val, (int, float)) else False
                    if is_greater:
                        speech = f"Comparing {current_element} with {main_var} which is {main_val}. Yes! {current_element} is GREATER, so we update {main_var}!"
                        color = "#22C55E"  # Green for success
                    else:
                        speech = f"Comparing {current_element} with {main_var} which is {main_val}. No, {current_element} is not greater, so we skip."
                        color = "#6B7280"  # Gray for skip
                    
                    commands = [
                        {"action": "draw_comparison", "left": str(current_element), "operator": ">", "right": str(main_val), "result": is_greater, "x": 50, "y": 200},
                    ]
                    if current_index is not None:
                        highlight_indices = [current_index]
                        commands.append({"action": "highlight_index", "id": array_name, "index": current_index, "color": color})
                else:
                    speech = f"Checking condition on line {line_num}."
            else:
                speech = f"Evaluating condition: {code_line.strip()}"
                        
        elif "=" in code_line and main_var and main_var in changed_vars:
            # Variable update
            phase = "update"
            new_val = main_val
            speech = f"Updating {main_var} to {new_val}! This is our new best value so far."
            
            commands = [
                {"action": "draw_variable", "name": main_var, "value": new_val, "x": 450, "y": 80, "highlight": True, "color": "#22C55E"},
                {"action": "pulse_element", "targetId": f"{array_name}_{current_index}" if current_index is not None else None},
            ]
            if current_index is not None:
                highlight_indices = [current_index]
                commands.append({"action": "highlight_index", "id": array_name, "index": current_index, "color": "#22C55E"})
        
        elif "return" in code_line.lower():
            # Return statement
            phase = "return"
            speech = f"We're done! Returning {main_val} as our result."
            return None  # Skip - conclusion step handles this
        
        else:
            # Generic step - try to make it meaningful
            if code_line.strip() and not code_line.strip().startswith('#'):
                speech = f"Executing: {code_line.strip()}"
                # Still highlight current position if we know it
                if current_index is not None:
                    highlight_indices = [current_index]
                    commands = [
                        {"action": "highlight_index", "id": array_name, "index": current_index, "color": "#60A5FA"},
                    ]
            else:
                return None
        
        # Skip steps with no meaningful content
        if not speech:
            return None
        
        return TimelineStep(
            step_number=index + 1,
            phase=phase,
            speech_script=speech,
            visualization_commands=commands,
            variables={k: extract_value(v) for k, v in variables.items()},
            current_line=line_num,
            highlight_indices=highlight_indices,
            description=f"Step {index + 1}: {code_line.strip()[:50]}",
            duration_hint=3.0
        )
    
    def _create_conclusion_step(self, analysis: Dict) -> TimelineStep:
        """Create the conclusion/result step."""
        purpose = analysis.get("purpose", "unknown")
        main_var = analysis.get("main_variable")
        final_result = analysis.get("final_result")
        array_name = analysis.get("array_name", "nums")
        array_values = analysis.get("array_values", [])
        
        # Generate conclusion speech
        if purpose == "find_maximum" and final_result is not None:
            speech = f"And we're done! After checking all elements, the maximum value is {final_result}! 🎉"
            result_index = array_values.index(final_result) if final_result in array_values else -1
        elif purpose == "find_minimum" and final_result is not None:
            speech = f"We've checked all elements. The minimum value is {final_result}!"
            result_index = array_values.index(final_result) if final_result in array_values else -1
        elif purpose == "calculate_sum" and final_result is not None:
            speech = f"The sum of all elements is {final_result}!"
            result_index = -1
        else:
            speech = "The algorithm has completed successfully!"
            result_index = -1
        
        commands = [
            {"action": "clear_canvas"},
            {"action": "draw_label", "id": "result_title", "text": "✅ Algorithm Complete!", "x": 50, "y": 30, "color": "#22C55E", "fontSize": 28},
            {"action": "draw_array", "id": array_name, "elements": array_values, "x": 50, "y": 120, "label": f"{array_name}"},
        ]
        
        if main_var and final_result is not None:
            commands.append({
                "action": "draw_variable", 
                "name": main_var, 
                "value": final_result, 
                "x": 450, 
                "y": 80, 
                "highlight": True,
                "color": "#22C55E"
            })
            commands.append({
                "action": "draw_label",
                "id": "result_value",
                "text": f"🏆 Result: {main_var} = {final_result}",
                "x": 50,
                "y": 250,
                "color": "#FBBF24",
                "fontSize": 22
            })
        
        if result_index >= 0:
            commands.append({"action": "highlight_index", "id": array_name, "index": result_index, "color": "#22C55E"})
        
        return TimelineStep(
            step_number=len(self.execution_steps) + 1,
            phase="result",
            speech_script=speech,
            visualization_commands=commands,
            variables={main_var: final_result} if main_var else {},
            current_line=0,
            highlight_indices=[result_index] if result_index >= 0 else [],
            description="Final result",
            duration_hint=4.0
        )
    
    # =========================================================================
    # Timeline Navigation
    # =========================================================================
    
    def get_current_step(self) -> Optional[TimelineStep]:
        """Get the current timeline step."""
        if 0 <= self.current_index < len(self.timeline):
            return self.timeline[self.current_index]
        return None
    
    def next_step(self) -> Optional[TimelineStep]:
        """Advance to the next step and return it."""
        if self.current_index < len(self.timeline) - 1:
            self.current_index += 1
            return self.get_current_step()
        return None
    
    def previous_step(self) -> Optional[TimelineStep]:
        """Go back to the previous step."""
        if self.current_index > 0:
            self.current_index -= 1
            return self.get_current_step()
        return None
    
    def go_to_step(self, step_number: int) -> Optional[TimelineStep]:
        """Jump to a specific step."""
        if 0 <= step_number < len(self.timeline):
            self.current_index = step_number
            return self.get_current_step()
        return None
    
    def reset(self):
        """Reset to the beginning."""
        self.current_index = 0
    
    def is_complete(self) -> bool:
        """Check if we've reached the end."""
        return self.current_index >= len(self.timeline) - 1
    
    def get_progress(self) -> Dict[str, Any]:
        """Get current progress information."""
        return {
            "current_step": self.current_index,
            "total_steps": len(self.timeline),
            "progress_percent": (self.current_index / max(1, len(self.timeline) - 1)) * 100,
            "is_complete": self.is_complete(),
        }
    
    def get_all_steps(self) -> List[Dict]:
        """Get all timeline steps as dicts."""
        return [step.to_dict() for step in self.timeline]
    
    def get_speech_scripts(self) -> List[str]:
        """Get all speech scripts for embedding in agent instructions."""
        return [step.speech_script for step in self.timeline]


# Global timeline engine instance
timeline_engine = TimelineEngine()
