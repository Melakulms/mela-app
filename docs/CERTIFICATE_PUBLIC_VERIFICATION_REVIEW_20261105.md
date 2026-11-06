# Public course certificate verifier — privacy/security review, 2026-11-05

**Production status: existing endpoint retained without modification; approval pending.**

- Production RPC \`public.verify_course_certificate(text)\` is \`SECURITY DEFINER\`, \`STABLE\`, with \`search_path=''\`, explicitly callable by \`anon\`.
- It accepts a certificate code and returns: code, credential type, course title, learner's **full name**, issued date, and valid/revoked boolean.
- Only an exact normalized certificate-code match returns a row; function does not enumerate all credentials.
- The current issuance function \`private.refresh_course_enrollment_from_lessons\` uses \`'MELA-C-' || upper(replace(gen_random_uuid()::text,'-',''))\` for course certificate codes, which are nonsequential random UUID-based bearer codes.
- Production \`public.course_certificates\` held **0 records** when checked on 2026-11-05.
- The learner app intentionally displays public verifier results in \`src/pages/CertificateVerification.tsx\` and supplies shareable links via Career Passport. Revoking anonymous EXECUTE would break this intended workflow.
- A code is effectively a bearer secret; possession authorizes viewing a learner name and educational achievement. Avoid indexing and logging it unnecessarily. Evaluate child/guardian requirements, public disclosure consent, rate limiting, leakage through referers and previews, and support for revocation before adding public credentials.
- Direct access to \`public.profiles\` remains RLS-restricted, but the public definer RPC deliberately bypasses that restriction for the narrow verifier.

**Decision:** The advisor's warning is not by itself proof of an exploit, and the existing signature is intentionally public. Do **not** blindly revoke EXECUTE or declare it privacy compliant. Obtain safeguarding/privacy approval for full-name disclosure, consider a privacy-preserving name presentation and explicit share consent, and test code-guessing/rate-limit controls before release.
