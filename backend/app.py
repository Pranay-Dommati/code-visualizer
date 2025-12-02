"""
Flask API for Python Code Visualizer
=====================================
Exposes the tracing engine via REST API endpoints.

Endpoints:
- POST /api/trace - Trace Python code and return execution frames
- POST /api/validate - Validate code without executing
- POST /api/detect-inputs - Detect input() calls in code
- POST /api/teacher/context - Set AI Teacher context
- POST /api/teacher/chat - Chat with AI Teacher
- POST /api/teacher/speak - Text-to-speech
- GET /api/health - Health check
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from tracer import trace_code
from sandbox import validate_code
from ai_narrator import get_narrator, generate_narration
from ai_teacher import get_teacher
import json
import ast
import re
import time
import base64

app = Flask(__name__)

# Initialize AI services at startup
narrator = get_narrator()
teacher = get_teacher()

# Enable CORS for frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "Python Code Visualizer API",
        "version": "1.0.0",
        "ai_narrator": narrator.is_available,
        "ai_teacher": teacher.gemini_available,
        "tts_available": teacher.elevenlabs_available
    })


# ==================== AI Teacher Endpoints ====================

@app.route('/api/teacher/context', methods=['POST'])
def teacher_set_context():
    """
    Set the code execution context for AI Teacher.
    This should be called when visualization starts.
    
    Request body:
    {
        "code": "python code string",
        "codeLines": ["line1", "line2", ...],
        "steps": [execution steps array]
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        code = data.get('code', '')
        code_lines = data.get('codeLines', code.split('\n') if code else [])
        steps = data.get('steps', [])
        
        teacher.set_context(code, code_lines, steps)
        
        return jsonify({
            "success": True,
            "message": "Context set successfully",
            "steps_loaded": len(steps)
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/teacher/chat', methods=['POST'])
def teacher_chat():
    """
    Chat with AI Teacher. Returns streaming text response.
    
    Request body:
    {
        "message": "user's question",
        "currentStepIndex": 5 (optional)
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({"success": False, "error": "No message provided"}), 400
        
        message = data['message']
        current_step = data.get('currentStepIndex')
        
        def generate_response():
            for chunk in teacher.chat(message, current_step):
                yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        
        return Response(
            generate_response(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/teacher/chat-sync', methods=['POST'])
def teacher_chat_sync():
    """
    Chat with AI Teacher. Returns complete response (non-streaming).
    Good for getting response before TTS.
    
    Request body:
    {
        "message": "user's question",
        "currentStepIndex": 5 (optional)
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({"success": False, "error": "No message provided"}), 400
        
        message = data['message']
        current_step = data.get('currentStepIndex')
        
        response = teacher.chat_sync(message, current_step)
        
        return jsonify({
            "success": True,
            "response": response
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/teacher/speak', methods=['POST'])
def teacher_speak():
    """
    Convert text to speech using ElevenLabs.
    
    Request body:
    {
        "text": "text to speak",
        "format": "base64" or "binary",
        "with_timestamps": true/false (optional)
    }
    
    Returns: audio/mpeg data or base64 encoded audio
    If with_timestamps=true, also returns character-level alignment data
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"success": False, "error": "No text provided"}), 400
        
        text = data['text']
        return_format = data.get('format', 'base64')  # 'base64' or 'binary'
        with_timestamps = data.get('with_timestamps', False)
        
        if not teacher.elevenlabs_available:
            return jsonify({"success": False, "error": "TTS not available"}), 503
        
        # Use timestamps endpoint if requested
        if with_timestamps:
            result = teacher.text_to_speech_with_timestamps(text)
            if result:
                return jsonify({
                    "success": True,
                    "audio": result["audio"],
                    "alignment": result["alignment"],
                    "format": "mp3"
                })
            else:
                # Fallback to regular TTS without timestamps
                audio_data = teacher.text_to_speech(text)
                if audio_data:
                    audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                    return jsonify({
                        "success": True,
                        "audio": audio_base64,
                        "format": "mp3"
                    })
                return jsonify({"success": False, "error": "TTS generation failed"}), 500
        
        audio_data = teacher.text_to_speech(text)
        
        if audio_data:
            if return_format == 'binary':
                return Response(
                    audio_data,
                    mimetype='audio/mpeg',
                    headers={'Content-Disposition': 'inline'}
                )
            else:
                # Return as base64
                audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                return jsonify({
                    "success": True,
                    "audio": audio_base64,
                    "format": "mp3"
                })
        else:
            return jsonify({"success": False, "error": "TTS generation failed"}), 500
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/teacher/clear', methods=['POST'])
def teacher_clear():
    """Clear AI Teacher conversation history."""
    try:
        teacher.clear_history()
        return jsonify({"success": True, "message": "History cleared"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/teacher/step-chat', methods=['POST'])
def teacher_step_chat():
    """
    Chat about a specific step in the code execution.
    This is for inline step-level conversations.
    
    Request body:
    {
        "message": "user's question",
        "stepContext": {
            "stepIndex": 0,
            "currentLine": 3,
            "currentCode": "max_val = nums[0]",
            "explanation": "We're starting by assuming...",
            "variables": {...},
            "previousMessages": [...]
        },
        "code": "full code",
        "codeLines": ["line1", "line2", ...]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({"success": False, "error": "No message provided"}), 400
        
        message = data['message']
        step_context = data.get('stepContext', {})
        code = data.get('code', '')
        code_lines = data.get('codeLines', [])
        
        # Build a focused prompt for this specific step
        response = teacher.step_chat(message, step_context, code, code_lines)
        
        return jsonify({
            "success": True,
            "response": response
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==================== End AI Teacher Endpoints ====================


@app.route('/api/detect-inputs', methods=['POST'])
def detect_inputs():
    """
    Detect inputs needed to run Python code:
    1. input() function calls
    2. Function/method parameters that need values
    3. Class methods that need to be called with arguments
    
    Request body:
    {
        "code": "python code string"
    }
    
    Response:
    {
        "hasInputs": true/false,
        "inputs": [...],
        "count": 2,
        "codeType": "class_method" | "function" | "script",
        "functionName": "findMax",
        "className": "Solution"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'code' not in data:
            return jsonify({
                "hasInputs": False,
                "inputs": [],
                "count": 0,
                "error": "Missing 'code' in request body"
            }), 400
        
        code = data['code']
        
        if not isinstance(code, str) or not code.strip():
            return jsonify({
                "hasInputs": False,
                "inputs": [],
                "count": 0
            })
        
        inputs = []
        lines = code.split('\n')
        code_type = "script"
        function_name = None
        class_name = None
        method_params = []
        
        # Parse the AST
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return jsonify({
                "hasInputs": False,
                "inputs": [],
                "count": 0,
                "error": f"Syntax error: {e.msg}"
            })
        
        # First, check if this is a class with methods or standalone functions
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                # It's a class definition
                class_name = node.name
                code_type = "class_method"
                
                # Find the main method (not __init__)
                for item in node.body:
                    if isinstance(item, ast.FunctionDef) and not item.name.startswith('__'):
                        function_name = item.name
                        # Get parameters (skip 'self')
                        for arg in item.args.args:
                            if arg.arg != 'self':
                                param_type = "any"
                                param_label = arg.arg
                                
                                # Check type annotation
                                if arg.annotation:
                                    annotation = ast.unparse(arg.annotation) if hasattr(ast, 'unparse') else str(arg.annotation)
                                    if 'List[int]' in annotation or 'list' in annotation.lower():
                                        param_type = "list_int"
                                        param_label = f"{arg.arg} (List of integers, e.g., 1,2,3,4,5)"
                                    elif 'List[str]' in annotation:
                                        param_type = "list_str"
                                        param_label = f"{arg.arg} (List of strings)"
                                    elif 'int' in annotation.lower():
                                        param_type = "integer"
                                        param_label = f"{arg.arg} (Integer)"
                                    elif 'str' in annotation.lower():
                                        param_type = "text"
                                        param_label = f"{arg.arg} (String)"
                                    elif 'float' in annotation.lower():
                                        param_type = "float"
                                        param_label = f"{arg.arg} (Float)"
                                
                                method_params.append({
                                    "name": arg.arg,
                                    "type": param_type,
                                    "label": param_label,
                                    "line": item.lineno
                                })
                        break  # Just get the first non-dunder method
                break
            
            elif isinstance(node, ast.FunctionDef) and not node.name.startswith('__'):
                # It's a standalone function
                function_name = node.name
                code_type = "function"
                
                for arg in node.args.args:
                    param_type = "any"
                    param_label = arg.arg
                    
                    # Check type annotation
                    if arg.annotation:
                        annotation = ast.unparse(arg.annotation) if hasattr(ast, 'unparse') else str(arg.annotation)
                        if 'List[int]' in annotation or 'list' in annotation.lower():
                            param_type = "list_int"
                            param_label = f"{arg.arg} (List of integers, e.g., 1,2,3,4,5)"
                        elif 'List[str]' in annotation:
                            param_type = "list_str"
                            param_label = f"{arg.arg} (List of strings)"
                        elif 'int' in annotation.lower():
                            param_type = "integer"
                            param_label = f"{arg.arg} (Integer)"
                        elif 'str' in annotation.lower():
                            param_type = "text"
                            param_label = f"{arg.arg} (String)"
                        elif 'float' in annotation.lower():
                            param_type = "float"
                            param_label = f"{arg.arg} (Float)"
                    
                    method_params.append({
                        "name": arg.arg,
                        "type": param_type,
                        "label": param_label,
                        "line": node.lineno
                    })
                break
        
        # If we found method/function parameters, add them as inputs
        if method_params:
            for param in method_params:
                inputs.append({
                    "line": param["line"],
                    "prompt": "",
                    "variable": param["name"],
                    "label": param["label"],
                    "type": param["type"],
                    "isParameter": True
                })
        
        # Also check for input() calls in the code
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                if isinstance(func, ast.Name) and func.id == 'input':
                    line_no = node.lineno
                    prompt = ""
                    variable = None
                    
                    if node.args:
                        arg = node.args[0]
                        if isinstance(arg, ast.Constant):
                            prompt = str(arg.value)
                        elif isinstance(arg, ast.Str):
                            prompt = arg.s
                    
                    if line_no <= len(lines):
                        line_text = lines[line_no - 1].strip()
                        match = re.match(r'^(\w+)\s*=\s*(?:int|float|str)?\s*\(?\s*input', line_text)
                        if match:
                            variable = match.group(1)
                    
                    if prompt:
                        label = prompt.rstrip(': ').rstrip(':')
                    elif variable:
                        label = f"Value for '{variable}'"
                    else:
                        label = f"Input {len(inputs) + 1}"
                    
                    inputs.append({
                        "line": line_no,
                        "prompt": prompt,
                        "variable": variable,
                        "label": label,
                        "type": detect_input_type(lines[line_no - 1] if line_no <= len(lines) else ""),
                        "isParameter": False
                    })
        
        return jsonify({
            "hasInputs": len(inputs) > 0,
            "inputs": inputs,
            "count": len(inputs),
            "codeType": code_type,
            "functionName": function_name,
            "className": class_name
        })
        
    except Exception as e:
        return jsonify({
            "hasInputs": False,
            "inputs": [],
            "count": 0,
            "error": f"Detection error: {str(e)}"
        }), 500


def detect_input_type(line):
    """Detect the expected type of input based on code context."""
    line_lower = line.lower()
    if 'int(input' in line_lower:
        return 'integer'
    elif 'float(input' in line_lower:
        return 'float'
    elif 'eval(input' in line_lower:
        return 'expression'
    elif 'list' in line_lower or 'split' in line_lower:
        return 'list'
    else:
        return 'text'


@app.route('/api/validate', methods=['POST'])
def validate_endpoint():
    """
    Validate Python code without executing it.
    
    Request body:
    {
        "code": "python code string"
    }
    
    Response:
    {
        "valid": true/false,
        "error": "error message if invalid"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'code' not in data:
            return jsonify({
                "valid": False,
                "error": "Missing 'code' in request body"
            }), 400
        
        code = data['code']
        
        if not isinstance(code, str):
            return jsonify({
                "valid": False,
                "error": "'code' must be a string"
            }), 400
        
        if not code.strip():
            return jsonify({
                "valid": False,
                "error": "Code cannot be empty"
            }), 400
        
        # Validate the code
        is_valid, error = validate_code(code)
        
        return jsonify({
            "valid": is_valid,
            "error": error
        })
        
    except Exception as e:
        return jsonify({
            "valid": False,
            "error": f"Validation error: {str(e)}"
        }), 500


@app.route('/api/trace', methods=['POST'])
def trace_endpoint():
    """
    Trace Python code execution and return step-by-step frames.
    
    Request body:
    {
        "code": "python code string",
        "inputs": ["optional", "input", "values"],
        "codeType": "script" | "function" | "class_method",
        "functionName": "optional function name",
        "className": "optional class name"
    }
    
    Response:
    {
        "success": true/false,
        "frames": [...],
        "output": "captured stdout",
        "error": "error message if any",
        "source_lines": ["line1", "line2", ...]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'code' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'code' in request body",
                "frames": [],
                "output": ""
            }), 400
        
        code = data['code']
        input_values = data.get('inputs', [])
        code_type = data.get('codeType', 'script')
        function_name = data.get('functionName')
        class_name = data.get('className')
        
        if not isinstance(code, str):
            return jsonify({
                "success": False,
                "error": "'code' must be a string",
                "frames": [],
                "output": ""
            }), 400
        
        if not code.strip():
            return jsonify({
                "success": False,
                "error": "Code cannot be empty",
                "frames": [],
                "output": ""
            }), 400
        
        # Validate first
        is_valid, validation_error = validate_code(code)
        if not is_valid:
            return jsonify({
                "success": False,
                "error": validation_error,
                "frames": [],
                "output": ""
            }), 400
        
        # Prepare the code for execution based on type
        executable_code = code
        
        if code_type == "class_method" and class_name and function_name:
            # Wrap class method with instantiation and call
            # Parse input values for the method parameters
            param_values = parse_input_values(input_values, data.get('inputTypes', []))
            params_str = ', '.join(param_values)
            
            executable_code = f"""{code}

# Auto-generated execution code
_solution = {class_name}()
_result = _solution.{function_name}({params_str})
print(f"Result: {{_result}}")
"""
        elif code_type == "function" and function_name:
            # Wrap standalone function with call
            param_values = parse_input_values(input_values, data.get('inputTypes', []))
            params_str = ', '.join(param_values)
            
            executable_code = f"""{code}

# Auto-generated execution code
_result = {function_name}({params_str})
print(f"Result: {{_result}}")
"""
        
        # Trace the code
        result = trace_code(executable_code, input_values if code_type == "script" else [])
        
        # Enrich frames with AI-generated narrations
        if result.get('success') and result.get('frames'):
            source_lines = result.get('source_lines', [])
            
            for frame in result['frames']:
                # Generate AI narration for each frame
                ai_narration = narrator.generate_narration(
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
                frame['explanation'] = ai_narration
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}",
            "frames": [],
            "output": ""
        }), 500


@app.route('/api/trace-stream', methods=['POST'])
def trace_stream_endpoint():
    """
    Trace Python code execution and stream frames one by one using Server-Sent Events.
    This allows the frontend to display frames as they are processed.
    """
    try:
        data = request.get_json()
        
        if not data or 'code' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'code' in request body"
            }), 400
        
        code = data['code']
        input_values = data.get('inputs', [])
        code_type = data.get('codeType', 'script')
        function_name = data.get('functionName')
        class_name = data.get('className')
        
        if not isinstance(code, str) or not code.strip():
            return jsonify({
                "success": False,
                "error": "Invalid or empty code"
            }), 400
        
        # Validate first
        is_valid, validation_error = validate_code(code)
        if not is_valid:
            return jsonify({
                "success": False,
                "error": validation_error
            }), 400
        
        # Prepare the code for execution based on type
        executable_code = code
        
        if code_type == "class_method" and class_name and function_name:
            param_values = parse_input_values(input_values, data.get('inputTypes', []))
            params_str = ', '.join(param_values)
            executable_code = f"""{code}

# Auto-generated execution code
_solution = {class_name}()
_result = _solution.{function_name}({params_str})
print(f"Result: {{_result}}")
"""
        elif code_type == "function" and function_name:
            param_values = parse_input_values(input_values, data.get('inputTypes', []))
            params_str = ', '.join(param_values)
            executable_code = f"""{code}

# Auto-generated execution code
_result = {function_name}({params_str})
print(f"Result: {{_result}}")
"""
        
        # Trace the code
        result = trace_code(executable_code, input_values if code_type == "script" else [])
        
        def generate_stream():
            if not result.get('success'):
                yield f"data: {json.dumps({'type': 'error', 'error': result.get('error', 'Unknown error')})}\n\n"
                return
            
            frames = result.get('frames', [])
            source_lines = result.get('source_lines', [])
            output = result.get('output', '')
            
            # Send metadata first
            yield f"data: {json.dumps({'type': 'metadata', 'totalFrames': len(frames), 'output': output, 'sourceLines': source_lines})}\n\n"
            
            # Stream each frame with AI narration
            for i, frame in enumerate(frames):
                # Generate AI narration for this frame
                ai_narration = narrator.generate_narration(
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
                frame['explanation'] = ai_narration
                
                # Send the frame
                yield f"data: {json.dumps({'type': 'frame', 'index': i, 'frame': frame})}\n\n"
            
            # Send completion message
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
        
        return Response(
            generate_stream(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500


def parse_input_values(input_values, input_types):
    """
    Parse input values based on their expected types.
    Returns list of string representations suitable for code execution.
    """
    parsed = []
    for i, value in enumerate(input_values):
        input_type = input_types[i] if i < len(input_types) else "any"
        
        if input_type in ["list_int", "list"]:
            # Parse as list of integers: "1,2,3,4,5" or "1 2 3 4 5"
            value = value.strip()
            if ',' in value:
                items = [v.strip() for v in value.split(',')]
            else:
                items = value.split()
            
            # Try to convert to integers
            try:
                int_items = [int(x) for x in items if x]
                parsed.append(f"[{', '.join(map(str, int_items))}]")
            except ValueError:
                # Keep as strings if can't convert
                str_items = [f'"{x}"' for x in items if x]
                parsed.append(f"[{', '.join(str_items)}]")
        
        elif input_type == "list_str":
            value = value.strip()
            if ',' in value:
                items = [v.strip() for v in value.split(',')]
            else:
                items = value.split()
            str_items = [f'"{x}"' for x in items if x]
            parsed.append(f"[{', '.join(str_items)}]")
        
        elif input_type == "integer":
            try:
                parsed.append(str(int(value)))
            except ValueError:
                parsed.append("0")
        
        elif input_type == "float":
            try:
                parsed.append(str(float(value)))
            except ValueError:
                parsed.append("0.0")
        
        elif input_type == "text":
            parsed.append(f'"{value}"')
        
        else:
            # Try to detect the type
            value = value.strip()
            try:
                int(value)
                parsed.append(value)
            except ValueError:
                try:
                    float(value)
                    parsed.append(value)
                except ValueError:
                    # Check if it looks like a list
                    if ',' in value or (value and value[0].isdigit() and ' ' in value):
                        items = [v.strip() for v in value.replace(',', ' ').split()]
                        try:
                            int_items = [int(x) for x in items if x]
                            parsed.append(f"[{', '.join(map(str, int_items))}]")
                        except ValueError:
                            parsed.append(f'"{value}"')
                    else:
                        parsed.append(f'"{value}"')
    
    return parsed


@app.route('/api/examples', methods=['GET'])
def get_examples():
    """
    Return example Python code snippets for users to try.
    """
    examples = [
        {
            "name": "Bubble Sort",
            "description": "Classic sorting algorithm - great for visualizing array swaps",
            "code": """arr = [64, 34, 25, 12, 22, 11, 90]
n = len(arr)

for i in range(n):
    for j in range(0, n-i-1):
        if arr[j] > arr[j+1]:
            arr[j], arr[j+1] = arr[j+1], arr[j]

print("Sorted array:", arr)"""
        },
        {
            "name": "Binary Search",
            "description": "Efficient searching in sorted arrays",
            "code": """def binary_search(arr, target):
    left = 0
    right = len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1

arr = [1, 3, 5, 7, 9, 11, 13, 15]
target = 7
result = binary_search(arr, target)
print(f"Found {target} at index {result}")"""
        },
        {
            "name": "Fibonacci Sequence",
            "description": "Generate Fibonacci numbers iteratively",
            "code": """def fibonacci(n):
    if n <= 1:
        return n
    
    a = 0
    b = 1
    for i in range(2, n + 1):
        temp = a + b
        a = b
        b = temp
    
    return b

for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")"""
        },
        {
            "name": "Two Pointers",
            "description": "Find pair with target sum",
            "code": """def two_sum(arr, target):
    left = 0
    right = len(arr) - 1
    
    while left < right:
        current_sum = arr[left] + arr[right]
        if current_sum == target:
            return [left, right]
        elif current_sum < target:
            left += 1
        else:
            right -= 1
    
    return [-1, -1]

arr = [1, 2, 3, 4, 5, 6, 7, 8, 9]
target = 10
result = two_sum(arr, target)
print(f"Indices: {result}")
print(f"Values: {arr[result[0]]} + {arr[result[1]]} = {target}")"""
        },
        {
            "name": "Simple Loop",
            "description": "Basic for loop with variable tracking",
            "code": """total = 0
numbers = [1, 2, 3, 4, 5]

for num in numbers:
    total = total + num
    print(f"Added {num}, total is now {total}")

print(f"Final sum: {total}")"""
        },
        {
            "name": "Factorial",
            "description": "Calculate factorial with recursion visualization",
            "code": """def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(5)
print(f"5! = {result}")"""
        }
    ]
    
    return jsonify({
        "examples": examples
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error": "Endpoint not found",
        "message": "Available endpoints: /api/health, /api/validate, /api/trace, /api/examples"
    }), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({
        "error": "Internal server error",
        "message": str(e)
    }), 500


if __name__ == '__main__':
    print("=" * 50)
    print("Python Code Visualizer API")
    print("=" * 50)
    print("\nAvailable endpoints:")
    print("  GET  /api/health        - Health check")
    print("  POST /api/validate      - Validate code")
    print("  POST /api/detect-inputs - Detect input() calls")
    print("  POST /api/trace         - Trace code execution")
    print("  GET  /api/examples      - Get example code snippets")
    print("\n" + "=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
