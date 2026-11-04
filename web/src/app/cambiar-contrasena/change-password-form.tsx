"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const t = useTranslations("auth.changePassword");
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="h-11" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">{t("confirmPassword")}</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className="h-11" />
          </div>
          {state?.error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t(state.error)}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-11 text-base">
            {pending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
