# 連續分鏡視覺敘事 Prompt 導演系統 (StoryFrame AI)
> 專案產品與技術規格書 (Product & Technical Specification Document)  
> 版本：v1.0.0  
> 日期：2026-10-05  

---

## 1. 產品概述 (Product Overview)

### 1.1 產品定位
**StoryFrame AI（繪卷分鏡大師）** 是一款專為 AI 繪師、漫畫分鏡師、視覺小說作者與動態 MV 創作者量身打造的**「智慧劇本與連續分鏡提示詞工作台」**。  
本系統基於現有的 **Stable Diffusion (WebUI/ComfyUI)** 與 **NovelAI (Danbooru)** 雙核心提示詞轉換能力，向上架構「世界觀與角色聖經」、「劇情節奏編排」、「電影級鏡頭語法」以及「跨影格視覺一致性約束」。

### 1.2 核心目標
* **視覺一致性 (Visual Consistency)**：解決連續生圖中角色外貌、服裝細節、髮色瞳孔、美術風格在不同影格間漂移的問題。
* **分鏡敘事化 (Cinematic Storyboarding)**：將一般純文字劇本自動拆解為具備起承轉合、鏡頭景別、攝影視角、動態節奏的連續單格。
* **雙引擎無縫切換**：同一套分鏡故事板，可一鍵無損編譯為 **NovelAI V3/V4 Danbooru 標籤公式** 或 **Stable Diffusion 6 階分段權重語法**。

---

## 2. 核心痛點與解法對照表 (Pain Points & Solutions)

| 痛點維度 | 傳統 AI 生圖痛點 | StoryFrame AI 解法 |
| :--- | :--- | :--- |
| **角色外貌漂移** | 第一張金髮藍眼，第二張變成黑髮，飾品衣服每張都不同 | **「角色聖經 (Character Bible)」**：鎖定不可變核心特徵 Anchor Tags，每格自動強制繼承。 |
| **畫面僵硬呆板** | 提示詞多為 `1girl, standing, looking at viewer` 大頭貼 | **「導演鏡頭語言庫 (Cinematography Grammar)」**：自動配置遠景、中景、俯仰拍、荷蘭角與動態線條。 |
| **缺乏劇情連貫** | 各影格彼此獨立，毫無時間推移與情緒遞進感 | **「劇情節拍器 (Story Beat Sheet)」**：支援起承轉合、三幕劇結構，追蹤時間軸與光影氣氛變化。 |
| **語法相容門檻** | NAI 需用花括號加權，SD 需用小數點括號加權，格式轉換繁瑣 | **「跨鏡序列編譯器 (Sequence Compiler)」**：單鍵將全劇連續分鏡自動轉換為對應平台專用格式。 |

---

## 3. 系統模組架構圖 (System Architecture)

```
[使用者輸入：劇本故事文字 / 大綱靈感 / 世界觀設定]
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 模組 1：世界觀與角色聖經 (Story Bible & Entity Registry)      │
│ ├─ 角色錨點卡 (外貌標籤、瞳色、髮型、特定標記、服裝槽位)    │
│ ├─ 場景錨點卡 (空間環境、時間軸、季節、基底氛圍)           │
│ └─ 全局風格錨點 (Danbooru 官方畫師標籤 / SD 專用風格詞)     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 模組 2：劇情節奏解析器 (Narrative Beat Analyzer)            │
│ ├─ 三幕劇 / 起承轉合自動切分 (Shot 1 ~ Shot N)              │
│ ├─ 戲劇張力標註 (Dramatic Tension & Pacing)                │
│ └─ 時間推移與光線變化追蹤 (Time-of-day & Lighting Curve)    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 模組 3：分鏡導演與鏡頭語言 (Storyboard Director Engine)      │
│ ├─ 景別矩陣 (Extreme Close-up / Medium / Cowboy / Wide)     │
│ ├─ 角度矩陣 (Low Angle / High Angle / Dutch Angle / Profile)│
│ └─ 動態與視線引導 (Gaze, Action, Movement Direction)        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 模組 4：雙核心提示詞編譯器 (Sequence Prompt Compiler)        │
│ ├─ NovelAI 核心：Danbooru 格式 + 花括號加權 + 年份品質詞    │
│ ├─ SD 核心：6 階結構 + 圓括號權重 + 負面詞 + ControlNet 建議 │
│ └─ 一致性校驗引擎 (Consistency Validator)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
[可視化故事板工作台：卡片流、單鏡微調、批次複製、JSON/TXT 匯出]
```

