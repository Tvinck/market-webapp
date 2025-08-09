<?php
// Configuration values for the Marker API server.
// Values are primarily sourced from environment variables so that secrets
// are not committed to the repository.
return [
    // Comma-separated list of origins allowed to access the API.
    'allowed_origins' => array_filter(
        array_map('trim', explode(',', getenv('MARKER_ALLOWED_ORIGINS') ?: ''))
    ),
    // Google Apps Script endpoint used by the proxy.
    'gas_endpoint' => getenv('MARKER_GAS_ENDPOINT') ?: '',
    // Google Drive folder for uploaded photos.
    'photos_folder_id' => getenv('PHOTOS_FOLDER_ID') ?: '',
];

