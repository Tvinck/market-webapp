<?php
$config = @include __DIR__ . '/../config.php';
$allowed = $config['allowed_origins'] ?? [];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && (empty($allowed) || in_array($origin, $allowed, true))) {
  header("Access-Control-Allow-Origin: $origin");
} elseif (!empty($allowed)) {
  http_response_code(403);
  exit;
}
header('Access-Control-Allow-Methods: GET,POST,OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$GAS = 'https://script.google.com/macros/s/AKfycbzBYiUFaJO_J_Uq-oz9pCeozAKwX5ruY_3wpJiWtP4TDHhFToEa6nUEcGBb7oxBWqRtKw/exec';

$q = $_GET ?? [];
$url = $GAS . (empty($q) ? '' : ('?' . http_build_query($q)));

$opts = ['http' => ['method' => $_SERVER['REQUEST_METHOD'], 'ignore_errors' => true]];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $opts['http']['header'] = "Content-Type: application/json\r\n";
  $opts['http']['content'] = file_get_contents('php://input');
}

$context = stream_context_create($opts);
$resp = @file_get_contents($url, false, $context);

header('Content-Type: application/json; charset=UTF-8');
http_response_code(200);
echo $resp ? $resp : '{"ok":false,"error":"proxy_failed"}';
