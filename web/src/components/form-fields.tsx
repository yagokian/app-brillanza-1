import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Base = { name: string; label: string; invalid?: boolean; hint?: ReactNode; className?: string };

function Wrapper({ name, label, hint, className, children }: Base & { children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextField({ name, label, invalid, hint, className, ...props }: Base & Omit<ComponentProps<"input">, "name">) {
  return (
    <Wrapper name={name} label={label} hint={hint} className={className}>
      <Input id={name} name={name} aria-invalid={invalid || undefined} className="h-10" {...props} />
    </Wrapper>
  );
}

export function TextAreaField({ name, label, invalid, hint, className, ...props }: Base & Omit<ComponentProps<"textarea">, "name">) {
  return (
    <Wrapper name={name} label={label} hint={hint} className={className}>
      <Textarea id={name} name={name} aria-invalid={invalid || undefined} {...props} />
    </Wrapper>
  );
}

export function SelectField({
  name,
  label,
  invalid,
  hint,
  className,
  options,
  ...props
}: Base & Omit<ComponentProps<"select">, "name"> & { options: { value: string; label: string }[] }) {
  return (
    <Wrapper name={name} label={label} hint={hint} className={className}>
      <NativeSelect id={name} name={name} aria-invalid={invalid || undefined} className="h-10" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </Wrapper>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}
