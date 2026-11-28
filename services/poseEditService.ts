// ==========================================
// 姿勢調整（實驗）：用 Gemini 原生圖片模型，把 A 角色改成 B 姿勢
// 查證日期 2026-11-28（aistudio.google.com/docs/image-generation、/pricing、/deprecations）：
//   - gemini-nano-banana-2.1：官方建議新專案使用，最多 4 張角色圖 + 10 張物件圖
//   - gemini-3.1-flash-image：穩定版，同樣上限，單價較高
//   - gemini-3-pro-image：品質最高、最貴（另有 3 張風格參考圖的額度）
//   - generateContent 已列為 legacy 但「fully supported」；沿用它是為了拿到
//     finishReason／promptFeedback，接進既有的審查統計。
//
// 畫風一致性是這個功能最難的地方，這裡用三種手段疊加：
//   1. 先用便宜的文字模型把 A 圖的畫風拆成具體描述，寫進提示詞（可手動修改）
//   2. 可另外附最多 3 張同角色／同畫風的圖當畫風參考
//   3. 生成後可做一次「風格校正」：把結果圖再對照 A 圖重繪一次（多花一次費用）
// ==========================================
import { HarmBlockThreshold, HarmCategory, Modality, type Part } from '@google/genai';
import { GeminiModel } from '../types';
import { getAIClient, isAbortError, isTemporaryModelError, toFriendlyError, wait } from './geminiService';
import { getBlockReason, looksLikeRefusal, recordModerationOutcome } from './moderationStats';

export interface ImageModelOption {
  id: string;
  label: string;
  note: string;
  // 每張輸出圖的官方定價（美元，付費方案）
  price: Record<'1K' | '2K', number>;
}

export const IMAGE_MODELS: ImageModelOption[] = [
  { id: 'gemini-nano-banana-2.1', label: 'Nano Banana 2.1', note: '官方推薦，便宜', price: { '1K': 0.0336, '2K': 0.0504 } },
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2', note: '穩定版', price: { '1K': 0.067, '2K': 0.101 } },
  { id: 'gemini-3-pro-image', label: 'Nano Banana Pro', note: '品質最高、最貴', price: { '1K': 0.134, '2K': 0.134 } },
];

export const ASPECT_RATIOS = ['auto', '1:1', '2:3', '3:4', '4:5', '9:16', '3:2', '4:3', '16:9'] as const;
export type AspectRatio = typeof ASPECT_RATIOS[number];
export type ImageSize = '1K' | '2K';
export const MAX_STYLE_REFS = 3;

export interface PoseSource {
  image?: string;       // data URL；沒有就只用文字描述
  title?: string;
  description?: string;
}

interface ImageOptions {
  model: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  signal?: AbortSignal;
}

interface StyleInputs {
  characterImage: string;  // data URL
  styleRefs?: string[];    // 同角色／同畫風的其他圖
  styleDescription?: string;
  extraInstruction?: string;
}

export interface OutfitSource {
  image: string;        // data URL
  title?: string;
  description?: string;
}

export interface PoseEditRequest extends ImageOptions, StyleInputs {
  pose: PoseSource;
  outfit?: OutfitSource; // 換穿素材庫的服裝
}

export interface RestyleRequest extends ImageOptions, StyleInputs {
  draftImage: string;      // 要校正的結果圖
  keepDraftOutfit?: boolean; // 換過服裝時，校正不要把衣服改回 A 圖
}

export interface PoseEditResult {
  image?: string;        // data URL
  text?: string;         // 模型附帶的文字
  usedModel: string;
  notice?: string;       // 被擋、空白等狀況的說明
  fallbackFrom?: string;
}

const toInlinePart = (dataUrl: string, label: string): Part => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error(`無法讀取${label}。`);
  return { inlineData: { mimeType: match[1], data: match[2] } };
};

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// ------------------------------------------
// 1. 畫風分析（文字模型，費用遠低於一張圖）
// ------------------------------------------
const STYLE_ANALYSIS_PROMPT = `You are an illustration art director. Describe ONLY the art style of this image so another illustrator can match it exactly. Do NOT describe the character's identity, clothing or pose.
Cover, as concrete visual facts (not artist names):
- medium and finish (cel shading, soft painterly, flat color, watercolor, 3D render, sketchy, etc.)
- line art: presence, color, thickness, variation, tapering, clean vs rough
- shading: number of tones, hard or soft edges, shadow color temperature, highlights / rim light
- color: saturation, palette tendency, contrast, overall brightness
- face and eyes: eye shape and size, iris / highlight rendering, nose and mouth simplification
- proportions: head-to-body ratio, limb thickness, level of stylization
- texture, grain, glow, background treatment
Output 6–10 short English bullet lines, no preamble.`;

