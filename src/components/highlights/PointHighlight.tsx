"use client";

/**
 * PointHighlight
 *
 * Renders a visual highlight for a point on the canvas.
 * Used for showing selected context points.
 */

import { type VecModel, useEditor, useValue } from "tldraw";

export interface PointHighlightProps {
  pagePoint: VecModel;
  color: string;
  generating: boolean;
}

export function PointHighlight({
  pagePoint,
  color,
  generating,
}: PointHighlightProps) {
  const editor = useEditor();
  const screenPoint = useValue(
    "screenPoint",
    () => editor.pageToViewport(pagePoint),
    [pagePoint, editor]
  );

  const r = 6;

  return (
    <>
      <svg
        className={`context-highlight ${generating ? "context-highlight-generating" : ""}`}
        style={{
          position: "absolute",
          top: screenPoint.y - r,
          left: screenPoint.x - r,
          width: r * 2,
          height: r * 2,
          pointerEvents: "none",
          zIndex: 1000,
        }}
      >
        <circle
          cx={r}
          cy={r}
          r={r}
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={generating ? 0.5 : 0.3}
        />
      </svg>
      <style jsx>{`
        .context-highlight-generating circle {
          animation: pulse 1s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% {
            fill-opacity: 0.3;
          }
          50% {
            fill-opacity: 0.7;
          }
        }
      `}</style>
    </>
  );
}

