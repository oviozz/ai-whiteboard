
"use client";
import {Input} from "@/components/ui/input";
import {BookOpen, Code, Cpu, Search, Sparkles, Loader} from "lucide-react";
import {Button} from "@/components/ui/button";
import {FormEvent, useRef, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import AuthChecker from "@/components/auth-checker";

export default function TopicInput(){

    const router = useRouter();
    const [query, setQuery] = useState("");
    const [isPending, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);

    const navigate_form = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!query.trim()) {
            if (formRef.current) {
                formRef.current.classList.add("shake");

                // Remove the class after animation ends
                const handleAnimationEnd = () => {
                    formRef.current?.classList.remove("shake");
                    formRef.current?.removeEventListener("animationend", handleAnimationEnd);
                };
                formRef.current.addEventListener("animationend", handleAnimationEnd);
            }
            return;
        }

        startTransition(() => {
            router.replace(`/dashboard?query=${query}`)
        })
    }

    return (
        <>
            <div className="relative mb-10 w-full">
                <form
                    ref={formRef}
                    onSubmit={navigate_form}
                    className={"relative rounded-full transition-all duration-300 max-w-2xl mx-auto w-full"}>
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        type="text"
                        placeholder="Enter any topic or skill..."
                        className="border-none bg-neutral-100 w-full py-7 pl-14 text-base sm:text-lg rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <Search strokeWidth={3} size={24}/>
                    </div>

                    <div className={"absolute right-4 top-1/2 transform -translate-y-1/2"}>
                        <Button
                            size={"sm"}
                            className={"rounded-full"}
                        >
                            { isPending ? (
                                <Loader className={"w-5 h-5 animate-spin"} />
                            ) : (
                                "Learn"
                            )}
                        </Button>
                    </div>

                </form>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <p className="text-lg">🔥 Popular:</p>
                <ul className={"flex flex-wrap justify-center gap-4"}>
                    {popularTopics.map((topic, index) => (
                        <Button
                            size={"sm"}
                            onClick={() => setQuery(topic.name)}
                            variant={"neutral"}
                            key={index}
                        >
                            {topic.icon}
                            {topic.name}
                        </Button>
                    ))}
                </ul>
            </div>
        </>
    )
}

const popularTopics = [
    {name: 'Machine Learning', icon: <Cpu className="mr-2" size={20}/> },
    {name: 'Quantum Physics', icon: <Sparkles className="mr-2" size={20}/> },
    {name: 'Web Development', icon: <Code className="mr-2" size={20}/> },
    {name: 'Data Science', icon: <BookOpen className="mr-2" size={20}/> }
];
