"""
Semantic Scene Engine
=====================

This replaces the old timeline engine with SEMANTIC scene commands.
AI is the DIRECTOR - it decides WHAT to show.
The frontend rendering engine is the ARTIST - it decides HOW to show it.

NO pixel coordinates. NO x,y values. ONLY semantic instructions.
"""

import json
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger("scene-engine")


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


# Scene Types - matches frontend SceneTypes.js
class SceneType:
    ALGORITHM_OVERVIEW = 'algorithm_overview'
    ARRAY_VIEW = 'array_view'
    VARIABLE_UPDATE = 'variable_update'
    COMPARISON = 'comparison'
    SWAP = 'swap'
    POINTER_MOVE = 'pointer_move'
    LOOP_ITERATION = 'loop_iteration'
    FUNCTION_CALL = 'function_call'
    RESULT = 'result'
    CLEAR = 'clear'


@dataclass
class TeachingStep:
    """A single synchronized step in the teaching timeline."""
    step_number: int
    phase: str  # 'overview', 'initialization', 'iteration', 'comparison', 'update', 'result'
    
    # What to say
    speech_script: str
    
    # SEMANTIC scene command (NO pixel coords)
    scene: Dict[str, Any]
    
    # State
    variables: Dict[str, Any]
    current_line: int
    
    # Metadata
    description: str
    duration_hint: float
    
    def to_dict(self) -> dict:
        return asdict(self)


