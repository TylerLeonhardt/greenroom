import { beforeEach, describe, expect, it } from "vitest";
import {
	createTestAvailabilityRequest,
	createTestGroup,
	createTestUser,
} from "../../services/__integration__/seed.js";
import { cleanDatabase } from "../../services/__integration__/setup.js";
import { getUserResponse } from "../../services/availability.server.js";
import { generateCsrfToken } from "../../services/csrf.server.js";
import { _resetForTests } from "../../services/rate-limit.server.js";
import { createUserSession } from "../../services/session.server.js";
import { action } from "../groups.$groupId.availability.$requestId.js";

const requestedDates = ["2027-04-01", "2027-04-02"];

beforeEach(async () => {
	await cleanDatabase();
	_resetForTests();
});

async function makeAuthenticatedResponseRequest(
	userId: string,
	groupId: string,
	requestId: string,
	responses: Record<string, string>,
): Promise<Request> {
	const path = `/groups/${groupId}/availability/${requestId}`;
	const loginResponse = await createUserSession(userId, path);
	const authCookie = loginResponse.headers.get("Set-Cookie");
	if (!authCookie) throw new Error("Expected authenticated session cookie");

	const csrfRequest = new Request(`http://localhost${path}`, {
		headers: { Cookie: authCookie.split(";")[0] },
	});
	const { token, cookie } = await generateCsrfToken(csrfRequest);

	return new Request(`http://localhost${path}`, {
		method: "POST",
		body: new URLSearchParams({
			_csrf: token,
			intent: "respond",
			responses: JSON.stringify(responses),
		}),
		headers: { Cookie: cookie.split(";")[0] },
	});
}

async function submit(
	userId: string,
	groupId: string,
	requestId: string,
	responses: Record<string, string> = { "2027-04-01": "available" },
) {
	return action({
		request: await makeAuthenticatedResponseRequest(userId, groupId, requestId, responses),
		params: { groupId, requestId },
		context: {},
	});
}

async function expectRejected(actionPromise: Promise<unknown>, status: number): Promise<Response> {
	try {
		await actionPromise;
		expect.fail(`Expected action to reject with HTTP ${status}`);
	} catch (error) {
		expect(error).toBeInstanceOf(Response);
		expect((error as Response).status).toBe(status);
		return error as Response;
	}
}

describe("availability response route integration", () => {
	it("allows a member to respond to an open request in their group", async () => {
		const member = await createTestUser();
		const group = await createTestGroup(member.id);
		const availabilityRequest = await createTestAvailabilityRequest(group.id, member.id, {
			requestedDates,
		});

		const result = await submit(member.id, group.id, availabilityRequest.id, {
			"2027-04-01": "available",
			"2027-04-02": "maybe",
		});

		expect(result).toEqual({ success: true, message: "Response saved!" });
		expect(await getUserResponse(availabilityRequest.id, member.id)).toEqual({
			responses: {
				"2027-04-01": "available",
				"2027-04-02": "maybe",
			},
			notes: {},
		});
	});

	it("returns 404 for a user who is not a member of the request group", async () => {
		const owner = await createTestUser();
		const nonMember = await createTestUser();
		const group = await createTestGroup(owner.id);
		const availabilityRequest = await createTestAvailabilityRequest(group.id, owner.id, {
			requestedDates,
		});

		await expectRejected(submit(nonMember.id, group.id, availabilityRequest.id), 404);
		expect(await getUserResponse(availabilityRequest.id, nonMember.id)).toBeNull();
	});

	it("returns 404 when the request belongs to a different group than the route", async () => {
		const member = await createTestUser();
		const otherOwner = await createTestUser();
		const routeGroup = await createTestGroup(member.id);
		const requestGroup = await createTestGroup(otherOwner.id);
		const availabilityRequest = await createTestAvailabilityRequest(
			requestGroup.id,
			otherOwner.id,
			{ requestedDates },
		);

		await expectRejected(submit(member.id, routeGroup.id, availabilityRequest.id), 404);
		expect(await getUserResponse(availabilityRequest.id, member.id)).toBeNull();
	});

	it("returns 410 and does not persist a response for a closed request", async () => {
		const member = await createTestUser();
		const group = await createTestGroup(member.id);
		const availabilityRequest = await createTestAvailabilityRequest(group.id, member.id, {
			requestedDates,
			status: "closed",
		});

		await expectRejected(submit(member.id, group.id, availabilityRequest.id), 410);
		expect(await getUserResponse(availabilityRequest.id, member.id)).toBeNull();
	});

	it("returns 410 and does not persist a response for an expired request", async () => {
		const member = await createTestUser();
		const group = await createTestGroup(member.id);
		const availabilityRequest = await createTestAvailabilityRequest(group.id, member.id, {
			requestedDates,
			expiresAt: new Date(Date.now() - 60_000),
		});

		await expectRejected(submit(member.id, group.id, availabilityRequest.id), 410);
		expect(await getUserResponse(availabilityRequest.id, member.id)).toBeNull();
	});

	it("returns 400 and does not persist response dates outside the request", async () => {
		const member = await createTestUser();
		const group = await createTestGroup(member.id);
		const availabilityRequest = await createTestAvailabilityRequest(group.id, member.id, {
			requestedDates,
		});

		const result = await submit(member.id, group.id, availabilityRequest.id, {
			"2027-04-03": "available",
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(400);
		expect(await getUserResponse(availabilityRequest.id, member.id)).toBeNull();
	});
});
