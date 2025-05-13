
"use client";
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import {cn} from "@/lib/utils";

type MarkdownRendererProps = {
    content: string
}
export default function MarkdownRenderer({ content }: MarkdownRendererProps){

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={{
                // Customize how different markdown elements are rendered
                h1: ({ node, ...props }) => <h1 className="text-xl font-bold my-3 text-amber-200" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-lg font-bold my-2 text-amber-200" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-md font-bold my-2 text-amber-200" {...props} />,
                p: ({ node, ...props }) => <p className="my-2" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2" {...props} />,
                li: ({ node, ...props }) => <li className="" {...props} />,
                a: ({ node, ...props }) => <a className="text-amber-300 underline hover:text-amber-200" {...props} />,
                blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-amber-700 pl-4 italic my-2" {...props} />
                ),
                code: ({ className, children }) => (
                    <code className={cn("bg-gray-100 rounded px-1 py-0.5", className)}>
                        {children}
                    </code>
                ),
                pre: ({ node, ...props }) => (
                    <pre className="bg-amber-900/30 p-2 rounded my-2 overflow-x-auto" {...props} />
                ),
                hr: ({ node, ...props }) => <hr className="border-amber-800/50 my-4" {...props} />,
                table: ({ node, ...props }) => <table className="border-collapse w-full my-3" {...props} />,
                th: ({ node, ...props }) => (
                    <th className="border border-amber-800 px-2 py-1 bg-amber-900/30" {...props} />
                ),
                td: ({ node, ...props }) => <td className="border border-amber-800 px-2 py-1" {...props} />,
            }}
        >
            {content}
        </ReactMarkdown>
    )

}