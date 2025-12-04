"""
FastAPI Backend for Code Visualizer + Realtime AI Teacher
==========================================================
Pure FastAPI backend with async WebSocket support for Gemini 2.0 Flash LIVE.

Run with: uvicorn main:app --reload --port 5000
"""

import os
import sys
import json
import base64
import asyncio
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from gemini_client import GeminiLiveClient

# Import existing modules (tracer, sandbox, etc.)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tracer import trace_code
from sandbox import validate_code

# Pydantic Models
class CodeRequest(BaseModel):
    code: str
    inputs: List[str] = []
    codeType: str = "script"
    functionName: Optional[str] = None
    className: Optional[str] = None
    inputTypes: List[str] = []

class DetectRequest(BaseModel):
    code: str

# Lifespan for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("Code Visualizer API (FastAPI)")
    print("=" * 50)
    print("\nEndpoints:")
    print("  GET  /api/health")
    print("  POST /api/execute")
    print("  POST /api/detect-inputs")
    print("  WS   /ws/teacher")
    print("=" * 50)
    yield
    print("Server shutting down...")

app = FastAPI(lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ REST Endpoints ============

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Code Visualizer API (FastAPI)",
        "version": "2.0.0",
        "gemini_live": True
    }

@app.post("/api/execute")
async def execute_code(request: CodeRequest):
    try:
        # Prepare code with driver if needed
        final_code = prepare_execution_code(request)
        result = trace_code(final_code, request.inputs if request.codeType == "script" else [])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def prepare_execution_code(request: CodeRequest) -> str:
    """
    Appends driver code to execute the target function/class with provided inputs.
    """
    code = request.code
    
    if request.codeType == "script":
        return code
        
    # Format arguments - assume they are valid Python literals
    # If input is empty string, pass nothing. If it's a list, join with commas.
    print(f"Preparing execution code. Inputs: {request.inputs}")
    args = ", ".join(request.inputs)
    
    driver = ""
    if request.codeType == "class" and request.className and request.functionName:
        # Instantiate class and call method
        driver = f"\n\n# Driver Code\n_solution_instance = {request.className}()\n_result = _solution_instance.{request.functionName}({args})\nprint(_result)"
        
    elif request.codeType == "function" and request.functionName:
        # Call function directly
        driver = f"\n\n# Driver Code\n_result = {request.functionName}({args})\nprint(_result)"
    
    if driver:
        print(f"Appended driver code:\n{driver}")
        return code + driver
        
    return code

@app.post("/api/detect-inputs")
async def detect_inputs(request: DetectRequest):
    import ast
    import re
    
    try:
        code = request.code
        if not code.strip():
            return {"hasInputs": False, "inputs": [], "count": 0}
            
        inputs = []
        lines = code.split('\n')
        code_type = "script"
        function_name = None
        class_name = None
        method_params = []
        
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return {"hasInputs": False, "inputs": [], "count": 0, "error": f"Syntax error: {e.msg}"}
            
        # First, check if this is a class with methods or standalone functions
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                class_name = node.name
                code_type = "class" # Changed from "class_method" to match frontend expectation if needed, but keeping consistent with app.py logic
                
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
                        break
                break
            
            elif isinstance(node, ast.FunctionDef) and not node.name.startswith('__'):
                function_name = node.name
                code_type = "function"
                
                for arg in node.args.args:
                    param_type = "any"
                    param_label = arg.arg
                    
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
        
        if method_params:
            for param in method_params:
                inputs.append({
                    "id": len(inputs), # Added ID for frontend key
                    "line": param["line"],
                    "prompt": "",
                    "variable": param["name"],
                    "label": param["label"],
                    "type": param["type"],
                    "isParameter": True
                })
        
        # Also check for input() calls
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id == 'input':
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
                        "id": len(inputs),
                        "line": line_no,
                        "prompt": prompt,
                        "variable": variable,
                        "label": label,
                        "type": detect_input_type(lines[line_no - 1] if line_no <= len(lines) else ""),
                        "isParameter": False
                    })

        return {
            "hasInputs": len(inputs) > 0,
            "inputs": inputs,
            "count": len(inputs),
            "codeType": code_type,
            "functionName": function_name,
            "className": class_name
        }
    except Exception as e:
        return {"hasInputs": False, "inputs": [], "count": 0, "error": str(e)}

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

