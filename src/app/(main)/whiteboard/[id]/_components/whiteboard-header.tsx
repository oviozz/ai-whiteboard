"use client";

import Link from "next/link";
import { ArrowLeft, FileText, FileImage, ExternalLink } from "lucide-react";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import HeaderTutorIndicator from "@/components/ai-tutor/header-tutor-indicator";

type WhiteboardHeaderProps = {
    whiteboardID: Id<"whiteboards">;
    whiteboardName?: string;
};

export default function WhiteboardHeader({ whiteboardID, whiteboardName }: WhiteboardHeaderProps) {
    const whiteboard_info = useQuery(api.whiteboards.getWhiteboardID, {
        whiteboardID
    });
    
    const documents = useQuery(api.documents.getDocumentsByWhiteboard, { whiteboardID });

    const displayName = whiteboardName || whiteboard_info?.topic || "Whiteboard";
    const hasDocuments = documents && documents.length > 0;
    
    const handleOpenFile = (url?: string) => {
        if (url) {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="relative bg-white">
            <div className="flex items-center relative">
                {/* Header content - left side only, with border-right */}
                <div className="flex items-center gap-3 min-w-0 max-w-[50vw] px-4 py-2.5 border-r border-b border-slate-200">
                    <Link
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex-shrink-0"
                        href="/dashboard"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back</span>
                    </Link>
                    
                    <div className="h-4 w-px bg-slate-200 flex-shrink-0" />
                    
                    <h1 className="text-sm font-medium text-slate-800 truncate min-w-0 max-w-[200px] flex-shrink-0">
                        {displayName}
                    </h1>
                    
                    {/* Documents - scrollable on x-axis if overflow */}
                    {hasDocuments && documents && (
                        <>
                            <div className="h-4 w-px bg-slate-200 flex-shrink-0 hidden sm:block" />
                            <div className="hidden sm:flex items-center gap-2 overflow-x-auto hide-scrollbar flex-1 min-w-0">
                                {documents.map((doc) => {
                                    const isImage = doc.fileType?.startsWith("image/");
                                    return (
                                        <button
                                            key={doc._id}
                                            onClick={() => handleOpenFile(doc.url)}
                                            className="flex items-center gap-1.5 px-2 py-1 border border-slate-200 rounded text-xs text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors cursor-pointer group flex-shrink-0"
                                        >
                                            {isImage ? <FileImage className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                            <span className="truncate max-w-[100px]">{doc.filename}</span>
                                            <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            {/* AI Tutor Indicator - positioned outside header, top-right */}
            <div className="absolute top-3 right-4 z-10">
                <HeaderTutorIndicator />
            </div>
        </div>
    );
}

