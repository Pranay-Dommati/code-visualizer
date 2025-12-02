import { useState, useCallback, useEffect, useRef } from 'react';
import TopBar from './components/TopBar';
import CodeEditor from './components/CodeEditor';
import InputModal from './components/InputModal';
import ImmersiveVisualizer from './components/ImmersiveVisualizer';
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
  const [error, setError] = useState(null);
  
  // Input modal state
  const [showInputModal, setShowInputModal] = useState(false);
  const [detectedInputs, setDetectedInputs] = useState([]);
  const [codeMetadata, setCodeMetadata] = useState(null);
  
  // Immersive visualizer state
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);

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
    setShowInputModal(false);
    
    // Open immersive visualizer immediately with loading state
    setShowVisualizer(true);
    setIsLoadingTrace(true);
    setSteps([]);
    
    const meta = metadata || codeMetadata;
    
    // Animate through loading phases
    setLoadingPhase(1); // Reading code
    await new Promise(resolve => setTimeout(resolve, 800));
    setLoadingPhase(2); // Analyzing
    await new Promise(resolve => setTimeout(resolve, 800));
    setLoadingPhase(3); // Preparing
    
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
      
      setLoadingPhase(4); // Starting
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
        setIsLoadingTrace(false);
      } else {
        setError(data.error || 'Failed to trace code');
        setSteps([]);
        setShowVisualizer(false);
        setIsLoadingTrace(false);
      }
    } catch (err) {
      setError(`Connection error: ${err.message}. Make sure the backend is running.`);
      setSteps([]);
      setShowVisualizer(false);
      setIsLoadingTrace(false);
    } finally {
      setIsRunning(false);
    }
  }, [code, codeMetadata]);

  // Handle start visualization button click
  const handleStartVisualization = useCallback(async () => {
    if (!code.trim()) return;
    
    setError(null);
    setLoadingPhase(0);
    
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

  const handleCloseVisualizer = useCallback(() => {
    setShowVisualizer(false);
    setSteps([]);
    setIsLoadingTrace(false);
  }, []);

  const handleUploadExample = useCallback(() => {
    setCode(exampleCode);
    setSteps([]);
    setError(null);
    setCodeMetadata(null);
    setShowVisualizer(false);
  }, []);

  // Get code lines for the visualizer
  const codeLines = code.split('\n');

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900">
      <TopBar onUploadExample={handleUploadExample} />
      
      <main className="flex-1 flex items-center justify-center p-4 overflow-hidden min-h-0">
        {/* Centered Code Editor */}
        <div className="w-full max-w-3xl h-full">
          <CodeEditor
            code={code}
            setCode={setCode}
            onStartVisualization={handleStartVisualization}
            autoGenerateInput={autoGenerateInput}
            setAutoGenerateInput={setAutoGenerateInput}
            isRunning={isRunning}
            currentLine={null}
            error={error}
            isVisualizationActive={false}
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
      
      {/* Immersive Full-Screen Visualizer */}
      <ImmersiveVisualizer
        isOpen={showVisualizer}
        onClose={handleCloseVisualizer}
        steps={steps}
        code={code}
        codeLines={codeLines}
        isLoading={isLoadingTrace}
        loadingPhase={loadingPhase}
      />
    </div>
  );
}

export default App;
