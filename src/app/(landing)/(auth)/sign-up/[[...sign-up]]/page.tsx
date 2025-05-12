

import {SignUp} from '@clerk/nextjs'

export default function SignInPage() {

    return (
        <div className={"flex justify-center items-center h-[calc(100vh-74px)]"}>
            <SignUp />
        </div>
    )
}