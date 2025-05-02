
import React from "react";
import type {Metadata} from "next";
import "./globals.css";
import {cn} from "@/lib/utils";
import { sora } from "@/fonts";

export const metadata: Metadata = {
    title: "AI Whiteboard",
    description: "A tutor for all your learning",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={cn("antialiased bg-white", sora.className)}
            >
                <main className={"flex flex-col gap-2"}>
                    <div>
                        {children}
                    </div>
                </main>
            </body>
        </html>
    );
}
