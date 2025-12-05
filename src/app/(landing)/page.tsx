"use client";

import { motion } from "framer-motion";
import TopicInput from "@/app/(landing)/_components/topic-input";
import Features from "@/app/(landing)/_components/features";
import HowItWorks from "@/app/(landing)/_components/how-it-works";
import Testimonials from "@/app/(landing)/_components/testimonials";
import Footer from "@/app/(landing)/_components/footer";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export default function LearningWhiteboardUI() {
    return (
        <div className="flex flex-col">
            {/* Hero Section */}
            <section className="relative min-h-[calc(100vh-85px)] flex flex-col items-center justify-center bg-gradient-to-b from-white via-white to-gray-50 px-4 py-20 overflow-hidden">
                {/* Background decorations */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {/* Gradient orbs */}
                    <div className="absolute top-20 -left-32 w-96 h-96 bg-main/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 -right-32 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-main/5 to-blue-100/10 rounded-full blur-3xl" />

                    {/* Grid pattern */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                            backgroundSize: "60px 60px",
                        }}
                    />
                </div>

                {/* Main content */}
                <div className="relative z-10 w-full flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="w-full max-w-5xl px-4"
                    >
                        <div className="flex flex-col items-center">
                            {/* Badge */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-main/20 rounded-full mb-6"
                            >
                                <Sparkles className="w-4 h-4 text-gray-700" />
                                <span className="text-sm font-semibold text-gray-700">
                                    AI-Powered Learning Platform
                                </span>
                            </motion.div>

                            <h1
                                className={cn(
                                    "text-4xl md:text-6xl lg:text-7xl font-extrabold text-center text-gray-900 mb-4 leading-tight"
                                )}
                            >
                                I want to learn
                            </h1>

                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="text-lg md:text-xl text-gray-600 text-center mb-10 max-w-2xl"
                            >
                                Explore any topic with interactive AI-powered
                                visualizations and personalized learning paths.
                                Your AI tutor is ready to help.
                            </motion.p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="w-full max-w-2xl"
                    >
                        <TopicInput />
                    </motion.div>

                    {/* Stats or social proof */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="mt-16 flex flex-wrap justify-center gap-8 md:gap-12"
                    >
                        {[
                            { value: "10K+", label: "Active Learners" },
                            { value: "500+", label: "Topics Covered" },
                            { value: "4.9/5", label: "User Rating" },
                        ].map((stat, index) => (
                            <div key={index} className="text-center">
                                <p className="text-2xl md:text-3xl font-bold text-gray-900">
                                    {stat.value}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Scroll indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2"
                >
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        className="w-6 h-10 rounded-full border-2 border-gray-300 flex items-start justify-center p-1.5"
                    >
                        <div className="w-1.5 h-3 bg-gray-400 rounded-full" />
                    </motion.div>
                </motion.div>
            </section>

            {/* Features Section */}
            <Features />

            {/* How it Works Section */}
            <HowItWorks />

            {/* Testimonials Section */}
            <Testimonials />

            {/* CTA Section */}
            <section className="py-24 px-4 bg-gradient-to-r from-gray-900 to-gray-800 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-main/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="max-w-4xl mx-auto text-center relative z-10"
                >
                    <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
                        Ready to transform your learning?
                    </h2>
                    <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
                        Join thousands of learners who are already using AI to
                        master new skills faster than ever before.
                    </p>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                });
                            }}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-main text-gray-900 font-bold text-lg rounded-full hover:bg-main/90 transition-colors shadow-lg shadow-main/25"
                        >
                            <Sparkles className="w-5 h-5" />
                            Start Learning Now
                        </a>
                    </motion.div>
                </motion.div>
            </section>

            {/* Footer */}
            <Footer />
        </div>
    );
}
