import { BookOpen } from 'lucide-react';

// NovelAI prompt 語法說明（可收合）
// 來源：docs.novelai.net/en/image/tags、strengthening-weakening、qualitytags、multiplecharacters、textrendering
//       （2026-11-28 查證），以及 novelai.net 官方網頁客戶端的預設值。官方沒寫的地方會標「文件未說明」。

const EXAMPLE: { tag: string; kind: string; note: string }[] = [
  { tag: '1boy, 1girl', kind: '人數', note: '畫面裡有幾個誰。官方建議放最前面，而且只放在基本 prompt；角色欄只寫 boy／girl，不寫數字。' },
  { tag: 'couple', kind: '一般標籤', note: '情侶關係。屬於整個畫面的關係標籤，放基本 prompt。' },
  { tag: 'year 2025', kind: '年份（特殊）', note: '讓畫風靠近那一年的流行畫法。格式是「year 數字」，官方說任何年份都可以用，但效果不一定。' },
  { tag: 'school', kind: '場景', note: '地點標籤。' },
  { tag: 'looking at viewer', kind: '視線', note: '看向鏡頭。所有人都看鏡頭就放基本 prompt，只有某人看就放那個角色欄。' },
  { tag: 'straight-on / straight on', kind: '鏡頭角度', note: '正面平視。這串 prompt 有連字號和沒連字號各出現一次，是重複寫法，效果頂多是稍微加強，不是參數。' },
  { tag: 'matching outfits', kind: '一般標籤', note: '情侶裝、穿同款衣服。' },
  { tag: 'shirt', kind: '服裝', note: '襯衫。寫在基本 prompt 會套到全部人；只想給某人穿就寫在那個角色欄。' },
  { tag: 'princess carry', kind: '動作', note: '公主抱。多人互動動作可以在角色欄寫成 source#princess carry（抱的人）和 target#princess carry（被抱的人）。' },
  { tag: 'cowboy shot', kind: '取景', note: '取景到大腿左右的半身鏡頭。' },
  { tag: 'location', kind: '特殊標籤', note: '官方說明：效果像 indoors 加 outdoors，要求「畫出某個場景」但不指定是哪裡，避免角色站在白色空背景裡。' },
  { tag: '-3::realistic::', kind: '數值權重', note: '「數字::標籤::」。數字是權重，負數表示反向；-3 是用力把寫實感拿掉。負數權重只有 V4.5 以上能用。' },
  { tag: 'rating:general', kind: '分級', note: '全年齡分級標籤。官方只在 V4／V4.5 Curated 的自動品質標籤裡用到它，沒有說明效果；一般理解是把畫面往全年齡內容引導。' },
  { tag: 'thick lines', kind: '畫風', note: '粗線條。' },
];

