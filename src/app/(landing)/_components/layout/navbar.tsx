
"use client";
import BrandTitle from "@/components/brand-title";
import {Button} from "@/components/ui/button";
import {useAuth} from "@clerk/nextjs";
import Link from "next/link";
import {useTransition} from "react";
import SignOutButton from "@/app/(landing)/(auth)/_components/sign-out-button";
import {Loader} from "lucide-react";

export default function PublicNavbar(){

    const { isLoaded, isSignedIn, signOut } = useAuth();

    return (
        <header className={"flex justify-between items-center"}>
            <Link href={"/"} className={"hidden sm:block"}>
                <BrandTitle />
            </Link>

            <nav className={"ml-auto"}>
                { isLoaded ? (
                    isSignedIn ? (
                        <div className={"flex gap-4"}>
                            <Link href={"/dashboard"}>
                                <Button
                                    className={"rounded-lg"}
                                >
                                    Dashboard
                                </Button>
                            </Link>

                            <SignOutButton />
                        </div>
                    ): (
                        <div className={"flex gap-4"}>
                            <Link href={"/sign-in"}>
                                <Button
                                    variant={"reverse"}
                                >
                                    Login
                                </Button>
                            </Link>

                            <Link href={"/sign-up"}>
                                <Button variant={"reverseNeutral"}>
                                    Sign up
                                </Button>
                            </Link>
                        </div>
                    )
                ) : (
                    <span className={"flex items-center gap-1 animate-pulse text-sm"}>
                        <Loader className={"w-4 h-4 animate-spin"} />
                        Loading...
                    </span>
                )}
            </nav>
        </header>
    )

}