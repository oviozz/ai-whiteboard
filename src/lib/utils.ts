
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(input: string | number): string {
  let past: Date;

  if (typeof input === 'string') {
    if (!isNaN(Number(input))) {
      past = new Date(Number(input));
    } else {
      past = new Date(input);
    }
  } else {
    past = new Date(input);
  }

  const now = new Date();
  const diffMs = now.getTime() - past.getTime();

  if (diffMs < 0) return "just now"; // 🛡️ handles future times safely

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

export function fuzzyIncludes(text: string, targets: string[], threshold = 0.7): boolean {
  // Normalize the text for comparison
  const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, ' ').trim();

  // Check for exact substring matches first (for efficiency)
  const normalizedText = normalize(text);
  for (const target of targets) {
    const normalizedTarget = normalize(target);
    if (normalizedText.includes(normalizedTarget)) {
      return true;
    }
  }

  const similarity = (a: string, b: string) => {
    a = normalize(a);
    b = normalize(b);

    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    const longerLength = longer.length;

    if (longerLength === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longerLength - editDistance) / longerLength;
  };

  for (const target of targets) {
    if (similarity(text, target) >= threshold) {
      return true;
    }
  }

  return false;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j] + 1,    // deletion
              matrix[i][j - 1] + 1,    // insertion
              matrix[i - 1][j - 1] + 1 // substitution
          );
    }
  }

  return matrix[b.length][a.length];
}