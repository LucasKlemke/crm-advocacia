import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeCredentials } from "@/lib/auth/authorize";
import { resolverEscritorioAtivo } from "@/lib/auth/escritorio-ativo";
import type { RoleMembro } from "@prisma/client";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        senha: {},
      },
      authorize: (credentials) =>
        authorizeCredentials(credentials?.email, credentials?.senha),
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.escritorioId = user.escritorioId;
        token.role = user.role;
      }

      if (trigger === "update") {
        // Segurança crítica: /api/auth/session é pública e este payload chega cru do
        // client. Nunca confiar nele sem revalidar a membership no banco — senão
        // qualquer sessão poderia trocar para um escritorio_id de outro tenant.
        const desejado =
          (session?.user?.escritorioId as string | null | undefined) ??
          (token.escritorioId as string | null) ??
          null;
        const resolvido = await resolverEscritorioAtivo(token.sub as string, desejado);
        token.escritorioId = resolvido.escritorioId;
        token.role = resolvido.role;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.escritorioId = (token.escritorioId as string | null) ?? null;
      session.user.role = (token.role as RoleMembro | null) ?? null;
      return session;
    },
  },
});
