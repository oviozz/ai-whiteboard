
"use client";
import {SignIn, useAuth} from "@clerk/nextjs";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@radix-ui/react-dialog";
import {VisuallyHidden} from "@radix-ui/react-visually-hidden";
import {DialogHeader} from "next/dist/client/components/react-dev-overlay/ui/components/dialog";

type AuthCheckerProps = {
    children?: React.ReactNode
}
export default function AuthChecker({ children }: AuthCheckerProps){

    const { userId } = useAuth();

    return userId ? children : (
        <Dialog>
            <VisuallyHidden>
                <DialogHeader>
                    <DialogTitle>AI Whiteboard</DialogTitle>
                    <DialogDescription>
                        Sign in to use our services
                    </DialogDescription>
                </DialogHeader>
            </VisuallyHidden>
            <DialogContent>
                <SignIn />
            </DialogContent>
        </Dialog>
    )

}