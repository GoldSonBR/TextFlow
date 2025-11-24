
import React, { useRef, useEffect, memo } from 'react';
import { NodeData, NodeType, NodeStatus } from '../types';
import { Play, FileText, CheckCircle, AlertCircle, Code, Eye, Edit3, Type, Image as ImageIcon, Lightbulb, RefreshCw } from 'lucide-react';

interface NodeComponentProps {
  node: NodeData;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onConnectStart: (id: string, x: number, y: number, isInput: boolean) => void;
  onConnectEnd: (id: string, isInput: boolean) => void;
  onUpdateContent: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  isSelected: boolean;
}

// Wrapped in memo to prevent re-renders when panning/zooming canvas if node data hasn't changed
export const NodeComponent = memo(({
  node,
  onMouseDown,
  onContextMenu,
  onConnectStart,
  onConnectEnd,
  onUpdateContent,
  onDelete,
  onRetry,
  isSelected,
}: NodeComponentProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [node.content, node.userPrompt]);

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case NodeType.INPUT: return 'border-blue-500 bg-gray-800';
      case NodeType.AI_GENERATOR: return 'border-green-500 bg-gray-800';
      case NodeType.AI_OPTIMIZER: return 'border-purple-500 bg-gray-800';
      case NodeType.AI_FACT_CHECK: return 'border-yellow-500 bg-gray-800';
      case NodeType.AI_CODER: return 'border-pink-500 bg-gray-800';
      case NodeType.OUTPUT_PREVIEW: return 'border-orange-500 bg-gray-800';
      case NodeType.IMAGE_NODE: return 'border-cyan-500 bg-gray-800';
      case NodeType.AI_BRAINSTORM: return 'border-rose-500 bg-gray-800';
      default: return 'border-gray-500 bg-gray-800';
    }
  };

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case NodeType.INPUT: return <Edit3 size={16} className="text-blue-400" />;
      case NodeType.AI_GENERATOR: return <Type size={16} className="text-green-400" />;
      case NodeType.AI_OPTIMIZER: return <FileText size={16} className="text-purple-400" />;
      case NodeType.AI_FACT_CHECK: return <CheckCircle size={16} className="text-yellow-400" />;
      case NodeType.AI_CODER: return <Code size={16} className="text-pink-400" />;
      case NodeType.OUTPUT_PREVIEW: return <Eye size={16} className="text-orange-400" />;
      case NodeType.IMAGE_NODE: return <ImageIcon size={16} className="text-cyan-400" />;
      case NodeType.AI_BRAINSTORM: return <Lightbulb size={16} className="text-rose-400" />;
    }
  };

  const handleOutputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConnectStart(node.id, node.x, node.y, false);
  };

  const handleInputMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConnectEnd(node.id, true);
  };

  const isSourceNode = node.type === NodeType.INPUT || node.type === NodeType.IMAGE_NODE || node.type === NodeType.AI_BRAINSTORM;

  return (
    <div
      className={`absolute w-80 rounded-lg shadow-lg border-2 flex flex-col transition-shadow duration-200 ${getNodeColor(node.type)} ${isSelected ? 'ring-2 ring-white shadow-2xl z-50' : 'z-10'}`}
      style={{
        left: node.x,
        top: node.y,
        cursor: 'grab',
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onContextMenu={(e) => onContextMenu(e, node.id)}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900 rounded-t-lg ${isSelected ? 'bg-gray-800' : ''}`}>
        <div className="flex items-center gap-2 font-semibold text-gray-200 text-sm">
          {getNodeIcon(node.type)}
          <span>{node.title}</span>
        </div>
        <div className="flex items-center gap-2">
           {node.status === NodeStatus.RUNNING && <span className="animate-pulse text-yellow-400 text-xs">● Processing</span>}
           {node.status === NodeStatus.COMPLETED && <span className="text-green-400 text-xs">● Done</span>}
           {node.status === NodeStatus.ERROR && <span className="text-red-400 text-xs">Error</span>}
           
           {/* Retry Button - Show if Error or Completed (to re-run) */}
           {(node.status === NodeStatus.ERROR || node.status === NodeStatus.COMPLETED) && (
             <button
               onClick={(e) => { e.stopPropagation(); onRetry(node.id); }}
               className="text-gray-400 hover:text-blue-400 p-0.5 rounded transition-colors"
               title="Retry / Regenerate"
             >
               <RefreshCw size={14} />
             </button>
           )}

          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="text-gray-500 hover:text-red-400 ml-1"
            title="Delete Node"
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-2 min-h-[80px]">
        
        {/* Quick Preview for Image Node */}
        {node.type === NodeType.IMAGE_NODE && (
          <div className="flex flex-col gap-2">
            {node.imageUrls && node.imageUrls.filter(u => u.trim()).length > 0 ? (
              <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                {node.imageUrls.filter(u => u.trim()).map((url, idx) => (
                   <img key={idx} src={url} alt={`Preview ${idx}`} className="w-full h-20 object-cover rounded border border-gray-700" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ))}
              </div>
            ) : (
              <div className="w-full h-20 bg-gray-900 flex items-center justify-center text-gray-500 text-xs italic border border-dashed border-gray-600">
                No Images
              </div>
            )}
            <div className="text-[10px] text-gray-500 text-center">
              {node.imageUrls?.filter(u => u.trim()).length || 0} Image(s) Set
            </div>
          </div>
        )}

        {/* User Input Field (Only for Input Nodes) */}
        {(node.type === NodeType.INPUT) && (
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Your Prompt</label>
            <textarea
              ref={textareaRef}
              className="w-full bg-gray-950 text-gray-200 text-sm p-2 rounded border border-gray-700 focus:border-blue-500 outline-none resize-none"
              value={node.userPrompt || ''}
              onChange={(e) => onUpdateContent(node.id, e.target.value)}
              onMouseDown={(e) => e.stopPropagation()} // Allow text selection
              placeholder="Enter your text here..."
              rows={3}
            />
          </div>
        )}

        {/* Output Display */}
        {node.type !== NodeType.INPUT && node.type !== NodeType.IMAGE_NODE && (
          <div className="flex-1 flex flex-col">
            <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Output</label>
            {node.type === NodeType.OUTPUT_PREVIEW ? (
              <div 
                className="w-full bg-white text-black text-sm p-2 rounded min-h-[16rem] h-64 overflow-auto resize-y"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div dangerouslySetInnerHTML={{ __html: node.content }} />
                {!node.content && <p className="text-gray-400 italic text-xs">Waiting for HTML input...</p>}
              </div>
            ) : (
              <div 
                className="w-full bg-gray-950 text-gray-300 text-xs p-2 rounded border border-gray-700 min-h-[8rem] h-32 overflow-y-auto whitespace-pre-wrap font-mono resize-y"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {node.content || <span className="text-gray-600 italic">Waiting for execution...</span>}
              </div>
            )}
             {node.errorMessage && (
              <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} /> {node.errorMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connection Points */}
      {/* Input Handle (Left) - Hidden for Source Nodes including BRAINSTORM */}
      {!isSourceNode && (
        <div 
          className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-gray-700 rounded-full border-2 border-gray-500 hover:border-white cursor-crosshair z-10"
          onMouseUp={handleInputMouseUp}
          title="Input"
        />
      )}

      {/* Output Handle (Right) */}
      {node.type !== NodeType.OUTPUT_PREVIEW && (
        <div 
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-gray-700 rounded-full border-2 border-gray-500 hover:border-white cursor-crosshair z-10"
          onMouseDown={handleOutputClick}
          title="Output"
        />
      )}
    </div>
  );
});
