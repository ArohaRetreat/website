"""Read the Hosting receipt from a bounded Actions archive without extracting files."""

import io
import re
import stat
import sys
from zipfile import ZipFile

raw = sys.stdin.buffer.read(200_001)
if len(raw) > 200_000:
    raise ValueError("ARCHIVE_LIMIT")

with ZipFile(io.BytesIO(raw)) as archive:
    entries = archive.infolist()
    if len(entries) != 1:
        raise ValueError("RECEIPT_COUNT")
    entry = entries[0]
    if not re.fullmatch(r"frontend-[a-f0-9-]+\.json", entry.filename):
        raise ValueError("RECEIPT_PATH")
    if entry.file_size > 300_000 or stat.S_ISLNK(entry.external_attr >> 16):
        raise ValueError("RECEIPT_ENTRY")
    sys.stdout.buffer.write(archive.read(entry))
