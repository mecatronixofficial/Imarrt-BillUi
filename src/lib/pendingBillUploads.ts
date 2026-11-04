/**
 * Hands bill files picked on the Purchase Bills register to the new-bill form.
 * Files can't travel in a URL, so they wait here across the client-side navigation.
 */
let pending: File[] = [];

export function setPendingBillUploads(files: File[]) {
  pending = files;
}

/** Returns the waiting files once, then forgets them. */
export function takePendingBillUploads() {
  const files = pending;
  pending = [];
  return files;
}
