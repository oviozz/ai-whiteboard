
"use client";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {Button} from "@/components/ui/button";

export default function WhiteboardHeader() {

    return (
        <div className="px-4 py-1 flex justify-end sm:justify-between items-center bg-white border-b border-gray-100">

            <div className={"flex items-center gap-2 select-none"}>

                <Link
                    className={"flex items-center gap-2"}
                    href={"/dashboard"}>
                    <ArrowLeft className={"w-4 h-4"}/>
                    Go Back
                </Link>
            </div>

            <div className={"hidden sm:flex gap-2"}>
                <Button
                    variant={"neutral"}
                    size={"sm"}
                >
                    Solve it all
                </Button>

                <Button
                    variant={"default"}
                    size={"sm"}
                >
                    Quiz me
                </Button>
            </div>

        </div>
    )

}