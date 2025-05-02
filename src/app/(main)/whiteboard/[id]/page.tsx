
import WhiteboardHeader from "@/app/(main)/whiteboard/[id]/_components/whiteboard-header";
import {SidebarProvider} from "@/components/ui/sidebar";
import WhiteboardSidebar from "@/app/(main)/whiteboard/[id]/_components/whiteboard-sidebar";
import WhiteboardPaintChosen from "@/app/(main)/whiteboard/[id]/_components/whiteboard-paint-chosen";

type WhiteboardProps = {
    params: Promise<{
        id: string
    }>
}

export default async function Whiteboard({ params }: WhiteboardProps){

    const { id } = await params;

    return (
        <div>
            <WhiteboardHeader />
            <div className={"flex w-full"}>
                <WhiteboardSidebar />

                <div className={"flex flex-col bg-white w-full"}>
                    <WhiteboardPaintChosen />
                    {/*Display*/}
                </div>
            </div>
        </div>
    )

}