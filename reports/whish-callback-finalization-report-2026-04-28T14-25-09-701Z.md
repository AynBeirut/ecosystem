# Whish Callback & Finalization Validation Report

Generated at: 2026-04-28T14:25:06.646Z
Project: market-flow-7b074
Stores scanned: 7
Stores with Whish credentials: 1

## Store Av22LKyet8QmVcu9b8Njz1HVfoy1

Status: FAIL
Score: 4/6 (67%)
Whish orders scanned: 1
Paid Whish orders: 0
Failed Whish orders: 1

| Check | Result | Detail |
| --- | --- | --- |
| credentials_present | PASS | Channel, secret, and website URL are configured. |
| credentials_live_like | PASS | Credentials do not match sandbox/test patterns. |
| whish_paid_orders_exist | WARN | No paid Whish orders found yet. |
| paid_orders_finalized | WARN | No paid Whish orders to validate finalization. |
| callback_urls_recorded | PASS | 1/1 Whish order(s) include success/failure callback URLs. |
| failure_path_observed | PASS | 1 failed/canceled Whish order(s) found. |

## Summary

Stores passing validation: 0/1