// ==========================================
// NovelAI 生圖
// 查證日期 2026-11-28：
//   - 官方 API 規格 https://image.novelai.net/docs/doc.json
//       POST https://image.novelai.net/ai/generate-image，Authorization: Bearer pst-<token>
//       送 Accept: application/json 時回傳 { images: [{ image: base64 }] }，否則是 zip
//       director_reference_*：Precise Reference 參數（圖片需補黑邊到 1024x1536／1536x1024／1472x1472）
//   - 官方文件 docs.novelai.net/en/image/precisereference：只支援 V4.5、V5；每張參考圖每次 +5 Anlas
//   - CORS：實測 image.novelai.net 回 access-control-allow-origin: *（文件未載明，可能變動）
//   - 模型 ID、各模型功能、品質標籤／負面預設文字、Medium effort 的固定設定、Variety+ 的 sigma、
//     fidelity → secondary_strength = 1 - fidelity 的對應，都取自 novelai.net 官方網頁客戶端
// 服務條款：生成必須由使用者操作觸發，不可自動批次。
// ==========================================

const TOKEN_STORAGE = 'sd_prompt_novelai_token';
const ENDPOINT = 'https://image.novelai.net/ai/generate-image';

export const getNovelAIToken = (): string => {
  try {
    return localStorage.getItem(TOKEN_STORAGE) || '';
  } catch {
    return '';
  }
};

export const setNovelAIToken = (token: string) => {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE, token.trim());
    else localStorage.removeItem(TOKEN_STORAGE);
  } catch {
    /* 無痕模式等情況可能無法寫入 */
  }
};

export interface NaiModelOption {
  id: string;
  label: string;
  version: '4.5' | '5';
}

export const NAI_MODELS: NaiModelOption[] = [
  { id: 'nai-diffusion-5-full', label: 'V5 Full', version: '5' },
  { id: 'nai-diffusion-5-curated', label: 'V5 Curated', version: '5' },
  { id: 'nai-diffusion-4-5-full', label: 'V4.5 Full', version: '4.5' },
  { id: 'nai-diffusion-4-5-curated', label: 'V4.5 Curated', version: '4.5' },
];

export const naiVersion = (model: string) => NAI_MODELS.find(m => m.id === model)?.version ?? '4.5';

// ------------------------------------------
// 各模型能用的功能（官方網頁客戶端的模型設定）
// ------------------------------------------
export const modelCaps = (model: string) => {
  const v5 = naiVersion(model) === '5';
  return {
    version: v5 ? '5' : '4.5',
    // 官方客戶端上限：V4.5 6 位、V5 32 位（文件寫 22）；介面先限 10 位
    maxCharacters: v5 ? 10 : 6,
    freeformPosition: v5,        // V5 可任意座標；V4.5 是 5×5 格
    transparency: v5,            // 透明背景
    effort: model === 'nai-diffusion-5-full', // Medium／High 只有 V5 Full
    noiseSchedule: !v5,          // V5 不給選
    varietyPlus: !v5,            // Variety+（skip_cfg_above_sigma），V5 沒有
    fidelity: !v5,               // Precise Reference fidelity 只有 V4.5
    outfitReference: v5,
    strengthMax: v5 ? 5 : 1,
    defaultScale: v5 ? 7 : 5,
  };
};

// 官方 Variety+ 的 sigma（cfgDelaySigma）
const VARIETY_SIGMA = 58;

export type NaiReferenceMode = 'character' | 'character&style';

// 送給 API 的 base_caption。V5 才有服裝相關的變體（V4.5 不支援時客戶端會退回前兩種）：
//   character            只鎖角色（V5：不偏好相同服裝）
//   character_mainoutfit 只鎖角色＋偏好相同服裝（V5）
//   character&style      角色＋畫風（V5：偏好相同服裝，官方預設）
//   character&style_anyoutfit 角色＋畫風、不偏好相同服裝（V5）
//   costume              服裝參考（Outfit Reference，V5 限定）
export type NaiReferenceDescription =
  | 'character' | 'character_mainoutfit' | 'character&style' | 'character&style_anyoutfit' | 'costume';

