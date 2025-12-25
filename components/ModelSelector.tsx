import React from 'react';
import { GeminiModel } from '../types';
import { Zap, Brain, Rocket } from 'lucide-react';

interface ModelSelectorProps {
  currentModel: GeminiModel;
  onModelChange: (model: GeminiModel) => void;
  disabled: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModel, onModelChange, disabled }) => {
  const models = [
    {
      id: GeminiModel.FLASH_3,
      name: 'Gemini 3 Flash',
      icon: <Zap size={14} />,
      color: 'bg-blue-600',
      activeClass: 'bg-blue-600 text-white shadow-blue-500/20',
      description: '速度與平衡'
    },
    {
      id: GeminiModel.PRO_3,
      name: 'Gemini 3 Pro',
      icon: <Brain size={14} />,
      color: 'bg-purple-600',
      activeClass: 'bg-purple-600 text-white shadow-purple-500/20',
      description: '最高智慧'
    },
    {
      id: GeminiModel.LITE_25,
      name: '2.5 Lite',
      icon: <Rocket size={14} />,
      color: 'bg-emerald-600',
      activeClass: 'bg-emerald-600 text-white shadow-emerald-500/20',
      description: '極速輕量'
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700">
      {models.map((m) => (
        <button
          key={m.id}
          onClick={() => onModelChange(m.id)}
          disabled={disabled}
          className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 ${
            currentModel === m.id
              ? `${m.activeClass} shadow-lg scale-[1.02]`
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {m.icon}
            <span className="whitespace-nowrap">{m.name.split(' ').pop()}</span>
          </div>
          <span className={`text-[8px] font-normal opacity-70 ${currentModel === m.id ? 'text-white' : 'text-slate-500'}`}>
            {m.description}
          </span>
        </button>
      ))}
    </div>
  );
};

export default ModelSelector;