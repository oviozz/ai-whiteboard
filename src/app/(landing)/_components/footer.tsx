"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import BrandTitle from "@/components/brand-title";
import { Github, Twitter, Linkedin, Mail, Heart } from "lucide-react";

const footerLinks = {
    product: [
        { name: "Features", href: "#features" },
        { name: "How it Works", href: "#how-it-works" },
        { name: "Pricing", href: "#pricing" },
        { name: "FAQ", href: "#faq" },
    ],
    resources: [
        { name: "Documentation", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Tutorials", href: "#" },
        { name: "Community", href: "#" },
    ],
    company: [
        { name: "About Us", href: "#" },
        { name: "Contact", href: "#" },
        { name: "Careers", href: "#" },
        { name: "Press", href: "#" },
    ],
    legal: [
        { name: "Privacy Policy", href: "#" },
        { name: "Terms of Service", href: "#" },
        { name: "Cookie Policy", href: "#" },
    ],
};

const socialLinks = [
    { icon: Github, href: "#", label: "GitHub" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Mail, href: "#", label: "Email" },
];

export default function Footer() {
    return (
        <footer className="bg-gray-900 text-gray-300 pt-16 pb-8 px-4">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 pb-12 border-b border-gray-800"
                >
                    {/* Brand column */}
                    <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-6 lg:mb-0">
                        <Link href="/" className="inline-block mb-4">
                            <BrandTitle />
                        </Link>
                        <p className="text-sm text-gray-400 mb-6 max-w-xs">
                            Transform the way you learn with AI-powered
                            interactive whiteboards and personalized tutoring.
                        </p>
                        <div className="flex gap-4">
                            {socialLinks.map((social, index) => (
                                <a
                                    key={index}
                                    href={social.href}
                                    aria-label={social.label}
                                    className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
                                >
                                    <social.icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">
                            Product
                        </h4>
                        <ul className="space-y-3">
                            {footerLinks.product.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        href={link.href}
                                        className="text-sm hover:text-white transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">
                            Resources
                        </h4>
                        <ul className="space-y-3">
                            {footerLinks.resources.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        href={link.href}
                                        className="text-sm hover:text-white transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">
                            Company
                        </h4>
                        <ul className="space-y-3">
                            {footerLinks.company.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        href={link.href}
                                        className="text-sm hover:text-white transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Legal</h4>
                        <ul className="space-y-3">
                            {footerLinks.legal.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        href={link.href}
                                        className="text-sm hover:text-white transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </motion.div>

                {/* Bottom section */}
                <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} AI Whiteboard. All
                        rights reserved.
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                        Made with{" "}
                        <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />{" "}
                        for learners everywhere
                    </p>
                </div>
            </div>
        </footer>
    );
}

