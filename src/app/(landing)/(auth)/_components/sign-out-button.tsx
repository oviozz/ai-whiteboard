
"use client";
import {useTransition} from "react";
import {useAuth} from "@clerk/nextjs";
import {Button} from "@/components/ui/button";
import {Loader} from "lucide-react";
import {useRouter} from "next/navigation";

type SignOutButtonProps = {
    size?: "sm" | "default" | "lg"
}
export default function SignOutButton({ size = "default" }: SignOutButtonProps){

    const router = useRouter();
    const { signOut } = useAuth();
    const [isPending, startTransition] = useTransition();

    const sign_out_handler = () => {
        startTransition(async () => {
            signOut();
            router.replace("/");
        });
    }

    return (
        <Button
            size={size}
            onClick={sign_out_handler}
            variant={"neutral"}>
            { isPending && <Loader className={"w-4 h-4 animate-spin"} />}
            { isPending ? "Loading.." : "Log out" }
        </Button>
    )

}