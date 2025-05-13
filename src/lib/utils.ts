
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