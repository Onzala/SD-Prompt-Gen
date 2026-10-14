import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { GeminiModel, PromptFormat, ModificationSuggestion } from "../types";
import { SYSTEM_PROMPT_SD, SYSTEM_PROMPT_NAI, SUGGESTION_PROMPT, resolveDanbooruTag } from "../constants";

export interface GenerateResult {
  content: string;
  fallbackNotice?: string;
  usedModel?: string;
}

// ==========================================
// API 金鑰（只存在使用者自己的瀏覽器 localStorage）
// ==========================================
const API_KEY_STORAGE = 'sd_prompt_gemini_api_key';

export const getStoredApiKey = (): string => {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
};

export const setStoredApiKey = (key: string) => {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    /* 無痕模式等情況可能無法寫入 */
  }
};

const getAIClient = () => {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error('尚未設定 Gemini API 金鑰。請點擊右上角「API 金鑰」輸入您的金鑰。');
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to check if error is a temporary surge/503/429 condition
const isTemporaryModelError = (error: any): boolean => {
  if (!error) return false;
  const msg = typeof error === 'string'
    ? error
    : (error?.message || (typeof error?.toString === 'function' ? error.toString() : ''));
  const status = error?.status;
  const code = error?.code;
  return (
    status === 503 ||
    status === 429 ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED' ||
    code === 503 ||
    code === 429 ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('Spikes in demand') ||
    msg.includes('overloaded') ||
    msg.includes('quota') ||
    msg.includes('temporarily unavailable')
  );
};

const isAbortError = (error: any) =>
  error?.name === 'AbortError' || error?.message === 'AbortError' || /aborted/i.test(error?.message || '');

// 可被 AbortSignal 中斷的等待
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('GenerationCancelled'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('GenerationCancelled'));
    }, { once: true });
  });

// Generate fallback candidate models in prioritized order
const getCandidateModels = (requestedModel: string): string[] => {
  const modelPool = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    GeminiModel.FLASH_3_8,
    GeminiModel.FLASH_LATEST,
    GeminiModel.FLASH_LITE_3_1,
  ];
  const list = [requestedModel];
  for (const m of modelPool) {
    if (!list.includes(m)) {
      list.push(m);
    }
  }
  return list;
};

const toFriendlyError = (error: any): Error => {
  let userFriendlyMsg = error?.message || '生成提示詞失敗';
  try {
    const parsed = JSON.parse(userFriendlyMsg);
    if (parsed.error?.message) {
      userFriendlyMsg = parsed.error.message;
    }
  } catch (_) {}

  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(userFriendlyMsg)) {
    return new Error('API 金鑰無效或沒有權限，請點擊右上角「API 金鑰」重新設定。');
  }
  if (isTemporaryModelError(error) || userFriendlyMsg.includes('high demand') || userFriendlyMsg.includes('503')) {
    return new Error('Google Gemini 模型伺服器目前流量高峰（503 暫時繁忙）。系統已自動嘗試備援模型，建議稍候 3~5 秒後點擊「立即重試」，或手動切換選單至其他模型。');
  }
  return new Error(userFriendlyMsg);
};

