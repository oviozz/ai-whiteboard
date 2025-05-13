
// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import WhiteboardHeader from "./whiteboard-header";
import WhiteboardSidebar from "./whiteboard-sidebar";
import { useQuery, useMutation } from "convex/react";
import {Id} from "../../../../../../convex/_generated/dataModel";
import {api} from "../../../../../../convex/_generated/api";
import { elementData as ConvexElementDataUnion, pathProperties, imageProperties, textProperties } from "../../../../../../convex/schema";
import SidebarChatbot from "@/app/(main)/whiteboard/[id]/_components/sidebar-chatbot/sidebar-chatbot";
import {SidebarProvider} from "@/components/ui/sidebar";

interface Point { x: number; y: number; }

interface ElementBaseClient {
    id: Id<"whiteboardElements"> | string;
    order: number;
    isSelected?: boolean;
}

export interface PathElementClient extends ElementBaseClient {
    type: "path";
    points: Point[];
    color: string;
    strokeWidth: number;
    compositeOperation?: string;
}

export interface ImageElementClient extends ElementBaseClient {
    type: "image";
    x: number;
    y: number;
    width: number;
    height: number;
    imageUrl: string;
    image?: HTMLImageElement;
}

export interface TextElementClient extends ElementBaseClient {
    type: "text";
    x: number;
    y: number;
    text: string;
    color: string;
    fontSize: number;
    fontFamily: string;
    isEditing?: boolean;
}

export type WhiteboardElementClient = PathElementClient | ImageElementClient | TextElementClient;

function isPathDataFromSchema(data: ConvexElementDataUnion): data is typeof pathProperties.type { return data.type === "path"; }
function isImageDataFromSchema(data: ConvexElementDataUnion): data is typeof imageProperties.type { return data.type === "image"; }
function isTextDataFromSchema(data: ConvexElementDataUnion): data is typeof textProperties.type { return data.type === "text"; }

const rgbaColor = (hex: string, alpha: number): string => {
    if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return `rgba(0,0,0,${alpha})`;
    let normalizedHex = hex; if (hex.length === 4) normalizedHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalizedHex);
    if (!result) return `rgba(0,0,0,${alpha})`;
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
};

const MIN_ZOOM = 0.1; const MAX_ZOOM = 10; const SCROLL_SENSITIVITY = 0.0008;

