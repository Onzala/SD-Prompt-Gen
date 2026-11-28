import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Square, KeyRound, Eye, EyeOff, Plus, Trash2, ScanSearch, Users, ImageIcon, Settings2, Info, Dices, Wand2, Shirt,
  PersonStanding,
} from 'lucide-react';
import ImageSlot from './ImageSlot';
import PoseWearLibrary from './PoseWearLibrary';
import NaiSyntaxGuide from './NaiSyntaxGuide';
import { preparePoseWearReference, type SelectedPoseWearReference } from '../services/posewear';
import { decomposeImageForNovelAI, hasCJK, poseToDanbooruTags, textToDanbooruTags, type PoseSource } from '../services/poseEditService';
import {
  NAI_MODELS, NAI_NOISE_SCHEDULES, NAI_SAMPLERS, NAI_SIZE_PRESETS, buildNaiPrompts, defaultNoiseSchedule, defaultPreferSameOutfit,
  generateNovelAIImage, getNovelAIToken, gridLabel, isOpusFree, modelCaps, qualityPresets, referenceDescription, setNovelAIToken,
  snapToGrid, ucPresets, type NaiCharacter, type NaiReference, type NaiReferenceMode,
} from '../services/novelaiService';

export type RunTask = (signal: AbortSignal, warn: (msg: string) => void) => Promise<void>;

interface Props {
  hasApiKey: boolean;
  onNeedApiKey: () => void;
  showAdult: boolean;
  onShowAdultChange: (enabled: boolean) => void;
  busy: string | null;
  run: (kind: string, task: RunTask, needGemini: boolean) => void;
  stop: () => void;
  onResult: (result: { image: string; usedModel: string; text: string }, seed: number) => void;
}

type PoseMode = 'library' | 'upload' | 'text';

const newCharacter = (prompt = 'girl', x = 0.5, y = 0.5): NaiCharacter => ({ prompt, uc: '', x, y, enabled: true });

