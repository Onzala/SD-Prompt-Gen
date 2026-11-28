import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { fileToScaledDataUrl } from '../services/poseEditService';

// 單張圖片上傳欄（點選或拖放），圖片會縮到最長邊 2048px
export default function ImageSlot({ label, hint, image, onChange, disabled }: {
  label: string;
  hint: string;
  image: string | null;
  onChange: (image: string | null) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const load = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      onChange(await fileToScaledDataUrl(file));
    } catch (e: any) {
      setError(e.message);
    }
  };
  if (image) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-fg/[0.06] bg-slate-950/50 p-2">
        <img src={image} alt={`${label}預覽`} className="h-16 w-16 shrink-0 rounded-lg bg-slate-900 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-200">{label}已就緒</p>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} disabled={disabled}
          className="icon-btn h-8 w-8 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300" aria-label={`移除${label}`}>
          <X size={15} />
        </button>
      </div>
    );
  }
  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setDragging(false); }}
        onDrop={e => { e.preventDefault(); setDragging(false); void load(e.dataTransfer.files?.[0]); }}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 transition-colors focus-within:ring-2 focus-within:ring-violet-400/60 ${
          dragging ? 'border-violet-400 bg-violet-500/10' : 'border-fg/10 hover:border-fg/20 hover:bg-fg/[0.02]'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={disabled}
          onChange={e => { void load(e.target.files?.[0]); e.target.value = ''; }} />
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-fg/[0.04] text-slate-400">
          <ImagePlus size={17} />
        </span>
        <span className="min-w-0 text-xs text-slate-400">
          <span className="font-medium text-violet-300">選擇{label}</span>或拖放到這裡
          <span className="block text-[11px] text-slate-500">{hint}</span>
        </span>
      </label>
      {error && <p className="mt-1 text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}
