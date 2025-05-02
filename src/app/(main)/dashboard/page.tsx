import DashboardContents from "@/app/(main)/dashboard/_components/dashboard-contents";
import {Button} from "@/components/ui/button";
import {Flashlight, Plus} from "lucide-react";
import BrandTitle from "@/components/brand-title";
import { FaBoltLightning } from "react-icons/fa6";

type SearchParams = Promise<{ [key: string]: string | undefined }>

type DashboardPageProps = {
    searchParams: SearchParams
}
export default async function DashboardPage({ searchParams }: DashboardPageProps){

    const search_params = await searchParams;
    const query = search_params?.query;

    return (
        <div className={""}>

            <div className="px-4 py-3 flex justify-between items-center border-b border-neutral-100">

                <BrandTitle className={"text-xl"} />

                <div className="flex items-center gap-2">
                    <Button
                        size={"sm"}
                        variant={"reverseNeutral"}
                        className="p-2 hover:bg-gray-100"
                    >
                        <FaBoltLightning className={"w-5 h-5"} />
                        Upgrade
                    </Button>
                </div>
            </div>

            <DashboardContents query={query} />
        </div>
    )

}