"use client";

/**
 * ContextHighlights
 *
 * Renders all context highlights (areas, points, shapes) on the canvas.
 */

import { useMemo } from "react";
import { type TLShapeId, useEditor, useValue } from "tldraw";
import type { TldrawAgent } from "@/lib/agent/tldraw-agent";
import { AreaHighlight, type AreaHighlightProps } from "./AreaHighlight";
import { PointHighlight, type PointHighlightProps } from "./PointHighlight";

interface ContextHighlightsProps {
  agent: TldrawAgent;
}

export function ContextHighlights({ agent }: ContextHighlightsProps) {
  const editor = useEditor();
  const selectedContextItems = useValue(
    "selectedContextItems",
    () => agent.$contextItems.get(),
    [agent]
  );
  const activeRequest = useValue(
    "activeRequest",
    () => agent.$activeRequest.get(),
    [agent]
  );
  const activeContextItems = activeRequest?.contextItems ?? [];

  // Selected areas (not generating)
  const selectedAreas: AreaHighlightProps[] = useValue(
    "selectedAreas",
    () => {
      const selectedAreaItems = selectedContextItems.filter(
        (item) => item.type === "area"
      );
      return selectedAreaItems.map((item) => ({
        pageBounds: item.bounds,
        generating: false,
        color: "var(--color-primary, #3b82f6)",
      }));
    },
    [selectedContextItems]
  );

  // Active areas (generating)
  const activeAreas: AreaHighlightProps[] = useValue(
    "activeAreas",
    () => {
      const activeAreaItems = activeContextItems.filter(
        (item) => item.type === "area"
      );
      return activeAreaItems.map((item) => ({
        pageBounds: item.bounds,
        generating: true,
        color: "var(--color-primary, #3b82f6)",
        label: item.source === "agent" ? "Reviewing" : undefined,
      }));
    },
    [activeContextItems]
  );

  // Selected shapes (highlight bounds)
  const selectedShapes: AreaHighlightProps[] = useValue(
    "selectedShapes",
    () => {
      const selectedShapeItems = selectedContextItems.filter(
        (item) => item.type === "shapes"
      );
      const result: AreaHighlightProps[] = [];
      for (const item of selectedShapeItems) {
        const bounds = editor.getShapesPageBounds(
          item.shapes.map((shape) => `shape:${shape.shapeId}` as TLShapeId)
        );
        if (bounds) {
          result.push({
            pageBounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
            generating: false,
            color: "var(--color-primary, #3b82f6)",
          });
        }
      }
      return result;
    },
    [selectedContextItems, editor]
  );

  // Active shapes (generating)
  const activeShapes: AreaHighlightProps[] = useValue(
    "activeShapes",
    () => {
      const activeShapeItems = activeContextItems.filter(
        (item) => item.type === "shapes"
      );
      const result: AreaHighlightProps[] = [];
      for (const item of activeShapeItems) {
        const bounds = editor.getShapesPageBounds(
          item.shapes.map((shape) => `shape:${shape.shapeId}` as TLShapeId)
        );
        if (bounds) {
          result.push({
            pageBounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
            generating: true,
            color: "var(--color-primary, #3b82f6)",
          });
        }
      }
      return result;
    },
    [activeContextItems, editor]
  );

  // Individual selected shapes
  const selectedShapeAreas: AreaHighlightProps[] = useValue(
    "selectedShapeAreas",
    () => {
      const selectedShapeItems = selectedContextItems.filter(
        (item) => item.type === "shape"
      );
      const result: AreaHighlightProps[] = [];
      for (const item of selectedShapeItems) {
        const bounds = editor.getShapePageBounds(
          `shape:${item.shape.shapeId}` as TLShapeId
        );
        if (bounds) {
          result.push({
            pageBounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
            generating: false,
            color: "var(--color-primary, #3b82f6)",
          });
        }
      }
      return result;
    },
    [selectedContextItems, editor]
  );

  // Active individual shapes
  const activeShapeAreas: AreaHighlightProps[] = useValue(
    "activeShapeAreas",
    () => {
      const activeShapeItems = activeContextItems.filter(
        (item) => item.type === "shape"
      );
      const result: AreaHighlightProps[] = [];
      for (const item of activeShapeItems) {
        const bounds = editor.getShapePageBounds(
          `shape:${item.shape.shapeId}` as TLShapeId
        );
        if (bounds) {
          result.push({
            pageBounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
            generating: true,
            color: "var(--color-primary, #3b82f6)",
          });
        }
      }
      return result;
    },
    [activeContextItems, editor]
  );

  // Selected points
  const selectedPoints: PointHighlightProps[] = useValue(
    "selectedPoints",
    () => {
      const selectedPointItems = selectedContextItems.filter(
        (item) => item.type === "point"
      );
      return selectedPointItems.map((item) => ({
        pagePoint: item.point,
        generating: false,
        color: "var(--color-primary, #3b82f6)",
      }));
    },
    [selectedContextItems]
  );

  // Active points
  const activePoints: PointHighlightProps[] = useValue(
    "activePoints",
    () => {
      const activePointItems = activeContextItems.filter(
        (item) => item.type === "point"
      );
      return activePointItems.map((item) => ({
        pagePoint: item.point,
        generating: true,
        color: "var(--color-primary, #3b82f6)",
      }));
    },
    [activeContextItems]
  );

  // Combine all highlights
  const allAreaHighlights = useMemo(
    () => [
      ...selectedAreas,
      ...selectedShapes,
      ...selectedShapeAreas,
      ...activeAreas,
      ...activeShapes,
      ...activeShapeAreas,
    ],
    [
      selectedAreas,
      selectedShapes,
      selectedShapeAreas,
      activeAreas,
      activeShapes,
      activeShapeAreas,
    ]
  );

  const allPointsHighlights = useMemo(
    () => [...selectedPoints, ...activePoints],
    [selectedPoints, activePoints]
  );

  return (
    <>
      {allAreaHighlights.map((highlight, i) => (
        <AreaHighlight
          key={`context-highlight-${i}`}
          pageBounds={highlight.pageBounds}
          color={highlight.color}
          generating={highlight.generating}
          label={highlight.label}
        />
      ))}
      {allPointsHighlights.map((highlight, i) => (
        <PointHighlight
          key={`context-point-${i}`}
          pagePoint={highlight.pagePoint}
          color={highlight.color}
          generating={highlight.generating}
        />
      ))}
    </>
  );
}

