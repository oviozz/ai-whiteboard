
import DashboardContents from "@/app/(main)/dashboard/_components/dashboard-contents";
import DashboardNavbar from "@/app/(main)/dashboard/_components/layout/navbar";

type SearchParams = Promise<{ [key: string]: string | undefined }>

type DashboardPageProps = {
    searchParams: SearchParams
}
export default async function DashboardPage({ searchParams }: DashboardPageProps){

    const search_params = await searchParams;
    const query = search_params?.query;

    return (
        <div className={""}>
            <DashboardNavbar />
            <DashboardContents query={query} />
        </div>
    )

}