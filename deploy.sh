#!/bin/bash
# Deploy web assets and server API
set -e
RSYNC_DEST=${RSYNC_DEST:-user@host:/var/www/marker-webapp}
rsync -av --delete \
  index.html app.js styles.css src icons server \
  "$RSYNC_DEST/"