export default function NaiSyntaxGuide() {
  return (
    <details className="group rounded-xl border border-fg/[0.06] bg-fg/[0.015]">
      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300">
        <BookOpen size={13} className="text-sky-300" /> NovelAI prompt 語法說明
        <span className="text-[11px] font-normal text-slate-500 group-open:hidden">（點開）</span>
      </summary>
      <div className="space-y-3 border-t border-fg/[0.06] px-3 py-3 text-[11px] leading-relaxed text-slate-400">
        <details open>
          <summary className="cursor-pointer text-xs font-medium text-slate-300">範例拆解：官方精選圖的 prompt</summary>
          <p className="mt-1.5 rounded-lg bg-slate-950/50 p-2 font-mono text-[11px] text-slate-300">
            1boy, 1girl, couple, year 2025, school, looking at viewer, straight-on, matching outfits, shirt, princess carry, cowboy shot, location, straight on, -3::realistic::, rating:general, thick lines
          </p>
          <dl className="mt-2 divide-y divide-fg/[0.05]">
            {EXAMPLE.map(row => (
              <div key={row.tag} className="grid gap-1 py-1.5 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt>
                  <code className="text-slate-200">{row.tag}</code>
                  <span className="ml-1.5 rounded bg-fg/[0.05] px-1 text-[10px] text-slate-500">{row.kind}</span>
                </dt>
                <dd>{row.note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1.5 text-slate-500">
            真正會改變運作方式的「參數型」寫法只有：year、location、數值權重（::）、rating:。其餘都是一般 Danbooru 標籤。
          </p>
        </details>

        <details>
          <summary className="cursor-pointer text-xs font-medium text-slate-300">權重：{'{ }'}、[ ]、數字::</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li><code>{'{tag}'}</code> 每一層乘 1.05，<code>[tag]</code> 每一層除以 1.05。例如 <code>{'{{tag}}'}</code> ≈ 1.1。</li>
            <li><code>1.5::rain, night::</code>：數字放在 <code>::</code> 前面，後面全部套用這個權重，直到下一個 <code>::</code> 收尾。V4 以上才有。</li>
            <li>0 到 1 是減弱，大於 1 是加強，負數是反向（只有 V4.5 以上）。例如 <code>-1::monochrome::</code>、<code>-3::hat::</code>。</li>
            <li>負面提示詞（Undesired Content）也能用同樣的權重寫法。</li>
          </ul>
        </details>

        <details>
          <summary className="cursor-pointer text-xs font-medium text-slate-300">自動加的品質標籤與負面預設</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>品質標籤（Quality Tags）加在 prompt 最後。V5 Standard：<code>very aesthetic, masterpiece, no text</code>；V5 Light：<code>very aesthetic, amazing quality, no text</code>。</li>
            <li>V4.5 Curated 的品質標籤還會加 <code>-0.8::feet::, rating:general</code>。</li>
            <li>要在圖上寫字時，<code>no text</code> 可能會干擾，可以把品質標籤關掉。</li>
            <li>負面預設（UC Preset）加在負面提示詞最前面，Heavy 最完整，Light 較少，Human Focus 多擋臉部與手部崩壞。</li>
            <li>品質標籤：best／amazing／great／normal／bad／worst quality。美感標籤：masterpiece（V4.5+）、top aesthetic、very aesthetic、aesthetic、displeasing、very displeasing。</li>
            <li>複雜度標籤（V5）：low／medium／high／ultra complexity。</li>
          </ul>
        </details>

        <details>
          <summary className="cursor-pointer text-xs font-medium text-slate-300">多角色：角色欄、位置、互動動作</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>基本 prompt 寫場景、畫風、人數（1boy, 1girl）；每位角色的外觀、服裝、表情、動作寫在各自的角色欄，開頭用 girl／boy／other。</li>
            <li>位置可交給 AI，或自訂：V4.5 是 5×5 格（A1–E5），V5 可以任意擺。</li>
            <li>互動動作加前綴：<code>source#</code> 做動作的人、<code>target#</code> 被做的人、<code>mutual#</code> 雙方一起。例如 <code>source#hug</code>／<code>target#hug</code>、<code>mutual#hug</code>。官方說不一定每次都準。</li>
            <li>每個角色欄也能各自寫負面提示詞。</li>
          </ul>
        </details>

        <details>
          <summary className="cursor-pointer text-xs font-medium text-slate-300">其他特殊寫法</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>圖上文字：prompt 加 <code>text, english text</code>，最後寫 <code>Text: 要寫的字</code>。V5 支援中文、日文；V4.5 只支援英文且最多 118 字元。</li>
            <li><code>fur dataset</code>（獸人畫風）、<code>background dataset</code>（無人物的寫實背景，V4.5+）要放在 prompt 最前面；上方的「模式：Furry」會自動加 fur dataset。</li>
            <li>透明背景（V5）：<code>transparent background</code>，打開「透明背景」會自動加。</li>
            <li><code>artist:名字</code> 是社群常用的畫師寫法，官方文件未說明。</li>
            <li><code>|</code> 混合 prompt 只適用 V3 以前；V4 以上請改用角色欄。</li>
          </ul>
        </details>

        <p className="text-[10px] text-slate-500">
          資料來源：docs.novelai.net（tags、strengthening-weakening、qualitytags、multiplecharacters、textrendering），以及 novelai.net 官方網頁的預設值，查證日期 2026-11-28。
        </p>
      </div>
    </details>
  );
}
