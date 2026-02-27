import { describe, expect, it } from "vitest";

/**
 * Tests for availability response aggregation logic.
 * The scoring formula: available × 2 + maybe × 1
 * This tests the pure computation extracted from getAggregatedResults().
 */

interface ResponseData {
	userName: string;
	responses: Record<string, string>;
}

interface DateResult {
	date: string;
	available: number;
	maybe: number;
	notAvailable: number;
	noResponse: number;
	total: number;
	score: number;
	respondents: Array<{ name: string; status: string }>;
}

// Extracted aggregation logic matching getAggregatedResults in availability.server.ts
function aggregateResponses(
	dates: string[],
	responses: ResponseData[],
	totalMembers: number,
): DateResult[] {
	return dates.map((date) => {
		let available = 0;
		let maybe = 0;
		let notAvailable = 0;
		const respondents: Array<{ name: string; status: string }> = [];

		for (const resp of responses) {
			const status = resp.responses[date];
			if (status === "available") {
				available++;
				respondents.push({ name: resp.userName, status: "available" });
			} else if (status === "maybe") {
				maybe++;
				respondents.push({ name: resp.userName, status: "maybe" });
			} else if (status === "not_available") {
				notAvailable++;
				respondents.push({ name: resp.userName, status: "not_available" });
			}
		}

		const noResponse = totalMembers - available - maybe - notAvailable;
		const score = available * 2 + maybe;

		return {
			date,
			available,
			maybe,
			notAvailable,
			noResponse,
			total: totalMembers,
			score,
			respondents,
		};
	});
}

describe("availability response aggregation", () => {
	it("scores available as 2 and maybe as 1", () => {
		const results = aggregateResponses(
			["2025-03-15"],
			[
				{ userName: "Alice", responses: { "2025-03-15": "available" } },
				{ userName: "Bob", responses: { "2025-03-15": "maybe" } },
			],
			3,
		);

		expect(results[0].score).toBe(3); // 1×2 + 1×1
		expect(results[0].available).toBe(1);
		expect(results[0].maybe).toBe(1);
	});

	it("counts not_available responses correctly", () => {
		const results = aggregateResponses(
			["2025-03-15"],
			[
				{ userName: "Alice", responses: { "2025-03-15": "not_available" } },
				{ userName: "Bob", responses: { "2025-03-15": "not_available" } },
			],
			3,
		);

		expect(results[0].notAvailable).toBe(2);
		expect(results[0].noResponse).toBe(1);
		expect(results[0].score).toBe(0);
	});

	it("calculates noResponse as total members minus all responses", () => {
		const results = aggregateResponses(
			["2025-03-15"],
			[{ userName: "Alice", responses: { "2025-03-15": "available" } }],
			5,
		);

		expect(results[0].noResponse).toBe(4);
		expect(results[0].total).toBe(5);
	});

	it("handles multiple dates independently", () => {
		const results = aggregateResponses(
			["2025-03-15", "2025-03-16"],
			[
				{
					userName: "Alice",
					responses: { "2025-03-15": "available", "2025-03-16": "not_available" },
				},
				{
					userName: "Bob",
					responses: { "2025-03-15": "not_available", "2025-03-16": "available" },
				},
			],
			2,
		);

		expect(results[0].date).toBe("2025-03-15");
		expect(results[0].score).toBe(2); // Alice available
		expect(results[1].date).toBe("2025-03-16");
		expect(results[1].score).toBe(2); // Bob available
	});

	it("handles empty responses", () => {
		const results = aggregateResponses(["2025-03-15"], [], 3);

		expect(results[0].available).toBe(0);
		expect(results[0].maybe).toBe(0);
		expect(results[0].notAvailable).toBe(0);
		expect(results[0].noResponse).toBe(3);
		expect(results[0].score).toBe(0);
	});

	it("handles respondent who did not answer for a specific date", () => {
		const results = aggregateResponses(
			["2025-03-15", "2025-03-16"],
			[{ userName: "Alice", responses: { "2025-03-15": "available" } }],
			2,
		);

		// Alice responded for 3/15 but not 3/16
		expect(results[0].available).toBe(1);
		expect(results[1].available).toBe(0);
		expect(results[1].noResponse).toBe(2);
	});

	it("tracks respondents with their names and statuses", () => {
		const results = aggregateResponses(
			["2025-03-15"],
			[
				{ userName: "Alice", responses: { "2025-03-15": "available" } },
				{ userName: "Bob", responses: { "2025-03-15": "maybe" } },
				{ userName: "Charlie", responses: { "2025-03-15": "not_available" } },
			],
			4,
		);

		expect(results[0].respondents).toHaveLength(3);
		expect(results[0].respondents).toContainEqual({ name: "Alice", status: "available" });
		expect(results[0].respondents).toContainEqual({ name: "Bob", status: "maybe" });
		expect(results[0].respondents).toContainEqual({ name: "Charlie", status: "not_available" });
	});

	it("produces correct score with all-available team", () => {
		const results = aggregateResponses(
			["2025-03-15"],
			[
				{ userName: "Alice", responses: { "2025-03-15": "available" } },
				{ userName: "Bob", responses: { "2025-03-15": "available" } },
				{ userName: "Charlie", responses: { "2025-03-15": "available" } },
			],
			3,
		);

		expect(results[0].score).toBe(6); // 3×2
		expect(results[0].noResponse).toBe(0);
	});
});
