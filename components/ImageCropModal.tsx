import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, Maximize } from 'lucide-react';

interface ImageCropModalProps {
  /** 要裁切的原始圖片 base64 */
  imageSrc: string;
  /** 裁切完成後回傳裁切後的 base64 */
  onCropComplete: (croppedBase64: string) => void;
  /** 關閉 Modal */
  onClose: () => void;
}

/** 裁切選取框的座標與尺寸 (相對於顯示區域) */
interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 拖曳操作的類型 */
type DragMode = 'none' | 'draw' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

const HANDLE_SIZE = 10; // 角落拖曳控制點大小

const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageSrc, onCropComplete, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // 顯示區域中的圖片繪製資訊
  const [imageDrawInfo, setImageDrawInfo] = useState<{
    drawX: number;
    drawY: number;
    drawWidth: number;
    drawHeight: number;
  } | null>(null);

  // 裁切選取框 (相對於 canvas)
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragStartRect, setDragStartRect] = useState<CropRect | null>(null);

  /** 載入圖片並計算適配繪製資訊 */
  const loadImage = useCallback(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      updateCanvasSize(img);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  /** 根據容器大小更新 canvas 尺寸並計算圖片繪製區域 */
  const updateCanvasSize = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // 設定 canvas 實際像素大小
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // 計算圖片在 canvas 中的繪製位置 (物件適配 contain)
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = containerWidth / containerHeight;

    let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

    if (imgAspect > canvasAspect) {
      // 圖片較寬，以寬度為準
      drawWidth = containerWidth;
      drawHeight = containerWidth / imgAspect;
      drawX = 0;
      drawY = (containerHeight - drawHeight) / 2;
    } else {
      // 圖片較高，以高度為準
      drawHeight = containerHeight;
      drawWidth = containerHeight * imgAspect;
      drawX = (containerWidth - drawWidth) / 2;
      drawY = 0;
    }

    const info = { drawX, drawY, drawWidth, drawHeight };
    setImageDrawInfo(info);

    // 預設選取全圖
    setCropRect({
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    });
  }, []);

  /** 繪製 canvas 內容 */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    if (!canvas || !ctx || !img || !imageDrawInfo) return;

    // 清除畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製圖片
    ctx.drawImage(img, imageDrawInfo.drawX, imageDrawInfo.drawY, imageDrawInfo.drawWidth, imageDrawInfo.drawHeight);

    if (cropRect) {
      // 繪製半透明遮罩 (裁切區域外)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';

      // 上方
      ctx.fillRect(0, 0, canvas.width, cropRect.y);
      // 下方
      ctx.fillRect(0, cropRect.y + cropRect.height, canvas.width, canvas.height - cropRect.y - cropRect.height);
      // 左方
      ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.height);
      // 右方
      ctx.fillRect(cropRect.x + cropRect.width, cropRect.y, canvas.width - cropRect.x - cropRect.width, cropRect.height);

      // 繪製選取框邊界
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);

      // 繪製三分線 (九宮格輔助線)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      const thirdW = cropRect.width / 3;
      const thirdH = cropRect.height / 3;
      for (let i = 1; i <= 2; i++) {
        // 垂直線
        ctx.beginPath();
        ctx.moveTo(cropRect.x + thirdW * i, cropRect.y);
        ctx.lineTo(cropRect.x + thirdW * i, cropRect.y + cropRect.height);
        ctx.stroke();
        // 水平線
        ctx.beginPath();
        ctx.moveTo(cropRect.x, cropRect.y + thirdH * i);
        ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + thirdH * i);
        ctx.stroke();
      }

      // 繪製四角拖曳控制點
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      const corners = [
        { x: cropRect.x, y: cropRect.y },                                          // 左上
        { x: cropRect.x + cropRect.width, y: cropRect.y },                         // 右上
        { x: cropRect.x, y: cropRect.y + cropRect.height },                        // 左下
        { x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height },       // 右下
      ];
      corners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
  }, [cropRect, imageDrawInfo]);

  // 初始載入圖片
  useEffect(() => {
    loadImage();
  }, [loadImage]);

  // 監聽視窗大小變化
  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current) {
        updateCanvasSize(imageRef.current);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateCanvasSize]);

  // 當裁切框或圖片資訊變化時重新繪製
  useEffect(() => {
    draw();
  }, [draw]);

  /** 取得滑鼠在 canvas 上的座標 */
  const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  /** 判斷滑鼠位置對應的拖曳模式 */
  const getDragMode = (pos: { x: number; y: number }): DragMode => {
    if (!cropRect) return 'draw';

    const { x, y, width, height } = cropRect;
    const tolerance = HANDLE_SIZE + 4;

    // 檢查四角
    if (Math.abs(pos.x - x) < tolerance && Math.abs(pos.y - y) < tolerance) return 'resize-nw';
    if (Math.abs(pos.x - (x + width)) < tolerance && Math.abs(pos.y - y) < tolerance) return 'resize-ne';
    if (Math.abs(pos.x - x) < tolerance && Math.abs(pos.y - (y + height)) < tolerance) return 'resize-sw';
    if (Math.abs(pos.x - (x + width)) < tolerance && Math.abs(pos.y - (y + height)) < tolerance) return 'resize-se';

    // 檢查是否在選取框內部
    if (pos.x >= x && pos.x <= x + width && pos.y >= y && pos.y <= y + height) return 'move';

    // 其他情況：重新繪製選取框
    return 'draw';
  };

  /** 更新滑鼠游標樣式 */
  const updateCursor = (pos: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mode = getDragMode(pos);
    switch (mode) {
      case 'resize-nw':
      case 'resize-se':
        canvas.style.cursor = 'nwse-resize';
        break;
      case 'resize-ne':
      case 'resize-sw':
        canvas.style.cursor = 'nesw-resize';
        break;
      case 'move':
        canvas.style.cursor = 'move';
        break;
      default:
        canvas.style.cursor = 'crosshair';
    }
  };

  /** 限制裁切框在圖片範圍內 */
  const clampRect = (rect: CropRect): CropRect => {
    if (!imageDrawInfo) return rect;
    const { drawX, drawY, drawWidth, drawHeight } = imageDrawInfo;

    let { x, y, width, height } = rect;

    // 確保最小尺寸
    const minSize = 20;
    width = Math.max(width, minSize);
    height = Math.max(height, minSize);

    // 限制在圖片範圍內
    x = Math.max(drawX, Math.min(x, drawX + drawWidth - width));
    y = Math.max(drawY, Math.min(y, drawY + drawHeight - height));
    width = Math.min(width, drawX + drawWidth - x);
    height = Math.min(height, drawY + drawHeight - y);

    return { x, y, width, height };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const mode = getDragMode(pos);

    setDragMode(mode);
    setDragStart(pos);
    setDragStartRect(cropRect ? { ...cropRect } : null);

    if (mode === 'draw') {
      // 重新繪製選取框
      setCropRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    if (dragMode === 'none') {
      updateCursor(pos);
      return;
    }

    if (!dragStart || !imageDrawInfo) return;

    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    if (dragMode === 'draw') {
      // 繪製新選取框
      const { drawX, drawY, drawWidth, drawHeight } = imageDrawInfo;
      const startX = Math.max(drawX, Math.min(dragStart.x, drawX + drawWidth));
      const startY = Math.max(drawY, Math.min(dragStart.y, drawY + drawHeight));
      const endX = Math.max(drawX, Math.min(pos.x, drawX + drawWidth));
      const endY = Math.max(drawY, Math.min(pos.y, drawY + drawHeight));

      setCropRect({
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      });
    } else if (dragMode === 'move' && dragStartRect) {
      // 移動選取框
      setCropRect(clampRect({
        x: dragStartRect.x + dx,
        y: dragStartRect.y + dy,
        width: dragStartRect.width,
        height: dragStartRect.height,
      }));
    } else if (dragStartRect) {
      // 縮放選取框
      let { x, y, width, height } = dragStartRect;

      switch (dragMode) {
        case 'resize-nw':
          x += dx;
          y += dy;
          width -= dx;
          height -= dy;
          break;
        case 'resize-ne':
          y += dy;
          width += dx;
          height -= dy;
          break;
        case 'resize-sw':
          x += dx;
          width -= dx;
          height += dy;
          break;
        case 'resize-se':
          width += dx;
          height += dy;
          break;
      }

      // 防止反轉
      if (width < 20) width = 20;
      if (height < 20) height = 20;

      setCropRect(clampRect({ x, y, width, height }));
    }
  };

  const handleMouseUp = () => {
    setDragMode('none');
    setDragStart(null);
    setDragStartRect(null);
  };

  /** 重設為全圖 */
  const handleReset = () => {
    if (imageDrawInfo) {
      setCropRect({
        x: imageDrawInfo.drawX,
        y: imageDrawInfo.drawY,
        width: imageDrawInfo.drawWidth,
        height: imageDrawInfo.drawHeight,
      });
    }
  };

  /** 確認裁切 — 將選取區域繪製到離屏 Canvas 並輸出 base64 */
  const handleConfirm = () => {
    const img = imageRef.current;
    if (!img || !cropRect || !imageDrawInfo) return;

    const { drawX, drawY, drawWidth, drawHeight } = imageDrawInfo;

    // 將 canvas 座標轉換為原圖像素座標
    const scaleX = img.naturalWidth / drawWidth;
    const scaleY = img.naturalHeight / drawHeight;

    const srcX = (cropRect.x - drawX) * scaleX;
    const srcY = (cropRect.y - drawY) * scaleY;
    const srcW = cropRect.width * scaleX;
    const srcH = cropRect.height * scaleY;

    // 建立離屏 Canvas 進行裁切
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(srcW);
    offscreen.height = Math.round(srcH);
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      img,
      Math.round(srcX), Math.round(srcY), Math.round(srcW), Math.round(srcH),
      0, 0, Math.round(srcW), Math.round(srcH)
    );

    // 輸出為 base64
    const croppedBase64 = offscreen.toDataURL('image/png');
    onCropComplete(croppedBase64);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal 主體 */}
      <div className="relative z-[101] w-[90vw] max-w-3xl glass-panel rounded-3xl border border-white/10 overflow-hidden flex flex-col animate-crop-modal-in">
        {/* 標題列 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Maximize size={18} className="text-blue-400" />
            圖片裁切
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="關閉"
          >
            <X size={18} />
          </button>
        </div>

        {/* Canvas 裁切區域 */}
        <div
          ref={containerRef}
          className="relative w-full bg-slate-950/80"
          style={{ height: '60vh' }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* 操作列 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
              title="重設為全圖"
            >
              <RotateCcw size={14} />
              重設
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-95"
            >
              <Check size={16} />
              確認裁切
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
