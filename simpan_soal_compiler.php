<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$conn = new mysqli('localhost', 'root', '', 'mariogame');
if ($conn->connect_error) {
    echo json_encode(['success' => false, 'msg' => 'DB error']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    echo json_encode(['success' => false, 'msg' => 'Invalid JSON']);
    exit;
}

$id           = isset($body['id']) ? intval($body['id']) : null;
$topik        = $conn->real_escape_string($body['topik'] ?? '');
$subtopik     = $conn->real_escape_string($body['subtopik'] ?? '');
$judul        = $conn->real_escape_string($body['judul'] ?? '');
$instruksi    = $conn->real_escape_string($body['instruksi'] ?? '');
$kode_jawaban = $conn->real_escape_string($body['kode_jawaban'] ?? '');
$pembahasan   = $conn->real_escape_string($body['pembahasan'] ?? '');
$waktu        = intval($body['waktu'] ?? 600);
$is_active    = intval($body['is_active'] ?? 0);

if ($is_active == 1) {
    $conn->query("UPDATE soal_compiler SET is_active = 0 WHERE topik = '$topik'");
}

if ($id) {
    $conn->query("UPDATE soal_compiler SET
        topik='$topik', subtopik='$subtopik', judul='$judul',
        instruksi='$instruksi', kode_jawaban='$kode_jawaban',
        pembahasan='$pembahasan', waktu=$waktu, is_active=$is_active
        WHERE id=$id");
} else {
    $conn->query("INSERT INTO soal_compiler (topik, subtopik, judul, instruksi, kode_jawaban, pembahasan, waktu, is_active)
        VALUES ('$topik','$subtopik','$judul','$instruksi','$kode_jawaban','$pembahasan',$waktu,$is_active)");
    $id = $conn->insert_id;
}

echo json_encode(['success' => true, 'id' => $id]);
$conn->close();