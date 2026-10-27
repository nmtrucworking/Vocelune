import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | number): string {
  const d = new Date(date);
  return d.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(date: string | Date | number): string {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.round((d.getTime() - now.getTime()) / 1000);

  if (diffInSeconds < 0 && Math.abs(diffInSeconds) < 60) return "vừa xong";
  if (diffInSeconds < 0 && Math.abs(diffInSeconds) < 3600) {
    const mins = Math.round(Math.abs(diffInSeconds) / 60);
    return `${mins} phút trước`;
  }
  if (diffInSeconds < 0 && Math.abs(diffInSeconds) < 86400) {
    const hours = Math.round(Math.abs(diffInSeconds) / 3600);
    return `${hours} giờ trước`;
  }

  // Future
  if (diffInSeconds > 0 && diffInSeconds < 3600) {
    const mins = Math.round(diffInSeconds / 60);
    return `trong ${mins} phút`;
  }
  if (diffInSeconds > 0 && diffInSeconds < 86400) {
    const hours = Math.round(diffInSeconds / 3600);
    return `hôm nay (${hours}h)`;
  }
  if (diffInSeconds > 0 && diffInSeconds < 86400 * 2) {
    return "ngày mai";
  }

  const days = Math.round(Math.abs(diffInSeconds) / 86400);
  return diffInSeconds > 0 ? `trong ${days} ngày` : `${days} ngày trước`;
}
