import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEscape } from '../hooks/useEscape';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** 面板最小寬度（px），預設與觸發按鈕同寬 */
  minWidth?: number;
  /** 面板理想高度上限（px） */
  maxHeight?: number;
  label: string;
  children: React.ReactNode;
}

const GAP = 6;
const MARGIN = 8;
const MOBILE_QUERY = '(max-width: 639px)';

/**
 * 浮在所有內容最上層的懸浮面板（掛在 document.body）。
 * 桌面版貼著觸發按鈕顯示，下方空間不夠時自動往上翻；手機版改成底部彈出面板。
 */
const Popover: React.FC<PopoverProps> = ({ open, onClose, anchorRef, minWidth = 0, maxHeight = 440, label, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEscape(open, onClose);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // 依觸發按鈕位置計算面板位置
  useLayoutEffect(() => {
    if (!open || isMobile) return;
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(rect.width, minWidth), vw - MARGIN * 2);
      const left = Math.min(Math.max(rect.left, MARGIN), vw - width - MARGIN);
      const below = vh - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const openUp = below < Math.min(maxHeight, 320) && above > below;
      const height = Math.min(maxHeight, openUp ? above : below);
      setStyle(openUp
        ? { left, width, bottom: vh - rect.top + GAP, maxHeight: height }
        : { left, width, top: rect.bottom + GAP, maxHeight: height });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, isMobile, anchorRef, minWidth, maxHeight]);

  // 點面板與觸發按鈕以外的地方就關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <>
      {isMobile && <div className="fixed inset-0 z-50 animate-fade-in bg-black/50 backdrop-blur-sm" aria-hidden="true" />}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={label}
        style={isMobile ? undefined : style}
        className={`fixed z-50 flex animate-pop-in flex-col overflow-hidden border border-fg/[0.08] bg-slate-900 shadow-2xl ${
          isMobile ? 'inset-x-2 bottom-2 max-h-[80vh] rounded-2xl' : 'rounded-xl'
        }`}
      >
        {children}
      </div>
    </>,
    document.body,
  );
};

export default Popover;
