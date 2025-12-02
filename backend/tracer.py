"""
Python Code Tracer Engine
==========================
Uses sys.settrace to capture line-by-line execution of Python code.
This is the "camera" that records every frame of code execution.

Each trace frame captures:
- Line number being executed
- Local variables at that moment
- The actual code snippet
- Step number in execution sequence
"""

import sys
import copy
import ast
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
import json


@dataclass
class TraceFrame:
    """Represents a single step/frame in code execution."""
    step: int
    line: int
    code: str
    event: str  # 'line', 'call', 'return', 'exception'
    locals: Dict[str, Any]
    changed_vars: List[str]  # Variables that changed in this step
    function_name: Optional[str] = None
    return_value: Optional[Any] = None
    explanation: Optional[str] = None
    
    def to_dict(self) -> dict:
        return asdict(self)


class PythonTracer:
    """
    Core tracing engine that hooks into Python's execution.
    
    Usage:
        tracer = PythonTracer()
        frames = tracer.trace(code_string)
    """
    
    # Safe types that can be serialized to JSON
    SAFE_TYPES = (int, float, str, bool, list, tuple, dict, set, type(None))
    
    # Maximum steps to prevent infinite loops
    MAX_STEPS = 1000
    
    # Maximum string length for display
    MAX_STR_LENGTH = 100
    
    def __init__(self):
        self.frames: List[TraceFrame] = []
        self.step_count: int = 0
        self.source_lines: List[str] = []
        self.previous_locals: Dict[str, Any] = {}
        self.active: bool = False
        self.error: Optional[str] = None
        
    def _safe_copy(self, value: Any) -> Any:
        """
        Create a JSON-serializable copy of a value.
        Handles complex objects by converting to string representation.
        """
        if value is None:
            return None
        
        if isinstance(value, (int, float, bool)):
            return value
            
        if isinstance(value, str):
            if len(value) > self.MAX_STR_LENGTH:
                return value[:self.MAX_STR_LENGTH] + "..."
            return value
            
        if isinstance(value, (list, tuple)):
            return [self._safe_copy(item) for item in value[:50]]  # Limit list size
            
        if isinstance(value, dict):
            return {
                str(k): self._safe_copy(v) 
                for k, v in list(value.items())[:20]  # Limit dict size
            }
            
        if isinstance(value, set):
            return list(value)[:50]
            
        # For other objects, return string representation
        try:
            repr_str = repr(value)
            if len(repr_str) > self.MAX_STR_LENGTH:
                return repr_str[:self.MAX_STR_LENGTH] + "..."
            return repr_str
        except:
            return "<unrepresentable>"
    
    def _get_variable_type(self, value: Any) -> str:
        """Get a friendly type name for a value."""
        if value is None:
            return "NoneType"
        return type(value).__name__
    
    def _serialize_locals(self, local_vars: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """
        Serialize local variables with their values and types.
        Filters out internal/private variables.
        """
        result = {}
        for name, value in local_vars.items():
            # Skip private/internal variables
            if name.startswith('_') or name.startswith('@'):
                continue
            # Skip modules and functions
            if callable(value) or str(type(value)).startswith("<class 'module"):
                continue
                
            result[name] = {
                "value": self._safe_copy(value),
                "type": self._get_variable_type(value)
            }
        return result
    
    def _detect_changed_vars(self, current_locals: Dict[str, Any]) -> List[str]:
        """Detect which variables changed since the last step."""
        changed = []
        
        serialized_current = self._serialize_locals(current_locals)
        
        for name, data in serialized_current.items():
            if name not in self.previous_locals:
                # New variable
                changed.append(name)
            elif self.previous_locals[name] != data:
                # Value changed
                changed.append(name)
                
        self.previous_locals = copy.deepcopy(serialized_current)
        return changed
    
    def _get_code_line(self, line_no: int) -> str:
        """Get the source code at a specific line number."""
        if 0 < line_no <= len(self.source_lines):
            return self.source_lines[line_no - 1].rstrip()
        return ""
    
    def _generate_explanation(self, frame: TraceFrame) -> str:
        """
        Generate a beginner-friendly explanation of what's happening.
        This will be enhanced later with AI narration.
        """
        code = frame.code.strip()
        changed = frame.changed_vars
        locals_data = frame.locals
        
        # Basic explanations based on code patterns
        if '=' in code and '==' not in code and '!=' not in code:
            if changed:
                var = changed[0]
                if var in locals_data:
                    val = locals_data[var]['value']
                    return f"Assigning value {val} to variable '{var}'"
        
        if code.startswith('for '):
            return "Starting a loop iteration"
            
        if code.startswith('while '):
            return "Checking loop condition"
            
        if code.startswith('if '):
            return "Evaluating condition"
            
        if code.startswith('elif '):
            return "Checking alternative condition"
            
        if code.startswith('else:'):
            return "Executing else branch"
            
        if code.startswith('return '):
            return f"Returning value from function"
            
        if code.startswith('print('):
            return "Printing output to console"
            
        if code.startswith('def '):
            return "Defining a function"
            
        if frame.event == 'call':
            return f"Calling function '{frame.function_name}'"
            
        if frame.event == 'return':
            return f"Returning from function '{frame.function_name}'"
        
        return "Executing this line"
    
    def _trace_callback(self, frame, event, arg):
        """
        The callback function that Python calls for each execution event.
        This is the core of sys.settrace functionality.
        """
        # Check if we've exceeded max steps (prevent infinite loops)
        if self.step_count >= self.MAX_STEPS:
            self.error = f"Execution stopped: exceeded {self.MAX_STEPS} steps (possible infinite loop)"
            return None
            
        # Only trace events in user code (not in builtins)
        code_filename = frame.f_code.co_filename
        if code_filename != '<user_code>':
            return self._trace_callback
        
        # Get line number and function name
        line_no = frame.f_lineno
        func_name = frame.f_code.co_name
        
        # Handle different event types
        if event == 'line':
            self.step_count += 1
            
            # Get current local variables
            current_locals = dict(frame.f_locals)
            serialized_locals = self._serialize_locals(current_locals)
            changed_vars = self._detect_changed_vars(current_locals)
            
            # Create trace frame
            trace_frame = TraceFrame(
                step=self.step_count,
                line=line_no,
                code=self._get_code_line(line_no),
                event=event,
                locals=serialized_locals,
                changed_vars=changed_vars,
                function_name=func_name if func_name != '<module>' else None
            )
            
            # Add explanation
            trace_frame.explanation = self._generate_explanation(trace_frame)
            
            self.frames.append(trace_frame)
            
        elif event == 'call':
            # Track function calls
            if func_name != '<module>':
                self.step_count += 1
                trace_frame = TraceFrame(
                    step=self.step_count,
                    line=line_no,
                    code=self._get_code_line(line_no),
                    event=event,
                    locals={},
                    changed_vars=[],
                    function_name=func_name
                )
                trace_frame.explanation = f"Entering function '{func_name}'"
                self.frames.append(trace_frame)
                
        elif event == 'return':
            # Track function returns
            if func_name != '<module>':
                self.step_count += 1
                trace_frame = TraceFrame(
                    step=self.step_count,
                    line=line_no,
                    code=self._get_code_line(line_no),
                    event=event,
                    locals=self._serialize_locals(frame.f_locals),
                    changed_vars=[],
                    function_name=func_name,
                    return_value=self._safe_copy(arg)
                )
                trace_frame.explanation = f"Returning from '{func_name}' with value: {self._safe_copy(arg)}"
                self.frames.append(trace_frame)
                
        elif event == 'exception':
            # Track exceptions
            self.step_count += 1
            exc_type, exc_value, _ = arg
            trace_frame = TraceFrame(
                step=self.step_count,
                line=line_no,
                code=self._get_code_line(line_no),
                event=event,
                locals=self._serialize_locals(frame.f_locals),
                changed_vars=[],
                function_name=func_name
            )
            trace_frame.explanation = f"Exception: {exc_type.__name__}: {exc_value}"
            self.frames.append(trace_frame)
        
        return self._trace_callback
    
    def trace(self, code: str, input_values: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Execute and trace the given Python code.
        
        Args:
            code: The Python source code to trace
            input_values: Optional list of values to provide for input() calls
            
        Returns:
            Dictionary containing:
            - success: bool
            - frames: List of trace frames
            - output: Captured stdout
            - error: Error message if any
        """
        # Reset state
        self.frames = []
        self.step_count = 0
        self.previous_locals = {}
        self.error = None
        
        # Store source lines for reference
        self.source_lines = code.split('\n')
        
        # Import sandbox for safe execution
        from sandbox import create_sandbox, capture_output
        
        # Create safe execution environment
        sandbox_globals, sandbox_locals = create_sandbox(input_values)
        
        # Capture stdout
        output_capture = capture_output()
        
        result = {
            "success": False,
            "frames": [],
            "output": "",
            "error": None,
            "source_lines": self.source_lines
        }
        
        try:
            # Compile the code
            compiled_code = compile(code, '<user_code>', 'exec')
            
            # Start capturing output
            with output_capture as captured:
                # Enable tracing
                sys.settrace(self._trace_callback)
                
                try:
                    # Execute the code - use sandbox_globals for both globals and locals
                    # This ensures imports and class definitions are accessible
                    exec(compiled_code, sandbox_globals, sandbox_globals)
                finally:
                    # Always disable tracing
                    sys.settrace(None)
            
            # Get captured output
            result["output"] = captured.getvalue()
            result["success"] = True
            result["frames"] = [frame.to_dict() for frame in self.frames]
            
            if self.error:
                result["error"] = self.error
                
        except SyntaxError as e:
            result["error"] = f"Syntax Error at line {e.lineno}: {e.msg}"
            result["frames"] = [frame.to_dict() for frame in self.frames]
            
        except Exception as e:
            result["error"] = f"{type(e).__name__}: {str(e)}"
            result["frames"] = [frame.to_dict() for frame in self.frames]
            result["success"] = len(self.frames) > 0  # Partial success if we got some frames
            
        return result


def trace_code(code: str, input_values: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Convenience function to trace Python code.
    
    Args:
        code: Python source code string
        input_values: Optional list of input values for input() calls
        
    Returns:
        Trace result dictionary
    """
    tracer = PythonTracer()
    return tracer.trace(code, input_values)


# For testing
if __name__ == "__main__":
    test_code = """
x = 5
y = 10
z = x + y
for i in range(3):
    z = z + i
print(z)
"""
    
    result = trace_code(test_code)
    print(json.dumps(result, indent=2))
