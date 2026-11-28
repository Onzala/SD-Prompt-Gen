import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Images, Plus, X, ChevronRight } from 'lucide-react';
import { useEscape } from '../hooks/useEscape';
import {
  loadPoseWearCatalog, poseWearCollections, poseWearSource, referenceName,
  type PoseWearCollection, type PoseWearGroup, type PoseWearItem, type SelectedPoseWearReference,
} from '../services/posewear';

interface Props {
  selected: SelectedPoseWearReference[];
  onChange: (selected: SelectedPoseWearReference[]) => void;
  showAdult: boolean;
  onShowAdultChange: (enabled: boolean) => void;
  disabled: boolean;
  /** 只顯示這些類型（預設全部） */
  groups?: PoseWearGroup[];
  label?: string;
  hint?: string;
}

const allGroups: PoseWearGroup[] = ['姿勢', '服裝', '表情', '髮型'];
const collections = Object.keys(poseWearCollections) as PoseWearCollection[];
const pageSize = 8;

function CatalogCard({ item, alternate, disabled, onSelect }: {
  item: PoseWearItem;
  alternate?: PoseWearItem;
  disabled: boolean;
  onSelect: (item: PoseWearItem, viewIndex: number) => void;
}) {
  const [viewIndex, setViewIndex] = useState(0);
  const [showAlternate, setShowAlternate] = useState(false);
  const active = (showAlternate && alternate) || item;
  const view = active.views[viewIndex];
  function toggleAlternate() {
    if (!alternate) return;
    const next = showAlternate ? item : alternate;
    const matchingIndex = next.views.findIndex(candidate => candidate.label === view.label);
    setViewIndex(Math.max(0, matchingIndex));
    setShowAlternate(!showAlternate);
  }
  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-fg/[0.06] bg-slate-950/50">
      <a href={poseWearSource(active)} target="_blank" rel="noreferrer" aria-label={`查看「${active.title}」來源`}>
        <img src={view.thumbnailUrl} alt={active.title} loading="lazy" referrerPolicy="no-referrer"
          className="aspect-[4/3] w-full bg-slate-900 object-contain" />
      </a>
      <div className="space-y-2 p-2.5">
        <p className="text-xs font-medium text-slate-200" title={active.description}>{active.title}</p>
        {active.category && <p className="text-[11px] text-slate-500">{active.category}</p>}
        {alternate && (
          <button type="button" onClick={toggleAlternate} disabled={disabled}
            className="text-[11px] text-violet-300 underline disabled:opacity-50">
            切換至{poseWearCollections[showAlternate ? item.collection : alternate.collection].label}
          </button>
        )}
        {active.views.length > 1 && (
          <select value={viewIndex} onChange={e => setViewIndex(Number(e.target.value))}
            aria-label={`${active.title}的視角或變體`} disabled={disabled}
            className="w-full rounded border border-fg/[0.08] bg-slate-900 px-1.5 py-1 text-xs">
            {active.views.map((variant, index) => (
              <option key={variant.imageUrl + index} value={index}>{variant.label || `變體 ${index + 1}`}</option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => onSelect(active, viewIndex)} disabled={disabled}
          className="flex w-full items-center justify-center gap-1 rounded bg-violet-500/15 px-2 py-1.5 text-xs text-violet-200 hover:bg-violet-500/25 disabled:opacity-50">
          <Plus size={13} /> 加入參考
        </button>
      </div>
    </article>
  );
}

export default function PoseWearLibrary({
  selected, onChange, showAdult, onShowAdultChange, disabled,
  groups = allGroups, label = '參考素材庫', hint = '姿勢、服裝、表情、髮型',
}: Props) {
  const [items, setItems] = useState<PoseWearItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [group, setGroup] = useState<PoseWearGroup>(groups[0]);
  const [collection, setCollection] = useState<PoseWearCollection | ''>('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  useEscape(isOpen, () => setIsOpen(false));

  async function openCatalog() {
    if (items || loading) return;
    setLoading(true);
    setError(false);
    try {
      setItems(await loadPoseWearCatalog());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return items?.filter(item => {
      if (poseWearCollections[item.collection].group !== group || (collection && item.collection !== collection)) return false;
      if (item.adult && !showAdult) return false;
      if (!terms.length) return true;
      const searchable = [item.title, item.category, item.description, item.prompt, item.keywords, item.id, item.sourceText]
        .concat(item.views.map(view => [view.label, view.description].filter(Boolean).join(' ')))
        .join(' ').toLowerCase();
      return terms.every(term => searchable.includes(term));
    }) ?? [];
  }, [items, group, collection, query, showAdult]);
  const posePairs = useMemo(() => new Map(items?.filter(item =>
    (item.collection === 'pose' || item.collection === 'depth') && (showAdult || !item.adult),
  ).map(item => [`${item.collection}/${item.id}`, item])), [items, showAdult]);

  function addReference(item: PoseWearItem, viewIndex: number) {
    const reference = {
      id: item.id,
      collection: item.collection,
      title: item.title,
      adult: item.adult,
      prompt: item.prompt,
      view: item.views[viewIndex],
    };
    onChange([...selected.filter(entry => poseWearCollections[entry.reference.collection].group !== group), { reference }]);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const groupCollections = collections.filter(id => poseWearCollections[id].group === group);

  return (
    <section aria-label="參考素材庫">
      <div className="field-label">
        <span>{label}</span>
        {selected.length > 0 && <span className="text-violet-300">已選 {selected.length} 項</span>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setIsOpen(true); void openCatalog(); }}
        aria-haspopup="dialog"
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-fg/[0.08] bg-slate-950/50 px-3 text-left transition-all hover:border-fg/15 hover:bg-fg/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Images size={16} className="shrink-0 text-violet-400" />
        <span className="min-w-0 flex-1 truncate text-sm text-slate-400">{hint}</span>
        <ChevronRight size={16} className="shrink-0 text-slate-400" />
      </button>
      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) setIsOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="參考素材庫"
            className="flex max-h-[85vh] w-full max-w-3xl animate-pop-in flex-col overflow-hidden rounded-2xl border border-fg/[0.08] bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-fg/[0.06] px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Images size={16} className="text-violet-400" /> 參考素材庫
                {selected.length > 0 && <span className="chip border-violet-500/30 bg-violet-500/10 text-violet-200">已選 {selected.length} 項</span>}
              </h3>
              <button type="button" onClick={() => setIsOpen(false)} className="btn-primary h-8 px-4">完成</button>
            </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5" aria-label="素材類型">
              {groups.length > 1 && groups.map(option => (
                <button key={option} type="button" aria-pressed={group === option}
                  onClick={() => { setGroup(option); setCollection(''); setPage(0); }}
                  className={`rounded-md border px-2.5 py-1 text-xs ${group === option ? 'border-violet-500/50 bg-violet-500/20 text-violet-200' : 'border-fg/[0.08] text-slate-400 hover:text-fg'}`}>
                  {option}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" checked={showAdult} disabled={disabled} onChange={e => {
                const enabled = e.target.checked;
                if (enabled && !window.confirm('此選項會顯示原站標記為 18+ 的參考素材。請確認你已滿 18 歲。')) return;
                onShowAdultChange(enabled);
                setPage(0);
              }} /> 顯示 18+ 素材
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="search" aria-label="搜尋素材" placeholder="搜尋名稱、描述或編號"
              value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}
              className="min-w-36 flex-1 rounded-lg border border-fg/[0.08] bg-slate-950/60 px-2.5 py-2 text-xs focus:border-violet-500/60 focus:outline-none" />
            {groupCollections.length > 1 && (
              <select aria-label="素材子庫" value={collection} onChange={e => {
                setCollection(e.target.value as PoseWearCollection | '');
                setPage(0);
              }} className="rounded-lg border border-fg/[0.08] bg-slate-950 px-2 py-2 text-xs">
                <option value="">所有子庫</option>
                {groupCollections.map(id => <option key={id} value={id}>{poseWearCollections[id].label}</option>)}
              </select>
            )}
          </div>
          {loading && <p role="status" className="text-xs text-slate-400">正在讀取素材目錄…</p>}
          {error && <button type="button" onClick={openCatalog} className="text-xs text-amber-300 underline">目錄載入失敗，重試</button>}
          {items && (
            <>
              <p role="status" className="text-xs text-slate-400">共 {filtered.length.toLocaleString('zh-TW')} 筆</p>
              <div key={`${group}/${collection}/${query}/${currentPage}/${showAdult}`}
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(item => (
                  <CatalogCard key={`${item.collection}/${item.id}`} item={item}
                    alternate={group === '姿勢' ? posePairs.get(`${item.collection === 'pose' ? 'depth' : 'pose'}/${item.id}`) : undefined}
                    disabled={disabled} onSelect={addReference} />
                ))}
              </div>
              {pageCount > 1 && (
                <nav aria-label="素材分頁" className="flex items-center justify-between text-xs text-slate-400">
                  <button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}
                    className="rounded border border-fg/[0.08] px-2 py-1 disabled:opacity-30">上一頁</button>
                  <span>{currentPage + 1} / {pageCount}</span>
                  <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}
                    className="rounded border border-fg/[0.08] px-2 py-1 disabled:opacity-30">下一頁</button>
                </nav>
              )}
            </>
          )}
          <p className="text-[11px] text-slate-500">
            素材目錄來自 <a href="https://posewear.pages.dev/" target="_blank" rel="noreferrer" className="underline">PoseWear</a>
            {' · '}<a href="https://github.com/atuizz/posewear/blob/main/README.en.md#sources-and-licenses"
              target="_blank" rel="noreferrer" className="underline">原作者與素材授權</a>
          </p>
        </div>
          </div>
        </div>,
        document.body,
      )}
      {selected.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-slate-500">生成時會把各項圖片及描述一併送交 Gemini。</p>
          {selected.map(({ reference, replacement }, index) => {
            const name = referenceName(reference);
            const updateFile = (file?: File) => onChange(selected.map((entry, i) =>
              i === index ? { reference, replacement: file } : entry,
            ));
            return (
              <div key={`${reference.collection}/${reference.id}`} className="rounded-lg border border-fg/[0.06] bg-slate-950/50 p-2">
                <div className="flex items-start gap-2">
                  <img src={reference.view.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
                    className="h-10 w-10 shrink-0 rounded bg-slate-900 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-200">{poseWearCollections[reference.collection].label} · {name}</p>
                    <p className="mt-0.5 break-words text-[11px] text-slate-400">
                      {[reference.prompt, reference.view.description].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <a href={reference.view.imageUrl} target="_blank" rel="noreferrer"
                    aria-label={`開啟「${name}」來源圖片`} className="text-slate-400 hover:text-fg"><ExternalLink size={14} /></a>
                  <button type="button" disabled={disabled} onClick={() => onChange(selected.filter((_, i) => i !== index))}
                    aria-label={`移除「${name}」`} className="text-slate-400 hover:text-fg disabled:opacity-40"><X size={15} /></button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <label className="cursor-pointer text-violet-300 underline">
                    手動附圖
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
                      aria-label={`手動附上「${name}」的圖片`} className="sr-only" onChange={e => {
                        const file = e.currentTarget.files?.[0];
                        e.currentTarget.value = '';
                        if (file) updateFile(file);
                      }} />
                  </label>
                  {replacement && (
                    <>
                      <span className="break-all">{replacement.name}</span>
                      <button type="button" disabled={disabled} onClick={() => updateFile()} className="underline">改用來源圖片</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
