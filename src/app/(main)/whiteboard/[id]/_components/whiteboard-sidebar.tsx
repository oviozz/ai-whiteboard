"use client";

import { useState, useMemo, useCallback, memo, useEffect } from "react";
import {
  MousePointer,
  Pen,
  Eraser,
  Type,
  Square,
  Circle,
  ArrowRight,
  StickyNote,
  Hand,
  PanelLeftClose,
  PanelLeftOpen,
  TrashIcon,
  Undo2,
  Redo2,
  Palette,
  Sparkles,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTldrawEditor } from "@/contexts/tldraw-editor-context";
import { clearWhiteboard } from "@/lib/tldraw-actions";
import useSolveAll from "@/app/store/use-solve-all";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface WhiteboardSidebarProps {
  whiteboardID: Id<"whiteboards">;
}

const SidebarButton = memo(
  ({
    action,
    icon: Icon,
    label,
    isActive,
    isCollapsed,
    className,
    disabled,
  }: {
    action?: () => void;
    icon: React.ElementType;
    label: string;
    isActive?: boolean;
    isCollapsed?: boolean;
    className?: string;
    disabled?: boolean;
  }) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        if (!disabled) {
          action?.();
        }
      },
      [action, disabled]
    );

    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "flex items-center w-full text-left p-2.5 rounded-lg transition-all duration-300 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
          "hover:bg-slate-200/70 dark:hover:bg-slate-700/50",
          isCollapsed ? "justify-center" : "justify-start",
          isActive
            ? "bg-indigo-600 text-white shadow-inner hover:bg-indigo-700"
            : "text-slate-700 dark:text-slate-300",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        title={isCollapsed ? label : undefined}
        aria-label={label}
      >
        <Icon
          className={`w-5 h-5 flex-shrink-0 ${!isCollapsed ? "mr-3" : ""}`}
        />
        <span
          className={cn(
            "text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300",
            isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          {label}
        </span>
      </button>
    );
  }
);
SidebarButton.displayName = "SidebarButton";

// Color options matching tldraw's palette (circular style)
const COLORS = [
  { name: "black", value: "#1d1d1d" },
  { name: "grey", value: "#9ea2a8" },
  { name: "light-violet", value: "#c9b2e8" },
  { name: "violet", value: "#9c6ade" },
  { name: "blue", value: "#4a90d9" },
  { name: "light-blue", value: "#7acbe8" },
  { name: "yellow", value: "#f9dc5c" },
  { name: "orange", value: "#f5a623" },
  { name: "green", value: "#5cb85c" },
  { name: "light-green", value: "#a5d68f" },
  { name: "light-red", value: "#f3a3a3" },
  { name: "red", value: "#e03131" },
];

// Fill style icons (SVG paths for visual representation)
const FillIcons = {
  none: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  ),
  semi: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        fill="currentColor"
        opacity="0.3"
      />
    </svg>
  ),
  solid: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  ),
  pattern: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 8h16M4 12h16M4 16h16"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
    </svg>
  ),
};

// Dash style icons
const DashIcons = {
  draw: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <path
        d="M4 12 Q8 8 12 12 T20 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  solid: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  dashed: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="4 3"
      />
    </svg>
  ),
  dotted: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 4"
      />
    </svg>
  ),
};

// Size options
const SIZES = ["s", "m", "l", "xl"] as const;

