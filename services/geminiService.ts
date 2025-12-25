
import { GoogleGenAI } from "@google/genai";
import { GeminiModel } from "../types";
import { SYSTEM_PROMPT } from "../constants";

export const generateSDPrompt = async (
  inputText: string,
  imageBase64: string | null,
  model: GeminiModel,
  tagDbContent: string | null
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("找不到 API 金鑰。請點擊頂部的「設定金鑰」按鈕選擇金鑰。");
  }

  // 每次呼叫時建立新實例，確保使用最新的 API 金鑰
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [];

  // 處理圖片輸入
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

  let finalPrompt = inputText;

  // 如果只有圖片沒有文字，加入引導提示
  if (inputText.trim() === "" && imageBase64) {
    finalPrompt = "Analyze this image and provide highly detailed technical tags for Stable Diffusion. Focus on character features, lighting, clothing, and composition.";
  }

  // 加入參考資料庫
  if (tagDbContent) {
    finalPrompt += `\n\n[Reference Tag Database]\nUtilize relevant keywords from this technical list if they match the visual requirements:\n\n"""\n${tagDbContent}\n"""`;
  }

  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{
        role: "user",
        parts: parts
      }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        topP: 0.95,
      },
      // 安全性設定通常作為最上層參數或在 config 內。
      // 對於某些 Preview 模型，這裡設置 BLOCK_NONE 以獲得最大的創作自由度。
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
      ]
    });

    // 檢查候選結果
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (finishReason === 'SAFETY') {
      return "【安全性警告】Google 安全過濾器在生成過程中攔截了結果。這通常是因為描述過於直白。建議：請改用更具藝術性、醫療性或解剖學的詞彙，或減少權重。";
    }

    if (!response.text || response.text.trim() === "") {
      if (finishReason === 'OTHER') {
        throw new Error("模型因為不明原因拒絕生成。請嘗試簡化您的描述。");
      }
      throw new Error("模型未回傳任何內容，可能已被安全性過濾器完全攔截。");
    }

    return response.text;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // 處理常見錯誤
    const errMsg = error.message || "";
    
    if (errMsg.includes("Requested entity was not found")) {
      throw new Error("API 金鑰專案無效，請點擊上方「設定金鑰」重新授權（請確保選擇付費專案）。");
    }

    if (errMsg.includes("SAFETY")) {
       return "【安全性警告】請求已被預先過濾攔截。您的描述可能包含了被嚴格禁止的關鍵字。請嘗試使用中性的技術術語重新描述。";
    }
    
    if (errMsg.includes("429")) {
       throw new Error("API 呼叫頻率過高 (429)。請切換至付費專案金鑰，或稍候再試。");
    }

    throw error;
  }
};
