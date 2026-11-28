import { useEffect, useRef, useState } from 'react';
import {
  PersonStanding, ImagePlus, X, Download, Square, Sparkles, AlertCircle, FlaskConical, Info, Palette, ScanSearch, Brush, Plus,
} from 'lucide-react';
import PoseWearLibrary from './PoseWearLibrary';
import { preparePoseWearReference, type SelectedPoseWearReference } from '../services/posewear';
import {
  ASPECT_RATIOS, IMAGE_MODELS, MAX_STYLE_REFS, analyzeArtStyle, fileToScaledDataUrl, generatePoseImage, restyleImage,
  type AspectRatio, type ImageSize, type PoseEditResult,
} from '../services/poseEditService';

type PoseMode = 'library' | 'upload' | 'text';
type Busy = null | 'analyze' | 'generate' | 'restyle';

interface Props {
  hasApiKey: boolean;
  onNeedApiKey: () => void;
  showAdult: boolean;
  onShowAdultChange: (enabled: boolean) => void;
}

interface ResultEntry extends PoseEditResult {
  id: number;
  kind: 'pose' | 'restyle';
}

function ImageSlot({ label, hint, image, onChange, disabled }: {
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

// 畫風參考圖：最多 3 張小縮圖
function StyleRefs({ images, onChange, disabled }: { images: string[]; onChange: (images: string[]) => void; disabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    try {
      const room = MAX_STYLE_REFS - images.length;
      const loaded = await Promise.all([...files].slice(0, room).map(f => fileToScaledDataUrl(f, 1536)));
      onChange([...images, ...loaded]);
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={i} className="relative">
            <img src={src} alt={`畫風參考 ${i + 1}`} className="h-14 w-14 rounded-lg border border-fg/[0.06] bg-slate-900 object-cover" />
            <button type="button" disabled={disabled} onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-slate-300 ring-1 ring-fg/10 hover:bg-rose-500 hover:text-white"
              aria-label={`移除畫風參考 ${i + 1}`}>
              <X size={11} />
            </button>
          </div>
        ))}
        {images.length < MAX_STYLE_REFS && (
          <label className={`grid h-14 w-14 cursor-pointer place-items-center rounded-lg border border-dashed border-fg/15 text-slate-400 hover:border-fg/30 hover:text-fg ${disabled ? 'pointer-events-none opacity-50' : ''}`}
            title="加入同角色或同畫風的其他圖">
            <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={disabled}
              aria-label="加入畫風參考圖" onChange={e => { void add(e.target.files); e.target.value = ''; }} />
            <Plus size={16} />
          </label>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}

export default function PoseEditor({ hasApiKey, onNeedApiKey, showAdult, onShowAdultChange }: Props) {
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [styleRefs, setStyleRefs] = useState<string[]>([]);
  const [styleDescription, setStyleDescription] = useState('');
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [mode, setMode] = useState<PoseMode>('library');
  const [libraryPose, setLibraryPose] = useState<SelectedPoseWearReference[]>([]);
  const [uploadedPose, setUploadedPose] = useState<string | null>(null);
  const [poseText, setPoseText] = useState('');
  const [extra, setExtra] = useState('');
  const [model, setModel] = useState(IMAGE_MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loading = busy !== null;

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!showAdult) setLibraryPose(current => current.filter(entry => !entry.reference.adult));
  }, [showAdult]);

  const changeCharacter = (image: string | null) => {
    setCharacterImage(image);
    setStyleDescription(''); // 換了角色圖，畫風描述就要重新分析
  };

  const poseReady = mode === 'library' ? libraryPose.length > 0 : mode === 'upload' ? !!uploadedPose : !!poseText.trim();
  const canGenerate = !!characterImage && poseReady;
  const price = IMAGE_MODELS.find(m => m.id === model)?.price[imageSize];
  const active = results.find(r => r.id === activeId) ?? results[0];

  // 共用：建立 AbortController、處理錯誤與狀態
  const run = async (kind: Exclude<Busy, null>, task: (signal: AbortSignal) => Promise<void>) => {
    if (!hasApiKey) return onNeedApiKey();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(kind);
    setError(null);
    setWarning(null);
    try {
      await task(controller.signal);
    } catch (e: any) {
      if (!controller.signal.aborted && e.message !== 'GenerationCancelled') setError(e.message || '生成失敗');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  };

  const stop = () => abortRef.current?.abort();

  const pushResult = (res: PoseEditResult, kind: ResultEntry['kind']) => {
    const entry = { ...res, id: Date.now(), kind };
    setResults(prev => [entry, ...prev].slice(0, 12));
    setActiveId(entry.id);
  };

  const handleAnalyze = () => characterImage && run('analyze', async signal => {
    setStyleDescription(await analyzeArtStyle(characterImage, signal));
  });

  const handleGenerate = () => {
    if (!canGenerate || !characterImage) return;
    return run('generate', async signal => {
      let style = styleDescription;
      if (autoAnalyze && !style.trim()) {
        try {
          style = await analyzeArtStyle(characterImage, signal);
          setStyleDescription(style);
        } catch (e: any) {
          if (signal.aborted || e.message === 'GenerationCancelled') throw e;
          setWarning(`${e.message} 這次先不帶畫風描述生成。`);
        }
      }
      let pose: { image?: string; title?: string; description?: string };
      if (mode === 'library') {
        const ref = await preparePoseWearReference(libraryPose[0], signal);
        pose = { image: ref.image, title: ref.title, description: ref.description };
      } else if (mode === 'upload') {
        pose = { image: uploadedPose! };
      } else {
        pose = { description: poseText.trim() };
      }
      const res = await generatePoseImage({
        characterImage, styleRefs, styleDescription: style, pose, extraInstruction: extra,
        model, aspectRatio, imageSize, signal,
      });
      if (!signal.aborted) pushResult(res, 'pose');
    });
  };

  const handleRestyle = () => {
    if (!characterImage || !active?.image) return;
    const draftImage = active.image;
    return run('restyle', async signal => {
      const res = await restyleImage({
        characterImage, styleRefs, styleDescription, draftImage, extraInstruction: extra,
        model, aspectRatio, imageSize, signal,
      });
      if (!signal.aborted) pushResult(res, 'restyle');
    });
  };

  const download = (entry: ResultEntry) => {
    if (!entry.image) return;
    const ext = entry.image.match(/^data:image\/(\w+)/)?.[1]?.replace('jpeg', 'jpg') ?? 'png';
    const a = document.createElement('a');
    a.href = entry.image;
    a.download = `pose-${entry.kind}-${new Date(entry.id).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`;
    a.click();
  };

  const tabs: { id: PoseMode; label: string }[] = [
    { id: 'library', label: '素材庫' },
    { id: 'upload', label: '上傳圖片' },
    { id: 'text', label: '文字描述' },
  ];

  return (
    <section className="card overflow-hidden" aria-labelledby="pose-edit-title">
      <div className="card-header">
        <h2 id="pose-edit-title" className="card-title">
          <PersonStanding size={15} className="text-emerald-300" />
          姿勢調整
          <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-200">
            <FlaskConical size={11} /> 實驗
          </span>
        </h2>
        <span className="text-[11px] text-slate-500">直接產生圖片</span>
      </div>

      <div className="space-y-4 px-4 pb-4">
        <div>
          <div className="field-label">A · 角色圖</div>
          <ImageSlot label="角色圖" hint="要保留長相、服裝與畫風的角色" image={characterImage}
            onChange={changeCharacter} disabled={loading} />
        </div>

        {/* 畫風一致 */}
        <div className="space-y-3 rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.03] p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-200">
            <Palette size={13} /> 畫風一致
          </div>
          <div>
            <div className="field-label">
              <span>畫風參考圖（選填，最多 {MAX_STYLE_REFS} 張）</span>
            </div>
            <StyleRefs images={styleRefs} onChange={setStyleRefs} disabled={loading} />
            <p className="mt-1 text-[11px] text-slate-500">同一個角色或同一位畫師的其他圖，越多張畫風越穩。</p>
          </div>
          <div>
            <div className="field-label">
              <span>畫風描述</span>
              <button type="button" onClick={handleAnalyze} disabled={!characterImage || loading}
                className="btn-ghost h-7 px-2 text-[11px]">
                <ScanSearch size={12} /> {busy === 'analyze' ? '分析中…' : '從角色圖分析'}
              </button>
            </div>
            <textarea className="input min-h-[84px] resize-y font-mono text-[11px] leading-relaxed" value={styleDescription}
              onChange={e => setStyleDescription(e.target.value)} disabled={loading} aria-label="畫風描述"
              placeholder="例如：- thin dark-brown line art, slightly tapered&#10;- 2-tone cel shading with hard edges, purple-tinted shadows&#10;- large glossy eyes with two white highlights" />
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <input type="checkbox" checked={autoAnalyze} onChange={e => setAutoAnalyze(e.target.checked)} disabled={loading} />
              留空時，生成前自動分析（用文字模型，費用很低）
            </label>
          </div>
        </div>

        <div>
          <div className="field-label">
            <span>B · 目標姿勢</span>
            <div className="flex gap-1" role="tablist" aria-label="姿勢來源">
              {tabs.map(tab => (
                <button key={tab.id} type="button" role="tab" aria-selected={mode === tab.id}
                  onClick={() => setMode(tab.id)} disabled={loading}
                  className={`rounded-md border px-2 py-0.5 text-[11px] ${mode === tab.id
                    ? 'border-violet-500/50 bg-violet-500/20 text-violet-200'
                    : 'border-fg/[0.08] text-slate-400 hover:text-fg'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {mode === 'library' && (
            <PoseWearLibrary
              selected={libraryPose}
              onChange={setLibraryPose}
              showAdult={showAdult}
              onShowAdultChange={onShowAdultChange}
              disabled={loading}
              groups={['姿勢']}
              label="從素材庫挑一個姿勢"
              hint="姿勢線稿、深度姿勢"
            />
          )}
          {mode === 'upload' && (
            <ImageSlot label="姿勢參考圖" hint="只會參考它的動作與鏡頭角度" image={uploadedPose}
              onChange={setUploadedPose} disabled={loading} />
          )}
          {mode === 'text' && (
            <textarea className="input min-h-[72px] resize-y" value={poseText} disabled={loading}
              onChange={e => setPoseText(e.target.value)} aria-label="姿勢描述"
              placeholder="例如：坐在椅子上翹腳，右手托腮，看向鏡頭，略為俯視的角度" />
          )}
        </div>

        <div>
          <div className="field-label">額外指示（選填）</div>
          <input className="input" value={extra} onChange={e => setExtra(e.target.value)} disabled={loading}
            placeholder="例如：背景改成白色、保持全身入鏡" aria-label="額外指示" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="min-w-0">
            <span className="field-label">圖片模型</span>
            <select className="input py-1.5 text-xs" value={model} disabled={loading} onChange={e => setModel(e.target.value)}>
              {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}（{m.note}）</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="field-label">比例</span>
            <select className="input py-1.5 text-xs" value={aspectRatio} disabled={loading}
              onChange={e => setAspectRatio(e.target.value as AspectRatio)}>
              {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r === 'auto' ? '自動' : r}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="field-label">解析度</span>
            <select className="input py-1.5 text-xs" value={imageSize} disabled={loading}
              onChange={e => setImageSize(e.target.value as ImageSize)}>
              <option value="1K">1K</option>
              <option value="2K">2K</option>
            </select>
          </label>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>
            圖片生成需要付費方案的 API 金鑰，每張約 US${price?.toFixed(3) ?? '—'}（官方定價），「風格校正」會再算一張。
            圖片模型的安全審查比文字嚴，暴露、暴力或看起來像未成年的角色容易被擋；被擋或空白會記進「審查統計」。輸出圖帶有 SynthID 浮水印。
          </span>
        </p>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-fg/[0.06] bg-fg/[0.015] px-4 py-3">
        <button type="button" onClick={loading ? stop : handleGenerate} disabled={!loading && !canGenerate}
          className={loading ? 'btn h-10 bg-rose-500/90 px-5 text-sm text-white hover:bg-rose-500' : 'btn-primary h-10 px-5 text-sm'}>
          {loading ? <Square size={14} fill="currentColor" /> : <Sparkles size={15} />}
          {loading ? '停止' : '生成姿勢圖'}
        </button>
      </div>

      {(loading || error || warning || results.length > 0) && (
        <div className="space-y-3 border-t border-fg/[0.06] p-4" aria-live="polite">
          {(busy === 'generate' || busy === 'restyle') && (
            <div className="flex items-center gap-3">
              <div className="skeleton h-20 w-20 shrink-0" />
              <p role="status" className="text-xs text-slate-400">
                {busy === 'restyle' ? '正在對照角色圖校正畫風…' : '生成中，圖片模型通常需要 10–40 秒…'}
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="flex items-start gap-2 text-xs text-rose-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-400" /> {error}
            </p>
          )}
          {warning && (
            <p className="flex items-start gap-2 text-xs text-amber-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-400" /> {warning}
            </p>
          )}
          {active && (
            <>
              {active.fallbackFrom && (
                <p className="text-[11px] text-emerald-300">{active.fallbackFrom} 暫時繁忙，已改用 {active.usedModel}。</p>
              )}
              {active.notice && (
                <p role="alert" className="flex items-start gap-2 text-xs text-amber-200">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-400" /> {active.notice}
                </p>
              )}
              {active.image && (
                <figure className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px]">
                    <img src={active.image} alt="生成的姿勢圖" className="max-h-[70vh] w-full rounded-xl bg-slate-950 object-contain" />
                    {characterImage && (
                      <div className="hidden sm:block">
                        <p className="mb-1 text-[10px] text-slate-500">對照：A 角色圖</p>
                        <img src={characterImage} alt="角色圖對照" className="w-full rounded-lg bg-slate-950 object-contain" />
                      </div>
                    )}
                  </div>
                  <figcaption className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>{active.kind === 'restyle' ? '風格校正 · ' : ''}{active.usedModel}</span>
                    <span className="flex gap-1.5">
                      <button type="button" onClick={handleRestyle} disabled={loading || !characterImage} className="btn-ghost h-8"
                        title="保留這張的姿勢與構圖，再對照角色圖重繪一次畫風（多算一張的費用）">
                        <Brush size={13} /> 風格校正
                      </button>
                      <button type="button" onClick={() => download(active)} className="btn-ghost h-8">
                        <Download size={13} /> 下載
                      </button>
                    </span>
                  </figcaption>
                </figure>
              )}
              {active.text && <p className="whitespace-pre-wrap text-[11px] text-slate-400">{active.text}</p>}
            </>
          )}
          {results.length > 1 && (
            <div>
              <p className="mb-1 text-[11px] text-slate-500">這次開啟後的結果（重新整理會清空）</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {results.map(r => (
                  <button key={r.id} type="button" onClick={() => setActiveId(r.id)}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border ${r.id === active?.id ? 'border-violet-400' : 'border-fg/[0.08] hover:border-fg/20'}`}
                    aria-label={`檢視結果 ${new Date(r.id).toLocaleTimeString('zh-TW')}`}>
                    {r.image
                      ? <img src={r.image} alt="" className="h-full w-full object-cover" />
                      : <span className="grid h-full w-full place-items-center bg-amber-500/10 text-amber-300"><AlertCircle size={14} /></span>}
                    {r.kind === 'restyle' && <Brush size={10} className="absolute bottom-0.5 right-0.5 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
