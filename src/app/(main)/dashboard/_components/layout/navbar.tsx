
import BrandTitle from "@/components/brand-title";
import {Button} from "@/components/ui/button";
import {FaBoltLightning} from "react-icons/fa6";
import SignOutButton from "@/app/(landing)/(auth)/_components/sign-out-button";

export default function DashboardNavbar(){

    return (
        <div className="px-4 py-3 flex justify-between items-center border-b border-neutral-100">

            <BrandTitle className={"text-xl"} />

            <div className="flex items-center gap-3">
                <Button
                    size={"sm"}
                    variant={"neutral"}
                    className="p-2 hover:bg-gray-100 bg-orange-500 text-white hover:bg-orange-600"
                >
                    <FaBoltLightning className={"w-5 h-5"} />
                    Upgrade
                </Button>

                <SignOutButton size={"sm"} />
            </div>
        </div>
    )

}