export const analyzeArtStyle = async (characterImage: string, signal?: AbortSignal): Promise<string> => {
  const ai = getAIClient();
  let lastError: any = null;
  for (const model of [GeminiModel.FLASH_LITE_LATEST, GeminiModel.FLASH_3_8, GeminiModel.FLASH_LATEST] as string[]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [toInlinePart(characterImage, '角色圖'), { text: STYLE_ANALYSIS_PROMPT }] }],
        config: { temperature: 0.3, abortSignal: signal, safetySettings: SAFETY_SETTINGS },
      });
      const blockReason = getBlockReason(response);
      if (blockReason) {
        recordModerationOutcome(model, true, 'blocked', blockReason);
        throw new Error(`畫風分析被 ${model} 的安全過濾器攔截（${blockReason}），可以手動填寫畫風描述。`);
      }
      const text = (response.text || '').trim();
      if (!text || looksLikeRefusal(text)) {
        recordModerationOutcome(model, true, text ? 'refused' : 'empty');
        throw new Error(`畫風分析沒有結果（${model}），可以手動填寫畫風描述。`);
      }
      recordModerationOutcome(model, true, 'ok');
      return text;
    } catch (err: any) {
      if (signal?.aborted || isAbortError(err)) throw new Error('GenerationCancelled');
      lastError = err;
      if (isTemporaryModelError(err)) {
        await wait(600, signal);
        continue;
      }
      throw err.message?.startsWith('畫風分析') ? err : toFriendlyError(err);
    }
  }
  throw toFriendlyError(lastError);
};

// ------------------------------------------
// 1b. 姿勢 → Danbooru 標籤（給 NovelAI 用；NovelAI 現行模型沒有從圖片參考姿勢的功能）
// ------------------------------------------
const POSE_TAG_PROMPT = `Convert the body pose into Danbooru tags for NovelAI image generation.
Output ONLY pose-related tags, comma-separated, lowercase, using spaces not underscores. No preamble, no explanation.
Include, when visible: overall posture (standing / sitting / kneeling / lying / squatting / leaning...), leg position (crossed legs, knees up, legs apart, one knee up...), arm and hand position (arms up, hand on hip, hand on own cheek, arms behind back, peace sign...), torso direction and twist, head direction and tilt, looking at viewer or away, camera angle (from above, from below, from side, from behind, dutch angle...), framing (full body, cowboy shot, upper body...).
Do NOT include character appearance, clothing, hair, gender, art style, background or quality tags.
Aim for 8–20 precise tags.`;

export const poseToDanbooruTags = async (pose: PoseSource, signal?: AbortSignal): Promise<string> => {
  const ai = getAIClient();
  const parts: Part[] = [];
  if (pose.image) parts.push(toInlinePart(pose.image, '姿勢參考圖'));
  const hint = [pose.title, pose.description].filter(Boolean).join(' — ');
  parts.push({ text: `${POSE_TAG_PROMPT}${hint ? `\nPose notes (may be in Chinese): ${hint}` : ''}` });
  let lastError: any = null;
  for (const model of [GeminiModel.FLASH_LITE_LATEST, GeminiModel.FLASH_3_8, GeminiModel.FLASH_LATEST] as string[]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { temperature: 0.2, abortSignal: signal, safetySettings: SAFETY_SETTINGS },
      });
      const blockReason = getBlockReason(response);
      if (blockReason) {
        recordModerationOutcome(model, !!pose.image, 'blocked', blockReason);
        throw new Error(`姿勢轉標籤被 ${model} 的安全過濾器攔截（${blockReason}），可以手動填寫姿勢標籤。`);
      }
      const text = (response.text || '').trim();
      if (!text || looksLikeRefusal(text)) {
        recordModerationOutcome(model, !!pose.image, text ? 'refused' : 'empty');
        throw new Error(`姿勢轉標籤沒有結果（${model}），可以手動填寫姿勢標籤。`);
      }
      recordModerationOutcome(model, !!pose.image, 'ok');
      return text.replace(/```[a-z]*|```/g, '').replace(/\s*\n\s*/g, ', ').replace(/_/g, ' ').replace(/,\s*,/g, ',').trim();
    } catch (err: any) {
      if (signal?.aborted || isAbortError(err)) throw new Error('GenerationCancelled');
      lastError = err;
      if (isTemporaryModelError(err)) {
        await wait(600, signal);
        continue;
      }
      throw err.message?.startsWith('姿勢轉標籤') ? err : toFriendlyError(err);
    }
  }
  throw toFriendlyError(lastError);
};

