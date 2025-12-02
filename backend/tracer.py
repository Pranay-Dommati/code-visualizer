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
        self.code_structure: Dict[str, Any] = {}  # Stores info about classes/functions
        self.inside_target_function: bool = False
        self.target_function_name: Optional[str] = None
        self.target_class_name: Optional[str] = None
        self.function_start_line: int = 0
        self.function_end_line: int = 0
        
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
            # Skip 'self' - not relevant for algorithm understanding
            if name == 'self':
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
    
    def _analyze_code_structure(self, code: str) -> None:
        """
        Analyze the code to identify classes, functions, and the main algorithm.
        This helps filter out boilerplate like class definitions, object instantiation, etc.
        """
        try:
            tree = ast.parse(code)
            
            for node in ast.walk(tree):
                # Find class definitions
                if isinstance(node, ast.ClassDef):
                    class_name = node.name
                    self.code_structure['class'] = {
                        'name': class_name,
                        'start_line': node.lineno,
                        'end_line': node.end_lineno or node.lineno
                    }
                    
                    # Find methods inside the class
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef):
                            # Skip __init__ and other dunder methods for algorithm focus
                            if not item.name.startswith('__'):
                                self.code_structure['main_function'] = {
                                    'name': item.name,
                                    'class': class_name,
                                    'start_line': item.lineno,
                                    'end_line': item.end_lineno or item.lineno,
                                    'body_start': item.body[0].lineno if item.body else item.lineno
                                }
                                self.target_function_name = item.name
                                self.target_class_name = class_name
                                self.function_start_line = item.body[0].lineno if item.body else item.lineno
                                self.function_end_line = item.end_lineno or item.lineno
                                break
                                
                # Find standalone functions (not in a class)
                elif isinstance(node, ast.FunctionDef) and 'main_function' not in self.code_structure:
                    if not node.name.startswith('_'):  # Skip private functions
                        self.code_structure['main_function'] = {
                            'name': node.name,
                            'class': None,
                            'start_line': node.lineno,
                            'end_line': node.end_lineno or node.lineno,
                            'body_start': node.body[0].lineno if node.body else node.lineno
                        }
                        self.target_function_name = node.name
                        self.function_start_line = node.body[0].lineno if node.body else node.lineno
                        self.function_end_line = node.end_lineno or node.lineno
                        
        except SyntaxError:
            # If parsing fails, we'll trace everything
            pass
    
    def _is_boilerplate_line(self, line_no: int, func_name: str, event: str) -> bool:
        """
        Determine if a line is boilerplate that should be filtered out.
        Boilerplate includes: class definitions, object instantiation, function calls from outside.
        """
        code = self._get_code_line(line_no).strip()
        
        # If no structure analysis, don't filter anything
        if not self.code_structure:
            return False
        
        # Always filter class definition lines
        if code.startswith('class '):
            return True
        
        # Filter function definition lines (def line itself)
        if code.startswith('def '):
            return True
            
        # Filter object instantiation lines (e.g., _solution = Solution())
        if '= ' in code and '()' in code:
            # Check if it's creating an instance of our class
            if self.target_class_name and self.target_class_name + '()' in code:
                return True
                
        # Filter result assignment lines that call the function
        if self.target_function_name and f'.{self.target_function_name}(' in code:
            return True
            
        # Filter print statements that just show results
        if code.startswith('print(') and '_result' in code:
            return True
            
        # Filter call/return events for class definitions
        if event in ('call', 'return') and func_name == self.target_class_name:
            return True
            
        # Filter module-level code that's not inside our target function
        if self.target_function_name:
            # Check if this line is inside the target function
            main_func = self.code_structure.get('main_function', {})
            func_start = main_func.get('body_start', 0)
            func_end = main_func.get('end_line', 0)
            
            # If we're in the module level and outside the function body
            if func_name == '<module>' and not (func_start <= line_no <= func_end):
                return True
                
        return False
    
    def _should_include_frame(self, line_no: int, func_name: str, event: str) -> bool:
        """
        Determine if this frame should be included in the output.
        We want to focus on the actual algorithm logic.
        """
        # Filter out boilerplate
        if self._is_boilerplate_line(line_no, func_name, event):
            return False
            
        # Include everything inside the target function
        if self.target_function_name and func_name == self.target_function_name:
            # Skip call/return events, just show the actual line executions
            if event in ('call', 'return'):
                return False
            return True
            
        # For scripts without functions/classes, include everything
        if not self.target_function_name:
            return True
            
        return False
    
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
        
        # Check if we should include this frame (filter boilerplate)
        if not self._should_include_frame(line_no, func_name, event):
            return self._trace_callback
        
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
            
        elif event == 'exception':
            # Track exceptions - these are always important
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
        self.code_structure = {}
        self.inside_target_function = False
        self.target_function_name = None
        self.target_class_name = None
        self.function_start_line = 0
        self.function_end_line = 0
        
        # Store source lines for reference
        self.source_lines = code.split('\n')
        
        # Analyze code structure to identify the main algorithm
        self._analyze_code_structure(code)
        
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
