/**
 * TldrawAgent
 *
 * An agent that can be prompted to edit the canvas.
 * Matches the tldraw agent starter kit pattern.
 */

import type {
  Editor,
  RecordsDiff,
  TLRecord,
  VecModel,
  BoxModel,
} from "tldraw";
import { reverseRecordsDiff, structuredClone, Box, Vec } from "tldraw";
import type {
  AgentAction,
  Streaming,
  SimpleShape,
} from "./agent-actions";
import { isCanvasAction } from "./agent-actions";
import type {
  ContextItem,
  ChatHistoryItem,
  ChatHistoryActionItem,
  TodoItem,
  AgentRequest,
  AgentInput,
  ShapesContextItem,
  ShapeContextItem,
  AreaContextItem,
  PointContextItem,
} from "./types";
import { areContextItemsEqual } from "./types";
import { AgentHelpers } from "./agent-helpers";

// ============================================
// Reactive Atom Implementation
// ============================================

type Listener<T> = (value: T) => void;

/**
 * Simple reactive atom for state management
 */
export class Atom<T> {
  private _value: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(private name: string, initialValue: T) {
    this._value = initialValue;
  }

  get(): T {
    return this._value;
  }

  set(value: T): void {
    this._value = value;
    this.notify();
  }

  update(fn: (prev: T) => T): void {
    this._value = fn(this._value);
    this.notify();
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this._value);
    }
  }
}

// ============================================
// TldrawAgent Options
// ============================================

export interface TldrawAgentOptions {
  editor: Editor;
  id: string;
  onError: (e: unknown) => void;
  apiEndpoint?: string;
  defaultModel?: string;
}

// ============================================
// TldrawAgent Class
// ============================================

export class TldrawAgent {
  /** The editor associated with this agent */
  editor: Editor;

  /** An ID to differentiate the agent from other agents */
  id: string;

  /** Callback for when an error occurs */
  onError: (e: unknown) => void;

  /** API endpoint for streaming */
  apiEndpoint: string;

  /** The currently active request */
  $activeRequest = new Atom<AgentRequest | null>("activeRequest", null);

  /** The next request scheduled for after current one finishes */
  $scheduledRequest = new Atom<AgentRequest | null>("scheduledRequest", null);

  /** Chat history */
  $chatHistory = new Atom<ChatHistoryItem[]>("chatHistory", []);

  /** Position on the page where current chat started */
  $chatOrigin = new Atom<VecModel>("chatOrigin", { x: 0, y: 0 });

  /** Agent's todo list */
  $todoList = new Atom<TodoItem[]>("todoList", []);

  /** Document changes made by the user since previous request */
  $userActionHistory = new Atom<RecordsDiff<TLRecord>[]>("userActionHistory", []);

  /** Currently selected context items */
  $contextItems = new Atom<ContextItem[]>("contextItems", []);

  /** Selected model name */
  $modelName = new Atom<string>("modelName", "google/gemini-2.0-flash");

  /** Whether agent is currently acting on the editor */
  private isActing = false;

  /** Function to cancel current request */
  private cancelFn: (() => void) | null = null;

  /** Function to stop recording user actions */
  private stopRecordingFn: (() => void) | null = null;

  constructor({
    editor,
    id,
    onError,
    apiEndpoint = "/api/whiteboard/agent",
    defaultModel = "google/gemini-2.0-flash",
  }: TldrawAgentOptions) {
    this.editor = editor;
    this.id = id;
    this.onError = onError;
    this.apiEndpoint = apiEndpoint;
    this.$modelName.set(defaultModel);

    // Load persisted state from localStorage
    this.loadPersistedState();

    // Start recording user actions
    this.stopRecordingFn = this.startRecordingUserActions();
  }

  // ============================================
  // Lifecycle Methods
  // ============================================

  /**
   * Dispose of the agent by cancelling requests and stopping listeners
   */
  dispose(): void {
    this.cancel();
    this.stopRecordingFn?.();
  }

  // ============================================
  // Request Methods
  // ============================================