---

## 4. 詳細功能規格 (Detailed Feature Specifications)

### 4.1 模組 A：世界觀與角色聖經 (Entity Registry)
1. **角色卡 (Character Anchor Card)**：
   * **識別碼與名稱**（如 `char_01`：艾莉絲 / Alice）。
   * **不可變核心特徵 (Invariable Tags)**：
     * 例：`1girl, solo, silver hair, twin braids, blunt bangs, sharp blue eyes, beauty mark under left eye`。
   * **服裝槽位 (Outfit Slots)**：
     * Slot A（預設旅人裝）：`white hooded cloak, brown leather vest, pleated skirt, travel bag`。
     * Slot B（戰鬥狀態）：`light armor, silver breastplate, gauntlets, glowing rapier`。
2. **場景卡 (Environment Anchor Card)**：
   * 空間要素：`ruined gothic cathedral, cracked stained glass, stone pillars, overgrown ivy`。
   * 光影基底：`dust motes, volumetric sunbeams, dramatic shadows`。
3. **全局畫風錨點 (Master Style Anchor)**：
   * 支援 Danbooru 官方認證畫師庫（如 `krenz`, `wlop`, `shirabi`, `fuzichoco`）。
   * 在全劇所有分鏡自動帶入風格定義。

---

### 4.2 模組 B：劇情節奏編排 (Narrative Beat Sheet)
* **智慧劇本切分 (Auto-Beats)**：
  輸入一段 100~500 字的故事片段，系統依據戲劇結構自動切分為 4~8 格分鏡：
  * **Shot 1 (建立 Establishing)**：遠景交代環境與危機接近。
  * **Shot 2 (發展 Action/Motion)**：角色奔跑，緊張神情與動態姿勢。
  * **Shot 3 (轉折 Twist/Crisis)**：特寫停步在懸崖邊，視角切換至萬丈深淵。
  * **Shot 4 (高潮 Climax/Resolve)**：仰角半身特寫，拔劍眼神堅定，光影逆光。
* **光影時間軸追蹤**：
  記錄時間流動（如：清晨 ➔ 正午 ➔ 日落黃昏 ➔ 幽暗深夜），各鏡頭自動遞變光影提示詞。

---

### 4.3 模組 C：分鏡鏡頭語言庫 (Cinematography Grammar)

| 鏡頭維度 | 英文標籤 (Prompt Keyword) | 戲劇視覺效果 |
| :--- | :--- | :--- |
| **極特寫** | `extreme close-up, focus on eyes / trembling hands` | 強烈心理壓迫、情緒細節放大 |
| **特寫** | `close-up, face focus, expressive eyes, portrait` | 捕捉對話、微表情變化 |
| **中景** | `medium shot, upper body` | 角色互動、肢體動作標準鏡頭 |
| **牛仔景** | `cowboy shot, from knees up, hand on holster` | 拔刀、準備戰鬥、持武器威嚇 |
| **全景/遠景** | `full body, wide shot, scenery, environmental storytelling` | 人物與宏大背景的空間關係 |
| **仰角視角** | `from below, low angle, towering, dynamic perspective` | 展現角色的威嚴、力量或巨大感 |
| **俯角視角** | `from above, high angle, bird's-eye view, looking down` | 表現角色的無助、弱小或宏觀佈局 |
| **荷蘭角** | `dutch angle, tilted frame, dynamic angle` | 營造不安、混亂、失控與劇烈張力 |

---

### 4.4 模組 D：跨影格提示詞編譯器 (Sequence Prompt Compiler)
每一格分鏡生成的完整 Prompt，由下列公式組裝：

$$\text{Final Prompt} = \text{Style Quality} + \text{Character Anchors} + \text{Shot Grammar} + \text{Action \& Expression} + \text{Scene \& Lighting}$$

