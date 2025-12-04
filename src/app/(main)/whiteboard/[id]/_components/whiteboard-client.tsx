
// @ts-nocheck
"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { useQuery, useMutation, useConvex } from "convex/react"
import type { Id } from "../../../../../../convex/_generated/dataModel" // Adjust path as needed
import { api } from "../../../../../../convex/_generated/api" // Adjust path as needed
import type {
    elementData as ConvexElementDataUnion,
    pathProperties as SchemaPathProps,
    imageProperties as SchemaImageProps,
    textProperties as SchemaTextProps,
} from "../../../../../../convex/schema" // Adjust path

// Placeholder imports - ensure these components exist and props match
import WhiteboardHeader from "./whiteboard-header"
import WhiteboardSidebar from "./whiteboard-sidebar"
import SidebarChatbot from "@/app/(main)/whiteboard/[id]/_components/sidebar-chatbot/sidebar-chatbot"
import { Loader } from "lucide-react" // Adjust path
import TextEditPopover from "@/components/text-edit-popover";
import MarkdownRenderer from "@/components/markdown-renderer";
import SolveItAllProvider from "@/components/providers/solve-it-all-provider";
import ProactiveTutorProvider from "@/components/ai-tutor/proactive-tutor-provider";

// --- Constants ---
const MIN_ZOOM = 0.1
const MAX_ZOOM = 10
const SCROLL_SENSITIVITY = 0.0008
const DOUBLE_TAP_DELAY = 300 // ms
const PEN_STROKE_WIDTH = 3
const HIGHLIGHT_STROKE_WIDTH = 20
const ERASER_STROKE_WIDTH = 30
const DEFAULT_TEXT_FONT_SIZE = 16
const DEFAULT_TEXT_FONT_FAMILY = "Arial"
const HANDLE_SIZE_ON_SCREEN = 8 // Screen pixels
const MIN_IMAGE_DIMENSION_WORLD = 20 // Min width/height for an image in world units
const TEXTAREA_MIN_WIDTH_ZOOMED = 50 // Min width for textarea at zoom 1
const TEXTAREA_PADDING_ZOOMED = 10 // Padding for textarea at zoom 1
const SELECTION_BORDER_COLOR = "rgba(0, 100, 255, 0.9)"
const SELECTION_LINE_WIDTH_DIVISOR = 2 // e.g., 2 / zoomLevel
const MAX_INITIAL_IMAGE_DIM = 300 // Max initial dimension (width or height) for new images in world units

// --- Types ---
interface Point {
    x: number
    y: number
}

interface ElementBaseClient {
    id: Id<"whiteboardElements"> | string
    order: number
    isSelected?: boolean
}

export interface PathElementClient extends ElementBaseClient {
    type: "path"
    points: Point[]
    color: string
    strokeWidth: number
    compositeOperation?: string
}

export interface ImageElementClient extends ElementBaseClient {
    type: "image"
    x: number
    y: number
    width: number
    height: number
    storageId: Id<"_storage"> | string // string for temp during upload
    imageUrl?: string
    image?: HTMLImageElement
    isLoading?: boolean
    // altText?: string;
}

export interface TextElementClient extends ElementBaseClient {
    type: "text"
    x: number
    y: number
    text: string
    color: string
    fontSize: number
    fontFamily: string
    isEditing?: boolean
}

export type WhiteboardElementClient = PathElementClient | ImageElementClient | TextElementClient

function isPathDataFromSchema(data: ConvexElementDataUnion): data is typeof SchemaPathProps.type {
    return data.type === "path"
}
function isImageDataFromSchema(data: ConvexElementDataUnion): data is typeof SchemaImageProps.type {
    return data.type === "image"
}
function isTextDataFromSchema(data: ConvexElementDataUnion): data is typeof SchemaTextProps.type {
    return data.type === "text"
}

const rgbaColor = (hex: string, alpha: number): string => {
    if (!hex || !hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return `rgba(0,0,0,${alpha})`
    let normalizedHex = hex
    if (hex.length === 4) normalizedHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalizedHex)
    if (!result)
        return `rgba(${Number.parseInt(result[1], 16)}, ${Number.parseInt(result[2], 16)}, ${Number.parseInt(result[3], 16)}, ${alpha})`
}

const HANDLE_SIZE_WORLD = (zoom: number) => HANDLE_SIZE_ON_SCREEN / zoom

type ResizeHandleName = "tl" | "t" | "tr" | "l" | "r" | "bl" | "b" | "br"
interface ResizeHandleDef {
    name: ResizeHandleName
    cursor: string
    getPosition: (el: ImageElementClient, handleSize: number) => { x: number; y: number; width: number; height: number }
    resize: (
        originalElement: ImageElementClient,
        currentMouseWorld: Point,
        startMouseWorld: Point,
        maintainAspectRatio: boolean,
    ) => Partial<Pick<ImageElementClient, "x" | "y" | "width" | "height">>
}

