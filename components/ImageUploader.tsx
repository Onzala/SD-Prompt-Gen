import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Crop } from 'lucide-react';
import ImageCropModal from './ImageCropModal';

interface ImageUploaderProps {
  selectedImage: string | null;
  onImageChange: (base64: string | null) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ selectedImage, onImageChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  /** 儲存原始全圖 base64，裁切時從此來源重新操作 */
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  /** 是否開啟裁切 Modal */
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // 當外部清除圖片時，也清除內部的原始圖片記錄
  useEffect(() => {
    if (!selectedImage) {
      setOriginalImage(null);
    }
  }, [selectedImage]);

  // 讀取檔案並轉為 base64 的共用邏輯
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // 記錄原始全圖
      setOriginalImage(base64);
      // 預設全圖導入
      onImageChange(base64);
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
  };

  // 處理剪貼簿貼上
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

  /** 裁切完成的回呼 */
  const handleCropComplete = (croppedBase64: string) => {
    onImageChange(croppedBase64);
    setIsCropModalOpen(false);
  };

  // 已有圖片時：顯示預覽 + 裁切/刪除操作
  if (selectedImage) {
    return (
      <>
        <div className="relative group w-full h-full min-h-[200px] bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
          <img
            src={selectedImage}
            alt="Preview"
            className="h-full w-full object-contain"
          />
          {/* 滑入時顯示的操作遮罩 */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            {/* 裁切按鈕 */}
            <button
              onClick={() => setIsCropModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full scale-75 transition-all hover:scale-90 shadow-lg shadow-blue-500/30"
              title="裁切圖片"
            >
              <Crop size={20} />
            </button>
            {/* 移除按鈕 */}
            <button
              onClick={() => onImageChange(null)}
              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full scale-75 transition-all hover:scale-90 shadow-lg shadow-red-500/30"
              title="移除圖片"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 裁切 Modal */}
        {isCropModalOpen && (originalImage || selectedImage) && (
          <ImageCropModal
            imageSrc={originalImage || selectedImage}
            onCropComplete={handleCropComplete}
            onClose={() => setIsCropModalOpen(false)}
          />
        )}
      </>
    );
  }

  // 尚未上傳：拖放區域
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-full min-h-[200px] border-2 border-dashed rounded-lg transition-colors duration-200 flex flex-col items-center justify-center cursor-pointer
        ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'}
      `}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center text-slate-400 pointer-events-none">
        <div className="p-1.5 bg-slate-800 rounded-full mb-1">
          <ImageIcon size={18} />
        </div>
        <p className="text-xs text-center leading-tight">
          <span className="font-semibold text-blue-400">點擊</span>/拖放/貼上圖片
        </p>
      </div>
    </div>
  );
};

export default ImageUploader;