#### NovelAI 模式編譯規則
* 品質前綴：`year 2024, masterpiece, best quality, absurdres, very aesthetic,`
* 畫師風格：`{artist:krenz},`
* 角色與動作：核心特徵保持 `1.0` 權重，該格動作表情加 `{}` 乘算加權。
* 輸出專用 Negative Prompt：`lowres, {bad}, error, fewer, extra, missing, worst quality, ...`

#### Stable Diffusion 模式編譯規則
* 採用 6 階分段輸出：
  * Line 1: Quality & Resolution
  * Line 2: Artist Style
  * Line 3: Characters & Outfits
  * Line 4: Shot Scale & Camera Angle
  * Line 5: Actions & Expressions
  * Line 6: Environment & Volumetric Lighting
* 輸出專用 SD Negative Prompt。

---

## 5. 資料結構規格 (TypeScript Schema)

```typescript
// 1. 角色錨點定義
export interface CharacterAnchor {
  id: string;
  name: string;
  isMain: boolean;
  baseTags: string[];        // 例: ["1girl", "solo", "silver hair", "twin braids", "blue eyes"]
  currentOutfitTags: string[]; // 例: ["white hooded cloak", "leather boots"]
}

// 2. 鏡頭語言設定
export interface ShotGrammar {
  scale: 'extreme_closeup' | 'closeup' | 'medium' | 'cowboy' | 'full_body' | 'wide' | 'scenery';
  angle: 'eye_level' | 'low_angle' | 'high_angle' | 'dutch_angle' | 'profile' | 'from_behind';
  gaze: 'looking_at_viewer' | 'looking_away' | 'looking_down' | 'looking_back';
  compositionTags: string[]; // 例: ["from below", "cowboy shot", "dynamic angle"]
}

// 3. 單一分鏡單元 (Single Story Shot)
export interface StoryShot {
  shotIndex: number;
  title: string;
  narrativeDescription: string; // 繁體中文情境描述
  timeTransition: string;       // 時間光影流轉標註 (如: "dusk turns to night")
  characterIds: string[];       // 登場角色 ID
  grammar: ShotGrammar;
  prompts: {
    sdPositive: string;
    sdNegative: string;
    naiPositive: string;
    naiNegative: string;
  };
}

// 4. 分鏡專案 (Project)
export interface StoryProject {
  id: string;
  title: string;
  synopsis: string;             // 故事原案大綱
  targetPlatform: 'SD' | 'NAI'; // 目標平台
  masterArtistTag: string;      // Danbooru 畫師錨點 (如 "krenz")
  characters: CharacterAnchor[];
  shots: StoryShot[];
  updatedAt: number;
}
```

---

## 6. UI / UX 互動設計 (Interface Layout)

* **三欄式工作流佈局**：
  1. **左側 (Story & Cast Panel)**：
     * 故事大綱輸入盒（支援一鍵 AI 分析劇本節奏）。
     * 角色卡登錄列表（新增/編輯髮型、服裝、外貌特徵）。
     * 全局畫風搜尋器（支援 Danbooru 官方畫師檢索）。
  2. **中央 (Storyboard Reel & Visual Canvas)**：
     * 橫向滾動分鏡卡片軌道（Timeline / Storyboard Reel）。
     * 支援拖曳更換鏡頭順序、插入新鏡頭、複製鏡頭。
     * 每格卡片提供鏡頭視角 Badge（[俯拍 High Angle]、[牛仔景 Cowboy]）。
  3. **右側 (Prompt Inspector & Code Export)**：
     * 選定鏡頭的詳細提示詞分層檢視器。
     * 語法即時切換（SD 圓括號 ⇄ NAI 花括號）。
     * 批次匯出按鈕：
       * 匯出 ComfyUI 批次腳本 JSON。
       * 匯出 NovelAI 批次執行清單 TXT。
       * 匯出 Markdown 導演企劃書。

---

## 7. 未來擴展規劃 (Roadmap)
1. **ComfyUI API Direct Trigger**：透過 WebSocket 直接將產出的連續分鏡傳送給本地 ComfyUI 節點連續生圖。
2. **ControlNet 姿勢與線稿整合**：根據分鏡視角自動推薦對應的 OpenPose 姿態或 Depth 景深圖。
3. **LoRA 權重聯動**：支援在角色卡中綁定自訂 LoRA 標籤與觸發詞（Trigger Words）。
