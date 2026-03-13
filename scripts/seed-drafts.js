// Mock data seeding script for draft events prototype
// Run this in the browser console after loading the app

const mockDrafts = [
	{
		title: "Monday Scene Work",
		eventType: "rehearsal",
		date: "2025-02-03",
		startTime: "19:00",
		endTime: "21:00",
		location: "Studio A - Downtown",
		description: "Focus on character development and emotional beats",
		timezone: "America/Los_Angeles",
	},
	{
		title: "Wednesday Improv Practice",
		eventType: "rehearsal",
		date: "2025-02-05",
		startTime: "18:30",
		endTime: "20:30",
		location: "Studio B - Westside",
		description: "Long-form practice and game work",
		timezone: "America/Los_Angeles",
	},
	{
		title: "Friday Run-Through",
		eventType: "rehearsal",
		date: "2025-02-07",
		startTime: "19:30",
		endTime: "21:30",
		location: "Main Theater",
		description: "Full run-through of the show with blocking",
		timezone: "America/Los_Angeles",
	},
	{
		title: "Saturday Matinee Show",
		eventType: "show",
		date: "2025-02-08",
		startTime: "14:00",
		endTime: "15:30",
		location: "Main Theater",
		description: "Family-friendly improv comedy show",
		callTime: "13:00",
		timezone: "America/Los_Angeles",
	},
	{
		title: "Saturday Evening Show",
		eventType: "show",
		date: "2025-02-08",
		startTime: "20:00",
		endTime: "21:30",
		location: "Main Theater",
		description: "Late night improv comedy show",
		callTime: "19:00",
		timezone: "America/Los_Angeles",
	},
	{
		title: "Team Building Social",
		eventType: "other",
		date: "2025-02-10",
		startTime: "18:00",
		endTime: "20:00",
		location: "The Green Room Bar",
		description: "Casual hangout and team bonding",
		timezone: "America/Los_Angeles",
	},
];

// Function to seed drafts
function seedDrafts(groupId) {
	const existingDrafts = JSON.parse(localStorage.getItem("greenroom_draft_events") || "[]");
	
	const newDrafts = mockDrafts.map(draft => ({
		...draft,
		id: crypto.randomUUID(),
		groupId,
		createdAt: new Date().toISOString(),
	}));
	
	const allDrafts = [...existingDrafts, ...newDrafts];
	localStorage.setItem("greenroom_draft_events", JSON.stringify(allDrafts));
	
	console.log(`✅ Seeded ${newDrafts.length} draft events!`);
	console.log("Reload the page to see the drafts.");
}

// Export for use
if (typeof window !== "undefined") {
	window.seedDrafts = seedDrafts;
	console.log("📋 Draft seeder loaded! Call seedDrafts('your-group-id') to populate mock data.");
	console.log("Example: seedDrafts('your-group-id')");
}