def prepare_execution_code(request: CodeRequest) -> str:
    """
    Appends driver code to execute the target function/class with provided inputs.
    """
    code = request.code
    
    if request.codeType == "script":
        return code
        
    # Format arguments using the robust parser
    print(f"Preparing execution code. Inputs: {request.inputs}, Types: {request.inputTypes}")
    
    # Use parse_input_values to handle type conversion
    param_values = parse_input_values(request.inputs, request.inputTypes)
    args = ", ".join(param_values)
    
    driver = ""
    if request.codeType == "class" and request.className and request.functionName:
        # Instantiate class and call method
        driver = f"\n\n# Driver Code\n_solution_instance = {request.className}()\n_result = _solution_instance.{request.functionName}({args})\nprint(_result)"
        
    elif request.codeType == "function" and request.functionName:
        # Call function directly
        driver = f"\n\n# Driver Code\n_result = {request.functionName}({args})\nprint(_result)"
    
    if driver:
        print(f"Appended driver code:\n{driver}")
        return code + driver
        
    return code


@app.post("/api/trace-stream")
async def trace_stream(request: CodeRequest):
    """Streaming trace endpoint - returns execution frames."""
    import time
    
    def generate_frames():
        try:
            # Prepare code with driver if needed
            final_code = prepare_execution_code(request)
            
            print(f"Executing trace_code for: {request.code[:50]}...")
            # For class/function, inputs are already in final_code, so pass empty list to trace_code
            trace_inputs = request.inputs if request.codeType == "script" else []
            
            result = trace_code(final_code, trace_inputs)
            print(f"trace_code result success: {result.get('success')}, frames: {len(result.get('frames', []))}")
            
            if result.get("success"):
                frames = result.get("frames", [])
                for i, frame in enumerate(frames):
                    yield f"data: {json.dumps({'type': 'frame', 'index': i, 'frame': frame})}\n\n"
                    time.sleep(0.05)  # Small delay for streaming effect
                
                print("Sending complete message")
                yield f"data: {json.dumps({'type': 'complete', 'totalFrames': len(frames)})}\n\n"
            else:
                print(f"Trace failed: {result.get('error')}")
                yield f"data: {json.dumps({'type': 'error', 'error': result.get('error', 'Unknown error')})}\n\n"
                
        except Exception as e:
            print(f"Trace stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_frames(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/validate")
async def validate_code_endpoint(request: DetectRequest):
    """Validate code without executing."""
    try:
        result = validate_code(request.code)
        return result
    except Exception as e:
        return {"valid": False, "error": str(e)}


@app.post("/api/trace")
async def trace_code_endpoint(request: CodeRequest):
    """Non-streaming trace endpoint."""
    try:
        result = trace_code(request.code, request.inputs)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ WebSocket for Realtime AI Teacher ============

@app.websocket("/ws/teacher")
async def websocket_teacher(websocket: WebSocket):
    """
    Realtime AI Teacher WebSocket endpoint.
    Bridges Frontend <-> Gemini 2.0 Flash LIVE.
    """
    await websocket.accept()
    print("✓ Client connected to /ws/teacher")
    
    gemini = GeminiLiveClient()
    
    try:
        # Connect to Gemini Live
        connected = await gemini.connect()
        if not connected:
            await websocket.send_json({"error": "Failed to connect to Gemini Live"})
            await websocket.close()
            return
        
        # Create tasks for bidirectional streaming
        async def receive_from_gemini():
            """Receive from Gemini and forward to Frontend."""
            while gemini.is_connected:
                try:
                    response = await gemini.receive()
                    if response:
                        # Forward to frontend
                        await websocket.send_json(response)
                        
                        # Parse for drawing commands in the response
                        if "serverContent" in response:
                            content = response.get("serverContent", {})
                            parts = content.get("modelTurn", {}).get("parts", [])
                            for part in parts:
                                if "text" in part:
                                    text = part["text"]
                                    # Check for JSON drawing commands
                                    for line in text.split('\n'):
                                        line = line.strip()
                                        if line.startswith('{') and 'action' in line:
                                            try:
                                                cmd = json.loads(line)
                                                await websocket.send_json(cmd)
                                            except:
                                                pass
                except Exception as e:
                    print(f"Gemini receive error: {e}")
                    break
        
        async def receive_from_frontend():
            """Receive from Frontend and forward to Gemini."""
            while True:
                try:
                    data = await websocket.receive_json()
                    
                    # Handle text input
                    if "text" in data:
                        await gemini.send_text(data["text"])
                    
                    # Handle audio input (PCM16 base64)
                    if "audio" in data:
                        audio_bytes = base64.b64decode(data["audio"])
                        await gemini.send_audio(audio_bytes)
                        
                except WebSocketDisconnect:
                    print("Client disconnected")
                    break
                except Exception as e:
                    print(f"Frontend receive error: {e}")
                    break
        
        # Run both tasks concurrently
        gemini_task = asyncio.create_task(receive_from_gemini())
        frontend_task = asyncio.create_task(receive_from_frontend())
        
        # Wait for either to complete
        done, pending = await asyncio.wait(
            [gemini_task, frontend_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
            
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await gemini.close()
        print("✓ Client disconnected from /ws/teacher")

# ============ Run Server ============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
