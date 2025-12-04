"use client";

/**
 * useTldrawAgent Hook
 *
 * React hook for creating and managing a TldrawAgent instance.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "tldraw";
import { TldrawAgent, type TldrawAgentOptions } from "@/lib/agent/tldraw-agent";
import { setAgentForTools } from "@/lib/agent/tools";

export interface UseTldrawAgentOptions {
  id: string;
  apiEndpoint?: string;
  defaultModel?: string;
  onError?: (error: unknown) => void;
}

export function useTldrawAgent(
  editor: Editor | null,
  options: UseTldrawAgentOptions
): TldrawAgent | null {
  const { id, apiEndpoint, defaultModel, onError } = options;
  const [agent, setAgent] = useState<TldrawAgent | null>(null);
  const agentRef = useRef<TldrawAgent | null>(null);

  useEffect(() => {
    if (!editor) {
      // Cleanup existing agent if editor is removed
      if (agentRef.current) {
        agentRef.current.dispose();
        setAgentForTools(null);
        agentRef.current = null;
        setAgent(null);
      }
      return;
    }

    // Don't recreate if we already have an agent for this editor
    if (agentRef.current && agentRef.current.editor === editor) {
      return;
    }

    // Cleanup existing agent
    if (agentRef.current) {
      agentRef.current.dispose();
      setAgentForTools(null);
    }

    // Create new agent
    const newAgent = new TldrawAgent({
      editor,
      id,
      apiEndpoint,
      defaultModel,
      onError: onError ?? ((e) => console.error("TldrawAgent error:", e)),
    });

    // Set agent for context tools
    setAgentForTools(newAgent);

    agentRef.current = newAgent;
    setAgent(newAgent);

    // Make agent available for debugging
    if (typeof window !== "undefined") {
      (window as unknown as { agent: TldrawAgent }).agent = newAgent;
    }

    return () => {
      if (agentRef.current) {
        agentRef.current.dispose();
        setAgentForTools(null);
        agentRef.current = null;
        setAgent(null);
      }
    };
  }, [editor, id, apiEndpoint, defaultModel, onError]);

  return agent;
}

/**
 * useAgentValue Hook
 *
 * React hook for subscribing to an agent atom value.
 */
export function useAgentValue<T>(
  atom: { get: () => T; subscribe: (listener: (value: T) => void) => () => void } | null
): T | undefined {
  const [value, setValue] = useState<T | undefined>(atom?.get());

  useEffect(() => {
    if (!atom) {
      setValue(undefined);
      return;
    }

    setValue(atom.get());
    const unsubscribe = atom.subscribe(setValue);
    return unsubscribe;
  }, [atom]);

  return value;
}

