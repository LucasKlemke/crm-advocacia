import type { ReactNode } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { AuthTabs } from "@/components/auth/auth-tabs";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-brand-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--brand-foreground),transparent_85%),transparent_55%),radial-gradient(circle_at_80%_90%,color-mix(in_oklch,var(--brand-foreground),transparent_88%),transparent_50%)]"
        />
        <Link
          href="/"
          className="relative flex items-center gap-2.5 font-heading text-lg font-semibold"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-foreground/10">
            <Scale className="size-5" />
          </span>
          CRM Advocacia
        </Link>
        <div className="relative flex flex-col gap-4">
          <blockquote className="text-2xl leading-snug font-medium text-balance">
            &ldquo;Centralize clientes, acompanhe prazos e dispare WhatsApp — tudo em um só
            lugar.&rdquo;
          </blockquote>
          <p className="text-sm text-brand-foreground/70">
            Feito para escritórios de advocacia que querem organização sem complicação.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-8 bg-background px-4 py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-2 lg:hidden">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Scale className="size-5" />
          </span>
          <span className="font-heading text-lg font-semibold">CRM Advocacia</span>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <AuthTabs />
          {children}
        </div>
      </div>
    </div>
  );
}
