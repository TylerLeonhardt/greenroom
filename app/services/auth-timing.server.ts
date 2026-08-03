import bcrypt from "bcryptjs";

const DUMMY_HASH = "$2a$12$000000000000000000000uGPOBOBOBOBOBOBOBOBOBOBOBOBOBOBO";

export function comparePasswordWithHash(
	password: string,
	passwordHash: string | null | undefined,
): Promise<boolean> {
	return bcrypt.compare(password, passwordHash ?? DUMMY_HASH);
}

export async function performDummyHashComparison(value: string): Promise<void> {
	await bcrypt.compare(value, DUMMY_HASH);
}