export const referenceDescription = (mode: NaiReferenceMode, model: string, preferSameOutfit: boolean): NaiReferenceDescription => {
  if (naiVersion(model) !== '5') return mode;
  if (mode === 'character') return preferSameOutfit ? 'character_mainoutfit' : 'character';
  return preferSameOutfit ? 'character&style' : 'character&style_anyoutfit';
};

// 官方文件：「偏好相同服裝」在角色＋畫風預設開啟、只鎖角色預設關閉
export const defaultPreferSameOutfit = (mode: NaiReferenceMode) => mode === 'character&style';

export interface NaiReference {
  image: string; // data URL
  description: NaiReferenceDescription;
  strength: number;
}

// 品質標籤（Quality Tags）：加在 prompt 最後
export const qualityPresets = (model: string): { id: string; label: string; suffix: string }[] => {
  if (naiVersion(model) === '5') return [
    { id: 'standard', label: 'Standard', suffix: 'very aesthetic, masterpiece, no text' },
    { id: 'light', label: 'Light', suffix: 'very aesthetic, amazing quality, no text' },
    { id: 'none', label: '不加', suffix: '' },
  ];
  if (model === 'nai-diffusion-4-5-curated') return [
    { id: 'standard', label: 'Standard', suffix: 'very aesthetic, masterpiece, no text, -0.8::feet::, rating:general' },
    { id: 'none', label: '不加', suffix: '' },
  ];
  return [
    { id: 'standard', label: 'Standard', suffix: 'very aesthetic, masterpiece, no text' },
    { id: 'none', label: '不加', suffix: '' },
  ];
};

const HEAVY = 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page';
const FURRY = '{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic';

// 負面預設（UC Preset）：加在負面提示詞最前面
export const ucPresets = (model: string): { id: string; label: string; prefix: string }[] => {
  if (model === 'nai-diffusion-4-5-curated') return [
    { id: 'heavy', label: 'Heavy', prefix: 'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, negative space, blank page' },
    { id: 'light', label: 'Light', prefix: 'blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, too many watermarks, negative space, blank page' },
    { id: 'humanFocus', label: 'Human Focus', prefix: 'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, bad anatomy, bad hands, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, @_@, mismatched pupils, glowing eyes, negative space, blank page' },
    { id: 'none', label: '不加', prefix: '' },
  ];
  const light = naiVersion(model) === '5'
    ? 'lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::'
    : 'lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page';
  return [
    { id: 'heavy', label: 'Heavy', prefix: HEAVY },
    { id: 'light', label: 'Light', prefix: light },
    { id: 'furryFocus', label: 'Furry Focus', prefix: FURRY },
    { id: 'humanFocus', label: 'Human Focus', prefix: `${HEAVY}, @_@, mismatched pupils, glowing eyes, bad anatomy` },
    { id: 'none', label: '不加', prefix: '' },
  ];
};

