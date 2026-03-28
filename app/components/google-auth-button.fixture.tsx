import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { GoogleAuthButton } from "./google-auth-button";
import "~/tailwind.css";

export default defineFixtureGroup({
	"Sign In": defineFixture({
		description: "Google OAuth button for login page",
		render: (container) => {
			const root = createRoot(container);
			root.render(<GoogleAuthButton>Sign in with Google</GoogleAuthButton>);
			return { dispose: () => root.unmount() };
		},
	}),
	"Sign Up": defineFixture({
		description: "Google OAuth button for signup page",
		render: (container) => {
			const root = createRoot(container);
			root.render(<GoogleAuthButton>Sign up with Google</GoogleAuthButton>);
			return { dispose: () => root.unmount() };
		},
	}),
});
