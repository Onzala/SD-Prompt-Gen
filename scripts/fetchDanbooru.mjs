import fs from 'fs';
import path from 'path';

// 設定要抓取的常用標籤清單
const TARGET_TAGS = ['1girl', 'smile', 'cyberpunk', 'cat_ears', 'heart'];

// 準備儲存結果的陣列
const resultDb = [];

async function fetchTagAndWiki(tagName) {
  try {
    console.log(`正在處理標籤: ${tagName}...`);
    
    // 1. 抓取標籤基礎資訊 (獲得 post_count 等資料)
    const tagRes = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=${encodeURIComponent(tagName)}`);
    const tagData = await tagRes.json();
    
    // 2. 抓取 wiki 說明
    const wikiRes = await fetch(`https://danbooru.donmai.us/wiki_pages.json?search[title]=${encodeURIComponent(tagName)}`);
    const wikiData = await wikiRes.json();
    
    // 如果有資料則合併
    if (tagData.length > 0) {
      const tagInfo = tagData[0];
      const wikiInfo = (wikiData && wikiData.length > 0) ? wikiData[0] : null;
      
      resultDb.push({
        tag: tagInfo.name,
        category: tagInfo.category, // 0: General, 1: Artist, 3: Copyright, 4: Character
        postCount: tagInfo.post_count,
        description: wikiInfo ? wikiInfo.body : "無說明",
        otherNames: wikiInfo && wikiInfo.other_names ? wikiInfo.other_names.join(", ") : ""
      });
    }

    // 延遲以避免觸發 Rate Limit (Danbooru API 限速較嚴)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
  } catch (error) {
    console.error(`處理標籤 ${tagName} 時發生錯誤:`, error.message);
  }
}

async function main() {
  console.log('開始爬取 Danbooru 標籤庫...');
  
  for (const tag of TARGET_TAGS) {
    await fetchTagAndWiki(tag);
  }
  
  // 將結果輸出為 JSON 檔案，未來可匯入至 SD-Prompt-Gen
  const outputPath = path.join(process.cwd(), 'danbooru_tags.json');
  fs.writeFileSync(outputPath, JSON.stringify(resultDb, null, 2));
  
  console.log(`✅ 爬取完成！已產生: ${outputPath}`);
  console.log(`這個檔案可以直接匯入到 APP 內的「標籤庫」功能中使用。`);
}

main();
