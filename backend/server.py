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

# Import LiveKit token router
from livekit_token import router as livekit_router

# Import existing modules (tracer, sandbox, etc.)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tracer import trace_code
from sandbox import validate_code

# Import AI Narrator (same as Flask version)
try:
    from ai_narrator import get_narrator
    narrator = get_narrator()
except Exception as e:
    print(f"⚠ AI Narrator import failed: {e}")
    narrator = None

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
    print("Code Visualizer API (FastAPI + LiveKit)")
    print("=" * 50)
    print("\nEndpoints:")
    print("  GET  /api/health")
    print("  POST /api/execute")
    print("  POST /api/detect-inputs")
    print("  POST /api/trace")
    print("  POST /api/trace-stream")
    print("  GET  /livekit-token")
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

# Include LiveKit Router
app.include_router(livekit_router)

# ============ REST Endpoints ============

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Code Visualizer API (FastAPI)",
        "version": "2.1.0",
        "livekit_enabled": True,
        "ai_narrator": bool(narrator)
    }

@app.post("/api/execute")
async def execute_code(request: CodeRequest):
    try:
        final_code = prepare_execution_code(request)
        result = trace_code(final_code, request.inputs if request.codeType == "script" else [])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def prepare_execution_code(request: CodeRequest) -> str:
    """Append driver code to execute functions/classes with inputs."""
    code = request.code
    if request.codeType == "script":
        return code
    # Use robust parser for arguments
    param_values = parse_input_values(request.inputs, request.inputTypes)
    args = ", ".join(param_values)
    driver = ""
    if request.codeType == "class" and request.className and request.functionName:
        driver = f"\n\n# Driver Code\n_solution_instance = {request.className}()\n_result = _solution_instance.{request.functionName}({args})\nprint(_result)"
    elif request.codeType == "function" and request.functionName:
        driver = f"\n\n# Driver Code\n_result = {request.functionName}({args})\nprint(_result)"
    if driver:
        print(f"Appended driver code:\n{driver}")
        return code + driver
    return code

# ---------- Input detection ----------
@app.post("/api/detect-inputs")
async def detect_inputs(request: DetectRequest):
    import ast, re
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
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                class_name = node.name
                code_type = "class"
                for item in node.body:
                    if isinstance(item, ast.FunctionDef) and not item.name.startswith('__'):
                        function_name = item.name
                        for arg in item.args.args:
                            if arg.arg != 'self':
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
                                method_params.append({"name": arg.arg, "type": param_type, "label": param_label, "line": item.lineno})
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
                    method_params.append({"name": arg.arg, "type": param_type, "label": param_label, "line": node.lineno})
                break
        if method_params:
            for param in method_params:
                inputs.append({"id": len(inputs), "line": param["line"], "prompt": "", "variable": param["name"], "label": param["label"], "type": param["type"], "isParameter": True})
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'input':
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
                    label = prompt.rstrip(': ')
                elif variable:
                    label = f"Value for '{variable}'"
                else:
                    label = f"Input {len(inputs) + 1}"
                inputs.append({"id": len(inputs), "line": line_no, "prompt": prompt, "variable": variable, "label": label, "type": detect_input_type(lines[line_no - 1] if line_no <= len(lines) else ""), "isParameter": False})
        return {"hasInputs": len(inputs) > 0, "inputs": inputs, "count": len(inputs), "codeType": code_type, "functionName": function_name, "className": class_name}
    except Exception as e:
        return {"hasInputs": False, "inputs": [], "count": 0, "error": str(e)}

