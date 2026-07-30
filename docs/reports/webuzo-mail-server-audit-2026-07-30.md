# Webuzo Mail Server Audit — Server Manager Report

**Date:** 30 July 2026  
**Prepared for:** VPS / Webuzo server administrator  
**Prepared by:** Anwar — E-MOOVE / Grabio  
**Server IP:** `104.207.71.117`  
**Panel:** Webuzo 4.x (end-user Automatic SSL)  
**Host PTR (reverse DNS):** `sich-yap.vpsrdns.web-hosting.com` ❌  

---

## 1. Executive summary

Outbound and webmail traffic for **multiple domains** on this server show **email deliverability and trust issues**. This is **not limited to grabio.space**.

Primary causes (server-wide):

1. **Reverse DNS (PTR) does not match mail hostnames** — affects all domains on this IP.
2. **TLS certificate mismatch** — Webuzo panel shows renewed certs, but **live services still serve older expired certificates** on some domains/ports.
3. **SMTP (port 587) and HTTPS (port 443) using different certificate lifetimes** on at least one domain (`emoove.co`) — indicates Postfix/Dovecot not reloaded or not bound to renewed certs.
4. **Weak DNS authentication** on most domains: SPF soft-fail (`~all`), DMARC `p=none`.
5. **Shared IP** with many mail domains — reputation risk when any tenant sends spam.

**Requested action:** Fix server-level mail TLS, PTR, auto-renewal, and Postfix/Dovecot cert sync for **all tenants** on `104.207.71.117`.

---

## 2. Evidence — live certificate scan (30 Jul 2026)

External check from the public internet (openssl + DNS) — **16 domains on `104.207.71.117`:**

| Domain | HTTPS :443 | SMTP :587 | Status |
|--------|------------|-----------|--------|
| **grabio.space** | ❌ EXPIRED 27 Jul 2026 | ❌ EXPIRED 27 Jul 2026 | **Critical** |
| **emoove.co** | ✅ 17 Sep 2026 | ❌ EXPIRED 15 Jul 2026 | **SMTP broken** |
| **deesignden.com** | ❌ FAIL | ❌ FAIL | No mail TLS |
| **itbng.com** | ❌ FAIL | ❌ FAIL | No mail TLS |
| **oakuralb.com** | ✅ 17 Sep 2026 | ❌ FAIL | SMTP not serving TLS |
| aynbeirut.com | ✅ 13 Sep 2026 | ✅ 13 Sep 2026 | OK |
| habke.art | ✅ 13 Sep 2026 | ✅ 13 Sep 2026 | OK |
| lfh-lb.org | ✅ 13 Sep 2026 | ✅ 13 Sep 2026 | OK |
| hoperailway.org | ✅ 13 Sep 2026 | ✅ 13 Sep 2026 | OK |
| limen-group.com | ✅ 6 Oct 2026 | ✅ 6 Oct 2026 | OK |
| grabio.online | ✅ 2 Oct 2026 | ✅ 4 Jul 2027 | OK |
| mirsat.org | ✅ 18 Oct 2026 | ✅ 18 Oct 2026 | OK |
| matrixbs.me | ✅ 17 Sep 2026 | ✅ 17 Sep 2026 | OK |
| yellowecoenergy.com | ✅ 17 Sep 2026 | ✅ 17 Sep 2026 | OK |
| pierreazar.com | ✅ 22 Sep 2026 | ✅ 22 Sep 2026 | OK |
| agora-mena.com | ✅ 17 Oct 2026 | ✅ 17 Oct 2026 | OK |

**Summary:** 5 domains with problems (grabio, emoove SMTP, deesignden, itbng, oakuralb SMTP); 11 OK on both ports.

**grabio.space panel vs reality:**  
Webuzo Automatic SSL lists `grabio.space` with certificate for `mail.grabio.space`, valid until **18 Sep 2026**, next renew **18 Aug 2026**.  
Live server still presents Let's Encrypt **R13** cert expired **27 Jul 2026**.  
→ **Renewal succeeded in panel but Apache/Postfix/Dovecot were not updated or not restarted.**

---

## 3. Server-wide DNS / authentication issues

### 3.1 Reverse DNS (PTR) — **all domains affected**

| Item | Value |
|------|--------|
| IP | 104.207.71.117 |
| Current PTR | `sich-yap.vpsrdns.web-hosting.com` |
| Expected PTR | `mail.<primary-domain>` or at minimum consistent FCrDNS with sending host |

Gmail, Outlook, and Yahoo penalize mail when **forward-confirmed rDNS** fails.

**Request:** Set PTR for `104.207.71.117` → `mail.grabio.space` (or dedicated outbound hostname agreed with host).

### 3.2 SPF — soft fail on most domains

Example `grabio.space`:  
`v=spf1 ip4:104.207.71.117 ~all`  

