
"use client";
import {Button} from "@/components/ui/button";

export default function Navbar(){

    return (
        <div className={"max-w-screen-xl mx-auto container"}>
            <div className={"flex items-center justify-between bg-white"}>
                <h1
                    className={"text-xl font-bold text-lime-700"}
                >AI Whiteboard</h1>

                <ul className={"flex gap-2 items-center"}>
                    <li>Pricing</li>
                    <Button
                        className={"rounded-xl"}
                        size={"sm"}
                        variant={"neutral"}
                    >
                        Login
                    </Button>
                </ul>
            </div>
        </div>
    )

}