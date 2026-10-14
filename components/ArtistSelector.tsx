import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DANBOORU_ARTISTS, resolveDanbooruTag } from '../constants';
import { DanbooruArtist, PromptFormat } from '../types';
import { Palette, Search, X, Check, Globe, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';

interface ArtistSelectorProps {
  selectedArtist: string | null; // Danbooru tag e.g. "krenz" or "wlop"
  onArtistChange: (tag: string | null) => void;
  format: PromptFormat;
  disabled: boolean;
}

const CATEGORIES = ['全部', '極致厚塗', '日系萌系', '賽博科幻', '唯美風景', '暗黑奇幻'];

const ArtistSelector: React.FC<ArtistSelectorProps> = ({
  selectedArtist,
  onArtistChange,
  format,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [customTagInput, setCustomTagInput] = useState('');
  const [liveResults, setLiveResults] = useState<{ name: string; post_count: number }[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter curated artists
  const filteredArtists = useMemo(() => {
    return DANBOORU_ARTISTS.filter(artist => {
      const matchesCategory = selectedCategory === '全部' || artist.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery = !q || 
        artist.name.toLowerCase().includes(q) ||
        artist.tag.toLowerCase().includes(q) ||
        artist.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  // Live search directly querying Danbooru Category 1 (Artist) ordered by post count
  useEffect(() => {
    const rawQ = searchQuery.trim().toLowerCase();
    if (!rawQ || rawQ.length < 2) {
      setLiveResults([]);
      setIsSearchingOnline(false);
      return;
    }

    // Also resolve aliases for query if applicable (e.g. krenz_cushart -> krenz)
    const normalizedQ = resolveDanbooruTag(rawQ);

    const timer = setTimeout(async () => {
      setIsSearchingOnline(true);
      try {
        const queryTerm = normalizedQ || rawQ;
        const url = `https://danbooru.donmai.us/tags.json?search[category]=1&search[order]=count&search[name_matches]=*${encodeURIComponent(queryTerm)}*&limit=15`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setLiveResults(data.map((item: any) => ({
              name: item.name,
              post_count: item.post_count || 0
            })));
          }
        }
      } catch (err) {
        // Fallback to local database if browser blocks cross-origin fetch
        setLiveResults([]);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Find info of currently selected artist (normalized)
  const currentArtistInfo = useMemo(() => {
    if (!selectedArtist) return null;
    const canonicalTag = resolveDanbooruTag(selectedArtist);
    const found = DANBOORU_ARTISTS.find(a => a.tag.toLowerCase() === canonicalTag.toLowerCase());
    if (found) return found;
    return {
      tag: canonicalTag,
      name: canonicalTag,
      category: 'Danbooru 畫師',
      description: '自訂/檢索之 Danbooru 官方標籤'
    } as DanbooruArtist;
  }, [selectedArtist]);

  const handleSelectArtist = (rawTag: string) => {
    // Automatically normalize to exact Danbooru canonical tag
    const canonical = resolveDanbooruTag(rawTag);
    onArtistChange(canonical);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (!customTagInput.trim()) return;
    const canonical = resolveDanbooruTag(customTagInput.trim());
    handleSelectArtist(canonical);
    setCustomTagInput('');
  };

  const getSyntaxPreview = (tag: string) => {
    return format === PromptFormat.NAI ? `{artist:${tag}}` : `(by ${tag}:1.1)`;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-xl bg-slate-900 border text-left transition-all ${
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-lg bg-slate-800/90'
            : currentArtistInfo
              ? 'border-purple-500/50 bg-purple-950/20 hover:border-purple-500'
              : 'border-slate-700 hover:border-slate-600 bg-slate-900 hover:bg-slate-800/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`p-2 rounded-lg border flex items-center justify-center shrink-0 ${
            currentArtistInfo 
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' 
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <Palette size={16} />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 text-sm truncate">
                {currentArtistInfo ? currentArtistInfo.name : '指定畫師風格'}
              </span>
              {currentArtistInfo ? (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded border bg-purple-500/10 text-purple-300 border-purple-500/30 font-mono font-bold">
                  <ShieldCheck size={11} className="text-emerald-400" />
                  {getSyntaxPreview(currentArtistInfo.tag)}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded border bg-slate-800 text-slate-400 border-slate-700">
                  Danbooru 官方標籤庫
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 truncate">
              {currentArtistInfo ? (
                <>
                  Danbooru 標籤: <strong className="text-purple-300 font-mono">{currentArtistInfo.tag}</strong>
                  {currentArtistInfo.postCount ? ` (${currentArtistInfo.postCount} 篇)` : ''} · {currentArtistInfo.description}
                </>
              ) : (
                '不指定 (預設原創風格) 或從 Danbooru 精準抓取官方畫師標籤'
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400 shrink-0">
          {currentArtistInfo && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onArtistChange(null);
              }}
              className="p-1 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors"
              title="清除指定畫師"
            >
              <X size={15} />
            </span>
          )}
          <span className="text-xs text-purple-400 font-medium ml-1">
            {isOpen ? '收起' : '選擇'}
          </span>
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-h-[540px] flex flex-col">
          {/* Header & Verification Info */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Globe size={14} className="text-purple-400" />
              Danbooru 官方畫師標籤庫
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              當前語法: <span className="text-purple-400 font-bold">{format === PromptFormat.NAI ? 'NAI {artist:...}' : 'SD (by ...:1.1)'}</span>
            </div>
          </div>

          {/* Quick Notice about Danbooru tag accuracy */}
          <div className="my-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span>
              已確保精準抓取 Danbooru 官方標籤（例如 Krenz Cushart 規範標籤為 <strong className="font-mono text-white underline">krenz</strong>）
            </span>
          </div>

          {/* Search bar */}
          <div className="mb-2 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋 Danbooru 標籤或畫師名稱 (例如: krenz, wlop, shirabi, 監督)..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white font-medium shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Reset button if selected */}
          {selectedArtist && (
            <button
              type="button"
              onClick={() => {
                onArtistChange(null);
                setIsOpen(false);
              }}
              className="w-full mb-2 py-1.5 px-3 rounded-lg border border-dashed border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <X size={14} /> 取消指定畫師風格 (回復預設原創)
            </button>
          )}

          {/* Artist list scroll area */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[250px] scrollbar-thin scrollbar-thumb-slate-700">
            {/* Live Danbooru search results if queried and has matches */}
            {searchQuery && liveResults.length > 0 && (
              <div className="mb-2 p-2 rounded-lg bg-purple-950/30 border border-purple-500/30">
                <div className="text-[10px] text-purple-300 font-semibold mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Globe size={11} className="text-purple-400" /> Danbooru 即時檢索結果 (依作品數排序)
                  </span>
                  <span className="text-[10px] text-slate-500">點擊即套用官方 Tag</span>
                </div>
                <div className="space-y-1">
                  {liveResults.map((lr) => {
                    const isSelected = selectedArtist?.toLowerCase() === lr.name.toLowerCase();
                    return (
                      <button
                        key={lr.name}
                        type="button"
                        onClick={() => handleSelectArtist(lr.name)}
                        className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-purple-600/30 border-purple-500 text-white font-bold'
                            : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 hover:border-purple-500/40 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-purple-300 font-semibold">{lr.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-700">
                            {lr.post_count} 篇作品
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-purple-400">
                          {isSelected ? <Check size={13} /> : '套用'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Curated 100% verified artist list */}
            {filteredArtists.map(artist => {
              const isSelected = selectedArtist?.toLowerCase() === artist.tag.toLowerCase();
              return (
                <div
                  key={artist.tag}
                  className={`w-full p-2.5 rounded-lg border transition-all flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectArtist(artist.tag)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-slate-100">
                        {artist.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-purple-500/30 font-mono text-purple-300 font-bold shrink-0">
                        tag: {artist.tag}
                      </span>
                      {artist.postCount !== undefined && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({artist.postCount} 篇)
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {artist.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {artist.description}
                    </p>
                  </button>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleSelectArtist(artist.tag)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        isSelected 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-slate-700 hover:bg-purple-600 hover:text-white text-slate-300'
                      }`}
                    >
                      {isSelected ? '已選定' : '選擇'}
                    </button>
                    <a
                      href={`https://danbooru.donmai.us/posts?tags=${encodeURIComponent(artist.tag)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-slate-500 hover:text-purple-300 flex items-center gap-0.5"
                      title="前往 Danbooru 檢視作品"
                    >
                      Danbooru ↗
                    </a>
                  </div>
                </div>
              );
            })}

            {filteredArtists.length === 0 && liveResults.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-xs">
                {isSearchingOnline ? (
                  <div className="flex items-center justify-center gap-2 text-purple-400">
                    <Sparkles size={14} className="animate-spin" />
                    正在從 Danbooru 官方資料庫比對標籤...
                  </div>
                ) : (
                  <div>
                    <p>推薦庫中未找到符合的畫師</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      可直接在下方「手動輸入 Danbooru 標籤」套用任意標籤
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom Tag Input Bottom Bar */}
          <div className="pt-2.5 mt-2 border-t border-slate-800">
            <div className="text-[10px] font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>手動指定 Danbooru 畫師標籤 (系統將自動規範化):</span>
              <a
                href="https://danbooru.donmai.us/artists"
                target="_blank"
                rel="noreferrer"
                className="text-purple-400 hover:underline flex items-center gap-0.5 text-[10px]"
              >
                瀏覽 Danbooru 畫師庫 <ExternalLink size={10} />
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCustom()}
                placeholder="例如輸入 krenz 或 krenz_cushart"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!customTagInput.trim()}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
              >
                套用標籤
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtistSelector;
