
import { GoogleGenAI } from "@google/genai";
import { GeminiModel } from "../types";
import { SYSTEM_PROMPT } from "../constants";

export const generateSDPrompt = async (
  inputText: string,
  imageBase64: string | null,
  model: GeminiModel,
  tagDbContent: string | null,
  apiKeyOverride?: string
): Promise<string> => {
  const apiKey = apiKeyOverride || localStorage.getItem('gemini_api_key');

  if (!apiKey) {
    throw new Error("找不到 API 金鑰。請在設定中輸入您的 Gemini API Key。");
  }

  // 初始化 SDK - 使用物件形式，並標記為 any 以應對複雜的 SDK 型別問題
  const genAI: any = new GoogleGenAI({ apiKey } as any);

  const parts: any[] = [];

  // 1. 處理圖片輸入
  if (imageBase64) {
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      parts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2]
        }
      });
    }
  }

  // 2. 處理文字描述與資料庫
  let finalPrompt = inputText;
  if (inputText.trim() === "" && imageBase64) {
    finalPrompt = "Analyze this image and provide highly detailed technical tags for Stable Diffusion. Focus on character features, lighting, clothing, and composition.";
  }

  if (tagDbContent) {
    finalPrompt += `\n\n[Reference Tag Database]\nUtilize relevant keywords from this technical list if they match the visual requirements:\n\n"""\n${tagDbContent}\n"""`;
  }

  parts.push({ text: finalPrompt });

  try {
    // 使用原 SDK 的 ai.models.generateContent 模式
    const response = await genAI.models.generateContent({
      model: model,
      contents: [{
        role: "user",
        parts: parts
      }],
      config: {
        systemInstruction: SYSTEM_PROMPT || undefined,
        temperature: 0.8,
        topP: 0.95,
      },
      // 型別警告：安全性設定在不同版本 SDK 略有不同，此處使用寬鬆檢核
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    } as any);

    // 檢查候選結果
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (finishReason === 'SAFETY') {
      return "【安全性警告】Google 安全過濾器攔截了結果。建議：請改用更具藝術性的詞彙。";
    }

    if (!response.text || response.text.trim() === "") {
      throw new Error("模型未回傳任何內容，可能已被安全性過濾器完全攔截。");
    }

    return response.text;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errMsg = error.message || "";

    if (errMsg.includes("401") || errMsg.includes("403")) {
      throw new Error("API 金鑰無效或無權訪問此模型，請重新檢查設定。");
    }
    if (errMsg.includes("429")) {
      throw new Error("API 呼叫頻率過高 (429)。請稍候再試。");
    }

    throw error;
  }
};
