let locked = false;

export function isLocked() {
  return locked;
}

export function acquire() {
  if (locked) return false;
  locked = true;
  return true;
}

export function release() {
  locked = false;
}

