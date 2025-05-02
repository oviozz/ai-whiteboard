
"use client";
import { useState } from 'react';
import {
    MousePointer,
    Pen,
    Square,
    Circle,
    Lightbulb,
    CheckCircle,
    Send,
    Eraser,
    Text,
    Image,
    History,
    Download,
    Undo,
    Redo
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { FaLightbulb, FaCheckCircle, FaArrowCircleLeft } from "react-icons/fa";

export default function WhiteboardSidebar() {
    const [selectedTool, setSelectedTool] = useState('select');
    const [collapsed, setCollapsed] = useState(false);

    const toolCategories = [
        {
            title: "Basic Tools",
            tools: [
                { name: 'select', icon: MousePointer, label: 'Select' },
                { name: 'pen', icon: Pen, label: 'Pen' },
                { name: 'eraser', icon: Eraser, label: 'Eraser' },
            ]
        },
        {
            title: "Shapes",
            tools: [
                { name: 'rectangle', icon: Square, label: 'Rectangle' },
                { name: 'circle', icon: Circle, label: 'Circle' },
                { name: 'text', icon: Text, label: 'Text' },
                { name: 'image', icon: Image, label: 'Image' },
            ]
        }
    ];

    const actions = [
        { name: 'hint', icon: FaLightbulb, label: 'Request Hint', color: 'bg-blue-100 hover:bg-blue-200 text-blue-700' },
        { name: 'check', icon: FaCheckCircle, label: 'Check Work', color: 'bg-green-100 hover:bg-green-200 text-green-700' },
        { name: 'submit', icon: FaArrowCircleLeft, label: 'Submit Work', color: 'bg-purple-100 hover:bg-purple-200 text-purple-700' },
    ];

    const historyActions = [
        { name: 'undo', icon: Undo, label: 'Undo' },
        { name: 'redo', icon: Redo, label: 'Redo' },
    ];

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
    };

    return (
        <div className={`select-none h-[calc(100vh-55px)] flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${collapsed ? 'w-16' : 'w-52'}`}>

            {/* History Actions */}
            <div className={`flex ${collapsed ? 'justify-center px-2' : 'px-4'} py-1.5 border-b border-gray-200`}>
                {historyActions.map((action) => (
                    <button
                        key={action.name}
                        className="p-1.5 mx-1 rounded-md hover:bg-gray-200 text-gray-600"
                        title={action.label}
                    >
                        <action.icon className="w-5 h-5" />
                        {!collapsed && <span className="sr-only">{action.label}</span>}
                    </button>
                ))}
            </div>

            {/* Tools Section */}
            <div className="flex-grow overflow-y-auto p-2">
                {toolCategories.map((category, idx) => (
                    <div key={idx} className="mb-4">
                        {!collapsed &&
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                                {category.title}
                            </h3>
                        }
                        <div className={`space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
                            {category.tools.map((tool) => (
                                <button
                                    key={tool.name}
                                    className={`flex items-center ${collapsed ? 'justify-center' : ''} w-full p-2 rounded-md transition-colors ${
                                        selectedTool === tool.name
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                                    onClick={() => setSelectedTool(tool.name)}
                                    title={collapsed ? tool.label : undefined}
                                >
                                    <tool.icon className={`w-5 h-5 ${!collapsed && 'mr-3'}`} />
                                    {!collapsed && <span>{tool.label}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Action Buttons */}
            <div className={`p-4 space-y-3 border-t border-gray-200`}>
                {actions.map((action) => (
                    <Button
                        size="sm"
                        key={action.name}
                        className={`flex items-center w-full text-sm rounded-md ${collapsed ? 'justify-center' : ''} ${action.color}`}
                        title={collapsed ? action.label : undefined}
                    >
                        <action.icon className={`w-5 h-5 ${!collapsed && 'mr-3'}`} />
                        {!collapsed && <span>{action.label}</span>}
                    </Button>
                ))}
            </div>
        </div>
    );
}