  /**
   * Prompt the agent to edit the canvas
   */
  async prompt(input: AgentInput): Promise<void> {
    const request = this.getFullRequestFromInput(input);

    // Submit the request
    await this.request(request);

    // Check for scheduled follow-up requests
    let scheduledRequest = this.$scheduledRequest.get();
    const todoItemsRemaining = this.$todoList
      .get()
      .filter((item) => item.status !== "done");

    if (!scheduledRequest) {
      // If no outstanding todo items, finish
      if (todoItemsRemaining.length === 0 || !this.cancelFn) {
        return;
      }

      // Schedule a request for remaining todos
      scheduledRequest = {
        messages: request.messages,
        contextItems: request.contextItems,
        bounds: request.bounds,
        modelName: request.modelName,
        selectedShapes: request.selectedShapes,
        data: request.data,
        type: "todo",
      };
    }

    // Add continuation to chat history
    const resolvedData = await Promise.all(scheduledRequest.data);
    this.$chatHistory.update((prev) => [
      ...prev,
      {
        type: "continuation",
        data: resolvedData,
      },
    ]);

    // Handle scheduled request
    this.$scheduledRequest.set(null);
    await this.prompt(scheduledRequest);
  }

  /**
   * Send a single request to the agent and handle its response
   */
  async request(input: AgentInput): Promise<void> {
    const request = this.getFullRequestFromInput(input);

    // Interrupt any currently active request
    if (this.$activeRequest.get() !== null) {
      this.cancel();
    }
    this.$activeRequest.set(request);

    // Request the agent
    const { promise, cancel } = this.requestAgent(request);

    this.cancelFn = cancel;
    promise.finally(() => {
      this.cancelFn = null;
    });

    await promise;
    this.$activeRequest.set(null);
  }

  /**
   * Schedule further work for after current request finishes
   */
  schedule(input: AgentInput): void {
    const scheduledRequest = this.$scheduledRequest.get();

    if (!scheduledRequest) {
      this.setScheduledRequest(input);
      return;
    }

    const request = this.getPartialRequestFromInput(input);

    this.setScheduledRequest({
      type: "schedule",
      messages: [...scheduledRequest.messages, ...(request.messages ?? [])],
      contextItems: [
        ...scheduledRequest.contextItems,
        ...(request.contextItems ?? []),
      ],
      selectedShapes: [
        ...scheduledRequest.selectedShapes,
        ...(request.selectedShapes ?? []),
      ],
      data: [...scheduledRequest.data, ...(request.data ?? [])],
      bounds: request.bounds ?? scheduledRequest.bounds,
      modelName: request.modelName ?? scheduledRequest.modelName,
    });
  }

  /**
   * Set the scheduled request manually
   */
  setScheduledRequest(input: AgentInput | null): void {
    if (input === null) {
      this.$scheduledRequest.set(null);
      return;
    }

    const request = this.getFullRequestFromInput(input);
    request.type = "schedule";
    this.$scheduledRequest.set(request);
  }

  /**
   * Cancel the current prompt
   */
  cancel(): void {
    this.cancelFn?.();
    this.$activeRequest.set(null);
    this.$scheduledRequest.set(null);
    this.cancelFn = null;
  }

  /**
   * Reset the agent's chat and memory
   */
  reset(): void {
    this.cancel();
    this.$contextItems.set([]);
    this.$todoList.set([]);
    this.$userActionHistory.set([]);

    const viewport = this.editor.getViewportPageBounds();
    this.$chatHistory.set([]);
    this.$chatOrigin.set({ x: viewport.x, y: viewport.y });
  }

  /**
   * Check if the agent is currently generating
   */
  isGenerating(): boolean {
    return this.$activeRequest.get() !== null;
  }

  // ============================================
  // Action Methods
  // ============================================