class SemanticSceneEngine:
    """
    Generates semantic scene commands from code execution.
    
    The key difference from the old system:
    - OLD: {"action": "draw_array", "x": 100, "y": 50, ...}
    - NEW: {"type": "array_view", "arrayName": "nums", "values": [3,5], "highlights": [...]}
    
    The frontend rendering engine handles all layout and positioning.
    """
    
    def __init__(self):
        self.timeline: List[TeachingStep] = []
        self.current_index: int = 0
        self.code: str = ""
        self.execution_steps: List[Dict] = []
        self.analysis: Dict = {}
        
    def generate_timeline(self, code: str, execution_steps: List[Dict]) -> List[TeachingStep]:
        """
        Generate teaching timeline with semantic scene commands.
        """
        self.code = code
        self.execution_steps = execution_steps
        self.timeline = []
        self.current_index = 0
        
        if not execution_steps:
            return self.timeline
        
        # Analyze code
        self.analysis = self._analyze_code(code, execution_steps)
        
        # Step 0: Overview
        self.timeline.append(self._create_overview_step())
        
        # Generate execution steps
        prev_index = -1
        for i, step in enumerate(execution_steps):
            teaching_step = self._create_execution_step(i, step, prev_index)
            if teaching_step:
                self.timeline.append(teaching_step)
                # Track for animation
                if 'highlights' in teaching_step.scene:
                    highlights = teaching_step.scene.get('highlights', [])
                    if highlights:
                        prev_index = highlights[0].get('index', -1)
        
        # Final: Conclusion
        self.timeline.append(self._create_conclusion_step())
        
        logger.info(f"📋 Generated {len(self.timeline)} semantic teaching steps")
        return self.timeline
    
    def _analyze_code(self, code: str, steps: List[Dict]) -> Dict[str, Any]:
        """Analyze code structure."""
        analysis = {
            "has_loop": "for " in code or "while " in code,
            "loop_type": "for" if "for " in code else ("while" if "while " in code else None),
            "main_variable": None,
            "array_name": None,
            "array_values": [],
            "purpose": "unknown",
            "final_result": None,
            "loop_var": None,
        }
        
        # Find arrays
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
        
        # Detect purpose
        code_lower = code.lower()
        if "max" in code_lower:
            analysis["purpose"] = "find_maximum"
            analysis["main_variable"] = self._find_var_in_code(code, ["max_val", "maximum", "max_value", "result"])
        elif "min" in code_lower:
            analysis["purpose"] = "find_minimum"
            analysis["main_variable"] = self._find_var_in_code(code, ["min_val", "minimum", "min_value", "result"])
        elif "sum" in code_lower:
            analysis["purpose"] = "calculate_sum"
            analysis["main_variable"] = self._find_var_in_code(code, ["total", "sum", "result"])
        elif "sort" in code_lower:
            analysis["purpose"] = "sorting"
        elif "search" in code_lower or "find" in code_lower:
            analysis["purpose"] = "searching"
        
        # Loop variable
        for var in ['n', 'num', 'element', 'item', 'x', 'val', 'i', 'j']:
            if f"for {var} " in code or f"for {var}," in code:
                analysis["loop_var"] = var
                break
        
        # Final result
        if steps and analysis["main_variable"]:
            last_vars = steps[-1].get("variables", steps[-1].get("locals", {}))
            if analysis["main_variable"] in last_vars:
                analysis["final_result"] = extract_value(last_vars[analysis["main_variable"]])
        
        return analysis
    
    def _find_var_in_code(self, code: str, candidates: List[str]) -> Optional[str]:
        """Find which variable name is used in code."""
        for var in candidates:
            if var in code:
                return var
        return candidates[0] if candidates else None
    
    def _create_overview_step(self) -> TeachingStep:
        """Create overview with semantic scene."""
        array_name = self.analysis.get("array_name", "nums")
        array_values = self.analysis.get("array_values", [])
        purpose = self.analysis.get("purpose", "unknown")
        
        # Purpose-based speech
        speeches = {
            "find_maximum": f"Let's find the maximum value. We have {len(array_values)} elements: {format_value(array_values)}.",
            "find_minimum": f"Let's find the minimum value in {len(array_values)} elements.",
            "calculate_sum": f"Let's calculate the sum of {len(array_values)} elements.",
            "sorting": f"Let's sort these {len(array_values)} elements.",
            "searching": f"Let's search through {len(array_values)} elements.",
            "unknown": f"Let's trace through the code. Array has {len(array_values)} elements: {format_value(array_values)}.",
        }
        
        titles = {
            "find_maximum": "Finding Maximum Value",
            "find_minimum": "Finding Minimum Value",
            "calculate_sum": "Calculating Sum",
            "sorting": "Sorting Algorithm",
            "searching": "Searching Algorithm",
            "unknown": "Algorithm Walkthrough",
        }
        
        # SEMANTIC scene command - NO coordinates!
        scene = {
            "type": SceneType.ALGORITHM_OVERVIEW,
            "title": titles.get(purpose, titles["unknown"]),
            "arrays": [
                {"name": array_name, "values": array_values}
            ],
            "variables": {},
        }
        
        return TeachingStep(
            step_number=0,
            phase="overview",
            speech_script=speeches.get(purpose, speeches["unknown"]),
            scene=scene,
            variables={},
            current_line=0,
            description="Algorithm overview",
            duration_hint=4.0
        )
    
    def _create_execution_step(self, index: int, step: Dict, prev_index: int) -> Optional[TeachingStep]:
        """Create a step with semantic scene."""
        line_num = step.get("line", step.get("lineNumber", 0))
        code_line = step.get("code", "")
        variables = step.get("variables", step.get("locals", {}))
        changed_vars = step.get("changed_vars", step.get("changedVars", []))
        
        array_name = self.analysis.get("array_name", "nums")
        array_values = self.analysis.get("array_values", [])
        main_var = self.analysis.get("main_variable")
        loop_var = self.analysis.get("loop_var")
        
        # Extract current position
        current_element = None
        current_index = None
        
        if loop_var and loop_var in variables:
            current_element = extract_value(variables[loop_var])
            if current_element in array_values:
                current_index = array_values.index(current_element)
        
        main_val = extract_value(variables.get(main_var)) if main_var else None
        
        # Determine scene based on what's happening
        phase = "iteration"
        speech = ""
        scene = {"type": SceneType.ARRAY_VIEW}
        
        # === INITIALIZATION ===
        if main_var and main_var in changed_vars and ("[0]" in code_line or index == 0):
            phase = "initialization"
            speech = f"We start by setting {main_var} to {main_val}, the first element."
            
            scene = {
                "type": SceneType.ARRAY_VIEW,
                "arrayName": array_name,
                "values": array_values,
                "highlights": [{"index": 0, "color": "yellow", "label": f"{main_var}={main_val}"}],
                "pointers": [],
            }
        
        # === LOOP START ===
        elif "for " in code_line and current_index is not None:
            phase = "iteration"
            speech = f"Looking at element {current_element} at index {current_index}."
            
            scene = {
                "type": SceneType.ARRAY_VIEW,
                "arrayName": array_name,
                "values": array_values,
                "highlights": [{"index": current_index, "color": "blue", "label": "current"}],
                "pointers": [{"name": loop_var, "index": current_index}],
            }
        
        # === COMPARISON ===
        elif ">" in code_line or "<" in code_line or "==" in code_line:
            phase = "comparison"
            
            if current_element is not None and main_val is not None:
                operator = ">" if ">" in code_line else ("<" if "<" in code_line else "==")
                
                # Evaluate result
                try:
                    if operator == ">":
                        result = current_element > main_val
                    elif operator == "<":
                        result = current_element < main_val
                    else:
                        result = current_element == main_val
                except:
                    result = None
                
                if result:
                    speech = f"{current_element} is {'greater' if operator == '>' else 'less'} than {main_val}. Updating!"
                else:
                    speech = f"{current_element} is not {'greater' if operator == '>' else 'less'} than {main_val}. Skipping."
                
                scene = {
                    "type": SceneType.COMPARISON,
                    "left": {
                        "source": "array",
                        "name": array_name,
                        "index": current_index,
                        "value": current_element,
                    },
                    "right": {
                        "source": "variable",
                        "name": main_var,
                        "value": main_val,
                    },
                    "operator": operator,
                    "result": result,
                }
            else:
                speech = f"Checking condition."
                scene = {"type": SceneType.ARRAY_VIEW, "arrayName": array_name, "values": array_values}
        
        # === VARIABLE UPDATE ===
        elif "=" in code_line and main_var and main_var in changed_vars:
            phase = "update"
            speech = f"Updating {main_var} to {main_val}!"
            
            scene = {
                "type": SceneType.VARIABLE_UPDATE,
                "name": main_var,
                "oldValue": prev_index,  # Could track old value better
                "newValue": main_val,
                "operation": "assign",
            }
        
        # === RETURN ===
        elif "return" in code_line.lower():
            return None  # Conclusion handles this
        
        # === GENERIC ===
        else:
            if not code_line.strip() or code_line.strip().startswith('#'):
                return None
            speech = f"Executing: {code_line.strip()}"
            scene = {
                "type": SceneType.ARRAY_VIEW,
                "arrayName": array_name,
                "values": array_values,
                "highlights": [{"index": current_index, "color": "blue"}] if current_index is not None else [],
                "pointers": [{"name": loop_var, "index": current_index}] if loop_var and current_index is not None else [],
            }
        
        if not speech:
            return None
        
        return TeachingStep(
            step_number=index + 1,
            phase=phase,
            speech_script=speech,
            scene=scene,
            variables={k: extract_value(v) for k, v in variables.items()},
            current_line=line_num,
            description=f"Line {line_num}: {code_line.strip()[:40]}",
            duration_hint=3.0
        )
    
    def _create_conclusion_step(self) -> TeachingStep:
        """Create conclusion with semantic scene."""
        purpose = self.analysis.get("purpose", "unknown")
        main_var = self.analysis.get("main_variable")
        final_result = self.analysis.get("final_result")
        array_values = self.analysis.get("array_values", [])
        
        # Purpose-based conclusion
        if purpose == "find_maximum" and final_result is not None:
            speech = f"Done! The maximum value is {final_result}!"
            result_index = array_values.index(final_result) if final_result in array_values else -1
        elif purpose == "find_minimum" and final_result is not None:
            speech = f"Done! The minimum value is {final_result}!"
            result_index = array_values.index(final_result) if final_result in array_values else -1
        elif purpose == "calculate_sum" and final_result is not None:
            speech = f"Done! The sum is {final_result}!"
            result_index = -1
        else:
            speech = f"Execution complete!"
            result_index = -1
        
        scene = {
            "type": SceneType.RESULT,
            "title": "Result Found!",
            "value": final_result,
            "success": True,
        }
        
        return TeachingStep(
            step_number=len(self.timeline),
            phase="result",
            speech_script=speech,
            scene=scene,
            variables={main_var: final_result} if main_var else {},
            current_line=0,
            description="Algorithm complete",
            duration_hint=3.0
        )
    
    # Navigation methods
    def get_current_step(self) -> Optional[TeachingStep]:
        if 0 <= self.current_index < len(self.timeline):
            return self.timeline[self.current_index]
        return None
    
    def next_step(self) -> Optional[TeachingStep]:
        if self.current_index < len(self.timeline) - 1:
            self.current_index += 1
            return self.get_current_step()
        return None
    
    def previous_step(self) -> Optional[TeachingStep]:
        if self.current_index > 0:
            self.current_index -= 1
            return self.get_current_step()
        return None
    
    def go_to_step(self, index: int) -> Optional[TeachingStep]:
        if 0 <= index < len(self.timeline):
            self.current_index = index
            return self.get_current_step()
        return None
    
    def get_all_steps(self) -> List[Dict]:
        return [step.to_dict() for step in self.timeline]
    
    def total_steps(self) -> int:
        return len(self.timeline)


# Singleton instance
scene_engine = SemanticSceneEngine()
