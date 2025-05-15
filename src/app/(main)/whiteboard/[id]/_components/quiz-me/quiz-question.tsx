
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import MarkdownRenderer from "@/components/markdown-renderer";

type QuestionType = {
    question: string;
    options: string[];
    answer: string;
};

type QuizQuestionProps = {
    questionItem: QuestionType;
    questionIndex: number;
    onAnswered: (questionIndex: number, isCorrect: boolean) => void;
};

export default function QuizQuestion({ questionItem, questionIndex, onAnswered }: QuizQuestionProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    const handleOptionSelect = (option: string) => {
        if (isSubmitted) return;
        setSelectedOption(option);
    };

    const handleSubmit = () => {
        if (!selectedOption) {
            console.warn("No option selected");
            return;
        }
        const correct = selectedOption === questionItem.answer;
        setIsCorrect(correct);
        setIsSubmitted(true);
        onAnswered(questionIndex, correct);
    };

    const getOptionButtonClasses = (option: string): string => {
        const baseClasses = "w-full justify-start text-left h-auto py-2 px-3 whitespace-normal text-sm items-center transition-all duration-200 ease-in-out rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-1";

        // State: Before Submission
        if (!isSubmitted) {
            if (selectedOption === option) {
                // Selected, not submitted
                return `${baseClasses} bg-indigo-600 border border-transparent text-white shadow-sm hover:bg-indigo-700 focus:ring-indigo-500`;
            } else {
                // Not selected, not submitted
                return `${baseClasses} bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 hover:border-gray-400 focus:ring-indigo-500`;
            }
        }

        // State: After Submission
        if (option === questionItem.answer) {
            // Correct answer (always highlighted green)
            return `${baseClasses} bg-green-100 border border-green-500 text-green-700 font-medium shadow-sm cursor-not-allowed`;
        }
        if (option === selectedOption && option !== questionItem.answer) {
            // Incorrectly selected answer (highlighted red)
            return `${baseClasses} bg-red-100 border border-red-500 text-red-700 font-medium shadow-sm cursor-not-allowed`;
        }

        // Other options after submission
        return `${baseClasses} bg-gray-100 border border-gray-200 text-gray-500 opacity-70 cursor-not-allowed`;
    };

    const getOptionIndicator = (option: string) => {
        if (!isSubmitted) {
            return <span className="w-4 h-4 mr-1"></span>; // Smaller placeholder
        }
        // After submission
        if (option === questionItem.answer) return <CheckCircle className="h-4 w-4 mr-1 text-green-600" />;
        if (option === selectedOption && option !== questionItem.answer) return <XCircle className="h-4 w-4 mr-1 text-red-600" />;
        return <span className="w-4 h-4 mr-1"></span>; // Smaller placeholder
    };

    return (
        <Card className="mb-4 w-full max-w-2xl mx-auto overflow-hidden bg-white border border-gray-200">
            <CardHeader className="bg-gray-50 p-3 border-b border-gray-200">
                <CardTitle className="text-base font-medium text-gray-800 flex items-start">
                    <span className="text-indigo-600 font-semibold mr-2 text-sm">Q{questionIndex + 1}.</span>
                    <MarkdownRenderer content={questionItem.question} />
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
                <div className="space-y-2">
                    {questionItem?.options?.map((option, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className={getOptionButtonClasses(option)}
                            onClick={() => handleOptionSelect(option)}
                            disabled={isSubmitted}
                        >
                            {getOptionIndicator(option)}
                            <span className={`mr-1 font-medium text-sm ${isSubmitted && option === questionItem.answer ? 'text-green-700' : (isSubmitted && option === selectedOption && option !== questionItem.answer ? 'text-red-700' : (selectedOption === option && !isSubmitted ? 'text-white' : 'text-gray-700'))}`}>
                                {String.fromCharCode(65 + idx)}.
                            </span>
                            <div className={`text-sm ${isSubmitted && option === questionItem.answer ? 'text-green-700' : (isSubmitted && option === selectedOption && option !== questionItem.answer ? 'text-red-700' : (selectedOption === option && !isSubmitted ? 'text-white' : 'text-gray-800'))}`}>
                                <MarkdownRenderer content={option} />
                            </div>
                        </button>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0 px-3 py-1 bg-gray-50 border-t border-gray-200">
                {!isSubmitted ? (
                    <Button
                        size={"sm"}
                        onClick={handleSubmit}
                        disabled={!selectedOption}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-4 text-sm rounded-md shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        Check Answer
                    </Button>
                ) : (
                    <div className={`flex items-center font-medium p-2 rounded-md w-full sm:w-auto justify-center text-sm
                        ${isCorrect ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}
                    >
                        {isCorrect ? <CheckCircle className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                        {isCorrect ? 'Correct!' : 'Incorrect!'}
                        {!isCorrect && (
                            <span className="ml-1 text-xs text-gray-600 hidden md:inline">
                                (Correct answer is in green)
                            </span>
                        )}
                    </div>
                )}
                {isSubmitted && !selectedOption && (
                    <div className="flex items-center text-xs text-yellow-600 mt-1 sm:mt-0">
                        <AlertTriangle className="h-3 w-3 mr-1" /> You didn't select an answer.
                    </div>
                )}
            </CardFooter>
        </Card>
    );
}