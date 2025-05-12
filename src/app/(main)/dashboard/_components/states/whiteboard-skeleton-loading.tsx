
export default function WhiteboardSkeletonLoading(){

    return (
        <div className="bg-neutral-100 p-1.5 rounded-xl">
            <div className="border border-neutral-200 bg-white rounded-xl overflow-hidden">
                <div className="p-4 h-40 flex flex-col">
                    <div className="h-6 bg-neutral-200 rounded-md w-3/4 animate-pulse"></div>
                    <div className="h-4 bg-neutral-200 rounded-md w-1/2 mt-3 animate-pulse"></div>
                    <div className="h-4 bg-neutral-200 rounded-md w-5/6 mt-2 animate-pulse"></div>
                    <div className="mt-auto flex justify-between items-center">
                        <div className="h-4 bg-neutral-200 rounded-md w-1/3 animate-pulse"></div>
                        <div className="h-6 bg-neutral-200 rounded-md w-6 animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    )

}