"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Play,
  ExternalLink,
  Loader2,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Trophy,
  BookOpen,
  Shuffle,
  ListChecks,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { toast } from "sonner";

type QuizType = "multiple_choice" | "matching" | "fill_blank";

type QuizQuestion = {
  id: string;
  type: QuizType;
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  hint?: string;
  videoSearch?: string;
  explanation?: string;
  pairs?: { left: string; right: string }[];
};

type QuizState = {
  currentIndex: number;
  answers: Record<string, string | string[]>;
  showHint: Record<string, boolean>;
  showResult: Record<string, boolean>;
  startTime: number;
  stuckTime: Record<string, number>;
};

type QuizDrawerProps = {
  whiteboardID: Id<"whiteboards">;
};

export default function QuizDrawer({ whiteboardID }: QuizDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<QuizType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizState, setQuizState] = useState<QuizState>({
    currentIndex: 0,
    answers: {},
    showHint: {},
    showResult: {},
    startTime: Date.now(),
    stuckTime: {},
  });
  const [showCompletion, setShowCompletion] = useState(false);
  const stuckTimerRef = useRef<NodeJS.Timeout | null>(null);

  const whiteboardInfo = useQuery(api.whiteboards.getWhiteboardID, {
    whiteboardID,
  });

  const topic = whiteboardInfo?.topic || "General";

  // Listen for open event
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setSelectedType(null);
      setQuestions([]);
      setShowCompletion(false);
      setQuizState({
        currentIndex: 0,
        answers: {},
        showHint: {},
        showResult: {},
        startTime: Date.now(),
        stuckTime: {},
      });
    };

    window.addEventListener("open-quiz-drawer", handleOpen);
    return () => window.removeEventListener("open-quiz-drawer", handleOpen);
  }, []);

  // Stuck timer
  useEffect(() => {
    if (!isOpen || questions.length === 0 || showCompletion) return;

    const currentQuestion = questions[quizState.currentIndex];
    if (!currentQuestion) return;

    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
    }

    if (quizState.showResult[currentQuestion.id]) return;

    stuckTimerRef.current = setTimeout(() => {
      setQuizState((prev) => ({
        ...prev,
        stuckTime: {
          ...prev.stuckTime,
          [currentQuestion.id]: Date.now(),
        },
      }));
    }, 15000);

    return () => {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
      }
    };
  }, [isOpen, questions, quizState.currentIndex, quizState.showResult, showCompletion]);

  const generateQuiz = useCallback(async (type: QuizType) => {
    setIsGenerating(true);
    setSelectedType(type);

    try {
      const response = await fetch("/api/whiteboard/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          quizType: type,
          questionCount: 5,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate quiz");
      }

      const data = await response.json();
      setQuestions(data.questions || []);
      setQuizState({
        currentIndex: 0,
        answers: {},
        showHint: {},
        showResult: {},
        startTime: Date.now(),
        stuckTime: {},
      });
    } catch (error) {
      console.error("Quiz generation error:", error);
      toast.error("Failed to generate quiz. Please try again.");
      setSelectedType(null);
    } finally {
      setIsGenerating(false);
    }
  }, [topic]);

  const handleAnswer = (questionId: string, answer: string | string[]) => {
    setQuizState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));
  };

  const checkAnswer = (questionId: string) => {
    setQuizState((prev) => ({
      ...prev,
      showResult: { ...prev.showResult, [questionId]: true },
    }));

    const answeredCount = Object.keys(quizState.showResult).length + 1;
    if (answeredCount >= questions.length) {
      setTimeout(() => setShowCompletion(true), 1500);
    }
  };

  const toggleHint = (questionId: string) => {
    setQuizState((prev) => ({
      ...prev,
      showHint: { ...prev.showHint, [questionId]: !prev.showHint[questionId] },
    }));
  };

  const nextQuestion = () => {
    if (quizState.currentIndex < questions.length - 1) {
      setQuizState((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
      }));
    }
  };

  const prevQuestion = () => {
    if (quizState.currentIndex > 0) {
      setQuizState((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex - 1,
      }));
    }
  };

  const resetQuiz = () => {
    setSelectedType(null);
    setQuestions([]);
    setShowCompletion(false);
    setQuizState({
      currentIndex: 0,
      answers: {},
      showHint: {},
      showResult: {},
      startTime: Date.now(),
      stuckTime: {},
    });
  };

  const getScore = () => {
    let correct = 0;
    questions.forEach((q) => {
      const answer = quizState.answers[q.id];
      if (Array.isArray(q.correctAnswer)) {
        if (JSON.stringify(answer) === JSON.stringify(q.correctAnswer)) {
          correct++;
        }
      } else if (answer === q.correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  const isCorrect = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return false;
    const answer = quizState.answers[questionId];
    if (Array.isArray(question.correctAnswer)) {
      return JSON.stringify(answer) === JSON.stringify(question.correctAnswer);
    }
    return answer === question.correctAnswer;
  };

  const openVideoHelp = (searchQuery: string) => {
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
      "_blank"
    );
  };

  const currentQuestion = questions[quizState.currentIndex];
  const isStuck = currentQuestion && quizState.stuckTime[currentQuestion.id];

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <>
      {/* Sidebar - no backdrop, allows canvas interaction */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-40 transition-transform duration-300 ease-out pointer-events-auto",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ width: 400 }}
      >
        <div className="h-full bg-white border-l border-slate-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Quiz Me</h2>
                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                  {topic}
                </p>
              </div>
            </div>
            <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Canvas Tip */}
          {selectedType && questions.length > 0 && !showCompletion && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
              <Pencil className="w-3.5 h-3.5 text-blue-600" />
              <p className="text-xs text-blue-700">
                Use the whiteboard to work out your answer!
              </p>
            </div>
          )}

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-5">
              {/* Quiz Type Selection */}
              {!selectedType && !isGenerating && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">
                      Choose Quiz Type
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select how you want to be tested
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => generateQuiz("multiple_choice")}
                      className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                    >
                      <div className="p-2.5 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                        <ListChecks className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="text-left flex-1">
                        <h4 className="font-semibold text-slate-800 text-sm">
                          Multiple Choice
                        </h4>
                        <p className="text-xs text-slate-500">
                          Pick the correct answer
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                    </button>

                    <button
                      onClick={() => generateQuiz("matching")}
                      className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-teal-300 hover:bg-teal-50 transition-all group"
                    >
                      <div className="p-2.5 rounded-lg bg-teal-100 group-hover:bg-teal-200 transition-colors">
                        <Shuffle className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="text-left flex-1">
                        <h4 className="font-semibold text-slate-800 text-sm">
                          Matching
                        </h4>
                        <p className="text-xs text-slate-500">
                          Match concepts together
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500" />
                    </button>

                    <button
                      onClick={() => generateQuiz("fill_blank")}
                      className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
                    >
                      <div className="p-2.5 rounded-lg bg-cyan-100 group-hover:bg-cyan-200 transition-colors">
                        <BookOpen className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div className="text-left flex-1">
                        <h4 className="font-semibold text-slate-800 text-sm">
                          Fill in the Blank
                        </h4>
                        <p className="text-xs text-slate-500">
                          Complete the statement
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-500" />
                    </button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                    </div>
                  </div>
                  <p className="text-slate-700 font-medium mt-4">
                    Creating your quiz...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Generating questions about {topic}
                  </p>
                </div>
              )}

              {/* Quiz Questions */}
              {selectedType && !isGenerating && questions.length > 0 && !showCompletion && currentQuestion && (
                <div className="space-y-5">
                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {questions.map((_, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-2 h-2 rounded-full transition-colors",
                            idx === quizState.currentIndex
                              ? "bg-emerald-500"
                              : quizState.showResult[questions[idx].id]
                                ? isCorrect(questions[idx].id)
                                  ? "bg-green-400"
                                  : "bg-red-400"
                                : "bg-slate-200"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500 ml-auto">
                      {quizState.currentIndex + 1} / {questions.length}
                    </span>
                  </div>

                  {/* Question */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm font-medium text-slate-800 leading-relaxed">
                      {currentQuestion.question}
                    </p>
                  </div>

                  {/* Multiple Choice Options */}
                  {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
                    <div className="space-y-2">
                      {currentQuestion.options.map((option, idx) => {
                        const isSelected = quizState.answers[currentQuestion.id] === option;
                        const showingResult = quizState.showResult[currentQuestion.id];
                        const isCorrectOption = option === currentQuestion.correctAnswer;

                        return (
                          <button
                            key={idx}
                            onClick={() => !showingResult && handleAnswer(currentQuestion.id, option)}
                            disabled={showingResult}
                            className={cn(
                              "w-full p-3 text-left rounded-xl border transition-all text-sm",
                              !showingResult && isSelected
                                ? "border-emerald-400 bg-emerald-50"
                                : !showingResult
                                  ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                  : isCorrectOption
                                    ? "border-green-400 bg-green-50"
                                    : isSelected
                                      ? "border-red-400 bg-red-50"
                                      : "border-slate-200 opacity-50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-xs",
                                  !showingResult && isSelected
                                    ? "bg-emerald-500 text-white"
                                    : !showingResult
                                      ? "bg-slate-100 text-slate-600"
                                      : isCorrectOption
                                        ? "bg-green-500 text-white"
                                        : isSelected
                                          ? "bg-red-500 text-white"
                                          : "bg-slate-100 text-slate-400"
                                )}
                              >
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span className={cn(
                                "flex-1",
                                showingResult && isCorrectOption && "text-green-700 font-medium",
                                showingResult && isSelected && !isCorrectOption && "text-red-700"
                              )}>
                                {option}
                              </span>
                              {showingResult && isCorrectOption && (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              )}
                              {showingResult && isSelected && !isCorrectOption && (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Fill in the Blank */}
                  {currentQuestion.type === "fill_blank" && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={(quizState.answers[currentQuestion.id] as string) || ""}
                        onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                        disabled={quizState.showResult[currentQuestion.id]}
                        placeholder="Type your answer..."
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border text-sm transition-all outline-none",
                          quizState.showResult[currentQuestion.id]
                            ? isCorrect(currentQuestion.id)
                              ? "border-green-400 bg-green-50"
                              : "border-red-400 bg-red-50"
                            : "border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        )}
                      />
                      {quizState.showResult[currentQuestion.id] && !isCorrect(currentQuestion.id) && (
                        <p className="text-xs text-green-600 px-1">
                          Correct: {currentQuestion.correctAnswer}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Explanation */}
                  {quizState.showResult[currentQuestion.id] && currentQuestion.explanation && (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-xs text-blue-800">
                        <span className="font-semibold">Explanation:</span>{" "}
                        {currentQuestion.explanation}
                      </p>
                    </div>
                  )}

                  {/* Stuck Help */}
                  {isStuck && !quizState.showResult[currentQuestion.id] && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 animate-in fade-in duration-300">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-amber-800">
                            Taking a while? Here&apos;s some help:
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button
                              onClick={() => toggleHint(currentQuestion.id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors flex items-center gap-1"
                            >
                              <Lightbulb className="w-3 h-3" />
                              Hint
                            </button>
                            {currentQuestion.videoSearch && (
                              <button
                                onClick={() => openVideoHelp(currentQuestion.videoSearch!)}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors flex items-center gap-1"
                              >
                                <Play className="w-3 h-3" />
                                Video
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hint Display */}
                  {quizState.showHint[currentQuestion.id] && currentQuestion.hint && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-700">
                        <span className="font-semibold text-amber-600">💡 Hint:</span>{" "}
                        {currentQuestion.hint}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Completion Screen */}
              {showCompletion && (
                <div className="text-center py-8 space-y-5">
                  <div className="w-16 h-16 mx-auto bg-amber-500 rounded-full flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">
                      Quiz Complete!
                    </h3>
                    <p className="text-slate-500 mt-1">
                      Score: <span className="font-bold text-emerald-600">{getScore()}</span> / {questions.length}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={resetQuiz} variant="neutral" className="w-full">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Try Another Quiz
                    </Button>
                    <Button
                      onClick={() => setIsOpen(false)}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          {selectedType && !isGenerating && questions.length > 0 && !showCompletion && currentQuestion && (
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  {!quizState.showResult[currentQuestion.id] && (
                    <>
                      <button
                        onClick={() => toggleHint(currentQuestion.id)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition-colors"
                        title="Show hint"
                      >
                        <Lightbulb className="w-4 h-4" />
                      </button>
                      {currentQuestion.videoSearch && (
                        <button
                          onClick={() => openVideoHelp(currentQuestion.videoSearch!)}
                          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors"
                          title="Watch video"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  {quizState.currentIndex > 0 && (
                    <Button variant="neutral" size="sm" onClick={prevQuestion}>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  )}
                  {!quizState.showResult[currentQuestion.id] ? (
                    <Button
                      size="sm"
                      onClick={() => checkAnswer(currentQuestion.id)}
                      disabled={!quizState.answers[currentQuestion.id]}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      Check
                    </Button>
                  ) : quizState.currentIndex < questions.length - 1 ? (
                    <Button
                      size="sm"
                      onClick={nextQuestion}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
