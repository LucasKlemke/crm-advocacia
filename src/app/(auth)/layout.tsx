import type { ReactNode } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { AuthBrandingPanel } from "@/components/auth/auth-branding-panel";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen gap-4 bg-background p-4 lg:grid-cols-2 lg:p-6">
      <div className="flex flex-col justify-center rounded-[2rem] bg-linear-to-br from-gold-soft from-35% via-gold-soft via-55% to-gold px-6 py-10 sm:px-12 sm:py-12">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <Link
            href="/"
            className="mx-auto flex items-center gap-2.5 font-heading text-lg font-semibold"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="size-5" />
            </span>
            CRM Advocacia
          </Link>

          {children}
        </div>
      </div>

      <AuthBrandingPanel />
    </div>
  );
}
