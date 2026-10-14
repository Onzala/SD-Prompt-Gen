import React from 'react';
import { Sparkles, Camera, Zap, Palette, User, Building } from 'lucide-react';

interface PromptTemplate {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const TEMPLATES: PromptTemplate[] = [
  {
    id: 'cyberpunk',
    label: '賽博龐克',
    icon: <Zap size={12} />,
    prompt: 'cyberpunk style, neon lights, highly detailed, futuristic city, night time, glowing accents, sci-fi'
  },
  {
    id: 'anime',
    label: '精緻動漫',
    icon: <Sparkles size={12} />,
    prompt: 'anime style, masterpiece, best quality, ultra-detailed, 1girl, beautiful detailed eyes, vibrant colors, studio lighting'
  },
  {
    id: 'photorealistic',
    label: '真實攝影',
    icon: <Camera size={12} />,
    prompt: 'photorealistic, 8k resolution, highly detailed, raw photo, DSLR, soft lighting, sharp focus, depth of field'
  },
  {
    id: 'watercolor',
    label: '水彩藝術',
    icon: <Palette size={12} />,
    prompt: 'watercolor painting, traditional media, soft edges, pastel colors, artistic, expressive brushstrokes'
  },
  {
    id: 'portrait',
    label: '人物特寫',
    icon: <User size={12} />,
    prompt: 'close-up portrait, detailed face, beautiful lighting, bokeh background, highly detailed skin texture'
  },
  {
    id: 'architecture',
    label: '壯麗建築',
    icon: <Building size={12} />,
    prompt: 'epic architecture, wide angle shot, majestic building, beautiful sky, cinematic lighting, highly detailed'
  }
];

interface PromptTemplatesProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const PromptTemplates: React.FC<PromptTemplatesProps> = ({ onSelect, disabled }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium px-1">
        快速範本：
      </span>
      {TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template.prompt)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-full text-xs text-slate-300 hover:text-blue-300 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {template.icon}
          {template.label}
        </button>
      ))}
    </div>
  );
};

export default PromptTemplates;
