export enum GeminiModel {
  FLASH_3 = 'gemini-3-flash-preview',
  PRO_3 = 'gemini-3-pro-preview',
  LITE_25 = 'gemini-flash-lite-latest'
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
  model: GeminiModel;
  hasImage: boolean;
}