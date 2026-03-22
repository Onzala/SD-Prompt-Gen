
import React, { useState, useEffect } from 'react';
import { Sparkles, Wand2, History as HistoryIcon, Key, Info, Settings as SettingsIcon } from 'lucide-react';
import { GeminiModel, HistoryItem } from './types';
import { generateSDPrompt } from './services/geminiService';
import ModelSelector from './components/ModelSelector';
import ImageUploader from './components/ImageUploader';
import OutputDisplay from './components/OutputDisplay';
import HistorySidebar from './components/HistorySidebar';
import ApiKeySettings from './components/ApiKeySettings';

const App: React.FC = () => {
  const [model, setModel] = useState<GeminiModel>(GeminiModel.FLASH_3);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [tagDbContent, setTagDbContent] = useState<string>('');
  const [isDanbooruEnabled, setIsDanbooruEnabled] = useState(false);
  const [isFetchingTagDb, setIsFetchingTagDb] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Check for API key status on mount
  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key');
    setHasApiKey(!!key);
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

  const handleApiKeySave = (key: string) => {
    setHasApiKey(!!key);
    setIsApiKeyModalOpen(false);
  };

  const handleGenerate = async () => {
    if (!hasApiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    if (!inputText.trim() && !selectedImage) {
      setError("請提供文字描述或參考圖片。");
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedContent('');

    try {
      const apiKey = localStorage.getItem('gemini_api_key') || undefined;
      const result = await generateSDPrompt(inputText, selectedImage, model, tagDbContent || null, apiKey);
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
      if (err.message && (err.message.includes("401") || err.message.includes("key"))) {
        setError("API 金鑰無效，請檢查設定。");
        setHasApiKey(false);
      } else if (err.message && err.message.includes("429")) {
        setError("呼叫頻率過高或配額不足。");
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

  useEffect(() => {
    if (isDanbooruEnabled && !tagDbContent) {
      const fetchDb = async () => {
        setIsFetchingTagDb(true);
        try {
          const res = await fetch('/optimized_tag_database.txt');
          if (res.ok) {
            const text = await res.text();
            setTagDbContent(text);
          } else {
            console.error("Fetch failed");
          }
        } catch (e) {
          console.error("Failed to load tag database", e);
        } finally {
          setIsFetchingTagDb(false);
        }
      };
      fetchDb();
    } else if (!isDanbooruEnabled) {
      setTagDbContent('');
    }
  }, [isDanbooruEnabled]);



  return (
    <div className="min-h-screen flex flex-col text-slate-200">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-[40] border-b-0 border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/20 animate-float">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gradient tracking-tight">
                SD Prompt Gen
              </h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Ultimate AI Helper</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-300 ${hasApiKey
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10'
                : 'border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10'
                }`}
            >
              <Key size={16} />
              <span className="hidden sm:inline">{hasApiKey ? 'API 已設定' : '尚未設定 API'}</span>
            </button>

            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10"
              title="歷史紀錄"
            >
              <HistoryIcon size={22} />
            </button>

            <button
              className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10"
              onClick={() => setIsApiKeyModalOpen(true)}
            >
              <SettingsIcon size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 grid lg:grid-cols-2 gap-10">

        {/* Left Column: Input */}
        <div className="flex flex-col gap-4">

          {/* 頂部整合工具列 */}
          <section className="flex items-center gap-3 flex-wrap">
            <ModelSelector
              currentModel={model}
              onModelChange={setModel}
              disabled={loading}
            />
            
            

            <div className="flex-1 flex items-center gap-2 ml-2 min-w-[120px]">
              <div className="h-px flex-1 bg-white/5" />
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">視覺參考</label>
            </div>
          </section>

          {/* 視覺參考 — 核心區域 */}
          <section className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-[200px]">
              <ImageUploader
                selectedImage={selectedImage}
                onImageChange={setSelectedImage}
              />
            </div>
          </section>

          {/* 畫面靈感 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">畫面靈感</label>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="relative group">
              <textarea
                className="w-full h-32 bg-slate-900/50 border border-white/10 rounded-2xl p-4 pb-14 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/5 transition-all resize-none scrollbar-hide"
                placeholder="輸入您的想法或 Danbooru 標籤... (例如：賽博龐克風格的貓，在霓虹燈下喝咖啡，或者 1girl, cat ears...)"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between pointer-events-none">
                
                {/* iOS Style Switch for Danbooru */}
                <div className="pointer-events-auto flex items-center">
                  <label className="flex items-center gap-2.5 cursor-pointer group" title="啟用高度優化 Danbooru 標籤庫">
                    <div className={`relative flex items-center w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${isDanbooruEnabled ? 'bg-emerald-500' : 'bg-slate-700/80'}`}>
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={isDanbooruEnabled}
                        onChange={() => setIsDanbooruEnabled(!isDanbooruEnabled)}
                        disabled={loading || isFetchingTagDb}
                      />
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${isDanbooruEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      {isFetchingTagDb && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                           <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                         </div>
                      )}
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-tight transition-colors duration-300 ${isDanbooruEnabled ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-slate-500 group-hover:text-slate-400'}`}>
                      Danbooru 標籤
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                  <span className="text-[10px] text-slate-500 font-bold px-2 uppercase pointer-events-none hidden sm:inline-block tracking-wider">Ctrl + Enter</span>
                  <button
                  onClick={handleGenerate}
                  disabled={loading || (!inputText && !selectedImage)}
                  className={`
                    px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all transform active:scale-95
                    ${loading || (!inputText && !selectedImage)
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25'}
                  `}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      生成
                    </>
                  )}
                </button>
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-red-400 font-medium px-1 flex items-center gap-1"><Info size={12} /> {error}</p>}
          </section>
        </div>

        {/* Right Column: Output */}
        <div className="flex flex-col h-full gap-8">
          <div className="flex-1 flex flex-col min-h-[400px]">
            <div className="flex items-center gap-2 px-1 mb-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">生成結果</label>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="flex-1 glass-panel rounded-3xl overflow-hidden relative border border-white/10">
              <OutputDisplay content={generatedContent} loading={loading} />
            </div>
          </div>

          {/* Tips / Info */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                <Info size={18} className="text-amber-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200">專業生成小提醒</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Gemini 3 Pro 最適合處理包含大量細節與藝術風格的長描述；若是快速調整標籤，Flash 則是高性價比的首選。
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-600 uppercase">私隱保護</p>
                <p className="text-[11px] text-slate-400">金鑰僅存於本地，確保隱私安全。</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-bold text-slate-600 uppercase">標籤庫支援 (Danbooru)</p>
                <p className="text-[11px] text-slate-400">系統已預設優先對齊 Danbooru 的標準圖庫標籤。</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Overlays */}
      <ApiKeySettings
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleApiKeySave}
      />

      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleRestoreHistory}
        onClear={handleClearHistory}
        onDelete={handleDeleteHistoryItem}
      />

      <footer className="py-8 text-center border-t border-white/5">
        <p className="text-[11px] text-slate-600 font-medium">© 2026 SD Prompt Gen. Crafted for Excellence.</p>
      </footer>
    </div>
  );
};

export default App;
