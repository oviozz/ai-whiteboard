
import React from "react";
import type {Metadata} from "next";
import "./globals.css";
import {cn} from "@/lib/utils";
import { sora } from "@/fonts";
import {ClerkProvider} from "@clerk/nextjs";
import ConvexClientProvider from "@/providers/convex-provider-with-clerk";
import {Toaster} from "@/components/ui/sonner";

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
            <body className={cn("antialiased bg-white", sora.className)}>
                <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
                    <ConvexClientProvider>
                        <main className={"flex flex-col gap-2"}>
                            <div>
                                {children}
                            </div>
                            <Toaster position={"top-center"} richColors={true} />
                        </main>
                    </ConvexClientProvider>
                </ClerkProvider>
            </body>
        </html>
    );
}
