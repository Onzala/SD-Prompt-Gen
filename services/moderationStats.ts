// ==========================================
// 各模型審查統計（只存在使用者自己的瀏覽器 localStorage）
// ==========================================
// outcome:
//   ok      — 正常產出
//   blocked — 被 API 安全過濾攔截（finishReason / promptFeedback.blockReason）
//   refused — API 有回應，但內容是模型自己拒答
//   empty   — 沒有被標記攔截，卻回傳空白內容（多半也是隱性審查）

export type ModerationOutcome = 'ok' | 'blocked' | 'refused' | 'empty';

export interface ModelModerationStats {
  model: string;
  image: Record<ModerationOutcome, number>; // 有附圖片的請求
  text: Record<ModerationOutcome, number>;  // 純文字請求
  lastBlockReason?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'sd_prompt_moderation_stats';

const emptyCounts = (): Record<ModerationOutcome, number> => ({ ok: 0, blocked: 0, refused: 0, empty: 0 });

export const loadModerationStats = (): Record<string, ModelModerationStats> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

export const clearModerationStats = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

export const recordModerationOutcome = (
  model: string,
  hasImage: boolean,
  outcome: ModerationOutcome,
  blockReason?: string
) => {
  const all = loadModerationStats();
  const entry = all[model] || { model, image: emptyCounts(), text: emptyCounts(), updatedAt: 0 };
  entry[hasImage ? 'image' : 'text'][outcome] += 1;
  if (blockReason) entry.lastBlockReason = blockReason;
  entry.updatedAt = Date.now();
  all[model] = entry;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* 無痕模式等情況可能無法寫入 */
  }
};

// API 層級的攔截原因（RECITATION 是著作權重複，不算審查）
const BLOCK_FINISH_REASONS = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT'];

export const getBlockReason = (response: any): string | undefined => {
  const promptBlock = response?.promptFeedback?.blockReason;
  if (promptBlock) return `prompt:${promptBlock}`;
  const finish = response?.candidates?.[0]?.finishReason;
  if (finish && BLOCK_FINISH_REASONS.includes(finish)) return finish;
  return undefined;
};

// 模型自己拒答的常見開頭（中英文）
const REFUSAL_PATTERNS = [
  /^\s*(I'm sorry|I am sorry|Sorry,|I can(?:'|no)t|I cannot|I won't|I'm unable|I am unable|As an AI)/i,
  /^\s*(抱歉|很抱歉|對不起|我無法|我不能|無法協助|我沒辦法)/,
];

export const looksLikeRefusal = (text: string): boolean =>
  text.length < 600 && REFUSAL_PATTERNS.some((re) => re.test(text));
