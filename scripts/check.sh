#!/bin/sh
set -eu
cd "$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
python3 scripts/check_foundation.py
python3 scripts/check_links.py
if [ "${AROHA_TEST_REPORTS:-0}" = "1" ]; then
  python3 scripts/delivery/run-foundation-tests.py
else
  python3 -m unittest discover -s tests -v
fi