// 角色圖的外觀 → Danbooru 外觀標籤（補強 Precise Reference 容易遺漏的細節）
const appearancePrompt = (excludeOutfit: boolean) => `List the identifying APPEARANCE of the main character in this illustration as Danbooru tags for NovelAI image generation.
Output ONLY comma-separated lowercase tags with spaces (no underscores), no explanation.
Pick the 6–15 most distinctive, clearly visible features, in this order:
- hair: length, color, style (e.g. long hair, white hair, twintails, hime cut, ahoge, hair over one eye)
- eyes: color and notable traits (red eyes, heterochromia, tsurime)
- distinctive body / face features (animal ears, horns, mole under eye, dark skin, freckles)
${excludeOutfit
  ? '- Do NOT tag any clothing or accessories worn on clothes: the outfit will be replaced.'
  : '- outfit: main garments with colors, then the most distinctive accessories (e.g. black jacket, white shirt, pleated skirt, choker, thighhighs)'}
Do NOT tag pose, expression, camera angle, background, art style, quality words, or character / series names. Do NOT tag count tags like 1girl or solo.`;

export const appearanceToDanbooruTags = async (characterImage: string, excludeOutfit: boolean, signal?: AbortSignal): Promise<string> => {
  const ai = getAIClient();
  let lastError: any = null;
  for (const model of [GeminiModel.FLASH_LITE_LATEST, GeminiModel.FLASH_3_8, GeminiModel.FLASH_LATEST] as string[]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [toInlinePart(characterImage, '角色圖'), { text: appearancePrompt(excludeOutfit) }] }],
        config: { temperature: 0.2, abortSignal: signal, safetySettings: SAFETY_SETTINGS },
      });
      const blockReason = getBlockReason(response);
      const out = (response.text || '').trim();
      if (blockReason || !out || looksLikeRefusal(out)) {
        recordModerationOutcome(model, true, blockReason ? 'blocked' : out ? 'refused' : 'empty', blockReason);
        throw new Error(`外觀標籤分析沒有結果（${model}${blockReason ? `，${blockReason}` : ''}），可以手動填寫外觀標籤。`);
      }
      recordModerationOutcome(model, true, 'ok');
      return out.replace(/```[a-z]*|```/g, '').replace(/\s*\n\s*/g, ', ').replace(/_/g, ' ')
        .split(',').map(t => t.trim()).filter(t => t && !/^(\d+(girl|boy)s?|solo|masterpiece|best quality)$/.test(t)).join(', ');
    } catch (err: any) {
      if (signal?.aborted || isAbortError(err)) throw new Error('GenerationCancelled');
      lastError = err;
      if (isTemporaryModelError(err)) {
        await wait(600, signal);
        continue;
      }
      throw err.message?.startsWith('外觀標籤') ? err : toFriendlyError(err);
    }
  }
  throw toFriendlyError(lastError);
};

// 角色圖的畫風 → Danbooru 畫風標籤（給 NovelAI，補強 Precise Reference）
const STYLE_TAG_PROMPT = `Describe ONLY the art style of this illustration as Danbooru tags for NovelAI image generation.
Output ONLY comma-separated lowercase tags with spaces (no underscores), no explanation.
Pick 6–14 tags that are actually visible, from areas like:
- medium / rendering: flat color, cel shading, soft shading, painterly, watercolor (medium), realistic, semi-realistic, 3d, sketch, oekaki
- line art: thick outlines, thin outlines, no lineart, colored outline, black outline
- shading & light: gradient, rim lighting, backlighting, dramatic lighting, soft lighting, high contrast, glowing
- color: pastel colors, muted colors, vivid colors, limited palette, monochrome, warm colors, cool colors
- face / anatomy stylization: detailed eyes, shiny skin, detailed skin, chibi, mature female proportions
- era / look: retro artstyle, 1990s (style), anime coloring, game cg, official art
Do NOT tag character identity, hair, eyes color, clothing, pose, background objects or quality words (masterpiece, best quality). Do NOT guess an artist name.`;

