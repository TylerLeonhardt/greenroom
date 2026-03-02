import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/services/session.server", () => ({
	destroyUserSession: vi
		.fn()
		.mockResolvedValue(new Response(null, { status: 302, headers: { Location: "/" } })),
}));

import { action, loader } from "~/routes/logout";
import { validateCsrfToken } from "~/services/csrf.server";
import { destroyUserSession } from "~/services/session.server";

describe("logout", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("loader", () => {
		it("redirects to /", async () => {
			const response = await loader();
			expect((response as Response).status).toBe(302);
			expect((response as Response).headers.get("Location")).toBe("/");
		});
	});

	describe("action", () => {
		it("validates CSRF then destroys session", async () => {
			const formData = new FormData();
			const request = new Request("http://localhost/logout", {
				method: "POST",
				body: formData,
			});

			const response = await action({ request, params: {}, context: {} });

			expect(validateCsrfToken).toHaveBeenCalledWith(request, formData);
			expect(destroyUserSession).toHaveBeenCalledWith(request, "/");
			expect((response as Response).status).toBe(302);
			expect((response as Response).headers.get("Location")).toBe("/");
		});

		it("throws when CSRF validation fails", async () => {
			const csrfError = new Response("Invalid CSRF token", { status: 403 });
			(validateCsrfToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(csrfError);

			const formData = new FormData();
			const request = new Request("http://localhost/logout", {
				method: "POST",
				body: formData,
			});

			await expect(action({ request, params: {}, context: {} })).rejects.toBe(csrfError);
			expect(destroyUserSession).not.toHaveBeenCalled();
		});
	});
});
