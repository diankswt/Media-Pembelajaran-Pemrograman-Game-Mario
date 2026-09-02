<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
require_once 'koneksi.php';

$data     = json_decode(file_get_contents('php://input'), true);
$siswa_id = intval($data['siswa_id'] ?? 0);
$topik    = mysqli_real_escape_string($conn, $data['topik']    ?? '');
$jenis    = mysqli_real_escape_string($conn, $data['jenis']    ?? '');
$slot     = isset($data['slot']) ? intval($data['slot']) : null;
$subtopik = isset($data['subtopik']) ? mysqli_real_escape_string($conn, $data['subtopik']) : null;
$status   = mysqli_real_escape_string($conn, $data['status']   ?? 'selesai');

if (!$siswa_id || !$topik || !$jenis) {
    echo json_encode(['success' => false, 'message' => 'Data tidak lengkap']);
    exit;
}

$slotVal     = $slot     ? $slot        : 'NULL';
$subtopikVal = $subtopik ? "'$subtopik'" : 'NULL';

$sql = "INSERT INTO progress_siswa (siswa_id, topik, jenis, slot, subtopik, status, selesai_at)
        VALUES ($siswa_id, '$topik', '$jenis', $slotVal, $subtopikVal, '$status', NOW())
        ON DUPLICATE KEY UPDATE status=VALUES(status), slot=VALUES(slot), selesai_at=NOW()";

if (mysqli_query($conn, $sql))
    echo json_encode(['success' => true]);
else
    echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);

mysqli_close($conn);
?>