import React from 'react';
import { PromptFormat } from '../types';

interface FormatSelectorProps {
  currentFormat: PromptFormat;
  onFormatChange: (format: PromptFormat) => void;
  disabled: boolean;
}

const OPTIONS = [
  {
    id: PromptFormat.SD,
    name: 'Stable Diffusion',
    syntax: '(tag:1.2)',
    active: 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/40',
    badge: 'bg-sky-500/20 text-sky-200',
    help: '圓括號權重語法，6 段分類輸出，附完整 SD 負面提示詞。',
  },
  {
    id: PromptFormat.NAI,
    name: 'NovelAI',
    syntax: '{tag}',
    active: 'bg-violet-500/15 text-violet-100 ring-1 ring-violet-400/40',
    badge: 'bg-violet-500/20 text-violet-200',
    help: 'Danbooru 標籤規範，{tag} 花括號每層 +5% 權重，自動加入年份語義與 Undesired Content。',
  },
];

const FormatSelector: React.FC<FormatSelectorProps> = ({ currentFormat, onFormatChange, disabled }) => {
  return (
    <div className="min-w-0">
      <div className="field-label" id="format-label">輸出格式</div>
      <div role="radiogroup" aria-labelledby="format-label"
        className="grid h-11 grid-cols-2 gap-1 rounded-xl border border-fg/[0.06] bg-slate-950/50 p-1">
        {OPTIONS.map(option => {
          const selected = option.id === currentFormat;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onFormatChange(option.id)}
              title={option.help}
              className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? option.active : 'text-slate-400 hover:bg-fg/[0.04] hover:text-slate-200'
              }`}
            >
              <span className="truncate">{option.id === PromptFormat.SD ? 'SD' : 'NovelAI'}<span className="hidden 2xl:inline">{option.id === PromptFormat.SD ? ' (Stable Diffusion)' : ''}</span></span>
              <span className={`hidden rounded px-1.5 py-0.5 font-mono text-[10px] font-medium xl:inline ${selected ? option.badge : 'bg-fg/5 text-slate-500'}`}>
                {option.syntax}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FormatSelector;
