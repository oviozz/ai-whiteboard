"use client";

import React, { useCallback } from "react";
import { Upload, FileText, X, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  storageId?: string;
  error?: string;
};

type StudyMaterialUploaderProps = {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedTypes?: string[];
};

const DEFAULT_ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export default function StudyMaterialUploader({
  files,
  onFilesChange,
  maxFiles = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
}: StudyMaterialUploaderProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;

      const newFiles: UploadedFile[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // Check max files
        if (files.length + newFiles.length >= maxFiles) {
          toast.error(`Maximum ${maxFiles} files allowed`);
          break;
        }

        // Check file type
        if (!acceptedTypes.includes(file.type)) {
          toast.error(`${file.name}: File type not supported`);
          continue;
        }

        // Check file size
        if (file.size > maxFileSize) {
          toast.error(
            `${file.name}: File too large (max ${formatFileSize(maxFileSize)})`
          );
          continue;
        }

        // Check for duplicates
        if (files.some((f) => f.name === file.name && f.size === file.size)) {
          toast.error(`${file.name}: File already added`);
          continue;
        }

        newFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          file: file,
          status: "pending",
        });
      }

      if (newFiles.length > 0) {
        onFilesChange([...files, ...newFiles]);
      }
    },
    [files, onFilesChange, maxFiles, maxFileSize, acceptedTypes]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const removeFile = useCallback(
    (fileId: string) => {
      onFilesChange(files.filter((f) => f.id !== fileId));
    },
    [files, onFilesChange]
  );

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "uploading":
      case "processing":
        return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />;
      case "complete":
        return <Check className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50",
          files.length >= maxFiles && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => {
          if (files.length < maxFiles) {
            document.getElementById("file-upload-input")?.click();
          }
        }}
      >
        <input
          id="file-upload-input"
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={files.length >= maxFiles}
        />
        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-700">
          Drop files here or click to upload
        </p>
        <p className="text-xs text-slate-500 mt-1">
          PDF, PNG, JPG up to {formatFileSize(maxFileSize)} • Max {maxFiles}{" "}
          files
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                file.status === "error"
                  ? "bg-red-50 border-red-200"
                  : "bg-slate-50 border-slate-200"
              )}
            >
              <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(file.size)}
                  {file.error && (
                    <span className="text-red-500 ml-2">{file.error}</span>
                  )}
                </p>
              </div>
              {getStatusIcon(file.status)}
              {file.status === "pending" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
