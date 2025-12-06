"""
Visual Scene Generator
======================

SIMPLIFIED approach that mirrors the left panel's success.
Instead of complex re-interpretation, we:
1. Use the tracer step data DIRECTLY
2. Generate visual scenes based on what's ACTUALLY happening
3. Keep the array visible and overlay effects

The left panel works because it shows EXACTLY what the tracer captures.
We do the same for visuals.
"""

import json
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger("visual-scene")


def extract_value(val):
    """Extract actual value from tracer's {value, type} format."""
    if isinstance(val, dict) and 'value' in val:
        return val['value']
    return val


@dataclass
class VisualStep:
    """A visual step that mirrors the tracer step structure."""
    step_number: int
    line_number: int
    code: str
    
    # Visual scene
    scene_type: str  # 'overview', 'array_highlight', 'comparison', 'update', 'result'
    
    # Scene data - uses actual tracer values
    array_name: str
    array_values: list
    highlight_indices: List[int]
    highlight_colors: List[str]
    
    # Variables to display
    variables: Dict[str, Any]
    changed_vars: List[str]
    
    # For comparisons
    comparison: Optional[Dict] = None  # {left, operator, right, result}
    
    # Speech/explanation
    speech: str = ""
    
    def to_dict(self):
        return asdict(self)


