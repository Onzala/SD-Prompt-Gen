import React, { useMemo, useState } from 'react';
import { ShieldAlert, X, Trash2 } from 'lucide-react';
import { loadModerationStats, clearModerationStats, ModerationOutcome } from '../services/moderationStats';

interface ModerationStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Scope = 'image' | 'text' | 'all';

const SCOPE_LABELS: Record<Scope, string> = {
  image: '讀圖',
  text: '純文字',
  all: '全部',
};

const ModerationStatsModal: React.FC<ModerationStatsModalProps> = ({ isOpen, onClose }) => {
  const [scope, setScope] = useState<Scope>('image');
  const [version, setVersion] = useState(0);

  const rows = useMemo(() => {
    if (!isOpen) return [];
    const stats = Object.values(loadModerationStats());
    return stats
      .map((s) => {
        const pick = (k: ModerationOutcome) =>
          scope === 'all' ? s.image[k] + s.text[k] : s[scope][k];
        const ok = pick('ok');
        const blocked = pick('blocked');
        const refused = pick('refused');
        const empty = pick('empty');
        const total = ok + blocked + refused + empty;
        const censored = blocked + refused + empty;
        return {
          model: s.model,
          total,
          ok,
          blocked,
          refused,
          empty,
          rate: total ? censored / total : 0,
          lastBlockReason: s.lastBlockReason,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.rate - a.rate || b.total - a.total);
    // version 只用來在清除後重新計算
  }, [isOpen, scope, version]);

  if (!isOpen) return null;

  const rateColor = (rate: number) =>
    rate >= 0.5 ? 'text-red-400' : rate >= 0.2 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <ShieldAlert size={16} className="text-red-400" />
            各模型審查統計
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1.5">
          {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                scope === s
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            目前還沒有{scope === 'all' ? '' : `「${SCOPE_LABELS[scope]}」`}的紀錄。每次生成提示詞都會自動記錄。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left font-medium py-2 pr-2">模型</th>
                  <th className="text-right font-medium py-2 px-2">次數</th>
                  <th className="text-right font-medium py-2 px-2">成功</th>
                  <th className="text-right font-medium py-2 px-2" title="被 API 安全過濾攔截">攔截</th>
                  <th className="text-right font-medium py-2 px-2" title="模型自己回答「無法協助」之類">拒答</th>
                  <th className="text-right font-medium py-2 px-2" title="沒標記攔截但回傳空白">空白</th>
                  <th className="text-right font-medium py-2 pl-2">審查率</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.model} className="border-b border-slate-800/60 text-slate-300">
                    <td className="py-2 pr-2 font-mono text-[11px]" title={r.lastBlockReason ? `最近攔截原因：${r.lastBlockReason}` : undefined}>
                      {r.model}
                    </td>
                    <td className="text-right py-2 px-2">{r.total}</td>
                    <td className="text-right py-2 px-2 text-emerald-300">{r.ok}</td>
                    <td className="text-right py-2 px-2">{r.blocked}</td>
                    <td className="text-right py-2 px-2">{r.refused}</td>
                    <td className="text-right py-2 px-2">{r.empty}</td>
                    <td className={`text-right py-2 pl-2 font-bold ${rateColor(r.rate)}`}>
                      {Math.round(r.rate * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            依審查率由高到低排序。統計只存在這台裝置的瀏覽器；「拒答」是用回答開頭判斷，可能有少量誤判。
          </p>
          <button
            type="button"
            onClick={() => {
              if (confirm('確定要清除所有審查統計嗎？')) {
                clearModerationStats();
                setVersion((v) => v + 1);
              }
            }}
            className="shrink-0 flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-red-300 hover:border-red-500/40"
          >
            <Trash2 size={12} /> 清除統計
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModerationStatsModal;
