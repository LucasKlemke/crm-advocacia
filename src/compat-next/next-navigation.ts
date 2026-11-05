// Ponte temporária da Fase 4: os componentes movidos para apps/web importam
// "@/compat/next-navigation". Enquanto o Next ainda renderiza as páginas, o alias da raiz
// aponta para cá e o contrato continua sendo o do próprio Next. Some junto com o Next
// (parte B da Fase 4). No front Vite, o mesmo alias resolve para apps/web/src/compat.
export { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
