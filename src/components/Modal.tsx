import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { useVisualViewport } from '../hooks/useVisualViewport';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Ported byte-faithful from bewthr's Modal (iOS-safe body lock + drag-to-
// dismiss). The implementation comments below come from bewthr verbatim
// because the WHYs (iOS Safari fixed-position scroll capture, keyboard
// visualViewport handling) are non-obvious and load-bearing.

let openModalCount = 0;
const closeStack: Array<() => void> = [];
let savedScrollY = 0;

function lockBody() {
  savedScrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockBody() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, savedScrollY);
}

const DRAG_DISMISS_THRESHOLD = 80;

export function Modal({ open, title, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; pointerId: number } | null>(null);
  const vv = useVisualViewport();

  useEffect(() => {
    if (!modalRef.current) return;
    if (typeof window === 'undefined') return;
    if (vv.height > 0 && vv.height < window.innerHeight - 1) {
      const maxH = Math.round(vv.height * 0.85);
      const keyboardH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      modalRef.current.style.maxHeight = `${maxH}px`;
      modalRef.current.style.bottom = `${keyboardH}px`;
    } else {
      modalRef.current.style.maxHeight = '';
      modalRef.current.style.bottom = '';
    }
  }, [vv.height, vv.offsetTop]);

  useEffect(() => {
    if (!open) return;
    openModalCount++;
    if (openModalCount === 1) lockBody();
    closeStack.push(onClose);
    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      const idx = closeStack.lastIndexOf(onClose);
      if (idx !== -1) closeStack.splice(idx, 1);
      if (openModalCount === 0) unlockBody();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (closeStack[closeStack.length - 1] === onClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.style.setProperty('--drag-y', '0px');
      modalRef.current.style.removeProperty('transition');
    }
  }, [open]);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!modalRef.current) return;
    dragRef.current = { startY: e.clientY, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    modalRef.current.style.setProperty('transition', 'none');
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    if (!modalRef.current) return;
    const delta = Math.max(0, e.clientY - dragRef.current.startY);
    modalRef.current.style.setProperty('--drag-y', `${delta}px`);
  }

  function handlePointerEnd(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    if (!modalRef.current) return;
    const delta = Math.max(0, e.clientY - dragRef.current.startY);
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    modalRef.current.style.removeProperty('transition');
    if (delta >= DRAG_DISMISS_THRESHOLD) {
      onClose();
    } else {
      modalRef.current.style.setProperty('--drag-y', '0px');
    }
  }

  return (
    <>
      <div
        className={`modal-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
      />
      <div ref={modalRef} className={`modal${open ? ' open' : ''}`}>
        <div
          className="modal-drag-zone"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <div className="modal-handle" />
          <div className="modal-header">
            <div className="modal-title">{title}</div>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </>
  );
}
