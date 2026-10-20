# Production upload capacity audit — Quick Add 5 × 10 MB images

Round: QUICK ADD TL OVERRIDE + HARDENING AUDIT — Session B (audit only)
Date: 2026-10-20
Base: `main` `076e2aeb135c5bc8d232beae35210c4742d461a2` (code analysed); production app `f7184f1`
Scope: no application code changed, no production config changed, no diagnostic file created.

---

## 1. Verdict

**FAIL at PHP defaults; UNVERIFIED for production.** The production values could not be read (cPanel was
not signed in, and this audit does not enter credentials or create a probe file).

What the code needs, from measurement (§4):

| Directive | Needed for 5 × 10 MiB | PHP / cPanel EA4 default | Verdict at the default |
|---|---|---|---|
| `upload_max_filesize` | ≥ 10M (≥ 20M for the 20 MB PDF path) | 2M | **FAIL** (each file gets `UPLOAD_ERR_INI_SIZE`) |
| `post_max_size` | **> 50M**, at least 51M. Exactly `50M` fails by about 1 KB | 8M | **FAIL** (`$_FILES` empty) |
| `memory_limit` | **≥ 200M** measured, so 256M | 128M | **FAIL** (fatal at `ai_extract.php:820`) |
| `max_file_uploads` | ≥ 5 | 20 | PASS |
| `max_input_time` | not a constraint behind LiteSpeed (§5) | 60 (or -1) | PASS (expected) |
| `max_execution_time` | the script sets 180 itself; on Linux this counts CPU time only | 30 | PASS (expected) |
| LiteSpeed / Apache / ModSecurity body limit | ≥ about 51 MB | host-defined | **not determinable** |

Turn this into PASS / MARGINAL / FAIL once the owner reads the real values (§7):

- **PASS**: `upload_max_filesize` ≥ 10M, `post_max_size` ≥ 51M, `memory_limit` ≥ 256M, and the host
  confirms no request-body limit below about 51 MB.
- **MARGINAL**: `memory_limit` between 200M and 255M (less than 56 MiB headroom over the measured peak),
  or `post_max_size` between 51M and 55M.
- **FAIL**: any value below those minimums. With `memory_limit = 128M` the most that fits is three full-size
  10 MiB images (§4.3), whatever `post_max_size` is.

---

## 2. Values found and their sources

