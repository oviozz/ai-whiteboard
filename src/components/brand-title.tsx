
import {cn} from "@/lib/utils";

type BrandTitleProps = {
    className?: string,
}

export default function BrandTitle({className}: BrandTitleProps) {

    return (
        <h1
            className={cn("bg-lime-500 text-white text-lg rounded-md font-bold px-3 py-1", className)}
        >
            AI Whiteboard
        </h1>
    )

}