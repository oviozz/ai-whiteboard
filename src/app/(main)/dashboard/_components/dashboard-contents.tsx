
"use client"
import { useState } from "react";
import { Clock, FileText, Plus, ArrowRight, Pen } from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import CreateNewWhiteboardButton from "@/app/(main)/dashboard/_components/create-new-whiteboard-button";
import DeleteWhiteboardButton from "@/app/(main)/dashboard/_components/delete-whiteboard-button";
import WhiteboardSkeletonLoading from "@/app/(main)/dashboard/_components/states/whiteboard-skeleton-loading";
import { timeAgo } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";

// Learning template data - comprehensive list
const LEARNING_TEMPLATES = [
    // Math
    { id: "algebra-basics", title: "Algebra Basics", description: "Linear equations, quadratics, graphing", category: "math", problems: ["Solve 2x + 5 = 13", "Factor x² - 5x + 6"] },
    { id: "calculus-derivatives", title: "Derivatives", description: "Differentiation rules and applications", category: "math", problems: ["Find d/dx of x³ + 2x", "Chain rule"] },
    { id: "calculus-integrals", title: "Integrals", description: "Integration techniques and applications", category: "math", problems: ["∫x² dx", "Integration by parts"] },
    { id: "trigonometry", title: "Trigonometry", description: "Sin, cos, tan, and identities", category: "math", problems: ["Solve sin(x) = 0.5", "Prove identity"] },
    { id: "statistics", title: "Statistics", description: "Mean, median, standard deviation", category: "math", problems: ["Calculate mean", "Find probability"] },
    { id: "linear-algebra", title: "Linear Algebra", description: "Matrices, vectors, eigenvalues", category: "math", problems: ["Matrix multiplication", "Find determinant"] },
    
    // Science
    { id: "chemistry-basics", title: "Chemistry Basics", description: "Atomic structure and chemical bonds", category: "science", problems: ["Balance equations", "Lewis structures"] },
    { id: "physics-mechanics", title: "Physics: Mechanics", description: "Newton's laws and kinematics", category: "science", problems: ["Free body diagrams", "Projectile motion"] },
    { id: "physics-electricity", title: "Electricity & Magnetism", description: "Circuits, fields, and waves", category: "science", problems: ["Ohm's law", "Magnetic flux"] },
    { id: "biology-cells", title: "Cell Biology", description: "Cell structure and processes", category: "science", problems: ["Label diagram", "Mitosis stages"] },
    { id: "organic-chemistry", title: "Organic Chemistry", description: "Carbon compounds and reactions", category: "science", problems: ["Name compounds", "Reaction mechanisms"] },
    
    // Languages
    { id: "spanish-basics", title: "Spanish Basics", description: "Common phrases and verb conjugations", category: "languages", problems: ["Conjugate verbs", "Translate sentences"] },
    { id: "french-basics", title: "French Basics", description: "Vocabulary and grammar essentials", category: "languages", problems: ["Gender agreement", "Common phrases"] },
    { id: "mandarin-basics", title: "Mandarin Basics", description: "Characters and pronunciation", category: "languages", problems: ["Character practice", "Tones"] },
    { id: "english-grammar", title: "English Grammar", description: "Parts of speech and sentence structure", category: "languages", problems: ["Identify clauses", "Fix errors"] },
    
    // Coding
    { id: "python-fundamentals", title: "Python Fundamentals", description: "Variables, loops, and functions", category: "coding", problems: ["Write a function", "List comprehensions"] },
    { id: "javascript-basics", title: "JavaScript Basics", description: "DOM, events, and async", category: "coding", problems: ["Event handling", "Promises"] },
    { id: "data-structures", title: "Data Structures", description: "Arrays, trees, and graphs", category: "coding", problems: ["Implement stack", "Tree traversal"] },
    { id: "algorithms", title: "Algorithms", description: "Sorting, searching, and complexity", category: "coding", problems: ["Binary search", "Big O analysis"] },
    { id: "sql-basics", title: "SQL Basics", description: "Queries, joins, and databases", category: "coding", problems: ["Write SELECT", "Join tables"] },
    
    // Writing
    { id: "essay-writing", title: "Essay Writing", description: "Structure, thesis, and argumentation", category: "writing", problems: ["Thesis statement", "Topic sentences"] },
    { id: "creative-writing", title: "Creative Writing", description: "Story structure and character development", category: "writing", problems: ["Write dialogue", "Plot outline"] },
    { id: "research-papers", title: "Research Papers", description: "Citations, methodology, and analysis", category: "writing", problems: ["MLA format", "Literature review"] },
];

