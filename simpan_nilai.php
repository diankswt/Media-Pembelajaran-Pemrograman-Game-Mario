<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'koneksi.php';

$data = json_decode(file_get_contents('php://input'), true);

$siswa_id   = intval($data['siswa_id']);
$topik      = mysqli_real_escape_string($conn, $data['topik']);
$skor          = intval($data['skor']          ?? 0);
$total_soal    = intval($data['total_soal']    ?? 0);
$benar         = intval($data['benar']         ?? 0);
$skor_materi   = intval($data['skor_materi']   ?? 0);
$skor_soal     = intval($data['skor_soal']     ?? 0);
$skor_compiler = intval($data['skor_compiler'] ?? 0);
$koin          = intval($data['koin']          ?? 0);

if (!$siswa_id || !$topik) {
    echo json_encode(['success' => false, 'message' => 'Data tidak lengkap!']);
    exit;
}

$sql = "INSERT INTO nilai (siswa_id, topik, skor, total_soal, benar, skor_materi, skor_soal, skor_compiler, koin, played_at)
        VALUES ($siswa_id, '$topik', $skor, $total_soal, $benar, $skor_materi, $skor_soal, $skor_compiler, $koin, NOW())
        ON DUPLICATE KEY UPDATE
            skor          = VALUES(skor),
            total_soal    = VALUES(total_soal),
            benar         = VALUES(benar),
            skor_materi   = VALUES(skor_materi),
            skor_soal     = VALUES(skor_soal),
            skor_compiler = VALUES(skor_compiler),
            koin          = VALUES(koin),
            played_at     = NOW()";

if (mysqli_query($conn, $sql)) {
    echo json_encode(['success' => true, 'message' => 'Nilai berhasil disimpan!']);
} else {
    echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
}

mysqli_close($conn);
?>