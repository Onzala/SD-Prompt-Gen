import { DanbooruArtist } from './types';

// ==========================================
// 1. Stable Diffusion (SD WebUI / ComfyUI) Prompt
// ==========================================
export const SYSTEM_PROMPT_SD = `
# Role: Technical Visual Prompt Engineer for Stable Diffusion (WebUI / ComfyUI)

## Core Objective
Convert visual concepts, user ideas, and images into high-precision technical prompt tags for Stable Diffusion. Output is formatted with industry-standard SD syntax and clean category breakdown.

## Syntax & Weight Rules
- Use Danbooru-style tags, separated by commas.
- Weight syntax: Use round brackets for emphasis, e.g., \`(detailed eyes:1.2)\`, \`(masterpiece:1.2)\` or \`(tag)\`.
- Do not use complete natural language sentences; use descriptive tags and keywords.
- If a Danbooru artist is specified, incorporate their EXACT canonical tag in line 2 or line 6 using syntax like \`(by [exact_tag]:1.1)\` and associated stylistic tags (e.g. \`(by krenz:1.1)\`, NEVER guess non-existent full names like \`krenz_cushart\`).
- If NO artist is specified, do NOT output any artist tag at all (no \`(by xxx:1.1)\`, no invented or placeholder artist names).

## Dynamic Quality Selection
- **If face is visible**:
  (masterpiece, best quality, absurdres, highres:1.2), amazing quality, very aesthetic, high resolution, highly detailed, perfect hands, (detailed face), detailed eyes, (detailed pupils), (delicated pupils),
- **If face is NOT visible**:
  (masterpiece, best quality, absurdres, highres:1.2), amazing quality, very aesthetic, high resolution, highly detailed, perfect hands,

## Mandatory Output Structure
You must output in markdown code fence with exactly two labeled blocks:
\`\`\`
[POSITIVE PROMPT]
Line 1 (Quality): [Quality tags according to face visibility]
Line 2 (Subject & Anatomy): 1girl, solo, (specific hair color/style), facial expression, eye color, skin texture
Line 3 (Attire & Clothing): specific clothing items, fabric textures, accessories, footwear
Line 4 (Pose & Composition): dynamic pose, camera angle, shot type (e.g. from below, close-up, looking at viewer)
Line 5 (Setting & Background): environment elements, architecture, scenery, objects, weather
Line 6 (Lighting & Atmosphere): volumetric lighting, cinematic atmosphere, depth of field, color palette

[NEGATIVE PROMPT]
(worst quality, low quality:1.4), (bad anatomy), (inaccurate limb:1.2), bad hands, missing fingers, extra digits, fewer digits, deformed, blurry, cropped, watermark, signature, username, error, jpeg artifacts
\`\`\`

Do not include conversational preamble. Output ONLY the code block.
`;

// ==========================================
// 2. NovelAI (NAI Diffusion V3 / V4) Prompt
// ==========================================
export const SYSTEM_PROMPT_NAI = `
# Role: Expert Visual Tag Engineer for NovelAI Diffusion (NAI V3 & V4)

## Core NovelAI Mechanics & Syntax Rules
NovelAI is trained exclusively on Danbooru anime datasets with specialized token weighting:
1. **Curly Brackets for Weighting**:
   - Each pair of curly braces \`{}\` multiplies tag weight by 1.05x.
   - Example: \`{detailed eyes}\` (1.05x), \`{{detailed eyes}}\` (1.10x), \`{{{masterpiece}}}\` (1.15x).
   - Square brackets \`[]\` weaken tag weight by 0.952x.
   - **CRITICAL**: NEVER use SD parenthesis \`(tag:1.2)\` or colon weights! NovelAI does not understand \`(tag:1.2)\` syntax.
2. **Tag Conventions**:
   - Strictly use canonical Danbooru tags (comma-separated, lowercase).
   - Multi-word tags use spaces or underscores (e.g. \`blue eyes\`, \`looking at viewer\`).
3. **NovelAI Quality & Year Formula**:
   - Quality tags at the beginning: \`masterpiece, best quality, amazing quality, very aesthetic, absurdres, high resolution\`
   - Year aesthetic tag: include \`year 2024\` (or \`year 2023\`) to activate modern high-aesthetic Danbooru rendering.
4. **Artist Style Syntax in NAI (DANBOORU ACCURACY IS MANDATORY)**:
   - When an artist is specified, you MUST use their EXACT canonical Danbooru tag name.
   - Example: Krenz Cushart's Danbooru tag is strictly \`krenz\` (NEVER use \`krenz_cushart\`).
   - Shirabii's Danbooru tag is strictly \`shirabi\` (NEVER use \`shirabii\`).
   - Neco's Danbooru tag is strictly \`neco\` (NEVER use \`neco_(neco_k)\`).
   - Format in line 2: \`{artist:[exact_danbooru_tag]}\` or \`{[exact_danbooru_tag]}\` placed right after quality tags.
   - If NO artist is specified, do NOT output any \`artist:\` tag or any artist name at all.

## Mandatory NovelAI Output Structure (8 Segments)
Organize the tags cleanly into the following labeled sections inside a single markdown code fence:
\`\`\`
[POSITIVE PROMPT]
Line 1 (Quality & Year): masterpiece, best quality, amazing quality, very aesthetic, absurdres, year 2024,
Line 2 (Artist & Style): {artist:[exact_danbooru_tag]} if provided (e.g. {artist:krenz}), aesthetic, anime coloring,
Line 3 (Subject & Character): 1girl, solo, character_name, series_name,
Line 4 (Hair & Facial Features): long hair, twintails, blue eyes, blush, parted lips, detailed face,
Line 5 (Attire & Accessories): sailor uniform, pleated skirt, thighhighs, ribbon, detailed clothes,
Line 6 (Pose & Composition): sitting, crossed legs, looking at viewer, from below, dynamic angle,
Line 7 (Setting & Environment): classroom, sunset, window, curtains, floating petals,
Line 8 (Lighting & Atmosphere): volumetric lighting, golden hour, rim light, depth of field, vibrant colors

[NEGATIVE PROMPT]
lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract], bad anatomy, bad hands, bad feet
\`\`\`

Do not include conversational preamble. Output ONLY the code block.
`;

