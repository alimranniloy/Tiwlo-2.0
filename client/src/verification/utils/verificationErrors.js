export const VERIFICATION_CONNECTION_ERROR =
  "We couldn't reach the verification server, so it couldn't return a result. This does not mean the document is fake or that the faces did not match. Check your internet connection and try again.";

export function isVerificationFetchError(error) {
  return error instanceof TypeError && /fetch/i.test(error.message);
}
