"use client";

import React, { useCallback, useState, useRef } from "react";
import { Upload, File, X, FileText, Image as ImageIcon, Presentation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploadedFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  progress: number;
  storageId?: string;
  error?: string;
};

type StudyMaterialUploaderProps = {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  disabled?: boolean;
  className?: string;
};

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  "application/pdf": <FileText className="w-5 h-5 text-red-500" />,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": <Presentation className="w-5 h-5 text-orange-500" />,
  "application/vnd.ms-powerpoint": <Presentation className="w-5 h-5 text-orange-500" />,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": <FileText className="w-5 h-5 text-blue-500" />,
  "application/msword": <FileText className="w-5 h-5 text-blue-500" />,
  "image/png": <ImageIcon className="w-5 h-5 text-green-500" />,
  "image/jpeg": <ImageIcon className="w-5 h-5 text-green-500" />,
  "image/webp": <ImageIcon className="w-5 h-5 text-green-500" />,
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(type: string): React.ReactNode {
  return FILE_TYPE_ICONS[type] || <File className="w-5 h-5 text-slate-500" />;
}

export default function StudyMaterialUploader({
  files,
  onFilesChange,
  maxFiles = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  disabled = false,
  className,
}: StudyMaterialUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      const acceptedTypes = Object.keys(ACCEPTED_FILE_TYPES);
      if (!acceptedTypes.includes(file.type)) {
        return `File type "${file.type || "unknown"}" is not supported`;
      }

      // Check file size
      if (file.size > maxFileSize) {
        return `File size exceeds ${formatFileSize(maxFileSize)} limit`;
      }

      return null;
    },
    [maxFileSize]
  );

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const remainingSlots = maxFiles - files.length;

      if (remainingSlots <= 0) {
        return;
      }

      const filesToAdd = fileArray.slice(0, remainingSlots);
      const newUploadedFiles: UploadedFile[] = [];

      filesToAdd.forEach((file) => {
        const error = validateFile(file);
        newUploadedFiles.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: error ? "error" : "pending",
          progress: 0,
          error: error || undefined,
        });
      });

      onFilesChange([...files, ...newUploadedFiles]);
    },
    [files, maxFiles, onFilesChange, validateFile]
  );

  const removeFile = useCallback(
    (fileId: string) => {
      onFilesChange(files.filter((f) => f.id !== fileId));
    },
    [files, onFilesChange]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    },
    [disabled, addFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        addFiles(selectedFiles);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFiles]
  );

  const handleBrowseClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const acceptString = Object.entries(ACCEPTED_FILE_TYPES)
    .flatMap(([mime, exts]) => [mime, ...exts])
    .join(",");

  const canAddMore = files.length < maxFiles;

  return (
    <div className={cn("w-full", className)}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer",
          "flex flex-col items-center justify-center text-center",
          isDragOver && !disabled
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 hover:border-slate-400 bg-slate-50",
          disabled && "opacity-50 cursor-not-allowed",
          !canAddMore && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptString}
          onChange={handleFileInputChange}
          disabled={disabled || !canAddMore}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-slate-100 border border-slate-200">
            <Upload className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              {canAddMore ? "Drop files here or click to browse" : "Maximum files reached"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              PDF, PPTX, DOCX, or Images (max {formatFileSize(maxFileSize)} each)
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Uploaded Files ({files.length}/{maxFiles})
          </p>
          <div className="space-y-2">
            {files.map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border-2",
                  uploadedFile.status === "error"
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-white"
                )}
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(uploadedFile.type)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(uploadedFile.size)}
                    {uploadedFile.status === "error" && uploadedFile.error && (
                      <span className="text-red-500 ml-2">• {uploadedFile.error}</span>
                    )}
                  </p>
                </div>

                {/* Status / Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {uploadedFile.status === "uploading" || uploadedFile.status === "processing" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(uploadedFile.id);
                      }}
                      className="p-1 rounded hover:bg-slate-100 transition-colors"
                      aria-label={`Remove ${uploadedFile.name}`}
                    >
                      <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <p className="mt-3 text-xs text-slate-400 text-center">
        Upload your study materials to help the AI tutor understand your curriculum
      </p>
    </div>
  );
}

