"use client"

import { createContext, useContext, useState, ReactNode } from 'react'
import type { Editor } from 'tldraw'
import type { TldrawAgent } from '@/lib/agent/tldraw-agent'

interface TldrawEditorContextType {
  editor: Editor | null
  setEditor: (editor: Editor | null) => void
  agent: TldrawAgent | null
  setAgent: (agent: TldrawAgent | null) => void
}

const TldrawEditorContext = createContext<TldrawEditorContextType>({
  editor: null,
  setEditor: () => {},
  agent: null,
  setAgent: () => {},
})

interface TldrawEditorProviderProps {
  children: ReactNode
}

export function TldrawEditorProvider({ children }: TldrawEditorProviderProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [agent, setAgent] = useState<TldrawAgent | null>(null)
  
  return (
    <TldrawEditorContext.Provider value={{ editor, setEditor, agent, setAgent }}>
      {children}
    </TldrawEditorContext.Provider>
  )
}

export const useTldrawEditor = () => {
  const context = useContext(TldrawEditorContext)
  if (!context) {
    throw new Error('useTldrawEditor must be used within a TldrawEditorProvider')
  }
  return context
}

// Helper to extract text content from whiteboard shapes
export function getWhiteboardTextContext(editor: Editor): string {
  const shapes = editor.getCurrentPageShapes()
  const textContent: string[] = []
  
  for (const shape of shapes) {
    // Handle different shape types that can contain text
    const props = shape.props as Record<string, unknown>
    
    if (shape.type === 'text' && typeof props.text === 'string') {
      textContent.push(props.text)
    }
    if (shape.type === 'note' && typeof props.text === 'string') {
      textContent.push(`[Note] ${props.text}`)
    }
    if (shape.type === 'geo' && typeof props.text === 'string' && props.text) {
      textContent.push(`[Shape] ${props.text}`)
    }
    if (shape.type === 'arrow' && typeof props.text === 'string' && props.text) {
      textContent.push(`[Arrow] ${props.text}`)
    }
  }
  
  return textContent.join('\n\n')
}

