<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'koneksi.php';

$topik = isset($_GET['topik']) ? mysqli_real_escape_string($conn, $_GET['topik']) : 'percabangan';
$siswa_id_filter = isset($_GET['siswa_id']) ? intval($_GET['siswa_id']) : 0;
$sql = "SELECT n.id, n.siswa_id, s.nama, n.topik, n.skor, n.benar, n.total_soal, n.played_at,
       n.skor_materi, n.skor_soal, n.skor_compiler, n.koin,
            (SELECT COUNT(*) FROM progress_siswa p WHERE p.siswa_id = n.siswa_id AND p.topik = n.topik AND p.jenis = 'materi') AS materi_selesai,
            (SELECT COUNT(*) FROM progress_siswa p WHERE p.siswa_id = n.siswa_id AND p.topik = n.topik AND p.jenis = 'soal' AND p.status = 'benar') AS soal_benar,
            (SELECT COUNT(*) FROM progress_siswa p WHERE p.siswa_id = n.siswa_id AND p.topik = n.topik AND p.jenis = 'compiler' AND p.status = 'benar') AS compiler_benar
        FROM nilai n
        JOIN siswa s ON n.siswa_id = s.id
        WHERE n.id = (
            SELECT id FROM nilai n2
            WHERE n2.siswa_id = n.siswa_id AND n2.topik = n.topik
            ORDER BY n2.played_at DESC LIMIT 1
        )
        AND n.topik = '$topik'
        " . ($siswa_id_filter ? "AND n.siswa_id = $siswa_id_filter" : "") . "
        ORDER BY s.nama, n.topik";

$result = mysqli_query($conn, $sql);
$data = [];
while ($row = mysqli_fetch_assoc($result)) {
    $data[] = $row;
}
echo json_encode($data);
mysqli_close($conn);
?>