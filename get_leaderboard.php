<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once 'koneksi.php';

$topik = isset($_GET['topik']) ? mysqli_real_escape_string($conn, $_GET['topik']) : 'percabangan';

$sql = "SELECT s.nama,
    COALESCE(n.skor_materi, 0) AS materi_selesai,
    COALESCE(n.skor_soal, 0) AS soal_benar,
    COUNT(CASE WHEN p.jenis='compiler' AND p.status='benar' THEN 1 END) AS compiler_selesai,
    COALESCE(n.koin, 0) AS koin,
    COALESCE(n.skor, 0) AS poin
FROM siswa s
LEFT JOIN progress_siswa p ON p.siswa_id = s.id AND p.topik = '$topik'
LEFT JOIN nilai n ON n.siswa_id = s.id AND n.topik = '$topik'
GROUP BY s.id, s.nama, n.skor, n.skor_materi, n.skor_soal, n.koin
ORDER BY poin DESC, soal_benar DESC
LIMIT 10";

$result = mysqli_query($conn, $sql);
$data = [];
while ($row = mysqli_fetch_assoc($result)) $data[] = $row;
echo json_encode($data);
mysqli_close($conn);
?>