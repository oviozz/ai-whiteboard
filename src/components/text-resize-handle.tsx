
"use client"

import type React from "react"

interface TextResizeHandleProps {
    elementId: string | any
    fontSize: number
    onResize: (fontSize: number) => void
}

const TextResizeHandle: React.FC<TextResizeHandleProps> = ({ elementId, fontSize, onResize }) => {
    return (
        <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">Size:</label>
            <input
                type="range"
                min="8"
                max="72"
                value={fontSize}
                onChange={(e) => onResize(Number.parseInt(e.target.value))}
                className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300">{fontSize}px</span>
        </div>
    )
}

export default TextResizeHandle
