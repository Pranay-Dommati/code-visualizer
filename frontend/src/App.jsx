import { useState, useCallback } from 'react';
import TopBar from './components/TopBar';
import CodeEditor from './components/CodeEditor';
import VisualizationPanel from './components/VisualizationPanel';
import InputModal from './components/InputModal';
import './App.css';

const API_BASE_URL = 'http://localhost:5000/api';

const exampleCode = `arr = [64, 34, 25, 12, 22, 11, 90]
n = len(arr)

for i in range(n):
    for j in range(0, n-i-1):
        if arr[j] > arr[j+1]:
            arr[j], arr[j+1] = arr[j+1], arr[j]

print(arr)`;

function App() {
  const [code, setCode] = useState('');
  const [autoGenerateInput, setAutoGenerateInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentLine, setCurrentLine] = useState(null);
  const [executionComplete, setExecutionComplete] = useState(false);
  const [error, setError] = useState(null);
  
  // Input modal state
  const [showInputModal, setShowInputModal] = useState(false);
  const [detectedInputs, setDetectedInputs] = useState([]);
  const [codeMetadata, setCodeMetadata] = useState(null);

  // Detect inputs in the code
  const detectInputs = useCallback(async (codeToCheck) => {
    try {
      const response = await fetch(`${API_BASE_URL}/detect-inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToCheck })
      });
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Failed to detect inputs:', err);
      return { hasInputs: false, inputs: [], count: 0, codeType: 'script' };
    }
  }, []);

  // Run the actual trace
  const runTrace = useCallback(async (inputValues = [], metadata = null) => {
    setIsRunning(true);
    setError(null);
    setExecutionComplete(false);
    setShowInputModal(false);
    
    const meta = metadata || codeMetadata;
    
    try {
      const response = await fetch(`${API_BASE_URL}/trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: code,
          inputs: inputValues,
          codeType: meta?.codeType || 'script',
          functionName: meta?.functionName || null,
          className: meta?.className || null,
          inputTypes: meta?.inputs?.map(i => i.type) || []
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.frames && data.frames.length > 0) {
        // Transform frames to match our visualization format
        const transformedSteps = data.frames.map(frame => ({
          lineNumber: frame.line,
          code: frame.code,
          explanation: frame.explanation,
          variables: frame.locals,
          changedVars: frame.changed_vars || [],
          event: frame.event,
          functionName: frame.function_name,
          output: data.output
        }));
        
        setSteps(transformedSteps);
        setCurrentStepIndex(0);
        setCurrentLine(transformedSteps[0]?.lineNumber || null);
      } else {
        setError(data.error || 'Failed to trace code');
        setSteps([]);
      }
    } catch (err) {
      setError(`Connection error: ${err.message}. Make sure the backend is running.`);
      setSteps([]);
    } finally {
      setIsRunning(false);
    }
  }, [code, codeMetadata]);

  // Handle start visualization button click
  const handleStartVisualization = useCallback(async () => {
    if (!code.trim()) return;
    
    setError(null);
    
    // First, detect if the code needs any inputs
    const inputDetection = await detectInputs(code);
    
    // Store metadata for later use
    setCodeMetadata(inputDetection);
    
    if (inputDetection.hasInputs && inputDetection.count > 0) {
      // Show modal to collect inputs
      setDetectedInputs(inputDetection.inputs);
      setShowInputModal(true);
    } else {
      // No inputs needed, run directly
      runTrace([], inputDetection);
    }
  }, [code, detectInputs, runTrace]);

  // Handle input submission from modal
  const handleInputSubmit = useCallback((inputValues) => {
    runTrace(inputValues, codeMetadata);
  }, [runTrace, codeMetadata]);

  const handleNextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      setCurrentLine(steps[nextIndex]?.lineNumber || null);
      
      if (nextIndex === steps.length - 1) {
        setExecutionComplete(true);
      }
    }
  }, [currentStepIndex, steps]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      setCurrentLine(steps[prevIndex]?.lineNumber || null);
      setExecutionComplete(false);
    }
  }, [currentStepIndex, steps]);

  const handleUploadExample = useCallback(() => {
    setCode(exampleCode);
    setSteps([]);
    setCurrentStepIndex(0);
    setCurrentLine(null);
    setExecutionComplete(false);
    setError(null);
    setCodeMetadata(null);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900">
      <TopBar onUploadExample={handleUploadExample} />
      
      <main className="flex-1 flex flex-row p-4 gap-4 overflow-hidden min-h-0">
        {/* Left Pane - Code Editor */}
        <div className="w-1/2 min-w-0 h-full">
          <CodeEditor
            code={code}
            setCode={setCode}
            onStartVisualization={handleStartVisualization}
            autoGenerateInput={autoGenerateInput}
            setAutoGenerateInput={setAutoGenerateInput}
            isRunning={isRunning}
            currentLine={currentLine}
            error={error}
          />
        </div>

        {/* Divider */}
        <div className="w-1 bg-slate-700 hover:bg-teal-500 rounded-full cursor-col-resize transition-colors flex-shrink-0" />

        {/* Right Pane - Visualization */}
        <div className="w-1/2 min-w-0 h-full">
          <VisualizationPanel
            steps={steps}
            currentStepIndex={currentStepIndex}
            onNextStep={handleNextStep}
            onPrevStep={handlePrevStep}
            isRunning={isRunning}
            executionComplete={executionComplete}
          />
        </div>
      </main>

      {/* Input Modal */}
      <InputModal
        isOpen={showInputModal}
        onClose={() => setShowInputModal(false)}
        inputs={detectedInputs}
        onSubmit={handleInputSubmit}
        codeType={codeMetadata?.codeType}
        functionName={codeMetadata?.functionName}
        className={codeMetadata?.className}
      />
    </div>
  );
}

export default App;
