import React, { useState, useMemo } from 'react';
import { Copy, Check, Terminal, Layers, Sparkles, ShieldAlert, Cpu } from 'lucide-react';
import { PromptFormat } from '../types';

interface OutputDisplayProps {
  content: string;
  loading: boolean;
  format?: PromptFormat;
}

const SD_CATEGORIES = [
  { label: '品質標籤', en: 'Quality', dot: 'bg-violet-400' },
  { label: '主體特徵', en: 'Subject & Anatomy', dot: 'bg-sky-400' },
  { label: '服裝穿著', en: 'Attire & Clothing', dot: 'bg-pink-400' },
  { label: '姿勢動作', en: 'Pose & Composition', dot: 'bg-amber-400' },
  { label: '場景背景', en: 'Setting & Background', dot: 'bg-emerald-400' },
  { label: '光影氣氛', en: 'Lighting & Atmosphere', dot: 'bg-cyan-400' },
];

const NAI_CATEGORIES = [
  { label: '品質年份', en: 'Quality & Year', dot: 'bg-violet-400' },
  { label: '畫師風格', en: 'Artist & Style', dot: 'bg-fuchsia-400' },
  { label: '角色主體', en: 'Subject & Character', dot: 'bg-sky-400' },
  { label: '髮型五官', en: 'Hair & Features', dot: 'bg-amber-400' },
  { label: '服裝穿著', en: 'Attire & Accessories', dot: 'bg-pink-400' },
  { label: '動作構圖', en: 'Pose & Composition', dot: 'bg-yellow-400' },
  { label: '場景環境', en: 'Setting & Environment', dot: 'bg-emerald-400' },
  { label: '光影氛圍', en: 'Lighting & Atmosphere', dot: 'bg-cyan-400' },
];

const COPIED_BTN = 'btn border border-emerald-500/40 bg-emerald-500/15 text-emerald-200';

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
  const isNai = format === PromptFormat.NAI;
  const panel = 'card flex h-full min-h-[420px] flex-col overflow-hidden lg:min-h-0';
  const copyLabel = (type: string, idle: string) => (copiedType === type ? '已複製' : idle);

  if (loading) {
    return (
      <div className={panel} aria-busy="true">
        <div className="flex items-center gap-2 border-b border-fg/[0.06] px-4 py-3">
          <Sparkles size={15} className="animate-pulse text-violet-300" />
          <span className="text-sm font-semibold text-slate-200">
            正在依 {isNai ? 'NovelAI' : 'Stable Diffusion'} 規範生成…
          </span>
        </div>
        <div className="flex-1 space-y-4 p-4">
          {Array.from({ length: isNai ? 8 : 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-9" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className={`${panel} items-center justify-center border-dashed p-8 text-center`}>
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 ring-1 ring-fg/10">
          <Terminal size={24} className="text-violet-300" />
        </div>
        <p className="text-sm font-semibold text-slate-200">結果會顯示在這裡</p>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">
          輸入畫面需求或附上參考圖片，按「生成提示詞」後，分類好的標籤與負面提示詞會出現在此，可逐段複製。
        </p>
      </div>
    );
  }

  return (
    <div className={panel}>
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fg/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-violet-300" />
          <span className="text-sm font-semibold text-slate-100">生成結果</span>
          <span className={`chip ${isNai ? 'border-violet-500/30 bg-violet-500/10 text-violet-200' : 'border-sky-500/30 bg-sky-500/10 text-sky-200'}`}>
            {isNai ? 'NovelAI' : 'Stable Diffusion'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => copyToClipboard(rawPositiveText || fullCleanText, 'positive')}
            className={copiedType === 'positive' ? COPIED_BTN : 'btn-primary'}
          >
            {copiedType === 'positive' ? <Check size={13} /> : <Copy size={13} />}
            {copyLabel('positive', '複製正面提示詞')}
          </button>

          {negativeText && (
            <button
              type="button"
              onClick={() => copyToClipboard(negativeText, 'negative')}
              className={copiedType === 'negative' ? COPIED_BTN : 'btn-ghost'}
            >
              {copiedType === 'negative' ? <Check size={13} /> : <ShieldAlert size={13} />}
              {copyLabel('negative', '複製負面')}
            </button>
          )}

          <button
            type="button"
            onClick={() => copyToClipboard(fullCleanText, 'all')}
            className={copiedType === 'all' ? COPIED_BTN : 'btn-ghost'}
            title="複製完整輸出"
          >
            {copiedType === 'all' ? <Check size={13} /> : <Cpu size={13} />}
            {copyLabel('all', '全部')}
          </button>
        </div>
      </div>

      {/* Main output list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {positiveSegments.map((segment, index) => {
          const category = categories[index] || { label: `標籤分段 ${index + 1}`, en: '', dot: 'bg-slate-500' };
          const key = `seg-${index}`;
          return (
            <div key={index} className="group rounded-xl border border-fg/[0.05] bg-fg/[0.02] p-3 transition-colors hover:border-fg/10 hover:bg-fg/[0.035]">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-slate-300">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${category.dot}`} />
                  {category.label}
                  {category.en && <span className="truncate font-normal uppercase tracking-wider text-slate-500">{category.en}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(segment, key)}
                  className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 transition-opacity hover:bg-fg/5 hover:text-fg sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
                  aria-label={`複製${category.label}`}
                >
                  {copiedType === key ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  {copyLabel(key, '複製')}
                </button>
              </div>
              <div className="select-all break-words font-mono text-[12.5px] leading-relaxed text-slate-200">
                {segment}
              </div>
            </div>
          );
        })}

        {/* Negative prompt block */}
        {negativeText && (
          <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
                <ShieldAlert size={13} />
                {isNai ? '負面提示詞（Undesired Content）' : '負面提示詞（Negative Prompt）'}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(negativeText, 'negative-box')}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/10 hover:text-fg"
              >
                {copiedType === 'negative-box' ? <Check size={11} /> : <Copy size={11} />}
                {copyLabel('negative-box', '複製')}
              </button>
            </div>
            <div className="select-all break-words font-mono text-[12.5px] leading-relaxed text-slate-300">
              {negativeText}
            </div>
          </div>
        )}

        {positiveSegments.length === 0 && !negativeText && (
          <div className="whitespace-pre-wrap rounded-xl bg-fg/[0.03] p-3 font-mono text-xs text-slate-300">
            {fullCleanText}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputDisplay;
