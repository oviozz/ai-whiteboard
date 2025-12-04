"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
    FileText,
    ChevronRight,
    ChevronLeft,
    Trash2,
    Plus,
    Loader2,
    FileImage,
    File,
    CheckCircle,
    AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StudyMaterialsPanelProps = {
    whiteboardID: Id<"whiteboards">;
};

export default function StudyMaterialsPanel({ whiteboardID }: StudyMaterialsPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Fetch documents attached to this whiteboard
    const documents = useQuery(api.documents.getDocumentsByWhiteboard, { whiteboardID });
    const extractedProblems = useQuery(api.documents.getExtractedProblems, { whiteboardID });
    
    const deleteDocument = useMutation(api.documents.deleteDocument);
    const markProblemAdded = useMutation(api.documents.markProblemAddedToBoard);
    const addTextToBoard = useMutation(api.whiteboardActions.addElement);

    const hasDocuments = documents && documents.length > 0;
    const totalProblems = extractedProblems?.length || 0;
    const unaddedProblems = extractedProblems?.filter(p => !p.problem.addedToBoard).length || 0;

    const getFileIcon = (fileType: string) => {
        if (fileType.startsWith("image/")) return FileImage;
        if (fileType.includes("pdf")) return FileText;
        return File;
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "complete":
                return <CheckCircle className="w-3 h-3 text-green-500" />;
            case "processing":
                return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
            case "error":
                return <AlertCircle className="w-3 h-3 text-red-500" />;
            default:
                return <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />;
        }
    };

    const handleDeleteDocument = async (documentId: Id<"whiteboardDocuments">) => {
        try {
            await deleteDocument({ documentId });
            toast.success("Document removed");
        } catch (error) {
            toast.error("Failed to remove document");
        }
    };

    const handleAddProblemToBoard = async (
        documentId: Id<"whiteboardDocuments">,
        problemId: string,
        problemText: string
    ) => {
        try {
            // Add as text element to whiteboard
            await addTextToBoard({
                whiteboardID,
                element: {
                    type: "text",
                    x: 100 + Math.random() * 200,
                    y: 100 + Math.random() * 200,
                    text: problemText,
                    color: "#1e293b",
                    fontSize: 18,
                    fontFamily: "Arial",
                },
                order: Date.now(),
            });

            // Mark as added
            await markProblemAdded({ documentId, problemId });
            toast.success("Problem added to whiteboard");
        } catch (error) {
            toast.error("Failed to add problem");
        }
    };

    // Don't render if no documents
    if (!hasDocuments) {
        return null;
    }

    return (
        <div
            className={cn(
                "fixed right-0 top-1/2 -translate-y-1/2 z-40 flex",
                "transition-all duration-300 ease-out"
            )}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "flex items-center justify-center w-8 h-24",
                    "bg-white border-2 border-r-0 border-slate-200 rounded-l-lg",
                    "hover:bg-slate-50 transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                )}
                aria-label={isExpanded ? "Collapse study materials" : "Expand study materials"}
            >
                <div className="flex flex-col items-center gap-1">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    {unaddedProblems > 0 && (
                        <span className="text-xs font-bold text-indigo-600">{unaddedProblems}</span>
                    )}
                    {isExpanded ? (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </button>

            {/* Panel Content */}
            <div
                className={cn(
                    "bg-white border-2 border-slate-200 overflow-hidden",
                    "transition-all duration-300 ease-out",
                    isExpanded ? "w-80 opacity-100" : "w-0 opacity-0"
                )}
            >
                <div className="w-80 h-full flex flex-col max-h-[60vh]">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-sm font-semibold text-slate-800">Study Materials</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {documents?.length || 0} document{documents?.length !== 1 ? "s" : ""} • {totalProblems} problem{totalProblems !== 1 ? "s" : ""}
                        </p>
                    </div>

                    {/* Documents List */}
                    <ScrollArea className="flex-1">
                        <div className="p-3 space-y-3">
                            {/* Uploaded Documents */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Documents
                                </h4>
                                <div className="space-y-2">
                                    {documents?.map((doc) => {
                                        const FileIcon = getFileIcon(doc.fileType);
                                        return (
                                            <div
                                                key={doc._id}
                                                className="flex items-center gap-2 p-2 border-2 border-slate-200 rounded-lg bg-white hover:bg-slate-50"
                                            >
                                                <div className="p-1.5 rounded bg-slate-100">
                                                    <FileIcon className="w-4 h-4 text-slate-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">
                                                        {doc.filename}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {getStatusIcon(doc.processingStatus)}
                                                        <span className="text-xs text-slate-500 capitalize">
                                                            {doc.processingStatus}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteDocument(doc._id)}
                                                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                    aria-label="Remove document"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Extracted Problems */}
                            {extractedProblems && extractedProblems.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                        Extracted Problems
                                    </h4>
                                    <div className="space-y-2">
                                        {extractedProblems.map((item, index) => (
                                            <div
                                                key={`${item.documentId}-${item.problem.id}`}
                                                className={cn(
                                                    "p-2 border-2 rounded-lg",
                                                    item.problem.addedToBoard
                                                        ? "border-green-200 bg-green-50"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                )}
                                            >
                                                <p className="text-sm text-slate-700 line-clamp-2">
                                                    {item.problem.text}
                                                </p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-xs text-slate-500">
                                                        From: {item.filename}
                                                    </span>
                                                    {item.problem.addedToBoard ? (
                                                        <span className="flex items-center gap-1 text-xs text-green-600">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Added
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            variant="neutral"
                                                            size="sm"
                                                            className="h-6 text-xs"
                                                            onClick={() =>
                                                                handleAddProblemToBoard(
                                                                    item.documentId,
                                                                    item.problem.id,
                                                                    item.problem.text
                                                                )
                                                            }
                                                        >
                                                            <Plus className="w-3 h-3 mr-1" />
                                                            Add to Board
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}

