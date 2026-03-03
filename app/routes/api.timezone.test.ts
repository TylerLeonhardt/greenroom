import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
		timezone: null,
	}),
	updateUserTimezone: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action } from "~/routes/api.timezone";
import { requireUser, updateUserTimezone } from "~/services/auth.server";

function makeFormData(data: Record<string, string>): FormData {
	const formData = new FormData();
	for (const [key, value] of Object.entries(data)) {
		formData.set(key, value);
	}
	return formData;
}

function makeRequest(formData: FormData, method = "POST"): Request {
	return new Request("http://localhost/api/timezone", {
		method,
		body: formData,
	});
}

describe("api.timezone action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("updates timezone with a valid IANA timezone", async () => {
		const formData = makeFormData({
			timezone: "America/Los_Angeles",
			_csrf: "token",
		});
		const response = await action({
			request: makeRequest(formData),
			params: {},
			context: {},
		});
		const data = await response.json();

		expect(data).toEqual({ success: true });
		expect(updateUserTimezone).toHaveBeenCalledWith("user-1", "America/Los_Angeles");
	});

	it("updates timezone to UTC", async () => {
		const formData = makeFormData({ timezone: "UTC", _csrf: "token" });
		const response = await action({
			request: makeRequest(formData),
			params: {},
			context: {},
		});
		const data = await response.json();

		expect(data).toEqual({ success: true });
		expect(updateUserTimezone).toHaveBeenCalledWith("user-1", "UTC");
	});

	it("rejects missing timezone", async () => {
		const formData = makeFormData({ _csrf: "token" });
		const response = await action({
			request: makeRequest(formData),
			params: {},
			context: {},
		});
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Timezone is required.");
		expect(updateUserTimezone).not.toHaveBeenCalled();
	});

	it("rejects empty timezone", async () => {
		const formData = makeFormData({ timezone: "   ", _csrf: "token" });
		const response = await action({
			request: makeRequest(formData),
			params: {},
			context: {},
		});

		expect(response.status).toBe(400);
		expect(updateUserTimezone).not.toHaveBeenCalled();
	});

	it("rejects invalid timezone abbreviation", async () => {
		const formData = makeFormData({ timezone: "PST", _csrf: "token" });
		const response = await action({
			request: makeRequest(formData),
			params: {},
			context: {},
		});
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Invalid timezone.");
		expect(updateUserTimezone).not.toHaveBeenCalled();
	});

	it("rejects non-POST methods", async () => {
		const formData = makeFormData({ timezone: "America/New_York", _csrf: "token" });
		const response = await action({
			request: makeRequest(formData, "PUT"),
			params: {},
			context: {},
		});

		expect(response.status).toBe(405);
		expect(updateUserTimezone).not.toHaveBeenCalled();
	});

	it("requires authentication", async () => {
		vi.mocked(requireUser).mockRejectedValueOnce(new Response(null, { status: 302 }));

		const formData = makeFormData({ timezone: "America/New_York", _csrf: "token" });
		await expect(
			action({ request: makeRequest(formData), params: {}, context: {} }),
		).rejects.toBeInstanceOf(Response);
	});
});
