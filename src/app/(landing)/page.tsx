
import TopicInput from "@/app/(landing)/_components/topic-input";
import {cn} from "@/lib/utils";

export default function LearningWhiteboardUI() {

    return (
        <div className="h-[calc(100vh-85px)] flex flex-col items-center justify-center bg-white p-4 sm:p-0">
            {/* Main content - increased size */}
            <div className="w-full flex flex-col items-center">
                <div className={"w-full max-w-5xl px-4"}>
                    <div className={"flex flex-col items-center"}>
                        <h1 className={cn("text-4xl md:text-6xl font-extrabold text-center text-gray-800 mb-2")}>
                            I want to learn
                        </h1>
                        <p className="text-lg text-gray-600 text-center mb-10 max-w-xl">
                            Explore any topic with interactive AI-powered visualizations and personalized learning paths
                        </p>
                    </div>
                </div>

                <TopicInput />
            </div>

            {/* Optional subtle footer text */}
            <div className="mt-5 text-muted-foreground text-center text-xs sm:text-sm">
                Start learning anything with AI-powered visualization
            </div>
        </div>
    );
}