#!/usr/bin/env python3
"""Build the Aroha Pages site and check generated, repository-relative links."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
ROUTES = {
    "index.html": "roadmap-title",
    "releases/index.html": "release-title",
    "sdlc/index.html": "sdlc-title",
    "handbook/index.html": "product-title",
    "handbook/technical/index.html": "technical-title",
    "handbook/settings/index.html": "settings-title",
    "handbook/pipeline/index.html": "pipeline-title",
}


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.ids = set()
        self.links = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        element_id = attrs.get("id")
        if element_id:
            if element_id in self.ids:
                raise ValueError(f"duplicate anchor {element_id}")
            self.ids.add(element_id)
        self.links.extend(attrs[key] for key in ("href", "src", "poster") if attrs.get(key))


def verify(output):
    output = output.resolve()
    pages = {file: Page(file.read_text(encoding="utf-8")) for file in output.rglob("*.html")}
    for route, title in ROUTES.items():
        page = pages.get(output / route)
        if page is None or title not in page.ids:
            raise ValueError(f"{route}: expected the {title} section")
    for file, page in sorted(pages.items()):
        for link in page.links:
            url = urlsplit(link)
            if url.scheme or url.netloc:
                continue
            path = unquote(url.path)
            target = (file.parent / path).resolve() if path else file
            if path.startswith("/") or not target.is_relative_to(output):
                raise ValueError(f"{file.relative_to(output)}: use a relative Pages link for {link}")
            if target.is_dir():
                target /= "index.html"
            if not target.is_file():
                raise ValueError(f"{file.relative_to(output)}: missing target {link}")
            if url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                raise ValueError(f"{file.relative_to(output)}: missing anchor {link}")
    print(f"Public Pages build and local links passed ({len(pages)} pages).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Check an existing Pages artifact.")
    args = parser.parse_args()
    try:
        if args.output:
            verify(args.output)
        else:
            with tempfile.TemporaryDirectory(prefix="aroha-handbook-") as folder:
                subprocess.run(
                    ["node", "scripts/build-public-updates.mjs", "docs/public/updates.json", folder],
                    cwd=ROOT,
                    check=True,
                )
                verify(Path(folder))
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Public Pages checks failed: {error}")
