
"use client"
import {Clock, Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import Link from "next/link";


export default function DashboardContents({ query }: { query: string | undefined }){

    return (
        <div className="flex flex-col gap-2 max-w-screen-2xl mx-auto w-full">
            <div className="px-4 py-2 flex justify-between items-center border-b border-neutral-100">
                <div className="flex items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Your Whiteboards</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        className="p-2"
                    >
                        <Plus className={"w-5 h-5"} />
                        <span className={"hidden sm:block"}>
                            Create New Board
                        </span>
                    </Button>
                </div>
            </div>

            <div className={"px-5 py-2"}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {whiteboards.map((board: any) => (
                        <Link
                            href={`/whiteboard/${board.id}`}
                            className="bg-neutral-100 p-1.5 rounded-xl hover:shadow-sm hover:scale-102 transition duration-300 delay-100 ease-in-out"
                            key={board.id}
                        >
                            <div
                                className={`border border-neutral-200 bg-white rounded-xl transition-shadow duration-200 overflow-hidden`}
                            >
                                <div className="p-4 h-40 flex flex-col relative">
                                    <span className="text-3xl">{board.emoji}</span>

                                    <h3 className="font-medium text-lg mt-2">{board.title}</h3>
                                    <div className="mt-auto flex justify-between items-center text-sm text-gray-500">
                                        <div className="flex items-center gap-1 text-muted-foreground font-medium">
                                            <Clock size={14} />
                                            <span>{board.lastEdited}</span>
                                        </div>
                                        <button className="bg-white p-2 rounded-lg hover:text-red-500">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )

}

const whiteboards = [
    {
        id: 1,
        title: "Brainstorming Session",
        color: "bg-blue-500",
        emoji: "💡",
        lastEdited: "2 days ago",
        starred: true
    },
    {
        id: 2,
        title: "Project Roadmap",
        color: "bg-green-500",
        emoji: "🗺️",
        lastEdited: "Yesterday",
        starred: false
    },
    {
        id: 3,
        title: "Team Retrospective",
        color: "bg-purple-500",
        emoji: "🔄",
        lastEdited: "3 hours ago",
        starred: false
    },
    {
        id: 4,
        title: "Design Ideas",
        color: "bg-pink-500",
        emoji: "🎨",
        lastEdited: "5 days ago",
        starred: true
    },
    {
        id: 5,
        title: "Meeting Notes",
        color: "bg-yellow-500",
        emoji: "📝",
        lastEdited: "1 week ago",
        starred: false
    },
    {
        id: 6,
        title: "Customer Feedback",
        color: "bg-orange-100",
        emoji: "👥",
        lastEdited: "Just now",
        starred: false
    }
];