import type { DefaultSession } from "next-auth";
import type { RoleMembro } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      escritorioId: string | null;
      role: RoleMembro | null;
    } & DefaultSession["user"];
  }

  interface User {
    escritorioId: string | null;
    role: RoleMembro | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    escritorioId: string | null;
    role: RoleMembro | null;
  }
}
