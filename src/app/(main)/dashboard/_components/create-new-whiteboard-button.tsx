
"use client"
import {useMutation} from "convex/react";
import {api} from "../../../../../convex/_generated/api";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog"
import {Loader, Plus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {z} from "zod";
import {ChangeEvent, useEffect, useState, useTransition, useRef} from "react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {VisuallyHidden} from "@radix-ui/react-visually-hidden";

const createWhiteboardSchema = z.object({
    topic: z.string().trim().min(2, "Topic is required"),
    problem_statement: z.string().optional(),
})

type CreateWhiteboardType = z.infer<typeof createWhiteboardSchema>;


const InitialWhiteboardForm = {
    topic: "",
    problem_statement: ""
};

export default function CreateNewWhiteboardButton({ query }: { query?: String }) {

    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isCreating, setIsCreating] = useState<"creating" | null>(null);
    const hasCreatedFromQuery = useRef(false); // Track if we've already started creation

    const [whiteboardForm, setWhiteboardForm] = useState<CreateWhiteboardType>(InitialWhiteboardForm);
    const create_new = useMutation(api.whiteboards.createWhiteboard);

    const change_form_value = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setWhiteboardForm(prev => ({
            ...prev,
            [id]: value
        }));
    }

    const create_new_whiteboard = () => {
        // If already creating, prevent multiple submissions
        if (isCreating === "creating") {
            return;
        }

        const validateFields = createWhiteboardSchema.safeParse(whiteboardForm);

        if (!validateFields.success){
            const err_msg = validateFields.error.errors[0];
            toast.error(err_msg.message || "Invalid form data");
            return;
        }

        startTransition(async () => {
            try {
                const result = await create_new(validateFields.data);

                if (result.success && result.new_id){
                    toast.success(result.message);
                    router.replace(`/whiteboard/${result.new_id}`);
                    setOpen(false);
                } else {
                    toast.error(result.message || "Couldn't create a new whiteboard. Try Again");
                }
            } catch (error) {
                console.error("Creation failed:", error);
                toast.error("Failed to create whiteboard. Please try again.");
            } finally {
                setIsCreating(null);
            }
        })
    }

    // Handle automatic creation when query is provided
    useEffect(() => {
        // Only proceed if:
        // 1. Query exists and isn't empty
        // 2. We haven't already started creating from this query
        // 3. We're not in the middle of another creation
        if (!query?.trim() || hasCreatedFromQuery.current || isCreating === "creating") {
            return;
        }

        // Immediately mark that we've started creation to prevent double execution
        hasCreatedFromQuery.current = true;

        try {
            // Create a whiteboard with the query directly without opening dialog
            const validatedFields = createWhiteboardSchema.parse({
                topic: query.toString()  // Convert String to string
            });

            // Set this state just for the loading indicator
            setOpen(prev => true);
            setIsCreating("creating");

            // Create the whiteboard directly
            startTransition(async () => {
                try {
                    const result = await create_new(validatedFields);

                    if (result.success && result.new_id){
                        toast.success(result.message);
                        router.replace(`/whiteboard/${result.new_id}`);
                    } else {
                        toast.error(result.message || "Couldn't create a new whiteboard. Try Again");
                        setOpen(false);
                        // Reset creation flag if we need to retry
                        hasCreatedFromQuery.current = false;
                    }
                } catch (error) {
                    console.error("Creation failed:", error);
                    toast.error("Failed to create whiteboard. Please try again.");
                    hasCreatedFromQuery.current = false;
                }
            });
        } catch (err) {
            console.error("Validation error:", err);
            toast.error("Something went wrong! Try Again");
            setIsCreating(null);
            hasCreatedFromQuery.current = false;
            setOpen( false);
        }
    }, [query, isCreating]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="p-2" disabled={isCreating === "creating"}>
                    {isCreating === "creating" ? (
                        <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:block">
                                Create Whiteboard AI
                            </span>
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl bg-white">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        create_new_whiteboard();
                    }}
                >
                    { (isCreating === null) && (
                        <div className={"space-y-5"}>
                            <DialogHeader>
                                <DialogTitle className="leading-4">Create a Whiteboard</DialogTitle>
                                <DialogDescription>
                                    Fill in below to get help working through a problem, exploring a topic, or getting step-by-step guidance.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-5">
                                <div className="grid gap-2">
                                    <Label htmlFor="board-title">Topic</Label>
                                    <Input
                                        value={whiteboardForm.topic}
                                        onChange={e => change_form_value(e)}
                                        id="topic"
                                        name="topic"
                                        placeholder="e.g. Solve Physics Homework, Startup Brainstorming"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="board-problem">What do you need help with?</Label>
                                    <Textarea
                                        value={whiteboardForm.problem_statement}
                                        onChange={e => change_form_value(e)}
                                        id="problem_statement"
                                        name="problem_statement"
                                        placeholder="Describe the problem or topic. For example: 'I need help understanding async/await in JavaScript' or 'Design a basic marketing plan for a coffee shop.'"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="neutral"
                                    >
                                        Cancel
                                    </Button>
                                </DialogClose>

                                <Button
                                    type="submit">
                                    { isPending && <Loader className={"mr-1 w-5 h-5 animate-spin"} /> }
                                    { isPending ? "Creating.." : "Create Whiteboard" }
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </form>

                { isCreating === "creating" && (
                    <>
                        <VisuallyHidden>
                            <DialogHeader>
                                <DialogTitle className="leading-4">Create a Whiteboard</DialogTitle>
                                <DialogDescription>
                                    Fill in below to get help working through a problem, exploring a topic, or getting step-by-step guidance.
                                </DialogDescription>
                            </DialogHeader>
                        </VisuallyHidden>

                        <div className="flex flex-col items-center justify-center text-center space-y-2">
                            <Loader strokeWidth={3} className="w-8 h-8 text-green-500 animate-spin" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Whiteboard is being created...
                            </h2>
                            {query && (
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Topic: <span className="font-medium text-gray-800 dark:text-white">{query}</span>
                                </p>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}