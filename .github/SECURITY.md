# Security

arrstack is a small homelab installer maintained by one person in their spare time.
It is not an enterprise product. There is no bug bounty, no SLA, and no paid
support tier. What you get is a human who cares and will respond when they can.

A note on CVEs: most bugs here are not going to get a CVE ID, and reporters
should not expect one. If something is genuinely a vulnerability with real-world
impact on homelab users (RCE in the installer, credential leak, privilege
escalation out of the install dir), we will request one. If it is a hardening
suggestion or a low-impact issue, it will be fixed and credited in the
changelog, without a CVE.

## How to report a vulnerability

Email **security@lavx.io** with:

- a description of the issue,
- how to reproduce it,
- what an attacker could do with it.

Please do not open a public GitHub issue for security reports. If you prefer a
signed message, ask for a PGP key in the first email and one will be provided.

## What to expect

- Acknowledgement within 7 days.
- A first assessment within 14 days.
- Coordinated disclosure if a fix is needed. You will be credited unless you ask
  not to be.

## In scope

- The installer binary itself (`arrstack`).
- The scripts and templates it writes to disk.
- The default Docker Compose rendering and exposed ports.

## Out of scope

- Vulnerabilities in upstream projects (Jellyfin, Sonarr, Radarr, Prowlarr,
  qBittorrent, Bazarr, Jellyseerr, Caddy, FlareSolverr, Recyclarr, Trailarr).
  Report those upstream, please.
- Anything that requires an attacker to already have root on the host.
- DMCA, copyright, or media licensing concerns. This project installs open source
  software; what you do with it is between you and your local laws. Please do not
  file those reports here.

Thanks for keeping homelabs safer.