export const NAI_SAMPLERS = [
  { id: 'k_euler_ancestral', label: 'Euler Ancestral' },
  { id: 'k_euler', label: 'Euler' },
  { id: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
  { id: 'k_dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
  { id: 'k_dpmpp_2m', label: 'DPM++ 2M' },
  { id: 'k_dpmpp_sde', label: 'DPM++ SDE' },
];
export const NAI_NOISE_SCHEDULES = ['karras', 'exponential', 'polyexponential'];
// 官方客戶端：換取樣器時自動帶的雜訊排程
export const defaultNoiseSchedule = (sampler: string) =>
  ['k_dpm_2', 'k_dpmpp_2m'].includes(sampler) ? 'exponential' : 'karras';

// 尺寸：官方的 Normal／Large／Small／Wallpaper 預設
export const NAI_SIZE_PRESETS = [
  { group: 'Normal', label: '直式', width: 832, height: 1216 },
  { group: 'Normal', label: '橫式', width: 1216, height: 832 },
  { group: 'Normal', label: '方形', width: 1024, height: 1024 },
  { group: 'Large', label: '直式', width: 1024, height: 1536 },
  { group: 'Large', label: '橫式', width: 1536, height: 1024 },
  { group: 'Large', label: '方形', width: 1472, height: 1472 },
  { group: 'Small', label: '直式', width: 512, height: 768 },
  { group: 'Small', label: '橫式', width: 768, height: 512 },
  { group: 'Small', label: '方形', width: 640, height: 640 },
  { group: 'Wallpaper', label: '直式', width: 1088, height: 1920 },
  { group: 'Wallpaper', label: '橫式', width: 1920, height: 1088 },
];

// Opus 方案免 Anlas 的條件：面積不超過 1024×1024、步數 28 以下、一次一張（Precise Reference 另計）
export const isOpusFree = (width: number, height: number, steps: number) => width * height <= 1024 * 1024 && steps <= 28;

export interface NaiCharacter {
  prompt: string;
  uc: string;
  x: number; // 0–1，左到右
  y: number; // 0–1，上到下
  enabled: boolean;
}

// V4.5 的角色位置是 5×5 格（中心 0.1、0.3、0.5、0.7、0.9）
export const snapToGrid = (v: number) => Math.min(0.9, Math.max(0.1, Math.round((v - 0.1) / 0.2) * 0.2 + 0.1));
export const gridLabel = (x: number, y: number) =>
  `${'ABCDE'[Math.round((snapToGrid(x) - 0.1) / 0.2)]}${Math.round((snapToGrid(y) - 0.1) / 0.2) + 1}`;

// 依官方客戶端：品質標籤加在最後；有「Text:」時插在 Text: 之前
const appendSuffix = (prompt: string, suffix: string) => {
  const trimmed = prompt.trim().replace(/,\s*$/, '');
  if (!suffix) return trimmed;
  const at = trimmed.search(/(^|[\s,])Text:/);
  if (at >= 0) {
    const start = trimmed.indexOf('Text:', at);
    const head = trimmed.slice(0, start).replace(/[\s,]+$/, '');
    return `${head ? `${head}, ` : ''}${suffix}, ${trimmed.slice(start)}`;
  }
  return trimmed ? `${trimmed}, ${suffix}` : suffix;
};

// 實際送出的 prompt／負面（介面預覽與生成共用）
export const buildNaiPrompts = (opts: {
  model: string; prompt: string; negativePrompt: string; furry: boolean; transparent: boolean;
  qualityPreset: string; ucPreset: string;
}) => {
  const caps = modelCaps(opts.model);
  let prompt = opts.prompt.trim();
  if (opts.furry && !/^(fur dataset|background dataset)/.test(prompt)) prompt = `fur dataset, ${prompt}`;
  const quality = qualityPresets(opts.model).find(q => q.id === opts.qualityPreset)?.suffix ?? '';
  const suffix = [caps.transparency && opts.transparent ? 'transparent background' : '', quality].filter(Boolean).join(', ');
  prompt = appendSuffix(prompt, suffix);
  const ucPrefix = ucPresets(opts.model).find(u => u.id === opts.ucPreset)?.prefix ?? '';
  const negative = [ucPrefix, opts.negativePrompt.trim()].filter(Boolean).join(', ');
  return { prompt, negative };
};

// 強度預設 0.6（官方客戶端）。information_extracted 目前伺服器只接受 1.0
// （2026-11-28 實測回 400：「must be EXACTLY 1.0 for each entry at this time」）
export const defaultReferenceSettings = (_model: string) => ({
  strength: 0.6,
  informationExtracted: 1,
  fidelity: 1,
});

const REFERENCE_SIZES: [number, number][] = [[1024, 1536], [1536, 1024], [1472, 1472]];

// 依長寬比選最接近的官方尺寸，等比縮放後補黑邊，回傳不含前綴的 PNG base64
export const padReferenceImage = (dataUrl: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      const [w, h] = REFERENCE_SIZES.reduce((best, size) =>
        Math.abs(Math.log(ratio / (size[0] / size[1]))) < Math.abs(Math.log(ratio / (best[0] / best[1]))) ? size : best);
      const scale = Math.min(w / img.width, h / img.height);
      const dw = Math.round(img.width * scale);
      const dh = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('瀏覽器無法處理參考圖。'));
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => reject(new Error('無法讀取參考圖。'));
    img.src = dataUrl;
  });