export const generateSDPrompt = async (
  inputText: string,
  imageBase64: string | null,
  model: GeminiModel | string,
  format: PromptFormat = PromptFormat.SD,
  artistTag?: string | null,
  signal?: AbortSignal
): Promise<GenerateResult> => {
  const ai = getAIClient();
  const parts: any[] = [];

  if (imageBase64) {
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      parts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });
    }
  }

  const baseSystemPrompt = format === PromptFormat.NAI ? SYSTEM_PROMPT_NAI : SYSTEM_PROMPT_SD;
  let extraInstructions = `\n\nTarget Output Format: ${format === PromptFormat.NAI ? 'NovelAI (NAI Diffusion V3/V4 with Danbooru curly bracket weights)' : 'Stable Diffusion (WebUI/ComfyUI with parenthesis weights)'}`;

  if (artistTag) {
    const canonicalTag = resolveDanbooruTag(artistTag);
    if (format === PromptFormat.NAI) {
      extraInstructions += `\n\n[SPECIFIED DANBOORU ARTIST TAG]: "${canonicalTag}".
CRITICAL REQUIREMENT: This is the official canonical tag from Danbooru (for example, Krenz Cushart is strictly 'krenz', NOT 'krenz_cushart'). You MUST output {artist:${canonicalTag}} in Line 2 (Artist & Style) and emulate this specific Danbooru artist's visual rendering technique, line work, and coloring.`;
    } else {
      extraInstructions += `\n\n[SPECIFIED DANBOORU ARTIST TAG]: "${canonicalTag}".
CRITICAL REQUIREMENT: This is the official canonical tag from Danbooru. You MUST include (by ${canonicalTag}:1.1) or (${canonicalTag}:1.1) in the tags and emulate this artist's visual style accurately.`;
    }
  }

  let finalPrompt = inputText;
  if (inputText.trim() === '' && imageBase64) {
    if (format === PromptFormat.NAI) {
      finalPrompt = 'Analyze this image in high detail and produce technical NovelAI tags (Danbooru tags with curly brace weights) that could reproduce this anime illustration.';
    } else {
      finalPrompt = 'Analyze this image in extreme detail and provide technical Stable Diffusion tags that could reproduce a nearly identical image. Focus on style, composition, lighting, and specific character/object features.';
    }
  }

  finalPrompt = `${finalPrompt}\n${extraInstructions}`;
  parts.push({ text: finalPrompt });

  // Multi-model fallback retry loop
  const candidateModels = getCandidateModels(model);
  let lastError: any = null;
  let responseText = '';
  let usedModel: string = model;

  try {
    for (const targetModel of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: [{ role: 'user', parts: parts }],
          config: {
            systemInstruction: baseSystemPrompt,
            temperature: 0.75,
            topP: 0.95,
            abortSignal: signal,
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
          },
        });

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
          return { content: '【安全性警告】過濾器攔截了部分輸出。請嘗試調整提示詞或使用更具藝術學術性的標籤描述。' };
        }

        responseText = response.text || '';
        usedModel = targetModel;
        break; // Successfully generated!
      } catch (err: any) {
        if (signal?.aborted || isAbortError(err)) throw new Error('GenerationCancelled');
        lastError = err;
        if (isTemporaryModelError(err)) {
          console.warn(`[Gemini Overload] Model ${targetModel} is experiencing temporary high demand (503). Attempting fallback model...`);
          await wait(600, signal);
          continue;
        } else {
          throw err;
        }
      }
    }
  } catch (error: any) {
    if (error.message === 'GenerationCancelled') throw error;
    console.error('Generate error:', error);
    throw toFriendlyError(error);
  }

  if (!responseText && lastError) {
    throw toFriendlyError(lastError);
  }

  const fallbackNotice = usedModel !== model
    ? `【自動備援】原選模型（${model}）因官方伺服器瞬時高峰暫時繁忙，已自動為您由備援模型（${usedModel}）無縫生成！`
    : undefined;

  return {
    content: responseText,
    usedModel,
    fallbackNotice,
  };
};

export const getRefinementSuggestions = async (
  currentPrompt: string,
  format: PromptFormat = PromptFormat.SD,
  signal?: AbortSignal
): Promise<ModificationSuggestion[]> => {
  try {
    const ai = getAIClient();
    const promptText = `Current Output Format: ${format}\nCurrent Generated Content:\n${currentPrompt}\n\nPlease generate 3 creative refinement suggestions in Traditional Chinese (繁體中文).`;

    const candidateModels = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', GeminiModel.FLASH_3_8];

    for (const targetModel of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          config: {
            systemInstruction: SUGGESTION_PROMPT,
            abortSignal: signal,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  action: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['label', 'action', 'description'],
              },
            },
          },
        });

        return JSON.parse(response.text || '[]');
      } catch (err: any) {
        if (signal?.aborted || isAbortError(err)) return [];
        if (isTemporaryModelError(err)) {
          await wait(400, signal);
          continue;
        }
        break;
      }
    }
  } catch (error) {
    console.error('Suggestion error:', error);
  }
  return [];
};