export const styleToDanbooruTags = async (characterImage: string, signal?: AbortSignal): Promise<string> => {
  const ai = getAIClient();
  let lastError: any = null;
  for (const model of [GeminiModel.FLASH_LITE_LATEST, GeminiModel.FLASH_3_8, GeminiModel.FLASH_LATEST] as string[]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [toInlinePart(characterImage, '角色圖'), { text: STYLE_TAG_PROMPT }] }],
        config: { temperature: 0.2, abortSignal: signal, safetySettings: SAFETY_SETTINGS },
      });
      const blockReason = getBlockReason(response);
      const out = (response.text || '').trim();
      if (blockReason || !out || looksLikeRefusal(out)) {
        recordModerationOutcome(model, true, blockReason ? 'blocked' : out ? 'refused' : 'empty', blockReason);
        throw new Error(`畫風標籤分析沒有結果（${model}${blockReason ? `，${blockReason}` : ''}），可以手動填寫畫風標籤。`);
      }
      recordModerationOutcome(model, true, 'ok');
      return out.replace(/```[a-z]*|```/g, '').replace(/\s*\n\s*/g, ', ').replace(/_/g, ' ')
        .split(',').map(t => t.trim()).filter(t => t && !/^(masterpiece|best quality|high quality|very aesthetic)$/.test(t)).join(', ');
    } catch (err: any) {
      if (signal?.aborted || isAbortError(err)) throw new Error('GenerationCancelled');
      lastError = err;
      if (isTemporaryModelError(err)) {
        await wait(600, signal);
        continue;
      }
      throw err.message?.startsWith('畫風標籤') ? err : toFriendlyError(err);
    }
  }
  throw toFriendlyError(lastError);
};

// 中文等自然語言 → Danbooru 標籤（NovelAI 看不懂中文）
export const hasCJK = (text: string) => /[぀-ヿ㐀-鿿가-힯]/.test(text);

export const textToDanbooruTags = async (text: string, signal?: AbortSignal): Promise<string> => {
  const ai = getAIClient();
  const prompt = `Convert this request into Danbooru tags for NovelAI. Output ONLY comma-separated lowercase tags with spaces (no underscores), no explanation. Keep the meaning; do not add unrelated tags.\nRequest: ${text}`;
  let lastError: any = null;
  for (const model of [GeminiModel.FLASH_LITE_LATEST, GeminiModel.FLASH_3_8, GeminiModel.FLASH_LATEST] as string[]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.2, abortSignal: signal, safetySettings: SAFETY_SETTINGS },
      });
      const blockReason = getBlockReason(response);
      const out = (response.text || '').trim();
      if (blockReason || !out || looksLikeRefusal(out)) {
        recordModerationOutcome(model, false, blockReason ? 'blocked' : out ? 'refused' : 'empty', blockReason);
        throw new Error(`標籤轉換沒有結果（${model}${blockReason ? `，${blockReason}` : ''}），請改用英文 Danbooru 標籤。`);
      }
      recordModerationOutcome(model, false, 'ok');
      return out.replace(/```[a-z]*|```/g, '').replace(/\s*\n\s*/g, ', ').replace(/_/g, ' ').trim();
    } catch (err: any) {
      if (signal?.aborted || isAbortError(err)) throw new Error('GenerationCancelled');
      lastError = err;
      if (isTemporaryModelError(err)) {
        await wait(600, signal);
        continue;
      }
      throw err.message?.startsWith('標籤轉換') ? err : toFriendlyError(err);
    }
  }
  throw toFriendlyError(lastError);
};

// ------------------------------------------
// 2. 提示詞
// ------------------------------------------
const styleParts = ({ characterImage, styleRefs = [] }: StyleInputs): Part[] => {
  const parts: Part[] = [{ text: 'IMAGE A (the character AND the art style to match):' }, toInlinePart(characterImage, '角色圖')];
  styleRefs.forEach((ref, i) => {
    parts.push({ text: `STYLE REFERENCE ${i + 1} (same artist / same character, use for art style and character details):` }, toInlinePart(ref, `畫風參考圖 ${i + 1}`));
  });
  return parts;
};

