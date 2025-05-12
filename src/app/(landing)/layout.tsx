
import PublicNavbar from "@/app/(landing)/_components/layout/navbar";

type LandingPageProps = {
    readonly children: React.ReactNode
}
export default async function LandingPageLayout({ children }: LandingPageProps){

    return (
        <div className={"flex flex-col p-4"}>
            <div className={"mx-auto max-w-screen-xl w-full"}>
                <PublicNavbar />
            </div>
            {children}
        </div>
    )

}