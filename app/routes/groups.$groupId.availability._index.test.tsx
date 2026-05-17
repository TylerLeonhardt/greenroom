// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock groups service
vi.mock("~/services/groups.server", () => ({
	requireGroupMember: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
}));

// Mock availability service
vi.mock("~/services/availability.server", () => ({
	getGroupAvailabilityRequests: vi.fn().mockResolvedValue([]),
}));

// Mock date-utils to avoid timezone issues in tests
vi.mock("~/lib/date-utils", () => ({
	formatDateRange: vi.fn(() => "Mar 1 – Mar 28, 2026"),
	formatTimeRange: vi.fn(() => "7:00 PM – 9:00 PM"),
}));

// Mock Remix hooks for component rendering tests
const mockLoaderData = { requests: [] as unknown[] };
const mockRouteLoaderData: Record<string, unknown> = {};
vi.mock("@remix-run/react", () => ({
	useLoaderData: () => mockLoaderData,
	useRouteLoaderData: (routeId: string) => mockRouteLoaderData[routeId],
	Link: ({
		to,
		children,
		...props
	}: {
		to: string;
		children: React.ReactNode;
		className?: string;
	}) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

import { loader } from "~/routes/groups.$groupId.availability._index";
import { getGroupAvailabilityRequests } from "~/services/availability.server";
import { requireGroupMember } from "~/services/groups.server";

// ---------- Loader tests ----------

describe("availability index loader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(getGroupAvailabilityRequests as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	it("requires group membership", async () => {
		const request = new Request("http://localhost/groups/g1/availability");
		await loader({ request, params: { groupId: "g1" }, context: {} });
		expect(requireGroupMember).toHaveBeenCalledWith(request, "g1");
	});

	it("returns availability requests", async () => {
		const mockRequests = [
			{
				id: "r1",
				title: "March Rehearsals",
				status: "open",
				dateRangeStart: new Date("2026-03-01"),
				dateRangeEnd: new Date("2026-03-28"),
				requestedStartTime: "19:00",
				requestedEndTime: "21:00",
				memberCount: 8,
				responseCount: 5,
				createdByName: "Admin User",
				hasResponded: false,
			},
		];
		(getGroupAvailabilityRequests as ReturnType<typeof vi.fn>).mockResolvedValue(mockRequests);

		const request = new Request("http://localhost/groups/g1/availability");
		const result = await loader({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({ requests: mockRequests });
	});

	it("passes groupId and userId to getGroupAvailabilityRequests", async () => {
		const request = new Request("http://localhost/groups/group-xyz/availability");
		await loader({ request, params: { groupId: "group-xyz" }, context: {} });
		expect(getGroupAvailabilityRequests).toHaveBeenCalledWith("group-xyz", "user-1");
	});

	it("defaults to empty groupId when param is missing", async () => {
		const request = new Request("http://localhost/groups//availability");
		await loader({ request, params: {}, context: {} });
		expect(requireGroupMember).toHaveBeenCalledWith(request, "");
	});
});

// ---------- Component rendering tests ----------

// Lazy-import the default export so vi.mock for Remix hooks is in place
const { default: Availability } = await import("~/routes/groups.$groupId.availability._index");

function makeRequest(
	overrides: Partial<{
		id: string;
		title: string;
		status: string;
		dateRangeStart: string;
		dateRangeEnd: string;
		requestedStartTime: string | null;
		requestedEndTime: string | null;
		responseCount: number;
		memberCount: number;
		createdByName: string;
		hasResponded: boolean;
	}> = {},
) {
	return {
		id: overrides.id ?? "r1",
		title: overrides.title ?? "March Rehearsals",
		status: overrides.status ?? "open",
		dateRangeStart: overrides.dateRangeStart ?? "2026-03-01",
		dateRangeEnd: overrides.dateRangeEnd ?? "2026-03-28",
		requestedStartTime: overrides.requestedStartTime ?? "19:00",
		requestedEndTime: overrides.requestedEndTime ?? "21:00",
		responseCount: overrides.responseCount ?? 5,
		memberCount: overrides.memberCount ?? 8,
		createdByName: overrides.createdByName ?? "Admin User",
		hasResponded: overrides.hasResponded ?? false,
	};
}

describe("availability index component", () => {
	beforeEach(() => {
		mockLoaderData.requests = [];
		mockRouteLoaderData["routes/groups.$groupId"] = {
			role: "member",
			group: { id: "g1", membersCanCreateRequests: false },
			user: { timezone: "America/New_York" },
		};
	});

	it("renders no collapsed section when all requests are open", () => {
		mockLoaderData.requests = [
			makeRequest({ id: "r1", status: "open" }),
			makeRequest({ id: "r2", status: "open", title: "April Rehearsals" }),
		];

		render(<Availability />);

		expect(screen.queryByRole("button", { name: /closed requests/i })).toBeNull();
	});

	it("renders a 'Closed Requests (N)' toggle when there are closed requests", () => {
		mockLoaderData.requests = [
			makeRequest({ id: "r1", status: "open" }),
			makeRequest({ id: "r2", status: "closed", title: "Old Request" }),
			makeRequest({ id: "r3", status: "closed", title: "Older Request" }),
		];

		render(<Availability />);

		const toggle = screen.getByRole("button", { name: /closed requests \(2\)/i });
		expect(toggle).toBeDefined();
	});

	it("hides closed requests by default", () => {
		mockLoaderData.requests = [
			makeRequest({ id: "r1", status: "closed", title: "Hidden Request" }),
		];

		render(<Availability />);

		// The toggle button should exist
		screen.getByRole("button", { name: /closed requests/i });
		// But the closed request title should not be visible (not rendered)
		expect(screen.queryByText("Hidden Request")).toBeNull();
	});

	it("shows closed requests after clicking toggle", async () => {
		const user = userEvent.setup();
		mockLoaderData.requests = [
			makeRequest({ id: "r1", status: "closed", title: "Revealed Request" }),
		];

		render(<Availability />);

		const toggle = screen.getByRole("button", { name: /closed requests/i });
		await user.click(toggle);

		expect(screen.getByText("Revealed Request")).toBeDefined();
	});

	it("shows responded indicator when hasResponded is true", () => {
		mockLoaderData.requests = [makeRequest({ id: "r1", status: "open", hasResponded: true })];

		render(<Availability />);

		expect(screen.getByText("Responded")).toBeDefined();
	});

	it("does not show responded indicator when hasResponded is false", () => {
		mockLoaderData.requests = [makeRequest({ id: "r1", status: "open", hasResponded: false })];

		render(<Availability />);

		expect(screen.queryByText("Responded")).toBeNull();
	});
});