const styleRules = ({ styleRefs = [], styleDescription }: StyleInputs) => {
  const sources = styleRefs.length ? 'IMAGE A and the STYLE REFERENCE images' : 'IMAGE A';
  const lines = [
    `ART STYLE IS THE TOP PRIORITY. The result must look like another illustration drawn by the same artist as ${sources}, as if taken from the same artbook.`,
    `Match exactly: line art color and thickness, shading method and number of tones, shadow color, highlight style, color saturation and palette, eye and face rendering, head-to-body proportions, level of detail and texture.`,
    'Do not make it more realistic, more 3D, more detailed, glossier or "higher quality" than IMAGE A. Do not switch to a generic anime or AI-art look.',
  ];
  if (styleDescription?.trim()) lines.push(`Art style of IMAGE A, described:\n${styleDescription.trim()}`);
  lines.push('Keep the same character identity from IMAGE A: face, hairstyle, hair color, eye color, body type, outfit, accessories and colors.');
  return lines;
};

const extraLine = (extra?: string) =>
  extra?.trim() ? [`Additional user instruction (may be in Chinese): ${extra.trim()}`] : [];

const buildPoseParts = (req: PoseEditRequest): Part[] => {
  const parts = styleParts(req);
  if (req.pose.image) parts.push({ text: 'POSE GUIDE (skeleton only):' }, toInlinePart(req.pose.image, '姿勢參考圖'));
  if (req.outfit) parts.push({ text: 'OUTFIT REFERENCE (clothing only):' }, toInlinePart(req.outfit.image, '服裝參考圖'));
  const lines = ['Task: redraw the character from IMAGE A in a new pose.', ...styleRules(req)];
  if (req.outfit) {
    const outfitText = [req.outfit.title, req.outfit.description].filter(Boolean).join(' — ');
    lines.push(
      "OUTFIT OVERRIDE: dress the character in the clothing and accessories shown in the OUTFIT REFERENCE instead of IMAGE A's outfit. Keep IMAGE A's face, hair, body and art style; take only the garments' design, layers and colors from the OUTFIT REFERENCE, redrawn in IMAGE A's style.",
      ...(outfitText ? [`Outfit description: ${outfitText}`] : []),
    );
  }
  if (req.pose.image) {
    lines.push(
      'The POSE GUIDE is drawn in a DIFFERENT style (line drawing, mannequin, depth map or another person). Use it ONLY as a skeleton: body pose, limb positions, head direction, hand gestures and camera angle.',
      'Never copy anything visual from the POSE GUIDE: not its lines, shading, face, body shape, clothing or background. Re-draw the pose from scratch in IMAGE A\'s style.',
    );
  }
  const poseText = [req.pose.title, req.pose.description].filter(Boolean).join(' — ');
  if (poseText) lines.push(`Pose description: ${poseText}`);
  lines.push('Output a single illustration with a simple background unless told otherwise. No text, no watermark.', ...extraLine(req.extraInstruction));
  parts.push({ text: lines.join('\n') });
  return parts;
};

const buildRestyleParts = (req: RestyleRequest): Part[] => {
  const parts = styleParts(req);
  parts.push({ text: 'DRAFT (correct pose, but the art style drifted):' }, toInlinePart(req.draftImage, '待校正的圖'));
  const lines = [
    'Task: re-render the DRAFT so its art style matches IMAGE A exactly.',
    'Keep the DRAFT\'s pose, composition, framing, camera angle and background layout unchanged.',
    ...styleRules(req),
    req.keepDraftOutfit
      ? "Fix any drift in face, eyes and hair so they match IMAGE A. Keep the DRAFT's outfit design; only re-render it in IMAGE A's style."
      : 'Fix any drift in face, eyes, hair, outfit details and colors so they match IMAGE A.',
    'Output a single illustration. No text, no watermark.',
    ...extraLine(req.extraInstruction),
  ];
  parts.push({ text: lines.join('\n') });
  return parts;
};

// ------------------------------------------
// 3. 呼叫圖片模型（503／429 時改用下一個圖片模型）
// ------------------------------------------
const candidateModels = (requested: string) =>
  [requested, ...IMAGE_MODELS.map(m => m.id).filter(id => id !== requested)].slice(0, 2);

