import fs from 'fs';
import path from 'path';

// 設定輸入與輸出路徑
const INPUT_CSV = path.join(process.cwd(), 'danbooru_tags_downloaded.csv');
const OUTPUT_TXT = path.join(process.cwd(), 'optimized_tag_database.txt');

// 設定要保留的 General (0) 標籤最大數量，避免 1.5MB 塞爆 AI Token
const MAX_GENERAL_TAGS = 3000; 

function processCsv() {
  console.log('開始處理 Hugging Face Danbooru CSV 資料...');
  
  if (!fs.existsSync(INPUT_CSV)) {
    console.error('找不到 CSV 檔案，請先確認檔案是否下載至根目錄。');
    return;
  }

  const fileContent = fs.readFileSync(INPUT_CSV, 'utf-8');
  const lines = fileContent.split('\n');
  
  const categorizedTags = {
    general: [],     // Category 0
    copyright: [],   // Category 3
    character: []    // Category 4
  };

  // 略過標題列
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 解析 CSV，處理可能被引號包住的 alias
    // tag,category,count,alias
    // 範例: 1girl,0,4974288,"女の子,女性,..."
    const firstComma = line.indexOf(',');
    const secondComma = line.indexOf(',', firstComma + 1);
    
    if (firstComma === -1 || secondComma === -1) continue;
    
    const tag = line.substring(0, firstComma);
    const category = line.substring(firstComma + 1, secondComma);
    
    // 依據分類放入陣列 (只要前綴標籤即可，AI 看懂 tag 就好)
    if (category === '0' && categorizedTags.general.length < MAX_GENERAL_TAGS) {
      categorizedTags.general.push(tag);
    } else if (category === '3' && categorizedTags.copyright.length < 500) { // 取前 500 個大 IP
      categorizedTags.copyright.push(tag);
    } else if (category === '4' && categorizedTags.character.length < 500) { // 取前 500 個熱門角色
      categorizedTags.character.push(tag);
    }
  }

  // 將資料轉為 AI 友善的 Markdown / 純文字格式
  let outputDb = `# Danbooru Reference Tag Database\n\n`;
  outputDb += `## General Descriptive Tags (Top ${categorizedTags.general.length})\n`;
  outputDb += categorizedTags.general.join(', ') + '\n\n';
  
  outputDb += `## Top Franchises/Copyrights\n`;
  outputDb += categorizedTags.copyright.join(', ') + '\n\n';

  outputDb += `## Popular Characters\n`;
  outputDb += categorizedTags.character.join(', ') + '\n\n';

  fs.writeFileSync(OUTPUT_TXT, outputDb);

  console.log(`✅ 處理完成！`);
  console.log(`原始資料已提煉為高度優化的 txt 檔案: ${OUTPUT_TXT}`);
  console.log(`檔案大小大幅縮減，請直接在 APP 的「標籤庫」上傳此檔案給 AI 參考。`);
}

processCsv();
