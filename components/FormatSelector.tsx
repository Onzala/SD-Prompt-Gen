import React from 'react';
import { PromptFormat } from '../types';
import { Layers, Sparkles } from 'lucide-react';

interface FormatSelectorProps {
  currentFormat: PromptFormat;
  onFormatChange: (format: PromptFormat) => void;
  disabled: boolean;
}

const FormatSelector: React.FC<FormatSelectorProps> = ({ currentFormat, onFormatChange, disabled }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center text-xs font-medium text-slate-400">
        <span className="flex items-center gap-1.5">
          <Layers size={13} className="text-blue-400" />
          生成格式規範
        </span>
        <span className="text-[10px] text-slate-500">
          {currentFormat === PromptFormat.NAI ? '支援 V3 / V4 花括號加權' : '支援 SD 圓括號權重'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-700 rounded-xl">
        {/* SD Format Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onFormatChange(PromptFormat.SD)}
          className={`flex items-center gap-2.5 p-2 rounded-lg text-left transition-all ${
            currentFormat === PromptFormat.SD
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className={`p-1.5 rounded-md text-xs font-mono font-bold ${
            currentFormat === PromptFormat.SD ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            SD
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate flex items-center gap-1">
              Stable Diffusion
            </div>
            <div className={`text-[10px] truncate ${
              currentFormat === PromptFormat.SD ? 'text-blue-100' : 'text-slate-500'
            }`}>
              (tag:1.2) 圓括號權重
            </div>
          </div>
        </button>

        {/* NAI Format Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onFormatChange(PromptFormat.NAI)}
          className={`flex items-center gap-2.5 p-2 rounded-lg text-left transition-all ${
            currentFormat === PromptFormat.NAI
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className={`p-1.5 rounded-md text-xs font-mono font-bold ${
            currentFormat === PromptFormat.NAI ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            NAI
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate flex items-center gap-1">
              NovelAI
              <Sparkles size={11} className={currentFormat === PromptFormat.NAI ? 'text-purple-200' : 'text-purple-400'} />
            </div>
            <div className={`text-[10px] truncate ${
              currentFormat === PromptFormat.NAI ? 'text-purple-100' : 'text-slate-500'
            }`}>
              &#123;tag&#125; 花括號 + 年份標籤
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default FormatSelector;
