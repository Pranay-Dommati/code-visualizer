"""
CINEMATIC TRANSITION GENERATOR
==============================

This is the DIRECTOR that produces TRANSITION COMMANDS, not scenes.

Instead of:
    Scene 1: { array: [3,6], highlight: 0 }
    Scene 2: { comparison: 3 > 3, result: False }

We produce:
    { action: "introduce_array", name: "nums", values: [3,6] }
    { action: "show_variable", name: "max_val", value: 3 }
    { action: "move_pointer", index: 0, label: "n" }
    { action: "compare", leftVar: "n", leftVal: 3, operator: ">", rightVar: "max_val", rightVal: 3, result: False }
    { action: "clear_comparison" }
    { action: "move_pointer", index: 1, label: "n" }
    { action: "compare", leftVar: "n", leftVal: 6, operator: ">", rightVar: "max_val", rightVal: 3, result: True }
    { action: "show_variable", name: "max_val", value: 6, highlight: True }
    { action: "hide_pointer" }
    { action: "show_result", title: "Maximum Found!", value: 6 }

This creates ONE CONTINUOUS ANIMATION where objects persist and transition smoothly.
"""

import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger("cinematic-transitions")


def extract_value(val):
    """Extract actual value from tracer's {value, type} format."""
    if isinstance(val, dict) and 'value' in val:
        return val['value']
    return val


@dataclass
class Transition:
    """A single transition command."""
    action: str
    # All other fields are optional based on action type
    name: Optional[str] = None
    values: Optional[list] = None
    index: Optional[int] = None
    label: Optional[str] = None
    style: Optional[str] = None
    value: Optional[Any] = None
    highlight: Optional[bool] = None
    leftVar: Optional[str] = None
    leftVal: Optional[Any] = None
    operator: Optional[str] = None
    rightVar: Optional[str] = None
    rightVal: Optional[Any] = None
    result: Optional[bool] = None
    title: Optional[str] = None
    
    def to_dict(self) -> dict:
        # Only include non-None fields
        return {k: v for k, v in asdict(self).items() if v is not None}


