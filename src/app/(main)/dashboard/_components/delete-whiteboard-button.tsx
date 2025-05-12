
"use client";

import {Id} from "../../../../../convex/_generated/dataModel";
import {useMutation} from "convex/react";
import {api} from "../../../../../convex/_generated/api";
import {
    Dialog, DialogClose,
    DialogContent,
    DialogDescription, DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {CircleAlertIcon, Loader, Trash2} from "lucide-react";
import {VisuallyHidden} from "@radix-ui/react-visually-hidden";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {useState, useTransition} from "react";
import {toast} from "sonner";

type DeleteWhiteboardButtonProps = {
    whiteboardID: Id<"whiteboards">
    whiteboard_name: string
}

export default function DeleteWhiteboardButton({ whiteboardID, whiteboard_name }: DeleteWhiteboardButtonProps){

    const deleteWhiteboard = useMutation(api.whiteboards.deleteWhiteboard);
    const [inputName, setInputName] = useState("");
    const [isPending, startTransition] = useTransition();

    const delete_handler = () => {
        startTransition(async () => {
            const { success, message } = await deleteWhiteboard({ whiteboardID: whiteboardID });
            if (success){
                toast.success(message);
            } else {
                toast.error(message);
            }
        });
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="bg-white p-2 rounded-lg hover:text-red-500">
                    <Trash2 size={16} />
                </button>
            </DialogTrigger>
            <DialogContent className={"rounded-xl bg-white"}>
                <div className="flex flex-col items-center gap-2">
                    <div
                        className="flex size-9 shrink-0 items-center bg-white justify-center rounded-full border"
                        aria-hidden="true"
                    >
                        <CircleAlertIcon className="opacity-80" size={16} />
                    </div>
                    <DialogHeader>
                        <DialogTitle className="sm:text-center">
                            Final confirmation
                        </DialogTitle>
                        <DialogDescription className="sm:text-center font-light">
                            This action cannot be undone. To confirm, please enter the project
                            name: <span className="text-foreground font-bold">{whiteboard_name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="space-y-5">
                    <div className="*:not-first:mt-2">
                        <Label htmlFor={"project-name"}>Project name</Label>
                        <Input
                            id={"project-name"}
                            type="text"
                            placeholder={`Type ${whiteboard_name} to confirm`}
                            value={inputName}
                            onChange={(e) => setInputName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant={"neutral"}
                                type="button" className="flex-1">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={delete_handler}
                            type="button"
                            className="flex-1 bg-red-500 text-white"
                            disabled={inputName !== whiteboard_name}
                        >
                            { isPending ? (
                                <Loader className={"w-5 h-5 animate-spin"} />
                            ) : "Delete" }
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )

}