const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "math", label: "Math" },
    { id: "science", label: "Science" },
    { id: "languages", label: "Languages" },
    { id: "coding", label: "Coding" },
    { id: "writing", label: "Writing" },
];

// Component to show document indicator for a whiteboard
function WhiteboardDocumentIndicator({ whiteboardID }: { whiteboardID: Id<"whiteboards"> }) {
    const documents = useQuery(api.documents.getDocumentsByWhiteboard, { whiteboardID });
    
    if (!documents || documents.length === 0) return null;
    
    const doc = documents[0];
    const fileUrl = doc.url;
    
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (fileUrl) {
            window.open(fileUrl, '_blank');
        }
    };
    
    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    
    return (
        <button
            onClick={handleClick}
            className="flex items-center gap-2 px-2 py-1.5 rounded border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer group w-full"
        >
            <div className="p-1.5 rounded bg-slate-100 group-hover:bg-indigo-100 transition-colors">
                <FileText size={14} className="text-slate-500 group-hover:text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-slate-700 truncate group-hover:text-indigo-600">{doc.filename}</p>
                <p className="text-[10px] text-slate-400">{formatSize(doc.fileSize || 0)}</p>
            </div>
            {documents.length > 1 && (
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">+{documents.length - 1}</span>
            )}
        </button>
    );
}

// Whiteboard-style card for templates
function TemplateCard({ template, onUse, isLoading }: { 
    template: typeof LEARNING_TEMPLATES[0], 
    onUse: () => void,
    isLoading: boolean 
}) {
    return (
        <button
            onClick={onUse}
            disabled={isLoading}
            className="text-left bg-white border border-slate-200 rounded-xl hover:border-slate-400 transition-all duration-200 group overflow-hidden disabled:opacity-50 cursor-pointer"
        >
            {/* Whiteboard paper effect - ruled lines */}
            <div className="h-8 border-b border-slate-100 relative">
                <div className="absolute inset-x-0 top-3 border-b border-red-200/40" />
                <div className="absolute left-5 inset-y-0 border-l border-red-200/40" />
            </div>
            
            <div className="p-4">
                {/* Title with pen icon */}
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                        <Pen className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 text-base leading-tight">{template.title}</h3>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{template.description}</p>
                    </div>
                </div>
                
                {/* Sample problems - looks like written notes */}
                <div className="mt-3 space-y-1.5 pl-7">
                    {template.problems.slice(0, 2).map((problem, i) => (
                        <div key={i} className="text-xs text-slate-400 truncate font-mono">
                            • {problem}
                        </div>
                    ))}
                </div>
                
                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-dashed border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400 capitalize">{template.category}</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                </div>
            </div>
        </button>
    );
}

