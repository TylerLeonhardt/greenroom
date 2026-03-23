import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { CopyButton, CopyIconButton } from "./copy-button";
import "~/tailwind.css";

export default defineFixtureGroup({
	"Icon Button": defineFixture({
		description: "Small icon-only copy button with clipboard animation",
		properties: [
			{ type: "string", name: "value", defaultValue: "ABCD1234" },
			{ type: "string", name: "title", defaultValue: "Copy invite code" },
		],
		render: (container, { props }) => {
			const root = createRoot(container);
			root.render(<CopyIconButton value={props.value as string} title={props.title as string} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Text Button": defineFixture({
		description: "Full-width copy button with label text",
		properties: [
			{
				type: "string",
				name: "value",
				defaultValue: "https://mycalltime.app/groups/join?code=ABCD1234",
			},
			{ type: "string", name: "label", defaultValue: "Copy Invite Link" },
		],
		render: (container, { props }) => {
			const root = createRoot(container);
			root.render(<CopyButton value={props.value as string}>{props.label as string}</CopyButton>);
			return { dispose: () => root.unmount() };
		},
	}),
});
