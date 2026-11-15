"use client";

import { useRef, useState } from "react";
import { ACCEPTED_FILE_TYPES, formatBytes, kindOf } from "@/lib/files";
import { MAX_FILE_BYTES, MAX_FILES } from "@/lib/schemas";

const KIND_BADGE: Record<string, string> = { pdf: "PDF", image: "IMG", docx: "DOC", pptx: "PPT" };

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

export default function UploadDropzone({ files, onChange, onError, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!kindOf(file.name)) {
        onError(`"${file.name}" isn't supported. Use PDF, images, Word (.docx) or PowerPoint (.pptx).`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        onError(`"${file.name}" is ${formatBytes(file.size)}. The limit is 10 MB per file.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (next.length >= MAX_FILES) {
        onError(`You can add up to ${MAX_FILES} files per quiz.`);
        break;
      }
      next.push(file);
    }
    onChange(next);
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
          dragging ? "border-brand bg-brand-soft" : "border-border bg-surface hover:border-brand"
        } disabled:opacity-60`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-9 w-9 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="mt-3 font-semibold">Drop files here or tap to choose</span>
        <span className="mt-1 text-sm text-muted">PDF, photos, Word, PowerPoint · up to {MAX_FILES} files, 10 MB each</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-bold text-brand">
                {KIND_BADGE[kindOf(file.name) ?? ""] ?? "FILE"}
              </span>
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-muted">{formatBytes(file.size)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="rounded-md px-2 text-muted hover:text-danger"
                aria-label={`Remove ${file.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
