import React, { useState, useRef } from 'react';
import { GeminiModel } from '../types';
import { Zap, Brain, Cpu, Sparkles, ChevronDown, Check } from 'lucide-react';
import Popover from './Popover';

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
    badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    description: '最新世代旗艦模型，多模態視覺與標籤極佳（遇官方尖峰時自動啟動無縫備援）',
    icon: <Sparkles size={16} className="text-violet-400" />,
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = MODEL_OPTIONS.find(m => m.id === currentModel) || MODEL_OPTIONS[0];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`flex h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen
            ? 'border-violet-500/60 bg-slate-900 ring-2 ring-violet-500/20'
            : 'border-fg/[0.08] bg-slate-950/50 hover:border-fg/15 hover:bg-fg/[0.03]'
        }`}
      >
        <span className="shrink-0">{selectedOption.icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{selectedOption.name}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-violet-400' : ''}`} />
      </button>

      <Popover open={isOpen} onClose={() => setIsOpen(false)} anchorRef={triggerRef} minWidth={380} label="選擇 Gemini 模型">
        <div className="px-3 pt-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          選擇 Gemini 模型
        </div>
        <div className="space-y-0.5 overflow-y-auto p-1.5 pt-0">
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
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isSelected ? 'bg-violet-500/10 text-fg' : 'text-slate-300 hover:bg-fg/[0.04]'
                }`}
              >
                <span className="mt-0.5 shrink-0">{option.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-slate-100">{option.name}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${option.badgeColor}`}>{option.badge}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">{option.description}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{option.modelId}</span>
                </span>
                {isSelected && <Check size={15} className="mt-1 shrink-0 text-violet-400" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
};

export default ModelSelector;