class VisualSceneGenerator:
    """
    Generates visual scenes directly from tracer steps.
    Mirrors the left panel approach - use the data as-is.
    """
    
    def __init__(self):
        self.steps: List[VisualStep] = []
        self.array_name = None
        self.array_values = []
        self.code = ""
        
    def generate_from_tracer_steps(self, code: str, tracer_steps: List[Dict]) -> List[VisualStep]:
        """
        Generate visual steps from raw tracer output.
        This is the SAME data the left panel uses successfully.
        """
        self.code = code
        self.steps = []
        
        if not tracer_steps:
            return self.steps
        
        # First pass: find arrays
        self._find_arrays(tracer_steps)
        
        # Generate overview
        self.steps.append(self._create_overview())
        
        # Generate step-by-step visuals
        for i, step in enumerate(tracer_steps):
            visual_step = self._process_step(i, step)
            if visual_step:
                self.steps.append(visual_step)
        
        # Add conclusion
        self.steps.append(self._create_conclusion(tracer_steps))
        
        logger.info(f"Generated {len(self.steps)} visual steps")
        return self.steps
    
    def _find_arrays(self, steps: List[Dict]):
        """Find the main array from tracer steps."""
        for step in steps:
            variables = step.get("variables", step.get("locals", {}))
            for name, val in variables.items():
                actual = extract_value(val)
                if isinstance(actual, list) and len(actual) > 0:
                    self.array_name = name
                    self.array_values = actual
                    return
    
    def _create_overview(self) -> VisualStep:
        """Create initial overview scene."""
        # Detect purpose from code
        code_lower = self.code.lower()
        if "max" in code_lower:
            speech = f"Let's find the maximum value in {self.array_name} = {self.array_values}"
            title = "Finding Maximum"
        elif "min" in code_lower:
            speech = f"Let's find the minimum value in {self.array_name} = {self.array_values}"
            title = "Finding Minimum"
        elif "sum" in code_lower:
            speech = f"Let's calculate the sum of {self.array_name} = {self.array_values}"
            title = "Calculating Sum"
        elif "sort" in code_lower:
            speech = f"Let's sort {self.array_name} = {self.array_values}"
            title = "Sorting Array"
        else:
            speech = f"Let's trace through the code with {self.array_name} = {self.array_values}"
            title = "Code Walkthrough"
        
        return VisualStep(
            step_number=0,
            line_number=0,
            code="",
            scene_type="overview",
            array_name=self.array_name or "array",
            array_values=self.array_values,
            highlight_indices=[],
            highlight_colors=[],
            variables={},
            changed_vars=[],
            comparison=None,
            speech=speech
        )
    
    def _process_step(self, index: int, step: Dict) -> Optional[VisualStep]:
        """Process a single tracer step into a visual step."""
        line_num = step.get("lineNumber", step.get("line", 0))
        code_line = step.get("code", "").strip()
        variables = step.get("variables", step.get("locals", {}))
        changed = step.get("changedVars", step.get("changed_vars", []))
        
        # Skip empty or comment lines
        if not code_line or code_line.startswith("#"):
            return None
        
        # Extract actual values
        clean_vars = {}
        for name, val in variables.items():
            clean_vars[name] = extract_value(val)
        
        # Determine scene type and highlights based on code
        scene_type = "array_highlight"
        highlights = []
        colors = []
        comparison = None
        speech = step.get("explanation", "")
        
        # === INITIALIZATION (variable = array[0] or variable = value) ===
        if "=" in code_line and "==" not in code_line and "[0]" in code_line:
            scene_type = "initialization"
            highlights = [0]
            colors = ["yellow"]
            
            # Extract what's being initialized
            var_match = re.match(r'(\w+)\s*=', code_line)
            if var_match:
                var_name = var_match.group(1)
                var_value = clean_vars.get(var_name, "?")
                speech = speech or f"Initialize {var_name} = {var_value} (first element)"
        
        # === FOR LOOP (for n in nums) ===
        elif code_line.startswith("for "):
            scene_type = "iteration"
            # Find loop variable and its current value
            loop_match = re.match(r'for\s+(\w+)\s+in\s+(\w+)', code_line)
            if loop_match:
                loop_var = loop_match.group(1)
                loop_val = clean_vars.get(loop_var)
                if loop_val is not None and loop_val in self.array_values:
                    idx = self.array_values.index(loop_val)
                    highlights = [idx]
                    colors = ["blue"]
                    speech = speech or f"Now checking element {loop_var} = {loop_val} at index {idx}"
        
        # === COMPARISON (if n > max_val, n < min_val, etc.) ===
        elif re.search(r'if\s+\w+\s*[><]=?\s*\w+', code_line):
            scene_type = "comparison"
            # Parse comparison
            comp_match = re.search(r'if\s+(\w+)\s*([><]=?|==)\s*(\w+)', code_line)
            if comp_match:
                left_var = comp_match.group(1)
                operator = comp_match.group(2)
                right_var = comp_match.group(3)
                
                left_val = clean_vars.get(left_var)
                right_val = clean_vars.get(right_var)
                
                # Determine result
                try:
                    if operator == ">":
                        result = left_val > right_val
                    elif operator == "<":
                        result = left_val < right_val
                    elif operator == ">=":
                        result = left_val >= right_val
                    elif operator == "<=":
                        result = left_val <= right_val
                    elif operator == "==":
                        result = left_val == right_val
                    else:
                        result = None
                except:
                    result = None
                
                comparison = {
                    "left_var": left_var,
                    "left_val": left_val,
                    "operator": operator,
                    "right_var": right_var,
                    "right_val": right_val,
                    "result": result
                }
                
                # Highlight the element being compared
                if left_val in self.array_values:
                    highlights = [self.array_values.index(left_val)]
                    colors = ["comparing"]
                
                speech = speech or f"Comparing {left_var}={left_val} {operator} {right_var}={right_val} → {result}"
        
        # === ASSIGNMENT (max_val = n, etc.) ===
        elif "=" in code_line and "==" not in code_line and changed:
            scene_type = "update"
            # Find what changed and highlight it
            for var_name in changed:
                var_val = clean_vars.get(var_name)
                if var_val in self.array_values:
                    highlights = [self.array_values.index(var_val)]
                    colors = ["success"]
                    speech = speech or f"Updated {var_name} = {var_val}"
                    break
        
        # === RETURN ===
        elif "return" in code_line.lower():
            scene_type = "result"
            # Find what's being returned
            ret_match = re.search(r'return\s+(\w+)', code_line)
            if ret_match:
                ret_var = ret_match.group(1)
                ret_val = clean_vars.get(ret_var)
                if ret_val in self.array_values:
                    highlights = [self.array_values.index(ret_val)]
                    colors = ["result"]
                speech = speech or f"Returning {ret_var} = {ret_val}"
        
        return VisualStep(
            step_number=index + 1,
            line_number=line_num,
            code=code_line,
            scene_type=scene_type,
            array_name=self.array_name or "array",
            array_values=self.array_values,
            highlight_indices=highlights,
            highlight_colors=colors,
            variables=clean_vars,
            changed_vars=changed,
            comparison=comparison,
            speech=speech
        )
    
    def _create_conclusion(self, steps: List[Dict]) -> VisualStep:
        """Create conclusion scene."""
        # Find final values
        final_vars = {}
        if steps:
            last_step = steps[-1]
            variables = last_step.get("variables", last_step.get("locals", {}))
            for name, val in variables.items():
                final_vars[name] = extract_value(val)
        
        # Find result variable
        result_var = None
        result_val = None
        code_lower = self.code.lower()
        
        if "max" in code_lower:
            for var in ["max_val", "maximum", "max_value", "result"]:
                if var in final_vars:
                    result_var = var
                    result_val = final_vars[var]
                    break
        elif "min" in code_lower:
            for var in ["min_val", "minimum", "min_value", "result"]:
                if var in final_vars:
                    result_var = var
                    result_val = final_vars[var]
                    break
        elif "sum" in code_lower:
            for var in ["total", "sum", "result"]:
                if var in final_vars:
                    result_var = var
                    result_val = final_vars[var]
                    break
        
        # Highlight result in array
        highlights = []
        colors = []
        if result_val is not None and result_val in self.array_values:
            highlights = [self.array_values.index(result_val)]
            colors = ["result"]
        
        speech = f"Done! Result: {result_var} = {result_val}" if result_var else "Execution complete!"
        
        return VisualStep(
            step_number=len(steps) + 1,
            line_number=0,
            code="",
            scene_type="result",
            array_name=self.array_name or "array",
            array_values=self.array_values,
            highlight_indices=highlights,
            highlight_colors=colors,
            variables=final_vars,
            changed_vars=[],
            comparison=None,
            speech=speech
        )
    
    def get_steps(self) -> List[Dict]:
        """Get all steps as dicts."""
        return [s.to_dict() for s in self.steps]


# Singleton
visual_scene_generator = VisualSceneGenerator()


def generate_visual_timeline(code: str, tracer_steps: List[Dict]) -> List[Dict]:
    """
    Main entry point - generate visual timeline from tracer steps.
    Uses the SAME data that the left panel displays successfully.
    """
    visual_scene_generator.generate_from_tracer_steps(code, tracer_steps)
    return visual_scene_generator.get_steps()
