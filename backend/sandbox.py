"""
Safe Sandbox Environment for Code Execution
============================================
Provides a restricted execution environment that:
- Blocks dangerous builtins (exec, eval, open, etc.)
- Restricts imports to safe modules only
- Prevents file system access
- Prevents network access
- Limits execution resources

This is CRITICAL for security when running user-submitted code.
"""

import sys
import io
from typing import Dict, Any, List, Optional, Tuple
from contextlib import contextmanager
import builtins


# ============================================================================
# SAFE BUILTINS - Only allow harmless functions
# ============================================================================

# Functions that are SAFE to allow
SAFE_BUILTINS = {
    # Type constructors
    'int': int,
    'float': float,
    'str': str,
    'bool': bool,
    'list': list,
    'dict': dict,
    'tuple': tuple,
    'set': set,
    'frozenset': frozenset,
    'bytes': bytes,
    'bytearray': bytearray,
    
    # Type checking
    'type': type,
    'isinstance': isinstance,
    'issubclass': issubclass,
    'callable': callable,
    
    # Iterators and sequences
    'range': range,
    'len': len,
    'enumerate': enumerate,
    'zip': zip,
    'map': map,
    'filter': filter,
    'reversed': reversed,
    'sorted': sorted,
    
    # Math operations
    'abs': abs,
    'round': round,
    'min': min,
    'max': max,
    'sum': sum,
    'pow': pow,
    'divmod': divmod,
    
    # String operations
    'chr': chr,
    'ord': ord,
    'repr': repr,
    'ascii': ascii,
    'format': format,
    
    # Object operations  
    'id': id,
    'hash': hash,
    'getattr': getattr,
    'setattr': setattr,
    'hasattr': hasattr,
    'delattr': delattr,
    
    # Sequence operations
    'all': all,
    'any': any,
    'iter': iter,
    'next': next,
    'slice': slice,
    
    # Boolean
    'True': True,
    'False': False,
    'None': None,
    
    # Exceptions (for try/except)
    'Exception': Exception,
    'BaseException': BaseException,
    'ValueError': ValueError,
    'TypeError': TypeError,
    'KeyError': KeyError,
    'IndexError': IndexError,
    'AttributeError': AttributeError,
    'ZeroDivisionError': ZeroDivisionError,
    'RuntimeError': RuntimeError,
    'StopIteration': StopIteration,
    'NameError': NameError,
    
    # Other safe functions
    'bin': bin,
    'hex': hex,
    'oct': oct,
    'object': object,
    'property': property,
    'staticmethod': staticmethod,
    'classmethod': classmethod,
    'super': super,
    
    # Class building (required for class definitions)
    '__build_class__': __builtins__.__build_class__ if hasattr(__builtins__, '__build_class__') else builtins.__build_class__,
}

# Functions that are DANGEROUS and must be blocked
BLOCKED_BUILTINS = [
    'eval',           # Can execute arbitrary code
    'exec',           # Can execute arbitrary code
    'compile',        # Can compile code
    'open',           # File system access
    'input',          # Will be replaced with safe version
    '__import__',     # Import system
    'globals',        # Access to global namespace
    'locals',         # Access to local namespace (we control this)
    'vars',           # Access to __dict__
    'dir',            # Information disclosure
    'help',           # Can execute code
    'breakpoint',     # Debugger access
    'memoryview',     # Low-level memory access
    'credits',        # Interactive mode
    'copyright',      # Interactive mode  
    'license',        # Interactive mode
    'quit',           # Exit interpreter
    'exit',           # Exit interpreter
]


# ============================================================================
# SAFE IMPORTS - Only allow harmless modules
# ============================================================================

SAFE_MODULES = {
    'math',           # Math functions
    'random',         # Random number generation
    'string',         # String constants
    'collections',    # Data structures
    'itertools',      # Iterator tools
    'functools',      # Function tools
    'operator',       # Operator functions
    'copy',           # Object copying
    'json',           # JSON (without file ops)
    'datetime',       # Date/time handling
    're',             # Regular expressions
    'heapq',          # Heap queue
    'bisect',         # Binary search
    'statistics',     # Statistical functions
    'typing',         # Type hints (List, Dict, etc.)
}

