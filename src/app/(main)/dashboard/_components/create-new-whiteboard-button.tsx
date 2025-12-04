"use client"
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
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
import { Loader, Plus, ArrowLeft, ArrowRight, FileText, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { ChangeEvent, useEffect, useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import StudyMaterialUploader, { UploadedFile } from "@/components/file-upload/study-material-uploader";
import { ScrollArea } from "@/components/ui/scroll-area";

const createWhiteboardSchema = z.object({
    topic: z.string().trim().min(2, "Topic is required"),
    problem_statement: z.string().optional(),
})

type CreateWhiteboardType = z.infer<typeof createWhiteboardSchema>;

type CreationStep = "details" | "upload" | "processing" | "problems" | "creating";

type ExtractedProblem = {
    id: string;
    text: string;
    pageNumber?: number;
    difficulty?: string;
    selected: boolean;
    documentId?: Id<"whiteboardDocuments">;
};

const InitialWhiteboardForm = {
    topic: "",
    problem_statement: ""
};

export default function CreateNewWhiteboardButton({ query }: { query?: String }) {

    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [step, setStep] = useState<CreationStep>("details");
    const hasCreatedFromQuery = useRef(false);

    const [whiteboardForm, setWhiteboardForm] = useState<CreateWhiteboardType>(InitialWhiteboardForm);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [extractedProblems, setExtractedProblems] = useState<ExtractedProblem[]>([]);
    const [processingFiles, setProcessingFiles] = useState(false);

    const create_new = useMutation(api.whiteboards.createWhiteboard);
    const generateUploadUrl = useMutation(api.whiteboardActions.generateUploadUrl);
    const createDocumentRecord = useMutation(api.documents.createDocumentRecord);
    const processDocument = useAction(api.documents.processDocument);

    const change_form_value = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setWhiteboardForm(prev => ({
            ...prev,
            [id]: value
        }));
    }

    const resetForm = useCallback(() => {
        setWhiteboardForm(InitialWhiteboardForm);
        setUploadedFiles([]);
        setExtractedProblems([]);
        setStep("details");
        setProcessingFiles(false);
    }, []);

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            resetForm();
        }
    };

    // Upload files and process them
    const uploadAndProcessFiles = async (whiteboardId: Id<"whiteboards">) => {
        const pendingFiles = uploadedFiles.filter(f => f.status === "pending");
        if (pendingFiles.length === 0) return [];

        const documentIds: Id<"whiteboardDocuments">[] = [];

        for (const uploadedFile of pendingFiles) {
            try {
                // Update status
                setUploadedFiles(prev => prev.map(f => 
                    f.id === uploadedFile.id ? { ...f, status: "uploading" as const } : f
                ));

                // Get upload URL and upload file
                const uploadUrl = await generateUploadUrl();
                const uploadResult = await fetch(uploadUrl, { method: "POST", body: uploadedFile.file });
                
                if (!uploadResult.ok) {
                    throw new Error(`Upload failed: ${uploadResult.statusText}`);
                }

                const { storageId } = await uploadResult.json();

                // Create document record
                const documentId = await createDocumentRecord({
                    whiteboardID: whiteboardId,
                    storageId,
                    filename: uploadedFile.name,
                    fileType: uploadedFile.type,
                    fileSize: uploadedFile.size,
                });

                documentIds.push(documentId);

                // Update file status
                setUploadedFiles(prev => prev.map(f => 
                    f.id === uploadedFile.id 
                        ? { ...f, status: "processing" as const, storageId } 
                        : f
                ));

                // Process document for content extraction
                const processResult = await processDocument({ documentId });
                
                if (processResult?.success) {
                    setUploadedFiles(prev => prev.map(f => 
                        f.id === uploadedFile.id ? { ...f, status: "complete" as const } : f
                    ));
                } else {
                    setUploadedFiles(prev => prev.map(f => 
                        f.id === uploadedFile.id 
                            ? { ...f, status: "error" as const, error: processResult?.error || "Processing failed" } 
                            : f
                    ));
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Upload failed";
                setUploadedFiles(prev => prev.map(f => 
                    f.id === uploadedFile.id ? { ...f, status: "error" as const, error: errorMessage } : f
                ));
            }
        }

        return documentIds;
    };

    const create_new_whiteboard = async (skipUpload = false) => {
        if (step === "creating") return;

        const validateFields = createWhiteboardSchema.safeParse(whiteboardForm);

        if (!validateFields.success) {
            const err_msg = validateFields.error.errors[0];
            toast.error(err_msg.message || "Invalid form data");
            return;
        }

        setStep("creating");

        startTransition(async () => {
            try {
                const result = await create_new(validateFields.data);

                if (result.success && result.new_id) {
                    // If we have files to upload and not skipping
                    if (!skipUpload && uploadedFiles.length > 0) {
                        setStep("processing");
                        await uploadAndProcessFiles(result.new_id);
                    }

                    toast.success(result.message);
                    router.replace(`/whiteboard/${result.new_id}`);
                    setOpen(false);
                } else {
                    toast.error(result.message || "Couldn't create a new whiteboard. Try Again");
                    setStep("details");
                }
            } catch (error) {
                console.error("Creation failed:", error);
                toast.error("Failed to create whiteboard. Please try again.");
                setStep("details");
            }
        })
    }

    const goToNextStep = () => {
        if (step === "details") {
            const validateFields = createWhiteboardSchema.safeParse(whiteboardForm);
            if (!validateFields.success) {
                const err_msg = validateFields.error.errors[0];
                toast.error(err_msg.message || "Invalid form data");
                return;
            }
            setStep("upload");
        } else if (step === "upload") {
            if (uploadedFiles.length > 0) {
                // Process files and go to problems step
                create_new_whiteboard();
            } else {
                // No files, create whiteboard directly
                create_new_whiteboard(true);
            }
        }
    };

    const goToPreviousStep = () => {
        if (step === "upload") {
            setStep("details");
        }
    };

    const toggleProblemSelection = (problemId: string) => {
        setExtractedProblems(prev => prev.map(p => 
            p.id === problemId ? { ...p, selected: !p.selected } : p
        ));
    };

    // Handle automatic creation when query is provided
    useEffect(() => {
        if (!query?.trim() || hasCreatedFromQuery.current || step === "creating") {
            return;
        }

        hasCreatedFromQuery.current = true;

        try {
            const validatedFields = createWhiteboardSchema.parse({
                topic: query.toString()
            });

            setOpen(true);
            setStep("creating");

            startTransition(async () => {
                try {
                    const result = await create_new(validatedFields);

                    if (result.success && result.new_id) {
                        toast.success(result.message);
                        router.replace(`/whiteboard/${result.new_id}`);
                    } else {
                        toast.error(result.message || "Couldn't create a new whiteboard. Try Again");
                        setOpen(false);
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
            setStep("details");
            hasCreatedFromQuery.current = false;
            setOpen(false);
        }
    }, [query, step]);

    const renderStepIndicator = () => {
        const steps = [
            { key: "details", label: "Details" },
            { key: "upload", label: "Materials" },
        ];

        return (
            <div className="flex items-center justify-center gap-2 mb-4">
                {steps.map((s, index) => (
                    <div key={s.key} className="flex items-center">
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2
                            ${step === s.key || (step === "processing" && s.key === "upload") || (step === "creating" && s.key === "upload")
                                ? "border-indigo-500 bg-indigo-500 text-white"
                                : steps.findIndex(st => st.key === step) > index || step === "problems" || step === "creating"
                                    ? "border-indigo-500 bg-indigo-100 text-indigo-700"
                                    : "border-slate-300 bg-white text-slate-500"
                            }
                        `}>
                            {steps.findIndex(st => st.key === step) > index || step === "problems" || step === "creating" ? (
                                <Check className="w-4 h-4" />
                            ) : (
                                index + 1
                            )}
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`w-8 h-0.5 mx-1 ${
                                steps.findIndex(st => st.key === step) > index 
                                    ? "bg-indigo-500" 
                                    : "bg-slate-200"
                            }`} />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="p-2" disabled={step === "creating"}>
                    {step === "creating" ? (
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
            <DialogContent className="rounded-xl bg-white max-w-lg">
                {/* Step 1: Details */}
                {step === "details" && (
                    <div className="space-y-5">
                        {renderStepIndicator()}
                        <DialogHeader>
                            <DialogTitle className="leading-4">What would you like to learn?</DialogTitle>
                            <DialogDescription>
                                Enter your topic and describe what you need help with.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="topic">Topic</Label>
                                <Input
                                    value={whiteboardForm.topic}
                                    onChange={change_form_value}
                                    id="topic"
                                    name="topic"
                                    placeholder="e.g. Calculus, Physics, Programming"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="problem_statement">What do you need help with? (Optional)</Label>
                                <Textarea
                                    value={whiteboardForm.problem_statement}
                                    onChange={change_form_value}
                                    id="problem_statement"
                                    name="problem_statement"
                                    placeholder="Describe the specific problem or concept you're working on..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="neutral">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="button" onClick={goToNextStep}>
                                Next
                                <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* Step 2: Upload Materials */}
                {step === "upload" && (
                    <div className="space-y-5">
                        {renderStepIndicator()}
                        <DialogHeader>
                            <DialogTitle className="leading-4">Upload Study Materials</DialogTitle>
                            <DialogDescription>
                                Upload your slides, PDFs, or images. The AI will extract problems and use them as context. (Optional)
                            </DialogDescription>
                        </DialogHeader>
                        
                        <StudyMaterialUploader
                            files={uploadedFiles}
                            onFilesChange={setUploadedFiles}
                            maxFiles={5}
                            maxFileSize={10 * 1024 * 1024}
                        />

                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button type="button" variant="neutral" onClick={goToPreviousStep}>
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back
                            </Button>
                            <div className="flex gap-2">
                                <Button 
                                    type="button" 
                                    variant="neutral"
                                    onClick={() => create_new_whiteboard(true)}
                                >
                                    Skip
                                </Button>
                                <Button 
                                    type="button" 
                                    onClick={goToNextStep}
                                    disabled={isPending}
                                >
                                    {uploadedFiles.length > 0 ? (
                                        <>
                                            Create with {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""}
                                        </>
                                    ) : (
                                        "Create Whiteboard"
                                    )}
                                </Button>
                            </div>
                        </DialogFooter>
                    </div>
                )}

                {/* Processing State */}
                {step === "processing" && (
                    <>
                        <VisuallyHidden>
                            <DialogHeader>
                                <DialogTitle>Processing</DialogTitle>
                                <DialogDescription>Processing your files</DialogDescription>
                            </DialogHeader>
                        </VisuallyHidden>
                        <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
                            <Loader strokeWidth={3} className="w-10 h-10 text-indigo-500 animate-spin" />
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    Processing your materials...
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Extracting content and problems from your files
                                </p>
                            </div>
                            <div className="w-full space-y-2 mt-4">
                                {uploadedFiles.map(file => (
                                    <div key={file.id} className="flex items-center gap-2 text-sm">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                        <span className="flex-1 text-left truncate">{file.name}</span>
                                        {file.status === "complete" && (
                                            <Check className="w-4 h-4 text-green-500" />
                                        )}
                                        {file.status === "error" && (
                                            <X className="w-4 h-4 text-red-500" />
                                        )}
                                        {(file.status === "uploading" || file.status === "processing") && (
                                            <Loader className="w-4 h-4 text-indigo-500 animate-spin" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Creating State */}
                {step === "creating" && (
                    <>
                        <VisuallyHidden>
                            <DialogHeader>
                                <DialogTitle className="leading-4">Create a Whiteboard</DialogTitle>
                                <DialogDescription>
                                    Creating your whiteboard
                                </DialogDescription>
                            </DialogHeader>
                        </VisuallyHidden>

                        <div className="flex flex-col items-center justify-center text-center py-8 space-y-2">
                            <Loader strokeWidth={3} className="w-8 h-8 text-indigo-500 animate-spin" />
                            <h2 className="text-lg font-semibold text-slate-900">
                                Creating your whiteboard...
                            </h2>
                            <p className="text-sm text-slate-500">
                                Topic: <span className="font-medium text-slate-700">{whiteboardForm.topic || query}</span>
                            </p>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}