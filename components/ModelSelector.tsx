import React, { useState, useRef, useEffect } from 'react';
import { GeminiModel } from '../types';
import { Zap, Brain, Rocket, ChevronDown, Cpu } from 'lucide-react';

interface ModelSelectorProps {
  currentModel: GeminiModel;
  onModelChange: (model: GeminiModel) => void;
  disabled: boolean;
}

/** 模型引擎選擇器 — 下拉選單版本 */
const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onModelChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const models = [
    {
      id: GeminiModel.FLASH_3,
      label: 'Flash',
      fullName: 'Gemini 3 Flash',
      icon: <Zap size={14} />,
      color: 'text-blue-400',
      dotColor: 'bg-blue-500',
      description: '推薦首選，反應迅速且指令遵循力強',
    },
    {
      id: GeminiModel.PRO_3,
      label: 'Pro',
      fullName: 'Gemini 3 Pro',
      icon: <Brain size={14} />,
      color: 'text-purple-400',
      dotColor: 'bg-purple-500',
      description: '最強模型，擅長複雜構圖與精細細節描述',
    },
    {
      id: GeminiModel.GEMMA_3,
      label: 'Gemma',
      fullName: 'Gemma 3 27B',
      icon: <Cpu size={14} />,
      color: 'text-orange-400',
      dotColor: 'bg-orange-500',
      description: '開放權重模型，適合本地運行與隱私優先',
    },
    {
      id: GeminiModel.LITE_25,
      label: 'Lite',
      fullName: '2.5 Lite',
      icon: <Rocket size={14} />,
      color: 'text-emerald-400',
      dotColor: 'bg-emerald-500',
      description: '輕量高效，適合快速產生簡單標籤',
    },
  ];

  const current = models.find(m => m.id === currentModel) || models[0];

  // 點擊外部時關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      {/* 觸發按鈕 */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all duration-200
          ${isOpen
            ? 'border-blue-500/40 bg-blue-500/10 text-white'
            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className={`flex items-center gap-1.5 ${current.color}`}>
          {current.icon}
          <span className="text-slate-200 font-bold">{current.fullName}</span>
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 下拉選單 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 glass-panel rounded-xl border border-white/10 shadow-2xl shadow-black/40 z-50 overflow-hidden animate-crop-modal-in">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onModelChange(m.id);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-150
                ${currentModel === m.id
                  ? 'bg-white/10'
                  : 'hover:bg-white/5'}
              `}
            >
              {/* 狀態指示點 */}
              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${currentModel === m.id ? m.dotColor : 'bg-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-1.5 text-sm font-bold ${currentModel === m.id ? 'text-white' : 'text-slate-300'}`}>
                  {m.icon}
                  {m.fullName}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{m.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;