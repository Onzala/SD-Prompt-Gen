# AI 繪畫提示詞專家（SD & NovelAI）

以 Google Gemini 將文字描述或參考圖片轉成 Stable Diffusion／NovelAI 提示詞的網頁工具。

🌐 線上版：https://onzala.github.io/SD-Prompt-Gen/

## 功能

- **雙格式輸出**：Stable Diffusion（`(tag:1.2)` 權重）與 NovelAI（`{tag}` Danbooru 標籤）
- **Danbooru 畫師風格庫**：指定畫師並自動修正為正確的 Danbooru 標籤
- **視覺參考**：上傳、拖曳或貼上圖片，可裁切後讓 AI 解析
- **模型切換與自動備援**：遇 503／429 尖峰時自動改用備援模型
- **AI 修改建議**：生成後提供三個可一鍵套用的微調方向
- **歷史紀錄**：保存在瀏覽器本地

## 使用方式

第一次開啟時輸入自己的 Gemini API 金鑰（[到 Google AI Studio 取得](https://aistudio.google.com/apikey)）。金鑰只存在你自己瀏覽器的 localStorage，並直接從瀏覽器呼叫 Gemini API，不經過任何中介伺服器。

## 本地開發

```bash
npm install
npm run dev
```

## 部署

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會自動建置並發佈到 GitHub Pages。
