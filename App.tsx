
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodeComponent } from './components/NodeComponent';
import { NodeType, NodeData, Connection, NodeStatus, Workspace } from './types';
import { Plus, Play, Trash2, Save, Upload, Zap, Settings, Layout, Layers, Image as ImageIcon, ChevronRight, X, ChevronDown, Check, Lightbulb, Copy, Edit2, Edit3, Type, FileText, Code, Eye, RefreshCw } from 'lucide-react';
import { generateText } from './services/geminiService';

// --- Initial Data ---

const INITIAL_NODES: NodeData[] = [
  {
    id: 'node-1',
    type: NodeType.INPUT,
    x: 50,
    y: 250,
    title: 'Topic Input',
    content: '',
    userPrompt: 'The future of electric aviation',
    status: NodeStatus.IDLE,
  },
  {
    id: 'node-2',
    type: NodeType.AI_GENERATOR,
    x: 400,
    y: 200,
    title: 'Blog Writer',
    content: '',
    systemInstruction: 'You are an expert blog writer. Write a comprehensive, engaging blog post about the user provided topic. Use markdown formatting.',
    model: 'gemini-2.5-flash',
    status: NodeStatus.IDLE,
  },
  {
    id: 'node-5',
    type: NodeType.AI_CODER,
    x: 800,
    y: 250,
    title: 'HTML Builder',
    content: '',
    systemInstruction: 'You are a frontend web developer. Take the provided blog content and wrap it in the provided HTML template. If no template is provided, create a modern one. If image URLs are provided in the input, use them in <img> tags.',
    model: 'gemini-2.5-flash',
    status: NodeStatus.IDLE,
  },
  {
    id: 'node-6',
    type: NodeType.OUTPUT_PREVIEW,
    x: 1200,
    y: 250,
    title: 'Web Preview',
    content: '',
    status: NodeStatus.IDLE,
  }
];

const INITIAL_CONNECTIONS: Connection[] = [
    { id: 'c1', sourceId: 'node-1', targetId: 'node-2' },
    { id: 'c4', sourceId: 'node-2', targetId: 'node-5' },
    { id: 'c5', sourceId: 'node-5', targetId: 'node-6' },
];

const DEFAULT_WORKSPACE: Workspace = {
    id: 'ws-1',
    name: 'Tech Blog Campaign',
    globalContext: 'Company Name: FutureTech Inc.\nVoice: Professional, innovative, and optimistic.\nTarget Audience: Tech enthusiasts and investors.',
    nodes: INITIAL_NODES,
    connections: INITIAL_CONNECTIONS,
    pan: { x: 0, y: 0 },
    scale: 1
};

interface ContextMenuState {
    show: boolean;
    x: number;
    y: number;
    type: 'CANVAS' | 'NODE';
    targetId?: string;
}

