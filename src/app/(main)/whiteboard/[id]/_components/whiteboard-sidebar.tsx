
"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import {
    MousePointer,
    Pen,
    Eraser,
    Text as TextIcon,
    Image as ImageIcon,
    Highlighter,
    PanelLeftClose,
    PanelLeftOpen,
    TrashIcon,
    Sparkles,
    Brain,
} from 'lucide-react';
import { FaCheckCircle, FaArrowCircleLeft } from "react-icons/fa";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useSolveAll from "@/app/store/use-solve-all";
import useScreenshot from "@/hooks/use-screenshot";
import QuizMeDrawer from "./quiz-me/quiz-me-drawer";

interface WhiteboardSidebarProps {
    whiteboardID: Id<"whiteboards">;
    selectedTool: string;
    setSelectedTool: (tool: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    onCheck: () => void;
    onSubmit: () => void;
    onImageToolSelect: () => void;
    currentColor: string;
    setCurrentColor: (color: string) => void;
}

const SidebarButton = memo(({
                                action,
                                icon: Icon,
                                label,
                                isActive,
                                isCollapsed,
                                customClickAction,
                                className,
                            }: {
    action?: () => void;
    icon: React.ElementType;
    label: string;
    isActive?: boolean;
    isCollapsed?: boolean;
    customClickAction?: () => void;
    className?: string;
}) => {
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        (customClickAction || action)?.();
    }, [customClickAction, action]);

    return (
        <button
            onClick={handleClick}
            className={cn(
                "flex items-center w-full text-left p-2 rounded transition-all duration-200",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500",
                "hover:bg-slate-100",
                isCollapsed ? "justify-center" : "justify-start",
                isActive
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "text-slate-600",
                className
            )}
            title={isCollapsed ? label : undefined}
            aria-label={label}
        >
            <Icon className={`w-4 h-4 transition-all ${!isCollapsed ? 'mr-2' : ''}`} />
            <span className={`text-xs font-medium transition-all duration-200 ${
                isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'
            }`}>
        {label}
      </span>
        </button>
    );
});

export default function WhiteboardSidebar({
                                              whiteboardID,
                                              selectedTool,
                                              setSelectedTool,
                                              onUndo,
                                              onRedo,
                                              onCheck,
                                              onSubmit,
                                              onImageToolSelect,
                                              currentColor,
                                              setCurrentColor,
                                          }: WhiteboardSidebarProps) {
    const clearAllWhiteboard = useMutation(api.whiteboardActions.deleteAllElements);
    const [collapsed, setCollapsed] = useState(false);
    const [colorInput, setColorInput] = useState(currentColor);
    const [isColorUpdating, setIsColorUpdating] = useState(false);

    // Debounced color update with loading state
    useEffect(() => {
        if (colorInput !== currentColor) {
            setIsColorUpdating(true);
            const timeout = setTimeout(() => {
                setCurrentColor(colorInput);
                setIsColorUpdating(false);
            }, 300);
            return () => clearTimeout(timeout);
        }
    }, [colorInput, currentColor, setCurrentColor]);

    const handleClear = useCallback(async () => {
        const { success, message } = await clearAllWhiteboard({ whiteboardID });
        toast[success ? 'success' : 'error'](message);
    }, [clearAllWhiteboard, whiteboardID]);

    const toolCategories = useMemo(() => [
        {
            title: "Tools",
            tools: [
                { name: 'select', icon: MousePointer, label: 'Select' },
                { name: 'pen', icon: Pen, label: 'Pen' },
                { name: 'eraser', icon: Eraser, label: 'Eraser' },
                { name: 'highlight', icon: Highlighter, label: 'Highlight' },
                { name: 'text', icon: TextIcon, label: 'Text' },
                { name: 'image', icon: ImageIcon, label: 'Image', action: onImageToolSelect },
                {
                    name: "clear",
                    className: "bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700",
                    icon: TrashIcon,
                    label: "Clear",
                    action: handleClear
                }
            ]
        }
    ], [onImageToolSelect, handleClear]);

    const utilityActions = useMemo(() => [
        {
            name: 'check',
            icon: FaCheckCircle,
            label: 'Check Work',
            action: onCheck,
            style: 'bg-emerald-500 text-white hover:bg-emerald-600'
        },
        {
            name: 'submit',
            icon: FaArrowCircleLeft,
            label: 'Submit',
            action: onSubmit,
            style: 'bg-indigo-500 text-white hover:bg-indigo-600'
        },
    ], [onCheck, onSubmit]);

    return (
        <div
            className={`print:hidden select-none h-[calc(100vh-55px)] flex flex-col
        bg-white border-r border-slate-200
        transition-all duration-300 ease-out will-change-transform
        ${collapsed ? 'w-16' : 'w-52'}`
            }
        >
            {/* Collapse Button */}
            <div className={`p-1.5 flex ${collapsed ? 'justify-center' : 'justify-end'} border-b border-slate-200`}>
                <SidebarButton
                    customClickAction={() => setCollapsed(!collapsed)}
                    icon={collapsed ? PanelLeftOpen : PanelLeftClose}
                    label={collapsed ? "Open" : "Close"}
                    isCollapsed={collapsed}
                />
            </div>

            {/* Color Picker */}
            <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
                <div className="p-2 border-b border-slate-200">
                    <label htmlFor="color-picker" className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 block">
                        Color
                    </label>
                    <input
                        type="color"
                        id="color-picker"
                        value={currentColor}
                        onChange={(e) => setColorInput(e.target.value)}
                        className="w-full h-8 p-0.5 border border-slate-200 rounded cursor-pointer"
                        style={{ backgroundColor: currentColor }}
                    />
                </div>
            </div>

            {/* Tools List */}
            <div className="flex-grow overflow-y-auto p-1.5 space-y-0.5">
                {toolCategories.map((category, idx) => (
                    <div key={idx}>
                        <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'max-h-0 opacity-0' : 'max-h-16 opacity-100'}`}>
                            <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-2 py-1">
                                {category.title}
                            </h3>
                        </div>
                        <div className="space-y-0.5">
                            {category.tools.map((tool) => (
                                <SidebarButton
                                    key={tool.name}
                                    action={() => setSelectedTool(tool.name)}
                                    customClickAction={tool.action}
                                    icon={tool.icon}
                                    label={tool.label}
                                    isActive={selectedTool === tool.name}
                                    isCollapsed={collapsed}
                                    className={tool.className}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Utility Actions */}
            <div className="p-1.5 space-y-1 border-t border-slate-200">
                {utilityActions.map((actionItem) => (
                    <button
                        key={actionItem.name}
                        onClick={actionItem.action}
                        className={`flex items-center w-full text-xs font-medium p-2 rounded
              transition-all duration-200 overflow-hidden
              ${collapsed ? 'justify-center' : 'justify-start'} 
              ${actionItem.style}`}
                        title={collapsed ? actionItem.label : undefined}
                    >
                        <actionItem.icon className={`w-3.5 h-3.5 transition-all duration-200 ${!collapsed ? 'mr-2' : ''}`} />
                        <span className={`transition-all duration-200 ${
                            collapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'
                        }`}>
              {actionItem.label}
            </span>
                    </button>
                ))}
            </div>
        </div>
    );
}