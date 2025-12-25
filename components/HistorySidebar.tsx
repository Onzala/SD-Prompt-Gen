
import React from 'react';
import { X, Clock, Trash2, ChevronRight, Copy, Check } from 'lucide-react';
import { HistoryItem, GeminiModel } from '../types';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  onDelete: (id: string) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onSelect, 
  onClear,
  onDelete
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCopy = (e: React.MouseEvent, content: string, id: string) => {
    e.stopPropagation();
    // Extract prompt content (remove markdown code blocks if present)
    const match = content.match(/```(?:[\w]*\n)?([\s\S]*?)```/);
    const textToCopy = match ? match[1].trim() : content;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-200">
              <Clock size={20} />
              歷史紀錄
            </h2>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button 
                  onClick={onClear}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="清除全部"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {history.length === 0 ? (
              <div className="text-center text-slate-500 mt-10">
                <p>尚無歷史紀錄</p>
                <p className="text-xs mt-2">生成的提示詞將會儲存在這裡</p>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-3 cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    {/* Fix: Property 'FLASH' does not exist on type 'typeof GeminiModel'. Correcting to 'FLASH_3' */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      item.model === GeminiModel.FLASH_3 
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' 
                        : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                    }`}>
                      {/* Fix: Property 'FLASH' does not exist on type 'typeof GeminiModel'. Correcting to 'FLASH_3' */}
                      {item.model === GeminiModel.FLASH_3 ? 'Flash' : 'Pro'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>

                  <div className="mb-2">
                     <p className="text-xs text-slate-400 line-clamp-1 mb-1 font-medium">
                        {item.inputText || (item.hasImage ? '[ 僅圖片輸入 ]' : '[ 無輸入文字 ]')}
                     </p>
                     <p className="text-xs text-slate-500 line-clamp-2 font-mono bg-slate-900/50 p-1.5 rounded">
                        {item.generatedContent.replace(/```/g, '').trim()}
                     </p>
                  </div>

                  <div className="flex justify-between items-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                        }}
                        className="text-slate-500 hover:text-red-400 p-1"
                        title="刪除此項"
                      >
                          <Trash2 size={14} />
                      </button>
                      
                      <div className="flex gap-2">
                        <button
                            onClick={(e) => handleCopy(e, item.generatedContent, item.id)}
                            className="flex items-center gap-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors"
                        >
                            {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === item.id ? '已複製' : '複製'}
                        </button>
                        <span className="flex items-center gap-1 text-[10px] text-blue-400 font-medium">
                            載入 <ChevronRight size={12} />
                        </span>
                      </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default HistorySidebar;
