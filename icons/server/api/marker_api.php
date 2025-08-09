<?php
$config = @include __DIR__ . '/../config.php';
$allowed = $config['allowed_origins'] ?? [];
if (empty($allowed)) {
  http_response_code(500);
  header('Content-Type: application/json; charset=UTF-8');
  echo '{"ok":false,"error":"allowed_origins_not_configured"}';
  exit;
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === '') {
  // Same-origin request.
} elseif (in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
} else {
  http_response_code(403);
  exit;
}
header('Access-Control-Allow-Methods: GET,POST,OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$gasEndpoint = $config['gas_endpoint'] ?? getenv('MARKER_GAS_ENDPOINT') ?: '';
if (!$gasEndpoint) {
  http_response_code(500);
  header('Content-Type: application/json; charset=UTF-8');
  echo '{"ok":false,"error":"gas_endpoint_not_configured"}';
  exit;
}

$q = $_GET ?? [];
$url = $gasEndpoint . (empty($q) ? '' : ('?' . http_build_query($q)));

$opts = ['http' => ['method' => $_SERVER['REQUEST_METHOD'], 'ignore_errors' => true]];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $opts['http']['header'] = "Content-Type: application/json\r\n";
  $opts['http']['content'] = file_get_contents('php://input');
}

$context = stream_context_create($opts);
$resp = @file_get_contents($url, false, $context);

// Extract HTTP status code from the upstream response headers.
$status = 200;
if (isset($http_response_header[0]) &&
    preg_match('/^HTTP\/\S+\s+(\d+)/', $http_response_header[0], $m)) {
  $status = (int)$m[1];
}

header('Content-Type: application/json; charset=UTF-8');
if ($resp === false) {
  $err = error_get_last();
  http_response_code($status >= 400 ? $status : 502);
  if ($err && isset($err['message'])) {
    error_log($err['message']);
  }
  echo json_encode([
    'ok' => false,
    'error' => 'proxy_failed'
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

// Ensure the upstream body is valid JSON; otherwise forward an error structure.
$decoded = json_decode($resp);
if (json_last_error() !== JSON_ERROR_NONE) {
  http_response_code($status);
  if ($status >= 400) {
    error_log($resp);
  }
  echo json_encode([
    'ok' => false,
    'error' => 'invalid_json',
    'body' => $resp
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code($status);
if ($status >= 400) {
  error_log($resp);
}
echo $resp;
