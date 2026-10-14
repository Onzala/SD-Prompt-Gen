export enum GeminiModel {
  FLASH_LITE_LATEST = 'gemini-flash-lite-latest',
  FLASH_3_8 = 'gemini-3.8-flash',
  PRO_3_1 = 'gemini-3.1-pro-preview',
  FLASH_LITE_3_1 = 'gemini-3.1-flash-lite',
  FLASH_LATEST = 'gemini-flash-latest'
}

export enum PromptFormat {
  SD = 'SD',   // Stable Diffusion (WebUI / ComfyUI)
  NAI = 'NAI'  // NovelAI Diffusion (V3 / V4)
}

export interface DanbooruArtist {
  tag: string;         // Danbooru tag name, e.g. "wlop"
  name: string;        // Display name in Chinese / English, e.g. "WLOP (王凌)"
  category: string;    // Category e.g. "極致厚塗", "日系萌系", "賽博科幻", "唯美風景", "暗黑奇幻"
  description: string; // Brief style description
  popular?: boolean;
  postCount?: number;  // Verified post count on Danbooru
}

export interface PromptResponse {
  markdown: string;
  rawText: string;
}

export interface ImageAttachment {
  base64: string;
  mimeType: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  inputText: string;
  generatedContent: string;
  model: GeminiModel | string;
  hasImage: boolean;
  format?: PromptFormat;
  artist?: string;
}

export interface ModificationSuggestion {
  label: string;
  action: string;
  description: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
