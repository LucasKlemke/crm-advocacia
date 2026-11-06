// Entrypoint do service `api` na Vercel (deploy Supabase, vercel.json da raiz).
// A CLI exige que o entrypoint exista antes do build; o bundle dist/main.js é gerado pelo
// `vercel-build` (tsup) e rastreado a partir deste import. Fora da Vercel, use `npm start`.
import "./dist/main.js";
