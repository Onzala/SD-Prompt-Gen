import React, { useState, useEffect } from 'react';
import { Copy, Check, Terminal, Layers } from 'lucide-react';

interface OutputDisplayProps {
  content: string;
  loading: boolean;
}

const CATEGORIES = [
  { label: '品質標籤 (Quality)', color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
  { label: '主體特徵 (Subject)', color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
  { label: '服裝穿著 (Attire)', color: 'text-pink-400', border: 'border-pink-500/20', bg: 'bg-pink-500/5' },
  { label: '姿勢動作 (Pose)', color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/5' },
  { label: '場景背景 (Environment)', color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/5' },
  { label: '光影氣氛 (Lighting)', color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5' },
];

const OutputDisplay: React.FC<OutputDisplayProps> = ({ content, loading }) => {
  const [copied, setCopied] = useState(false);
  const [segments, setSegments] = useState<string[]>([]);

  useEffect(() => {
    if (!content) {
      setSegments([]);
      return;
    }
    // Parse content: remove code blocks, split by newline
    const cleanText = content.replace(/```(?:[\w]*\n)?([\s\S]*?)```/g, '$1').trim();
    // Split by newline and filter out purely empty lines unless they seem intentional (though prompt asks to not leave empty)
    // We will just split by newline.
    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    setSegments(lines);
  }, [content]);

  const handleCopy = () => {
    // Copy the raw usable prompt (clean text without markdown fences)
    const match = content.match(/```(?:[\w]*\n)?([\s\S]*?)```/);
    const textToCopy = match ? match[1].trim() : content;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-500 animate-pulse bg-slate-900 rounded-xl border border-slate-800">
        <Terminal size={48} className="mb-4 opacity-50" />
        <p>正在生成提示詞...</p>
        <p className="text-xs mt-2 text-slate-600">正在分析上下文並優化標籤</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800 border-dashed">
        <Terminal size={48} className="mb-4 opacity-30" />
        <p>準備生成</p>
        <p className="text-xs mt-2 text-slate-600">結果將顯示於此</p>
      </div>
    );
  }

  return (
    <div className="relative group bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <span className="text-sm font-medium text-slate-400 flex items-center gap-2">
           <Layers size={14} /> 分段提示詞結果
        </span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            copied 
              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
          }`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? '已複製全部' : '複製全部代碼'}
        </button>
      </div>
      
      <div className="flex-1 p-4 overflow-auto space-y-3">
        {segments.map((segment, index) => {
          // If we have more segments than categories, fallback to generic styling for extras
          const category = CATEGORIES[index] || { 
            label: '其他標籤 (Extra)', 
            color: 'text-slate-400', 
            border: 'border-slate-700', 
            bg: 'bg-slate-800' 
          };

          return (
            <div key={index} className={`p-3 rounded-lg border ${category.border} ${category.bg} transition-all hover:bg-opacity-50`}>
              <div className={`text-xs font-bold mb-1.5 uppercase tracking-wider opacity-80 ${category.color}`}>
                {category.label}
              </div>
              <div className="font-mono text-sm leading-relaxed text-slate-200 break-words">
                {segment}
              </div>
            </div>
          );
        })}
        
        {segments.length === 0 && (
            <div className="text-slate-500 text-sm text-center italic p-4">
                無法解析分段內容，請參考原始輸出。
            </div>
        )}
      </div>
    </div>
  );
};

export default OutputDisplay;
