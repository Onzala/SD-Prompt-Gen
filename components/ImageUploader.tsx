import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  selectedImage: string | null;
  onImageChange: (base64: string | null) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ selectedImage, onImageChange }) => {
  const [isDragging, setIsDragging] = useState(false);

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
      <div className="relative group w-full h-24 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
        <img
          src={selectedImage}
          alt="Preview"
          className="h-full w-full object-contain"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={() => onImageChange(null)}
            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full scale-75"
            title="移除圖片"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-24 border-2 border-dashed rounded-lg transition-colors duration-200 flex flex-col items-center justify-center cursor-pointer
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