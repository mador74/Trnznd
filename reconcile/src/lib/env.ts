/**
 * True in the build published as a claude.ai artifact (VITE_HOSTED_PREVIEW=1). That host
 * blocks calls to outside sites, so blockchain sync is switched off there.
 */
export const HOSTED = import.meta.env.VITE_HOSTED_PREVIEW === '1';