// Custom Style Panel that uses our editor context
function StylePanelPopover({ collapsed }: { collapsed: boolean }) {
  const { editor } = useTldrawEditor();
  const [open, setOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState("black");
  const [currentFill, setCurrentFill] = useState("none");
  const [currentDash, setCurrentDash] = useState("draw");
  const [currentSize, setCurrentSize] = useState<(typeof SIZES)[number]>("m");
  const [opacity, setOpacity] = useState(100);

  // Sync state when editor becomes available
  useEffect(() => {
    if (!editor) return;
  }, [editor]);

  const handleColorChange = useCallback(
    (colorName: string) => {
      setCurrentColor(colorName);
      if (editor) {
        editor.setStyleForNextShapes(
          // @ts-expect-error - tldraw style types
          { id: "tldraw:color", type: "enum" },
          colorName
        );
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) {
          editor.setStyleForSelectedShapes(
            // @ts-expect-error - tldraw style types
            { id: "tldraw:color", type: "enum" },
            colorName
          );
        }
      }
    },
    [editor]
  );

  const handleFillChange = useCallback(
    (fillName: string) => {
      setCurrentFill(fillName);
      if (editor) {
        editor.setStyleForNextShapes(
          // @ts-expect-error - tldraw style types
          { id: "tldraw:fill", type: "enum" },
          fillName
        );
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) {
          editor.setStyleForSelectedShapes(
            // @ts-expect-error - tldraw style types
            { id: "tldraw:fill", type: "enum" },
            fillName
          );
        }
      }
    },
    [editor]
  );

  const handleDashChange = useCallback(
    (dashName: string) => {
      setCurrentDash(dashName);
      if (editor) {
        editor.setStyleForNextShapes(
          // @ts-expect-error - tldraw style types
          { id: "tldraw:dash", type: "enum" },
          dashName
        );
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) {
          editor.setStyleForSelectedShapes(
            // @ts-expect-error - tldraw style types
            { id: "tldraw:dash", type: "enum" },
            dashName
          );
        }
      }
    },
    [editor]
  );

  const handleSizeChange = useCallback(
    (sizeName: (typeof SIZES)[number]) => {
      setCurrentSize(sizeName);
      if (editor) {
        editor.setStyleForNextShapes(
          // @ts-expect-error - tldraw style types
          { id: "tldraw:size", type: "enum" },
          sizeName
        );
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) {
          editor.setStyleForSelectedShapes(
            // @ts-expect-error - tldraw style types
            { id: "tldraw:size", type: "enum" },
            sizeName
          );
        }
      }
    },
    [editor]
  );

  const handleOpacityChange = useCallback(
    (value: number[]) => {
      const newOpacity = value[0];
      setOpacity(newOpacity);
      if (editor) {
        editor.setOpacityForNextShapes(newOpacity / 100);
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) {
          editor.setOpacityForSelectedShapes(newOpacity / 100);
        }
      }
    },
    [editor]
  );

  const currentColorObj = COLORS.find((c) => c.name === currentColor);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={!editor}
          className={cn(
            "flex items-center w-full p-2.5 rounded-lg transition-all duration-300",
            "text-slate-700 dark:text-slate-300",
            "hover:bg-slate-200/70 dark:hover:bg-slate-700/50",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            collapsed ? "justify-center" : "justify-start"
          )}
          title={collapsed ? "Styles" : undefined}
        >
          <div className="relative flex-shrink-0">
            <Palette className="w-5 h-5" />
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900"
              style={{ backgroundColor: currentColorObj?.value || "#1d1d1d" }}
            />
          </div>
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ml-3",
              collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100"
            )}
          >
            Styles
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-[200px] p-0 bg-white border border-slate-200 rounded-xl shadow-none"
        sideOffset={8}
      >
        <div className="p-3 space-y-3 bg-white rounded-t-xl">
          {/* Color Grid - Circular like tldraw */}
          <div className="grid grid-cols-4 gap-2 justify-items-center">
            {COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => handleColorChange(color.name)}
                className={cn(
                  "w-7 h-7 rounded-full transition-transform hover:scale-110",
                  currentColor === color.name
                    ? "ring-2 ring-offset-2 ring-blue-500"
                    : ""
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>

          {/* Opacity Slider */}
          <div className="pt-1">
            <input
              type="range"
              value={opacity}
              onChange={(e) => handleOpacityChange([parseInt(e.target.value)])}
              min={0}
              max={100}
              step={1}
              className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* Fill Section */}
        <div className="border-t border-slate-100 p-3 bg-white">
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(FillIcons) as Array<keyof typeof FillIcons>).map(
              (fill) => (
                <button
                  key={fill}
                  onClick={() => handleFillChange(fill)}
                  className={cn(
                    "p-2 rounded-lg transition-colors text-slate-500",
                    currentFill === fill
                      ? "bg-slate-100 text-slate-700"
                      : "hover:bg-slate-50"
                  )}
                  title={fill}
                >
                  {FillIcons[fill]}
                </button>
              )
            )}
          </div>
        </div>

        {/* Dash Section */}
        <div className="border-t border-slate-100 p-3 bg-white">
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(DashIcons) as Array<keyof typeof DashIcons>).map(
              (dash) => (
                <button
                  key={dash}
                  onClick={() => handleDashChange(dash)}
                  className={cn(
                    "p-2 rounded-lg transition-colors text-slate-500",
                    currentDash === dash
                      ? "bg-slate-100 text-slate-700"
                      : "hover:bg-slate-50"
                  )}
                  title={dash}
                >
                  {DashIcons[dash]}
                </button>
              )
            )}
          </div>
        </div>

        {/* Size Section */}
        <div className="border-t border-slate-100 p-3 bg-white rounded-b-xl">
          <div className="grid grid-cols-4 gap-1">
            {SIZES.map((size) => (
              <button
                key={size}
                onClick={() => handleSizeChange(size)}
                className={cn(
                  "py-2 text-sm font-medium rounded-lg transition-colors",
                  currentSize === size
                    ? "bg-slate-100 text-slate-700"
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Map our tool names to tldraw tool names
const TOOL_MAP: Record<string, string> = {
  select: "select",
  hand: "hand",
  draw: "draw",
  eraser: "eraser",
  text: "text",
  rectangle: "geo",
  ellipse: "geo",
  arrow: "arrow",
  note: "note",
};

export default function WhiteboardSidebar({
  whiteboardID,
}: WhiteboardSidebarProps) {
  const { editor } = useTldrawEditor();
  const clearTldrawWhiteboard = useMutation(
    api.whiteboardActions.clearTldrawWhiteboard
  );

  const [collapsed, setCollapsed] = useState(false);
  const [currentToolId, setCurrentToolId] = useState<string>("select");

  // Listen for tool changes from tldraw editor
  useEffect(() => {
    if (!editor) return;

    // Set initial tool
    setCurrentToolId(editor.getCurrentToolId());

    // Subscribe to tool changes
    const handleToolChange = () => {
      setCurrentToolId(editor.getCurrentToolId());
    };

    // Listen to the editor's store for changes
    const unsubscribe = editor.store.listen(handleToolChange, {
      scope: "session",
    });

    return () => {
      unsubscribe();
    };
  }, [editor]);

  const selectTool = useCallback(
    (toolName: string, geoShape?: string) => {
      if (!editor) return;

      const tldrawTool = TOOL_MAP[toolName] || toolName;

      if (tldrawTool === "geo" && geoShape) {
        editor.setCurrentTool("geo");
        // Set the geo style for the next shape using the style prop directly
        editor.setStyleForNextShapes(
          // @ts-expect-error - tldraw style type
          { id: "tldraw:geo", type: "enum" },
          geoShape
        );
      } else {
        editor.setCurrentTool(tldrawTool);
      }
    },
    [editor]
  );

  const handleClear = useCallback(async () => {
    if (!editor) {
      toast.error("Editor not ready");
      return;
    }

    clearWhiteboard(editor);

    const result = await clearTldrawWhiteboard({ whiteboardID });
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message || "Failed to clear whiteboard");
    }
  }, [editor, clearTldrawWhiteboard, whiteboardID]);

  // Solve it all store
  const { setIsLoading: setSolveLoading } = useSolveAll();

  const handleSolve = useCallback(() => {
    if (!editor) {
      toast.error("Editor not ready");
      return;
    }

    // Check if canvas has any shapes
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) {
      toast.info("Nothing to solve! Add some content to the canvas first.");
      return;
    }

    // Trigger the solve overlay
    setSolveLoading(true);
    
    // Dispatch a custom event that the chatbot can listen to
    const solveEvent = new CustomEvent('solve-it-all', {
      detail: { whiteboardID }
    });
    window.dispatchEvent(solveEvent);
  }, [editor, setSolveLoading, whiteboardID]);

  const handleUndo = useCallback(() => {
    if (!editor) return;
    editor.undo();
  }, [editor]);

  const handleRedo = useCallback(() => {
    if (!editor) return;
    editor.redo();
  }, [editor]);

  const tools = useMemo(
    () => [
      {
        name: "select",
        icon: MousePointer,
        label: "Select",
        tldrawTool: "select",
      },
      { name: "hand", icon: Hand, label: "Pan", tldrawTool: "hand" },
      { name: "draw", icon: Pen, label: "Draw", tldrawTool: "draw" },
      { name: "eraser", icon: Eraser, label: "Eraser", tldrawTool: "eraser" },
      { name: "text", icon: Type, label: "Text", tldrawTool: "text" },
      {
        name: "note",
        icon: StickyNote,
        label: "Sticky Note",
        tldrawTool: "note",
      },
      {
        name: "rectangle",
        icon: Square,
        label: "Rectangle",
        tldrawTool: "geo",
        geoShape: "rectangle",
      },
      {
        name: "ellipse",
        icon: Circle,
        label: "Ellipse",
        tldrawTool: "geo",
        geoShape: "ellipse",
      },
      { name: "arrow", icon: ArrowRight, label: "Arrow", tldrawTool: "arrow" },
    ],
    []
  );

  const isToolActive = useCallback(
    (toolName: string) => {
      const mappedTool = TOOL_MAP[toolName] || toolName;
      return currentToolId === mappedTool;
    },
    [currentToolId]
  );

  return (
    <div
      className={cn(
        "print:hidden select-none h-[calc(100vh-55px)] flex flex-col",
        "bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700",
        "transition-all duration-300 ease-out will-change-transform",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Collapse Button */}
      <div
        className={cn(
          "p-2 flex border-b border-slate-200 dark:border-slate-700",
          collapsed ? "justify-center" : "justify-end"
        )}
      >
        <SidebarButton
          action={() => setCollapsed(!collapsed)}
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? "Open Sidebar" : "Close Sidebar"}
          isCollapsed={collapsed}
        />
      </div>

      {/* History Actions - Undo/Redo */}
      <div
        className={cn(
          "p-2 border-b border-slate-200 dark:border-slate-700",
          collapsed ? "flex flex-col gap-1" : "flex flex-row gap-1"
        )}
      >
        <button
          onClick={handleUndo}
          disabled={!editor}
          className={cn(
            "flex items-center justify-center p-2 rounded-lg",
            "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
            collapsed ? "w-full" : "flex-1"
          )}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="ml-2 text-sm">Undo</span>}
        </button>
        <button
          onClick={handleRedo}
          disabled={!editor}
          className={cn(
            "flex items-center justify-center p-2 rounded-lg",
            "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
            collapsed ? "w-full" : "flex-1"
          )}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="ml-2 text-sm">Redo</span>}
        </button>
      </div>

      {/* Style Panel Popover */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
        <StylePanelPopover collapsed={collapsed} />
      </div>

      {/* Tools List */}
      <div className="flex-grow overflow-y-auto p-2 space-y-1.5">
        <div className="mb-2">
          <div
            className={cn(
              "overflow-hidden transition-all duration-300",
              collapsed ? "max-h-0 opacity-0" : "max-h-20 opacity-100"
            )}
          >
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 mb-2">
              Tools
            </h3>
          </div>
          <div className="space-y-1">
            {tools.map((tool) => (
              <SidebarButton
                key={tool.name}
                action={() => selectTool(tool.name, tool.geoShape)}
                icon={tool.icon}
                label={tool.label}
                isActive={isToolActive(tool.name)}
                isCollapsed={collapsed}
                disabled={!editor}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
        {/* Solve it All Button */}
        <SidebarButton
          action={handleSolve}
          icon={Sparkles}
          label="Solve it All"
          isCollapsed={collapsed}
          className="bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700"
          disabled={!editor}
        />
        
        {/* Clear Button */}
        <SidebarButton
          action={handleClear}
          icon={TrashIcon}
          label="Clear All"
          isCollapsed={collapsed}
          className="bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
          disabled={!editor}
        />
      </div>
    </div>
  );
}