  /**
   * Make the agent perform an action
   */
  act(
    action: Streaming<AgentAction>,
    helpers?: AgentHelpers
  ): { diff: RecordsDiff<TLRecord>; promise: Promise<void> | null } {
    const { editor } = this;
    helpers = helpers ?? new AgentHelpers(this);

    this.isActing = true;

    let promise: Promise<void> | null = null;
    let diff: RecordsDiff<TLRecord>;

    try {
      diff = editor.store.extractingChanges(() => {
        // Action execution would happen here via the executor
        // This is handled by the streaming loop
      });
    } finally {
      this.isActing = false;
    }

    // Add action to chat history if it modifies canvas
    if (isCanvasAction(action)) {
      const historyItem: ChatHistoryItem = {
        type: "action",
        action,
        diff: diff!,
        acceptance: "pending",
      };

      this.$chatHistory.update((historyItems) => {
        if (historyItems.length === 0) return [historyItem];

        // If last item is still in progress, replace it
        const lastHistoryItem = historyItems.at(-1);
        if (
          lastHistoryItem &&
          lastHistoryItem.type === "action" &&
          !lastHistoryItem.action.complete
        ) {
          return [...historyItems.slice(0, -1), historyItem];
        }

        return [...historyItems, historyItem];
      });
    }

    return { diff: diff!, promise };
  }

  /**
   * Add an action to chat history
   */
  addActionToHistory(
    action: Streaming<AgentAction>,
    diff: RecordsDiff<TLRecord>
  ): void {
    const historyItem: ChatHistoryActionItem = {
      type: "action",
      action,
      diff,
      acceptance: "pending",
    };

    this.$chatHistory.update((historyItems) => {
      if (historyItems.length === 0) return [historyItem];

      // If last item is still in progress, replace it
      const lastHistoryItem = historyItems.at(-1);
      if (
        lastHistoryItem &&
        lastHistoryItem.type === "action" &&
        !lastHistoryItem.action.complete
      ) {
        return [...historyItems.slice(0, -1), historyItem];
      }

      return [...historyItems, historyItem];
    });
  }

  // ============================================
  // Todo Methods
  // ============================================

  /**
   * Add a todo item
   */
  addTodo(text: string): number {
    const id = this.$todoList.get().length;
    this.$todoList.update((todoItems) => [
      ...todoItems,
      { id, status: "todo" as const, text },
    ]);
    return id;
  }

