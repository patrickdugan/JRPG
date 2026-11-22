#!/usr/bin/env python3
"""Live Chromium acceptance for the Voice Lab audition ledger and its recovery path."""

from __future__ import annotations

import argparse
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

GAME_DIR = Path(__file__).resolve().parents[1]
STORAGE_KEY = 'bells-black-chrysanthemum.voice-review.v1'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return

    def do_GET(self) -> None:
        if self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def smoke(chromium: str | None, minimum_lines: int, screenshot_path: Path) -> dict[str, object]:
    handler = functools.partial(QuietHandler, directory=str(GAME_DIR))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.server_address[1]}'
    console_errors: list[str] = []
    page_errors: list[str] = []
    delivery_errors: list[str] = []
    try:
        with sync_playwright() as playwright:
            opts: dict[str, object] = {'headless': True, 'args': ['--no-sandbox']}
            if chromium:
                opts['executable_path'] = chromium
            try:
                browser = playwright.chromium.launch(**opts)
            except Exception as err:
                if chromium or "Executable doesn't exist" not in str(err):
                    raise
                for candidate in (
                    Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
                    Path(r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'),
                    Path.home() / r'AppData\Local\Google\Chrome\Application\chrome.exe',
                    Path(r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'),
                ):
                    if candidate.is_file():
                        opts['executable_path'] = str(candidate)
                        browser = playwright.chromium.launch(**opts)
                        break
                else:
                    raise
            context = browser.new_context(viewport={'width': 1365, 'height': 960}, accept_downloads=True)
            page = context.new_page()
            page.set_default_timeout(20_000)
            page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            page.on('response', lambda response: delivery_errors.append(f'{response.status}: {response.url}') if response.status >= 400 else None)
            page.on('dialog', lambda dialog: dialog.accept())
            try:
                response = page.goto(f'{base}/voice-lab.html', wait_until='domcontentloaded')
                check(response is not None and response.status == 200, 'Voice Lab did not load.')
                page.locator('[data-review-state="en:01"]').wait_for()
                line_count = page.locator('#scene article.line').count()
                check(line_count >= minimum_lines, f'Only {line_count} voiced lines shown.')
                check(page.locator('#reviewSummary').inner_text().find('pending') >= 0, 'Review coverage absent.')

                en_state = page.locator('[data-review-state="en:01"]')
                en_note = page.locator('[data-review-notes="en:01"]')
                en_state.select_option('accepted')
                en_note.fill('Opening vowel clean; release this English take.')
                en_note.blur()
                saved = json.loads(page.evaluate('(key) => localStorage.getItem(key)', STORAGE_KEY))
                check(saved['entries']['en:01']['status'] == 'accepted', 'Verdict was not saved.')
                check(saved['entries']['en:01']['note'].startswith('Opening vowel'), 'Retake note was not saved.')
                check(not any('campaign' in key for key in page.evaluate('Object.keys(localStorage)')), 'Audition wrote to campaign storage.')

                page.reload(wait_until='domcontentloaded')
                page.locator('[data-review-state="en:01"]').wait_for()
                check(page.locator('[data-review-state="en:01"]').input_value() == 'accepted', 'Reload lost English verdict.')
                check('Opening vowel clean' in page.locator('[data-review-notes="en:01"]').input_value(), 'Reload lost note.')
                page.locator('label:has(input[name="lang"][value="ja"])').click()
                ja = page.locator('[data-review-state="ja:01"]')
                ja.wait_for()
                check(ja.input_value() == 'pending', 'English verdict leaked into Japanese.')
                ja.select_option('pronunciation')
                page.locator('[data-review-notes="ja:01"]').fill('Check pitch accent with a native director.')
                page.locator('[data-review-notes="ja:01"]').blur()
                page.locator('label:has(input[name="lang"][value="en"])').click()
                check(page.locator('[data-review-state="en:01"]').input_value() == 'accepted', 'Japanese edit changed English verdict.')

                with page.expect_download() as download_info:
                    page.locator('#exportReviews').click()
                download = download_info.value
                payload = Path(download.path()).read_bytes()
                exported = json.loads(payload)
                check(len(exported['entries']) == 2, 'Export omitted one language.')

                # A script edit invalidates stale takes; the original reviews stay exportable.
                stale = json.loads(payload)
                stale['entries']['en:01']['identity'] = 'outdated audio take'
                page.evaluate('(data) => localStorage.setItem(data.key, data.value)', {'key': STORAGE_KEY, 'value': json.dumps(stale)})
                page.reload(wait_until='domcontentloaded')
                page.locator('[data-review-state="en:01"]').wait_for()
                check(page.locator('[data-review-state="en:01"]').is_disabled(), 'Stale review was writable.')
                check('do not match' in page.locator('#reviewStatus').inner_text(), 'No stale-take warning.')

                page.locator('#importReviews').set_input_files({
                    'name': 'recovered-auditions.json', 'mimeType': 'application/json', 'buffer': payload,
                })
                page.wait_for_function("() => document.querySelector('#reviewStatus').textContent.includes('Imported 2')")
                check(page.locator('[data-review-state="en:01"]').input_value() == 'accepted', 'Import did not restore take.')
                page.screenshot(path=str(screenshot_path), full_page=True)
                check(not console_errors, f'Browser console errors: {console_errors}')
                check(not page_errors, f'JavaScript exceptions: {page_errors}')
                check(not delivery_errors, f'Failed browser resources: {delivery_errors}')
                return {
                    'result': 'pass', 'displayedLines': line_count, 'exportedReviews': len(exported['entries']),
                    'recovered': True, 'staleReviewRejected': True,
                    'consoleErrors': console_errors, 'pageErrors': page_errors, 'httpErrors': delivery_errors,
                    'screenshot': str(screenshot_path),
                }
            finally:
                context.close()
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', default=None, help='Optional installed Chromium executable')
    parser.add_argument('--minimum-lines', type=int, default=27)
    parser.add_argument('--screenshot', type=Path, default=Path('artifacts/voice-review-browser.png'))
    args = parser.parse_args()
    args.screenshot.parent.mkdir(parents=True, exist_ok=True)
    print(json.dumps(smoke(args.chromium, args.minimum_lines, args.screenshot), ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