const callImageModel = async (parts: Part[], opts: ImageOptions): Promise<PoseEditResult> => {
  const ai = getAIClient();
  let lastError: any = null;
  for (const model of candidateModels(opts.model)) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            ...(opts.aspectRatio !== 'auto' ? { aspectRatio: opts.aspectRatio } : {}),
            imageSize: opts.imageSize,
          },
          abortSignal: opts.signal,
          // 只能放寬可調整的類別；兒少安全與圖片輸出審查（IMAGE_SAFETY）無法關閉
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const fallbackFrom = model !== opts.model ? opts.model : undefined;
      const blockReason = getBlockReason(response);
      if (blockReason) {
        recordModerationOutcome(model, true, 'blocked', blockReason);
        return {
          usedModel: model, fallbackFrom,
          notice: `${model} 的安全過濾器攔截了這次生成（${blockReason}）。圖片模型的審查比文字嚴，可試著換一張較保守的角色圖或姿勢、拿掉暴露或暴力相關的描述。`,
        };
      }

      const outParts = response.candidates?.[0]?.content?.parts ?? [];
      // 有些模型會先回「思考中」的草圖，取最後一張非 thought 的圖
      const imagePart = [...outParts].reverse().find(p => p.inlineData?.data && !p.thought);
      const text = outParts.filter(p => p.text && !p.thought).map(p => p.text).join('\n').trim() || undefined;
      const finish = response.candidates?.[0]?.finishReason;

      if (!imagePart?.inlineData) {
        const refused = !!text && looksLikeRefusal(text);
        recordModerationOutcome(model, true, refused ? 'refused' : 'empty', finish && finish !== 'STOP' ? String(finish) : undefined);
        return {
          usedModel: model, fallbackFrom, text,
          notice: refused
            ? `${model} 拒絕生成這張圖。`
            : `${model} 沒有回傳圖片${finish && finish !== 'STOP' ? `（${finish}）` : ''}，可能是隱性審查，或模型只回了文字。可以再試一次或換模型。`,
        };
      }

      recordModerationOutcome(model, true, 'ok');
      const { mimeType = 'image/png', data } = imagePart.inlineData;
      return { image: `data:${mimeType};base64,${data}`, text, usedModel: model, fallbackFrom };
    } catch (err: any) {
      if (opts.signal?.aborted || isAbortError(err)) throw new Error('GenerationCancelled');
      lastError = err;
      if (isTemporaryModelError(err)) {
        await wait(800, opts.signal);
        continue;
      }
      throw toFriendlyError(err);
    }
  }
  throw toFriendlyError(lastError);
};

export const generatePoseImage = (req: PoseEditRequest) => callImageModel(buildPoseParts(req), req);
export const restyleImage = (req: RestyleRequest) => callImageModel(buildRestyleParts(req), req);

// 把使用者上傳的圖縮到最長邊 2048 以內，避免超過 20MB 的請求上限
export const fileToScaledDataUrl = (file: Blob, maxSide = 2048): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 4 * 1024 * 1024 && /^image\/(png|jpeg|webp)$/.test(file.type)) {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('瀏覽器無法處理這張圖片。'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法讀取這張圖片，請改用 JPG、PNG 或 WebP。'));
    };
    img.src = url;
  });

// ------------------------------------------
// 把一張圖拆解成 NovelAI 的各個欄位（基本 prompt、角色 prompt、位置、負面、尺寸、模式）
// 寫法依官方文件 docs.novelai.net/en/image/multiplecharacters、/tags（2026-11-28 查證）：
//   人數標籤（1girl, 1boy…）只放基本 prompt；角色欄只寫 girl／boy／other，不寫數字；
//   互動動作用 source#／target#／mutual# 前綴
// ------------------------------------------
export interface NaiDecomposition {
  orientation: 'portrait' | 'landscape' | 'square';
  furry: boolean;
  base: { subjects: string; style: string; composition: string; scene: string; other: string };
  characters: { prompt: string; x: number; y: number }[];
  negative: string;
  text: string;
}

