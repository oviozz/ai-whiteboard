
import {FolderPlus} from "lucide-react";
import CreateNewWhiteboardButton from "@/app/(main)/dashboard/_components/create-new-whiteboard-button";

export default function EmptyWhiteboards(){

    return (
        <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <FolderPlus size={40} className="text-neutral-400" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-700 mb-2">No whiteboards yet</h3>
            <p className="text-neutral-500 text-center max-w-md mb-6">
                Create your first whiteboard to start brainstorming and organizing your ideas.
            </p>
            <CreateNewWhiteboardButton />
        </div>
    )

}