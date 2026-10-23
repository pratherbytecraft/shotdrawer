const test = require('node:test');
const assert = require('node:assert');
const { isScreenshot } = require('../../src/main/detector');

// What macOS names them today: a narrow no-break space before PM.
const TODAY = 'Screenshot 2026-10-26 at 4.12.04 PM.png';

test('takes the names macOS gives screenshots', () => {
  assert.ok(isScreenshot(TODAY, 'Screenshot'));
  assert.ok(isScreenshot('Screen Shot 2019-03-02 at 10.01.22 AM.png', 'Screenshot'));
  assert.ok(isScreenshot('Screenshot 2026-10-26 at 4.12.04 PM (2).png', 'Screenshot'));
});

test('takes every picture type the screenshot tool can save, in any case', () => {
  for (const ext of ['png', 'jpg', 'jpeg', 'heic', 'pdf', 'tiff', 'PNG', 'Jpg']) {
    assert.ok(isScreenshot(`Screenshot 1.${ext}`, 'Screenshot'), ext);
  }
});

test('takes a custom prefix and still the default ones', () => {
  assert.ok(isScreenshot('Capture 2026-10-26 at 9.38.04 PM.png', 'Capture'));
  assert.ok(isScreenshot(TODAY, 'Capture'));
});

test('leaves other files out', () => {
  assert.ok(!isScreenshot('Screen Recording 2026-10-26 at 9.38.04 PM.mov', 'Screenshot'));
  assert.ok(!isScreenshot('Screenshot notes.txt', 'Screenshot'));
  assert.ok(!isScreenshot('holiday.png', 'Screenshot'));
  assert.ok(!isScreenshot('my Screenshot.png', 'Screenshot'));
  assert.ok(!isScreenshot('Screenshot.png.icloud', 'Screenshot'));
});

test('leaves out the hidden file macOS writes first', () => {
  assert.ok(!isScreenshot('.Screenshot 2026-10-26 at 4.12.04 PM.png', 'Screenshot'));
});
