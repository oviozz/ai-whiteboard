"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Share2, Link, Check, QrCode, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import QRCode from "qrcode";

type ShareDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ShareDialog({ isOpen, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [currentUrl, setCurrentUrl] = useState("");

  // Get current URL on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, [isOpen]);

  // Generate QR code when showing
  useEffect(() => {
    if (showQR && qrCanvasRef.current && currentUrl) {
      generateQRCode(currentUrl, qrCanvasRef.current);
    }
  }, [showQR, currentUrl]);

  // Generate QR code using qrcode library
  const generateQRCode = async (url: string, canvas: HTMLCanvasElement) => {
    try {
      await QRCode.toCanvas(canvas, url, {
        width: 200,
        margin: 2,
        color: {
          dark: "#1e293b",
          light: "#ffffff",
        },
      });
    } catch (err) {
      console.error("Failed to generate QR code:", err);
      // Fallback: draw a placeholder
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#64748b";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("QR Code Error", size / 2, size / 2);
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDownloadQR = () => {
    if (!qrCanvasRef.current) return;

    const link = document.createElement("a");
    link.download = "whiteboard-qr.png";
    link.href = qrCanvasRef.current.toDataURL("image/png");
    link.click();
    toast.success("QR code downloaded!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Share2 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              Share Whiteboard
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Copy Link Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Link className="w-4 h-4" />
              Share via Link
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 truncate">
                {currentUrl}
              </div>
              <Button
                onClick={handleCopyLink}
                className={cn(
                  "transition-all",
                  copied
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-blue-500 hover:bg-blue-600"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* QR Code Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              Share via QR Code
            </h3>

            {!showQR ? (
              <Button
                variant="neutral"
                onClick={() => setShowQR(true)}
                className="w-full"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Generate QR Code
              </Button>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-xl border-2 border-slate-200 shadow-sm">
                  <canvas ref={qrCanvasRef} className="w-[200px] h-[200px]" />
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Scan this QR code to open the whiteboard
                </p>
                <Button
                  variant="neutral"
                  onClick={handleDownloadQR}
                  className="w-full"
                >
                  Download QR Code
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            Anyone with this link can view and collaborate on this whiteboard in
            real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