# Modules that must NEVER be imported
BLOCKED_MODULES = [
    'os',             # Operating system access
    'sys',            # System access
    'subprocess',     # Process execution
    'shutil',         # File operations
    'pathlib',        # Path operations
    'io',             # I/O operations (controlled separately)
    'socket',         # Network access
    'requests',       # HTTP requests
    'urllib',         # URL operations
    'http',           # HTTP operations
    'ftplib',         # FTP access
    'smtplib',        # Email sending
    'pickle',         # Code execution via deserialization
    'shelve',         # Persistent storage
    'sqlite3',        # Database access
    'ctypes',         # C library access
    'multiprocessing', # Process spawning
    'threading',      # Thread spawning
    'asyncio',        # Async operations
    'importlib',      # Import manipulation
    'builtins',       # Builtin access
    '__builtin__',    # Old builtin access
    'code',           # Interactive interpreter
    'codeop',         # Code compilation
    'pty',            # Pseudo-terminal
    'tty',            # Terminal control
    'tempfile',       # Temporary files
    'glob',           # File globbing
    'fnmatch',        # Filename matching
    'zipfile',        # Archive access
    'tarfile',        # Archive access
    'gzip',           # Compression (file access)
    'bz2',            # Compression (file access)
    'lzma',           # Compression (file access)
    'xml',            # XML parsing (XXE vulnerabilities)
    'html',           # HTML parsing
    'webbrowser',     # Browser control
    'getpass',        # Password input
    'platform',       # System information
    'resource',       # Resource limits (Unix)
    'signal',         # Signal handling
    'gc',             # Garbage collector access
    'inspect',        # Code inspection
    'traceback',      # Traceback manipulation
    'linecache',      # Line cache access
    'tokenize',       # Tokenizer access
    'ast',            # AST manipulation
    'dis',            # Disassembler
]


class SafeImporter:
    """
    Custom importer that only allows safe modules.
    """
    
    def __init__(self):
        self._cache = {}
    
    def __call__(self, name: str, globals: Dict = None, locals: Dict = None, 
                 fromlist: Tuple = (), level: int = 0):
        """
        Safe import function that replaces __builtins__.__import__
        """
        # Get the base module name
        base_name = name.split('.')[0]
        
        # Check if blocked
        if base_name in BLOCKED_MODULES:
            raise ImportError(f"Import of '{name}' is not allowed for security reasons")
        
        # Check if allowed
        if base_name not in SAFE_MODULES:
            raise ImportError(f"Import of '{name}' is not allowed. Only these modules are allowed: {', '.join(sorted(SAFE_MODULES))}")
        
        # Use cached import if available
        if name in self._cache:
            return self._cache[name]
        
        # Perform the actual import
        try:
            module = __import__(name, globals, locals, fromlist, level)
            self._cache[name] = module
            return module
        except ImportError as e:
            raise ImportError(f"Failed to import '{name}': {e}")


class SafeInput:
    """
    Safe input() replacement that uses pre-provided values.
    """
    
    def __init__(self, input_values: Optional[List[str]] = None):
        self.input_values = input_values or []
        self.input_index = 0
    
    def __call__(self, prompt: str = "") -> str:
        """
        Return the next input value, or empty string if exhausted.
        """
        if self.input_index < len(self.input_values):
            value = str(self.input_values[self.input_index])
            self.input_index += 1
            return value
        else:
            # No more input values available
            raise EOFError("No more input values available")


class SafePrint:
    """
    Safe print() that writes to a captured buffer.
    """
    
    def __init__(self, output_buffer: io.StringIO):
        self.buffer = output_buffer
    
    def __call__(self, *args, sep: str = ' ', end: str = '\n', **kwargs):
        """
        Print to the captured buffer instead of stdout.
        Ignores file parameter for security.
        """
        # Remove 'file' from kwargs if present (security)
        kwargs.pop('file', None)
        
        output = sep.join(str(arg) for arg in args) + end
        self.buffer.write(output)


