
"use client";
import Link from "next/link";
import {ArrowLeft, Loader} from "lucide-react";
import {Button} from "@/components/ui/button";
import QuizMeDrawer from "@/app/(main)/whiteboard/[id]/_components/quiz-me/quiz-me-drawer";
import {Id} from "../../../../../../convex/_generated/dataModel";
import {useAction, useMutation, useQuery} from "convex/react";
import {api} from "../../../../../../convex/_generated/api";
import useSolveAll from "@/app/store/use-solve-all";
import {toast} from "sonner";
import useScreenshot from "@/hooks/use-screenshot";

type WhiteboardHeaderProps = {
    whiteboardID: Id<"whiteboards">;
}
export default function WhiteboardHeader({ whiteboardID }: WhiteboardHeaderProps) {

    const { screenshotBlog } = useScreenshot();
    const generateUploadUrlMutation = useMutation(api.whiteboardActions.generateUploadUrl);

    const whiteboard_info = useQuery(api.whiteboards.getWhiteboardID, {
        whiteboardID
    });

    const { isLoading, setIsLoading } = useSolveAll();
    const solve_problem = useAction(api.whiteboardActions.solveItAll);

    const solve_it_all_handler = async () => {

        if (isLoading){
            toast.error("Give us a break. :)")
        }

        try {
            setIsLoading(true);

            const screenshot_blob = await screenshotBlog();
            const uploadUrl = await generateUploadUrlMutation();
            const uploadResult = await fetch(uploadUrl, { method: "POST", body: screenshot_blob });

            if (!uploadResult.ok) throw new Error(`Upload failed: ${uploadResult.statusText}`);
            const { storageId } = await uploadResult.json();

            const result = await solve_problem({
                whiteboardID,
                storageID: storageId
            });

            if (result?.success){
                toast.success(result?.message)
                setIsLoading(false);
            } else {
                toast.error(result?.message)
            }

        } catch (err) {
            console.log(err);
            toast.error("Couldn't solve it all. Try Again!")
        } finally {
            setIsLoading(false);
        }
    }


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

            { whiteboard_info && (
                <div className={"hidden sm:flex gap-2"}>
                    <Button
                        className={'flex items-center gap-1'}
                        disabled={isLoading}
                        onClick={solve_it_all_handler}
                        variant={"neutral"}
                        size={"sm"}
                    >
                        { isLoading ? (
                            <>
                                <Loader className={"w-5 h-5 animate-spin"} />
                                "Solving"
                            </>
                        ) : (
                            "Solve it all"
                        )}
                    </Button>

                    <QuizMeDrawer
                        topic={whiteboard_info.topic}
                        problem_statement={whiteboard_info.problem_statement}
                    />
                </div>
            )}

        </div>
    )

}