export default function WhiteboardClient({ whiteboardId }: { whiteboardId?: Id<"whiteboards"> }) {
    const [elements, setElements] = useState<WhiteboardElementClient[]>([]);
    const [selectedTool, setSelectedTool] = useState('pen');
    const [currentColor, setCurrentColor] = useState('#000000');
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [currentPath, setCurrentPath] = useState<Omit<PathElementClient, 'id' | 'order'> | null>(null);
    const [selectedElementId, setSelectedElementId] = useState<string | Id<"whiteboardElements"> | null>(null);
    const [editingTextElementId, setEditingTextElementId] = useState<string | Id<"whiteboardElements"> | null>(null);
    const [isDraggingElement, setIsDraggingElement] = useState(false);
    const dragStartOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const [history, setHistory] = useState<WhiteboardElementClient[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [clientError, setClientError] = useState<string | null>(null);
    const [whiteboardTopic, setWhiteboardTopic] = useState<string | undefined>(undefined);
    const lastTap = useRef(0); // For double tap detection on touch

    const whiteboardDataQuery = useQuery(api.whiteboardActions.getWhiteboardContent, whiteboardId ? { whiteboardID: whiteboardId as Id<"whiteboards"> } : "skip");
    const addElementMutation = useMutation(api.whiteboardActions.addElement);
    const updateElementMutation = useMutation(api.whiteboardActions.updateElement);
    const deleteElementMutation = useMutation(api.whiteboardActions.deleteElement);

    const recordHistory = useCallback(() => {
        const currentElementsSnapshot = elements.map(el => ({ ...el }));
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(currentElementsSnapshot);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [elements, history, historyIndex]);

    useEffect(() => {
        if (!whiteboardId) { setClientError("Whiteboard ID is missing."); return; }
        if (whiteboardDataQuery === undefined) return;
        if (whiteboardDataQuery === null || whiteboardDataQuery.status === "id_missing" || whiteboardDataQuery.status === "not_found") {
            setClientError(`Whiteboard not found (ID: ${whiteboardId}).`);
            setElements([]); setHistory([[]]); setHistoryIndex(0); setWhiteboardTopic(undefined); return;
        }
        if (whiteboardDataQuery.status === "success") {
            setClientError(null); setWhiteboardTopic(whiteboardDataQuery.whiteboard?.topic);
            const loadPromises = whiteboardDataQuery.elements.map(async (dbElement): Promise<WhiteboardElementClient | null> => {
                const base = { id: dbElement._id, order: dbElement.order }; const elData = dbElement.element;
                if (isImageDataFromSchema(elData)) {
                    return new Promise((resolve) => {
                        const img = new Image(); img.onload = () => resolve({ ...base, ...elData, image: img });
                        img.onerror = () => { console.error("Failed to load image:", elData.imageUrl); resolve(null); }; img.src = elData.imageUrl;
                    });
                } else if (isPathDataFromSchema(elData) || isTextDataFromSchema(elData)) return { ...base, ...elData } as WhiteboardElementClient;
                return null;
            });
            Promise.all(loadPromises).then(loadedClientElements => {
                const validElements = loadedClientElements.filter(el => el !== null) as WhiteboardElementClient[];
                setElements(validElements); setHistory([validElements]); setHistoryIndex(0);
            });
        }
    }, [whiteboardDataQuery, whiteboardId]);

    const getCanvasCoords = (clientX: number, clientY: number): Point => {
        const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: (clientX - rect.left - panOffset.x) / zoomLevel, y: (clientY - rect.top - panOffset.y) / zoomLevel };
    };

    const mapToDbElementSchemaFromPartial = (data: Omit<WhiteboardElementClient, 'id'|'order'|'image'|'isSelected'|'isEditing'>): ConvexElementDataUnion => {
        if (data.type === "path") { const { points,color,strokeWidth,compositeOperation } = data; return { type:"path",points,color,strokeWidth,compositeOperation };}
        else if (data.type === "image") { const { x,y,width,height,imageUrl } = data; return { type:"image",x,y,width,height,imageUrl };}
        else if (data.type === "text") { const { x,y,text,color,fontSize,fontFamily } = data; return { type:"text",x,y,text,color,fontSize,fontFamily };}
        throw new Error(`Unknown partial client data type for DB mapping: ${(data as any).type}`);
    };

    const persistElementAddition = async (element: WhiteboardElementClient) => {
        if (!whiteboardId) { setClientError("Cannot save: Whiteboard ID missing."); return element.id; } // Return temp ID on failure
        const castedWbId = whiteboardId as Id<"whiteboards">;
        const { id: tempId, order, image, isSelected, isEditing, ...dataForDb } = element; // Destructure to get core data
        const dbElementPayload = mapToDbElementSchemaFromPartial(dataForDb as Omit<WhiteboardElementClient, 'id'|'order'|'image'|'isSelected'|'isEditing'>);
        try {
            const newId = await addElementMutation({ whiteboardID: castedWbId, element: dbElementPayload, order });
            setElements(prev => prev.map(el => el.id === tempId ? { ...el, id: newId } : el));
            // Update history with the real ID (this is tricky, might need a more complex history update)
            setHistory(prevHistory => prevHistory.map(histState =>
                histState.map(el => el.id === tempId ? { ...el, id: newId } : el)
            ));
            return newId;
        } catch (error) {
            console.error("Failed to add element to Convex:", error); setClientError("Failed to save new element.");
            setElements(prev => prev.filter(el => el.id !== tempId)); // Revert optimistic add from local state
            // Attempt to revert history if the add failed
            const lastHistoryState = history[history.length -1];
            if (lastHistoryState && lastHistoryState.some(el => el.id === tempId)) {
                setHistory(prev => prev.slice(0, -1));
                setHistoryIndex(prev => Math.max(0, prev -1));
            }
            return tempId; // Return temp ID on failure
        }
    };

    const persistElementUpdate = async (element: WhiteboardElementClient) => {
        if (!whiteboardId || typeof element.id === 'string' && element.id.startsWith("temp_")) {
            if (!whiteboardId) setClientError("Cannot save: Whiteboard ID missing.");
            return;
        }
        const { id, order, image, isSelected, isEditing, ...dataForDb } = element;
        const dbElementPayload = mapToDbElementSchemaFromPartial(dataForDb as Omit<WhiteboardElementClient, 'id'|'order'|'image'|'isSelected'|'isEditing'>);
        try {
            await updateElementMutation({ elementID: element.id as Id<"whiteboardElements">, updates: { element: dbElementPayload, order } });
        } catch (error) {
            console.error("Failed to update element in Convex:", error); setClientError("Failed to save element update.");
            // Revert UI: Find the element in the *previous* history state to revert to.
            if (historyIndex > 0) {
                const previousStateElement = history[historyIndex - 1]?.find(el => el.id === element.id);
                if (previousStateElement) {
                    setElements(prev => prev.map(el => el.id === element.id ? previousStateElement : el));
                }
            }
            // Note: More robust revert would involve not just UI but also potentially re-recording a "revert" operation in history.
        }
    };

    const findElementAt = (worldX: number, worldY: number): WhiteboardElementClient | null => {
        const sortedElements = [...elements].sort((a, b) => b.order - a.order);
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if(!ctx || !canvas) return null;
        for (const el of sortedElements) {
            if (el.type === 'image') { if (worldX >= el.x && worldX <= el.x + el.width && worldY >= el.y && worldY <= el.y + el.height) return el; }
            else if (el.type === 'text') {
                const dpr = window.devicePixelRatio || 1; ctx.font = `${el.fontSize * zoomLevel * dpr}px ${el.fontFamily}`;
                const lines = el.text.split('\n'); const totalHeight = lines.length * el.fontSize * 1.2; let maxWidth = 0;
                lines.forEach(line => { const metrics = ctx.measureText(line || " "); if (metrics.width / (zoomLevel * dpr) > maxWidth) maxWidth = metrics.width / (zoomLevel * dpr); });
                if (worldX >= el.x && worldX <= el.x + maxWidth && worldY >= el.y && worldY <= el.y + totalHeight) return el;
            } else if (el.type === 'path') {
                if (el.points.length < 1) continue; let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                el.points.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
                const padding = Math.max(5 / zoomLevel, el.strokeWidth / 2 + 3 / zoomLevel);
                if (worldX >= minX - padding && worldX <= maxX + padding && worldY >= minY - padding && worldY <= maxY + padding) return el;
            }
        }
        return null;
    };

    const startInteraction = (clientX: number, clientY: number, isTouch: boolean = false) => {
        const coords = getCanvasCoords(clientX, clientY);
        if (editingTextElementId) {
            const targetIsTextarea = textInputRef.current && textInputRef.current.contains(document.elementFromPoint(clientX, clientY)); // Check actual element under pointer
            if (!targetIsTextarea) { handleTextEditBlur(); }
        }
        if (selectedTool === 'select') {
            const clickedElement = findElementAt(coords.x, coords.y);
            if (isTouch && clickedElement && clickedElement.type === 'text') { // Handle touch double tap for text edit
                const now = Date.now();
                const DOUBLE_TAP_DELAY = 300;
                if (now - lastTap.current < DOUBLE_TAP_DELAY && selectedElementId === clickedElement.id) {
                    setElements(prev => prev.map(el => el.id === clickedElement.id ? {...el, isEditing: true} : el));
                    setEditingTextElementId(clickedElement.id);
                }
                lastTap.current = now;
            }
            setSelectedElementId(clickedElement ? clickedElement.id : null);
            if (clickedElement) {
                setIsDraggingElement(true);
                if (clickedElement.type === 'image' || clickedElement.type === 'text') dragStartOffsetRef.current = { x: coords.x - clickedElement.x, y: coords.y - clickedElement.y };
                else if (clickedElement.type === 'path') dragStartOffsetRef.current = { x: coords.x, y: coords.y };
            } else { setIsPanning(true); setPanStart({ x: clientX, y: clientY }); }
            return;
        }
        setIsDrawing(true);
        if (selectedTool === 'pen' || selectedTool === 'eraser' || selectedTool === 'highlight') {
            setCurrentPath({ type: 'path', points: [coords],
                color: selectedTool === 'eraser' ? '#FFFFFF' : selectedTool === 'highlight' ? rgbaColor(currentColor, 0.3) : currentColor,
                strokeWidth: selectedTool === 'pen' ? 3 : selectedTool === 'eraser' ? 30 : 20,
                compositeOperation: selectedTool === 'eraser' ? 'destination-out' : 'source-over',
            });
        } else if (selectedTool === 'text') {
            const order = elements.length > 0 ? Math.max(...elements.map(el => el.order), -1) + 1 : 0;
            const tempId = `temp_text_${Date.now()}`;
            const newTextElement: TextElementClient = {
                id: tempId, type: 'text', x: coords.x, y: coords.y, text: "",
                color: currentColor, fontSize: 16, fontFamily: 'Arial', order,
                isEditing: true, isSelected: true,
            };
            setElements(prev => [...prev, newTextElement]); // Optimistic add for editing
            setSelectedElementId(newTextElement.id);
            setEditingTextElementId(newTextElement.id);
            setIsDrawing(false);
        }
    };

    const moveInteraction = (clientX: number, clientY: number) => {
        const coords = getCanvasCoords(clientX, clientY);
        if (isPanning) {
            const dx = clientX - panStart.x; const dy = clientY - panStart.y;
            setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy })); setPanStart({ x: clientX, y: clientY }); return;
        }
        if (isDraggingElement && selectedElementId) {
            const element = elements.find(el => el.id === selectedElementId); if (!element) return;
            if (element.type === 'image' || element.type === 'text') {
                const newX = coords.x - dragStartOffsetRef.current.x; const newY = coords.y - dragStartOffsetRef.current.y;
                setElements(prev => prev.map(el => el.id === selectedElementId ? {...el, x: newX, y: newY} : el));
            } else if (element.type === 'path') {
                const dx = coords.x - dragStartOffsetRef.current.x; const dy = coords.y - dragStartOffsetRef.current.y;
                setElements(prev => prev.map(el => (el.id === selectedElementId && el.type === 'path') ? { ...el, points: el.points.map(p => ({x: p.x + dx, y: p.y + dy})) } : el ));
                dragStartOffsetRef.current = coords;
            }
            return;
        }
        if (!isDrawing || !currentPath || currentPath.type !== 'path') return;
        setCurrentPath(prev => prev ? { ...prev, points: [...prev.points, coords] } : null);
    };

    const endInteraction = async () => {
        let newElementsState = elements; // Get current elements before async operations change it
        let historyShouldBeRecorded = false;

        if (isPanning) { setIsPanning(false); }
        else if (isDrawing && currentPath) {
            if (currentPath.type === 'path' && currentPath.points.length > 1) {
                const order = elements.length > 0 ? Math.max(...elements.map(e => e.order), -1) + 1 : 0;
                const tempId = `temp_path_${Date.now()}`;
                const newPathElement: PathElementClient = { ...currentPath, id: tempId, order, isSelected: false };
                newElementsState = [...elements, newPathElement];
                setElements(newElementsState);
                historyShouldBeRecorded = true;
                persistElementAddition(newPathElement); // Async, don't await for immediate UI responsiveness
            }
            setIsDrawing(false); setCurrentPath(null);
        }
        else if (isDraggingElement && selectedElementId) {
            setIsDraggingElement(false);
            const finalElementState = elements.find(el => el.id === selectedElementId);
            if (finalElementState) {
                newElementsState = [...elements]; // Capture the state after dragging
                historyShouldBeRecorded = true;
                persistElementUpdate(finalElementState); // Async
            }
        }
        if (historyShouldBeRecorded) {
            recordHistory(newElementsState);
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => startInteraction(e.clientX, e.clientY);
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => moveInteraction(e.clientX, e.clientY);
    const handleMouseUp = () => endInteraction();
    const handleMouseLeave = () => { if(isDrawing || isDraggingElement) endInteraction(); }; // End drawing/dragging if mouse leaves

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); if (e.touches.length === 1) startInteraction(e.touches[0].clientX, e.touches[0].clientY, true); };
    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); if (e.touches.length === 1) moveInteraction(e.touches[0].clientX, e.touches[0].clientY); };
    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); endInteraction(); };


    const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (selectedTool !== 'select' || editingTextElementId) return;
        const coords = getCanvasCoords(e.clientX, e.clientY);
        const clickedElement = findElementAt(coords.x, coords.y);
        if (clickedElement && clickedElement.type === 'text') {
            setElements(prev => prev.map(el => el.id === clickedElement.id ? {...el, isEditing: true, isSelected: true} : el));
            setEditingTextElementId(clickedElement.id);
            setSelectedElementId(clickedElement.id);
        }
    };

    useEffect(() => {
        if (editingTextElementId && textInputRef.current) {
            const el = elements.find(e => e.id === editingTextElementId && e.type === 'text') as TextElementClient | undefined;
            if(el?.isEditing) { textInputRef.current.value = el.text; textInputRef.current.focus(); textInputRef.current.style.height = 'auto'; textInputRef.current.style.height = `${textInputRef.current.scrollHeight}px`; }
        }
    }, [editingTextElementId, elements]);

    const handleTextEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (editingTextElementId) {
            const newText = e.target.value;
            setElements(prev => prev.map(el => el.id === editingTextElementId && el.type === 'text' ? {...el, text: newText } : el ));
            e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`;
        }
    };

    const handleTextEditBlur = async () => {
        if (editingTextElementId) {
            const elementIndex = elements.findIndex(el => el.id === editingTextElementId);
            if (elementIndex === -1) { setEditingTextElementId(null); return; }
            const element = elements[elementIndex];
            if (element.type !== 'text') { setEditingTextElementId(null); return; }

            // Optimistically set isEditing to false
            const elementsWithTextCommitted = elements.map(el => el.id === editingTextElementId ? { ...el, isEditing: false, isSelected: false } : el);
            setElements(elementsWithTextCommitted);

            if (element.text.trim() === "" && typeof element.id === 'string' && element.id.startsWith("temp_text_")) {
                setElements(prev => prev.filter(el => el.id !== editingTextElementId)); // Removed, no history
            } else {
                recordHistory(elementsWithTextCommitted); // Record AFTER optimistic UI update including isEditing: false
                const committedElement = elementsWithTextCommitted[elementIndex] as TextElementClient;
                const { id, order, image, isSelected, isEditing, ...dataForDb } = committedElement;
                if (typeof element.id === 'string' && element.id.startsWith("temp_text_")) {
                    persistElementAddition(committedElement); // Pass full client element with temp ID
                } else {
                    persistElementUpdate(committedElement);
                }
            }
            setEditingTextElementId(null);
            setSelectedElementId(null);
        }
    };

    const processAndAddImageFile = async (file: File, dropCoords?: Point) => {
        const reader = new FileReader();
        reader.onload = (e_reader) => {
            if (!e_reader.target?.result) return; const dataUrl = e_reader.target.result as string;
            const img = new Image();
            img.onload = async () => {
                let x, y; const canvas = canvasRef.current!; const dpr = window.devicePixelRatio || 1;
                const maxWidthOrHeight = 300; let newWidth = img.width, newHeight = img.height;
                if (img.width > maxWidthOrHeight || img.height > maxWidthOrHeight) {
                    if (img.width > img.height) { newWidth = maxWidthOrHeight; newHeight = (img.height / img.width) * maxWidthOrHeight; }
                    else { newHeight = maxWidthOrHeight; newWidth = (img.width / img.height) * maxWidthOrHeight; }
                }
                if (dropCoords) { x = dropCoords.x - newWidth / 2; y = dropCoords.y - newHeight / 2; }
                else { x = (canvas.width / (2*dpr) - panOffset.x) / zoomLevel - newWidth / 2; y = (canvas.height / (2*dpr) - panOffset.y) / zoomLevel - newHeight / 2;}

                const order = elements.length > 0 ? Math.max(...elements.map(e => e.order), -1) + 1 : 0;
                const tempId = `temp_image_${Date.now()}`;
                const newImageElement: ImageElementClient = { type: 'image', x, y, width: newWidth, height: newHeight, imageUrl: dataUrl, id: tempId, order, image: img, isSelected: false };

                setElements(prev => [...prev, newImageElement]);
                recordHistory([...elements, newImageElement]);
                persistElementAddition(newImageElement);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    };

    const handleImageUploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) processAndAddImageFile(file); e.target.value = ""; };
    const handleDrop = useCallback((event: React.DragEvent<HTMLCanvasElement>) => { event.preventDefault(); event.stopPropagation(); canvasRef.current?.classList.remove('drag-over-active'); if (event.dataTransfer.files?.[0]?.type.startsWith('image/')) { processAndAddImageFile(event.dataTransfer.files[0], getCanvasCoords(event.clientX, event.clientY)); } event.dataTransfer.clearData(); }, [panOffset, zoomLevel, elements, whiteboardId, recordHistory]);
    const handlePaste = useCallback(async (event: ClipboardEvent) => { const items = event.clipboardData?.items; if (!items) return; for (let i = 0; i < items.length; i++) { if (items[i].type.indexOf('image') !== -1) { const blob = items[i].getAsFile(); if (blob) { const canvas = canvasRef.current!; const dpr = window.devicePixelRatio || 1; const centerX = (canvas.width / (2*dpr) - panOffset.x) / zoomLevel; const centerY = (canvas.height / (2*dpr) - panOffset.y) / zoomLevel; processAndAddImageFile(blob, {x: centerX, y: centerY}); event.preventDefault(); return; }}} }, [panOffset, zoomLevel, elements, whiteboardId, recordHistory]);
    useEffect(() => { document.addEventListener('paste', handlePaste); return () => document.removeEventListener('paste', handlePaste); }, [handlePaste]);

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => { e.preventDefault(); const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const worldXBeforeZoom = (mouseX - panOffset.x) / zoomLevel; const worldYBeforeZoom = (mouseY - panOffset.y) / zoomLevel; const delta = e.deltaY * SCROLL_SENSITIVITY * -1; const scaleAmount = 1 + delta; let newZoomLevel = zoomLevel * scaleAmount; newZoomLevel = Math.max(MIN_ZOOM, Math.min(newZoomLevel, MAX_ZOOM)); const newPanX = mouseX - worldXBeforeZoom * newZoomLevel; const newPanY = mouseY - worldYBeforeZoom * newZoomLevel; setZoomLevel(newZoomLevel); setPanOffset({ x: newPanX, y: newPanY }); };
    const handleUndo = () => { if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setElements([...history[newIndex]]); }};
    const handleRedo = () => { if (historyIndex < history.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setElements([...history[newIndex]]); }};

    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
        const dpr = window.devicePixelRatio || 1;
        ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0, canvas.width, canvas.height); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,canvas.width, canvas.height); ctx.restore();
        ctx.save(); ctx.translate(panOffset.x * dpr, panOffset.y * dpr); ctx.scale(zoomLevel * dpr, zoomLevel * dpr);
        const sortedElements = [...elements].sort((a, b) => a.order - b.order);
        sortedElements.forEach(element => drawElement(ctx, element));
        if (currentPath) { drawElement(ctx, { id: 'temp-path', order: elements.length + 1, ...currentPath }); }
        ctx.restore();
    }, [elements, currentPath, panOffset, zoomLevel, selectedElementId, editingTextElementId]);

    useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

    const drawElement = (ctx: CanvasRenderingContext2D, element: WhiteboardElementClient) => {
        ctx.save(); const isSelected = element.id === selectedElementId && selectedTool === 'select';
        if (element.type === 'path') {
            ctx.beginPath(); ctx.strokeStyle = element.color; ctx.lineWidth = element.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = element.compositeOperation || 'source-over' as GlobalCompositeOperation;
            element.points.forEach((p, i) => (i === 0) ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
        } else if (element.type === 'image' && element.image?.complete && element.image.naturalHeight !== 0) {
            ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
            if (isSelected) { ctx.strokeStyle = 'rgba(0, 100, 255, 0.7)'; ctx.lineWidth = 2 / zoomLevel; ctx.strokeRect(element.x, element.y, element.width, element.height); }
        } else if (element.type === 'text') {
            if (element.id === editingTextElementId && element.isEditing) { ctx.restore(); return; }
            ctx.fillStyle = element.color; ctx.font = `${element.fontSize}px ${element.fontFamily}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            element.text.split('\n').forEach((line, i) => { ctx.fillText(line, element.x, element.y + (i * element.fontSize * 1.2)); });
            if (isSelected) {
                ctx.strokeStyle = 'rgba(0, 100, 255, 0.7)'; ctx.lineWidth = 2 / zoomLevel;
                const firstLine = element.text.split('\n')[0] || " "; const metrics = ctx.measureText(firstLine);
                const approxHeight = element.text.split('\n').length * element.fontSize * 1.2;
                ctx.strokeRect(element.x - (2/zoomLevel), element.y - (2/zoomLevel), metrics.width + (4/zoomLevel), approxHeight + (4/zoomLevel));
            }
        }
        ctx.restore();
    };

    useEffect(() => {
        const canvas = canvasRef.current; const parent = canvas?.parentElement; if (!canvas || !parent) return;
        const resizeObserver = new ResizeObserver(() => {
            const { width, height } = parent.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
            canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; redrawCanvas();
        });
        resizeObserver.observe(parent);
        const { width, height } = parent.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; redrawCanvas();
        return () => resizeObserver.disconnect();
    }, [redrawCanvas]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (editingTextElementId) return;
            if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedElementId) { e.preventDefault(); deleteElementMutation({ elementID: selectedElementId as Id<"whiteboardElements"> }); }}
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
        };
        window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElementId, editingTextElementId, handleUndo, handleRedo, elements, deleteElementMutation]);

    const getTextAreaStyle = (): React.CSSProperties => {
        if (!editingTextElementId) return { display: 'none' };
        const element = elements.find(el => el.id === editingTextElementId && el.type === 'text' && el.isEditing) as TextElementClient | undefined;
        if (!element) return { display: 'none' };
        const canvas = canvasRef.current; let approxWidth = 150; const dpr = window.devicePixelRatio || 1;
        if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) {
            ctx.font = `${element.fontSize * zoomLevel * dpr}px ${element.fontFamily}`; let maxWidth = 0;
            element.text.split('\n').forEach(line => { const metrics = ctx.measureText(line || " "); maxWidth = Math.max(maxWidth, metrics.width); });
            approxWidth = Math.max(50 * zoomLevel, (maxWidth / dpr) + (10 * zoomLevel));
        }}
        return { position: 'absolute', left: (element.x * zoomLevel) + panOffset.x, top: (element.y * zoomLevel) + panOffset.y,
            fontFamily: element.fontFamily, fontSize: element.fontSize * zoomLevel, lineHeight: `${element.fontSize * 1.2 * zoomLevel}px`,
            color: element.color, background: 'rgba(255, 255, 255, 0.95)', border: `1px dashed ${element.color}`, padding: `${2 * zoomLevel}px`,
            margin: 0, resize: 'none', overflow: 'hidden', whiteSpace: 'pre-wrap', outline: 'none', minWidth: `${50 * zoomLevel}px`, width: `${approxWidth}px`, zIndex: 1000,
        };
    };

    if (!whiteboardId) return <div className="flex items-center justify-center h-screen text-red-500 p-4 text-center">Whiteboard ID is required. Please check the URL.</div>;
    if (whiteboardDataQuery === undefined && !clientError) return <div className="flex items-center justify-center h-screen">Loading whiteboard...</div>;
    if (clientError) return ( <div className="flex flex-col items-center justify-center h-screen p-4 text-center"> <h2 className="text-2xl font-semibold text-red-600 mb-3">Error</h2> <p className="text-slate-700">{clientError}</p> </div> );

    return (
        <div className="flex flex-col h-screen w-full bg-slate-100 dark:bg-slate-900">
            <WhiteboardHeader />
            <div className="flex flex-1 w-full overflow-hidden">
                <WhiteboardSidebar
                    whiteboardID={whiteboardId}
                    selectedTool={selectedTool}
                    setSelectedTool={setSelectedTool}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onHint={() => alert('Hint: Not implemented')}
                    onCheck={() => alert('Check: Not implemented')}
                    onSubmit={() => alert('Submit: Not implemented')}
                    onImageToolSelect={() => document.getElementById('image-upload-input-hidden')?.click()}
                    currentColor={currentColor}
                    setCurrentColor={setCurrentColor}
                />

                <div className={"flex w-full"}>
                    <div className="flex-1 relative bg-white dark:bg-slate-800 shadow-inner overflow-hidden"
                         style={{ touchAction: 'none', cursor: isPanning ? 'grabbing' : (selectedTool === 'select' ? (isDraggingElement ? 'grabbing' : (selectedElementId ? 'move' : 'grab')) : 'crosshair')}}
                         onDragOver={(e) => { e.preventDefault(); canvasRef.current?.classList.add('drag-over-active');}}
                         onDragLeave={() => canvasRef.current?.classList.remove('drag-over-active')} onDrop={handleDrop} >
                        <canvas ref={canvasRef}
                                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
                                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd} /* Added TouchCancel */
                                onWheel={handleWheel} onDoubleClick={handleDoubleClick}
                                style={{ display: 'block', width: '100%', height: '100%' }} />
                        <input type="file" accept="image/*" id="image-upload-input-hidden" className="hidden" onChange={handleImageUploadInputChange} />
                        {editingTextElementId && elements.find(el => el.id === editingTextElementId && el.type === 'text' && el.isEditing) && (
                            <textarea ref={textInputRef} onBlur={handleTextEditBlur} onChange={handleTextEditChange}
                                      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }}}
                                      style={getTextAreaStyle()} />
                        )}
                    </div>

                    <SidebarChatbot whiteboardID={whiteboardId} />
                </div>
            </div>
        </div>
    );
}