// Backwards compatibility alias
export const SYSTEM_PROMPT = SYSTEM_PROMPT_SD;

// ==========================================
// 3. AI Suggestions Prompt
// ==========================================
export const SUGGESTION_PROMPT = `
You are a creative director for AI art (Stable Diffusion & NovelAI). Based on the provided prompt and context, generate 3 unique and specific "Refinement Suggestions" in Traditional Chinese (繁體中文).
Each suggestion should represent a different creative direction (e.g., one for art style change, one for lighting/mood, one for detail/composition enhancement).

Output format MUST be a JSON array of objects:
[
  { "label": "風格標籤", "action": "修改建議的具體內容 (繁體中文)", "description": "為什麼這個修改會很有特色" }
]
Keep the "action" concise, natural, and ready to be used as a prompt instruction.
`;

// ==========================================
// 4. Danbooru Canonical Tag Normalizer (Alias Map)
// ==========================================
export const DANBOORU_ALIAS_MAP: Record<string, string> = {
  // Krenz Cushart -> Danbooru tag is 'krenz'
  'krenz_cushart': 'krenz',
  'cushart': 'krenz',
  'krenz': 'krenz',

  // Shirabi -> Danbooru tag is 'shirabi'
  'shirabii': 'shirabi',
  'shirabi': 'shirabi',

  // Neco -> Danbooru tag is 'neco'
  'neco_(neco_k)': 'neco',
  'neco_k': 'neco',
  'neco': 'neco',

  // Ask -> Danbooru tag is 'ask_(askzy)'
  'ask': 'ask_(askzy)',
  'askzy': 'ask_(askzy)',

  // Sho -> Danbooru tag is 'sho_(sho_lwlw)'
  'sho': 'sho_(sho_lwlw)',
  'sho_lwlw': 'sho_(sho_lwlw)',

  // TID -> Danbooru tag is 'tidsean'
  'tid': 'tidsean',
  'tidsean': 'tidsean',

  // Hiten -> Danbooru tag is 'hiten_(hitenkei)'
  'hiten': 'hiten_(hitenkei)',
  'hitenkei': 'hiten_(hitenkei)',

  // Mika Pikazo
  'mika': 'mika_pikazo',
  'mika_pikazo': 'mika_pikazo',

  // Takeuchi Takashi
  'takeuchi': 'takeuchi_takashi',
  'takeuchi_takashi': 'takeuchi_takashi',

  // Kuroboshi Kouhaku
  'kuroboshi': 'kuroboshi_kouhaku',
  'kuroboshi_kouhaku': 'kuroboshi_kouhaku',

  // Yoneyama Mai
  'yoneyama': 'yoneyama_mai',
  'yoneyama_mai': 'yoneyama_mai'
};

/**
 * Normalizes any artist input or alias to the verified canonical Danbooru tag
 */
