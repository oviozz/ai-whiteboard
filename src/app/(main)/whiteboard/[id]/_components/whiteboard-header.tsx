
"use client";
import BrandTitle from "@/components/brand-title";
import {Button} from "@/components/ui/button";
import {useState} from "react";
import {cn} from "@/lib/utils";
import {FaRegFaceDizzy, FaRegFaceGrin} from "react-icons/fa6";

export default function WhiteboardHeader() {

    const [enabled, setEnabled] = useState(false);

    return (
        <div className="px-4 py-2 flex justify-end sm:justify-between items-center border-b border-gray-200 bg-white">

            <div className={"hidden sm:block"}>
                <BrandTitle className={"text-xl"}/>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    onClick={() => setEnabled(prev => !prev)}
                    size={"sm"}
                    className={cn("p-2 rounded-xl text-white",
                        enabled ? "bg-purple-500" : "bg-red-500"
                    )}
                >
                    {enabled ? (
                        <>
                            <FaRegFaceGrin className={"w-5 h-5"}/>
                            AI Enabled
                        </>
                    ) : (
                        <>
                            <FaRegFaceDizzy className={"w-5 h-5"}/>
                            AI Disabled
                        </>
                    )}

                </Button>
            </div>
        </div>
    )

}