# Rob Rob trip page: how it's laid out

These published files are the only source of truth (there is no laptop rebuild any more), so edit them directly, e.g. in the GitHub app or the web editor on your phone.

## Files
- `index.html`: the whole page (CSS, the data and the script).
- `img/<id>.jpg`: thumbnail (~1000px) shown in the feed.
- `img/full/<id>.jpg`: full-size image for the lightbox.
- `img/<id>.mp4`: the video, for items that are videos (the `.jpg` is its poster).

## The data: one line in index.html
Search for `const D =`. It is a single line of JSON:

```
{ "title", "subtitle", "end", "switch": true,
  "days": [ { "key": "m20261128", "label": "UPLOAD_017", "sub": "3 photos",
              "date": "Sat 28 Nov", "place": "Vietnam",
              "items": [ {item}, ... ] }, ... ],
  "notes": [ { "id", "after": "<item id or day key>", "text" } ] }
```

Days are newest first. `label` is the heading and nav pill (UPLOAD_001 = the first day). `place` shows as "📍 place" before the `sub` count; leave it `""` to hide it. `date` is kept for reference and isn't shown. Places are by country (route: Thailand > Vietnam > Cambodia > Vietnam).

When the page opens, a pop-up asks "How would you like your Rob today?" with the leaf/disco-ball switch (Introverted = `nature`, Extroverted = `party`) and an "All of Rob, please" button (everything). Links with `?mode=nature|party|all` skip it.

Each item has:

| field | meaning |
|---|---|
| `id` | file name stem, e.g. `p-1346` (`p-` = phone, `dN-` = camera) |
| `thumb` / `full` | `img/<id>.jpg` / `img/full/<id>.jpg` |
| `video` | `img/<id>.mp4` (only on videos) |
| `w`, `h`, `tw`, `fw` | original size, thumb width, full width |
| `phone` | `true` for phone shots (lighter card style) |
| `mode` | `"nature"` = Introvert, `"party"` = Outrovert (the buttons under the title). `"both"` shows in Introvert and Outrovert. "The whole Rob" shows everything |
| `group` | optional sub-heading within a day (`""` for none) |
| `note` / `details` | caption and small grey line. Leave them `""` to hide them |

## Common edits
- **Remove a photo:** delete its `{...}` item from `items` (watch the commas). Delete its files in `img/`, `img/full/` and any `.mp4`. Then fix that day's `sub` count (e.g. `"3 photos · 1 video"`).
- **Caption a photo:** set its `note`.
- **Quote notes between photos:** open the page with `?notes`, write them, then copy the generated text. Or add them to `notes` by hand (`after` = an item id or a day key).

Keep the JSON valid (double quotes, no trailing commas) or the page goes blank.
