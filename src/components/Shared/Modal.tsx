import React, { useEffect } from "react";
import ReactDOM from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black bg-opacity-80"
      onClick={onClose}
    >
      <div className="bg-gray-900 rounded-lg p-4 max-w-full max-h-full overflow-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 text-3xl hover:text-white"
          aria-label="Close modal"
        >
          &times;
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