// img2img：把圖等比裁切到目標尺寸，回傳不含前綴的 PNG base64
const fitImage = (dataUrl: string, width: number, height: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('瀏覽器無法處理 Image2Image 的圖。'));
      const scale = Math.max(width / img.width, height / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => reject(new Error('無法讀取 Image2Image 的圖。'));
    img.src = dataUrl;
  });

export interface NaiGenerateRequest {
  token: string;
  model: string;
  effort: 'medium' | 'high'; // 只有 V5 Full 有效；有 Precise Reference 時一律 high
  furry: boolean;
  prompt: string;
  negativePrompt: string;
  qualityPreset: string;
  ucPreset: string;
  transparent: boolean;
  characters: NaiCharacter[];
  useCoords: boolean;     // false = 位置交給 AI
  references: NaiReference[];
  fidelity: number;       // 只有 V4.5 有效
  width: number;
  height: number;
  steps: number;
  scale: number;
  sampler: string;
  noiseSchedule: string;
  cfgRescale: number;
  varietyPlus: boolean;
  img2img?: { image: string; strength: number; noise: number };
  seed?: number;
  signal?: AbortSignal;
}

export interface NaiGenerateResult {
  image: string;    // data URL
  seed: number;
  prompt: string;   // 實際送出的 prompt（含品質標籤）
  negative: string; // 實際送出的負面（含負面預設）
  model: string;    // 實際使用的模型 ID（Medium effort 會換成 -medium）
}

// zip 備援：官方預設回 zip，裡面只有一張圖
const extractFirstFileFromZip = async (buffer: ArrayBuffer): Promise<Blob> => {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x04034b50) throw new Error('NovelAI 回傳的不是圖片或 zip。');
  const method = view.getUint16(8, true);
  const compressedSize = view.getUint32(18, true);
  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const start = 30 + nameLength + extraLength;
  const data = new Uint8Array(buffer, start, compressedSize || buffer.byteLength - start);
  if (method === 0) return new Blob([data], { type: 'image/png' });
  if (method === 8) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Blob([await new Response(stream).arrayBuffer()], { type: 'image/png' });
  }
  throw new Error('無法解開 NovelAI 回傳的壓縮檔。');
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const friendlyNaiError = async (response: Response) => {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.message || body?.error || '';
  } catch { /* 非 JSON */ }
  switch (response.status) {
    case 400: return `NovelAI 拒絕了這個請求（400）${detail ? `：${detail}` : ''}`;
    case 401: return 'NovelAI token 無效或已失效（401）。請重新從 NovelAI 帳號設定取得 Persistent API Token。';
    case 402: return `NovelAI：需要有效訂閱或 Anlas 不足（402）${detail ? `：${detail}` : ''}`;
    case 429: return 'NovelAI：同時進行的生成太多（429），請等上一張完成再試。';
    default: return `NovelAI 發生錯誤（${response.status}）${detail ? `：${detail}` : ''}`;
  }
};

