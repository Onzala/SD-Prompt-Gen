import React, { useState, useMemo } from 'react';
import { Copy, Check, Terminal, Layers, Sparkles, ShieldAlert, Cpu } from 'lucide-react';
import { PromptFormat } from '../types';

interface OutputDisplayProps {
  content: string;
  loading: boolean;
  format?: PromptFormat;
}

const SD_CATEGORIES = [
  { label: '品質標籤 (Quality)', color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
  { label: '主體特徵 (Subject & Anatomy)', color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
  { label: '服裝穿著 (Attire & Clothing)', color: 'text-pink-400', border: 'border-pink-500/20', bg: 'bg-pink-500/5' },
  { label: '姿勢動作 (Pose & Composition)', color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/5' },
  { label: '場景背景 (Setting & Background)', color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/5' },
  { label: '光影氣氛 (Lighting & Atmosphere)', color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5' },
];

const NAI_CATEGORIES = [
  { label: '品質年份 (Quality & Year)', color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
  { label: '畫師風格 (Artist & Style)', color: 'text-pink-400', border: 'border-pink-500/20', bg: 'bg-pink-500/5' },
  { label: '角色主體 (Subject & Character)', color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
  { label: '髮型五官 (Hair & Features)', color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
  { label: '服裝穿著 (Attire & Accessories)', color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/5' },
  { label: '動作構圖 (Pose & Composition)', color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/5' },
  { label: '場景環境 (Setting & Environment)', color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
  { label: '光影氛圍 (Lighting & Atmosphere)', color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5' },
];

const OutputDisplay: React.FC<OutputDisplayProps> = ({ content, loading, format = PromptFormat.SD }) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Parse positive prompt and negative prompt
  const { positiveSegments, negativeText, fullCleanText, rawPositiveText } = useMemo(() => {
    if (!content) {
      return { positiveSegments: [], negativeText: '', fullCleanText: '', rawPositiveText: '' };
    }

    const clean = content.replace(/```(?:[\w]*\n)?([\s\S]*?)```/g, '$1').trim();

    let posText = clean;
    let negText = '';

    // Check for [POSITIVE PROMPT] and [NEGATIVE PROMPT] headers
    const posMatch = clean.match(/\[POSITIVE PROMPT\]([\s\S]*?)(?:\[NEGATIVE PROMPT\]|$)/i);
    const negMatch = clean.match(/\[NEGATIVE PROMPT\]([\s\S]*?)$/i);

    if (posMatch) {
      posText = posMatch[1].trim();
    }
    if (negMatch) {
      negText = negMatch[1].trim();
    }

    // Split positive lines
    const lines = posText
      .split('\n')
      .map(line => {
        // Strip Line numbers like "Line 1 (Quality):" or similar prefixes if AI output them
        return line.replace(/^Line\s*\d+\s*(?:\([^)]*\))?:\s*/i, '').trim();
      })
      .filter(line => line.length > 0 && !line.startsWith('['));

    return {
      positiveSegments: lines,
      negativeText: negText,
      fullCleanText: clean,
      rawPositiveText: lines.join('\n')
    };
  }, [content]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    });
  };

  const categories = format === PromptFormat.NAI ? NAI_CATEGORIES : SD_CATEGORIES;

  if (loading) {
    return (
      <div className="h-full min-h-[460px] flex flex-col items-center justify-center text-slate-500 animate-pulse bg-slate-900 rounded-xl border border-slate-800 p-8">
        <div className="relative mb-4">
          <Terminal size={48} className="text-blue-500 opacity-60 animate-bounce" />
          <Sparkles size={20} className="text-purple-400 absolute -top-1 -right-1 animate-spin" />
        </div>
        <p className="text-slate-300 font-semibold text-base">正在依據 {format === PromptFormat.NAI ? 'NovelAI' : 'Stable Diffusion'} 規範生成標籤...</p>
        <p className="text-xs mt-2 text-slate-500 text-center max-w-sm">
          {format === PromptFormat.NAI 
            ? '正在建構 Danbooru 格式標籤、花括號權重與高品質年份語義' 
            : '正在計算 SD 權重 (tag:weight) 與高解析度品質標籤'}
        </p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="h-full min-h-[460px] flex flex-col items-center justify-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800 border-dashed p-8">
        <Terminal size={48} className="mb-4 opacity-30 text-slate-600" />
        <p className="font-semibold text-slate-400">準備就緒</p>
        <p className="text-xs mt-2 text-slate-500 text-center max-w-xs">
          輸入創意、上傳圖片或指定畫師，點擊「生成」後結果將即時呈現在此
        </p>
      </div>
    );
  }

  return (
    <div className="relative group bg-slate-900 rounded-xl border border-slate-800 shadow-2xl flex flex-col h-full min-h-[460px]">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950 border-b border-slate-800 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">
            標籤生成結果
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
            format === PromptFormat.NAI
              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
              : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
          }`}>
            {format === PromptFormat.NAI ? 'NovelAI (花括號增強)' : 'SD (圓括號權重)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard(rawPositiveText || fullCleanText, 'positive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copiedType === 'positive'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {copiedType === 'positive' ? <Check size={13} /> : <Copy size={13} />}
            {copiedType === 'positive' ? '已複製正面' : '複製正面提示詞'}
          </button>

          {negativeText && (
            <button
              type="button"
              onClick={() => copyToClipboard(negativeText, 'negative')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copiedType === 'negative'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {copiedType === 'negative' ? <Check size={13} /> : <ShieldAlert size={13} />}
              {copiedType === 'negative' ? '已複製負面' : '複製負面詞'}
            </button>
          )}

          <button
            type="button"
            onClick={() => copyToClipboard(fullCleanText, 'all')}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copiedType === 'all'
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
            title="複製完整輸出"
          >
            {copiedType === 'all' ? <Check size={13} /> : <Cpu size={13} />}
            完整代碼
          </button>
        </div>
      </div>

      {/* Main output list */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
        {/* Positive prompt segments */}
        {positiveSegments.map((segment, index) => {
          const category = categories[index] || {
            label: `標籤分段 ${index + 1}`,
            color: 'text-slate-400',
            border: 'border-slate-700',
            bg: 'bg-slate-800/50'
          };

          return (
            <div
              key={index}
              className={`p-3 rounded-xl border ${category.border} ${category.bg} transition-all hover:bg-opacity-70 group/item relative`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${category.color}`}>
                  {category.label}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(segment, `seg-${index}`)}
                  className="opacity-0 group-hover/item:opacity-100 text-[10px] text-slate-400 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 transition-opacity"
                >
                  {copiedType === `seg-${index}` ? <Check size={10} /> : <Copy size={10} />}
                  {copiedType === `seg-${index}` ? '已複製' : '單行複製'}
                </button>
              </div>
              <div className="font-mono text-xs leading-relaxed text-slate-200 break-words select-all">
                {segment}
              </div>
            </div>
          );
        })}

        {/* Negative prompt block */}
        {negativeText && (
          <div className="mt-4 p-3 rounded-xl border border-red-500/20 bg-red-950/15">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <ShieldAlert size={13} />
                {format === PromptFormat.NAI ? 'NovelAI 負面提示詞 (Undesired Content)' : 'SD 負面提示詞 (Negative Prompt)'}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(negativeText, 'negative-box')}
                className="text-[10px] text-rose-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-red-900/40 border border-red-500/30 transition-colors"
              >
                {copiedType === 'negative-box' ? <Check size={11} /> : <Copy size={11} />}
                {copiedType === 'negative-box' ? '已複製負面' : '複製負面詞'}
              </button>
            </div>
            <div className="font-mono text-xs leading-relaxed text-slate-300 break-words select-all">
              {negativeText}
            </div>
          </div>
        )}

        {positiveSegments.length === 0 && !negativeText && (
          <div className="text-slate-400 text-xs font-mono p-3 bg-slate-800/40 rounded-lg whitespace-pre-wrap">
            {fullCleanText}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputDisplay;
