# Contributing Guidelines & Coding Standards

## Forbidden Patterns

### ❌ Eager parseInt in onChange Handlers

**Never** use `parseInt(e.target.value) || defaultValue` inside an `onChange` handler.

```tsx
// ❌ FORBIDDEN — resets the field to the default value while the user is still typing
onChange={(e) => setState({ expiryAlertDays: parseInt(e.target.value) || 30 })}
```

**Why it's forbidden**: `parseInt('')` returns `NaN`, so `NaN || 30` evaluates to `30`. This causes the field to silently reset to the default every time the user clears the input or starts typing a new number.

**Required pattern** — use `onChange` to store the raw value, `onBlur` to validate and apply the fallback:

```tsx
// ✅ CORRECT — allow free typing; validate and apply default only when the user leaves the field
onChange={(e) =>
  setState({
    expiryAlertDays: e.target.value === '' ? ('' as any) : parseInt(e.target.value),
  })
}
onBlur={(e) =>
  setState({ expiryAlertDays: parseInt(e.target.value) || 30 })
}
```

This rule applies to **all numeric input fields** with a default/fallback value, not just `expiryAlertDays`.

---

## Double-Submit / Race-Condition Guard

Always set the `isSaving` (or equivalent guard state) flag as the **first line** after the early-return check, before any async calls.

```tsx
// ❌ WRONG — async call between guard check and flag set creates a race window
if (isSaving) return;
await assertCanCreateProduct();
setIsSaving(true); // too late

// ✅ CORRECT — flag is set immediately, closing the window
if (isSaving) return;
setIsSaving(true);
await assertCanCreateProduct();
```

---

## General Notes

- All public-facing form inputs that accept numbers must use the `onChange` / `onBlur` split described above.
- Never bypass TypeScript strict-null checks with `as any` unless the workaround is explicitly necessary and commented.
