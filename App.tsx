import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, History as HistoryIcon, Lightbulb, Square, RefreshCw, AlertCircle, CheckCircle2,
  KeyRound, ShieldAlert, SlidersHorizontal, Palette, X, Wand2, ArrowUpRight, Images, Sun, Moon, Wand, ImageIcon,
} from 'lucide-react';
import { GeminiModel, PromptFormat, HistoryItem, ModificationSuggestion } from './types';
import { generateSDPrompt, getRefinementSuggestions, getStoredApiKey, setStoredApiKey } from './services/geminiService';
import ModelSelector from './components/ModelSelector';
import FormatSelector from './components/FormatSelector';
import ArtistSelector from './components/ArtistSelector';
import ImageUploader from './components/ImageUploader';
import OutputDisplay from './components/OutputDisplay';
import HistorySidebar from './components/HistorySidebar';
import ApiKeyModal from './components/ApiKeyModal';
import ModerationStatsModal from './components/ModerationStatsModal';
import PoseWearLibrary from './components/PoseWearLibrary';
import PoseEditor from './components/PoseEditor';
import { preparePoseWearReference, type SelectedPoseWearReference } from './services/posewear';
import { useTheme } from './hooks/useTheme';

const STOPPED_MESSAGE = '已停止生成。';

const App: React.FC = () => {
  const [model, setModel] = useState<GeminiModel | string>(GeminiModel.FLASH_LITE_LATEST);
  const [format, setFormat] = useState<PromptFormat>(PromptFormat.SD);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [poseWearReferences, setPoseWearReferences] = useState<SelectedPoseWearReference[]>([]);
  const [showAdultReferences, setShowAdultReferences] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [suggestions, setSuggestions] = useState<ModificationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());
  const [mode, setMode] = useState<'prompt' | 'image'>(() =>
    localStorage.getItem('sd_prompt_mode') === 'image' ? 'image' : 'prompt');
  useEffect(() => { localStorage.setItem('sd_prompt_mode', mode); }, [mode]);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(() => !getStoredApiKey());

  const { theme, toggleTheme } = useTheme();
  const outputRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

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

  // 自動備援通知幾秒後自動收起
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  // 小螢幕時，生成開始後捲到結果區
  const revealOutput = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setLoadingSuggestions(false);
      setError(STOPPED_MESSAGE);
    }
  };

  const handleGenerate = async (customText?: string) => {
    if (abortControllerRef.current) return;
    const textToUse = customText || inputText;
    if (!textToUse.trim() && !selectedImage && !selectedArtist && !poseWearReferences.length) {
      setError("請提供文字描述、參考圖片、素材庫參考或畫師風格。");
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
    revealOutput();

    // 初始化 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const references = await Promise.all(poseWearReferences.map(entry =>
        preparePoseWearReference(entry, controller.signal),
      ));
      const { content, fallbackNotice } = await generateSDPrompt(
        textToUse,
        selectedImage,
        model,
        format,
        selectedArtist,
        controller.signal,
        references,
      );
      if (controller.signal.aborted) return;
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
        hasImage: !!selectedImage || references.length > 0,
        format: format,
        artist: selectedArtist || undefined,
        poseWearReferences: poseWearReferences.length ? poseWearReferences.map(entry => entry.reference) : undefined,
      };
      setHistory(prev => [newItem, ...prev].slice(0, 50));

      // 異步生成建議
      setLoadingSuggestions(true);
      const newSuggestions = await getRefinementSuggestions(content, format, controller.signal);
      if (controller.signal.aborted) return;
      setSuggestions(newSuggestions);
      setLoadingSuggestions(false);

    } catch (err: any) {
      if (controller.signal.aborted || err.message === "GenerationCancelled") {
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
        controller.abort();
      }
    }
  };

  const handleApplySuggestion = (suggestion: ModificationSuggestion) => {
    const newText = `基於目前結果，進行以下修改：${suggestion.action}\n\n原始需求：${inputText}`;
    setInputText(newText);
    handleGenerate(newText);
  };

  const handleChatSubmit = () => {
    if (loading) {
      handleStop();
    } else if (inputText.trim() || selectedImage || selectedArtist || poseWearReferences.length) {
      handleGenerate();
    }
  };

  // 判斷按鈕是否應該禁用
  const isSendDisabled = !loading && !inputText.trim() && !selectedImage && !selectedArtist && !poseWearReferences.length;
  const isNai = format === PromptFormat.NAI;

  const placeholder = selectedImage
    ? '圖片已就緒，可直接生成讓 AI 解析並提取標籤，或在此補充修改指示…'
    : selectedArtist
      ? `已指定畫師風格【${selectedArtist}】，描述你想畫的主題（例如：雨夜街頭的白髮貓耳少女）…`
      : isNai
        ? '描述動漫場景或角色構想（例如：教室窗邊的黑長直水手服少女，夕陽微光，唯美氛圍）…'
        : '描述你的創意或畫面需求（例如：賽博龐克風格的機械女刺客，霓虹光影，細緻人體細節）…';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-fg/[0.06] bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-fg">AI 繪畫提示詞專家</h1>
              <p className="hidden truncate text-[11px] text-slate-500 sm:block">
                Stable Diffusion 權重語法 · NovelAI Danbooru 標籤
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-1 rounded-xl border border-fg/[0.06] bg-slate-950/40 p-1" role="tablist" aria-label="功能">
            {([
              { id: 'prompt', label: '產生 Prompt', short: 'Prompt', Icon: Wand },
              { id: 'image', label: '產生圖片', short: '生圖', Icon: ImageIcon },
            ] as const).map(({ id, label, short, Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
                className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${mode === id
                  ? 'bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/40'
                  : 'text-slate-400 hover:bg-fg/[0.04] hover:text-fg'}`}>
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </button>
            ))}
          </div>

          <nav className="flex items-center gap-1.5" aria-label="工具列">
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn"
              title={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
              aria-label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
            >
              {theme === 'dark' ? <Sun size={16} className="text-amber-300" /> : <Moon size={16} className="text-indigo-500" />}
            </button>
            <button
              type="button"
              onClick={() => setIsApiKeyOpen(true)}
              className={apiKey ? 'btn-ghost h-9' : 'btn h-9 border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'}
              title="設定 Gemini API 金鑰"
              aria-label="設定 Gemini API 金鑰"
            >
              <span className="relative">
                <KeyRound size={15} />
                <span className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-slate-950 ${apiKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              </span>
              <span className="hidden sm:inline">{apiKey ? 'API 金鑰' : '設定 API 金鑰'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsStatsOpen(true)}
              className="btn-ghost h-9"
              title="各模型審查統計"
              aria-label="各模型審查統計"
            >
              <ShieldAlert size={15} className="text-rose-300" />
              <span className="hidden md:inline">審查統計</span>
            </button>
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="btn-ghost h-9"
              title="歷史紀錄"
              aria-label="歷史紀錄"
            >
              <HistoryIcon size={15} className="text-sky-300" />
              <span className="hidden md:inline">歷史紀錄</span>
              {history.length > 0 && (
                <span className="rounded-full bg-violet-500/25 px-1.5 text-[10px] font-semibold text-violet-200">
                  {history.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-[1440px] flex-1 gap-5 p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6 lg:p-6 ${mode === 'prompt' ? 'grid' : 'hidden'}`}>
        {/* 左欄：輸入與設定 */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1. 畫面需求（主要輸入） */}
          <section className="card overflow-hidden" aria-labelledby="composer-title">
            <div className="card-header">
              <h2 id="composer-title" className="card-title">
                <Wand2 size={15} className="text-violet-300" />
                畫面需求
              </h2>
              <span className="hidden items-center gap-1 text-[11px] text-slate-500 sm:flex">
                <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> 生成
              </span>
            </div>

            <div className="space-y-3 px-4">
              <textarea
                ref={composerRef}
                className="input min-h-[132px] resize-y p-3.5 leading-relaxed"
                placeholder={placeholder}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && handleChatSubmit()}
                disabled={loading}
                aria-label="畫面需求描述"
              />
              <ImageUploader selectedImage={selectedImage} onImageChange={setSelectedImage} />
            </div>

            {/* 已套用的條件 */}
            {(selectedArtist || poseWearReferences.length > 0) && (
              <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                {selectedArtist && (
                  <span className="chip border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200">
                    <Palette size={11} />
                    <span className="font-mono">{selectedArtist}</span>
                    <button type="button" onClick={() => setSelectedArtist(null)} disabled={loading}
                      className="-mr-0.5 rounded-full p-0.5 hover:bg-fg/10" aria-label="清除指定畫師">
                      <X size={11} />
                    </button>
                  </span>
                )}
                {poseWearReferences.length > 0 && (
                  <span className="chip border-sky-500/30 bg-sky-500/10 text-sky-200">
                    <Images size={11} />
                    素材參考 {poseWearReferences.length} 項
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-fg/[0.06] bg-fg/[0.015] px-4 py-3">
              <span className={`chip ${isNai ? 'border-violet-500/30 bg-violet-500/10 text-violet-200' : 'border-sky-500/30 bg-sky-500/10 text-sky-200'}`}>
                {isNai ? 'NovelAI {tag}' : 'SD (tag:1.2)'}
              </span>
              <button
                type="button"
                onClick={handleChatSubmit}
                disabled={isSendDisabled}
                className={loading
                  ? 'btn h-10 bg-rose-500/90 px-5 text-sm text-white hover:bg-rose-500'
                  : 'btn-primary h-10 px-5 text-sm'}
              >
                {loading ? <Square size={14} fill="currentColor" /> : <Send size={15} />}
                {loading ? '停止生成' : '生成提示詞'}
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className={`flex items-start gap-3 border-t px-4 py-3 text-xs ${
                  error === STOPPED_MESSAGE
                    ? 'border-fg/[0.06] text-slate-400'
                    : 'border-rose-500/20 bg-rose-500/[0.07] text-rose-100'
                }`}
              >
                {error !== STOPPED_MESSAGE && <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-400" />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{error}</p>
                  {(error.includes('503') || error.includes('流量高峰')) && (
                    <p className="text-[11px] text-slate-400">
                      Google 伺服器尖峰通常只持續數秒，可直接重試，或切換到其他模型。
                    </p>
                  )}
                </div>
                {error !== STOPPED_MESSAGE ? (
                  <button type="button" onClick={() => handleGenerate()} className="btn shrink-0 bg-rose-500/80 text-white hover:bg-rose-500">
                    <RefreshCw size={12} /> 重試
                  </button>
                ) : (
                  <button type="button" onClick={() => setError(null)} className="shrink-0 text-slate-500 hover:text-slate-300" aria-label="關閉">
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 2. 生成設定 */}
          <section className="card" aria-labelledby="settings-title">
            <div className="card-header">
              <h2 id="settings-title" className="card-title">
                <SlidersHorizontal size={15} className="text-sky-300" />
                生成設定
              </h2>
            </div>
            <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="field-label">Gemini 模型</div>
                <ModelSelector currentModel={model} onModelChange={setModel} disabled={loading} />
              </div>
              <FormatSelector currentFormat={format} onFormatChange={setFormat} disabled={loading} />
            </div>
          </section>

          {/* 3. 風格與參考 */}
          <section className="card" aria-labelledby="refs-title">
            <div className="card-header">
              <h2 id="refs-title" className="card-title">
                <Palette size={15} className="text-fuchsia-300" />
                風格與參考
              </h2>
              <span className="text-[11px] text-slate-500">皆為選填</span>
            </div>
            <div className="space-y-4 px-4 pb-4">
              <div>
                <div className="field-label">
                  <span>畫師風格（Danbooru）</span>
                  {selectedArtist && <span className="font-mono text-fuchsia-300">{selectedArtist}</span>}
                </div>
                <ArtistSelector
                  selectedArtist={selectedArtist}
                  onArtistChange={setSelectedArtist}
                  format={format}
                  disabled={loading}
                />
              </div>
              <PoseWearLibrary
                selected={poseWearReferences}
                onChange={setPoseWearReferences}
                showAdult={showAdultReferences}
                onShowAdultChange={enabled => {
                  setShowAdultReferences(enabled);
                  if (!enabled) setPoseWearReferences(current => current.filter(entry => !entry.reference.adult));
                }}
                disabled={loading}
              />
            </div>
          </section>

        </div>

        {/* 右欄：結果 */}
        <div ref={outputRef} className="flex min-w-0 scroll-mt-20 flex-col gap-5 lg:sticky lg:top-[4.75rem] lg:h-[calc(100vh-6.25rem)] lg:self-start">
          <div className="flex min-h-[420px] flex-1 flex-col lg:min-h-0">
            <OutputDisplay content={generatedContent} loading={loading} format={format} />
          </div>

          {/* AI 建議 */}
          {(suggestions.length > 0 || loadingSuggestions) && (
            <section className="card shrink-0 p-4" aria-labelledby="suggest-title">
              <h2 id="suggest-title" className="card-title mb-3">
                <Lightbulb size={15} className="text-amber-300" />
                AI 修改建議
                <span className="text-[11px] font-normal text-slate-500">點擊即套用並重新生成</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {loadingSuggestions
                  ? [1, 2, 3].map(i => <div key={i} className="skeleton h-[72px]" />)
                  : suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplySuggestion(s)}
                      disabled={loading}
                      className="group flex flex-col gap-1 rounded-xl border border-fg/[0.06] bg-fg/[0.02] p-3 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/[0.06] disabled:opacity-50"
                    >
                      <span className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-100 group-hover:text-violet-200">
                        {s.label}
                        <ArrowUpRight size={13} className="shrink-0 text-slate-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-300" />
                      </span>
                      <span className="line-clamp-2 text-[11px] leading-relaxed text-slate-400">{s.description}</span>
                    </button>
                  ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* 產生圖片：切換分頁時保留狀態，所以只隱藏不卸載 */}
      <div className={`mx-auto w-full max-w-[1440px] flex-1 p-4 lg:p-6 ${mode === 'image' ? '' : 'hidden'}`}>
        <PoseEditor
          hasApiKey={!!apiKey}
          onNeedApiKey={() => setIsApiKeyOpen(true)}
          showAdult={showAdultReferences}
          onShowAdultChange={enabled => {
            setShowAdultReferences(enabled);
            if (!enabled) setPoseWearReferences(current => current.filter(entry => !entry.reference.adult));
          }}
        />
      </div>

      {/* 自動備援通知（toast） */}
      {notice && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-lg animate-pop-in items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-slate-900/95 px-4 py-3 text-xs text-emerald-100 shadow-2xl backdrop-blur">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          <span className="flex-1 leading-relaxed">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-300/70 hover:text-emerald-100" aria-label="關閉通知">
            <X size={14} />
          </button>
        </div>
      )}

      <ModerationStatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} />

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
            setMode('prompt');
            if (loading) handleStop();
            setInputText(item.inputText);
            setModel(item.model);
            if (item.format) setFormat(item.format);
            if (item.artist) setSelectedArtist(item.artist);
            setPoseWearReferences((item.poseWearReferences ?? [])
              .filter(reference => showAdultReferences || !reference.adult)
              .map(reference => ({ reference })));
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
