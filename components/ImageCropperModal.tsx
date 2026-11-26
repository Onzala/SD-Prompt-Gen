import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check } from 'lucide-react';
import { useEscape } from '../hooks/useEscape';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ isOpen, imageSrc, onClose, onCropComplete }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  useEscape(isOpen, onClose);

  if (!isOpen) return null;

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Default crop to center 90%
    setCrop(centerAspectCrop(width, height, 1));
  };

  const handleSave = async () => {
    if (completedCrop && imgRef.current) {
      const canvas = document.createElement('canvas');
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      
      canvas.width = completedCrop.width;
      canvas.height = completedCrop.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      );

      const base64Image = canvas.toDataURL('image/jpeg');
      onCropComplete(base64Image);
    } else {
      // If no crop was made, just return the original
      onCropComplete(imageSrc);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="裁切圖片" onClick={(e) => e.stopPropagation()} className="card flex w-full max-w-2xl animate-pop-in flex-col overflow-hidden bg-slate-900">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-100">裁切圖片</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="關閉">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 flex-1 flex items-center justify-center bg-slate-950/60 min-h-[300px] overflow-hidden">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            className="max-h-[60vh] max-w-full flex justify-center"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop me"
              onLoad={onImageLoad}
              className="max-h-[60vh] max-w-full object-contain"
            />
          </ReactCrop>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
          <button type="button" onClick={onClose} className="btn-ghost h-9 px-4">
            取消
          </button>
          <button type="button" onClick={handleSave} className="btn-primary h-9 px-4">
            <Check size={16} />
            確認裁切
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