def detect_input_type(line):
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
    parsed = []
    for i, value in enumerate(input_values):
        input_type = input_types[i] if i < len(input_types) else "any"
        if input_type in ["list_int", "list"]:
            value = value.strip()
            items = value.split(',') if ',' in value else value.split()
            try:
                int_items = [int(x) for x in items if x]
                parsed.append(f"[{', '.join(map(str, int_items))}]")
            except ValueError:
                str_items = [f'\"{x}\"' for x in items if x]
                parsed.append(f"[{', '.join(str_items)}]")
        elif input_type == "list_str":
            value = value.strip()
            items = value.split(',') if ',' in value else value.split()
            str_items = [f'\"{x}\"' for x in items if x]
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
            parsed.append(f'\"{value}\"')
        else:
            value = value.strip()
            try:
                int(value)
                parsed.append(value)
            except ValueError:
                try:
                    float(value)
                    parsed.append(value)
                except ValueError:
                    if ',' in value or (value and value[0].isdigit() and ' ' in value):
                        items = [v.strip() for v in value.replace(',', ' ').split()]
                        try:
                            int_items = [int(x) for x in items if x]
                            parsed.append(f"[{', '.join(map(str, int_items))}]")
                        except ValueError:
                            parsed.append(f'\"{value}\"')
                    else:
                        parsed.append(f'\"{value}\"')
    return parsed

@app.post("/api/trace")
async def trace_endpoint(request: CodeRequest):
    try:
        executable_code = prepare_execution_code(request)
        result = trace_code(executable_code, request.inputs if request.codeType == "script" else [])
        if narrator and result.get('success') and result.get('frames'):
            source_lines = result.get('source_lines', [])
            for frame in result['frames']:
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
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trace-stream")
async def trace_stream_endpoint(request: CodeRequest):
    import time
    def generate_frames():
        try:
            executable_code = prepare_execution_code(request)
            result = trace_code(executable_code, request.inputs if request.codeType == "script" else [])
            if result.get('success'):
                frames = result.get('frames', [])
                source_lines = result.get('source_lines', [])
                for i, frame in enumerate(frames):
                    if narrator:
                        frame['explanation'] = narrator.generate_narration(
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
                    yield f"data: {json.dumps({'type': 'frame', 'index': i, 'frame': frame})}\n\n"
                    time.sleep(0.05)
                yield f"data: {json.dumps({'type': 'complete', 'totalFrames': len(frames)})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'error': result.get('error', 'Unknown error')})}\n\n"
        except Exception as e:
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
    try:
        result = validate_code(request.code)
        return result
    except Exception as e:
        return {"valid": False, "error": str(e)}

# ============ AI Teacher REST Endpoints (Restored) ============

# Global context storage - the backend is the source of truth
_teacher_context = {
    "code": "",
    "codeLines": [],
    "steps": [],
    "variables": {},
    "updated_at": None
}

class ContextRequest(BaseModel):
    code: str
    codeLines: List[str] = []
    steps: List[dict] = []

class ChatRequest(BaseModel):
    message: str
    currentStepIndex: Optional[int] = None

@app.post("/api/teacher/context")
async def teacher_set_context(request: ContextRequest):
    """Set the code execution context for AI Teacher - stored in backend."""
    global _teacher_context
    import datetime
    
    _teacher_context["code"] = request.code
    _teacher_context["codeLines"] = request.codeLines
    _teacher_context["steps"] = request.steps
    _teacher_context["updated_at"] = datetime.datetime.now().isoformat()
    
    print(f"✅ Context stored in backend: {len(request.steps)} steps, {len(request.code)} chars of code")
    return {
        "success": True, 
        "message": "Context stored successfully",
        "steps_count": len(request.steps),
        "code_length": len(request.code)
    }

@app.get("/api/teacher/context")
async def teacher_get_context():
    """Get the current code execution context - called by the LiveKit Agent."""
    global _teacher_context
    return {
        "success": True,
        "context": _teacher_context
    }

@app.post("/api/teacher/chat")
async def teacher_chat(request: ChatRequest):
    """Legacy chat endpoint (forwarding to WS is preferred)."""
    # This is a placeholder to prevent 404s if the frontend uses REST for chat.
    # Ideally, the frontend should use the WebSocket for all teacher interactions.
    return {"success": True, "response": "Please use the real-time voice interface."}

@app.post("/api/teacher/speak")
async def teacher_speak(request: dict):
    """Legacy TTS endpoint."""
    return {"success": False, "error": "Use real-time WebSocket for audio."}

# ============ Run Server ============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