export const generateNovelAIImage = async (req: NaiGenerateRequest): Promise<NaiGenerateResult> => {
  if (!req.token) throw new Error('尚未設定 NovelAI token。');
  const caps = modelCaps(req.model);
  const { width, height } = req;
  if (width % 64 || height % 64) throw new Error('寬高必須是 64 的倍數。');
  const seed = req.seed ?? Math.floor(Math.random() * 4294967295);
  const defaults = defaultReferenceSettings(req.model);
  const fidelity = caps.fidelity ? req.fidelity : 1; // V5 沒有 fidelity，官方客戶端固定送 1

  // Medium effort = 另一個模型 ID；官方固定 14 步、Euler Ancestral、Heavy 負面預設、不用 cfg rescale、角色負面清空
  const medium = caps.effort && req.effort === 'medium' && req.references.length === 0;
  const model = medium ? 'nai-diffusion-5-full-medium' : req.model;
  const steps = medium ? 14 : req.steps;
  const sampler = medium ? 'k_euler_ancestral' : req.sampler;
  const { prompt, negative } = buildNaiPrompts({
    model: req.model, prompt: req.prompt, negativePrompt: req.negativePrompt, furry: req.furry,
    transparent: req.transparent, qualityPreset: req.qualityPreset, ucPreset: medium ? 'heavy' : req.ucPreset,
  });
  const characters = req.characters.filter(c => c.enabled && c.prompt.trim());
  const center = (c: NaiCharacter) => (caps.freeformPosition ? { x: c.x, y: c.y } : { x: snapToGrid(c.x), y: snapToGrid(c.y) });

  const parameters: Record<string, unknown> = {
    params_version: 3,
    width,
    height,
    scale: req.scale,
    sampler,
    steps,
    seed,
    n_samples: 1,
    sm: false,
    sm_dyn: false,
    dynamic_thresholding: false,
    controlnet_strength: 1,
    legacy: false,
    add_original_image: true,
    cfg_rescale: medium ? 0 : req.cfgRescale,
    noise_schedule: caps.noiseSchedule ? req.noiseSchedule : defaultNoiseSchedule(sampler),
    legacy_v3_extend: false,
    skip_cfg_above_sigma: caps.varietyPlus && req.varietyPlus ? VARIETY_SIGMA : null,
    use_coords: req.useCoords,
    legacy_uc: false,
    normalize_reference_strength_multiple: true,
    prompt,
    negative_prompt: negative,
    v4_prompt: {
      caption: { base_caption: prompt, char_captions: characters.map(c => ({ char_caption: c.prompt.trim(), centers: [center(c)] })) },
      use_coords: req.useCoords,
      use_order: true,
    },
    v4_negative_prompt: {
      caption: { base_caption: negative, char_captions: characters.map(c => ({ char_caption: medium ? '' : c.uc.trim(), centers: [center(c)] })) },
      legacy_uc: false,
    },
    characterPrompts: characters.map(c => ({ prompt: c.prompt.trim(), uc: medium ? '' : c.uc.trim(), center: center(c), enabled: true })),
  };
  if (caps.transparency && req.transparent) parameters.tag_hint_transparent_background = true;
  if (req.references.length) {
    const images = await Promise.all(req.references.map(ref => padReferenceImage(ref.image)));
    Object.assign(parameters, {
      director_reference_images: images,
      director_reference_descriptions: req.references.map(ref => ({ caption: { base_caption: ref.description, char_captions: [] }, legacy_uc: false })),
      director_reference_information_extracted: req.references.map(() => defaults.informationExtracted),
      director_reference_strength_values: req.references.map(ref => ref.strength),
      director_reference_secondary_strength_values: req.references.map(() => 1 - fidelity),
    });
  }
  if (req.img2img) {
    Object.assign(parameters, {
      image: await fitImage(req.img2img.image, width, height),
      strength: req.img2img.strength,
      noise: req.img2img.noise,
      extra_noise_seed: Math.max(0, seed - 1),
    });
  }

  const body = { input: prompt, model, action: req.img2img ? 'img2img' : 'generate', parameters };

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${req.token}`,
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });
  } catch (err: any) {
    if (req.signal?.aborted) throw new Error('GenerationCancelled');
    throw new Error(`無法連線到 NovelAI（${err?.message || '網路錯誤'}）。可能是網路問題，或 NovelAI 不再允許從網頁直接呼叫。`);
  }
  if (!response.ok) throw new Error(await friendlyNaiError(response));

  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const json = await response.json();
    const first = json?.images?.[0];
    const b64 = typeof first === 'string' ? first : first?.image;
    if (!b64) throw new Error('NovelAI 沒有回傳圖片。');
    const mime = b64.startsWith('UklGR') ? 'image/webp' : 'image/png';
    return { image: `data:${mime};base64,${b64}`, seed: first?.seed ?? seed, prompt, negative, model };
  }
  const buffer = await response.arrayBuffer();
  const blob = type.startsWith('image/') ? new Blob([buffer], { type }) : await extractFirstFileFromZip(buffer);
  return { image: await blobToDataUrl(blob), seed, prompt, negative, model };
};