const resizeHandlesConfig: ResizeHandleDef[] = [
    {
        name: "tl",
        cursor: "nwse-resize",
        getPosition: (el, s) => ({ x: el.x - s / 2, y: el.y - s / 2, width: s, height: s }),
        resize: (orig, curr, start, aspect) => {
            const dx = curr.x - start.x
            const dy = curr.y - start.y
            let newX = orig.x + dx
            let newY = orig.y + dy
            let newWidth = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.width - dx)
            let newHeight = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.height - dy)
            if (aspect && orig.width > 0 && orig.height > 0) {
                const ratio = orig.width / orig.height
                if (Math.abs(dx) * orig.height > Math.abs(dy) * orig.width) {
                    newHeight = newWidth / ratio
                } else {
                    newWidth = newHeight * ratio
                }
                newX = orig.x + orig.width - newWidth
                newY = orig.y + orig.height - newHeight
            }
            return {
                x: newX,
                y: newY,
                width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth),
                height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight),
            }
        },
    },
    {
        name: "t",
        cursor: "ns-resize",
        getPosition: (el, s) => ({ x: el.x + el.width / 2 - s / 2, y: el.y - s / 2, width: s, height: s }),
        resize: (orig, curr, start, aspect) => {
            const dy = curr.y - start.y
            const newY = orig.y + dy
            const newHeight = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.height - dy)
            let newWidth = orig.width
            if (aspect && orig.width > 0 && orig.height > 0) {
                newWidth = newHeight * (orig.width / orig.height)
                const newX = orig.x + (orig.width - newWidth) / 2
                return {
                    x: newX,
                    y: newY,
                    width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth),
                    height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight),
                }
            }
            return { y: newY, height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight) }
        },
    },
    {
        name: "tr",
        cursor: "nesw-resize",
        getPosition: (el, s) => ({ x: el.x + el.width - s / 2, y: el.y - s / 2, width: s, height: s }),
        resize: (orig, curr, start, aspect) => {
            const dx = curr.x - start.x
            const dy = curr.y - start.y
            let newY = orig.y + dy
            let newWidth = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.width + dx)
            let newHeight = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.height - dy)
            if (aspect && orig.width > 0 && orig.height > 0) {
                const ratio = orig.width / orig.height
                if (Math.abs(dx) * orig.height > Math.abs(dy) * orig.width) {
                    newHeight = newWidth / ratio
                } else {
                    newWidth = newHeight * ratio
                }
                newY = orig.y + orig.height - newHeight
            }
            return {
                y: newY,
                width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth),
                height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight),
            }
        },
    },
    {
        name: "l",
        cursor: "ew-resize",
        getPosition: (el, s) => ({ x: el.x - s / 2, y: el.y + el.height / 2 - s / 2, width: s, height: s }),
        resize: (orig, curr, start, aspect) => {
            const dx = curr.x - start.x
            const newX = orig.x + dx
            const newWidth = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.width - dx)
            let newHeight = orig.height
            if (aspect && orig.width > 0 && orig.height > 0) {
                newHeight = newWidth / (orig.width / orig.height)
                const newY = orig.y + (orig.height - newHeight) / 2
                return {
                    x: newX,
                    y: newY,
                    width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth),
                    height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight),
                }
            }
            return { x: newX, width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth) }
        },
    },
    {
        name: "r",
        cursor: "ew-resize",
        getPosition: (el, s) => ({ x: el.x + el.width - s / 2, y: el.y + el.height / 2 - s / 2, width: s, height: s }),
        resize: (orig, curr, start, aspect) => {
            const dx = curr.x - start.x
            const newWidth = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.width + dx)
            let newHeight = orig.height
            if (aspect && orig.width > 0 && orig.height > 0) {
                newHeight = newWidth / (orig.width / orig.height)
                const newY = orig.y + (orig.height - newHeight) / 2
                return {
                    y: newY,
                    width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth),
                    height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight),
                }
            }
            return { width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth) }
        },
    },
    {
        name: "bl",
        cursor: "nesw-resize",
        getPosition: (el, s) => ({ x: el.x - s / 2, y: el.y + el.height - s / 2, width: s, height: s }),
        resize: (orig, curr, start, aspect) => {
            const dx = curr.x - start.x
            const dy = curr.y - start.y
            let newX = orig.x + dx
            let newWidth = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.width - dx)
            let newHeight = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.height + dy)
            if (aspect && orig.width > 0 && orig.height > 0) {
                const ratio = orig.width / orig.height
                if (Math.abs(dx) * orig.height > Math.abs(dy) * orig.width) {
                    newHeight = newWidth / ratio
                } else {
                    newWidth = newHeight * ratio
                }
                newX = orig.x + orig.width - newWidth
            }
            return {
                x: newX,
                width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth),
                height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight),
            }
        },
    },
    {
        name: "b",
        cursor: "ns-resize",
        getPosition: (el, s) => ({ x: el.x + el.width / 2 - s / 2, y: el.y + el.height - s / 2, width: s, height: s }),
        resize: (orig, curr, start, aspect) => {
            const dy = curr.y - start.y
            const newHeight = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.height + dy)
            let newWidth = orig.width
            if (aspect && orig.width > 0 && orig.height > 0) {
                newWidth = newHeight * (orig.width / orig.height)
                const newX = orig.x + (orig.width - newWidth) / 2
                return {
                    x: newX,
                    width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth),
                    height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight),
                }
            }
            return { height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight) }
        },
    },
    {
        name: "br",
        cursor: "nwse-resize",
        getPosition: (el, s) => ({ x: el.x + el.width - s / 2, y: el.y + el.height - s / 2, width: s, height: s }),
        resize: (orig, curr, start, aspect) => {
            const dx = curr.x - start.x
            const dy = curr.y - start.y
            let newWidth = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.width + dx)
            let newHeight = Math.max(MIN_IMAGE_DIMENSION_WORLD, orig.height + dy)
            if (aspect && orig.width > 0 && orig.height > 0) {
                const ratio = orig.width / orig.height
                if (Math.abs(dx) * orig.height > Math.abs(dy) * orig.width) {
                    newHeight = newWidth / ratio
                } else {
                    newWidth = newHeight * ratio
                }
            }
            return {
                width: Math.max(MIN_IMAGE_DIMENSION_WORLD, newWidth),
                height: Math.max(MIN_IMAGE_DIMENSION_WORLD, newHeight),
            }
        },
    },
]

