# grabio.space mail deliverability fix — 30 Jul 2026

## Server fixes applied (VPS 104.207.71.117)

| Fix | Status |
|-----|--------|
| HTTPS webmail cert (`mail.grabio.space:443`) | ✅ Valid until Sep 18 2026 |
| Outbound HELO → `mail.grabio.space` (not bad PTR) | ✅ `/etc/mailhelo` |
| **DKIM signing re-enabled** | ✅ `/etc/exim/exim.pl` was `return 0` — mail sent **unsigned** |
| Outbound route | ✅ `dkim_lookuphost` + `dkim_remote_smtp` verified |

## Still requires DNS / host (blocks full inbox delivery)

### 1. PTR (Namecheap VPS panel — needs 2FA)
- Current: `104.207.71.117` → `sich-yap.vpsrdns.web-hosting.com`
- Request: `104.207.71.117` → `mail.grabio.space`
- Panel: https://vpspanel.web-hosting.com (user `u_2060261`)

### 2. SPF + DMARC (Namecheap domain DNS — grabio.space)
DNS authority: `dns1.registrar-servers.com` (not VPS zone file).

| Record | Current | Change to |
|--------|---------|-----------|
| `@` TXT (SPF) | `v=spf1 ip4:104.207.71.117 ~all` | `v=spf1 ip4:104.207.71.117 -all` |
| `_dmarc` TXT | `p=none` | `v=DMARC1; p=quarantine; rua=mailto:admin@grabio.space; adkim=s; aspf=s` |
| `default._domainkey` TXT | OK (matches server key) | no change |

Panel: Namecheap → Domain List → grabio.space → Advanced DNS

## Verification
```bash
# HELO on outbound
grep "EHLO mail.grabio.space" /var/log/exim/main.log | tail -1

# DKIM route
grep "dkim_remote_smtp" /var/log/exim/main.log | tail -1

# Public DNS
dig +short grabio.space TXT
dig +short _dmarc.grabio.space TXT
dig +short -x 104.207.71.117
```

## Backups
- `/etc/exim/exim.pl.bak.20260730094110`
- `/etc/exim/exim.conf.bak.*`