class CinematicTransitionGenerator:
    """
    Generates transition commands from tracer execution steps.
    
    This is the BRAIN that watches the code execution and decides:
    - When to introduce the array
    - When to move the pointer
    - When to show comparisons
    - When to update variables
    - When to show the result
    """
    
    def __init__(self):
        self.transitions: List[Transition] = []
        self.code = ""
        self.array_name = None
        self.array_values = []
        self.main_variable = None
        self.loop_variable = None
        self.last_pointer_index = -1
        
    def generate_transitions(self, code: str, tracer_steps: List[Dict]) -> List[Dict]:
        """
        Generate a sequence of transition commands from tracer output.
        This creates ONE CONTINUOUS STORY.
        """
        self.transitions = []
        self.code = code
        self.last_pointer_index = -1
        
        if not tracer_steps:
            return []
        
        # Analyze code structure
        self._analyze_code(code, tracer_steps)
        
        # STEP 1: Introduce the array
        if self.array_name and self.array_values:
            self.transitions.append(Transition(
                action="introduce_array",
                name=self.array_name,
                values=self.array_values
            ))
        
        # Track state
        current_max = None
        last_comparison_shown = False
        
        # STEP 2: Process each execution step
        for i, step in enumerate(tracer_steps):
            new_transitions = self._process_step(i, step, current_max, last_comparison_shown)
            
            # Update current_max if it changed
            if self.main_variable:
                variables = step.get("variables", step.get("locals", {}))
                if self.main_variable in variables:
                    current_max = extract_value(variables[self.main_variable])
            
            # Track if we showed a comparison
            last_comparison_shown = any(t.action == "compare" for t in new_transitions)
            
            self.transitions.extend(new_transitions)
        
        # STEP 3: Final result
        if self.main_variable and current_max is not None:
            # Clear any lingering comparison
            self.transitions.append(Transition(action="clear_comparison"))
            # Hide pointer
            self.transitions.append(Transition(action="hide_pointer"))
            # Show result
            self.transitions.append(Transition(
                action="show_result",
                title=self._get_result_title(),
                value=current_max
            ))
        
        logger.info(f"🎬 Generated {len(self.transitions)} cinematic transitions")
        return [t.to_dict() for t in self.transitions]
    
    def _analyze_code(self, code: str, steps: List[Dict]):
        """Analyze code to understand structure."""
        # Find array
        for step in steps:
            variables = step.get("variables", step.get("locals", {}))
            for name, val in variables.items():
                actual = extract_value(val)
                if isinstance(actual, list) and len(actual) > 0:
                    self.array_name = name
                    self.array_values = actual
                    break
            if self.array_values:
                break
        
        # Find main variable (max_val, min_val, etc.)
        code_lower = code.lower()
        if "max" in code_lower:
            self.main_variable = self._find_var(code, ["max_val", "maximum", "max_value", "result", "max"])
        elif "min" in code_lower:
            self.main_variable = self._find_var(code, ["min_val", "minimum", "min_value", "result", "min"])
        elif "sum" in code_lower:
            self.main_variable = self._find_var(code, ["total", "sum", "result"])
        
        # Find loop variable
        for var in ['n', 'num', 'element', 'item', 'x', 'val', 'i', 'j', 'v']:
            if f"for {var} " in code or f"for {var}," in code:
                self.loop_variable = var
                break
    
    def _find_var(self, code: str, candidates: List[str]) -> Optional[str]:
        """Find which variable name is used in code."""
        for var in candidates:
            if var in code:
                return var
        return candidates[0] if candidates else None
    
    def _get_result_title(self) -> str:
        """Get appropriate result title based on algorithm."""
        code_lower = self.code.lower()
        if "max" in code_lower:
            return "Maximum Found!"
        elif "min" in code_lower:
            return "Minimum Found!"
        elif "sum" in code_lower:
            return "Sum Calculated!"
        return "Result"
    
    def _process_step(self, index: int, step: Dict, current_max: Any, last_had_comparison: bool) -> List[Transition]:
        """Process a single tracer step into transition commands."""
        result = []
        
        code_line = step.get("code", "").strip()
        variables = step.get("variables", step.get("locals", {}))
        changed = step.get("changedVars", step.get("changed_vars", []))
        
        # Skip empty/comment lines
        if not code_line or code_line.startswith("#"):
            return result
        
        # Get current values
        loop_val = extract_value(variables.get(self.loop_variable)) if self.loop_variable else None
        main_val = extract_value(variables.get(self.main_variable)) if self.main_variable else None
        
        # === INITIALIZATION (max_val = nums[0]) ===
        if self.main_variable and self.main_variable in changed and "[0]" in code_line:
            result.append(Transition(
                action="highlight",
                index=0,
                style="active"
            ))
            result.append(Transition(
                action="show_variable",
                name=self.main_variable,
                value=main_val,
                highlight=False
            ))
            return result
        
        # === FOR LOOP START (for n in nums:) ===
        if code_line.startswith("for ") and self.loop_variable:
            # Clear previous comparison if any
            if last_had_comparison:
                result.append(Transition(action="clear_comparison"))
            
            # Find index of current element
            if loop_val is not None and loop_val in self.array_values:
                new_index = self.array_values.index(loop_val)
                
                # Reset previous element highlight
                if self.last_pointer_index >= 0 and self.last_pointer_index != new_index:
                    result.append(Transition(
                        action="reset_element",
                        index=self.last_pointer_index
                    ))
                
                # Move pointer
                result.append(Transition(
                    action="move_pointer",
                    index=new_index,
                    label=self.loop_variable
                ))
                
                # Highlight current element
                result.append(Transition(
                    action="highlight",
                    index=new_index,
                    style="active"
                ))
                
                self.last_pointer_index = new_index
            
            return result
        
        # === COMPARISON (if n > max_val:) ===
        if re.search(r'if\s+\w+\s*[><]=?\s*\w+', code_line):
            match = re.search(r'if\s+(\w+)\s*([><]=?|==)\s*(\w+)', code_line)
            if match:
                left_var = match.group(1)
                operator = match.group(2)
                right_var = match.group(3)
                
                left_val = extract_value(variables.get(left_var))
                right_val = extract_value(variables.get(right_var))
                
                # Determine result
                try:
                    if operator == ">":
                        comp_result = left_val > right_val
                    elif operator == "<":
                        comp_result = left_val < right_val
                    elif operator == ">=":
                        comp_result = left_val >= right_val
                    elif operator == "<=":
                        comp_result = left_val <= right_val
                    elif operator == "==":
                        comp_result = left_val == right_val
                    else:
                        comp_result = False
                except:
                    comp_result = False
                
                # Highlight the element being compared
                if left_val in self.array_values:
                    idx = self.array_values.index(left_val)
                    result.append(Transition(
                        action="highlight",
                        index=idx,
                        style="comparing"
                    ))
                
                result.append(Transition(
                    action="compare",
                    leftVar=left_var,
                    leftVal=left_val,
                    operator=operator,
                    rightVar=right_var,
                    rightVal=right_val,
                    result=comp_result
                ))
            
            return result
        
        # === VARIABLE UPDATE (max_val = n) ===
        if self.main_variable and self.main_variable in changed and "=" in code_line and "==" not in code_line:
            # This means a new max was found
            if loop_val in self.array_values:
                idx = self.array_values.index(loop_val)
                result.append(Transition(
                    action="highlight",
                    index=idx,
                    style="success"
                ))
            
            result.append(Transition(
                action="show_variable",
                name=self.main_variable,
                value=main_val,
                highlight=True
            ))
            
            return result
        
        return result


# Singleton
cinematic_generator = CinematicTransitionGenerator()


def generate_cinematic_transitions(code: str, tracer_steps: List[Dict]) -> List[Dict]:
    """
    Main entry point.
    Generates a list of transition commands that create ONE CONTINUOUS ANIMATION.
    """
    return cinematic_generator.generate_transitions(code, tracer_steps)
