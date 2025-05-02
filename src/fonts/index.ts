
import {Quicksand, Sniglet, Sora} from "next/font/google";

export const quicksand = Quicksand({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"]
});

export const sora = Sora({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700", "800"]
});

export const sniglet = Sniglet({
    subsets: ["latin"],
    weight: ["400","800"]
})