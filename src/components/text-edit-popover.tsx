
"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import TextResizeHandle from "./text-resize-handle"

interface TextEditPopoverProps {
    x: number
    y: number
    text: string
    fontSize: number
    onChange: (text: string) => void
    onResize: (fontSize: number) => void
    onSave: () => void
    textareaRef: React.RefObject<HTMLTextAreaElement>
}

const TextEditPopover: React.FC<TextEditPopoverProps> = ({
                                                             x,
                                                             y,
                                                             text,
                                                             fontSize,
                                                             onChange,
                                                             onResize,
                                                             onSave,
                                                             textareaRef,
                                                         }) => {
    // Adjust position to ensure popover stays within viewport
    const popoverRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (popoverRef.current) {
            const rect = popoverRef.current.getBoundingClientRect()
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            // Adjust horizontal position if needed
            if (x + rect.width > viewportWidth) {
                popoverRef.current.style.left = `${viewportWidth - rect.width - 10}px`
            } else if (x < rect.width / 2) {
                popoverRef.current.style.left = "10px"
                popoverRef.current.style.transform = "none"
            }

            // Adjust vertical position if needed
            if (y + rect.height > viewportHeight) {
                popoverRef.current.style.top = `${y - rect.height - 10}px`
            }
        }

        // Focus the textarea
        if (textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [x, y])

    return (
        <div
            ref={popoverRef}
            className="absolute z-50 bg-white dark:bg-slate-800 shadow-lg rounded-md p-3 border border-slate-200 dark:border-slate-600 text-popover"
            style={{
                left: x,
                top: y + 10,
                transform: "translateX(-50%)",
                minWidth: "300px",
            }}
        >
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Edit Text</span>
                <div className="text-xs text-gray-500 dark:text-gray-400">Markdown supported</div>
            </div>

            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        onSave()
                    }
                }}
                className="w-full p-2 border rounded mb-2 dark:bg-slate-700 dark:text-white resize-none"
                placeholder="Enter text (Markdown supported)..."
                rows={5}
            />

            <div className="mb-2 p-2 border rounded bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
                <p>Markdown supported: **bold**, *italic*, # headings, - lists, etc.</p>
            </div>

            <div className="flex flex-col gap-2">
                <TextResizeHandle elementId="text-resize" fontSize={fontSize} onResize={onResize} />

                <div className="flex justify-end">
                    <button onClick={onSave} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TextEditPopover