  /**
   * Update a todo item status
   */
  updateTodoStatus(id: number, status: TodoItem["status"]): void {
    this.$todoList.update((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item))
    );
  }

  // ============================================
  // Context Methods
  // ============================================

  /**
   * Add a context item
   */
  addToContext(item: ContextItem): void {
    this.$contextItems.update((items) => {
      // Handle shapes grouping
      if (item.type === "shapes") {
        const newItems = this.dedupeShapesContextItem(item, items);
        return [...items, ...newItems];
      }

      // Don't add duplicates
      if (this.hasContextItem(item)) {
        return items;
      }

      return [...items, structuredClone(item)];
    });
  }

  /**
   * Remove a context item
   */
  removeFromContext(item: ContextItem): void {
    this.$contextItems.update((items) => items.filter((v) => item !== v));
  }

  /**
   * Check if context contains an item
   */
  hasContextItem(item: ContextItem): boolean {
    const items = this.$contextItems.get();
    if (items.some((v) => areContextItemsEqual(v, item))) {
      return true;
    }

    if (item.type === "shape") {
      for (const existingItem of items) {
        if (existingItem.type === "shapes") {
          if (
            existingItem.shapes.some(
              (shape) => shape.shapeId === item.shape.shapeId
            )
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Get full request from input
   */
  private getFullRequestFromInput(input: AgentInput): AgentRequest {
    const request = this.getPartialRequestFromInput(input);
    const activeRequest = this.$activeRequest.get();

    return {
      type: request.type ?? "user",
      messages: request.messages ?? [],
      data: request.data ?? [],
      selectedShapes: request.selectedShapes ?? [],
      contextItems: request.contextItems ?? [],
      bounds:
        request.bounds ??
        activeRequest?.bounds ??
        this.editor.getViewportPageBounds(),
      modelName:
        request.modelName ?? activeRequest?.modelName ?? this.$modelName.get(),
    };
  }

  /**
   * Get partial request from input
   */
  private getPartialRequestFromInput(input: AgentInput): Partial<AgentRequest> {
    if (typeof input === "string") {
      return { messages: [input] };
    }

    if (Array.isArray(input)) {
      return { messages: input };
    }

    if (typeof input.messages === "string") {
      return { ...input, messages: [input.messages] };
    }

    if (typeof input.message === "string") {
      return { ...input, messages: [input.message, ...(input.messages ?? [])] };
    }

    return input as Partial<AgentRequest>;
  }

  /**
   * Request the agent with streaming
   */
  private requestAgent(request: AgentRequest): {
    promise: Promise<void>;
    cancel: () => void;
  } {
    const { editor } = this;

    // Add prompt to chat history if from user
    if (request.type === "user") {
      this.$chatHistory.update((prev) => [
        ...prev,
        {
          type: "prompt",
          message: request.messages.join("\n"),
          contextItems: request.contextItems,
          selectedShapes: request.selectedShapes,
        },
      ]);
    }

    let cancelled = false;
    const controller = new AbortController();
    const signal = controller.signal;

    const requestPromise = (async () => {
      let incompleteDiff: RecordsDiff<TLRecord> | null = null;

      try {
        for await (const action of this.streamAgent(request, signal)) {
          if (cancelled) break;

          editor.run(
            () => {
              // Revert incomplete diff if exists
              if (incompleteDiff) {
                const inversePrevDiff = reverseRecordsDiff(incompleteDiff);
                editor.store.applyDiff(inversePrevDiff);
              }

              // Execute action and capture diff
              const diff = editor.store.extractingChanges(() => {
                // Action execution is handled externally
                // The action is yielded for the consumer to handle
              });

              if (action.complete) {
                incompleteDiff = null;
              } else {
                incompleteDiff = diff;
              }
            },
            { ignoreShapeLock: false, history: "ignore" }
          );
        }
      } catch (e) {
        if (
          e === "Cancelled by user" ||
          (e instanceof Error && e.name === "AbortError")
        ) {
          return;
        }
        this.onError(e);
      }
    })();

    const cancel = () => {
      cancelled = true;
      controller.abort("Cancelled by user");
    };

    return { promise: requestPromise, cancel };
  }

  /**
   * Stream agent response
   */
  private async *streamAgent(
    request: AgentRequest,
    signal: AbortSignal
  ): AsyncGenerator<Streaming<AgentAction>> {
    // Build request body
    const helpers = new AgentHelpers(this);
    const selectedIds = this.editor.getSelectedShapeIds();

    // Import shape serializer
    const { serializeShapes } = await import("./shape-serializer");
    const serializedShapes = serializeShapes(this.editor);

    const body = {
      message: request.messages.join("\n"),
      shapes: serializedShapes,
      selectedShapes: selectedIds.map((id) => id.toString()),
      viewportBounds: {
        x: request.bounds.x,
        y: request.bounds.y,
        w: request.bounds.w,
        h: request.bounds.h,
      },
      contextItems: request.contextItems.map((item) =>
        helpers.applyOffsetToContextItem(structuredClone(item))
      ),
      model: request.modelName,
    };

    const res = await fetch(this.apiEndpoint, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      signal,
    });

    if (!res.body) {
      throw new Error("No body in response");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const actions = buffer.split("\n\n");
        buffer = actions.pop() || "";

        for (const action of actions) {
          const match = action.match(/^data: (.+)$/m);
          if (match) {
            try {
              const data = JSON.parse(match[1]);

              if ("error" in data) {
                throw new Error(data.error);
              }

              const agentAction: Streaming<AgentAction> = data;
              yield agentAction;
            } catch (err: unknown) {
              if (err instanceof Error) {
                throw new Error(err.message);
              }
              throw err;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Start recording user actions
   */
  private startRecordingUserActions(): () => void {
    const { editor } = this;

    const cleanUpCreate = editor.sideEffects.registerAfterCreateHandler(
      "shape",
      (shape, source) => {
        if (source !== "user") return;
        if (this.isActing) return;
        const change = {
          added: { [shape.id]: shape } as Record<string, TLRecord>,
          updated: {} as Record<string, [TLRecord, TLRecord]>,
          removed: {} as Record<string, TLRecord>,
        };
        this.$userActionHistory.update((prev) => [...prev, change]);
      }
    );

    const cleanUpDelete = editor.sideEffects.registerAfterDeleteHandler(
      "shape",
      (shape, source) => {
        if (source !== "user") return;
        if (this.isActing) return;
        const change = {
          added: {} as Record<string, TLRecord>,
          updated: {} as Record<string, [TLRecord, TLRecord]>,
          removed: { [shape.id]: shape } as Record<string, TLRecord>,
        };
        this.$userActionHistory.update((prev) => [...prev, change]);
      }
    );

    const cleanUpChange = editor.sideEffects.registerAfterChangeHandler(
      "shape",
      (prev, next, source) => {
        if (source !== "user") return;
        if (this.isActing) return;
        const change: RecordsDiff<TLRecord> = {
          added: {} as Record<string, TLRecord>,
          updated: { [prev.id]: [prev, next] } as Record<
            string,
            [TLRecord, TLRecord]
          >,
          removed: {} as Record<string, TLRecord>,
        };
        this.$userActionHistory.update((prevHistory) => [
          ...prevHistory,
          change,
        ]);
      }
    );

    return () => {
      cleanUpCreate();
      cleanUpDelete();
      cleanUpChange();
    };
  }

  /**
   * Dedupe shapes in a shapes context item
   */
  private dedupeShapesContextItem(
    item: ShapesContextItem,
    existingItems: ContextItem[]
  ): ContextItem[] {
    const existingShapeIds = new Set<string>();

    existingItems.forEach((contextItem) => {
      if (contextItem.type === "shape") {
        existingShapeIds.add(contextItem.shape.shapeId);
      } else if (contextItem.type === "shapes") {
        contextItem.shapes.forEach((shape) => {
          existingShapeIds.add(shape.shapeId);
        });
      }
    });

    const newShapes = item.shapes.filter(
      (shape) => !existingShapeIds.has(shape.shapeId)
    );

    if (newShapes.length > 0) {
      if (newShapes.length === 1) {
        return [
          structuredClone({
            type: "shape" as const,
            shape: newShapes[0],
            source: item.source,
          }),
        ];
      }

      return [
        structuredClone({
          type: "shapes" as const,
          shapes: newShapes,
          source: item.source,
        }),
      ];
    }

    return [];
  }

  /**
   * Load persisted state from localStorage
   */
  private loadPersistedState(): void {
    if (typeof window === "undefined") return;

    try {
      const chatHistory = localStorage.getItem(`${this.id}:chat-history`);
      if (chatHistory) {
        this.$chatHistory.set(JSON.parse(chatHistory));
      }

      const chatOrigin = localStorage.getItem(`${this.id}:chat-origin`);
      if (chatOrigin) {
        this.$chatOrigin.set(JSON.parse(chatOrigin));
      }

      const modelName = localStorage.getItem(`${this.id}:model-name`);
      if (modelName) {
        this.$modelName.set(JSON.parse(modelName));
      }

      const todoList = localStorage.getItem(`${this.id}:todo-items`);
      if (todoList) {
        this.$todoList.set(JSON.parse(todoList));
      }

      const contextItems = localStorage.getItem(`${this.id}:context-items`);
      if (contextItems) {
        this.$contextItems.set(JSON.parse(contextItems));
      }
    } catch {
      console.warn("Couldn't load persisted state from localStorage");
    }

    // Set up persistence
    this.$chatHistory.subscribe((value) => {
      localStorage.setItem(`${this.id}:chat-history`, JSON.stringify(value));
    });

    this.$chatOrigin.subscribe((value) => {
      localStorage.setItem(`${this.id}:chat-origin`, JSON.stringify(value));
    });

    this.$modelName.subscribe((value) => {
      localStorage.setItem(`${this.id}:model-name`, JSON.stringify(value));
    });

    this.$todoList.subscribe((value) => {
      localStorage.setItem(`${this.id}:todo-items`, JSON.stringify(value));
    });

    this.$contextItems.subscribe((value) => {
      localStorage.setItem(`${this.id}:context-items`, JSON.stringify(value));
    });
  }
}

// ============================================
// Hook for using agent in React
// ============================================

export function createTldrawAgent(
  editor: Editor,
  options: Omit<TldrawAgentOptions, "editor">
): TldrawAgent {
  return new TldrawAgent({ editor, ...options });
}

