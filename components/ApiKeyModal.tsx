import React, { useState, useEffect } from 'react';
import { KeyRound, X, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  currentKey: string;
  onSave: (key: string) => void;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, currentKey, onSave, onClose }) => {
  const [value, setValue] = useState(currentKey);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) setValue(currentKey);
  }, [isOpen, currentKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <KeyRound size={16} className="text-amber-400" />
            設定 Gemini API 金鑰
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          金鑰只會儲存在您這台裝置的瀏覽器（localStorage），並直接傳送給 Google Gemini API，不會經過任何第三方伺服器。
        </p>

        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave(value.trim())}
            placeholder="AIza..."
            autoFocus
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500/60"
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
            title={visible ? '隱藏' : '顯示'}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          到 Google AI Studio 取得金鑰 <ExternalLink size={12} />
        </a>

        <div className="flex justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSave('')}
            disabled={!currentKey}
            className="px-3 py-2 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-red-300 hover:border-red-500/40 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:border-slate-700"
          >
            清除金鑰
          </button>
          <button
            type="button"
            onClick={() => onSave(value.trim())}
            disabled={!value.trim()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-800 disabled:text-slate-600"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
