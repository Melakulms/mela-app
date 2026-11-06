# MELA requirement 19 — content rights audit (read-only, 2026-11-05)

**Status: BLOCKED for legal/content approval; not verified complete.**
Source URLs and source names do not establish licence, ownership, permission to reproduce, or attribution rights.

## Database inventory (independently queried)
| Table / measure | Staging | Production |
| --- | ---: | ---: |
| \`mela_learning_chapters\` rows | 904 | 888 |
| Chapter rows lacking source URL | 11 | 0 |
| Staging chapter rows marked user-supplied | 11 | 0 |
| \`mela_learning_programs\` rows | 131 | 149 |
| Program rows lacking source URL | 130 | 0 |
| \`study_materials\` rows | 0 | 0 |
| \`mela_learning_chapter_materials\` | 904 | Not checked in this pass |
| \`mela_learning_materials\` | 2 | Not checked in this pass |

Source names in learning chapters include the Kehulum textbook table-of-contents index, Ethiopian Ministry of Education listings, regional textbooks, and user-supplied outlines. They cannot be treated as content redistribution licences. The catalogued learning tables have source and verification fields but no dedicated affirmative licence evidence field; nested/full media rights and external permissions remain unverified.

## Release requirements
1. Inventory each distinct source or asset, including its publisher/creator, licence type, permitted uses, document URL, version, territory, and evidence date.
2. Separate referencing a textbook title/unit outline from uploading or reproducing the protected book or illustrations.
3. Mark each asset \`permission verified\`, \`original content with documented authorship\`, \`public domain confirmed\`, \`awaiting review\`, or \`remove/replace\`.
4. For unknown/unlicensed full texts, media or uploaded files, do not publish or redistribute them pending review.
5. Review user-supplied content and third-party index rights independently.
6. Confirm licences for images, fonts, video, icons, user-uploaded material and AI-derived content separately.
7. Ensure downstream user-facing attribution and removal workflow.
8. Preserve actual content unless the owner authorizes a targeted takedown and lawful retention handling.

Do not infer that a government textbook is automatically public domain, nor that a source URL grants reproduction rights.