const Section = ({ icon, title, note, children, tone = 'default' }: {
  icon: React.ReactNode; title: string; note?: React.ReactNode; children: React.ReactNode; tone?: 'default' | 'accent';
}) => (
  <div className={`space-y-3 rounded-xl border p-3 ${tone === 'accent' ? 'border-sky-500/20 bg-sky-500/[0.04]' : 'border-fg/[0.06] bg-fg/[0.015]'}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">{icon} {title}</div>
      {note && <div className="text-[11px] text-slate-500">{note}</div>}
    </div>
    {children}
  </div>
);

const Segmented = <T extends string>({ value, options, onChange, disabled, label }: {
  value: T; options: { id: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void; disabled?: boolean; label: string;
}) => (
  <div className="flex gap-1 rounded-lg border border-fg/[0.06] bg-slate-950/40 p-0.5" role="radiogroup" aria-label={label}>
    {options.map(o => (
      <button key={o.id} type="button" role="radio" aria-checked={value === o.id} disabled={disabled || o.disabled}
        onClick={() => onChange(o.id)}
        className={`flex-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${value === o.id
          ? 'bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/40'
          : 'text-slate-400 hover:text-fg'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

const Slider = ({ label, value, min, max, step, onChange, disabled, hint, digits = 2 }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
  disabled?: boolean; hint?: string; digits?: number;
}) => (
  <label className={`block min-w-0 ${disabled ? 'opacity-50' : ''}`}>
    <span className="field-label"><span>{label}</span><span className="font-mono">{value.toFixed(digits)}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={e => onChange(Number(e.target.value))} className="w-full accent-violet-500" />
    {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
  </label>
);

// 5×5 位置格：V4.5 只能選格子，V5 點格子也能快速擺放
const PositionGrid = ({ x, y, onChange, disabled }: { x: number; y: number; onChange: (x: number, y: number) => void; disabled?: boolean }) => (
  <div className="grid w-[92px] shrink-0 grid-cols-5 gap-0.5" role="grid" aria-label="角色位置">
    {[0, 1, 2, 3, 4].flatMap(row => [0, 1, 2, 3, 4].map(col => {
      const cx = 0.1 + col * 0.2;
      const cy = 0.1 + row * 0.2;
      const on = Math.abs(snapToGrid(x) - cx) < 0.01 && Math.abs(snapToGrid(y) - cy) < 0.01;
      return (
        <button key={`${row}-${col}`} type="button" disabled={disabled} onClick={() => onChange(cx, cy)}
          aria-label={`位置 ${'ABCDE'[col]}${row + 1}`} aria-pressed={on}
          className={`h-4 w-4 rounded-[3px] border ${on ? 'border-violet-400 bg-violet-500/60' : 'border-fg/[0.08] bg-fg/[0.03] hover:bg-fg/[0.1]'}`} />
      );
    }))}
  </div>
);

export default function NovelAIStudio({ hasApiKey, onNeedApiKey, showAdult, onShowAdultChange, busy, run, stop, onResult }: Props) {
  const loading = busy !== null;
  // 金鑰
  const [token, setToken] = useState(() => getNovelAIToken());
  const [tokenDraft, setTokenDraft] = useState('');
  const [showToken, setShowToken] = useState(false);
  // 模型
  const [model, setModel] = useState(NAI_MODELS[0].id);
  const [furry, setFurry] = useState(false);
  const [effort, setEffort] = useState<'medium' | 'high'>('high');
  // Prompt
  const [prompt, setPrompt] = useState('1girl, solo');
  const [transparent, setTransparent] = useState(false);
  const [qualityPreset, setQualityPreset] = useState('standard');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [ucPreset, setUcPreset] = useState('heavy');
  // 角色
  const [characters, setCharacters] = useState<NaiCharacter[]>([]);
  const [useCoords, setUseCoords] = useState(false);
  // 拆解
  const [decomposeImage, setDecomposeImage] = useState<string | null>(null);
  const [alsoAsReference, setAlsoAsReference] = useState(true);
  const [alsoAsImg2Img, setAlsoAsImg2Img] = useState(false);
  const [breakdown, setBreakdown] = useState<{ field: string; value: string }[] | null>(null);
  // 姿勢助手
  const [poseMode, setPoseMode] = useState<PoseMode>('library');
  const [libraryPose, setLibraryPose] = useState<SelectedPoseWearReference[]>([]);
  const [uploadedPose, setUploadedPose] = useState<string | null>(null);
  const [poseText, setPoseText] = useState('');
  const [poseTarget, setPoseTarget] = useState('base');
  // 參考圖
  const [img2img, setImg2img] = useState<string | null>(null);
  const [img2imgStrength, setImg2imgStrength] = useState(0.7);
  const [img2imgNoise, setImg2imgNoise] = useState(0);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refMode, setRefMode] = useState<NaiReferenceMode>('character&style');
  const [preferSameOutfit, setPreferSameOutfit] = useState(defaultPreferSameOutfit('character&style'));
  const [refStrength, setRefStrength] = useState(0.6);
  const [refFidelity, setRefFidelity] = useState(1);
  const [outfitSel, setOutfitSel] = useState<SelectedPoseWearReference[]>([]);
  const [outfitStrength, setOutfitStrength] = useState(0.6);
  // 圖片設定
  const [width, setWidth] = useState(832);
  const [height, setHeight] = useState(1216);
  const [steps, setSteps] = useState(23);
  const [scale, setScale] = useState(modelCaps(NAI_MODELS[0].id).defaultScale);
  const [seedText, setSeedText] = useState('');
  const [sampler, setSampler] = useState('k_euler_ancestral');
  const [noiseSchedule, setNoiseSchedule] = useState('karras');
  const [cfgRescale, setCfgRescale] = useState(0);
  const [varietyPlus, setVarietyPlus] = useState(false);

  const caps = modelCaps(model);
  const hasOutfit = outfitSel.length > 0;
  const hasReference = !!refImage || (hasOutfit && caps.outfitReference);
  const effectiveEffort = caps.effort ? (hasReference ? 'high' : effort) : 'high';
  const medium = effectiveEffort === 'medium' && caps.effort;
  const qualities = qualityPresets(model);
  const ucs = ucPresets(model);
  const sizeKey = `${width}x${height}`;
  const presetMatch = NAI_SIZE_PRESETS.find(p => p.width === width && p.height === height);
  const free = isOpusFree(width, height, medium ? 14 : steps);
  const refCount = (refImage ? 1 : 0) + (hasOutfit && caps.outfitReference ? 1 : 0);

  useEffect(() => {
    if (!showAdult) {
      setLibraryPose(current => current.filter(e => !e.reference.adult));
      setOutfitSel(current => current.filter(e => !e.reference.adult));
    }
  }, [showAdult]);

  // 換模型：把不支援的選項拉回可用值
  const changeModel = (id: string) => {
    const next = modelCaps(id);
    setModel(id);
    setScale(next.defaultScale);
    setRefStrength(v => Math.min(v, next.strengthMax));
    setOutfitStrength(v => Math.min(v, next.strengthMax));
    if (!qualityPresets(id).some(q => q.id === qualityPreset)) setQualityPreset('standard');
    if (!ucPresets(id).some(u => u.id === ucPreset)) setUcPreset('heavy');
    setCharacters(list => list.slice(0, next.maxCharacters));
  };

  const preview = useMemo(() => buildNaiPrompts({
    model, prompt, negativePrompt, furry, transparent, qualityPreset, ucPreset: medium ? 'heavy' : ucPreset,
  }), [model, prompt, negativePrompt, furry, transparent, qualityPreset, ucPreset, medium]);

  const updateChar = (i: number, patch: Partial<NaiCharacter>) =>
    setCharacters(list => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const saveToken = () => {
    setNovelAIToken(tokenDraft);
    setToken(tokenDraft.trim());
    setTokenDraft('');
  };

  // ---------- 拆解圖片 ----------
  const handleDecompose = () => decomposeImage && run('decompose', async (signal, warn) => {
    const d = await decomposeImageForNovelAI(decomposeImage, signal);
    const text = d.text ? `Text: ${d.text}` : '';
    const base = [d.base.subjects, d.base.other, d.base.composition, d.base.scene, d.base.style, d.text ? 'text' : ''].filter(Boolean).join(', ');
    setPrompt(text ? `${base}, ${text}` : base);
    const chars = d.characters.slice(0, caps.maxCharacters).map(c => newCharacter(c.prompt, c.x, c.y));
    setCharacters(chars);
    setUseCoords(chars.length > 1);
    setNegativePrompt(d.negative);
    setFurry(d.furry);
    const size = { portrait: [832, 1216], landscape: [1216, 832], square: [1024, 1024] }[d.orientation];
    setWidth(size[0]);
    setHeight(size[1]);
    if (alsoAsReference) setRefImage(decomposeImage);
    if (alsoAsImg2Img) setImg2img(decomposeImage);
    setBreakdown([
      { field: '人數（基本 prompt）', value: d.base.subjects },
      { field: '關係／年代／分級（基本 prompt）', value: d.base.other },
      { field: '取景與鏡頭（基本 prompt）', value: d.base.composition },
      { field: '場景與光線（基本 prompt）', value: d.base.scene },
      { field: '畫風（基本 prompt）', value: d.base.style },
      ...chars.map((c, i) => ({
        field: `角色 ${i + 1}（${caps.freeformPosition ? `x ${c.x.toFixed(2)}, y ${c.y.toFixed(2)}` : gridLabel(c.x, c.y)}）`,
        value: c.prompt,
      })),
      { field: '負面提示詞', value: d.negative },
      { field: '圖上文字', value: d.text },
      { field: '尺寸／模式', value: `${size[0]}×${size[1]} · ${d.furry ? 'Furry' : 'Anime'}` },
      ...(alsoAsReference ? [{ field: 'Precise Reference', value: '已放入這張圖' }] : []),
      ...(alsoAsImg2Img ? [{ field: 'Image2Image', value: '已放入這張圖' }] : []),
    ].filter(row => row.value));
    if (d.characters.length > caps.maxCharacters) {
      warn(`圖裡有 ${d.characters.length} 位角色，這個模型最多 ${caps.maxCharacters} 位，多的沒有填入。`);
    }
  }, true);

  // ---------- 姿勢助手 ----------
  const poseReady = poseMode === 'library' ? libraryPose.length > 0 : poseMode === 'upload' ? !!uploadedPose : !!poseText.trim();
  const appendTo = (target: string, tags: string) => {
    const join = (a: string, b: string) => [a.trim().replace(/,\s*$/, ''), b].filter(Boolean).join(', ');
    if (target === 'base') setPrompt(p => join(p, tags));
    else updateChar(Number(target), { prompt: join(characters[Number(target)]?.prompt ?? '', tags) });
  };
  const handlePoseTags = () => poseReady && run('poseTags', async signal => {
    let source: PoseSource;
    if (poseMode === 'library') {
      const ref = await preparePoseWearReference(libraryPose[0], signal);
      source = { image: ref.image, title: ref.title, description: ref.description };
    } else if (poseMode === 'upload') source = { image: uploadedPose! };
    else source = { description: poseText.trim() };
    appendTo(poseTarget, await poseToDanbooruTags(source, signal));
  }, true);

  // 服裝素材的英文描述，加到角色或基本 prompt
  const handleOutfitTags = () => outfitSel[0] && run('outfitTags', async signal => {
    let tags = outfitSel[0].reference.prompt;
    if (tags.length > 160 || /[.:;]\s/.test(tags) || hasCJK(tags)) tags = await textToDanbooruTags(tags, signal);
    appendTo(characters.length ? '0' : 'base', tags);
  }, true);

  // ---------- 生成 ----------
  // 「Text:」後面是要畫在圖上的字，V5 支援中文，不轉換
  const textAt = prompt.indexOf('Text:');
  const promptHead = textAt >= 0 ? prompt.slice(0, textAt) : prompt;
  const promptText = textAt >= 0 ? prompt.slice(textAt) : '';
  const fieldsWithCJK = [promptHead, negativePrompt, ...characters.flatMap(c => [c.prompt, c.uc])].some(hasCJK);
  const canGenerate = !!prompt.trim() || characters.some(c => c.enabled && c.prompt.trim());

  const handleGenerate = () => {
    if (!token) return run('generate', async () => { throw new Error('請先在下方填入 NovelAI Persistent API Token。'); }, false);
    if (fieldsWithCJK && !hasApiKey) return onNeedApiKey();
    run('generate', async (signal, warn) => {
      // NovelAI 看不懂中文：含中日韓文字的欄位先轉成標籤，並寫回欄位
      const toTags = async (value: string) => (hasCJK(value) ? textToDanbooruTags(value, signal) : value);
      const p = hasCJK(promptHead)
        ? [(await toTags(promptHead)).replace(/,\s*$/, ''), promptText.trim()].filter(Boolean).join(', ')
        : prompt;
      const neg = await toTags(negativePrompt);
      const chars = await Promise.all(characters.map(async c => ({ ...c, prompt: await toTags(c.prompt), uc: await toTags(c.uc) })));
      if (fieldsWithCJK) {
        setPrompt(p);
        setNegativePrompt(neg);
        setCharacters(chars);
        warn('含中文的欄位已轉成英文標籤再送出（V5 只有「Text:」後面的文字支援中文）。');
      }
      const references: NaiReference[] = [];
      if (refImage) references.push({ image: refImage, description: referenceDescription(refMode, model, hasOutfit ? false : preferSameOutfit), strength: refStrength });
      if (hasOutfit && caps.outfitReference) {
        const ref = await preparePoseWearReference(outfitSel[0], signal);
        references.push({ image: ref.image, description: 'costume', strength: outfitStrength });
      } else if (hasOutfit) warn('V4.5 沒有服裝參考圖，這次沒有送服裝圖；可以按「加入服裝標籤」改用文字。');
      if (caps.effort && effort === 'medium' && references.length) warn('有 Precise Reference 時只能用 High effort，這次以 High 生成。');
      const seed = /^\d+$/.test(seedText.trim()) ? Number(seedText.trim()) : undefined;
      const res = await generateNovelAIImage({
        token, model, effort: effectiveEffort, furry, prompt: p, negativePrompt: neg, qualityPreset, ucPreset, transparent,
        characters: chars, useCoords, references, fidelity: refFidelity, width, height, steps, scale, sampler, noiseSchedule,
        cfgRescale, varietyPlus, img2img: img2img ? { image: img2img, strength: img2imgStrength, noise: img2imgNoise } : undefined,
        seed, signal,
      });
      if (signal.aborted) return;
      const label = NAI_MODELS.find(m => m.id === model)?.label ?? model;
      const lines = [
        `prompt: ${res.prompt}`,
        ...chars.filter(c => c.enabled && c.prompt.trim()).map((c, i) => `角色 ${i + 1}: ${c.prompt}${c.uc ? ` ／ 負面: ${c.uc}` : ''}`),
        `負面: ${res.negative}`,
        references.length ? `references: ${references.map(r => r.description).join(' + ')}` : '',
        img2img ? `img2img: strength ${img2imgStrength}, noise ${img2imgNoise}` : '',
        `${width}×${height} · ${medium ? '14 steps（Medium）' : `${steps} steps`} · guidance ${scale} · ${sampler}`,
      ].filter(Boolean);
      onResult({ image: res.image, usedModel: `NovelAI ${label}${medium ? ' Medium' : ''} · seed ${res.seed}`, text: lines.join('\n') }, res.seed);
    }, false);
  };

  return (
    <div className="space-y-4">
      {/* 拆解圖片 */}
      <Section icon={<ScanSearch size={13} className="text-sky-300" />} title="從圖片拆解到各欄位" note="用 Gemini 分析，費用很低" tone="accent">
        <ImageSlot label="要拆解的圖" hint="會拆成基本 prompt、各角色、位置、負面與尺寸，並覆蓋目前內容"
          image={decomposeImage} onChange={img => { setDecomposeImage(img); setBreakdown(null); }} disabled={loading} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={alsoAsReference} onChange={e => setAlsoAsReference(e.target.checked)} disabled={loading} />
            也當 Precise Reference（鎖角色）
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={alsoAsImg2Img} onChange={e => setAlsoAsImg2Img(e.target.checked)} disabled={loading} />
            也當 Image2Image 底圖
          </label>
          <button type="button" onClick={handleDecompose} disabled={!decomposeImage || loading} className="btn-ghost ml-auto h-8 px-3">
            <Wand2 size={13} /> {busy === 'decompose' ? '拆解中…' : '拆解並填入'}
          </button>
        </div>
        {breakdown && (
          <dl className="divide-y divide-fg/[0.05] rounded-lg border border-fg/[0.06] bg-slate-950/40 px-2.5 text-[11px]">
            {breakdown.map(row => (
              <div key={row.field} className="grid gap-0.5 py-1.5 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="text-slate-500">{row.field}</dt>
                <dd className="break-words font-mono text-slate-300">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      {/* 模型、模式、Effort */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="min-w-0">
          <span className="field-label">Model</span>
          <select className="input py-1.5 text-xs" value={model} disabled={loading} onChange={e => changeModel(e.target.value)}>
            {NAI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <div className="min-w-0">
          <span className="field-label">Mode</span>
          <Segmented label="模式" value={furry ? 'furry' : 'anime'} disabled={loading}
            options={[{ id: 'anime', label: 'Anime' }, { id: 'furry', label: 'Furry' }]}
            onChange={v => setFurry(v === 'furry')} />
        </div>
        <div className="min-w-0" title={caps.effort ? 'Medium 費用較低（14 步）；有 Precise Reference 時只能用 High' : '只有 V5 Full 有 Effort'}>
          <span className="field-label">Effort</span>
          <Segmented label="Effort" value={effectiveEffort} disabled={loading || !caps.effort}
            options={[{ id: 'medium', label: 'Medium', disabled: hasReference }, { id: 'high', label: 'High' }]}
            onChange={setEffort} />
        </div>
      </div>

      {/* Prompt */}
      <div>
        <div className="field-label"><span>Prompt（基本：人數、場景、畫風、取景）</span></div>
        <textarea className="input min-h-[96px] resize-y font-mono text-[11px] leading-relaxed" value={prompt}
          onChange={e => setPrompt(e.target.value)} disabled={loading} aria-label="Prompt"
          placeholder="1boy, 1girl, couple, school, cowboy shot, location, thick lines" />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
          {caps.transparency && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} disabled={loading} /> 透明背景
            </label>
          )}
          <label className="ml-auto flex items-center gap-1.5">
            Quality Tags
            <select className="input h-7 w-auto py-0 text-[11px]" value={qualityPreset} disabled={loading}
              onChange={e => setQualityPreset(e.target.value)} aria-label="Quality Tags">
              {qualities.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div>
        <div className="field-label">
          <span>Undesired Content（負面）</span>
          <select className="input h-7 w-auto py-0 text-[11px]" value={medium ? 'heavy' : ucPreset} disabled={loading || medium}
            onChange={e => setUcPreset(e.target.value)} aria-label="UC Preset" title={medium ? 'Medium effort 固定用 Heavy' : undefined}>
            {ucs.map(u => <option key={u.id} value={u.id}>UC Preset：{u.label}</option>)}
          </select>
        </div>
        <textarea className="input min-h-[52px] resize-y font-mono text-[11px] leading-relaxed" value={negativePrompt}
          onChange={e => setNegativePrompt(e.target.value)} disabled={loading} aria-label="負面提示詞"
          placeholder="額外不要的東西，例如 realistic, 3d（負面預設會自動加在前面）" />
      </div>

      <details className="rounded-lg border border-fg/[0.06] px-3 py-2">
        <summary className="cursor-pointer text-[11px] text-slate-400">實際送出的 prompt 與負面（含自動加的標籤）</summary>
        <p className="mt-2 break-words font-mono text-[11px] text-slate-300">{preview.prompt || '（空）'}</p>
        <p className="mt-1.5 break-words font-mono text-[11px] text-slate-500">負面：{preview.negative || '（空）'}</p>
      </details>

      {/* 角色 */}
      <Section icon={<Users size={13} className="text-violet-300" />} title={`Character Prompts（${characters.length}／${caps.maxCharacters}）`}
        note={
          <button type="button" className="btn-ghost h-7 px-2 text-[11px]" disabled={loading || characters.length >= caps.maxCharacters}
            onClick={() => setCharacters(list => [...list, newCharacter()])}>
            <Plus size={12} /> 新增角色
          </button>
        }>
        {characters.length === 0 ? (
          <p className="text-[11px] text-slate-500">每位角色的外觀、服裝、表情、動作可以分開寫，避免互相混到。開頭寫 girl／boy／other，不寫數字。</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              位置
              <Segmented label="位置" value={useCoords ? 'custom' : 'ai'} disabled={loading}
                options={[{ id: 'ai', label: 'AI 決定' }, { id: 'custom', label: '自訂' }]}
                onChange={v => setUseCoords(v === 'custom')} />
              <span className="text-slate-500">{caps.freeformPosition ? 'V5 可任意擺放' : 'V4.5 為 5×5 格'}</span>
            </div>
            {characters.map((c, i) => (
              <div key={i} className={`space-y-2 rounded-lg border border-fg/[0.06] bg-slate-950/30 p-2.5 ${c.enabled ? '' : 'opacity-60'}`}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <label className="flex items-center gap-1.5 font-medium text-slate-300">
                    <input type="checkbox" checked={c.enabled} onChange={e => updateChar(i, { enabled: e.target.checked })} disabled={loading} />
                    角色 {i + 1}
                    {useCoords && <span className="font-mono text-slate-500">{caps.freeformPosition ? `(${c.x.toFixed(2)}, ${c.y.toFixed(2)})` : gridLabel(c.x, c.y)}</span>}
                  </label>
                  <button type="button" className="icon-btn h-7 w-7 hover:text-rose-300" disabled={loading}
                    onClick={() => setCharacters(list => list.filter((_, j) => j !== i))} aria-label={`刪除角色 ${i + 1}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex gap-2.5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <textarea className="input min-h-[60px] resize-y font-mono text-[11px] leading-relaxed" value={c.prompt}
                      onChange={e => updateChar(i, { prompt: e.target.value })} disabled={loading} aria-label={`角色 ${i + 1} prompt`}
                      placeholder="girl, long hair, black hair, glasses, lab coat, sitting, crossed legs" />
                    <input className="input font-mono text-[11px]" value={c.uc} onChange={e => updateChar(i, { uc: e.target.value })}
                      disabled={loading || medium} aria-label={`角色 ${i + 1} 負面`}
                      placeholder={medium ? 'Medium effort 不使用角色負面' : '這位角色不要的東西（選填）'} />
                  </div>
                  {useCoords && (
                    <div className="space-y-1">
                      <PositionGrid x={c.x} y={c.y} disabled={loading} onChange={(x, y) => updateChar(i, { x, y })} />
                      {caps.freeformPosition && (
                        <div className="w-[92px] space-y-0.5">
                          <input type="range" min={0} max={1} step={0.01} value={c.x} disabled={loading} aria-label="水平位置"
                            onChange={e => updateChar(i, { x: Number(e.target.value) })} className="w-full accent-violet-500" />
                          <input type="range" min={0} max={1} step={0.01} value={c.y} disabled={loading} aria-label="垂直位置"
                            onChange={e => updateChar(i, { y: Number(e.target.value) })} className="w-full accent-violet-500" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </Section>

      {/* 姿勢助手 */}
      <Section icon={<PersonStanding size={13} className="text-emerald-300" />} title="姿勢 → 標籤"
        note="NovelAI 看不懂姿勢圖，由 Gemini 轉成標籤">
        <div className="flex gap-1" role="tablist" aria-label="姿勢來源">
          {([['library', '素材庫'], ['upload', '上傳圖片'], ['text', '文字描述']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={poseMode === id} onClick={() => setPoseMode(id)} disabled={loading}
              className={`rounded-md border px-2 py-0.5 text-[11px] ${poseMode === id
                ? 'border-violet-500/50 bg-violet-500/20 text-violet-200' : 'border-fg/[0.08] text-slate-400 hover:text-fg'}`}>
              {label}
            </button>
          ))}
        </div>
        {poseMode === 'library' && (
          <PoseWearLibrary selected={libraryPose} onChange={setLibraryPose} showAdult={showAdult} onShowAdultChange={onShowAdultChange}
            disabled={loading} groups={['姿勢']} label="從素材庫挑一個姿勢" hint="姿勢線稿、深度姿勢" />
        )}
        {poseMode === 'upload' && (
          <ImageSlot label="姿勢參考圖" hint="只取動作與鏡頭角度" image={uploadedPose} onChange={setUploadedPose} disabled={loading} />
        )}
        {poseMode === 'text' && (
          <textarea className="input min-h-[60px] resize-y" value={poseText} disabled={loading} onChange={e => setPoseText(e.target.value)}
            aria-label="姿勢描述" placeholder="例如：坐在桌上翹腳，右手托腮，看向鏡頭" />
        )}
        <div className="flex items-center gap-2">
          <select className="input h-8 flex-1 py-0 text-[11px]" value={poseTarget} onChange={e => setPoseTarget(e.target.value)} disabled={loading}
            aria-label="加到哪個欄位">
            <option value="base">加到基本 prompt</option>
            {characters.map((_, i) => <option key={i} value={String(i)}>加到角色 {i + 1}</option>)}
          </select>
          <button type="button" onClick={handlePoseTags} disabled={!poseReady || loading} className="btn-ghost h-8 px-3">
            <ScanSearch size={13} /> {busy === 'poseTags' ? '轉換中…' : '轉成標籤並加入'}
          </button>
        </div>
      </Section>

      {/* 參考圖 */}
      <Section icon={<ImageIcon size={13} className="text-fuchsia-300" />} title="Reference Images"
        note={refCount ? `Precise Reference ${refCount} 張，每次 +${refCount * 5} Anlas` : undefined}>
        <div className="space-y-2">
          <div className="field-label"><span>Image2Image（以這張圖為底重畫）</span></div>
          <ImageSlot label="底圖" hint="會裁切成目前的尺寸" image={img2img} onChange={setImg2img} disabled={loading} />
          {img2img && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Slider label="Strength" value={img2imgStrength} min={0.01} max={0.99} step={0.01} onChange={setImg2imgStrength} disabled={loading}
                hint="越高改越多，越低越像底圖" />
              <Slider label="Noise" value={img2imgNoise} min={0} max={0.99} step={0.01} onChange={setImg2imgNoise} disabled={loading}
                hint="加雜訊讓細節重新長出來" />
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-fg/[0.05] pt-3">
          <div className="field-label"><span>Precise Reference（鎖角色或畫風）</span></div>
          <ImageSlot label="角色參考圖" hint="保留長相、服裝、畫風" image={refImage} onChange={setRefImage} disabled={loading} />
          {refImage && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="min-w-0">
                  <span className="field-label">參考類型</span>
                  <select className="input py-1.5 text-xs" value={refMode} disabled={loading} onChange={e => {
                    const next = e.target.value as NaiReferenceMode;
                    setRefMode(next);
                    setPreferSameOutfit(defaultPreferSameOutfit(next));
                  }}>
                    <option value="character&style">角色＋畫風</option>
                    <option value="character">只鎖角色</option>
                  </select>
                </label>
                <label className={`flex items-end gap-2 pb-1.5 text-[11px] ${caps.version === '5' && !hasOutfit ? 'text-slate-300' : 'text-slate-500'}`}>
                  <input type="checkbox" checked={caps.version === '5' && !hasOutfit && preferSameOutfit}
                    disabled={loading || caps.version !== '5' || hasOutfit} onChange={e => setPreferSameOutfit(e.target.checked)} />
                  偏好相同服裝{caps.version !== '5' ? '（V5 才有）' : hasOutfit ? '（已選服裝，關閉）' : ''}
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Slider label="Strength" value={refStrength} min={0} max={caps.strengthMax} step={0.05} onChange={setRefStrength} disabled={loading}
                  hint={`太高時姿勢會黏著參考圖；上限 ${caps.strengthMax}`} />
                <Slider label="Fidelity" value={refFidelity} min={0} max={1} step={0.05} onChange={setRefFidelity} disabled={loading || !caps.fidelity}
                  hint={caps.fidelity ? '越高越貼近參考圖' : '只有 V4.5 有'} />
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-fg/[0.05] pt-3">
          <PoseWearLibrary selected={outfitSel} onChange={setOutfitSel} showAdult={showAdult} onShowAdultChange={onShowAdultChange}
            disabled={loading} groups={['服裝']} label="服裝參考（素材庫，選填）"
            hint={caps.outfitReference ? 'V5 會當 Outfit Reference 送出' : 'V4.5 沒有服裝參考圖，可改加服裝標籤'} />
          {hasOutfit && (
            <div className="flex flex-wrap items-end gap-3">
              {caps.outfitReference && (
                <div className="min-w-[180px] flex-1">
                  <Slider label="服裝參考強度" value={outfitStrength} min={0} max={caps.strengthMax} step={0.05} onChange={setOutfitStrength} disabled={loading} />
                </div>
              )}
              <button type="button" onClick={handleOutfitTags} disabled={loading} className="btn-ghost h-8 px-3">
                <Shirt size={13} /> {busy === 'outfitTags' ? '整理中…' : `加入服裝標籤到${characters.length ? '角色 1' : '基本 prompt'}`}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* 圖片設定 */}
      <Section icon={<Settings2 size={13} className="text-slate-300" />} title="Image Settings"
        note={<span className={free ? 'text-emerald-300' : 'text-amber-300'}>{free ? 'Opus 免 Anlas 範圍' : '會扣 Anlas'}{refCount ? '（參考圖另計）' : ''}</span>}>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="min-w-0">
            <span className="field-label">Resolution</span>
            <select className="input py-1.5 text-xs" value={presetMatch ? sizeKey : 'custom'} disabled={loading} onChange={e => {
              if (e.target.value === 'custom') return;
              const [w, h] = e.target.value.split('x').map(Number);
              setWidth(w);
              setHeight(h);
            }}>
              {['Normal', 'Large', 'Small', 'Wallpaper'].map(group => (
                <optgroup key={group} label={group}>
                  {NAI_SIZE_PRESETS.filter(p => p.group === group).map(p => (
                    <option key={`${p.width}x${p.height}`} value={`${p.width}x${p.height}`}>{group} {p.label} {p.width}×{p.height}</option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">自訂</option>
            </select>
          </label>
          <div className="flex items-end gap-1.5">
            <input type="number" className="input w-20 py-1.5 text-xs" value={width} step={64} min={64} max={2048} disabled={loading}
              onChange={e => setWidth(Number(e.target.value))} onBlur={() => setWidth(w => Math.min(2048, Math.max(64, Math.round(w / 64) * 64)))}
              aria-label="寬" />
            <span className="pb-2 text-slate-500">×</span>
            <input type="number" className="input w-20 py-1.5 text-xs" value={height} step={64} min={64} max={2048} disabled={loading}
              onChange={e => setHeight(Number(e.target.value))} onBlur={() => setHeight(h => Math.min(2048, Math.max(64, Math.round(h / 64) * 64)))}
              aria-label="高" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Slider label="Steps" value={medium ? 14 : steps} min={1} max={50} step={1} digits={0} onChange={setSteps} disabled={loading || medium}
            hint={medium ? 'Medium effort 固定 14 步' : '28 以下 Opus 免 Anlas'} />
          <Slider label="Guidance" value={scale} min={0} max={10} step={0.1} digits={1} onChange={setScale} disabled={loading}
            hint="越高越聽 prompt，太高顏色會過飽和" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="field-label">Seed</span>
            <div className="flex gap-1.5">
              <input className="input flex-1 font-mono text-xs" value={seedText} onChange={e => setSeedText(e.target.value.replace(/\D/g, ''))}
                disabled={loading} placeholder="留空為隨機" aria-label="seed" />
              <button type="button" className="icon-btn h-9 w-9" disabled={loading} aria-label="隨機 seed"
                onClick={() => setSeedText(String(Math.floor(Math.random() * 4294967295)))}>
                <Dices size={14} />
              </button>
            </div>
          </label>
          <label className="min-w-0">
            <span className="field-label">Sampler</span>
            <select className="input py-1.5 text-xs" value={medium ? 'k_euler_ancestral' : sampler} disabled={loading || medium} onChange={e => {
              setSampler(e.target.value);
              setNoiseSchedule(defaultNoiseSchedule(e.target.value));
            }}>
              {NAI_SAMPLERS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Slider label="Prompt Guidance Rescale" value={medium ? 0 : cfgRescale} min={0} max={1} step={0.02} onChange={setCfgRescale}
            disabled={loading || medium} hint="Guidance 高時顏色過重，可稍微調高" />
          <label className="min-w-0">
            <span className="field-label">Noise Schedule</span>
            <select className="input py-1.5 text-xs" value={caps.noiseSchedule ? noiseSchedule : defaultNoiseSchedule(sampler)}
              disabled={loading || !caps.noiseSchedule} onChange={e => setNoiseSchedule(e.target.value)}>
              {NAI_NOISE_SCHEDULES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {!caps.noiseSchedule && <span className="block text-[11px] text-slate-500">V5 由取樣器自動決定</span>}
          </label>
        </div>
        <label className={`flex items-center gap-2 text-[11px] ${caps.varietyPlus ? 'text-slate-300' : 'text-slate-500'}`}>
          <input type="checkbox" checked={caps.varietyPlus && varietyPlus} disabled={loading || !caps.varietyPlus}
            onChange={e => setVarietyPlus(e.target.checked)} />
          Variety+（構圖更多變化；只有 V4.5）
        </label>
      </Section>

      {/* Token */}
      <div>
        <div className="field-label">
          <span className="flex items-center gap-1"><KeyRound size={12} /> NovelAI Persistent API Token</span>
          {token && <span className="text-emerald-300">已設定</span>}
        </div>
        {token ? (
          <div className="flex items-center gap-2">
            <code className="input flex-1 truncate py-1.5 text-xs text-slate-400">
              {showToken ? token : `${token.slice(0, 6)}••••••••${token.slice(-4)}`}
            </code>
            <button type="button" className="icon-btn h-8 w-8" onClick={() => setShowToken(v => !v)} aria-label={showToken ? '隱藏 token' : '顯示 token'}>
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button type="button" className="btn-ghost h-8" disabled={loading} onClick={() => { setNovelAIToken(''); setToken(''); }}>清除</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input type="password" className="input flex-1 font-mono text-xs" value={tokenDraft} autoComplete="off"
              onChange={e => setTokenDraft(e.target.value)} placeholder="pst-..." aria-label="NovelAI token"
              onKeyDown={e => e.key === 'Enter' && tokenDraft.trim() && saveToken()} />
            <button type="button" className="btn-primary h-9 px-3" disabled={!tokenDraft.trim()} onClick={saveToken}>儲存</button>
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-500">
          在 NovelAI 帳號設定按「Get Persistent API Token」取得。只存在這台裝置的瀏覽器，生成時直接送到 image.novelai.net。
        </p>
      </div>

      <NaiSyntaxGuide />

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          需要 NovelAI 訂閱。沒有做的官方功能：Vibe Transfer（只有 V4.5，需另外編碼並扣 Anlas）、Inpaint（要畫遮罩）、Enhance／放大、一次多張。
          依服務條款，每次生成都必須由你按下按鈕觸發。
        </span>
      </p>

      <div className="-mx-4 -mb-4 flex items-center justify-end gap-3 border-t border-fg/[0.06] bg-fg/[0.015] px-4 py-3">
        <button type="button" onClick={loading ? stop : handleGenerate} disabled={!loading && !canGenerate}
          className={loading ? 'btn h-10 bg-rose-500/90 px-5 text-sm text-white hover:bg-rose-500' : 'btn-primary h-10 px-5 text-sm'}>
          {loading ? <Square size={14} fill="currentColor" /> : <Sparkles size={15} />}
          {loading ? '停止' : img2img ? '生成（Image2Image）' : '生成'}
        </button>
      </div>
    </div>
  );
}
