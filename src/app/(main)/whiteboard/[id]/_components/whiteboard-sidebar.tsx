
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
} from 'lucide-react';
import { FaLightbulb, FaCheckCircle, FaArrowCircleLeft } from "react-icons/fa";
import { useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhiteboardSidebarProps {
    whiteboardID: Id<"whiteboards">;
    selectedTool: string;
    setSelectedTool: (tool: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    onHint: () => void;
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
                "flex items-center w-full text-left p-2.5 rounded-lg transition-all duration-300 ease-out",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
                "hover:bg-slate-200/70 dark:hover:bg-slate-700/50",
                isCollapsed ? "justify-center" : "justify-start",
                isActive
                    ? "bg-indigo-600 text-white shadow-inner hover:bg-indigo-700"
                    : "text-slate-700 dark:text-slate-300",
                className
            )}
            title={isCollapsed ? label : undefined}
            aria-label={label}
        >
            <Icon className={`w-5 h-5 transition-all ${!isCollapsed ? 'mr-3' : ''}`} />
            <span className={`text-sm font-medium transition-all duration-300 ${
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
                                              onHint,
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
            name: 'hint',
            icon: FaLightbulb,
            label: 'Request Hint',
            action: onHint,
            style: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white'
        },
        {
            name: 'check',
            icon: FaCheckCircle,
            label: 'Check Work',
            action: onCheck,
            style: 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white'
        },
        {
            name: 'submit',
            icon: FaArrowCircleLeft,
            label: 'Submit Work',
            action: onSubmit,
            style: 'bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700 text-white'
        },
    ], [onHint, onCheck, onSubmit]);

    return (
        <div
            className={`print:hidden select-none h-[calc(100vh-55px)] flex flex-col
        bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700
        transition-all duration-300 ease-out will-change-transform
        ${collapsed ? 'w-20' : 'w-64'}`
            }
        >
            {/* Collapse Button */}
            <div className={`p-2 flex ${collapsed ? 'justify-center' : 'justify-end'} border-b border-slate-200 dark:border-slate-700`}>
                <SidebarButton
                    customClickAction={() => setCollapsed(!collapsed)}
                    icon={collapsed ? PanelLeftOpen : PanelLeftClose}
                    label={collapsed ? "Open Sidebar" : "Close Sidebar"}
                    isCollapsed={collapsed}
                />
            </div>

            {/* Color Picker */}
            <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                    <label htmlFor="color-picker" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">
                        Color {isColorUpdating && '...'}
                    </label>
                    <div className="relative">
                        <input
                            type="color"
                            id="color-picker"
                            value={currentColor}
                            onChange={(e) => setColorInput(e.target.value)}
                            className="w-full h-10 p-0.5 border border-slate-300 dark:border-slate-600 rounded-md cursor-pointer appearance-none transition-all duration-300"
                            style={{ backgroundColor: currentColor }}
                        />
                        <div className={`absolute inset-0 bg-slate-100/50 dark:bg-slate-800/50 rounded-md transition-opacity duration-300 ${
                            isColorUpdating ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`} />
                    </div>
                </div>
            </div>

            {/* Tools List */}
            <div className="flex-grow overflow-y-auto p-2 space-y-1.5">
                {toolCategories.map((category, idx) => (
                    <div key={idx} className="mb-2">
                        <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
                            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 mb-2">
                                {category.title}
                            </h3>
                        </div>
                        <div className="space-y-1">
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
            <div className={`p-3 space-y-2 border-t border-slate-200 dark:border-slate-700`}>
                {utilityActions.map((actionItem) => (
                    <button
                        key={actionItem.name}
                        onClick={actionItem.action}
                        className={`flex items-center w-full text-sm font-medium p-2.5 rounded-md 
              transition-all duration-300 overflow-hidden
              ${collapsed ? 'justify-center' : 'justify-start'} 
              ${actionItem.style}`}
                        title={collapsed ? actionItem.label : undefined}
                    >
                        <actionItem.icon className={`w-4 h-4 transition-all duration-300 ${!collapsed ? 'mr-2.5' : ''}`} />
                        <span className={`transition-all duration-300 ${
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