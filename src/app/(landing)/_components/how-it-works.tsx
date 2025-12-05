"use client";

import { motion } from "framer-motion";
import { Search, Wand2, GraduationCap } from "lucide-react";

const steps = [
    {
        number: "01",
        icon: Search,
        title: "Choose Your Topic",
        description:
            "Enter any subject you want to learn about—from quantum physics to web development, we've got you covered.",
        color: "bg-emerald-500",
    },
    {
        number: "02",
        icon: Wand2,
        title: "AI Creates Your Canvas",
        description:
            "Our AI instantly generates an interactive whiteboard with visual explanations, diagrams, and key concepts.",
        color: "bg-blue-500",
    },
    {
        number: "03",
        icon: GraduationCap,
        title: "Learn & Interact",
        description:
            "Ask questions, draw your ideas, take quizzes, and get personalized guidance from your AI tutor.",
        color: "bg-violet-500",
    },
];

export default function HowItWorks() {
    return (
        <section className="py-24 px-4 bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <span className="inline-block px-4 py-1.5 bg-main/20 text-gray-800 rounded-full text-sm font-semibold mb-4">
                        Simple & Intuitive
                    </span>
                    <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">
                        How it works
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Get started in seconds. No complicated setup, just pure
                        learning.
                    </p>
                </motion.div>

                <div className="relative">
                    {/* Connection line */}
                    <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-200 via-blue-200 to-violet-200 -translate-y-1/2 z-0" />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 relative z-10">
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{
                                    duration: 0.5,
                                    delay: index * 0.15,
                                }}
                                className="relative"
                            >
                                <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-xl group">
                                    {/* Step number badge */}
                                    <div className="absolute -top-4 left-8">
                                        <span
                                            className={`inline-block ${step.color} text-white text-sm font-bold px-3 py-1 rounded-full`}
                                        >
                                            Step {step.number}
                                        </span>
                                    </div>

                                    {/* Icon */}
                                    <div
                                        className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                                    >
                                        <step.icon className="w-8 h-8 text-white" />
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                                        {step.title}
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        {step.description}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

