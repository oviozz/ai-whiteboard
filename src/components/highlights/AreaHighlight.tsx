"use client";

/**
 * AreaHighlight
 *
 * Renders a visual highlight around an area on the canvas.
 * Used for showing selected context areas and agent viewport bounds.
 */

import { useMemo } from "react";
import { Box, type BoxModel, useEditor, useValue } from "tldraw";

export interface AreaHighlightProps {
  pageBounds: BoxModel;
  generating: boolean;
  color: string;
  label?: string;
}

export function AreaHighlight({
  pageBounds,
  color,
  generating,
  label,
}: AreaHighlightProps) {
  const editor = useEditor();

  const screenBounds = useValue(
    "screenBounds",
    () => {
      const expandedPageBounds = Box.From(pageBounds).expandBy(4);
      const screenCorners = expandedPageBounds.corners.map((corner) => {
        return editor.pageToViewport(corner);
      });
      return Box.FromPoints(screenCorners);
    },
    [pageBounds, editor]
  );

  const sides = useMemo(() => {
    if (!screenBounds) return [];
    return screenBounds.sides;
  }, [screenBounds]);

  if (!screenBounds) return null;

  const minX = screenBounds.minX;
  const minY = screenBounds.minY;
  const maxX = screenBounds.maxX;
  const maxY = screenBounds.maxY;

  return (
    <>
      <svg
        className={`context-highlight ${generating ? "context-highlight-generating" : ""}`}
        style={{
          position: "absolute",
          top: minY,
          left: minX,
          width: maxX - minX,
          height: maxY - minY,
          pointerEvents: "none",
          zIndex: 1000,
        }}
      >
        {sides.map((side, j) => {
          return (
            <line
              key={`context-highlight-side-${j}`}
              x1={side[0].x - screenBounds.minX}
              y1={side[0].y - screenBounds.minY}
              x2={side[1].x - screenBounds.minX}
              y2={side[1].y - screenBounds.minY}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={generating ? "5,5" : "none"}
            />
          );
        })}
      </svg>
      {label && (
        <div
          className="context-highlight-label"
          style={{
            position: "absolute",
            top: screenBounds.y - 24,
            left: screenBounds.x,
            backgroundColor: color,
            color: "white",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 500,
            pointerEvents: "none",
            zIndex: 1001,
          }}
        >
          {label}
        </div>
      )}
      <style jsx>{`
        .context-highlight-generating line {
          animation: dash 0.5s linear infinite;
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -10;
          }
        }
      `}</style>
    </>
  );
}

