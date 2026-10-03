// @polsia:user-owned — pure owner identity policy shared by server code and tests.

export function isVerifiedPageOwner(
  email: string | null | undefined,
  emailVerified: boolean | null | undefined,
  ownerEmail: string | null | undefined,
) {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedOwnerEmail = ownerEmail?.trim().toLowerCase();
  return Boolean(
    emailVerified === true &&
      normalizedEmail &&
      normalizedOwnerEmail &&
      normalizedEmail === normalizedOwnerEmail,
  );
}