// User whiteboard card
function WhiteboardCard({ board }: { board: { _id: Id<"whiteboards">, topic: string, problem_statement?: string, updatedAt: number } }) {
    return (
        <Link
            href={`/whiteboard/${board._id}`}
            className="bg-white border border-slate-200 rounded-xl hover:border-slate-400 transition-all duration-200 group overflow-hidden cursor-pointer relative"
        >
            {/* "My Board" indicator - small corner badge */}
            <div className="absolute top-0 right-0 px-2 py-1 bg-slate-800 text-white text-[10px] font-medium rounded-bl-lg">
                MY BOARD
            </div>
            
            <div className="p-4 pt-5">
                <h3 className="font-semibold text-slate-800 text-base line-clamp-1 pr-16">{board.topic}</h3>
                
                {board.problem_statement && (
                    <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{board.problem_statement}</p>
                )}
                
                <div className="mt-3">
                    <WhiteboardDocumentIndicator whiteboardID={board._id} />
                </div>
                
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                        <Clock size={12} />
                        <span>{timeAgo(board.updatedAt)}</span>
                    </div>

                    <div onClick={e => { e.stopPropagation(); e.preventDefault(); }}>
                        <DeleteWhiteboardButton
                            whiteboardID={board._id}
                            whiteboard_name={board.topic}
                        />
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default function DashboardContents({ query }: { query: string | undefined }) {
    const router = useRouter();
    const user = useQuery(api.users.current);
    const whiteboards = useQuery(api.whiteboards.getWhiteboards);
    const createWhiteboard = useMutation(api.whiteboards.createWhiteboard);
    
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [showAllTemplates, setShowAllTemplates] = useState(false);
    const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

    const isLoading = whiteboards === undefined;
    
    const filteredTemplates = selectedCategory === "all" 
        ? LEARNING_TEMPLATES 
        : LEARNING_TEMPLATES.filter(t => t.category === selectedCategory);
    
    const displayedTemplates = showAllTemplates ? filteredTemplates : filteredTemplates.slice(0, 8);

    const handleUseTemplate = async (template: typeof LEARNING_TEMPLATES[0]) => {
        if (creatingTemplate) return;
        
        setCreatingTemplate(template.id);
        try {
            const result = await createWhiteboard({
                topic: template.title,
                problem_statement: template.description,
            });
            
            if (result.success && result.new_id) {
                router.push(`/whiteboard/${result.new_id}`);
            } else {
                toast.error(result.message || "Failed to create whiteboard");
                setCreatingTemplate(null);
            }
        } catch (error) {
            console.error("Failed to create whiteboard from template:", error);
            toast.error("Failed to create whiteboard");
            setCreatingTemplate(null);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="border-b border-slate-200 sticky top-0 z-10 bg-white">
                <div className="max-w-screen-xl mx-auto px-8 py-5">
                    <div className="flex justify-between items-center">
                        <div>
                            {user?.firstName && (
                                <p className="text-sm text-slate-500">
                                    Welcome back, <span className="font-medium">{user.firstName}</span>
                                </p>
                            )}
                            <h1 className="text-2xl font-bold text-slate-800">Learning Hub</h1>
                        </div>
                        <CreateNewWhiteboardButton query={query} />
                    </div>
                </div>
            </div>

            <div className="max-w-screen-xl mx-auto px-8 py-8 space-y-10">
                {/* Your Whiteboards Section */}
                <section>
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-semibold text-slate-800">Your Whiteboards</h2>
                        {whiteboards && whiteboards.length > 4 && (
                            <button className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer">
                                View all <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {[...Array(4)].map((_, index) => (
                                <WhiteboardSkeletonLoading key={index} />
                            ))}
                        </div>
                    ) : whiteboards && whiteboards.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {whiteboards.slice(0, 4).map((board) => (
                                <WhiteboardCard key={board._id} board={board} />
                            ))}
                        </div>
                    ) : (
                        <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center">
                            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Plus className="w-7 h-7 text-slate-400" />
                            </div>
                            <p className="text-base text-slate-600 mb-1">No whiteboards yet</p>
                            <p className="text-sm text-slate-400 mb-4">Create one or pick a template below</p>
                            <CreateNewWhiteboardButton query={query} />
                        </div>
                    )}
                </section>

                {/* Templates Section */}
                <section>
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-semibold text-slate-800">Templates</h2>
                    </div>
                    
                    {/* Category Filters */}
                    <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
                        {CATEGORIES.map((category) => {
                            const isActive = selectedCategory === category.id;
                            return (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                                        isActive
                                            ? "bg-slate-800 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    {category.label}
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* Templates Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {displayedTemplates.map((template) => (
                            <TemplateCard 
                                key={template.id} 
                                template={template} 
                                onUse={() => handleUseTemplate(template)}
                                isLoading={creatingTemplate === template.id}
                            />
                        ))}
                    </div>
                    
                    {filteredTemplates.length > 8 && !showAllTemplates && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setShowAllTemplates(true)}
                                className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                                Show all {filteredTemplates.length} templates
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
