# Time Capsule — Private Edition

**Your present. Preserved for your future.**

**Live website:** https://timecapsule.runs-at.dev/
**Source code:** https://github.com/ZenxPrince/time-capsule-private-edition

A browser-based time capsule for writing a message, encrypting it locally, and choosing when it becomes available. The application uses HTML, CSS, vanilla JavaScript, the Web Crypto API, and browser LocalStorage. It has no account system, backend, cloud sync, build step, or runtime dependency.

## Features

- AES-256-GCM authenticated encryption through the Web Crypto API
- PBKDF2-SHA-256 key derivation with 210,000 iterations
- A fresh 16-byte random salt and 12-byte random IV per capsule
- SHA-256 ciphertext fingerprint displayed when a capsule is opened
- In-place countdown updates; cards are not rebuilt every second
- Password-protected decryption after the scheduled unlock time
- Browser-local encrypted storage
- Responsive interface with reduced-motion support
- Demo capsule — password: `demo1234`

## Security architecture

| Layer | Technology | Parameters |
|---|---|---|
| Encryption | AES-256-GCM | 256-bit key, 12-byte IV, authentication tag |
| Key derivation | PBKDF2-SHA-256 | 210,000 iterations, 16-byte salt |
| Randomness | `crypto.getRandomValues()` | Browser cryptographically secure random generator |
| Fingerprint | SHA-256 | Hash of the encoded ciphertext, recalculated on open |
| Storage | LocalStorage | Encrypted capsule payload and metadata |

### Honest limitations

- This is client-side encryption and has not undergone an independent security audit.
- LocalStorage is accessible to JavaScript executing on the same origin. A successful XSS attack could compromise the application context.
- Anyone with direct access to the browser session and its stored data may be able to interfere with the application.
- Passwords are not stored and cannot be recovered. Losing a password means losing access to that capsule.
- The SHA-256 fingerprint is a comparison aid, not a digital signature or independent proof of authenticity. AES-GCM provides authenticated decryption.
- Capsules exist only in the browser profile where they were created. Clearing site data or changing devices can make them unavailable.
- Web Crypto requires a secure context: use HTTPS or `localhost`, not `file://`.

## Run locally

1. Open this folder in a terminal.
2. Start a local server:

   ```bash
   py -m http.server 8000
   ```

   If `py` is unavailable, use `python -m http.server 8000`.

3. Visit `http://localhost:8000`.

You can also use VS Code Live Server. Do not open `index.html` directly with `file://`.

## How it works

1. Enter a title, message, future unlock date, and password.
2. The browser derives an AES key from the password and a capsule-specific random salt.
3. The message is encrypted using AES-256-GCM and saved as ciphertext with its salt, IV, and fingerprint.
4. Once the unlock time has passed, enter the password to decrypt the message locally.

## Compatibility note

The application retains the existing `tc_capsules_v1` LocalStorage key and capsule payload fields so previously created v1 capsules remain readable in the same browser profile.

## Technology

- HTML5, CSS3, vanilla JavaScript
- Web Crypto API (`crypto.subtle`)
- LocalStorage
- No frameworks, build tools, or third-party runtime dependencies

## License

MIT — see [LICENSE](LICENSE).

## Interface and motion

The interface uses a dark, responsive glass-surface system with cyan/violet ambient lighting, a lightweight canvas line-wave/perspective-ray background, cursor-position card highlights, a restrained pointer trail, and reduced-motion handling. The motion layer is implemented in vanilla JavaScript and CSS; there is no WebGL simulation or external animation runtime.

The interface is illustrative and does not represent live cryptographic telemetry. The values shown in the security section match the implementation parameters above. The demo capsule is seeded locally for first-run exploration; its demonstration password is `demo1234` and should not be reused for private content.
