<?php
return [
    // Origins allowed to access the API. Provide a comma-separated list in the
    // MARKER_ALLOWED_ORIGINS environment variable or edit this array.
    'allowed_origins' => array_filter(array_map('trim', explode(',', getenv('MARKER_ALLOWED_ORIGINS') ?: ''))),
];