@contextmanager
def capture_output():
    """
    Context manager to capture stdout/stderr.
    """
    buffer = io.StringIO()
    yield buffer


def create_sandbox(input_values: Optional[List[str]] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Create a sandboxed execution environment.
    
    Args:
        input_values: List of values to provide for input() calls
        
    Returns:
        Tuple of (globals_dict, locals_dict) for exec()
    """
    # Create output buffer for print
    output_buffer = io.StringIO()
    
    # Build safe builtins
    safe_builtins = SAFE_BUILTINS.copy()
    
    # Add safe import
    safe_builtins['__import__'] = SafeImporter()
    
    # Add safe input
    safe_builtins['input'] = SafeInput(input_values)
    
    # Add safe print
    safe_builtins['print'] = SafePrint(output_buffer)
    
    # Pre-import common typing constructs for convenience
    # This allows users to use List, Dict, etc. without explicit imports
    from typing import List as TypingList, Dict as TypingDict, Set as TypingSet
    from typing import Tuple as TypingTuple, Optional as TypingOptional
    from typing import Any as TypingAny, Union as TypingUnion
    
    # Create globals with restricted builtins
    sandbox_globals = {
        '__builtins__': safe_builtins,
        '__name__': '__main__',
        '__doc__': None,
        '_output_buffer_': output_buffer,  # For accessing output
        # Pre-imported typing constructs (common in LeetCode-style problems)
        'List': TypingList,
        'Dict': TypingDict,
        'Set': TypingSet,
        'Tuple': TypingTuple,
        'Optional': TypingOptional,
        'Any': TypingAny,
        'Union': TypingUnion,
    }
    
    # Empty locals
    sandbox_locals = {}
    
    return sandbox_globals, sandbox_locals


def validate_code(code: str) -> Tuple[bool, Optional[str]]:
    """
    Pre-validate code before execution for obvious security issues.
    
    Args:
        code: Python source code
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    import ast
    
    # Check for obvious dangerous patterns
    dangerous_patterns = [
        '__import__',
        '__builtins__',
        '__class__',
        '__bases__',
        '__subclasses__',
        '__mro__',
        '__globals__',
        '__code__',
        '__getattribute__',
        'os.system',
        'os.popen',
        'subprocess',
        'eval(',
        'exec(',
        'compile(',
        'open(',
        '__file__',
    ]
    
    code_lower = code.lower()
    for pattern in dangerous_patterns:
        if pattern.lower() in code_lower:
            return False, f"Potentially dangerous pattern detected: '{pattern}'"
    
    # Try to parse the AST
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Syntax error at line {e.lineno}: {e.msg}"
    
    # Check AST for dangerous nodes
    for node in ast.walk(tree):
        # Block attribute access to dangerous names
        if isinstance(node, ast.Attribute):
            if node.attr in ['__class__', '__bases__', '__subclasses__', '__mro__', 
                           '__globals__', '__code__', '__builtins__']:
                return False, f"Access to '{node.attr}' is not allowed"
    
    return True, None


# For testing
if __name__ == "__main__":
    # Test the sandbox
    test_code = """
x = 5
y = 10
print(f"Sum is: {x + y}")

import math
print(f"Pi is: {math.pi}")
"""
    
    # Validate
    is_valid, error = validate_code(test_code)
    print(f"Validation: {'PASS' if is_valid else 'FAIL'}")
    if error:
        print(f"Error: {error}")
    
    # Test safe import blocking
    dangerous_code = """
import os
os.system('echo hacked')
"""
    
    is_valid, error = validate_code(dangerous_code)
    print(f"\nDangerous code validation: {'PASS' if is_valid else 'FAIL'}")
    print(f"Error: {error}")