const DECOMPOSE_PROMPT = `You are a NovelAI Diffusion V4.5/V5 prompt engineer. Break this image down into the fields of NovelAI's image generation form so that it can be re-created.
Use Danbooru tags: lowercase, spaces instead of underscores, comma-separated. Never invent artist names. Do not add quality tags (masterpiece, best quality, very aesthetic, no text) — the app adds those.
Return ONLY JSON with this shape:
{
  "orientation": "portrait" | "landscape" | "square",
  "furry": boolean,                 // true only if the main subjects are anthro/furry characters
  "base": {
    "subjects": "",                 // subject count tags ONLY, e.g. "1girl", "1boy, 1girl", "2girls", "no humans"
    "style": "",                    // medium and art style: line weight, shading, coloring, e.g. "thick lines, flat color, cel shading, digital art"
    "composition": "",              // framing and camera: "cowboy shot", "full body", "from above", "straight-on", "dutch angle", "looking at viewer" if shared by all
    "scene": "",                    // background / location / lighting / weather / time / mood, e.g. "school, classroom, window, sunlight". Use "location" if a non-specific background is visible, "simple background, white background" if plain
    "other": ""                     // relationship or whole-scene tags (couple, matching outfits), era as "year 20XX" only if obvious, and one rating tag: rating:general / rating:sensitive / rating:questionable / rating:explicit
  },
  "characters": [                   // one entry per visible person/creature, left to right; empty for scenery
    { "prompt": "", "x": 0.5, "y": 0.5 }
    // prompt starts with "girl", "boy" or "other" (no numbers), then: species if non-human, hair, eyes, body, outfit, accessories, expression, pose, action.
    // For actions between characters, prefix the action tag: "source#" for the one doing it, "target#" for the one receiving it, "mutual#" for both (e.g. "source#princess carry" and "target#princess carry", "mutual#hug").
    // x, y = centre of that character in the image, 0 to 1 (x left→right, y top→bottom).
  ],
  "negative": "",                   // a few tags for things that should clearly be avoided to keep this look (e.g. "realistic, 3d" for a flat anime image); may be empty
  "text": ""                        // readable text written in the image, verbatim, else ""
}`;

const clamp01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
const cleanTags = (v: unknown) => (typeof v === 'string' ? v : '').replace(/_/g, ' ').replace(/\s*\n\s*/g, ', ').replace(/\s+,/g, ',').trim();

export const decomposeImageForNovelAI = async (image: string, signal?: AbortSignal): Promise<NaiDecomposition> => {
  const ai = getAIClient();
  let lastError: any = null;
  for (const model of [GeminiModel.FLASH_LATEST, GeminiModel.FLASH_3_8, GeminiModel.FLASH_LITE_LATEST] as string[]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [toInlinePart(image, '要拆解的圖'), { text: DECOMPOSE_PROMPT }] }],
        config: { temperature: 0.2, abortSignal: signal, safetySettings: SAFETY_SETTINGS, responseMimeType: 'application/json' },
      });
      const blockReason = getBlockReason(response);
      const out = (response.text || '').trim();
      let json: any = null;
      try {
        json = JSON.parse(out.replace(/^```(json)?|```$/g, ''));
      } catch { /* 不是 JSON */ }
      if (blockReason || !json || typeof json !== 'object') {
        recordModerationOutcome(model, true, blockReason ? 'blocked' : out ? 'refused' : 'empty', blockReason);
        throw new Error(`圖片拆解沒有結果（${model}${blockReason ? `，${blockReason}` : ''}），可以換一張圖或手動填寫。`);
      }
      recordModerationOutcome(model, true, 'ok');
      const base = json.base ?? {};
      return {
        orientation: ['portrait', 'landscape', 'square'].includes(json.orientation) ? json.orientation : 'portrait',
        furry: json.furry === true,
        base: {
          subjects: cleanTags(base.subjects),
          style: cleanTags(base.style),
          composition: cleanTags(base.composition),
          scene: cleanTags(base.scene),
          other: cleanTags(base.other),
        },
        characters: (Array.isArray(json.characters) ? json.characters : [])
          .map((c: any) => ({ prompt: cleanTags(c?.prompt), x: clamp01(c?.x), y: clamp01(c?.y) }))
          .filter((c: { prompt: string }) => c.prompt),
        negative: cleanTags(json.negative),
        text: typeof json.text === 'string' ? json.text.trim() : '',
      };
    } catch (err: any) {
      if (signal?.aborted || isAbortError(err)) throw new Error('GenerationCancelled');
      lastError = err;
      if (isTemporaryModelError(err)) {
        await wait(600, signal);
        continue;
      }
      throw err.message?.startsWith('圖片拆解') ? err : toFriendlyError(err);
    }
  }
  throw toFriendlyError(lastError);
};
