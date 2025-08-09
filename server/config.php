<?php
return [
    // Origins allowed to access the API. Provide a comma-separated list in the
    // MARKER_ALLOWED_ORIGINS environment variable or edit this array.
    'allowed_origins' => array_filter(
        array_map('trim', explode(',', getenv('MARKER_ALLOWED_ORIGINS') ?: 'https://www.bazzarproject.ru'))
    ),
    // Google Apps Script endpoint. Set MARKER_GAS_ENDPOINT or edit this value.
    'gas_endpoint' => getenv('MARKER_GAS_ENDPOINT') ?: 'https://script.google.com/macros/s/AKfycbwhBNyiokWlf6ifcD7sG0oOhU_xFIQrGBW8ZBDpZa_PmyGdYlQ0HRN0Zqgrn2em6CgSWA/exec',
    // Google Drive folder for uploaded photos. Set PHOTOS_FOLDER_ID or edit this value.
    'photos_folder_id' => getenv('PHOTOS_FOLDER_ID') ?: '1CDe78tk-Urh35r0GxMHPVDPt9I-dvvrU',
];

