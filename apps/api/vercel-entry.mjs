// Entrypoint do service `api` na Vercel (deploy Supabase, vercel.json da raiz).
// A CLI exige que o entrypoint exista antes do build; o bundle dist/main.mjs (ESM pela extensão: a Vercel copia o handler para a raiz da função, longe do "type": "module") é gerado pelo
// `vercel-build` (tsup) e rastreado a partir deste import. Fora da Vercel, use `npm start`.
import "./dist/main.mjs";
