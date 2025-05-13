/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai from "../ai.js";
import type * as http from "../http.js";
import type * as users from "../users.js";
import type * as whiteboardActions from "../whiteboardActions.js";
import type * as whiteboardChatBot from "../whiteboardChatBot.js";
import type * as whiteboards from "../whiteboards.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  http: typeof http;
  users: typeof users;
  whiteboardActions: typeof whiteboardActions;
  whiteboardChatBot: typeof whiteboardChatBot;
  whiteboards: typeof whiteboards;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
