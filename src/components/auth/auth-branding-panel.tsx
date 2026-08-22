import Image from "next/image";
import { cn } from "@/lib/utils";

export function AuthBrandingPanel({ className }: { className?: string }) {
  return (
    <div className={cn("relative hidden lg:block", className)}>
      <div className="absolute inset-x-0 top-14 bottom-0 overflow-hidden rounded-[2rem]">
        <Image
          src="/images/auth-background.webp"
          alt=""
          aria-hidden
          fill
          sizes="(min-width: 1024px) 50vw, 0px"
          className="object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-overlay via-overlay/75 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 max-w-lg p-10">
          <blockquote className="text-2xl leading-snug font-medium text-balance text-brand-foreground">
            &ldquo;Protocolamos a organização do seu escritório.&rdquo;
          </blockquote>
          <p className="mt-2 text-sm text-brand-foreground/75">
            Feito para escritórios de advocacia que querem organização sem complicação.
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/justica-estatua.webp"
          alt="Estátua da Justiça, com balança e venda nos olhos"
          fill
          sizes="(min-width: 1024px) 50vw, 0px"
          className="object-cover object-[64%_bottom]"
          priority
        />
      </div>
    </div>
  );
}
