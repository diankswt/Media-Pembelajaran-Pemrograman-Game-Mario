<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once 'koneksi.php';

$siswa_id = isset($_GET['siswa_id']) ? intval($_GET['siswa_id']) : 0;

if ($siswa_id > 0) {
    $result = mysqli_query($conn,
        "SELECT p.*, s.nama FROM progress_siswa p
         JOIN siswa s ON s.id = p.siswa_id
         WHERE p.siswa_id = $siswa_id
         ORDER BY p.topik, p.jenis, p.slot, p.subtopik");
    $data = [];
    while ($row = mysqli_fetch_assoc($result)) $data[] = $row;
    echo json_encode($data);
} else {
    $result = mysqli_query($conn,
        "SELECT s.id AS siswa_id, s.nama, s.username,
            SUM(CASE WHEN p.jenis='materi'   THEN 1 ELSE 0 END) AS total_materi,
            SUM(CASE WHEN p.jenis='soal'     THEN 1 ELSE 0 END) AS total_soal,
            SUM(CASE WHEN p.jenis='soal' AND p.status='benar' THEN 1 ELSE 0 END) AS soal_benar,
            SUM(CASE WHEN p.jenis='compiler' THEN 1 ELSE 0 END) AS total_compiler,
            SUM(CASE WHEN p.jenis='compiler' AND p.status='benar' THEN 1 ELSE 0 END) AS compiler_benar,
            MAX(p.selesai_at) AS terakhir_aktif
         FROM siswa s
         LEFT JOIN progress_siswa p ON p.siswa_id = s.id
         GROUP BY s.id ORDER BY s.nama");
    $data = [];
    while ($row = mysqli_fetch_assoc($result)) $data[] = $row;
    echo json_encode($data);
}
mysqli_close($conn);
?>