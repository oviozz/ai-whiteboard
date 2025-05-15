
"use client";
import html2canvas from "html2canvas-pro";

export default function useScreenshot(){
    const screenshot = async () => {
        const canvas = await html2canvas(document.body, {
            allowTaint: true,
            useCORS: true,
            scrollX: 0,
            scrollY: -window.scrollY,
            windowWidth: document.documentElement.offsetWidth,
            windowHeight: document.documentElement.offsetHeight,
        })
        const imageUrl = canvas.toDataURL("image/png")

        const byteString = atob(imageUrl.split(",")[1])
        const mimeString = imageUrl.split(",")[0].split(":")[1].split(";")[0]
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
        }
        return new Blob([ab], { type: mimeString })
    }

    return {
        screenshotBlog: () => screenshot()
    }
}
