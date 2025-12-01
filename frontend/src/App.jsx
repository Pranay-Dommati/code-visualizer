import { useState, useCallback } from 'react';
import TopBar from './components/TopBar';
import CodeEditor from './components/CodeEditor';
import VisualizationPanel from './components/VisualizationPanel';
import './App.css';

// Sample execution steps for demonstration
const sampleSteps = [
  {
    lineNumber: 1,
    code: 'arr = [64, 34, 25, 12, 22, 11, 90]',
    explanation: 'Initialize an array with 7 unsorted integers.',
    variables: {
      arr: { value: [64, 34, 25, 12, 22, 11, 90], type: 'list', changed: true }
    },
    arrays: {
      arr: { values: [64, 34, 25, 12, 22, 11, 90], highlightIndices: [], compareIndices: [], pointers: [] }
    }
  },
  {
    lineNumber: 2,
    code: 'n = len(arr)',
    explanation: 'Get the length of the array and store it in variable n.',
    variables: {
      arr: { value: [64, 34, 25, 12, 22, 11, 90], type: 'list', changed: false },
      n: { value: 7, type: 'int', changed: true }
    },
    arrays: {
      arr: { values: [64, 34, 25, 12, 22, 11, 90], highlightIndices: [], compareIndices: [], pointers: [] }
    }
  },
  {
    lineNumber: 4,
    code: 'for i in range(n):',
    explanation: 'Start the outer loop - this controls how many passes we make through the array.',
    variables: {
      arr: { value: [64, 34, 25, 12, 22, 11, 90], type: 'list', changed: false },
      n: { value: 7, type: 'int', changed: false },
      i: { value: 0, type: 'int', changed: true }
    },
    arrays: {
      arr: { values: [64, 34, 25, 12, 22, 11, 90], highlightIndices: [], compareIndices: [], pointers: [] }
    },
    loop: { iteration: 1, total: 7 }
  },
  {
    lineNumber: 5,
    code: 'for j in range(0, n-i-1):',
    explanation: 'Start the inner loop - compare adjacent elements and swap if needed.',
    variables: {
      arr: { value: [64, 34, 25, 12, 22, 11, 90], type: 'list', changed: false },
      n: { value: 7, type: 'int', changed: false },
      i: { value: 0, type: 'int', changed: false },
      j: { value: 0, type: 'int', changed: true }
    },
    arrays: {
      arr: { 
        values: [64, 34, 25, 12, 22, 11, 90], 
        highlightIndices: [], 
        compareIndices: [0, 1], 
        pointers: [{ name: 'j', index: 0 }, { name: 'j+1', index: 1 }] 
      }
    },
    loop: { iteration: 1, total: 6 }
  },
  {
    lineNumber: 6,
    code: 'if arr[j] > arr[j+1]:',
    explanation: 'Compare arr[0]=64 with arr[1]=34. Since 64 > 34, we need to swap!',
    variables: {
      arr: { value: [64, 34, 25, 12, 22, 11, 90], type: 'list', changed: false },
      n: { value: 7, type: 'int', changed: false },
      i: { value: 0, type: 'int', changed: false },
      j: { value: 0, type: 'int', changed: false }
    },
    arrays: {
      arr: { 
        values: [64, 34, 25, 12, 22, 11, 90], 
        highlightIndices: [0, 1], 
        compareIndices: [], 
        pointers: [{ name: 'j', index: 0 }, { name: 'j+1', index: 1 }] 
      }
    }
  },
  {
    lineNumber: 7,
    code: 'arr[j], arr[j+1] = arr[j+1], arr[j]',
    explanation: 'Swap elements! 64 and 34 exchange positions.',
    variables: {
      arr: { value: [34, 64, 25, 12, 22, 11, 90], type: 'list', changed: true },
      n: { value: 7, type: 'int', changed: false },
      i: { value: 0, type: 'int', changed: false },
      j: { value: 0, type: 'int', changed: false }
    },
    arrays: {
      arr: { 
        values: [34, 64, 25, 12, 22, 11, 90], 
        highlightIndices: [0, 1], 
        compareIndices: [], 
        pointers: [] 
      }
    }
  },
  {
    lineNumber: 5,
    code: 'for j in range(0, n-i-1):',
    explanation: 'Continue inner loop with j=1. Compare next pair of elements.',
    variables: {
      arr: { value: [34, 64, 25, 12, 22, 11, 90], type: 'list', changed: false },
      n: { value: 7, type: 'int', changed: false },
      i: { value: 0, type: 'int', changed: false },
      j: { value: 1, type: 'int', changed: true }
    },
    arrays: {
      arr: { 
        values: [34, 64, 25, 12, 22, 11, 90], 
        highlightIndices: [], 
        compareIndices: [1, 2], 
        pointers: [{ name: 'j', index: 1 }, { name: 'j+1', index: 2 }] 
      }
    },
    loop: { iteration: 2, total: 6 }
  },
  {
    lineNumber: 7,
    code: 'arr[j], arr[j+1] = arr[j+1], arr[j]',
    explanation: 'Swap 64 and 25. The larger element bubbles towards the end.',
    variables: {
      arr: { value: [34, 25, 64, 12, 22, 11, 90], type: 'list', changed: true },
      n: { value: 7, type: 'int', changed: false },
      i: { value: 0, type: 'int', changed: false },
      j: { value: 1, type: 'int', changed: false }
    },
    arrays: {
      arr: { 
        values: [34, 25, 64, 12, 22, 11, 90], 
        highlightIndices: [1, 2], 
        compareIndices: [], 
        pointers: [] 
      }
    }
  },
  {
    lineNumber: 9,
    code: 'print(arr)',
    explanation: 'After several passes, the array is now sorted! Print the final result.',
    variables: {
      arr: { value: [11, 12, 22, 25, 34, 64, 90], type: 'list', changed: true },
      n: { value: 7, type: 'int', changed: false }
    },
    arrays: {
      arr: { 
        values: [11, 12, 22, 25, 34, 64, 90], 
        highlightIndices: [0, 1, 2, 3, 4, 5, 6], 
        compareIndices: [], 
        pointers: [] 
      }
    },
    output: '[11, 12, 22, 25, 34, 64, 90]'
  }
];

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

  const handleStartVisualization = useCallback(() => {
    setIsRunning(true);
    setExecutionComplete(false);
    
    // Simulate processing delay
    setTimeout(() => {
      setSteps(sampleSteps);
      setCurrentStepIndex(0);
      setCurrentLine(sampleSteps[0]?.lineNumber || null);
      setIsRunning(false);
    }, 1500);
  }, []);

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
    </div>
  );
}

export default App;