export default function App() {
  // --- State ---
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    // Persistence: Initialize from LocalStorage if available
    const saved = localStorage.getItem('textflow_workspaces');
    if (saved) {
      try {
        const parsed: Workspace[] = JSON.parse(saved);
        // Safety: Reset any 'RUNNING' status to 'IDLE' because background processes die on refresh
        return parsed.map(ws => ({
          ...ws,
          nodes: ws.nodes.map(n => n.status === NodeStatus.RUNNING ? { ...n, status: NodeStatus.IDLE } : n)
        }));
      } catch (e) {
        console.error("Failed to parse workspaces from storage", e);
      }
    }
    return [DEFAULT_WORKSPACE];
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    // Persistence: Load active ID
    return localStorage.getItem('textflow_active_id') || DEFAULT_WORKSPACE.id;
  });
  
  // Derived state for easier access
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const nodes = activeWorkspace.nodes;
  const connections = activeWorkspace.connections;
  const scale = activeWorkspace.scale;
  const pan = activeWorkspace.pan;

  // Persistence: Save on Change
  useEffect(() => {
    localStorage.setItem('textflow_workspaces', JSON.stringify(workspaces));
    localStorage.setItem('textflow_active_id', activeWorkspaceId);
  }, [workspaces, activeWorkspaceId]);

  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [connectionStart, setConnectionStart] = useState<{ id: string, x: number, y: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }
            if (selectedNodeId) {
                deleteNode(selectedNodeId);
            }
            if (selectedConnectionId) {
                deleteConnection(selectedConnectionId);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedConnectionId, activeWorkspaceId]);

  // --- Workspace Helpers ---

  const updateActiveWorkspace = (updates: Partial<Workspace>) => {
      setWorkspaces(prev => prev.map(w => w.id === activeWorkspaceId ? { ...w, ...updates } : w));
  };

  const createWorkspace = () => {
      const newWs: Workspace = {
          id: `ws-${Date.now()}`,
          name: 'New Workspace',
          globalContext: '',
          nodes: [],
          connections: [],
          pan: { x: 0, y: 0 },
          scale: 1
      };
      setWorkspaces([...workspaces, newWs]);
      setActiveWorkspaceId(newWs.id);
  };

  const deleteWorkspace = (id: string) => {
      if (workspaces.length <= 1) return;
      const newWorkspaces = workspaces.filter(w => w.id !== id);
      setWorkspaces(newWorkspaces);
      if (activeWorkspaceId === id) setActiveWorkspaceId(newWorkspaces[0].id);
  };

  // --- Canvas Interaction Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const zoomSensitivity = 0.001;
    const delta = e.deltaY;
    const newScale = Math.min(Math.max(0.1, scale - delta * zoomSensitivity), 3);

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - pan.x) / scale;
    const worldY = (mouseY - pan.y) / scale;
    const newPanX = mouseX - worldX * newScale;
    const newPanY = mouseY - worldY * newScale;

    updateActiveWorkspace({ 
        scale: newScale,
        pan: { x: newPanX, y: newPanY }
    });
    setContextMenu(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setSelectedNodeId(null);
    setSelectedConnectionId(null);
    setContextMenu(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
        setMousePos({
            x: (e.clientX - rect.left - pan.x) / scale,
            y: (e.clientY - rect.top - pan.y) / scale
        });
    }

    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      updateActiveWorkspace({ pan: { x: pan.x + dx, y: pan.y + dy } });
      setDragStart({ x: e.clientX, y: e.clientY });
    }

    if (draggedNodeId) {
       updateActiveWorkspace({
           nodes: nodes.map(n => {
               if (n.id === draggedNodeId) {
                   return {
                       ...n,
                       x: n.x + (e.movementX / scale),
                       y: n.y + (e.movementY / scale)
                   };
               }
               return n;
           })
       });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNodeId(null);
    setConnectionStart(null);
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({
          show: true,
          x: e.clientX,
          y: e.clientY,
          type: 'CANVAS'
      });
  };

  // --- Node Handlers ---

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (e.button === 2) return; 
      setSelectedNodeId(id);
      setSelectedConnectionId(null);
      setDraggedNodeId(id);
      setContextMenu(null);
  }, []);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
          show: true,
          x: e.clientX,
          y: e.clientY,
          type: 'NODE',
          targetId: id
      });
      setSelectedNodeId(id); 
  }, []);

  const updateNodeContent = useCallback((id: string, text: string) => {
      setWorkspaces(prev => prev.map(w => {
        if(w.id !== activeWorkspaceId) return w;
        return {
            ...w,
            nodes: w.nodes.map(n => n.id === id ? { ...n, userPrompt: text } : n)
        }
      }));
  }, [activeWorkspaceId]);

  const updateNodeData = (id: string, updates: Partial<NodeData>) => {
      updateActiveWorkspace({
          nodes: nodes.map(n => n.id === id ? { ...n, ...updates } : n)
      });
  };

  const deleteNode = useCallback((id: string) => {
      setWorkspaces(prev => prev.map(w => {
          if (w.id !== activeWorkspaceId) return w;
          return {
              ...w,
              nodes: w.nodes.filter(n => n.id !== id),
              connections: w.connections.filter(c => c.sourceId !== id && c.targetId !== id)
          };
      }));
      setSelectedNodeId(null);
      setContextMenu(null);
  }, [activeWorkspaceId]);

  const duplicateNode = (id: string) => {
      const nodeToClone = nodes.find(n => n.id === id);
      if (!nodeToClone) return;

      const newNode: NodeData = {
          ...nodeToClone,
          id: `node-${Date.now()}`,
          x: nodeToClone.x + 40,
          y: nodeToClone.y + 40,
          title: `${nodeToClone.title} (Copy)`,
          status: NodeStatus.IDLE,
          content: ''
      };
      
      updateActiveWorkspace({ nodes: [...nodes, newNode] });
      setSelectedNodeId(newNode.id);
      setContextMenu(null);
  };

  const deleteConnection = (id: string) => {
      updateActiveWorkspace({
          connections: connections.filter(c => c.id !== id)
      });
      setSelectedConnectionId(null);
  };

  const addNode = (type: NodeType, position?: {x: number, y: number}) => {
      const id = `node-${Date.now()}`;
      
      let x = 100;
      let y = 100;

      if (position) {
          x = (position.x - pan.x) / scale;
          y = (position.y - pan.y) / scale;
      } else {
          const rect = canvasRef.current?.getBoundingClientRect();
          x = rect ? (-pan.x + rect.width / 2) / scale : 100;
          y = rect ? (-pan.y + rect.height / 2) / scale : 100;
      }

      let title = "New Node";
      let model = 'gemini-2.5-flash';
      let systemInstruction = "";

      switch(type) {
          case NodeType.INPUT: title = "Input"; break;
          case NodeType.AI_BRAINSTORM: 
              title = "Brainstorm"; 
              systemInstruction = "You are a creative strategist. Generate 5-10 engaging blog post topics relevant to the company described in the global context. Output them as a numbered list."; 
              break;
          case NodeType.AI_GENERATOR: title = "AI Writer"; systemInstruction = "Write a comprehensive blog post..."; break;
          case NodeType.AI_OPTIMIZER: title = "Optimizer"; systemInstruction = "Optimize the input text for SEO..."; break;
          case NodeType.AI_FACT_CHECK: title = "Fact Check"; systemInstruction = "Verify the facts in this text..."; model = "gemini-3-pro-preview"; break;
          case NodeType.AI_CODER: title = "HTML Builder"; systemInstruction = "Convert content to HTML..."; break;
          case NodeType.OUTPUT_PREVIEW: title = "Preview"; break;
          case NodeType.IMAGE_NODE: title = "Image Import"; break;
      }

      const newNode: NodeData = {
          id,
          type,
          x,
          y,
          title,
          content: '',
          userPrompt: type === NodeType.INPUT ? '' : undefined,
          systemInstruction,
          model,
          status: NodeStatus.IDLE,
          imageUrls: type === NodeType.IMAGE_NODE ? [] : undefined,
          customTemplate: type === NodeType.AI_CODER ? '' : undefined
      };
      
      updateActiveWorkspace({ nodes: [...nodes, newNode] });
      setSelectedNodeId(id);
      setSelectedConnectionId(null);
      setContextMenu(null);
  };

  // --- Connection Handlers ---

  const handleConnectStart = useCallback((nodeId: string, x: number, y: number, isInput: boolean) => {
      if (!isInput) {
          setConnectionStart({
              id: nodeId,
              x: x + 320,
              y: y + 40
          });
      }
      setContextMenu(null);
  }, []);

  const handleConnectEnd = useCallback((targetId: string, isInput: boolean) => {
      if (connectionStart && isInput && connectionStart.id !== targetId) {
          const exists = connections.find(c => c.sourceId === connectionStart.id && c.targetId === targetId);
          if (!exists) {
              setWorkspaces(prev => prev.map(w => {
                  if (w.id !== activeWorkspaceId) return w;
                  return {
                      ...w,
                      connections: [...w.connections, {
                          id: `c-${Date.now()}`,
                          sourceId: connectionStart.id,
                          targetId
                      }]
                  };
              }));
          }
      }
      setConnectionStart(null);
  }, [connectionStart, connections, activeWorkspaceId]);

  // --- Execution Engine Refactored ---

  // Helper: Find all nodes that depend on a specific node (recursively)
  const getDescendantNodeIds = (startNodeId: string): Set<string> => {
    const descendants = new Set<string>();
    const stack = [startNodeId];
    
    while(stack.length > 0) {
        const current = stack.pop()!;
        // Find connections where current node is the source
        const outgoing = connections.filter(c => c.sourceId === current);
        for(const conn of outgoing) {
            if(!descendants.has(conn.targetId)) {
                descendants.add(conn.targetId);
                stack.push(conn.targetId);
            }
        }
    }
    return descendants;
  };

  // Core Execution Loop: Runs any node that is IDLE and has satisfied inputs
  const processWorkflowQueue = async (initialNodesState: NodeData[]) => {
      setIsExecuting(true);
      
      // We keep a local reference to nodes to track state within this async execution scope
      let currentNodes = [...initialNodesState];

      const updateLocalAndState = (id: string, updates: Partial<NodeData>) => {
          currentNodes = currentNodes.map(n => n.id === id ? { ...n, ...updates } : n);
          setWorkspaces(prev => prev.map(w => {
              if (w.id === activeWorkspaceId) {
                  return { ...w, nodes: w.nodes.map(n => n.id === id ? { ...n, ...updates } : n) };
              }
              return w;
          }));
      };

      try {
        // Step 1: Mark "Instant" nodes as complete if they aren't already
        const instantNodes = currentNodes.filter(n => (n.type === NodeType.INPUT || n.type === NodeType.IMAGE_NODE) && n.status === NodeStatus.IDLE);
        for (const node of instantNodes) {
             const content = node.type === NodeType.INPUT ? (node.userPrompt || '') : (node.imageUrls?.join('\n') || '');
             updateLocalAndState(node.id, { status: NodeStatus.COMPLETED, content });
        }

        let hasProcessed = true;
        while (hasProcessed) {
            hasProcessed = false;
            
            const nodesToRun = currentNodes.filter(node => {
                if (node.status !== NodeStatus.IDLE) return false;
                
                if (node.type === NodeType.AI_BRAINSTORM) return true;

                const incomingEdges = connections.filter(c => c.targetId === node.id);
                if (incomingEdges.length === 0 && node.type !== NodeType.INPUT && node.type !== NodeType.IMAGE_NODE) return false;

                const allSourcesReady = incomingEdges.every(edge => {
                    const sourceNode = currentNodes.find(n => n.id === edge.sourceId);
                    return sourceNode && sourceNode.status === NodeStatus.COMPLETED;
                });
                return allSourcesReady;
            });

            for (const node of nodesToRun) {
                hasProcessed = true;
                updateLocalAndState(node.id, { status: NodeStatus.RUNNING, errorMessage: undefined });

                const incomingEdges = connections.filter(c => c.targetId === node.id);
                let textInputs: string[] = [];
                let imageInputs: string[] = [];

                for (const edge of incomingEdges) {
                    const source = currentNodes.find(n => n.id === edge.sourceId);
                    if (source) {
                        if (source.type === NodeType.IMAGE_NODE) {
                            if (source.imageUrls) imageInputs.push(...source.imageUrls);
                        } else {
                            textInputs.push(source.content);
                        }
                    }
                }

                const inputTextCombined = textInputs.join('\n\n');

                if (node.type === NodeType.OUTPUT_PREVIEW) {
                     await new Promise(r => setTimeout(r, 500));
                     updateLocalAndState(node.id, { status: NodeStatus.COMPLETED, content: inputTextCombined });
                } else {
                    try {
                        let prompt = inputTextCombined;
                        
                        if (node.type === NodeType.AI_BRAINSTORM) {
                            prompt = "Generate a list of relevant topics based on the global context provided.";
                        } else if (node.type === NodeType.AI_CODER && node.customTemplate) {
                            prompt = `
CONTENT TO INSERT:
${inputTextCombined}

HTML TEMPLATE:
${node.customTemplate}

INSTRUCTIONS:
Insert the content into the HTML template. Do not change the layout structure, only add the text.
${imageInputs.length > 0 ? `Also, insert these images where appropriate in the HTML: ${imageInputs.join(', ')}` : ''}
                            `;
                        } else if (imageInputs.length > 0) {
                            prompt += `\n\nAvailable Image URLs: ${imageInputs.join(', ')}`;
                        }

                        const result = await generateText(
                            node.model || 'gemini-2.5-flash', 
                            prompt, 
                            node.systemInstruction,
                            activeWorkspace.globalContext
                        );
                        updateLocalAndState(node.id, { status: NodeStatus.COMPLETED, content: result });
                    } catch (e: any) {
                        updateLocalAndState(node.id, { status: NodeStatus.ERROR, errorMessage: e.message || "Unknown error" });
                    }
                }
            }
            await new Promise(r => setTimeout(r, 100));
        }

      } catch (error) {
          console.error("Workflow failed", error);
      } finally {
          setIsExecuting(false);
      }
  };

  // Run Button Logic: Resets ALL nodes to IDLE and starts
  const executeWorkflow = async () => {
      // Explicitly type to avoid TS errors
      const resetNodes: NodeData[] = activeWorkspace.nodes.map(n => ({ 
          ...n, 
          status: NodeStatus.IDLE, 
          errorMessage: undefined 
      }));
      
      updateActiveWorkspace({ nodes: resetNodes });
      // Short delay to allow state update to propagate visually before logic starts
      await new Promise(r => setTimeout(r, 50));
      processWorkflowQueue(resetNodes);
  };

  // Retry Button Logic: Resets ONLY target node and its descendants, then starts
  const handleRetryNode = async (nodeId: string) => {
      if (isExecuting) return;

      const descendants = getDescendantNodeIds(nodeId);
      const nodesToReset = new Set([nodeId, ...descendants]);

      const updatedNodes: NodeData[] = activeWorkspace.nodes.map(n => {
          if (nodesToReset.has(n.id)) {
              return { ...n, status: NodeStatus.IDLE, errorMessage: undefined };
          }
          return n;
      });

      updateActiveWorkspace({ nodes: updatedNodes });
      await new Promise(r => setTimeout(r, 50));
      processWorkflowQueue(updatedNodes);
  };

  // --- Rendering Helpers ---

  const renderConnections = () => {
    return connections.map(conn => {
        const source = nodes.find(n => n.id === conn.sourceId);
        const target = nodes.find(n => n.id === conn.targetId);
        if (!source || !target) return null;

        const sx = source.x + 320; 
        const sy = source.y + 40;
        const tx = target.x;
        const ty = target.y + 40;

        const dist = Math.abs(tx - sx);
        const cp1x = sx + dist * 0.5;
        const cp2x = tx - dist * 0.5;
        const pathData = `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`;

        const isSelected = selectedConnectionId === conn.id;

        return (
            <g 
              key={conn.id} 
              onClick={(e) => { e.stopPropagation(); setSelectedConnectionId(conn.id); setSelectedNodeId(null); setContextMenu(null); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); deleteConnection(conn.id); }}
              className="cursor-pointer group pointer-events-auto"
            >
                <path d={pathData} stroke="transparent" strokeWidth="20" fill="none" />
                <path 
                  d={pathData} 
                  stroke={isSelected ? "#3b82f6" : "#4a5568"} 
                  strokeWidth="4" 
                  fill="none" 
                  className={`transition-colors ${isSelected ? '' : 'group-hover:stroke-gray-500'}`}
                />
                 <path d={pathData} stroke={isSelected ? "#60a5fa" : "#a0aec0"} strokeWidth="2" fill="none" className={isExecuting ? "animate-pulse" : ""} strokeDasharray={isSelected ? "5,5" : ""} />
            </g>
        );
    });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 text-white overflow-hidden font-sans">
      
      {/* Top Bar */}
      <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
               <Zap size={18} className="text-white" />
             </div>
             <span className="font-bold text-lg hidden md:block">TextFlow AI</span>
           </div>
           
           <div className="relative group ml-4">
               <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-sm transition">
                   <Layers size={14} className="text-gray-400"/>
                   <span className="max-w-[150px] truncate">{activeWorkspace.name}</span>
                   <ChevronDown size={12} />
               </button>
               <div className="absolute top-full left-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded shadow-xl hidden group-hover:block p-1">
                   {workspaces.map(ws => (
                       <div 
                        key={ws.id} 
                        onClick={() => setActiveWorkspaceId(ws.id)}
                        className={`flex items-center justify-between p-2 rounded text-sm cursor-pointer ${activeWorkspaceId === ws.id ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                       >
                           <span className="truncate">{ws.name}</span>
                           {activeWorkspaceId === ws.id && <Check size={12}/>}
                       </div>
                   ))}
                   <div className="h-px bg-gray-700 my-1"></div>
                   <button onClick={createWorkspace} className="w-full text-left p-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-2">
                       <Plus size={12} /> New Workspace
                   </button>
               </div>
           </div>
        </div>

        <div className="flex items-center gap-3">
             <div className="text-xs text-gray-500 hidden md:block">
                 {isExecuting ? 'Workflow Running...' : 'Ready'}
             </div>
            <button 
                onClick={executeWorkflow}
                disabled={isExecuting}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm transition shadow-lg ${isExecuting ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
                {isExecuting ? <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : <Play size={14} fill="currentColor" />}
                <span>Run</span>
            </button>
             <button 
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded hover:bg-gray-800 transition text-gray-400`}
            >
                <Settings size={18} />
            </button>
        </div>
      </div>

      <div className="flex-1 relative flex overflow-hidden">
        
        {/* Node Toolbox */}
        <div className="w-16 md:w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-40">
            <div className="p-4 border-b border-gray-800 hidden md:block">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Node Types</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {[
                    { type: NodeType.INPUT, label: 'Input', desc: 'User Prompt', color: 'bg-blue-500' },
                    { type: NodeType.AI_BRAINSTORM, label: 'Brainstorm', desc: 'Topic Ideas', color: 'bg-rose-500' },
                    { type: NodeType.IMAGE_NODE, label: 'Image', desc: 'Import URL', color: 'bg-cyan-500' },
                    { type: NodeType.AI_GENERATOR, label: 'AI Writer', desc: 'Content Gen', color: 'bg-green-500' },
                    { type: NodeType.AI_OPTIMIZER, label: 'Optimizer', desc: 'SEO / Editing', color: 'bg-purple-500' },
                    { type: NodeType.AI_FACT_CHECK, label: 'Fact Check', desc: 'Verification', color: 'bg-yellow-500' },
                    { type: NodeType.AI_CODER, label: 'HTML Builder', desc: 'Code Gen', color: 'bg-pink-500' },
                    { type: NodeType.OUTPUT_PREVIEW, label: 'Preview', desc: 'Visual Output', color: 'bg-orange-500' },
                ].map(item => (
                    <button 
                        key={item.type}
                        onClick={() => addNode(item.type)} 
                        className="w-full flex items-center gap-3 p-2 rounded bg-gray-800 hover:bg-gray-750 border border-gray-800 hover:border-gray-600 transition group"
                    >
                        <div className={`w-3 h-3 ${item.color} rounded-full flex-shrink-0`}></div>
                        <div className="hidden md:block text-left">
                            <div className="font-medium text-sm text-gray-300 group-hover:text-white">{item.label}</div>
                            <div className="text-[10px] text-gray-500">{item.desc}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* Canvas */}
        <div 
            ref={canvasRef}
            className="flex-1 bg-[#0d1117] relative cursor-grab active:cursor-grabbing overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onContextMenu={handleCanvasContextMenu}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ 
                backgroundImage: 'radial-gradient(#2d3748 1px, transparent 1px)', 
                backgroundSize: `${20 * scale}px ${20 * scale}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
        >
            <div 
                style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, 
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    willChange: 'transform'
                }}
            >
                <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none" style={{ zIndex: 0 }}>
                    {renderConnections()}
                    {connectionStart && (
                        <path 
                            d={`M ${connectionStart.x} ${connectionStart.y} C ${connectionStart.x + 50} ${connectionStart.y}, ${mousePos.x - 50} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`} 
                            stroke="#63b3ed" 
                            strokeWidth="2" 
                            strokeDasharray="5,5" 
                            fill="none" 
                        />
                    )}
                </svg>
                <div className="pointer-events-auto">
                    {nodes.map(node => (
                        <NodeComponent 
                            key={node.id}
                            node={node}
                            onMouseDown={handleNodeMouseDown}
                            onContextMenu={handleNodeContextMenu}
                            onConnectStart={handleConnectStart}
                            onConnectEnd={handleConnectEnd}
                            onUpdateContent={updateNodeContent}
                            onDelete={deleteNode}
                            onRetry={handleRetryNode}
                            isSelected={selectedNodeId === node.id}
                        />
                    ))}
                </div>
            </div>
        </div>

        {/* Context Menu */}
        {contextMenu && contextMenu.show && (
            <div 
                className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-48 overflow-hidden"
                style={{ top: contextMenu.y, left: contextMenu.x }}
                onMouseDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                {contextMenu.type === 'CANVAS' && (
                    <div className="py-1">
                        <div className="px-3 py-1 text-xs font-bold text-gray-500 uppercase">Add Node</div>
                        <button onClick={() => addNode(NodeType.INPUT, {x: contextMenu.x, y: contextMenu.y})} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"><Edit3 size={14}/> Input</button>
                        <button onClick={() => addNode(NodeType.AI_BRAINSTORM, {x: contextMenu.x, y: contextMenu.y})} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"><Lightbulb size={14}/> Brainstorm</button>
                        <button onClick={() => addNode(NodeType.IMAGE_NODE, {x: contextMenu.x, y: contextMenu.y})} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"><ImageIcon size={14}/> Image</button>
                        <div className="h-px bg-gray-700 my-1"></div>
                        <button onClick={() => addNode(NodeType.AI_GENERATOR, {x: contextMenu.x, y: contextMenu.y})} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"><Type size={14}/> AI Writer</button>
                        <button onClick={() => addNode(NodeType.AI_OPTIMIZER, {x: contextMenu.x, y: contextMenu.y})} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"><FileText size={14}/> Optimizer</button>
                        <button onClick={() => addNode(NodeType.AI_FACT_CHECK, {x: contextMenu.x, y: contextMenu.y})} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"><Check size={14}/> Fact Check</button>
                        <button onClick={() => addNode(NodeType.AI_CODER, {x: contextMenu.x, y: contextMenu.y})} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"><Code size={14}/> HTML Builder</button>
                        <button onClick={() => addNode(NodeType.OUTPUT_PREVIEW, {x: contextMenu.x, y: contextMenu.y})} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"><Eye size={14}/> Preview</button>
                    </div>
                )}
                {contextMenu.type === 'NODE' && contextMenu.targetId && (
                    <div className="py-1">
                        <div className="px-3 py-1 text-xs font-bold text-gray-500 uppercase">Node Actions</div>
                        <button 
                            onClick={() => { setSelectedNodeId(contextMenu.targetId!); setContextMenu(null); }} 
                            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                        >
                            <Edit2 size={14}/> Edit
                        </button>
                        <button 
                            onClick={() => duplicateNode(contextMenu.targetId!)} 
                            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                        >
                            <Copy size={14}/> Duplicate
                        </button>
                         <button 
                            onClick={() => handleRetryNode(contextMenu.targetId!)} 
                            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                        >
                            <RefreshCw size={14}/> Retry / Run From Here
                        </button>
                        <div className="h-px bg-gray-700 my-1"></div>
                        <button 
                            onClick={() => deleteNode(contextMenu.targetId!)} 
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                        >
                            <Trash2 size={14}/> Delete
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Right Sidebar */}
        <div className={`bg-gray-900 border-l border-gray-800 transition-all duration-300 flex flex-col z-40 ${selectedNode ? 'w-80' : 'w-0'}`}>
            {selectedNode && (
                <div className="w-80 flex flex-col h-full">
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                        <h3 className="font-bold text-gray-200">Properties</h3>
                        <button onClick={() => setSelectedNodeId(null)} className="text-gray-500 hover:text-white"><X size={16}/></button>
                    </div>
                    
                    <div className="p-4 flex-1 overflow-y-auto space-y-6">
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Title</label>
                            <input 
                                type="text" 
                                value={selectedNode.title} 
                                onChange={(e) => updateNodeData(selectedNode.id, { title: e.target.value })}
                                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none"
                            />
                        </div>

                        {(selectedNode.type === NodeType.AI_GENERATOR || selectedNode.type === NodeType.AI_OPTIMIZER || selectedNode.type === NodeType.AI_FACT_CHECK || selectedNode.type === NodeType.AI_CODER || selectedNode.type === NodeType.AI_BRAINSTORM) && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">AI Model</label>
                                <select 
                                    value={selectedNode.model} 
                                    onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                >
                                    <option value="gemini-2.5-flash">Gemini Flash (Fast)</option>
                                    <option value="gemini-3-pro-preview">Gemini Pro (Smart)</option>
                                    <option value="gemini-2.5-flash-lite-latest">Gemini Lite (Cheaper)</option>
                                </select>
                            </div>
                        )}

                        {(selectedNode.type === NodeType.AI_GENERATOR || selectedNode.type === NodeType.AI_OPTIMIZER || selectedNode.type === NodeType.AI_FACT_CHECK || selectedNode.type === NodeType.AI_CODER || selectedNode.type === NodeType.AI_BRAINSTORM) && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">System Instruction / Prompt</label>
                                <textarea 
                                    value={selectedNode.systemInstruction || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { systemInstruction: e.target.value })}
                                    className="w-full h-32 bg-gray-800 border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none resize-none"
                                    placeholder="How should the AI behave?"
                                />
                                <p className="text-[10px] text-gray-500">Overrides global context specific to this node.</p>
                            </div>
                        )}

                        {selectedNode.type === NodeType.AI_CODER && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                    <Layout size={12}/> Custom HTML Template
                                </label>
                                <textarea 
                                    value={selectedNode.customTemplate || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { customTemplate: e.target.value })}
                                    className="w-full h-40 bg-gray-800 border border-gray-700 rounded p-2 text-xs font-mono focus:border-blue-500 outline-none"
                                    placeholder="<div>Paste raw HTML here...</div>"
                                />
                                <p className="text-[10px] text-gray-500">AI will fill content into this structure.</p>
                            </div>
                        )}

                        {selectedNode.type === NodeType.IMAGE_NODE && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                    <ImageIcon size={12}/> Image URLs (One per line)
                                </label>
                                <textarea 
                                    value={selectedNode.imageUrls?.join('\n') || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { imageUrls: e.target.value.split('\n').filter(line => line.trim() !== '' || line === '\n') })}
                                    className="w-full h-32 bg-gray-800 border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none whitespace-pre"
                                    placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                                />
                            </div>
                        )}
                        
                        <div className="pt-4 border-t border-gray-800">
                             <button onClick={() => deleteNode(selectedNode.id)} className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 py-2 rounded border border-gray-700 hover:border-red-900 bg-gray-800/50">
                                 <Trash2 size={14} /> Delete Node
                             </button>
                        </div>

                    </div>
                </div>
            )}
        </div>

        {/* Settings Modal */}
        {showSettings && (
            <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                <div className="bg-gray-850 w-full max-w-2xl rounded-lg shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-900">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Settings size={20} className="text-blue-400"/> Settings & Workspace Context
                        </h2>
                        <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-6">
                        
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Layers size={16} className="text-purple-400" /> 
                                Current Workspace: {activeWorkspace.name}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Workspace Name</label>
                                    <input 
                                        type="text" 
                                        value={activeWorkspace.name}
                                        onChange={(e) => updateActiveWorkspace({ name: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">
                                        Global Context / Company Description
                                    </label>
                                    <textarea 
                                        value={activeWorkspace.globalContext}
                                        onChange={(e) => updateActiveWorkspace({ globalContext: e.target.value })}
                                        className="w-full h-40 bg-gray-800 border border-gray-600 rounded p-3 text-sm focus:border-blue-500 outline-none leading-relaxed"
                                        placeholder="Describe the company, the tone of voice, key facts, and data that ALL AI nodes should know about..."
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        This text is prepended to <strong>every</strong> AI prompt in this workspace. Use it to define the company voice, brand guidelines, or shared knowledge.
                                    </p>
                                </div>
                            </div>
                        </div>

                         <div className="bg-red-900/20 p-4 rounded-lg border border-red-900/50">
                            <h3 className="text-sm font-bold text-red-400 mb-2">Danger Zone</h3>
                             <button 
                                onClick={() => { deleteWorkspace(activeWorkspace.id); setShowSettings(false); }}
                                disabled={workspaces.length === 1}
                                className={`px-4 py-2 rounded bg-red-600 text-white text-sm font-bold ${workspaces.length === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500'}`}
                             >
                                 Delete This Workspace
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
