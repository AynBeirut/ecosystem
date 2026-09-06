import type { Permission, PermissionStatus } from 'react-native';
import { PermissionsAndroid } from 'react-native';

/** Android allows only one permission dialog at a time — queue all requests. */
let chain = Promise.resolve();

export function runAndroidPermissionRequest<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function requestAndroidPermission(
  permission: Permission,
  rationale?: {
    title: string;
    message: string;
    buttonPositive: string;
    buttonNegative?: string;
  },
): Promise<PermissionStatus> {
  return runAndroidPermissionRequest(() => PermissionsAndroid.request(permission, rationale));
}
