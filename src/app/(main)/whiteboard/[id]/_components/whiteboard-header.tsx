
"use client";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";

export default function WhiteboardHeader() {

    return (
        <div className="px-4 py-2 flex justify-end sm:justify-between items-center border-b border-gray-200 bg-white">

            <div className={"flex items-center gap-2 select-none"}>

                <Link
                    className={"flex items-center gap-2"}
                    href={"/dashboard"}>
                    <ArrowLeft className={"w-4 h-4"}/>
                    Go Back
                </Link>
            </div>

        </div>
    )

}