`~all` = softfail (weak). Recommended after testing: `-all`.

Same pattern on `aynbeirut.com`, `emoove.co`, `habke.art`, etc.

### 3.3 DMARC — monitoring only

Most domains: `v=DMARC1; p=none` — no enforcement, limited trust signal.

Recommend staged rollout: `p=quarantine` → `p=reject` with `rua` reporting.

### 3.4 DKIM

`default._domainkey` TXT records exist on sampled domains.  
**Not verified:** whether Postfix/Exim on Webuzo **signs outbound mail** with these keys (panel DNS alone is insufficient).

**Request:** Confirm OpenDKIM / Rspamd / Exim DKIM signing enabled and aligned with `default` selector.

---

## 4. Webuzo-specific issues observed

1. **Automatic SSL cron / apply step** — certs renew in UI but old certs still served (grabio.space).
2. **Email SSL/TLS binding** — "Configure LE Certificate → Use for Email SSL/TLS" may not be applied globally after renew.
3. **HTTP webmail redirect** — `http://mail.grabio.space` redirects to `https://grabio.space/___webuzo_subdomain_webmail/` (non-standard path); confuses users and may break webmail vhost mapping.
4. **Multi-tenant shared IP** — 25+ domains in one Automatic SSL list on same VPS; one misconfigured vhost affects perception of entire IP.

---

## 5. Impact on end users

| Symptom | Cause |
|---------|--------|
| Browser "Not secure" on `https://mail.*` | Expired or stale TLS on webmail vhost |
| Mail lands in **Spam/Junk** | PTR mismatch + weak SPF/DMARC + possible stale SMTP TLS + shared IP reputation |
| Intermittent issues per domain | Some vhosts renewed (aynbeirut) while others stale (grabio, emoove SMTP) |

---

## 6. Recommended remediation (priority order)

### P0 — Immediate (same day)

- [ ] **Re-apply and reload TLS for all mail vhosts** on `104.207.71.117`  
  - Webuzo: SSL → Automatic SSL → **Renew/Install** per domain  
  - Enable **Use certificate for Email SSL/TLS**  
  - **Restart Apache + Postfix + Dovecot** (or full EMPS stack)
- [ ] Fix **grabio.space** and **emoove.co** SMTP cert (587) — confirmed expired on live scan
- [ ] Verify with:  
  `openssl s_client -connect mail.DOMAIN:443 -servername mail.DOMAIN`  
  `openssl s_client -starttls smtp -connect mail.DOMAIN:587 -servername mail.DOMAIN`

### P1 — Within 48 hours

- [ ] **Set PTR** for `104.207.71.117` to proper mail hostname (hosting provider ticket)
- [ ] Audit **Let's Encrypt / Zero SSL auto-renew cron** (`/var/webuzo/log/lets_encrypt`) — ensure renew applies to Postfix, not only Apache
- [ ] Confirm **outbound DKIM signing** enabled server-wide

### P2 — Within 2 weeks (per domain, coordinated with owners)

- [ ] Tighten SPF: `~all` → `-all` (after confirm all senders listed)
- [ ] DMARC: `p=none` → `p=quarantine` with aggregate reports
- [ ] Consider **transactional relay** (SendGrid/Mailgun/SES) for app-generated mail (Firebase Functions SMTP) to isolate app traffic from shared VPS IP

---

## 7. CLI reference for server admin (root)

```bash
# Renew single domain
/usr/local/emps/bin/php /usr/local/webuzo/cli.php --lets_encrypt --action=renew --domain=grabio.space

# Renew all
/usr/local/emps/bin/php /usr/local/webuzo/cli.php --lets_encrypt --action=renew_all

# Logs
tail -100 /var/webuzo/log/lets_encrypt
```

After renew: restart mail + web stack via Webuzo Services or:

```bash
# Example — exact service names may vary on Webuzo EMPS
systemctl restart httpd postfix dovecot
```

---

## 8. Domains on this server (from Webuzo Automatic SSL — 30 Jul 2026)

Accounts include (non-exhaustive): aynbeirut.com, emoove.co, grabio.space, habke.art, hoperailway.org, lfh-lb.org, masehahoura.com, shecanlb.com, limen-group.com, indigo-lb.com, oakuralb.com, mirsat.org, matrixbs.me, yellowecoenergy.com, pierreazar.com, grabio.online, agora-mena.com, itbng.com, deesignden.com, and others.

**All share IP `104.207.71.117` and the same PTR problem.**

---

## 9. Contact

**Reporter:** Anwar Abou Hassan  
**Email:** anwar.abouhassan@gmail.com / support@grabio.space  
**Primary affected production domain:** grabio.space (transactional SMTP via `mail.grabio.space:587`)

---

*Report generated from live external DNS and TLS probes on 30 July 2026. No panel login was used; Webuzo screenshot data provided by client cross-checked against openssl results.*
