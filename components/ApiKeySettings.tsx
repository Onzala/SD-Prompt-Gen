
import React, { useState, useEffect } from 'react';
import { Key, Save, X, Eye, EyeOff, CheckCircle, ExternalLink } from 'lucide-react';

interface ApiKeySettingsProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string) => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ isOpen, onClose, onSave }) => {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            setApiKey(savedKey);
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('gemini_api_key', apiKey);
        onSave(apiKey);
        setIsSaved(true);
        setTimeout(() => {
            setIsSaved(false);
            onClose();
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl animate-float">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Key className="text-blue-400 w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Gemini API 設定</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-200/80 leading-relaxed">
                        <p className="flex items-start gap-2">
                            <span className="mt-1">●</span>
                            金鑰將僅儲存於您的瀏覽器本地 (LocalStorage)，不會上傳至任何中心化伺服器。
                        </p>
                        <p className="flex items-start gap-2 mt-2">
                            <span className="mt-1">●</span>
                            尚未取得金鑰？
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-amber-400 underline flex items-center gap-1 ml-1">
                                前往 Google AI Studio 獲取 <ExternalLink size={10} />
                            </a>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">API Key</label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all font-mono text-sm"
                                placeholder="在此貼上您的 API 金鑰..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!apiKey.trim()}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isSaved
                            ? 'bg-emerald-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                            }`}
                    >
                        {isSaved ? (
                            <>
                                <CheckCircle size={18} />
                                儲存成功
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                儲存設定
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeySettings;
