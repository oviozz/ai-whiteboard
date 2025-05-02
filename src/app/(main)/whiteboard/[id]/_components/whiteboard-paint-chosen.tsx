
import {Minus, Plus} from "lucide-react";
import {cn} from "@/lib/utils";

export default function WhiteboardPaintChosen() {

    return (
        <div className={"py-2 px-4 flex justify-between border-b border-gray-200 w-full"}>
            <div className={"flex items-center gap-2"}>
                <button className={"bg-neutral-100 border border-neutral-100 p-1 rounded-xl"}>
                    <Plus className={"w-5 h-5"}/>
                </button>

                <button className={"bg-neutral-100 border border-neutral-100 p-1 rounded-xl"}>
                    <Minus className={"w-5 h-5"}/>
                </button>
            </div>

            <div className={"flex items-center gap-2"}>
                {["bg-blue-500", "bg-green-500", "bg-purple-500"].map(color => {
                    return (
                        <div className={cn("w-5 h-5 rounded-full hover:ring-2 ring-offset-1",
                            color
                        )}></div>
                    )
                })}
            </div>
        </div>
    )

}