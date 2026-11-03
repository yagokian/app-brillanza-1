"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

// Native date input: picking a day opens the dashboard on it, keeping the status filter.
export function DayPicker({ day, status, label }: { day: string; status: string | null; label: string }) {
  const router = useRouter();
  return (
    <Input
      type="date"
      aria-label={label}
      className="h-10 w-auto"
      value={day}
      onChange={(e) => {
        if (!e.target.value) return;
        const params = new URLSearchParams({ d: e.target.value });
        if (status) params.set("status", status);
        router.push(`/admin?${params}`);
      }}
    />
  );
}
