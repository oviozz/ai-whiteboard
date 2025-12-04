/**
 * closeAndParseJson
 *
 * Given a potentially incomplete JSON string, return the parsed object.
 * The string might be missing closing braces, brackets, or quotation marks.
 *
 * This is crucial for real-time streaming where we receive partial JSON.
 */
export function closeAndParseJson<T = unknown>(string: string): T | null {
  const stackOfOpenings: string[] = [];

  // Track openings and closings
  let i = 0;
  while (i < string.length) {
    const char = string[i];
    const lastOpening = stackOfOpenings.at(-1);

    if (char === '"') {
      // Check if this quote is escaped
      if (i > 0 && string[i - 1] === "\\") {
        // This is an escaped quote, skip it
        i++;
        continue;
      }

      if (lastOpening === '"') {
        stackOfOpenings.pop();
      } else {
        stackOfOpenings.push('"');
      }
    }

    if (lastOpening === '"') {
      i++;
      continue;
    }

    if (char === "{" || char === "[") {
      stackOfOpenings.push(char);
    }

    if (char === "}" && lastOpening === "{") {
      stackOfOpenings.pop();
    }

    if (char === "]" && lastOpening === "[") {
      stackOfOpenings.pop();
    }

    i++;
  }

  // Now close all unclosed openings
  for (let j = stackOfOpenings.length - 1; j >= 0; j--) {
    const opening = stackOfOpenings[j];
    if (opening === "{") {
      string += "}";
    }

    if (opening === "[") {
      string += "]";
    }

    if (opening === '"') {
      string += '"';
    }
  }

  try {
    return JSON.parse(string) as T;
  } catch {
    return null;
  }
}

/**
 * Attempts to extract complete JSON objects from a buffer.
 * Returns extracted objects and remaining buffer.
 */
export function extractJsonObjects<T = unknown>(
  buffer: string
): { objects: T[]; remaining: string } {
  const objects: T[] = [];
  let remaining = buffer;
  let depth = 0;
  let inString = false;
  let startIndex = -1;

  for (let i = 0; i < remaining.length; i++) {
    const char = remaining[i];
    const prevChar = i > 0 ? remaining[i - 1] : "";

    // Handle string boundaries
    if (char === '"' && prevChar !== "\\") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    // Track object depth
    if (char === "{") {
      if (depth === 0) {
        startIndex = i;
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && startIndex !== -1) {
        const jsonStr = remaining.slice(startIndex, i + 1);
        try {
          const obj = JSON.parse(jsonStr) as T;
          objects.push(obj);
          remaining = remaining.slice(i + 1);
          i = -1; // Reset index for new remaining string
          startIndex = -1;
        } catch {
          // Not valid JSON, continue
        }
      }
    }
  }

  return { objects, remaining };
}

