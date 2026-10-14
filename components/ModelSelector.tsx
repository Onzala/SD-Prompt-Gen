import React, { useState, useRef, useEffect } from 'react';
import { GeminiModel } from '../types';
import { Zap, Brain, Cpu, Sparkles, ChevronDown, Check } from 'lucide-react';

interface ModelOption {
  id: GeminiModel;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: React.ReactNode;
  modelId: string;
}

interface ModelSelectorProps {
  currentModel: GeminiModel | string;
  onModelChange: (model: GeminiModel) => void;
  disabled: boolean;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: GeminiModel.FLASH_LITE_LATEST,
    name: 'Gemini Flash Lite (最新超穩)',
    badge: '推薦・低延遲無 503',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: '官方最新高可用性端點，負載穩定、避開 503 尖峰壅塞，平均 1.3 秒超速生成',
    icon: <Zap size={16} className="text-emerald-400" />,
    modelId: 'gemini-flash-lite-latest'
  },
  {
    id: GeminiModel.FLASH_3_8,
    name: 'Gemini 3.8 Flash',
    badge: '旗艦模型',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: '最新世代旗艦模型，多模態視覺與標籤極佳（遇官方尖峰時自動啟動無縫備援）',
    icon: <Sparkles size={16} className="text-blue-400" />,
    modelId: 'gemini-3.8-flash'
  },
  {
    id: GeminiModel.PRO_3_1,
    name: 'Gemini 3.1 Pro',
    badge: '深度推理',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    description: '具備高階邏輯思維與深度語意理解，適合超複雜場景與精細畫風拆解',
    icon: <Brain size={16} className="text-purple-400" />,
    modelId: 'gemini-3.1-pro-preview'
  },
  {
    id: GeminiModel.FLASH_LITE_3_1,
    name: 'Gemini 3.1 Flash Lite',
    badge: '超輕量版',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    description: '輕量化模型，提供流暢的即時互動體驗',
    icon: <Cpu size={16} className="text-indigo-400" />,
    modelId: 'gemini-3.1-flash-lite'
  },
  {
    id: GeminiModel.FLASH_LATEST,
    name: 'Gemini Flash Latest',
    badge: '通用 Flash',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    description: '通用型 Flash 端點，兼顧相容性與標準效能',
    icon: <Sparkles size={16} className="text-cyan-400" />,
    modelId: 'gemini-flash-latest'
  }
];

const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onModelChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = MODEL_OPTIONS.find(m => m.id === currentModel) || MODEL_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Dropdown trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-xl bg-slate-900 border text-left transition-all ${
          isOpen 
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg bg-slate-800/90' 
            : 'border-slate-700 hover:border-slate-600 bg-slate-900 hover:bg-slate-800/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            {selectedOption.icon}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 text-sm truncate">
                {selectedOption.name}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${selectedOption.badgeColor}`}>
                {selectedOption.badge}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono truncate">
              {selectedOption.modelId}
            </span>
          </div>
        </div>

        <div className="flex items-center pl-2 text-slate-400">
          <ChevronDown 
            size={18} 
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : ''}`} 
          />
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            選擇 Gemini 核心模型
          </div>
          {MODEL_OPTIONS.map((option) => {
            const isSelected = option.id === selectedOption.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onModelChange(option.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-all ${
                  isSelected
                    ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                    : 'hover:bg-slate-800 text-slate-300 border border-transparent'
                }`}
              >
                <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 shrink-0 mt-0.5">
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                      {option.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${option.badgeColor}`}>
                      {option.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {option.description}
                  </p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    ID: {option.modelId}
                  </span>
                </div>
                {isSelected && (
                  <div className="text-blue-400 shrink-0 mt-1">
                    <Check size={16} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
