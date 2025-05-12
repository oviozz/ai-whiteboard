
// app/(main)/whiteboard/[id]/page.tsx
import WhiteboardClient from "@/app/(main)/whiteboard/[id]/_components/whiteboard-client";
import {Id} from "../../../../../convex/_generated/dataModel";

type WhiteboardPageProps = {
    params: Promise<{
        id: string
    }>
}

export default async function WhiteboardPage({ params }: WhiteboardPageProps) {
    const id = (await params).id;
    return <WhiteboardClient whiteboardId={id as Id<"whiteboards">} />;
}