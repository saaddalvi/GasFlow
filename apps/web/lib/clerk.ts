// How Clerk's screens look and read, using the blueprint's design system.

export const appearance = {
  // Lets Tailwind utilities override Clerk's own styles. See globals.css.
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#2563eb",
    fontFamily: "var(--font-inter)",
    borderRadius: "0.5rem",
  },
  elements: {
    // Accounts are made by an admin, so there is nowhere to sign up.
    footerAction__signUp: { display: "none" },
  },
};

const signInTitle = { title: "GasFlow", subtitle: "Sign in to continue." };

export const localization = {
  formFieldLabel__username: "Username",
  // Clerk uses this label because admins may also sign in with their email.
  formFieldLabel__emailAddress_username: "Username",
  formFieldInputPlaceholder__username: "Enter your username",
  formFieldInputPlaceholder__emailAddress_username: "Enter your username",
  signIn: {
    start: {
      ...signInTitle,
      titleCombined: signInTitle.title,
      subtitleCombined: signInTitle.subtitle,
    },
    alternativeMethods: {
      getHelp: { content: "Ask your admin to reset your password." },
    },
  },
};
