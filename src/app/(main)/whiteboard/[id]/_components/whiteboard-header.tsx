"use client";

import Link from "next/link";
import { ArrowLeft, FileText, FileImage, ExternalLink } from "lucide-react";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";

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
            <div className="px-4 py-1.5 flex items-center relative">
                {/* Header content with max-width constraint */}
                <div className="flex items-center gap-3 max-w-[50vw] min-w-0 relative" id="header-content">
                    <Link
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex-shrink-0"
                        href="/dashboard"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back</span>
                    </Link>
                    
                    <div className="h-4 w-px bg-slate-200 flex-shrink-0" />
                    
                    <h1 className="text-sm font-medium text-slate-800 truncate min-w-0">
                        {displayName}
                    </h1>
                    
                    {/* Documents - scrollable if multiple */}
                    {hasDocuments && documents && (
                        <>
                            <div className="h-4 w-px bg-slate-200 flex-shrink-0 hidden sm:block" />
                            <div className="hidden sm:flex items-center gap-2 overflow-x-auto hide-scrollbar max-w-[300px] min-w-0">
                                {documents.map((doc) => {
                                    const isImage = doc.fileType?.startsWith("image/");
                                    return (
                                        <button
                                            key={doc._id}
                                            onClick={() => handleOpenFile(doc.url)}
                                            className="flex items-center gap-1.5 px-2 py-1 border border-slate-200 rounded text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer group flex-shrink-0"
                                        >
                                            <div className="p-0.5 rounded bg-slate-100 group-hover:bg-indigo-100 transition-colors">
                                                {isImage ? <FileImage className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                            </div>
                                            <span className="truncate max-w-[120px] underline decoration-dotted underline-offset-2">{doc.filename}</span>
                                            <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-500 flex-shrink-0" />
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    
                    {/* Right border that stops at the end of content */}
                    <div className="absolute top-0 bottom-0 right-0 w-px bg-slate-200" />
                </div>
            </div>
            {/* Bottom border that ends after the header content - matches content width */}
            <div className="h-px bg-slate-200 ml-4" style={{ width: 'min(50vw, calc(100% - 2rem))' }} />
        </div>
    );
}
