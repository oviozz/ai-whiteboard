
type ChatbotSuggestionProps = {
    onClickSuggestion: (input: string) => void;
}

export default function ChatbotSuggestion({onClickSuggestion}: ChatbotSuggestionProps){

    const suggestions = [
        "Generate me a problem",
        "Quiz me",
        "Check my current work",
        "Am I doing anything wrong?"
    ];


    return (
        <ul className={"flex flex-wrap gap-2"}>
            { suggestions.map((suggest, index) => {
                return (
                    <li
                        onClick={() => onClickSuggestion(suggest.trim())}
                        className={"border border-neutral-200 rounded-xl px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:cursor-pointer"}
                        key={index}>
                        {suggest}
                    </li>
                )
            })}
        </ul>
    )

}