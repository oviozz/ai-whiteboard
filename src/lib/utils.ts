
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(input: string | number): string {
  let past: Date;

  if (typeof input === 'string') {
    // Check if it's a numeric string
    if (!isNaN(Number(input))) {
      past = new Date(Number(input)); // handle millisecond timestamp in string form
    } else {
      past = new Date(input); // handle ISO string like "2025-05-11T20:39:47.675Z"
    }
  } else {
    past = new Date(input); // handle timestamp number
  }

  const now: Date = new Date();
  const diffMs: number = now.getTime() - past.getTime();

  const seconds: number = Math.floor(diffMs / 1000);
  const minutes: number = Math.floor(seconds / 60);
  const hours: number = Math.floor(minutes / 60);
  const days: number = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}
