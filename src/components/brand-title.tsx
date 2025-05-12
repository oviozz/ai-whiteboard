
import {cn} from "@/lib/utils";
import {TbMichelinStarFilled} from "react-icons/tb";

type BrandTitleProps = {
    className?: string,
}

export default function BrandTitle({className}: BrandTitleProps) {

    return (
        <h1
            className={cn("flex items-center gap-2 text-lime-500 text-2xl rounded-md font-bold px-3 py-1", className)}
        >
            Whiteboard
        </h1>
    )

}