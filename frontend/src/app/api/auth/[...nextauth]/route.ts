import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KeycloakProvider from "next-auth/providers/keycloak";
import AuthentikProvider from "next-auth/providers/authentik";

const providers: NextAuthOptions["providers"] = [];

// Google (configurable)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: process.env.GOOGLE_PROMPT || "select_account",
          access_type: process.env.GOOGLE_ACCESS_TYPE || "online",
          response_type: "code",
        },
      },
    })
  );
}

// Keycloak (generic OIDC)
if (process.env.KEYCLOAK_CLIENT_ID && process.env.KEYCLOAK_CLIENT_SECRET && process.env.KEYCLOAK_ISSUER) {
  providers.push(
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,
    })
  );
}

// Authentik (generic OIDC)
if (process.env.AUTHENTIK_CLIENT_ID && process.env.AUTHENTIK_CLIENT_SECRET && process.env.AUTHENTIK_ISSUER) {
  providers.push(
    AuthentikProvider({
      clientId: process.env.AUTHENTIK_CLIENT_ID,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
      issuer: process.env.AUTHENTIK_ISSUER,
    })
  );
}

// Generic OIDC fallback
if (providers.length === 0 && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET && process.env.OIDC_ISSUER) {
  try {
    providers.push(
      KeycloakProvider({
        id: process.env.OIDC_ID || "oidc",
        name: process.env.OIDC_NAME || "OIDC",
        issuer: process.env.OIDC_ISSUER,
        clientId: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
      })
    );
  } catch {
    // Skip if not available; preserve security without breaking build
  }
}

const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token }) {
      // Data minimization: Do not store provider access tokens in JWT
      // OpenPlanet only uses NextAuth for identity session state.
      return token;
    },
    async session({ session }) {
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export { authOptions };
