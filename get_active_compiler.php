<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$conn = new mysqli('localhost', 'root', '', 'mariogame');
if ($conn->connect_error) {
    echo json_encode(null);
    exit;
}

$topik = isset($_GET['topik']) ? $conn->real_escape_string($_GET['topik']) : '';

if ($topik === '') {
    echo json_encode(null);
    $conn->close();
    exit;
}

$res = $conn->query("SELECT * FROM soal_compiler WHERE topik='$topik' AND is_active=1 LIMIT 1");
$soal = $res->fetch_assoc();
echo json_encode($soal ?: null);
$conn->close();