"use client";

import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-lg border bg-white p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              {toast.title && (
                <h3 className="font-semibold text-gray-900">{toast.title}</h3>
              )}

              {toast.description && (
                <p className="mt-1 text-sm text-gray-600">
                  {toast.description}
                </p>
              )}
            </div>

            <button
              onClick={() => dismiss(toast.id)}
              className="text-sm text-gray-400 hover:text-gray-700"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}