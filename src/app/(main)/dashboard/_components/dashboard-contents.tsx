
"use client"
import {Clock} from "lucide-react";
import Link from "next/link";
import {useQuery} from "convex/react";
import {api} from "../../../../../convex/_generated/api";
import CreateNewWhiteboardButton from "@/app/(main)/dashboard/_components/create-new-whiteboard-button";
import DeleteWhiteboardButton from "@/app/(main)/dashboard/_components/delete-whiteboard-button";
import EmptyWhiteboards from "@/app/(main)/dashboard/_components/states/empty-whiteboards";
import WhiteboardSkeletonLoading from "@/app/(main)/dashboard/_components/states/whiteboard-skeleton-loading";
import {timeAgo} from "@/lib/utils";
import {useRouter} from "next/navigation";

export default function DashboardContents({ query }: { query: string | undefined }){

    const user = useQuery(api.users.current);
    const whiteboards = useQuery(api.whiteboards.getWhiteboards);


    const isLoading = whiteboards === undefined;

    return (
        <div className="flex flex-col gap-2 max-w-screen-2xl mx-auto w-full">
            <div className="px-4 py-4 flex justify-between items-center border-b border-neutral-100 bg-white sticky top-0 z-10">
                <div className="flex flex-col">
                    {user && user?.firstName && (
                        <span className="text-neutral-500">
                            Hello, <span className="font-medium">{user?.firstName}</span>
                        </span>
                    )}
                    <h1 className="text-2xl font-bold text-gray-800">Your Whiteboards</h1>
                </div>
                <div className="flex items-center gap-2">
                    <CreateNewWhiteboardButton query={query} />
                </div>
            </div>

            <div className="px-5 py-4">
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[...Array(8)].map((_, index) => (
                            <WhiteboardSkeletonLoading key={index} />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {whiteboards && whiteboards.length > 0 ? (
                            whiteboards.map((board) => (
                                <Link
                                    href={`/whiteboard/${board._id}`}
                                    className="bg-neutral-100 p-1.5 rounded-xl hover:shadow-md hover:scale-105 transition-all duration-200 ease-in-out group"
                                    key={board._id}
                                >
                                    <div className="border border-neutral-200 bg-white rounded-xl overflow-hidden h-full">
                                        <div className="p-4 h-40 flex flex-col relative">
                                            <div className="flex items-center mb-1">
                                                <span className="mr-2">{emojis[Math.floor(Math.random() * emojis.length)]}</span>
                                                <h3 className="font-medium text-xl line-clamp-1">{board.topic}</h3>
                                            </div>

                                            <span className="text-sm text-neutral-500 mt-2 font-light line-clamp-3">{board.problem_statement}</span>
                                            <div className="mt-auto flex justify-between items-center text-sm text-gray-500">
                                                <div className="flex items-center gap-1 text-neutral-500 font-medium">
                                                    <Clock size={14} />
                                                    <span>{timeAgo(board.updatedAt)}</span>
                                                </div>

                                                <div
                                                    className="p-1"
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        e.preventDefault();
                                                    }}
                                                >
                                                    <DeleteWhiteboardButton
                                                        whiteboardID={board._id}
                                                        whiteboard_name={board.topic}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <EmptyWhiteboards />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const emojis = ["💡", "🗺️", "🔄", "🎨"]
