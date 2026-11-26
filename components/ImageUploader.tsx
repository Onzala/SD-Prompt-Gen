import React, { useState, useEffect } from 'react';
import { X, ImagePlus, Crop } from 'lucide-react';
import ImageCropperModal from './ImageCropperModal';

interface ImageUploaderProps {
  selectedImage: string | null;
  onImageChange: (base64: string | null) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ selectedImage, onImageChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isCropOpen, setIsCropOpen] = useState(false);

  // Helper to read file as base64
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      onImageChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  // Handle Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
            e.preventDefault();
            processFile(file);
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedImage) {
    return (
      <>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-slate-950/50 p-2">
          <img
            src={selectedImage}
            alt="參考圖片預覽"
            className="h-16 w-16 shrink-0 rounded-lg bg-slate-900 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-200">已附上參考圖片</p>
            <p className="text-[11px] text-slate-500">生成時 AI 會解析構圖、色彩與角色特徵</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setIsCropOpen(true)} className="icon-btn h-8 w-8" title="裁切圖片" aria-label="裁切圖片">
              <Crop size={14} />
            </button>
            <button type="button" onClick={() => onImageChange(null)}
              className="icon-btn h-8 w-8 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300" title="移除圖片" aria-label="移除圖片">
              <X size={15} />
            </button>
          </div>
        </div>
        <ImageCropperModal
          isOpen={isCropOpen}
          imageSrc={selectedImage}
          onClose={() => setIsCropOpen(false)}
          onCropComplete={(cropped) => {
            onImageChange(cropped);
            setIsCropOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 transition-colors focus-within:ring-2 focus-within:ring-violet-400/60 ${
        isDragging
          ? 'border-violet-400 bg-violet-500/10'
          : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
      }`}
    >
      <input type="file" accept="image/*" onChange={handleFileInput} className="sr-only" />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-400">
        <ImagePlus size={17} />
      </span>
      <span className="min-w-0 text-xs text-slate-400">
        <span className="font-medium text-violet-300">選擇圖片</span>、拖放或直接貼上（Ctrl+V）
        <span className="block text-[11px] text-slate-500">附上參考圖，讓 AI 反推提示詞</span>
      </span>
    </label>
  );
};

export default ImageUploader;
