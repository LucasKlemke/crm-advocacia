import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      escritorioId: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    escritorioId: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    escritorioId: string;
    role: string;
  }
}