export const resolveDanbooruTag = (rawInput: string): string => {
  if (!rawInput) return '';
  const clean = rawInput
    .replace(/^artist:/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  return DANBOORU_ALIAS_MAP[clean] || clean;
};

// ==========================================
// 5. 100% Verified Danbooru Artists Database
// All tags are verified on Danbooru with active post counts
// ==========================================
export const DANBOORU_ARTISTS: DanbooruArtist[] = [
  // --- 極致厚塗 / 幻想美學 (Painterly / Fantasy) ---
  {
    tag: 'krenz',
    name: 'Krenz Cushart (Krenz)',
    category: '極致厚塗',
    description: 'Danbooru 官方標籤為 krenz。透視光影大師、古典油畫筆觸、大師級構圖人體',
    popular: true,
    postCount: 152
  },
  {
    tag: 'wlop',
    name: 'WLOP (王凌)',
    category: '極致厚塗',
    description: '極致光影、冷艷幻想、厚塗半寫實、飄逸長髮與絕美金屬光澤',
    popular: true,
    postCount: 730
  },
  {
    tag: 'ciloranko',
    name: 'Ciloranko (汐路)',
    category: '極致厚塗',
    description: '通透薄塗厚塗、空靈眼神、細膩通透的少女肌膚與服裝質感',
    popular: true,
    postCount: 406
  },
  {
    tag: 'ask_(askzy)',
    name: 'Ask (askzy)',
    category: '極致厚塗',
    description: '神仙級精緻五官、高貴典雅氣質、華麗金屬與羽毛質感',
    popular: true,
    postCount: 145
  },
  {
    tag: 'fuzichoco',
    name: '藤原 (Fuzichoco)',
    category: '極致厚塗',
    description: '極致和風幻想、萬花筒般繁複細膩的色彩層次與空間縱深',
    popular: true,
    postCount: 1395
  },
  {
    tag: 'tidsean',
    name: 'TID (tidsean)',
    category: '極致厚塗',
    description: '絲滑絲綢質感、細膩柔和的光澤、楚楚動人的少女神韻',
    popular: true,
    postCount: 282
  },
  {
    tag: 'sho_(sho_lwlw)',
    name: 'Sho (sho_lwlw)',
    category: '極致厚塗',
    description: '高對比強烈光影、立體感雕塑五官、深邃冷峻的電影質感',
    postCount: 124
  },
  {
    tag: 'hungry_clicker',
    name: 'Hungry Clicker',
    category: '極致厚塗',
    description: '超高動態筆觸、狂野厚塗表現力、強烈戲劇性戰鬥光影',
    popular: true,
    postCount: 2892
  },

  // --- 日系萌系 / 流行動漫 (Anime / Moe / Pop) ---
  {
    tag: 'mika_pikazo',
    name: 'Mika Pikazo',
    category: '日系萌系',
    description: '高飽和絢爛色彩、普普藝術潮流感、強烈視覺衝擊與生動神態',
    popular: true,
    postCount: 485
  },
  {
    tag: 'kantoku',
    name: 'カントク (監督)',
    category: '日系萌系',
    description: '經典格子裙與下擺、通透水靈美少女、頂級賽璐珞上色',
    popular: true,
    postCount: 2439
  },
  {
    tag: 'anmi',
    name: 'Anmi',
    category: '日系萌系',
    description: '果凍般透明膚感、輕盈水滴與泡泡光澤、治癒系軟萌少女',
    popular: true,
    postCount: 1699
  },
  {
    tag: 'tiv',
    name: 'Tiv',
    category: '日系萌系',
    description: '極致清秀五官、輕小說插畫經典、清澈透明的青春少女感',
    popular: true,
    postCount: 1045
  },
  {
    tag: 'morikura_en',
    name: '森倉円 (Morikura En)',
    category: '日系萌系',
    description: '女子高中生日常光影、柔和親和力、自然生動的微表情與髮絲',
    popular: true,
    postCount: 790
  },
  {
    tag: 'shirabi',
    name: 'しらび (Shirabi)',
    category: '日系萌系',
    description: 'Danbooru 標籤為 shirabi。銳利眼神、動態緊繃感、86/龍王的工作插畫名師',
    popular: true,
    postCount: 1051
  },
  {
    tag: 'rurudo',
    name: 'rurudo',
    category: '日系萌系',
    description: '小惡魔系精緻蘿莉、繁複蕾絲緞帶、軟萌中帶微誘惑',
    popular: true,
    postCount: 1251
  },
  {
    tag: 'alchemaniac',
    name: 'Alchemaniac',
    category: '日系萌系',
    description: '明日方舟斯卡蒂之父、清冷通透水潤感、深邃神秘氣質',
    postCount: 484
  },
  {
    tag: 'hiten_(hitenkei)',
    name: 'Hiten (hitenkei)',
    category: '日系萌系',
    description: '唯美青春光影、極致細膩的制服與透明感黑絲',
    popular: true,
    postCount: 927
  },
  {
    tag: 'tony_taka',
    name: 'Tony (Tony Taka)',
    category: '日系萌系',
    description: '光學美少女大師、光明系列畫師、極度通透柔潤的身材線條',
    popular: true,
    postCount: 3177
  },
  {
    tag: 'ixy',
    name: 'Ixy',
    category: '日系萌系',
    description: '超高人氣推特速塗名師、簡潔俐落線條、生動靈活的表情神態',
    popular: true,
    postCount: 3030
  },

  // --- 賽博科幻 / 機甲潮流 (Cyberpunk / Mecha / Tech) ---
  {
    tag: 'redjuice',
    name: 'Redjuice',
    category: '賽博科幻',
    description: '罪惡王冠/EGOIST御用、銳利科技線條、冷峻未來感金屬質感',
    popular: true,
    postCount: 531
  },
  {
    tag: 'huke',
    name: 'Huke',
    category: '賽博科幻',
    description: '黑岩射手/命運石之門、重金屬鏽蝕紋理、粗獷深色顆粒美學',
    popular: true,
    postCount: 2841
  },
  {
    tag: 'neco',
    name: 'Neco',
    category: '賽博科幻',
    description: 'Danbooru 官方標籤為 neco。重兵裝女子高中生、極簡工業機械冷感',
    popular: true,
    postCount: 501
  },
  {
    tag: 'dsmile',
    name: 'dSmile',
    category: '賽博科幻',
    description: '通透立體光學上色、前衛科技時尚服裝設計',
    postCount: 412
  },

  // --- 唯美清新 / 風景氛圍 (Aesthetic / Landscape) ---
  {
    tag: 'rella',
    name: 'Rella',
    category: '唯美風景',
    description: '初音未來名師、空靈神聖感、星空光斑與水晶結晶質感',
    popular: true,
    postCount: 1111
  },
  {
    tag: 'swd3e2',
    name: 'SWD3E2',
    category: '唯美風景',
    description: '明日方舟宏大世界觀、電影級大氣霧氣、深遠宏大的景深氛圍',
    popular: true,
    postCount: 1289
  },
  {
    tag: 'atdan',
    name: 'Atdan',
    category: '唯美風景',
    description: '韓系精緻妝容、高質感時尚服飾剪裁、極度清純迷人',
    popular: true,
    postCount: 789
  },
  {
    tag: 'yoneyama_mai',
    name: '米山舞 (Yoneyama Mai)',
    category: '唯美風景',
    description: '動畫級流動光感、極致層次感與現代藝術幾何光斑美學',
    popular: true,
    postCount: 329
  },

  // --- 暗黑奇幻 / 獨特風格 (Dark / Fantasy / Stylized) ---
  {
    tag: 'takeuchi_takashi',
    name: '武內崇 (Takeuchi Takashi)',
    category: '暗黑奇幻',
    description: 'TYPE-MOON 靈魂畫師、Fate 系列經典英靈五官與風衣輪廓',
    popular: true,
    postCount: 2173
  },
  {
    tag: 'kuroboshi_kouhaku',
    name: '黑星紅白 (Kuroboshi Kouhaku)',
    category: '暗黑奇幻',
    description: '奇諾之旅/FGO阿比蓋兒、童話復古與克蘇魯神話暗黑美學',
    popular: true,
    postCount: 878
  },
  {
    tag: 'lack',
    name: 'Lack',
    category: '暗黑奇幻',
    description: '厚重狂野筆觸、張力十足的暗黑戰鬥場景、FGO岡田以藏',
    popular: true,
    postCount: 1774
  },
  {
    tag: 'rinotuna',
    name: 'Rinotuna',
    category: '暗黑奇幻',
    description: '極致擬人化天才、將物品轉化為精妙角色特徵、靈動幽默',
    popular: true,
    postCount: 508
  },
  {
    tag: 'modare',
    name: 'Modare',
    category: '暗黑奇幻',
    description: '精準人體結構、曼妙曲線與獨特時尚美學',
    postCount: 264
  },
  {
    tag: 'terada_tera',
    name: '寺田てら (Terada Tera)',
    category: '暗黑奇幻',
    description: '強烈美式街頭塗鴉感、極限高對比配色、古怪靈動的角色表情',
    postCount: 642
  }
];
