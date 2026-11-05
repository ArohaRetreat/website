# Frozen PDF-v4 in operational booking delivery

Issue98 corrects the release boundary that left the approved PDF-v4 specimen outside real delivery. New invoices snapshot documentTemplateVersion=pdf-v4. Runtime embeds the approved Natura white logo, unmodified Hrudhi art, licensed Lora/Source Sans fonts, contour/sun header, financial panel and Keep the smile memory panel. Real invoice identity, dates, issuer address and unpaid status replace specimen text; no fictional guest, sample amount or payment claim ships.

Legacy invoice snapshots, PDF objects and retry payloads retain their legacy renderer. Private PDF-v4 objects use a separate versioned object name and matching snapshot/design metadata. Downloads use the current document design; sending uses the job's snapshotted document version, so an old retry cannot silently change its attachment.

The privileged operator's --correct-documents operation requires current clean deployed main source, a rechecked active host manager, actual operator provenance, expected booking version, an existing accepted/delivered confirmation and the unchanged invoice. It queues one deterministic correction job, records an audit and updates only booking correction metadata/version. Invoice number, financial snapshot hash, charges, balance and counter remain unchanged. Original PDF objects are retained. The correction email explicitly says the presentation changed, with no new booking or additional charge. New rendering alone never sends mail.

Existing email-v3 bodies remain immutable. The new email-v3[-private]-correction variant retains that graphical design and adds explicit correction wording. The full six-stage lifecycle remains issue70; this slice does not fabricate check-in, checkout, feedback or payments.

Release evidence must include render comparison to the frozen specimen, original/new PDF hashes, financial-identity checks, legacy-payload preservation, denied anonymous downloads, integration tests and actual provider delivery. Do not equate provider acceptance with visual approval.
