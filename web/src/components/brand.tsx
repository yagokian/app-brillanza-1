import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="Brillanza Limpiezas"
      width={240}
      height={160}
      priority={priority}
      className={cn("h-auto w-auto", className)}
    />
  );
}
