import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageCircle, Send, History as HistoryIcon, Info, Lightbulb, Square, RefreshCw, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { GeminiModel, PromptFormat, HistoryItem, ModificationSuggestion } from './types';
import { generateSDPrompt, getRefinementSuggestions, getStoredApiKey, setStoredApiKey } from './services/geminiService';
import ModelSelector from './components/ModelSelector';
import FormatSelector from './components/FormatSelector';
import ArtistSelector from './components/ArtistSelector';
import ImageUploader from './components/ImageUploader';
import OutputDisplay from './components/OutputDisplay';
import HistorySidebar from './components/HistorySidebar';
import ApiKeyModal from './components/ApiKeyModal';

const App: React.FC = () => {
  const [model, setModel] = useState<GeminiModel | string>(GeminiModel.FLASH_LITE_LATEST);
  const [format, setFormat] = useState<PromptFormat>(PromptFormat.SD);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState('');
  const [suggestions, setSuggestions] = useState<ModificationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(() => !getStoredApiKey());

  const handleSaveApiKey = (key: string) => {
    setStoredApiKey(key);
    setApiKey(key);
    setIsApiKeyOpen(!key);
    if (key) setError(null);
  };
  
  // 用於控制中斷請求
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('sd_prompt_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    localStorage.setItem('sd_prompt_history', JSON.stringify(history));
  }, [history]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setLoadingSuggestions(false);
      setError("已停止生成。");
    }
  };

  const handleGenerate = async (customText?: string) => {
    const textToUse = customText || inputText;
    // 如果既沒有文字也沒有圖片，才阻止
    if (!textToUse.trim() && !selectedImage && !selectedArtist) {
      setError("請提供文字描述、參考圖片，或指定畫師風格。");
      return;
    }
    if (!apiKey) {
      setIsApiKeyOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    setSuggestions([]);
    
    // 初始化 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { content, fallbackNotice } = await generateSDPrompt(
        textToUse,
        selectedImage,
        model,
        format,
        selectedArtist,
        controller.signal
      );
      setGeneratedContent(content);
      if (fallbackNotice) {
        setNotice(fallbackNotice);
      }

      // Add to history
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        inputText: textToUse,
        generatedContent: content,
        model: model,
        hasImage: !!selectedImage,
        format: format,
        artist: selectedArtist || undefined
      };
      setHistory(prev => [newItem, ...prev].slice(0, 50));

      // 異步生成建議
      setLoadingSuggestions(true);
      const newSuggestions = await getRefinementSuggestions(content, format, controller.signal);
      setSuggestions(newSuggestions);
      setLoadingSuggestions(false);

    } catch (err: any) {
      if (err.message === "GenerationCancelled") {
        return;
      }
      if (err.message?.includes("Requested entity was not found")) {
        setError("API 金鑰失效或配額用盡。");
      } else {
        setError(err.message || "發生錯誤，請稍後再試。");
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleApplySuggestion = (suggestion: ModificationSuggestion) => {
    const newText = `基於目前結果，進行以下修改：${suggestion.action}\n\n原始需求：${inputText}`;
    setInputText(newText);
    handleGenerate(newText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChatSubmit = () => {
    if (loading) {
      handleStop();
    } else if (inputText.trim() || selectedImage || selectedArtist) {
      handleGenerate();
    }
  };

  // 判斷按鈕是否應該禁用
  const isSendDisabled = !loading && !inputText.trim() && !selectedImage && !selectedArtist;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-indigo-200 to-purple-200">
                  AI 繪畫提示詞專家
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  SD & NAI 雙核心
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                支援 Stable Diffusion WebUI 權重與 NovelAI Danbooru 標籤公式
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsApiKeyOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-all ${
                apiKey
                  ? 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border-slate-700'
                  : 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40'
              }`}
              title="設定 Gemini API 金鑰"
            >
              <KeyRound size={15} className={apiKey ? 'text-emerald-400' : 'text-amber-400'} />
              <span className="hidden sm:inline">{apiKey ? 'API 金鑰' : '尚未設定 API'}</span>
            </button>
            <button 
              onClick={() => setIsHistoryOpen(true)} 
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition-all" 
              title="查看歷史紀錄"
            >
              <HistoryIcon size={15} className="text-blue-400" />
              <span>歷史紀錄</span>
              {history.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-600/30 text-blue-300 font-bold ml-0.5">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid lg:grid-cols-2 gap-8">
        {/* Left Column: Controls & Prompt Input */}
        <div className="flex flex-col gap-5">
          {/* 1. Core Model Selector (Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Gemini 核心模型 (下拉選單)</span>
              <span className="text-[10px] text-slate-500">已升級至最新世代</span>
            </label>
            <ModelSelector 
              currentModel={model} 
              onModelChange={setModel} 
              disabled={loading} 
            />
          </div>

          {/* 2. Format Selector (SD vs NAI) */}
          <div className="space-y-1.5">
            <FormatSelector
              currentFormat={format}
              onFormatChange={setFormat}
              disabled={loading}
            />
          </div>

          {/* 3. Danbooru Artist Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>指定畫師風格 (Danbooru)</span>
              <span className="text-[10px] text-purple-400">
                {selectedArtist ? `已選定: ${selectedArtist}` : '可選'}
              </span>
            </label>
            <ArtistSelector
              selectedArtist={selectedArtist}
              onArtistChange={setSelectedArtist}
              format={format}
              disabled={loading}
            />
          </div>

          {/* 4. Visual Image Reference */}
          <div className="space-y-1.5">
             <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
               <span>視覺參考圖片</span>
               <span className="text-[10px] text-slate-500">支援拖曳、點擊或貼上</span>
             </label>
             <ImageUploader selectedImage={selectedImage} onImageChange={setSelectedImage} />
          </div>

          {/* 5. Prompt / Requirement Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-400">
                對話描述 / 畫面需求
              </label>
              <span className="text-[10px] text-slate-500">
                Ctrl + Enter 快速發送
              </span>
            </div>
            <div className="relative">
              <textarea
                className="w-full h-40 bg-slate-900 border-2 border-slate-700/80 rounded-xl p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none text-sm font-medium pr-12 leading-relaxed"
                placeholder={
                  selectedImage 
                    ? "圖片已就緒，可直接發送讓 AI 深度解析並提取標籤，或在此補充修改指示..." 
                    : selectedArtist
                      ? `已指定畫師風格【${selectedArtist}】，請輸入你想繪製的主題（例如：雨夜街頭的白髮貓耳少女）...`
                      : format === PromptFormat.NAI
                        ? "輸入你的動漫場景或角色構想（例如：教室窗邊的黑長直水手服少女，夕陽微光，唯美氛圍）..."
                        : "輸入你的創意或畫面需求（例如：賽博龐克風格的機械女刺客，霓虹光影，細緻人體細節）..."
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleChatSubmit()}
                disabled={loading}
              />
              <button 
                type="button"
                onClick={handleChatSubmit}
                disabled={isSendDisabled}
                className={`absolute bottom-3 right-3 p-2.5 rounded-lg transition-all flex items-center justify-center shadow-lg ${
                  loading 
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20' 
                    : format === PromptFormat.NAI
                      ? 'bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white shadow-purple-500/20'
                      : 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white shadow-blue-500/20'
                }`}
                title={loading ? "中斷生成" : "生成提示詞"}
              >
                {loading ? (
                  <div className="flex items-center gap-1">
                    <Square size={16} fill="currentColor" />
                  </div>
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
            {notice && (
              <div className="flex items-start justify-between gap-2 text-xs font-medium px-3 py-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                  <span>{notice}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setNotice(null)} 
                  className="text-emerald-400 hover:text-emerald-200 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {error && (
              <div className={`text-xs font-medium p-3 rounded-lg bg-slate-900 border ${
                error === "已停止生成。" 
                  ? "text-slate-400 border-slate-800" 
                  : "text-red-300 border-red-500/30 bg-red-950/30"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {error !== "已停止生成。" && (
                      <AlertCircle size={15} className="shrink-0 text-red-400 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-medium text-slate-200">{error}</p>
                      {(error.includes("503") || error.includes("流量高峰")) && (
                        <p className="text-[11px] text-slate-400">
                          提示：Google 伺服器尖峰通常持續數秒。您可以直接點擊「立即重試」，或上方切換至延遲更低的 Gemini Flash Latest。
                        </p>
                      )}
                    </div>
                  </div>
                  {error !== "已停止生成。" && (
                    <button
                      type="button"
                      onClick={() => handleGenerate()}
                      className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
                    >
                      <RefreshCw size={12} />
                      立即重試
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* AI Refinement Suggestions */}
          {(generatedContent || loadingSuggestions) && (
            <div className="space-y-2.5">
               <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <Lightbulb size={15} className="text-amber-400" />
                  AI 創意方向建議 (點擊直接套用修改)
               </div>
               
               <div className="grid grid-cols-1 gap-2">
                  {loadingSuggestions ? (
                      [1,2,3].map(i => (
                          <div key={i} className="h-16 bg-slate-900/60 rounded-xl animate-pulse border border-slate-800" />
                      ))
                  ) : (
                      suggestions.map((s, idx) => (
                          <button
                              key={idx}
                              type="button"
                              onClick={() => handleApplySuggestion(s)}
                              className="text-left p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all group flex items-start gap-3"
                          >
                              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform shrink-0">
                                  <MessageCircle size={14} />
                              </div>
                              <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 group-hover:text-blue-400 flex items-center justify-between">
                                      <span>{s.label}</span>
                                      <span className="text-[10px] font-normal text-slate-500 opacity-60">套用微調 →</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{s.description}</p>
                              </div>
                          </button>
                      ))
                  )}
               </div>
            </div>
          )}

          {/* Helpful Tips */}
          <div className="mt-auto p-3.5 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <div className="flex gap-2 text-blue-400 mb-1.5 font-bold text-xs">
                <Info size={14} /> 格式提示說明
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {format === PromptFormat.NAI 
                  ? 'NovelAI (NAI) 模式使用 Danbooru 動漫標籤規範，以 {tag} 花括號乘算權重 (每次 +5%)，並自動加入 year 2024 高品質年份語義與專用 Undesired Content。'
                  : 'Stable Diffusion (SD) 模式使用 (tag:1.2) 圓括號權重語法，具備 6 階分段輸出與完整的 SD 負面提示詞。'}
              </p>
          </div>
        </div>

        {/* Right Column: Output Display */}
        <div className="flex flex-col h-full space-y-4">
           <div className="flex-1 min-h-[460px]">
              <OutputDisplay 
                content={generatedContent} 
                loading={loading} 
                format={format}
              />
           </div>
        </div>
      </main>

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        currentKey={apiKey}
        onSave={handleSaveApiKey}
        onClose={() => setIsApiKeyOpen(false)}
      />

      {/* History Drawer */}
      <HistorySidebar 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={(item) => {
            setInputText(item.inputText);
            setModel(item.model);
            if (item.format) setFormat(item.format);
            if (item.artist) setSelectedArtist(item.artist);
            setGeneratedContent(item.generatedContent);
            setIsHistoryOpen(false);
        }}
        onClear={() => setHistory([])}
        onDelete={(id) => setHistory(prev => prev.filter(i => i.id !== id))}
      />
    </div>
  );
};

export default App;
