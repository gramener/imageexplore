#!/usr/bin/sh

# Download images
python scrape.py
# Resize images and reduce size
mogrify -strip -sampling-factor 4:2:0 -resize 256x256\> -quality 50 *.jpg
