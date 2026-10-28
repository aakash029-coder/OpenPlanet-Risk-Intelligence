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
          prompt: process.env.GOOGLE_PROMPT || "consent",
          access_type: process.env.GOOGLE_ACCESS_TYPE || "offline",
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

// Generic OIDC (Keycloak/Authentik compatible) - use Keycloak provider style if issuer provided
if (providers.length === 0 && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET && process.env.OIDC_ISSUER) {
  try {
    const { default: KeycloakProvider } = require("next-auth/providers/keycloak");
    providers.push(
      KeycloakProvider({
        id: process.env.OIDC_ID || "oidc",
        name: process.env.OIDC_NAME || "OIDC",
        issuer: process.env.OIDC_ISSUER,
        clientId: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
      })
    );
  } catch (e) {
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
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export { authOptions };