export default function WhiteboardClient({ whiteboardId }: { whiteboardId?: Id<"whiteboards"> }) {
    const convex = useConvex()

    const [elements, setElements] = useState<WhiteboardElementClient[]>([])
    const [selectedTool, setSelectedTool] = useState("select")
    const [currentColor, setCurrentColor] = useState("#000000")
    const [zoomLevel, setZoomLevel] = useState(1)
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })

    const [isDrawing, setIsDrawing] = useState(false)
    const [isPanning, setIsPanning] = useState(false)
    const [panStart, setPanStart] = useState({ x: 0, y: 0 })
    const [currentPath, setCurrentPath] = useState<Omit<PathElementClient, "id" | "order"> | null>(null)

    const [selectedElementId, setSelectedElementId] = useState<string | Id<"whiteboardElements"> | null>(null)
    const [editingTextElementId, setEditingTextElementId] = useState<string | Id<"whiteboardElements"> | null>(null)

    const [isDraggingElement, setIsDraggingElement] = useState(false)
    const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

    const [resizingElementInfo, setResizingElementInfo] = useState<{
        id: Id<"whiteboardElements"> | string
        handle: ResizeHandleName
        originalElement: ImageElementClient
        startMouseWorld: Point
        shiftKey: boolean
    } | null>(null)
    const [hoveredResizeHandle, setHoveredResizeHandle] = useState<ResizeHandleName | null>(null)
    const [textPopover, setTextPopover] = useState<{
        visible: boolean
        x: number
        y: number
        elementId: string | Id<"whiteboardElements"> | null
    } | null>(null)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const textInputRef = useRef<HTMLTextAreaElement>(null)
    const imageUploadInputRef = useRef<HTMLInputElement>(null)
    const markdownContainerRef = useRef<HTMLDivElement>(null)

    const [history, setHistory] = useState<WhiteboardElementClient[][]>([[]])
    const [historyIndex, setHistoryIndex] = useState(0)

    const [clientError, setClientError] = useState<string | null>(null)
    const [whiteboardTopic, setWhiteboardTopic] = useState<string | undefined>(undefined)
    const lastTap = useRef(0)

    const whiteboardDataQuery = useQuery(
        api.whiteboardActions.getWhiteboardContent,
        whiteboardId ? { whiteboardID: whiteboardId as Id<"whiteboards"> } : "skip",
    )
    const addElementMutation = useMutation(api.whiteboardActions.addElement)
    const updateElementMutation = useMutation(api.whiteboardActions.updateElement)
    const deleteElementMutation = useMutation(api.whiteboardActions.deleteElement)
    const generateUploadUrlMutation = useMutation(api.whiteboardActions.generateUploadUrl)
    // Using addImageElementAfterUpload from convex/whiteboardActions for clarity
    const addImageElementDbMutation = useMutation(api.whiteboardActions.addImageElementAfterUpload)

    const recordHistory = useCallback(
        (currentElementsSnapshot: WhiteboardElementClient[]) => {
            const snapshotToStore = currentElementsSnapshot.map((el) => {
                if (el.type === "path") return { ...el, points: el.points.map((p) => ({ ...p })) }
                // For images, ensure HTMLImageElement is not stored directly in history if it causes issues with JSON.stringify or deep copies
                // It's better to re-create/re-load it if needed from imageUrl or storageId.
                // For simplicity, we'll keep it for now, assuming it's handled or doesn't break things.
                if (el.type === "image") {
                    const { image, ...rest } = el
                    return rest
                }
                return { ...el }
            })

            const newHistory = history.slice(0, historyIndex + 1)
            newHistory.push(snapshotToStore)
            setHistory(newHistory)
            setHistoryIndex(newHistory.length - 1)
        },
        [history, historyIndex],
    )

    useEffect(() => {
        if (!whiteboardId) {
            setClientError("Whiteboard ID is missing.")
            return
        }
        if (whiteboardDataQuery === undefined) return

        if (
            whiteboardDataQuery === null ||
            whiteboardDataQuery.status === "id_missing" ||
            whiteboardDataQuery.status === "not_found"
        ) {
            setClientError(`Whiteboard not found or access denied (ID: ${whiteboardId}).`)
            setElements([])
            setHistory([[]])
            setHistoryIndex(0)
            setWhiteboardTopic(undefined)
            return
        }

        if (whiteboardDataQuery.status === "success") {
            setClientError(null)
            setWhiteboardTopic(whiteboardDataQuery.whiteboard?.topic)

            const loadPromises = whiteboardDataQuery.elements.map(
                async (dbElement): Promise<WhiteboardElementClient | null> => {
                    const baseClientProps = { id: dbElement._id, order: dbElement.order, isSelected: false }
                    const elData = dbElement.element

                    if (isImageDataFromSchema(elData)) {
                        let imageUrl: string | undefined | null = undefined // null if getUrl fails
                        try {
                            imageUrl = await convex.query(api.whiteboardActions.getImageUrl, { storageId: elData.storageId })
                            if (!imageUrl) {
                                console.warn(`Image URL for ${elData.storageId} is null. File might be missing or inaccessible.`)
                            }
                        } catch (error) {
                            console.error(`Failed to load image URL for ${elData.storageId}:`, error)
                            toast.error(`Could not load image: ${elData.storageId.substring(0, 6)}...`)
                        }

                        return new Promise((resolve) => {
                            if (!imageUrl) {
                                // If URL retrieval failed or is null
                                resolve({ ...baseClientProps, ...elData, imageUrl: undefined, isLoading: false, image: undefined })
                                return
                            }
                            const img = new Image()
                            img.onload = () =>
                                resolve({
                                    ...baseClientProps,
                                    ...elData,
                                    image: img,
                                    imageUrl,
                                    width: elData.width || img.naturalWidth,
                                    height: elData.height || img.naturalHeight,
                                    isLoading: false,
                                })
                            img.onerror = () => {
                                console.error("Image data could not be rendered from URL:", imageUrl)
                                resolve({ ...baseClientProps, ...elData, imageUrl, isLoading: false, image: undefined })
                            }
                            img.src = imageUrl
                        })
                    } else if (isPathDataFromSchema(elData)) {
                        return { ...baseClientProps, ...elData } as PathElementClient
                    } else if (isTextDataFromSchema(elData)) {
                        return { ...baseClientProps, ...elData, isEditing: false } as TextElementClient
                    }
                    return null
                },
            )

            Promise.all(loadPromises)
                .then((loadedClientElements) => {
                    const validElements = loadedClientElements.filter((el) => el !== null) as WhiteboardElementClient[]
                    setElements(validElements)
                    if (history.length === 1 && history[0].length === 0 && validElements.length > 0) {
                        recordHistory(
                            validElements.map((el) => {
                                // Deep copy for initial history
                                if (el.type === "image") {
                                    const { image, ...rest } = el
                                    return rest
                                }
                                return { ...el }
                            }),
                        )
                    }
                })
                .catch((err) => {
                    console.error("Error processing loaded elements:", err)
                    toast.error("Error displaying some whiteboard elements.")
                })
        }
    }, [whiteboardDataQuery, whiteboardId, convex]) // Removed history & recordHistory, as it was causing loop

    const getCanvasCoords = useCallback(
        (clientX: number, clientY: number): Point => {
            const canvas = canvasRef.current
            if (!canvas) return { x: 0, y: 0 }
            const rect = canvas.getBoundingClientRect()
            return {
                x: (clientX - rect.left - panOffset.x) / zoomLevel,
                y: (clientY - rect.top - panOffset.y) / zoomLevel,
            }
        },
        [panOffset.x, panOffset.y, zoomLevel],
    )

    const mapToDbElementSchema = (element: WhiteboardElementClient): ConvexElementDataUnion => {
        // Remove client-side properties that aren't in the schema
        const { id, order, isSelected, isEditing, image, imageUrl, isLoading, ...dataForDb } = element

        if (dataForDb.type === "image") {
            const { x, y, width, height, storageId } = dataForDb as Omit<
                ImageElementClient,
                "id" | "order" | "isSelected" | "image" | "imageUrl" | "isLoading"
            >
            if (typeof storageId !== "string" || storageId.startsWith("temp_")) {
                throw new Error("Attempting to save image element without a valid storageId.")
            }
            return { type: "image", x, y, width, height, storageId: storageId as Id<"_storage"> }
        }

        return dataForDb as ConvexElementDataUnion
    }

    const persistElementAddition = async (elementToAdd: WhiteboardElementClient) => {
        if (!whiteboardId) {
            toast.error("Cannot save: Whiteboard ID missing.")
            return elementToAdd.id
        }
        const castedWbId = whiteboardId as Id<"whiteboards">

        try {
            let newId
            if (elementToAdd.type === "image") {
                // Use the specific mutation for adding image elements
                // This ensures type safety and that storageId is correctly handled
                const { id: tempId, order, x, y, width, height, storageId, type, ...rest } = elementToAdd as ImageElementClient
                if (typeof storageId !== "string" || storageId.startsWith("temp_"))
                    throw new Error("Invalid storageId for image persistence")

                newId = await addImageElementDbMutation({
                    whiteboardID: castedWbId,
                    order,
                    x,
                    y,
                    width,
                    height,
                    storageId: storageId as Id<"_storage">,
                })
            } else {
                const dbElementPayload = mapToDbElementSchema(elementToAdd)
                newId = await addElementMutation({
                    whiteboardID: castedWbId,
                    element: dbElementPayload,
                    order: elementToAdd.order,
                })
            }

            setElements((prev) => prev.map((el) => (el.id === elementToAdd.id ? { ...el, id: newId } : el)))
            setHistory((prevHistory) =>
                prevHistory.map((histState) => histState.map((el) => (el.id === elementToAdd.id ? { ...el, id: newId } : el))),
            )
            if (selectedElementId === elementToAdd.id) setSelectedElementId(newId)
            if (editingTextElementId === elementToAdd.id) setEditingTextElementId(newId)
            return newId
        } catch (error) {
            console.error("Failed to add element to Convex:", error)
            toast.error(`Failed to save new element: ${error.message}`)
            setElements((prev) => prev.filter((el) => el.id !== elementToAdd.id))
            return elementToAdd.id
        }
    }

    const persistElementUpdate = async (elementToUpdate: WhiteboardElementClient) => {
        if (!whiteboardId || (typeof elementToUpdate.id === "string" && elementToUpdate.id.startsWith("temp_"))) {
            if (!whiteboardId) toast.error("Cannot save update: Whiteboard ID missing.")
            else console.warn("Attempted to update a temp element:", elementToUpdate.id)
            return
        }

        try {
            const dbElementPayload = mapToDbElementSchema(elementToUpdate)
            await updateElementMutation({
                elementID: elementToUpdate.id as Id<"whiteboardElements">,
                updates: { element: dbElementPayload, order: elementToUpdate.order },
            })
        } catch (error) {
            console.error("Failed to update element in Convex:", error)
            toast.error(`Failed to save element update: ${error.message}`)
        }
    }

    const getHandleAtPoint = useCallback(
        (worldX: number, worldY: number, imageElement: ImageElementClient): ResizeHandleName | null => {
            const handleSize = HANDLE_SIZE_WORLD(zoomLevel)
            for (const handleDef of resizeHandlesConfig) {
                const handleBounds = handleDef.getPosition(imageElement, handleSize)
                if (
                    worldX >= handleBounds.x &&
                    worldX <= handleBounds.x + handleBounds.width &&
                    worldY >= handleBounds.y &&
                    worldY <= handleBounds.y + handleBounds.height
                ) {
                    return handleDef.name
                }
            }
            return null
        },
        [zoomLevel],
    )

    const findElementAt = useCallback(
        (worldX: number, worldY: number): WhiteboardElementClient | null => {
            const sortedElements = [...elements].sort((a, b) => b.order - a.order)
            const canvas = canvasRef.current
            const ctx = canvas?.getContext("2d")
            if (!ctx || !canvas) return null

            for (const el of sortedElements) {
                if (el.type === "image") {
                    if (worldX >= el.x && worldX <= el.x + el.width && worldY >= el.y && worldY <= el.y + el.height) return el
                } else if (el.type === "text") {
                    if (el.id === editingTextElementId && el.isEditing) continue

                    // For text, we need to check the rendered element's bounds
                    const markdownEl = document.getElementById(`markdown-text-${el.id}`)
                    if (markdownEl) {
                        const rect = markdownEl.getBoundingClientRect()
                        const canvasRect = canvas.getBoundingClientRect()

                        // Convert screen coordinates to world coordinates
                        const elLeft = (rect.left - canvasRect.left - panOffset.x) / zoomLevel
                        const elTop = (rect.top - canvasRect.top - panOffset.y) / zoomLevel
                        const elRight = (rect.right - canvasRect.left - panOffset.x) / zoomLevel
                        const elBottom = (rect.bottom - canvasRect.top - panOffset.y) / zoomLevel

                        if (worldX >= elLeft && worldX <= elRight && worldY >= elTop && worldY <= elBottom) {
                            return el
                        }
                    } else {
                        // Fallback if element not found - use approximate bounds
                        ctx.font = `${el.fontSize}px ${el.fontFamily}`
                        const lines = el.text.split("\n")
                        let textWidth = 0
                        lines.forEach((line) => (textWidth = Math.max(textWidth, ctx.measureText(line || " ").width)))
                        const textHeight = lines.length * el.fontSize * 1.2
                        if (worldX >= el.x && worldX <= el.x + textWidth && worldY >= el.y && worldY <= el.y + textHeight) return el
                    }
                } else if (el.type === "path") {
                    if (el.points.length < 1) continue
                    let minX = Number.POSITIVE_INFINITY,
                        maxX = Number.NEGATIVE_INFINITY,
                        minY = Number.POSITIVE_INFINITY,
                        maxY = Number.NEGATIVE_INFINITY
                    el.points.forEach((p) => {
                        minX = Math.min(minX, p.x)
                        maxX = Math.max(maxX, p.x)
                        minY = Math.min(minY, p.y)
                        maxY = Math.max(maxY, p.y)
                    })
                    const padding = Math.max(5 / zoomLevel, el.strokeWidth / 2 + 3 / zoomLevel)
                    if (
                        worldX >= minX - padding &&
                        worldX <= maxX + padding &&
                        worldY >= minY - padding &&
                        worldY <= maxY + padding
                    ) {
                        return el
                    }
                }
            }
            return null
        },
        [elements, zoomLevel, editingTextElementId, panOffset.x, panOffset.y],
    )

    const startInteraction = (clientX: number, clientY: number, shiftKey: boolean, isTouch = false) => {
        const coords = getCanvasCoords(clientX, clientY)

        if (editingTextElementId) {
            const targetIsTextarea =
                textInputRef.current && textInputRef.current.contains(document.elementFromPoint(clientX, clientY))
            if (!targetIsTextarea) {
                handleTextEditBlur()
            } else {
                return
            }
        }

        if (selectedTool === "select") {
            const currentSelectedElement = elements.find((el) => el.id === selectedElementId)
            if (currentSelectedElement?.type === "image") {
                const handleName = getHandleAtPoint(coords.x, coords.y, currentSelectedElement as ImageElementClient)
                if (handleName) {
                    setResizingElementInfo({
                        id: currentSelectedElement.id,
                        handle: handleName,
                        originalElement: { ...(currentSelectedElement as ImageElementClient) },
                        startMouseWorld: coords,
                        shiftKey: shiftKey,
                    })
                    setIsDraggingElement(false)
                    return
                }
            }

            const clickedElement = findElementAt(coords.x, coords.y)
            if (isTouch && clickedElement?.type === "text") {
                const now = Date.now()
                if (now - lastTap.current < DOUBLE_TAP_DELAY && selectedElementId === clickedElement.id) {
                    setElements((prev) =>
                        prev.map((el) =>
                            el.id === clickedElement.id ? { ...el, isEditing: true, isSelected: true } : { ...el, isEditing: false },
                        ),
                    )
                    setEditingTextElementId(clickedElement.id)
                    setSelectedElementId(clickedElement.id)

                    // Show popover at touch position
                    setTextPopover({
                        visible: true,
                        x: clientX,
                        y: clientY,
                        elementId: clickedElement.id,
                    })
                }
                lastTap.current = now
            } else if (clickedElement?.type === "text" && selectedTool === "select") {
                // For mouse clicks, select the text element first
                setSelectedElementId(clickedElement.id)
                setElements((prev) => prev.map((el) => ({ ...el, isSelected: el.id === clickedElement.id })))
            }

            setSelectedElementId(clickedElement ? clickedElement.id : null)
            setElements((prev) => prev.map((el) => ({ ...el, isSelected: el.id === clickedElement?.id })))

            if (clickedElement) {
                setIsDraggingElement(true)
                if (clickedElement.type === "image" || clickedElement.type === "text") {
                    dragStartOffsetRef.current = { x: coords.x - clickedElement.x, y: coords.y - clickedElement.y }
                } else if (clickedElement.type === "path") {
                    dragStartOffsetRef.current = { x: coords.x, y: coords.y }
                }
            } else {
                setIsPanning(true)
                setPanStart({ x: clientX, y: clientY })
            }
            return
        }

        setIsDrawing(true)
        if (selectedTool === "pen" || selectedTool === "eraser" || selectedTool === "highlight") {
            setCurrentPath({
                type: "path",
                points: [coords],
                color:
                    selectedTool === "eraser"
                        ? "#FFFFFF"
                        : selectedTool === "highlight"
                            ? rgbaColor(currentColor, 0.3)
                            : currentColor,
                strokeWidth:
                    selectedTool === "pen"
                        ? PEN_STROKE_WIDTH
                        : selectedTool === "eraser"
                            ? ERASER_STROKE_WIDTH
                            : HIGHLIGHT_STROKE_WIDTH,
                compositeOperation:
                    selectedTool === "eraser" ? "destination-out" : selectedTool === "highlight" ? "multiply" : "source-over",
            })
        } else if (selectedTool === "text") {
            setSelectedElementId(null)
            setElements((prev) => prev.map((el) => ({ ...el, isSelected: false })))
            const order = elements.length > 0 ? Math.max(...elements.map((el) => el.order), -1) + 1 : 0
            const tempId = `temp_text_${Date.now()}`
            const newTextElement: TextElementClient = {
                id: tempId,
                type: "text",
                x: coords.x,
                y: coords.y,
                text: "",
                color: currentColor,
                fontSize: DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                order,
                isEditing: true,
                isSelected: true,
            }
            setElements((prev) => [...prev, newTextElement])
            setSelectedElementId(tempId)
            setEditingTextElementId(tempId)

            // Show popover at click position
            setTextPopover({
                visible: true,
                x: clientX,
                y: clientY,
                elementId: tempId,
            })

            // Force focus on the text area in the next render cycle
            setTimeout(() => {
                if (textInputRef.current) {
                    textInputRef.current.focus()
                }
            }, 0)

            setIsDrawing(false)
        }
    }

    const moveInteraction = (clientX: number, clientY: number, shiftKey: boolean) => {
        const coords = getCanvasCoords(clientX, clientY)

        if (isPanning) {
            const dx = clientX - panStart.x
            const dy = clientY - panStart.y
            setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
            setPanStart({ x: clientX, y: clientY })
            return
        }

        if (resizingElementInfo) {
            const { id, handle, originalElement, startMouseWorld, shiftKey: initialShiftKey } = resizingElementInfo
            const handleDef = resizeHandlesConfig.find((h) => h.name === handle)
            if (handleDef) {
                const changes = handleDef.resize(originalElement, coords, startMouseWorld, initialShiftKey || shiftKey)
                setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...changes } : el)))
            }
            return
        }

        if (isDraggingElement && selectedElementId) {
            const element = elements.find((el) => el.id === selectedElementId)
            if (!element) return
            if (element.type === "image" || element.type === "text") {
                const newX = coords.x - dragStartOffsetRef.current.x
                const newY = coords.y - dragStartOffsetRef.current.y
                setElements((prev) => prev.map((el) => (el.id === selectedElementId ? { ...el, x: newX, y: newY } : el)))
            } else if (element.type === "path") {
                const dx = coords.x - dragStartOffsetRef.current.x
                const dy = coords.y - dragStartOffsetRef.current.y
                setElements((prev) =>
                    prev.map((el) =>
                        el.id === selectedElementId && el.type === "path"
                            ? { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
                            : el,
                    ),
                )
                dragStartOffsetRef.current = coords
            }
            return
        }

        if (isDrawing && currentPath?.type === "path") {
            setCurrentPath((prev) => (prev ? { ...prev, points: [...prev.points, coords] } : null))
        }

        if (selectedTool === "select" && !isPanning && !isDraggingElement && !resizingElementInfo) {
            const currentSelectedElement = elements.find((el) => el.id === selectedElementId)
            if (currentSelectedElement?.type === "image") {
                setHoveredResizeHandle(getHandleAtPoint(coords.x, coords.y, currentSelectedElement as ImageElementClient))
            } else {
                setHoveredResizeHandle(null)
            }
        } else {
            setHoveredResizeHandle(null)
        }
    }

    const endInteraction = async () => {
        let finalElementsStateForHistory = elements.map((el) => {
            if (el.type === "image") {
                const { image, ...rest } = el
                return rest
            } // Don't store HTMLImageElement in history
            return { ...el }
        })
        let historyShouldBeRecorded = false

        if (isPanning) {
            setIsPanning(false)
        } else if (isDrawing && currentPath) {
            if (currentPath.type === "path" && currentPath.points.length > 1) {
                const order = elements.length > 0 ? Math.max(...elements.map((e) => e.order), -1) + 1 : 0
                const tempId = `temp_path_${Date.now()}`
                const newPathElement: PathElementClient = { ...currentPath, id: tempId, order, isSelected: false }

                const elementsWithNewPath = [...elements, newPathElement]
                setElements(elementsWithNewPath)
                finalElementsStateForHistory = elementsWithNewPath.map((el) => ({ ...el }))
                historyShouldBeRecorded = true
                persistElementAddition(newPathElement)
            }
            setIsDrawing(false)
            setCurrentPath(null)
        } else if (isDraggingElement && selectedElementId) {
            setIsDraggingElement(false)
            const draggedElement = elements.find((el) => el.id === selectedElementId)
            if (draggedElement) {
                historyShouldBeRecorded = true
                persistElementUpdate(draggedElement)
            }
        } else if (resizingElementInfo) {
            const resizedElement = elements.find((el) => el.id === resizingElementInfo.id)
            if (resizedElement) {
                historyShouldBeRecorded = true
                persistElementUpdate(resizedElement)
            }
            setResizingElementInfo(null)
        }

        if (historyShouldBeRecorded) {
            const prevHistoryState = history[historyIndex]
            // A simple JSON.stringify check might be too slow for large states.
            // Consider a more efficient way if performance becomes an issue.
            if (JSON.stringify(prevHistoryState) !== JSON.stringify(finalElementsStateForHistory)) {
                recordHistory(finalElementsStateForHistory)
            }
        }
        setIsDrawing(false)
        setCurrentPath(null)
        setIsPanning(false)
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button === 1) {
            setSelectedElementId(null)
            setElements((prev) => prev.map((el) => ({ ...el, isSelected: false })))
            setIsPanning(true)
            setPanStart({ x: e.clientX, y: e.clientY })
            e.preventDefault()
            return
        }
        if (e.button === 0) startInteraction(e.clientX, e.clientY, e.shiftKey, false)
    }
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => moveInteraction(e.clientX, e.clientY, e.shiftKey)
    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button === 0 || e.button === 1) endInteraction()
    }
    const handleMouseLeave = () => {
        if (isDrawing || isDraggingElement || resizingElementInfo || isPanning) endInteraction()
        setHoveredResizeHandle(null)
    }

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        if (e.touches.length === 1) startInteraction(e.touches[0].clientX, e.touches[0].clientY, false, true)
    }
    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        if (e.touches.length === 1) moveInteraction(e.touches[0].clientX, e.touches[0].clientY, false)
    }
    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        endInteraction()
    }

    const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (selectedTool !== "select" || resizingElementInfo) return
        const coords = getCanvasCoords(e.clientX, e.clientY)
        const clickedElement = findElementAt(coords.x, coords.y)
        if (clickedElement?.type === "text") {
            setElements((prev) =>
                prev.map((el) =>
                    el.id === clickedElement.id
                        ? { ...el, isEditing: true, isSelected: true }
                        : { ...el, isSelected: false, isEditing: false },
                ),
            )
            setEditingTextElementId(clickedElement.id)
            setSelectedElementId(clickedElement.id)

            // Show popover at double-click position
            setTextPopover({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                elementId: clickedElement.id,
            })
        }
    }

    useEffect(() => {
        if (editingTextElementId && textInputRef.current) {
            const el = elements.find((e) => e.id === editingTextElementId && e.type === "text") as
                | TextElementClient
                | undefined
            if (el?.isEditing) {
                textInputRef.current.value = el.text
                textInputRef.current.focus()
                textInputRef.current.style.height = "auto"
                textInputRef.current.style.height = `${textInputRef.current.scrollHeight}px`
            }
        }
    }, [editingTextElementId, elements])

    const handleTextEditChange = (newText: string) => {
        if (editingTextElementId) {
            setElements((prev) =>
                prev.map((el) => (el.id === editingTextElementId && el.type === "text" ? { ...el, text: newText } : el)),
            )

            // Adjust textarea height if using the ref directly
            if (textInputRef.current) {
                textInputRef.current.style.height = "auto"
                textInputRef.current.style.height = `${textInputRef.current.scrollHeight}px`
            }
        }
    }

    const handleTextEditBlur = async () => {
        if (editingTextElementId) {
            const elementIndex = elements.findIndex((el) => el.id === editingTextElementId)
            if (elementIndex === -1) {
                setEditingTextElementId(null)
                setTextPopover(null)
                return
            }

            const textElement = elements[elementIndex] as TextElementClient

            const updatedElements = elements.map((el) =>
                el.id === editingTextElementId ? { ...el, isEditing: false, isSelected: true } : el,
            )
            setElements(updatedElements)

            if (
                textElement.text.trim() === "" &&
                typeof textElement.id === "string" &&
                textElement.id.startsWith("temp_text_")
            ) {
                setElements((prev) => prev.filter((el) => el.id !== editingTextElementId))
                setSelectedElementId(null)
            } else {
                const historyState = updatedElements.map((el) => ({ ...el })) // Make copy for history
                recordHistory(historyState)
                const committedElement = updatedElements[elementIndex] as TextElementClient
                if (typeof textElement.id === "string" && textElement.id.startsWith("temp_text_")) {
                    persistElementAddition(committedElement)
                } else {
                    persistElementUpdate(committedElement)
                }
                setSelectedElementId(committedElement.id)
            }
            setEditingTextElementId(null)
            setTextPopover(null)
        }
    }

    const handleTextResize = (fontSize: number) => {
        if (editingTextElementId) {
            setElements((prev) =>
                prev.map((el) => (el.id === editingTextElementId && el.type === "text" ? { ...el, fontSize } : el)),
            )
        }
    }

    const handleTextSave = () => {
        handleTextEditBlur()
    }

    const processAndAddImageFile = async (file: File, dropCoords?: Point) => {
        if (!whiteboardId) {
            toast.error("Whiteboard ID not found. Cannot add image.")
            return
        }
        const tempId = `temp_image_${Date.now()}`

        let optimisticX = 0,
            optimisticY = 0
        const optimisticWidth = MAX_INITIAL_IMAGE_DIM * 0.5,
            optimisticHeight = MAX_INITIAL_IMAGE_DIM * 0.5

        if (dropCoords) {
            optimisticX = dropCoords.x - optimisticWidth / 2
            optimisticY = dropCoords.y - optimisticHeight / 2
        } else {
            const canvas = canvasRef.current!
            const dpr = window.devicePixelRatio || 1
            optimisticX = (canvas.width / (2 * dpr) - panOffset.x) / zoomLevel - optimisticWidth / 2
            optimisticY = (canvas.height / (2 * dpr) - panOffset.y) / zoomLevel - optimisticHeight / 2
        }

        const optimisticImageElement: ImageElementClient = {
            id: tempId,
            type: "image",
            x: optimisticX,
            y: optimisticY,
            width: optimisticWidth,
            height: optimisticHeight,
            storageId: "temp_storage_id_uploading", // Placeholder
            order: elements.length > 0 ? Math.max(...elements.map((e) => e.order), -1) + 1 : 0,
            isLoading: true,
            isSelected: false,
        }
        setElements((prev) => [...prev, optimisticImageElement])

        try {
            const uploadUrl = await generateUploadUrlMutation()
            const uploadResult = await fetch(uploadUrl, { method: "POST", body: file })
            if (!uploadResult.ok) throw new Error(`Upload failed: ${uploadResult.statusText}`)
            const { storageId } = await uploadResult.json()

            const objectUrl = URL.createObjectURL(file)
            const img = new Image()
            img.onload = async () => {
                URL.revokeObjectURL(objectUrl)
                let x, y
                const canvas = canvasRef.current!
                const dpr = window.devicePixelRatio || 1
                let newWidth = img.naturalWidth,
                    newHeight = img.naturalHeight

                if (newWidth > MAX_INITIAL_IMAGE_DIM || newHeight > MAX_INITIAL_IMAGE_DIM) {
                    if (newWidth > newHeight) {
                        newWidth = MAX_INITIAL_IMAGE_DIM
                        newHeight = (img.naturalHeight / img.naturalWidth) * MAX_INITIAL_IMAGE_DIM
                    } else {
                        newHeight = MAX_INITIAL_IMAGE_DIM
                        newWidth = (img.naturalWidth / img.naturalHeight) * MAX_INITIAL_IMAGE_DIM
                    }
                }

                if (dropCoords) {
                    x = dropCoords.x - newWidth / 2
                    y = dropCoords.y - newHeight / 2
                } else {
                    x = (canvas.width / (2 * dpr) - panOffset.x) / zoomLevel - newWidth / 2
                    y = (canvas.height / (2 * dpr) - panOffset.y) / zoomLevel - newHeight / 2
                }

                const finalImageUrl = await convex.query(api.whiteboardActions.getImageUrl, { storageId })
                if (!finalImageUrl) throw new Error("Could not retrieve final image URL.")

                const finalImageElementData: Omit<ImageElementClient, "id" | "order"> = {
                    type: "image",
                    x,
                    y,
                    width: newWidth,
                    height: newHeight,
                    storageId: storageId as Id<"_storage">,
                    imageUrl: finalImageUrl,
                    image: img,
                    isLoading: false,
                    isSelected: false,
                }

                // Call persistElementAddition with the complete data, it will handle DB and state update
                const persistedId = await persistElementAddition({
                    ...optimisticImageElement, // to get order and original tempId
                    ...finalImageElementData, // override with final data
                })

                // Update elements state one last time to ensure HTMLImageElement 'image' prop is set for the persisted ID
                setElements((prev) =>
                    prev.map((el) =>
                        el.id === persistedId ? { ...el, ...finalImageElementData, id: persistedId, image: img } : el,
                    ),
                )

                const elementsForHistory = elements.map((el) => {
                    if (el.id === tempId)
                        return { ...finalImageElementData, id: persistedId, order: optimisticImageElement.order }
                    if (el.type === "image") {
                        const { image, ...rest } = el
                        return rest
                    }
                    return el
                })
                recordHistory(elementsForHistory)
                toast.success("Image added!")
            }
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl)
                throw new Error("Could not load image dimensions.")
            }
            img.src = objectUrl
        } catch (error) {
            console.error("Image processing/upload failed:", error)
            toast.error(`Image upload failed: ${error.message}`)
            setElements((prev) => prev.filter((el) => el.id !== tempId))
        }
    }

    const handleImageUploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) processAndAddImageFile(file)
        if (e.target) e.target.value = ""
    }

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLCanvasElement>) => {
            event.preventDefault()
            event.stopPropagation()
            canvasRef.current?.classList.remove("drag-over-active")
            if (event.dataTransfer.files?.[0]?.type.startsWith("image/")) {
                processAndAddImageFile(event.dataTransfer.files[0], getCanvasCoords(event.clientX, event.clientY))
            }
            event.dataTransfer.clearData()
        },
        [getCanvasCoords, panOffset, zoomLevel, whiteboardId, elements],
    ) // Removed convex, elements, whiteboardId from deps as they are stable or handled by persist fn

    const handlePaste = useCallback(
        async (event: ClipboardEvent) => {
            if (editingTextElementId) return
            const items = event.clipboardData?.items
            if (!items) return
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const blob = items[i].getAsFile()
                    if (blob) {
                        event.preventDefault()
                        const canvas = canvasRef.current!
                        const dpr = window.devicePixelRatio || 1
                        const centerX = (canvas.width / (2 * dpr) - panOffset.x) / zoomLevel
                        const centerY = (canvas.height / (2 * dpr) - panOffset.y) / zoomLevel
                        processAndAddImageFile(blob, { x: centerX, y: centerY })
                        return
                    }
                }
            }
        },
        [getCanvasCoords, panOffset, zoomLevel, editingTextElementId, whiteboardId, elements],
    ) // Removed convex, elements, whiteboardId from deps

    useEffect(() => {
        document.addEventListener("paste", handlePaste)
        return () => document.removeEventListener("paste", handlePaste)
    }, [handlePaste])

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const worldXBeforeZoom = (mouseX - panOffset.x) / zoomLevel
        const worldYBeforeZoom = (mouseY - panOffset.y) / zoomLevel
        const delta = e.deltaY * SCROLL_SENSITIVITY * -1
        const scaleAmount = 1 + delta
        let newZoomLevel = zoomLevel * scaleAmount
        newZoomLevel = Math.max(MIN_ZOOM, Math.min(newZoomLevel, MAX_ZOOM))
        const newPanX = mouseX - worldXBeforeZoom * newZoomLevel
        const newPanY = mouseY - worldYBeforeZoom * newZoomLevel
        setZoomLevel(newZoomLevel)
        setPanOffset({ x: newPanX, y: newPanY })
    }

    const makeHistoryEntry = (els: WhiteboardElementClient[]) =>
        els.map((el) => {
            if (el.type === "image") {
                const { image, ...rest } = el
                return rest
            } // Don't store HTMLImageElement
            return { ...el }
        })

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1
            setHistoryIndex(newIndex)
            setElements([...history[newIndex].map((el) => ({ ...el }))])
            setSelectedElementId(null)
            setEditingTextElementId(null)
        }
    }
    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1
            setHistoryIndex(newIndex)
            setElements([...history[newIndex].map((el) => ({ ...el }))])
            setSelectedElementId(null)
            setEditingTextElementId(null)
        }
    }

    const drawElement = useCallback(
        (ctx: CanvasRenderingContext2D, element: WhiteboardElementClient, dpr: number) => {
            ctx.save()
            const isSelected = element.isSelected && selectedTool === "select"

            if (element.type === "path") {
                ctx.beginPath()
                ctx.strokeStyle = element.color
                ctx.lineWidth = element.strokeWidth
                ctx.lineCap = "round"
                ctx.lineJoin = "round"
                ctx.globalCompositeOperation = element.compositeOperation || ("source-over" as GlobalCompositeOperation)
                element.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
                ctx.stroke()
            } else if (element.type === "image") {
                if (element.isLoading) {
                    ctx.fillStyle = "rgba(200, 200, 200, 0.5)"
                    ctx.fillRect(element.x, element.y, element.width, element.height)
                    ctx.fillStyle = "black"
                    ctx.textAlign = "center"
                    ctx.textBaseline = "middle"
                    ctx.font = `${14 / zoomLevel}px Arial`
                    ctx.fillText("Loading...", element.x + element.width / 2, element.y + element.height / 2)
                } else if (element.image?.complete && element.image.naturalHeight !== 0) {
                    ctx.drawImage(element.image, element.x, element.y, element.width, element.height)
                } else if (!element.imageUrl && !element.isLoading) {
                    ctx.fillStyle = "rgba(255, 0, 0, 0.2)"
                    ctx.fillRect(element.x, element.y, element.width, element.height)
                    ctx.strokeStyle = "red"
                    ctx.lineWidth = 1 / zoomLevel
                    ctx.strokeRect(element.x, element.y, element.width, element.height)
                    ctx.fillStyle = "red"
                    ctx.textAlign = "center"
                    ctx.textBaseline = "middle"
                    ctx.font = `${12 / zoomLevel}px Arial`
                    ctx.fillText("Error", element.x + element.width / 2, element.y + element.height / 2)
                }
                if (isSelected) {
                    ctx.strokeStyle = SELECTION_BORDER_COLOR
                    ctx.lineWidth = SELECTION_LINE_WIDTH_DIVISOR / zoomLevel
                    ctx.strokeRect(element.x, element.y, element.width, element.height)
                    const handleSize = HANDLE_SIZE_WORLD(zoomLevel)
                    resizeHandlesConfig.forEach((handleDef) => {
                        const pos = handleDef.getPosition(element, handleSize)
                        ctx.fillStyle = SELECTION_BORDER_COLOR
                        ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
                    })
                }
            } else if (element.type === "text") {
                // Skip drawing text on canvas - we'll render it as HTML with Markdown
                if (element.id === editingTextElementId && element.isEditing) {
                    ctx.restore()
                    return
                }

                // Only draw selection border if text is selected
                if (isSelected) {
                    const markdownEl = document.getElementById(`markdown-text-${element.id}`)
                    if (markdownEl) {
                        const rect = markdownEl.getBoundingClientRect()
                        const canvasRect = canvasRef.current.getBoundingClientRect()

                        // Convert screen coordinates to world coordinates
                        const elLeft = (rect.left - canvasRect.left - panOffset.x) / zoomLevel
                        const elTop = (rect.top - canvasRect.top - panOffset.y) / zoomLevel
                        const elWidth = rect.width / zoomLevel
                        const elHeight = rect.height / zoomLevel

                        ctx.strokeStyle = SELECTION_BORDER_COLOR
                        ctx.lineWidth = SELECTION_LINE_WIDTH_DIVISOR / zoomLevel
                        ctx.strokeRect(elLeft, elTop, elWidth, elHeight)
                    } else {
                        // Fallback if element not found
                        ctx.font = `${element.fontSize}px ${element.fontFamily}`
                        const lines = element.text.split("\n")
                        let maxWidth = 0
                        lines.forEach((line) => {
                            const metrics = ctx.measureText(line || " ")
                            if (metrics.width > maxWidth) maxWidth = metrics.width
                        })
                        const approxHeight = lines.length * element.fontSize * 1.2
                        const padding = 2 / zoomLevel
                        ctx.strokeStyle = SELECTION_BORDER_COLOR
                        ctx.lineWidth = SELECTION_LINE_WIDTH_DIVISOR / zoomLevel
                        ctx.strokeRect(element.x - padding, element.y - padding, maxWidth + 2 * padding, approxHeight + 2 * padding)
                    }
                }
            }
            ctx.restore()
        },
        [selectedElementId, selectedTool, editingTextElementId, zoomLevel, panOffset],
    )

    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return
        const dpr = window.devicePixelRatio || 1
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = "#FFFFFF"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
        ctx.save()
        ctx.translate(panOffset.x * dpr, panOffset.y * dpr)
        ctx.scale(zoomLevel * dpr, zoomLevel * dpr)
        const sortedElements = [...elements].sort((a, b) => a.order - b.order)
        sortedElements.forEach((element) => drawElement(ctx, element, dpr))
        if (currentPath?.points.length > 0) {
            drawElement(ctx, { id: "temp-path", order: elements.length + 1, ...currentPath } as PathElementClient, dpr)
        }
        ctx.restore()
    }, [elements, currentPath, panOffset, zoomLevel, drawElement])

    useEffect(() => {
        redrawCanvas()
    }, [redrawCanvas])

    useEffect(() => {
        const canvas = canvasRef.current
        const parent = canvas?.parentElement
        if (!canvas || !parent) return
        const resizeObserver = new ResizeObserver(() => {
            const { width, height } = parent.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
            redrawCanvas()
        })
        resizeObserver.observe(parent)
        const { width, height } = parent.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        redrawCanvas()
        return () => resizeObserver.disconnect()
    }, [redrawCanvas])

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (editingTextElementId) {
                if (e.key === "Escape") {
                    ;(textInputRef.current as HTMLTextAreaElement)?.blur()
                }
                return
            }

            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedElementId) {
                    e.preventDefault()
                    const elementToDelete = elements.find((el) => el.id === selectedElementId)
                    if (!elementToDelete) return

                    const newElements = elements.filter((el) => el.id !== selectedElementId)
                    setElements(newElements)
                    recordHistory(makeHistoryEntry(newElements))
                    const oldSelectedId = selectedElementId // Save for potential revert
                    setSelectedElementId(null)

                    if (typeof oldSelectedId === "string" && !oldSelectedId.startsWith("temp_")) {
                        try {
                            const result = await deleteElementMutation({ elementID: oldSelectedId as Id<"whiteboardElements"> })
                            if (result.success) toast.success("Element deleted.")
                            else toast.error(result.message || "Failed to delete element from server.")
                        } catch (err) {
                            toast.error("Error deleting element.")
                            console.error("Deletion failed:", err)
                            // Revert optimistic deletion
                            setElements((prev) => [...prev, elementToDelete].sort((a, b) => a.order - b.order))
                            setSelectedElementId(oldSelectedId)
                            // Consider more robust history revert here
                            if (historyIndex > 0) setHistoryIndex((prev) => prev - 1) // Simple history pop
                        }
                    }
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault()
                e.shiftKey ? handleRedo() : handleUndo()
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
                e.preventDefault()
                handleRedo()
            }
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (textPopover && textPopover.visible) {
                const popoverElement = document.querySelector(".text-popover")
                if (
                    popoverElement &&
                    !popoverElement.contains(e.target as Node) &&
                    textInputRef.current &&
                    !textInputRef.current.contains(e.target as Node)
                ) {
                    handleTextEditBlur()
                }
            }
        }

        window.addEventListener("mousedown", handleClickOutside)
        window.addEventListener("keydown", handleKeyDown)
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("mousedown", handleClickOutside)
        }
    }, [
        selectedElementId,
        editingTextElementId,
        elements,
        deleteElementMutation,
        recordHistory,
        historyIndex,
        textPopover,
    ])

    const getTextAreaStyle = (): React.CSSProperties => {
        if (!editingTextElementId) return { display: "none" }
        const element = elements.find((el) => el.id === editingTextElementId && el.type === "text" && el.isEditing) as
            | TextElementClient
            | undefined
        if (!element) return { display: "none" }
        const dpr = window.devicePixelRatio || 1
        let approxWidth = TEXTAREA_MIN_WIDTH_ZOOMED * zoomLevel
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d")
            if (ctx) {
                ctx.font = `${element.fontSize * zoomLevel * dpr}px ${element.fontFamily}`
                let maxWidth = 0
                element.text.split("\n").forEach((line) => {
                    const metrics = ctx.measureText(line || " ")
                    maxWidth = Math.max(maxWidth, metrics.width)
                })
                approxWidth = Math.max(
                    TEXTAREA_MIN_WIDTH_ZOOMED * zoomLevel,
                    maxWidth / dpr + TEXTAREA_PADDING_ZOOMED * zoomLevel,
                )
            }
        }
        return {
            position: "absolute",
            left: element.x * zoomLevel + panOffset.x,
            top: element.y * zoomLevel + panOffset.y,
            fontFamily: element.fontFamily,
            fontSize: element.fontSize * zoomLevel,
            lineHeight: `${element.fontSize * 1.2 * zoomLevel}px`,
            color: element.color,
            background: "rgba(255, 255, 255, 0.95)",
            border: `1px dashed #777`,
            padding: `${2 * zoomLevel}px`,
            margin: 0,
            resize: "none",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            outline: "none",
            minWidth: `${TEXTAREA_MIN_WIDTH_ZOOMED * zoomLevel}px`,
            width: `${approxWidth}px`,
            zIndex: 1000,
        }
    }

    const cursorStyle = useMemo(() => {
        if (isPanning) return "grabbing"
        if (selectedTool === "select") {
            if (resizingElementInfo)
                return resizeHandlesConfig.find((h) => h.name === resizingElementInfo.handle)?.cursor || "default"
            if (hoveredResizeHandle)
                return resizeHandlesConfig.find((h) => h.name === hoveredResizeHandle)?.cursor || "default"
            if (isDraggingElement) return "grabbing"
            const selEl = elements.find((el) => el.id === selectedElementId)
            if (selEl?.isSelected) return "move"
            return "grab"
        }
        if (selectedTool === "text") return "text"
        return "crosshair" // Default for pen, eraser, highlight
    }, [
        isPanning,
        selectedTool,
        resizingElementInfo,
        hoveredResizeHandle,
        isDraggingElement,
        selectedElementId,
        elements,
    ])

    // Add this function after the handleDoubleClick function
    const ensureTextEditingWorks = () => {
        // If text tool is selected but no text is being edited, force a new text element
        if (selectedTool === "text" && !editingTextElementId) {
            const canvas = canvasRef.current
            if (canvas) {
                const rect = canvas.getBoundingClientRect()
                const centerX = rect.width / 2
                const centerY = rect.height / 2
                const coords = getCanvasCoords(centerX, centerY)

                // Create a new text element at the center of the visible canvas
                const order = elements.length > 0 ? Math.max(...elements.map((el) => el.order), -1) + 1 : 0
                const tempId = `temp_text_${Date.now()}`
                const newTextElement: TextElementClient = {
                    id: tempId,
                    type: "text",
                    x: coords.x,
                    y: coords.y,
                    text: "",
                    color: currentColor,
                    fontSize: DEFAULT_TEXT_FONT_SIZE,
                    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                    order,
                    isEditing: true,
                    isSelected: true,
                }
                setElements((prev) => [...prev, newTextElement])
                setSelectedElementId(tempId)
                setEditingTextElementId(tempId)

                // Show popover at center position
                setTextPopover({
                    visible: true,
                    x: centerX,
                    y: centerY,
                    elementId: tempId,
                })

                // Force focus on the text area
                setTimeout(() => {
                    if (textInputRef.current) {
                        textInputRef.current.focus()
                    }
                }, 0)
            }
        }
    }

    // Add this useEffect after your other useEffect hooks
    useEffect(() => {
        if (selectedTool === "text" && !editingTextElementId) {
            // Small delay to ensure the UI is ready
            const timer = setTimeout(() => {
                if (selectedTool === "text" && !editingTextElementId) {
                    ensureTextEditingWorks()
                }
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [selectedTool])

    // Render all text elements as Markdown
    const renderTextElements = () => {
        return elements
            .filter((el) => el.type === "text" && !el.isEditing)
            .map((el) => {
                const textElement = el as TextElementClient
                return (
                    <div
                        key={`markdown-text-${textElement.id}`}
                        id={`markdown-text-${textElement.id}`}
                        className="absolute pointer-events-none"
                        style={{
                            left: textElement.x * zoomLevel + panOffset.x,
                            top: textElement.y * zoomLevel + panOffset.y,
                            color: textElement.color,
                            fontSize: `${textElement.fontSize * zoomLevel}px`,
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: "top left",
                            maxWidth: "800px",
                        }}
                    >
                        <MarkdownRenderer content={textElement.text} className="whiteboard-markdown" />
                    </div>
                )
            })
    }

    if (!whiteboardId)
        return (
            <div className="flex items-center justify-center h-full text-red-500 p-4 text-center">
                Whiteboard ID is required.
            </div>
        )
    if (whiteboardDataQuery === undefined && !clientError)
        return (
            <div className="flex flex-col gap-2 items-center justify-center h-screen">
                <Loader className={"w-10 h-10 animate-spin text-blue-500"} />
                Loading whiteboard...
            </div>
        )
    if (clientError)
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                {" "}
                <h2 className="text-2xl font-semibold text-red-600 mb-3">Error</h2>{" "}
                <p className="text-slate-700 dark:text-slate-300">{clientError}</p>{" "}
            </div>
        )

    return (
        <div className="flex flex-col w-full h-screen bg-slate-100 dark:bg-slate-900">
            <WhiteboardHeader
                whiteboardID={whiteboardId}
                whiteboardName={whiteboardTopic || "Whiteboard"} />
            <div className="flex flex-1 w-full overflow-hidden">
                <WhiteboardSidebar
                    whiteboardID={whiteboardId as Id<"whiteboards">}
                    selectedTool={selectedTool}
                    setSelectedTool={setSelectedTool}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onHint={() => toast.info("Hint feature not implemented.")}
                    onCheck={() => toast.info("Check work feature not implemented.")}
                    onSubmit={() => toast.info("Submit work feature not implemented.")}
                    onImageToolSelect={() => imageUploadInputRef.current?.click()}
                    currentColor={currentColor}
                    setCurrentColor={setCurrentColor}
                />
                <div className="flex flex-1">
                    <div
                        className="flex-1 relative bg-white dark:bg-slate-800 overflow-hidden"
                        style={{ touchAction: "none", cursor: cursorStyle }}
                        onDragOver={(e) => {
                            e.preventDefault()
                            canvasRef.current?.classList.add("drag-over-active")
                        }}
                        onDragLeave={() => canvasRef.current?.classList.remove("drag-over-active")}
                        onDrop={handleDrop}
                    >
                        <ProactiveTutorProvider
                            whiteboardID={whiteboardId as Id<"whiteboards">}
                            canvasRef={canvasRef}
                            panOffset={panOffset}
                            zoomLevel={zoomLevel}
                        >
                            <SolveItAllProvider>
                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseLeave}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    onTouchCancel={handleTouchEnd}
                                    onWheel={handleWheel}
                                    onDoubleClick={handleDoubleClick}
                                    className="w-full h-full block"
                                />
                            </SolveItAllProvider>
                        </ProactiveTutorProvider>

                        {/* Render all text elements as Markdown */}
                        <div ref={markdownContainerRef} className="absolute inset-0 pointer-events-none">
                            {renderTextElements()}
                        </div>

                        <input
                            type="file"
                            accept="image/*"
                            ref={imageUploadInputRef}
                            id="image-upload-input-hidden"
                            className="hidden"
                            onChange={handleImageUploadInputChange}
                        />

                        {editingTextElementId &&
                            elements.find((el) => el.id === editingTextElementId && el.type === "text" && el.isEditing) && (
                                <textarea
                                    ref={textInputRef}
                                    onBlur={handleTextEditBlur}
                                    onChange={(e) => handleTextEditChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault()
                                            ;(e.target as HTMLTextAreaElement).blur()
                                        }
                                    }}
                                    style={getTextAreaStyle()}
                                />
                            )}

                        {textPopover && textPopover.visible && editingTextElementId && (
                            <TextEditPopover
                                x={textPopover.x}
                                y={textPopover.y}
                                text={(elements.find((el) => el.id === editingTextElementId) as TextElementClient)?.text || ""}
                                fontSize={
                                    (elements.find((el) => el.id === editingTextElementId) as TextElementClient)?.fontSize ||
                                    DEFAULT_TEXT_FONT_SIZE
                                }
                                onChange={handleTextEditChange}
                                onResize={handleTextResize}
                                onSave={handleTextSave}
                                textareaRef={textInputRef}
                            />
                        )}
                    </div>
                    {whiteboardId && <SidebarChatbot whiteboardID={whiteboardId as Id<"whiteboards">} />}
                </div>
            </div>
        </div>
    )
}
