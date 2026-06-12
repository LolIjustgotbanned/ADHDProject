import { SignIn } from "@clerk/nextjs";

// Clerk's prebuilt sign-in card — Google, Apple, and email verification
// codes, per what's enabled in the Clerk dashboard. The optional catch-all
// segment exists because Clerk's path routing steps through sub-paths
// (e.g. /login/factor-one) mid-flow.
// `appearance.variables` maps Clerk's theme onto our design tokens
// (app/globals.css) so the card sits naturally in the dark UI.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <SignIn
        // Sign-in-or-up in one card: a new visitor's email creates the
        // account right here — the landing's "Get started" depends on it.
        withSignUp
        appearance={{
          variables: {
            colorPrimary: "#fbbf24", // --accent
            colorBackground: "#14171c", // --surface
            colorForeground: "#e8eaed", // --foreground
            colorMutedForeground: "#98a0ac", // --muted
            colorInput: "#0b0d10", // --background
            colorInputForeground: "#e8eaed", // --foreground
            borderRadius: "0.75rem", // rounded-xl, like every card here
          },
        }}
      />
    </main>
  );
}
