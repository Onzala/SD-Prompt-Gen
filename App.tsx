
import React, { useState, useEffect } from 'react';
import { Sparkles, Wand2, Database, Upload, X, History as HistoryIcon, Key, Info } from 'lucide-react';
import { GeminiModel, HistoryItem } from './types';
import { generateSDPrompt } from './services/geminiService';
import ModelSelector from './components/ModelSelector';
import ImageUploader from './components/ImageUploader';
import OutputDisplay from './components/OutputDisplay';
import HistorySidebar from './components/HistorySidebar';

// Removed manual Window interface declaration to avoid conflict with environment's global types.
// We will use type casting (window as any).aistudio where needed.

const App: React.FC = () => {
  const [model, setModel] = useState<GeminiModel>(GeminiModel.FLASH_3);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [tagDbContent, setTagDbContent] = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Check for API key status on mount
  useEffect(() => {
    const checkKey = async () => {
      // Access aistudio via any cast to bypass type conflicts and handle injected global
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const selected = await aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  // Load history from local storage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('sd_prompt_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  // Save history whenever it changes
  useEffect(() => {
    localStorage.setItem('sd_prompt_history', JSON.stringify(history));
  }, [history]);

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      // Assume success after trigger as per instructions to avoid race conditions
      setHasApiKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!inputText.trim() && !selectedImage) {
        setError("請提供文字描述或參考圖片。");
        return;
    }

    setLoading(true);
    setError(null);
    setGeneratedContent('');

    try {
      const result = await generateSDPrompt(inputText, selectedImage, model, tagDbContent || null);
      setGeneratedContent(result);

      // Add to history
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        inputText: inputText,
        generatedContent: result,
        model: model,
        hasImage: !!selectedImage
      };
      
      setHistory(prev => [newItem, ...prev].slice(0, 50));

    } catch (err: any) {
      // Specific error handling for missing/invalid keys
      if (err.message && err.message.includes("Requested entity was not found")) {
        setError("API 金鑰失效或找不到對應專案，請點擊上方金鑰按鈕重新選擇。");
        setHasApiKey(false);
      } else if (err.message && err.message.includes("429")) {
        setError("免費額度已達上限。請點擊上方金鑰按鈕切換至付費專案金鑰。");
      } else {
        setError(err.message || "發生未預期的錯誤。");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    setInputText(item.inputText);
    if (Object.values(GeminiModel).includes(item.model)) {
      setModel(item.model);
    }
    setGeneratedContent(item.generatedContent);
    setIsHistoryOpen(false);
  };

  const handleClearHistory = () => {
    if (confirm("確定要清除所有歷史紀錄嗎？")) {
        setHistory([]);
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleGenerate();
    }
  };

  const handleTagDbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          setTagDbContent(text);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const getModelLabel = () => {
    switch(model) {
        case GeminiModel.FLASH_3: return "Gemini 3 Flash: 推薦首選，反應迅速且指令遵循力強。";
        case GeminiModel.PRO_3: return "Gemini 3 Pro: 最強模型，擅長複雜構圖與精細細節描述。";
        case GeminiModel.LITE_25: return "Gemini 2.5 Lite: 輕量高效，適合快速產生簡單標籤。";
        default: return "";
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200">
              SD 提示詞生成器
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
             {/* API Key Selector Button */}
             <button 
                onClick={handleSelectKey}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  hasApiKey 
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                }`}
             >
                <Key size={14} />
                <span className="hidden sm:inline">{hasApiKey ? '已載入金鑰' : '設定金鑰'}</span>
             </button>

             <button 
                onClick={() => setIsHistoryOpen(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all flex items-center gap-2"
                title="歷史紀錄"
             >
                <HistoryIcon size={20} />
                <span className="hidden sm:inline text-sm font-medium">紀錄</span>
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid lg:grid-cols-2 gap-8">
        
        {/* Left Column: Input */}
        <div className="flex flex-col gap-6">
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">模型選擇</label>
            <ModelSelector 
                currentModel={model} 
                onModelChange={setModel} 
                disabled={loading}
            />
            <p className="text-[10px] text-slate-500 px-1 italic">
                {getModelLabel()}
            </p>
          </div>

          <div className="space-y-2">
             <label className="text-sm font-medium text-slate-400">視覺參考 (選填)</label>
             <ImageUploader 
                selectedImage={selectedImage} 
                onImageChange={setSelectedImage} 
             />
          </div>

          <div className="space-y-2">
             <div className="flex justify-between items-center px-1">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Database size={14} /> 標籤資料庫 (參考)
                </label>
                <div className="flex items-center gap-3">
                    <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1 transition-colors select-none">
                        <input 
                            type="file" 
                            accept=".txt,.json,.csv,.md" 
                            className="hidden" 
                            onChange={handleTagDbUpload}
                            disabled={loading}
                        />
                        <Upload size={12} />
                        載入檔案
                    </label>
                    {tagDbContent && (
                        <button 
                            onClick={() => setTagDbContent('')}
                            className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
                        >
                            <X size={12} /> 清除
                        </button>
                    )}
                </div>
             </div>
             <textarea
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all resize-y font-mono scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
                placeholder="在此貼上標籤資料庫內容，AI 將會參考這些標籤..."
                value={tagDbContent}
                onChange={(e) => setTagDbContent(e.target.value)}
                disabled={loading}
             />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">畫面描述</label>
            <textarea
              className="w-full h-40 bg-slate-800 border-2 border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all resize-y scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
              placeholder="描述你想要生成的畫面... (例如：賽博龐克城市，霓虹燈，下雨，1個女孩，帽T...)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-slate-500">按 Ctrl + Enter 生成</span>
                {error && <span className="text-xs text-red-400 font-medium">{error}</span>}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || (!inputText && !selectedImage)}
            className={`
              w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]
              ${loading || (!inputText && !selectedImage)
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25'}
            `}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                生成提示詞
              </>
            )}
          </button>
        </div>

        {/* Right Column: Output */}
        <div className="flex flex-col h-full">
           <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-2">生成結果</label>
              <OutputDisplay content={generatedContent} loading={loading} />
           </div>
           
           {/* Tips / Info */}
           <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-800 text-xs text-slate-500 space-y-3">
               <div className="flex items-start gap-2 text-amber-400/80">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <p>
                    如果遇到配額問題，請點擊上方 <span className="text-amber-400 font-bold">設定金鑰</span> 並選擇一個有綁定付款方式的專案以解除限制。
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline ml-1 text-blue-400">了解詳情</a>
                  </p>
               </div>
               <div className="space-y-1">
                  <p className="font-semibold text-slate-400">小撇步：</p>
                  <ul className="list-disc list-inside space-y-1">
                      <li>提供圖片以提取風格和構圖標籤。</li>
                      <li>如果描述非常複雜或具體，請使用 <strong>Gemini 3 Pro</strong>。</li>
                      <li>標籤資料庫可載入您常用的風格清單，AI 會從中選取合適的。</li>
                  </ul>
               </div>
           </div>
        </div>
      </main>

      {/* History Sidebar */}
      <HistorySidebar 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleRestoreHistory}
        onClear={handleClearHistory}
        onDelete={handleDeleteHistoryItem}
      />
    </div>
  );
};

export default App;
