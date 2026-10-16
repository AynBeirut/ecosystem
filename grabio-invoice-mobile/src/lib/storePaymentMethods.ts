export type StorePaymentChoice = { id: string; label: string };

function knownFlag(source: unknown, key: string): boolean | undefined {
  if (!source || typeof source !== 'object' || !Object.prototype.hasOwnProperty.call(source, key)) return undefined;
  return Boolean((source as Record<string, unknown>)[key]);
}

function isOn(flags: Array<boolean | undefined>, fallback: boolean): boolean {
  const set = flags.filter((flag): flag is boolean => flag !== undefined);
  if (!set.length) return fallback;
  return set.some(Boolean);
}

/** Active methods from store admin payment settings. Wish only when that gateway is on. */
export function activeStorePaymentMethods(profile: Record<string, unknown> | null): StorePaymentChoice[] {
  const methods = profile?.paymentMethods;
  const gateways = profile?.paymentGatewaySettings;
  const rows = [
    {
      id: 'cash',
      label: 'Cash',
      on: isOn([knownFlag(methods, 'cashOnDelivery'), knownFlag(gateways, 'cashOnDeliveryEnabled')], true),
    },
    {
      id: 'bank',
      label: 'Bank',
      on: isOn([knownFlag(methods, 'bankTransfer'), knownFlag(gateways, 'bankTransferEnabled')], true),
    },
    {
      id: 'card',
      label: 'Card',
      on: isOn(
        [knownFlag(methods, 'creditCard'), knownFlag(methods, 'debitCard'), knownFlag(gateways, 'stripeEnabled')],
        true,
      ),
    },
    {
      id: 'omt',
      label: 'OMT',
      on: isOn([knownFlag(gateways, 'omtEnabled')], true),
    },
    {
      id: 'wish',
      label: 'Wish',
      on: isOn([knownFlag(gateways, 'whishEnabled')], false),
    },
  ];
  const active = rows.filter((row) => row.on).map(({ id, label }) => ({ id, label }));
  return active.length ? active : rows.filter((row) => row.id !== 'wish').map(({ id, label }) => ({ id, label }));
}
