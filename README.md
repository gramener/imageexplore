# Image Explore

## Setup

```shell
git clone https://code.gramener.com/cto/imageexplore.git
```

Then run any HTTP server and open `index.html`.

## Add a new demo

1. Create a new folder in lowercase-with-hyphens, e.g. `newdemo`.
2. Add an entry to [`config.json`](config.json) under `demos` like `{"title": "...", "body": "...", "folder": "newdemo"}`
3. Compress images to `.jpg` or `.png` (e.g. using [tinypng](https://tinypng.com/)) and save them under `newdemo/`
4. OPTIONAL: Write `newdemo/setup.sh` to for any image extraction or processing
5. Add the images <https://gramener.com/imageexplore/>, download the JSON and save as `newdemo/similarity.json`
6. Commit and push the changes

## How this app was built

[![Explainer video](https://img.youtube.com/vi/OD_BLwNR1nU/0.jpg)](https://youtu.be/OD_BLwNR1nU)
