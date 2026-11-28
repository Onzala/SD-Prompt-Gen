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

export interface PoseEditRequest extends ImageOptions, StyleInputs {
  pose: PoseSource;
}

export interface RestyleRequest extends ImageOptions, StyleInputs {
  draftImage: string;      // 要校正的結果圖
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
  const lines = ['Task: redraw the character from IMAGE A in a new pose.', ...styleRules(req)];
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
    'Fix any drift in face, eyes, hair, outfit details and colors so they match IMAGE A.',
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
