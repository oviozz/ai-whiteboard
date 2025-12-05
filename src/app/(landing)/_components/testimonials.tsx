"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
    {
        name: "Sarah Chen",
        role: "Computer Science Student",
        avatar: "SC",
        content:
            "This completely changed how I study. The AI tutor explains complex algorithms in ways that finally make sense. I went from struggling to acing my data structures class!",
        rating: 5,
        color: "bg-violet-500",
    },
    {
        name: "Marcus Johnson",
        role: "Self-taught Developer",
        avatar: "MJ",
        content:
            "I've tried countless learning platforms, but nothing compares to the interactive whiteboard. Being able to visualize concepts while chatting with AI is a game-changer.",
        rating: 5,
        color: "bg-emerald-500",
    },
    {
        name: "Emily Rodriguez",
        role: "High School Teacher",
        avatar: "ER",
        content:
            "I use this with my students and they absolutely love it. The visual approach to learning has helped even my most struggling students grasp difficult math concepts.",
        rating: 5,
        color: "bg-blue-500",
    },
    {
        name: "David Park",
        role: "Physics Enthusiast",
        avatar: "DP",
        content:
            "Finally, a tool that can keep up with my curiosity! I've explored everything from quantum mechanics to string theory. The depth of explanations is incredible.",
        rating: 5,
        color: "bg-amber-500",
    },
    {
        name: "Lisa Thompson",
        role: "Medical Student",
        avatar: "LT",
        content:
            "The quiz feature is perfect for med school. I can upload my notes and instantly generate practice questions. It's like having a study partner available 24/7.",
        rating: 5,
        color: "bg-rose-500",
    },
    {
        name: "Alex Kim",
        role: "Career Changer",
        avatar: "AK",
        content:
            "Transitioning to tech was daunting until I found this. The personalized learning path and patient AI explanations made coding feel approachable for the first time.",
        rating: 5,
        color: "bg-indigo-500",
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.4,
            ease: "easeOut",
        },
    },
};

export default function Testimonials() {
    return (
        <section className="py-24 px-4 bg-gray-50 overflow-hidden">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <span className="inline-block px-4 py-1.5 bg-main/20 text-gray-800 rounded-full text-sm font-semibold mb-4">
                        Loved by Learners
                    </span>
                    <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">
                        What our users say
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Join thousands of learners who have transformed their
                        education journey.
                    </p>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={index}
                            variants={itemVariants}
                            className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-lg relative group"
                        >
                            {/* Quote icon */}
                            <Quote className="absolute top-4 right-4 w-8 h-8 text-gray-100 group-hover:text-gray-200 transition-colors" />

                            {/* Rating */}
                            <div className="flex gap-1 mb-4">
                                {[...Array(testimonial.rating)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className="w-4 h-4 fill-amber-400 text-amber-400"
                                    />
                                ))}
                            </div>

                            {/* Content */}
                            <p className="text-gray-700 leading-relaxed mb-6">
                                &ldquo;{testimonial.content}&rdquo;
                            </p>

                            {/* Author */}
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-10 h-10 rounded-full ${testimonial.color} flex items-center justify-center text-white font-bold text-sm`}
                                >
                                    {testimonial.avatar}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">
                                        {testimonial.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {testimonial.role}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

