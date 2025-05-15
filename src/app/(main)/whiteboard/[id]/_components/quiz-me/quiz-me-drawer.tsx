
"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { experimental_useObject } from '@ai-sdk/react';
import { z } from "zod";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader, DrawerOverlay,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, XCircle, Trophy, Lightbulb } from 'lucide-react';
import QuizQuestion from "@/app/(main)/whiteboard/[id]/_components/quiz-me/quiz-question";
import {ScrollArea} from "@/components/ui/scroll-area";

// Zod schemas
const questionSchema = z.object({
    question: z.string().describe("Generated question"),
    options: z.array(z.string()).length(4).describe("List of 4 mcq options"),
    answer: z.string().describe("The answer to the generated question")
});
const questionsResponseSchema = z.array(questionSchema);

// Type inferred from Zod schema
type QuestionType = z.infer<typeof questionSchema>;

type QuizMeDrawerProps = {
    topic: string;
    problem_statement?: string;
    numberOfQuestions?: number;
};

export default function QuizMeDrawer({
                                         topic,
                                         problem_statement,
                                         numberOfQuestions = 5,
                                     }: QuizMeDrawerProps) {
    const [isOpen, setIsOpen] = useState(false);
    // quizSessionId forces re-render of QuizQuestion children with fresh state on new quiz
    const [quizSessionId, setQuizSessionId] = useState(Date.now());
    const [answeredStats, setAnsweredStats] = useState<Record<number, boolean>>({}); // { questionIndex: isCorrect }

    const questionsContainerRef = useRef<HTMLDivElement>(null);

    const { object, isLoading, error, submit, stop } = experimental_useObject({
        api: "/api/whiteboard/generate-quiz", // Your API endpoint
        schema: z.object({ questions: questionsResponseSchema }),
    });

    // Fix the TypeScript error by using proper type handling
    const questions: QuestionType[] = useMemo(() => {
        if (!object || !object.questions) return [];
        return object.questions.filter((q): q is QuestionType =>
            q !== undefined &&
            typeof q.question === 'string' &&
            Array.isArray(q.options) &&
            typeof q.answer === 'string'
        );
    }, [object]);

    // Effect for scrolling when new questions are added
    useEffect(() => {
        if (questions.length > 0 && questionsContainerRef.current) {
            const timer = setTimeout(() => {
                questionsContainerRef.current?.scrollTo({
                    top: questionsContainerRef.current.scrollHeight,
                    behavior: 'smooth',
                });
            }, 100); // Small delay to ensure DOM is updated
            return () => clearTimeout(timer);
        }
    }, [questions.length]); // Trigger only when the number of questions changes

    const handleQuizTrigger = () => {
        setAnsweredStats({});
        setQuizSessionId(Date.now());

        // Submit new request. Using setTimeout to ensure resetAIHook has cleared state.
        setTimeout(() => {
            submit({
                topic: topic || "General Knowledge",
                problem_statement: problem_statement || "",
                number: numberOfQuestions,
            });
        }, 0);
    };

    const handleDrawerOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open && (!object || questions.length === 0)) { // If opening and no questions yet, trigger fetch
            handleQuizTrigger();
        }
    };

    const handleAnswerFromQuestion = (questionIndex: number, isCorrect: boolean) => {
        setAnsweredStats(prev => ({ ...prev, [questionIndex]: isCorrect }));
    };

    const totalAnswered = Object.keys(answeredStats).length;
    const totalCorrect = Object.values(answeredStats).filter(Boolean).length;

    // Determine if all questions expected have been generated (approximate)
    const allQuestionsGenerated = !isLoading && questions.length > 0 && questions.length >= numberOfQuestions;
    const quizCompleted = allQuestionsGenerated && totalAnswered === questions.length;

    const renderContent = () => {
        if (isLoading && questions.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
                    <p className="text-lg font-semibold text-gray-700">Generating your quiz on "{topic}"...</p>
                    <p className="text-muted-foreground">Hold tight, the AI is crafting your questions!</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-red-600 text-center px-4">
                    <XCircle className="h-12 w-12 mb-6" />
                    <p className="text-lg font-semibold">Oops! Something went wrong.</p>
                    <p className="text-sm mb-4">{error.message || "Failed to generate quiz questions."}</p>
                    <Button onClick={handleQuizTrigger} variant="reverseNeutral">
                        <RefreshCw className="mr-2 h-4 w-4" /> Try Again
                    </Button>
                </div>
            );
        }

        // Handles case where submit was called, not loading, no error, but no questions.
        if (!isLoading && questions.length === 0 && object !== undefined) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
                    <Lightbulb className="h-12 w-12 text-yellow-500 mb-6" />
                    <p className="text-lg font-semibold text-gray-700">No questions here yet.</p>
                    <p className="text-muted-foreground mb-4">
                        The quiz might be empty, or an issue occurred.
                    </p>
                    <Button onClick={handleQuizTrigger} variant="reverse">
                        <RefreshCw className="mr-2 h-4 w-4" /> Try to Generate Again
                    </Button>
                </div>
            );
        }

        if (questions.length === 0 && object === undefined) { // Initial state before first trigger
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
                    <p className="text-muted-foreground">Click the "Quiz me" button to start generating questions!</p>
                </div>
            )
        }

        return (
            <>
                {questions?.map((q, index) => (
                    <QuizQuestion
                        key={`${quizSessionId}-${index}`} // Unique key for each question instance in a session
                        questionItem={q}
                        questionIndex={index}
                        onAnswered={handleAnswerFromQuestion}
                    />
                ))}
                {isLoading && questions.length > 0 && questions.length < numberOfQuestions && (
                    <div className="flex items-center justify-center my-8 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
                        <div>
                            <p className="text-md font-semibold text-gray-700">Generating more questions...</p>
                            <p className="text-sm text-muted-foreground">({questions.length}/{numberOfQuestions} loaded)</p>
                        </div>
                    </div>
                )}
                {quizCompleted && (
                    <div className="mt-10 mb-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl shadow-lg text-center">
                        <Trophy className="h-20 w-20 text-yellow-400 mx-auto mb-5" />
                        <h3 className="text-3xl font-bold text-green-700 mb-3">Quiz Completed!</h3>
                        <p className="text-xl text-gray-800">
                            Your Score: <span className="font-extrabold text-green-600">{totalCorrect}</span> / <span className="font-extrabold">{questions.length}</span>
                        </p>
                        <p className="text-lg mt-2 text-gray-600">
                            Accuracy: {questions.length > 0 ? ((totalCorrect / questions.length) * 100).toFixed(0) : 0}%
                        </p>
                        <Button onClick={handleQuizTrigger} variant="default" size="lg" className="mt-8">
                            <RefreshCw className="mr-2 h-5 w-5" /> Start New Quiz
                        </Button>
                    </div>
                )}
            </>
        );
    };

    return (
        <div>
            <Drawer open={isOpen} onOpenChange={handleDrawerOpenChange}>
                <DrawerTrigger asChild>
                    <Button variant="default" size="sm">
                        Quiz me on "{topic}"
                    </Button>
                </DrawerTrigger>
                <DrawerContent
                    style={{ maxHeight: '95%' }}
                    className="mx-auto bg-gray-50 h-full flex flex-col outline-none">
                    <DrawerHeader className="text-left px-6 py-3 border-b">
                        <div className="flex justify-between items-center">
                            <div>
                                <DrawerTitle className="text-xl font-bold text-gray-800">Quiz: {topic}</DrawerTitle>
                                <DrawerDescription className="text-sm text-gray-600 mt-1">
                                    {problem_statement || `Test your knowledge on ${topic}.`}
                                    {questions.length > 0 && !quizCompleted && (
                                        <span className="text-xs text-blue-600 font-medium ml-2">
                                        Answered: {totalAnswered} / {questions.length}
                                            {isLoading && questions.length < numberOfQuestions ? ` (Generating...)` : ''}
                                    </span>
                                    )}
                                </DrawerDescription>
                            </div>
                            <DrawerClose asChild>
                                <Button variant="neutral" size="sm" className="h-8 w-8 p-0">
                                    <span className="sr-only">Close</span>
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </DrawerClose>
                        </div>
                    </DrawerHeader>

                    <ScrollArea className="flex-grow px-2 sm:px-4">
                        <div ref={questionsContainerRef} className="py-4 space-y-5">
                            {renderContent()}
                        </div>
                    </ScrollArea>

                    <DrawerFooter className="border-t bg-white py-2 px-6">
                        <div className="flex w-full justify-between items-center">
                            <Button onClick={handleQuizTrigger} variant="reverse" disabled={isLoading && questions.length === 0} size="sm">
                                <RefreshCw className="mr-2 h-3 w-3" />
                                {isLoading && questions.length === 0 ? "Generating..." : "New Quiz"}
                            </Button>
                            <DrawerClose asChild>
                                <Button variant="reverseNeutral" size="sm">Close</Button>
                            </DrawerClose>
                        </div>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
}