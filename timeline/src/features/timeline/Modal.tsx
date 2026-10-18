import { useEffect, useRef, type ReactNode } from "react";
export default function Modal({
  title,
  children,
  onClose,
  closeOnEscape = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeOnEscape?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="tl-modal tl"
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        // File inputs also dispatch a bubbling cancel event when the picker
        // is dismissed. It must never close the surrounding dialog.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (closeOnEscape) close.current();
      }}
    >
      <header className="tl-row">
        <h2>{title}</h2>
        <button
          type="button"
          className="tl-icon"
          aria-label="ปิด"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