| Item | Value | Source | Status |
|---|---|---|---|
| Web server | LiteSpeed | `Server: LiteSpeed` response header, `GET https://quo.dnchardware.com/login.php` (public, 2026-10-20) | **found** |
| PHP version | **8.4.26** | `X-Powered-By: PHP/8.4.26` on the same response. The brief said 8.4.24, so the host has applied a patch update since then | **found** |
| `error_log` / `log_errors` | `/home5/dnchardw/logs/php.error.log`, `On` | repo `php.ini` (cPanel-generated copy; `.cpanel.yml` never deploys it) | found for the repo copy; the live copy is assumed identical but not confirmed |
| `upload_max_filesize` | — | not in the repo `php.ini`; cPanel not accessible | **not determinable** |
| `post_max_size` | — | same | **not determinable** |
| `memory_limit` | — | same | **not determinable** |
| `max_file_uploads` | — | same | **not determinable** |
| `max_input_time` | — | same | **not determinable** |
| `max_execution_time` | — (runtime `set_time_limit(180)` in `ai_extract.php:1164`) | code | ini value **not determinable** |
| `display_errors` (Session C's question) | — | same | **not determinable** (§6.3 covers why it matters here) |
| LiteSpeed max request body / Apache `LimitRequestBody` / ModSecurity `SecRequestBodyLimit` | — | host level; a cPanel user account cannot see it | **not determinable** |
| CloudLinux LVE memory (PMEM) | — | cPanel » Metrics » Resource Usage | **not determinable** |

Deployment facts (from `.cpanel.yml`):

- Only the files listed in `APPFILES` plus `assets/icons/*` are copied. `php.ini` is in `PROTECTED` and is never
  overwritten. `.user.ini` and `.htaccess` are not deployed at all; the repository does not contain either one.
- Live PHP settings therefore come only from the server: the docroot `php.ini` that MultiPHP INI Editor writes,
  any `.user.ini` or `.htaccess` created on the server, and the host's global ini. A deploy cannot change them.

Weak evidence about the docroot (public HTTP status codes only):

| Path | Status | Reading |
|---|---|---|
| `/php.ini` | 403 | a made-up `/zz-nonexistent-audit.ini` returns 404, so `php.ini` probably exists and is protected (consistent with `.cpanel.yml`) |
| `/.user.ini` | 403 | probably a name-based deny rule; existence not proven |
| `/.htaccess` | 403 | `.ht*` is always denied; existence not proven |

Attempted and stopped: `https://dnchardware.com:2083/` opened the cPanel login page in the built-in browser.
The session is not signed in. Signing in needs the owner's password, which this audit does not enter, so the
MultiPHP INI Editor was not reached. Nothing was clicked or changed.

---

## 3. Request path (code on `main`)

### 3.1 Client (`index.php`)

- `WQA_AI_MAX_IMG = 10*1048576` and `WQA_AI_MAX_PDF = 20*1048576` (`index.php:15529`).
- `wqaAddFiles()` (`index.php:15632`) checks each file only: type, at most `WQA_AI_MAX_FILES` images, and
  `f.size > WQA_AI_MAX_IMG` is refused. **There is no check on the total size.** Five files of exactly 10 MiB
  each pass.
- `wqaAnalyze()` (`index.php:15753`): with more than one image, each file is sent as `files[]` in a
  `FormData`, plus an optional `note`. The request is
  `fetch('ai_extract.php',{method:'POST',body:fd})` with no timeout and no compression or downscaling, so the
  original file bytes go up unchanged.
- Response: `res.json()` inside a try. If that fails, `j=null`. `!j || !j.ok` →
  `wqaMsg(dcServerError(j))` → **"Could not analyze this file. Try again or paste the text manually."** when
  `j` is null, or the localised text for `j.error` (`DC_ERR`, `index.php:6026`). The HTTP status is not
  examined.

### 3.2 Server (`ai_extract.php`)

1. `dc_require_api_login()` checks the session cookie, so it works even when the body was discarded.
2. `$hasMulti = isset($_FILES['files'])`, `$hasText = isset($_POST['text'])`. If neither or both is set →
   400 `no_file` (`:1155`).
3. `set_time_limit(180)` (`:1164`).
4. `ai_validate_uploads($_FILES['files'])` (`:791`) calls `ai_validate_upload()` for each entry (`:101`):
   `UPLOAD_ERR_INI_SIZE` / `FORM_SIZE` → `too_large`; finfo MIME check; size ≤ `AI_MAX_IMAGE_BYTES`
   (10,485,760); then **`file_get_contents()` reads the whole file into memory** (`:143`). All five raw
   strings stay alive in `$upload['parts'][i]['bytes']`.
5. The temp files are unlinked (`:1176`).
6. `ai_build_payload()` (`:829`) → `ai_file_part()` (`:820`) for each image:
   `'data:'.$mime.';base64,'.base64_encode($bytes)`. That makes one base64 temporary plus one concatenated
   data URL per image while all five raw strings are still held.
7. `unset($upload['bytes'], $upload['text'], $upload['parts'])` (`:1195`) frees the raw bytes after the
   payload is complete.
8. `ai_call_openai()` (`:908`): `CURLOPT_POSTFIELDS => json_encode($payload)`. The whole JSON body is
   built as one PHP string (no `JSON_UNESCAPED_SLASHES`, so every `/` in base64 becomes `\/`). PHP's curl
   extension passes a string body to libcurl with `CURLOPT_COPYPOSTFIELDS`, so **libcurl makes its own
   malloc copy** of the body. That copy sits outside the Zend memory manager and does not count against
   `memory_limit`, but it does count against process RSS and the LVE limit. `$payload` stays alive during
   `curl_exec` because it is the caller's variable. `CURLOPT_TIMEOUT 120`.

---

## 4. Arithmetic

### 4.1 Request body (client → LiteSpeed → PHP)

| Part | Bytes |
|---|---|
| 5 files × 10,485,760 | 52,428,800 (= exactly 50 MiB = `50M` in php.ini units) |
| Multipart framing per file part: boundary line (about 42), `Content-Disposition: form-data; name="files[]"; filename="…"` (about 60 plus the name length), `Content-Type: image/jpeg` (about 26), blank lines and CRLFs (about 6) | about 150–250 × 5 |
| Closing boundary | about 44 |
| Optional `note` part (≤ 300 characters plus framing) | ≤ about 450 |
| **Total body** | **about 52,430,000–52,431,000 bytes** |

PHP compares the whole `Content-Length` with `post_max_size`. **`post_max_size = 50M` (52,428,800) is
exceeded by about 1–2 KB** at the maximum allowed input, so it must be at least `51M`. `upload_max_filesize` is
compared per file (`size > limit`), so `10M` exactly admits a 10,485,760-byte file.

PHP request parsing: for `multipart/form-data`, PHP's RFC 1867 handler streams each file part to a temp file
in `upload_tmp_dir` and does not buffer the body in memory (`php://input` is not populated for multipart).
Parsing therefore costs about 50 MiB of temp disk, not memory. LiteSpeed also buffers the request body to its
own swap or temp area before handing the request to lsphp (§5).

### 4.2 Memory inside `ai_extract.php`, theory

- base64 per image: `4 × ceil(10,485,760 / 3)` = **13,981,016 bytes** (13.33 MiB, × 4/3). Five images give
  69,905,080 bytes.
- JSON body: base64 plus about 1.6 % for `\/` escaping (1 in 64 base64 characters is `/`), plus instructions
  and schema. **Measured: 71,034,560 bytes (67.7 MiB).**
- Zend MM allocates anything over 2 MiB as a "huge" block rounded up to a 2 MiB multiple, and
  `memory_limit` is checked against that **real** size. So a 10 MiB string costs 12 MiB, and a 13.33 MiB
  string costs 14 MiB.

Live data at the worst point, while the 5th data URL is built: raw 5 × 12 = 60 MiB, data URLs 1–4 = 4 × 14 =
56 MiB, base64 temporary 14 MiB, concatenation target 14 MiB. That is **144 MiB**. During `json_encode` the
payload is about 70 MiB, and the growing JSON buffer is reallocated as each image is appended. When a huge
block cannot grow in place, the old and new buffers exist together for a moment, which can reach **about
200 MiB real**.

### 4.3 Memory, measured

Harness: the real `ai_extract.php` functions (`AI_EXTRACT_TEST` defined, so no network and no endpoint body),
fed N synthetic 10,485,760-byte files with a PNG header and random content (incompressible, so base64 is
realistic). The harness runs the same sequence as the endpoint: `ai_validate_uploads` → `ai_build_payload` →
`unset(parts)` → `json_encode`. Local PHP 8.3.30 CLI, Windows x64 ZTS. The script stayed in the scratchpad
and was not committed.

| Images (10 MiB each) | JSON body | Peak `memory_get_peak_usage()` | **Peak real (what `memory_limit` sees)** | Fits 128M? | Fits 256M? |
|---|---|---|---|---|---|
| 1 | 13.6 MiB | 40.6 MiB | 44 MiB | yes | yes |
| 2 | 27.1 MiB | 66.6 MiB | 74 MiB | yes | yes |
| 3 | 40.7 MiB | 92.6 MiB | 116 MiB | yes (12 MiB spare) | yes |
| 4 | 54.2 MiB | 118.6 MiB | 170 MiB | **no** | yes |
| 5 | 67.7 MiB | 144.6 MiB | **198 MiB** | **no** | yes (58 MiB spare) |

`memory_limit` runs with 5 images:

| `memory_limit` | Result |
|---|---|
| 128M | **Fatal**: `Allowed memory size of 134217728 bytes exhausted (tried to allocate 13981064 bytes)` at `ai_extract.php:820` (base64 of an image) |
| 144M | Fatal at `:820` |
| 160M, 176M | Fatal at `json_encode` (`:912` in production; tried to allocate about 54 MiB) |
| 192M | Fatal at `json_encode` (tried to allocate about 67.5 MiB) |
| 200M | completes, peak real 198 MiB |
| 256M | completes |

Caveat: production is PHP 8.4 NTS on Linux. Zend MM's 2 MiB huge-block rounding is the same there. On Linux,
huge blocks can sometimes grow in place, which can lower the `json_encode` transient, so 198 MiB is a
conservative upper estimate and 145 MiB is the hard floor. **`memory_limit` below 160M certainly fails, and 256M
is the smallest round value that clearly passes.**

### 4.4 Process RSS beyond `memory_limit`

While `curl_setopt_array` runs, PHP holds the payload (about 70 MiB) and the JSON string (about 68 MiB), and
libcurl allocates its own about 68 MiB copy. During `curl_exec` this falls to about 70 MiB (PHP) plus 68 MiB
(libcurl). Expect a peak RSS around **270 MiB** for the request, plus the lsphp baseline. CloudLinux LVE
`PMEM` limits on shared plans are often 512 MiB–1 GiB per account across all concurrent PHP processes, so two
simultaneous 5-image analyses could approach that limit. The owner should read the account's PMEM limit
(§7).

### 4.5 Upstream (OpenAI)

The OpenAI image-input guide currently allows up to 512 MB of payload and up to 1,500 images per request, so a
68 MiB JSON body is within its limits. Older copies of the guide said 50 MB. If an older limit were still
enforced, a 5 × 10 MiB request would be rejected upstream (HTTP 400 → `request` → "Could not analyze this
file"), so this is worth watching in `error_log` (`[ai_extract] fail http=400 … size=52428800`). Uploading
68 MiB from the host with `CURLOPT_TIMEOUT 120` needs at least about 5 MB/s of sustained upstream bandwidth
before the model starts working. That is normal for a datacentre but not guaranteed.

---

## 5. Time limits

- `max_execution_time`: the script calls `set_time_limit(180)`. That call works only if `set_time_limit` is
  not in `disable_functions`, and the endpoint works today, so it is not disabled. On Linux, PHP's timer
  measures **CPU time** (ITIMER_PROF), so time spent waiting in `curl_exec` does not count. Base64 and JSON
  for 70 MiB take well under a second of CPU. **Not a constraint.**
- `max_input_time`: LiteSpeed receives the whole request body before it dispatches to lsphp, so the time PHP
  spends parsing input is reading a local buffer, not the client's slow upload. **Not a constraint.** The
  setting would matter only if the host streamed bodies to PHP.
- Not determinable and host-controlled: LiteSpeed connection and keep-alive timeouts while the client uploads
  50 MiB, which takes about 80 s at 5 Mbit/s on mobile, and the lsphp external-app timeout for the first
  response byte, which has to cover upload time plus the model's time (up to 120 s curl). If either is
  shorter than the real duration, the browser gets a non-JSON 5xx and shows "Could not analyze this file".

---

## 6. When a limit is exceeded: what the user sees

### 6.1 `post_max_size` exceeded (for example 5 × 10 MiB with `post_max_size = 50M` or less)

Documented PHP behaviour (php.ini core directives page): when the post data is larger than `post_max_size`,
the `$_POST` and `$_FILES` superglobals are empty. PHP also raises an `E_WARNING` during request startup:
`PHP Warning:  PHP Request Startup: POST Content-Length of N bytes exceeds the limit of M bytes in Unknown on
line 0`. With `log_errors = On` this is written to `/home5/dnchardw/logs/php.error.log`.

Trace through `ai_extract.php`:

1. Login passes, because the session cookie is a header.
2. `$hasMulti = false`, `$hasFile = false`, `$hasText = false` → `$hasFile === $hasText` →
   **HTTP 400 `{"ok":false,"error":"no_file","message":"Send exactly one file or one block of text."}`**
   (`:1155`). The optional `note` is lost too.
3. Client: `dcServerError` maps `no_file` → `errNoFile` → **"Upload exactly one file."**
   (`index.php:5136`; zh: "每次只能上传一个文件。").

**This message is misleading.** The user selected five images within the stated limits and is told to upload
exactly one file. Nothing says the total was too large, and there is no `[ai_extract] reject` line pointing
at size, only `reject no_file` plus PHP's startup warning.

If `display_errors = On` in production, the startup warning HTML (`<br />\n<b>Warning</b>: PHP Request
Startup: POST Content-Length …`) is sent **before** the JSON. `res.json()` then throws, `j=null`, and the
user sees **"Could not analyze this file. Try again or paste the text manually."** This is also misleading,
because retrying cannot help. Depending on `output_buffering`, the 400 status and `Content-Type` header may
also fail with "headers already sent", so the response would be a 200 with a broken body. It would also expose
the server's configured limit to the browser, which is Session C's concern.

### 6.2 `upload_max_filesize` exceeded (body within `post_max_size`)

Each oversized file has `error = UPLOAD_ERR_INI_SIZE` → `too_large` → 400 → **"That file is larger than the
server allows."** This message is **useful and accurate**. It names neither the file nor the limit, though,
and the client's 10 MB rule would not have warned the user in advance.

### 6.3 `memory_limit` exceeded

A fatal error at `ai_extract.php:820` (base64) or `:912` (`json_encode`). The `error_log` gets
`PHP Fatal error:  Allowed memory size of … exhausted …`. With `display_errors = Off`, LiteSpeed returns
HTTP 500 with an empty or non-JSON body, and the client shows "Could not analyze this file. Try again or paste
the text manually." That is **misleading**, because the same five images will fail every time. With
`display_errors = On`, the fatal message text, including the server file path, goes to the browser, but the
user still sees the same generic line.

### 6.4 A web-server or ModSecurity body limit exceeded

The 413 (or 403 from ModSecurity) HTML page arrives, `res.json()` throws, and the user sees "Could not analyze
this file". PHP never runs, so nothing goes to the PHP `error_log`. Only the host's access or ModSecurity log
would record it.

### 6.5 `max_file_uploads` below 5

PHP silently drops the extra files and warns `Maximum number of allowable file uploads has been exceeded`. The
analysis then proceeds on fewer images and the user is not told. This is unlikely, because the default is 20.

---

## 7. Owner actions: what to retrieve and from where (read only)

Sign in to cPanel at `https://dnchardware.com:2083/` and read without saving anything:

1. **cPanel » Software » MultiPHP Manager**: confirm that the PHP version for `quo.dnchardware.com` is
   `ea-php84` (or another one) and note which handler is shown.
2. **cPanel » Software » MultiPHP INI Editor » Basic Mode**. In "Configure PHP INI basic settings", select
   **quo.dnchardware.com** (and separately the home directory) and write down these fields:
   `display_errors`, `max_execution_time`, `max_input_time`, `memory_limit`, `post_max_size`,
   `upload_max_filesize`. Also note `file_uploads` (it must be Enabled). **Do not press Apply.**
3. **MultiPHP INI Editor » Editor Mode**, same domain: copy the whole text. It lists only the directives
   overridden for that directory. `max_file_uploads` does not appear in Basic Mode. If it is absent here, the
   host default applies (PHP default 20).
4. If the host uses CloudLinux, **cPanel » Software » Select PHP Version » Options**: this page shows the
   effective `memory_limit`, `post_max_size`, `upload_max_filesize`, `max_execution_time`, `max_input_time`,
   `max_file_uploads` and `display_errors` for the selector PHP. Use it only if the domain runs the
   alt-php/selector version and not `ea-php84`.
5. **cPanel » Files » File Manager** › `/home5/dnchardw/quo.dnchardware.com/` (Settings » Show Hidden Files):
   check whether `php.ini`, `.user.ini` and `.htaccess` exist and note any `upload_max_filesize`,
   `post_max_size`, `memory_limit`, `php_value` or `LimitRequestBody` lines. Use View only.
6. **File Manager** › `/home5/dnchardw/logs/php.error.log`: search for `POST Content-Length`,
   `Allowed memory size`, `Maximum number of allowable file uploads` and `[ai_extract]`. Any hit is production
   evidence of a limit already being reached.
7. **cPanel » Metrics » Resource Usage** (CloudLinux LVE): note the account's physical memory (PMEM) and entry
   process limits.
8. **Ask the host (support ticket)** for the values this account cannot see: the LiteSpeed server-level
   **Max Request Body Size**, any Apache `LimitRequestBody` that LiteSpeed honours, the ModSecurity
   `SecRequestBodyLimit` / `SecRequestBodyNoFilesLimit` that applies to `quo.dnchardware.com`, and the
   LiteSpeed lsphp timeouts (connection timeout, initial request timeout). **cPanel » Security » ModSecurity**
   only shows whether it is on.

If the owner later prefers one exact reading of every effective value, a temporary login-gated script that
prints `ini_get()` for the directives above and is deleted immediately afterwards would do it. That needs
explicit owner approval and was **not** created in this round.

---

## 8. Config proposal (proposal only, NOT applied)

Apply via **MultiPHP INI Editor » Basic Mode » quo.dnchardware.com** (the cPanel-managed `php.ini` that
`.cpanel.yml` protects). Do not hand-edit it, and do not add a `.user.ini` that the deploy does not know about.

| Directive | Proposed | Why |
|---|---|---|
| `upload_max_filesize` | `20M` | images are capped at 10 MiB in code; the single-PDF path allows 20 MiB (`AI_MAX_PDF_BYTES`) |
| `post_max_size` | `64M` | 5 × 10 MiB + framing ≈ 50.002 MiB; `64M` leaves about 14 MiB margin and keeps "memory_limit > post_max_size" as the manual advises |
| `memory_limit` | `256M` | measured peak 198 MiB real; 256M leaves about 58 MiB headroom. **Do not set below 200M** |
| `max_file_uploads` | `20` (default) | ≥ 5 needed |
| `max_input_time` | `120` (or leave default) | not a constraint behind LiteSpeed; harmless margin |
| `max_execution_time` | leave as is (30 is fine) | the endpoint sets 180 at runtime; CPU time only on Linux |
| `display_errors` | `Off` | required for both §6.1 and Session C's no-leak contract |
| `log_errors` | `On` (unchanged) | |

Host side (request to the host): the request-body limit (LiteSpeed / Apache / ModSecurity) should be at least
`64M` for this domain, and the lsphp timeout at least 300 s.

---

## 9. Code follow-ups recommended for a later round (recommendations only)

Listed in order of value. None is in this round's scope (`ai_extract.php` is out of scope).

1. **Detect an exceeded `post_max_size` explicitly** in `ai_extract.php`, before the `no_file` check: if
   `$_SERVER['REQUEST_METHOD']==='POST' && empty($_POST) && empty($_FILES) &&
   (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0`, return HTTP 413
   `{"ok":false,"error":"request_too_large","message":"The images together are larger than the server
   accepts. Remove an image or use smaller photos."}` and log `reject request_too_large len=N`. Add the code
   to `DC_ERR` and both languages.
2. **Client: handle a non-JSON or HTTP-status response.** In `wqaAnalyze`, when `res.json()` fails, map
   `res.status` 413 to the size message and 500/502/504 to "the server could not process this upload". Do not
   show "Try again" for a deterministic failure.
3. **Client: aggregate size check** in `wqaAddFiles`: refuse when the total exceeds a server-advertised budget
   (for example 48 MiB), not only when one file exceeds 10 MiB.
4. **Client: downscale before upload** (canvas → JPEG/WEBP, long edge about 2048–3072 px). Photos of 10 MB
   typically become 0.5–1.5 MB. This removes the capacity problem at its source, and request time and cost fall
   with it. The OpenAI high-detail path resizes large images anyway.
5. **Server: lower peak memory** so that 128M suffices:
   (a) in `ai_build_payload`, free each raw `bytes` as soon as its data URL is built (pass by reference, or
   have `ai_validate_upload` return the temp path and encode from the file);
   (b) `json_encode($payload, JSON_UNESCAPED_SLASHES)` (−1.6 % size and fewer reallocations);
   (c) `unset($payload)` after encoding and before `curl_exec`, and keep only the JSON string. Estimated peak
   falls from about 198 MiB to about 140 MiB, and further if the JSON is streamed through `CURLOPT_READFUNCTION`.
6. **Distinguish `no_file` from "body discarded"** in the client messages: "Upload exactly one file." is wrong
   for a multi-image request even after item 1.

---

## 10. Session C cross-reference

- `display_errors` in production: **not determinable** in this audit. The owner reads it at §7 step 2.
  §6.1 and §6.3 show two concrete leaks if it is `On`: the configured `post_max_size` and the server file path
  in a memory fatal.
- PHP version observed in production: **8.4.26** (public `X-Powered-By` header), not 8.4.24.
- The `X-Powered-By` header itself discloses the exact PHP patch version. `expose_php = Off` (host or
  MultiPHP) would remove it. This is noted only and is not in scope.

---

## Sources

- Repository `main` @ `076e2ae`: `ai_extract.php` (`:46–51`, `:101–157`, `:791–827`, `:829–880`, `:908–929`,
  `:1141–1250`), `index.php` (`:5136`, `:6026–6041`, `:15529`, `:15632–15660`, `:15753–15786`), `.cpanel.yml`,
  `php.ini`.
- PHP manual, core php.ini directives (`post_max_size` behaviour and defaults):
  https://www.php.net/manual/en/ini.core.php
- OpenAI image input requirements: https://developers.openai.com/docs/guides/images-vision
- Public response headers from `https://quo.dnchardware.com/login.php`, 2026-10-20.
- Local measurement: PHP 8.3.30 CLI, synthetic 10,485,760-byte PNG-header files, the real `ai_extract.php`
  functions under `AI_EXTRACT_TEST`.
