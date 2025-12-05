"use client";

import { motion } from "framer-motion";
import {
    Brain,
    Pencil,
    MessageSquare,
    Sparkles,
    BookOpen,
    Zap,
} from "lucide-react";

const features = [
    {
        icon: Brain,
        title: "AI-Powered Learning",
        description:
            "Our intelligent tutor adapts to your learning style and provides personalized explanations for any topic.",
        color: "from-violet-500 to-purple-600",
    },
    {
        icon: Pencil,
        title: "Infinite Canvas",
        description:
            "Draw, sketch, and visualize your ideas on an unlimited whiteboard that grows with your imagination.",
        color: "from-emerald-500 to-teal-600",
    },
    {
        icon: MessageSquare,
        title: "Interactive Chat",
        description:
            "Ask questions, get instant answers, and have meaningful conversations about any subject.",
        color: "from-blue-500 to-cyan-600",
    },
    {
        icon: Sparkles,
        title: "Smart Hints",
        description:
            "Stuck on a problem? Get contextual hints that guide you to the solution without giving it away.",
        color: "from-amber-500 to-orange-600",
    },
    {
        icon: BookOpen,
        title: "Study Materials",
        description:
            "Upload your documents and let AI help you understand and review complex materials.",
        color: "from-rose-500 to-pink-600",
    },
    {
        icon: Zap,
        title: "Instant Quizzes",
        description:
            "Generate quizzes on the fly to test your understanding and reinforce what you've learned.",
        color: "from-indigo-500 to-blue-600",
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: "easeOut",
        },
    },
};

export default function Features() {
    return (
        <section className="py-24 px-4 bg-white">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">
                        Everything you need to learn
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Powerful tools designed to make learning engaging,
                        interactive, and personalized to your needs.
                    </p>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            variants={itemVariants}
                            className="group relative bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-gray-200 transition-all duration-300 hover:shadow-lg"
                        >
                            <div
                                className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} mb-4 group-hover:scale-110 transition-transform duration-300`}
                            >
                                <feature.icon className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {feature.title}
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

