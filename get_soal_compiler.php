<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$conn = new mysqli('localhost', 'root', '', 'mariogame');
if ($conn->connect_error) {
    echo json_encode([]);
    exit;
}

// Ambil satu soal by ID
if (isset($_GET['id'])) {
    $id = intval($_GET['id']);
    $res = $conn->query("SELECT * FROM soal_compiler WHERE id = $id LIMIT 1");
    $row = $res->fetch_assoc();
    echo json_encode($row ?: null);
    exit;
}

// Ambil semua soal by topik
$topik = isset($_GET['topik']) ? $conn->real_escape_string($_GET['topik']) : 'percabangan';
$res = $conn->query("SELECT * FROM soal_compiler WHERE topik = '$topik' ORDER BY id ASC");
$data = [];
while ($row = $res->fetch_assoc()) {
    $data[] = $row;
}
echo json_encode($data);
$conn->close();