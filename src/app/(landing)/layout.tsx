
import PublicNavbar from "@/app/(landing)/_components/layout/navbar";

type LandingPageProps = {
    readonly children: React.ReactNode
}
export default async function LandingPageLayout({ children }: LandingPageProps){

    return (
        <div className={"flex flex-col"}>
            <div className={"mx-auto max-w-screen-xl w-full px-4 py-4"}>
                <PublicNavbar />
            </div>
            {children}
        </div>
    )

}