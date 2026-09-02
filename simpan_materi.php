<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'koneksi.php';

$data      = json_decode(file_get_contents('php://input'), true);
$id        = isset($data['id']) ? intval($data['id']) : 0;
$topik     = mysqli_real_escape_string($conn, $data['topik']);
$slot      = intval($data['slot'] ?? 1);
$judul     = mysqli_real_escape_string($conn, $data['judul']);
$isi       = mysqli_real_escape_string($conn, $data['isi']);
$video_url = mysqli_real_escape_string($conn, $data['video_url'] ?? '');
$gambar = mysqli_real_escape_string($conn, $data['gambar'] ?? '');

if ($id > 0) {
    $sql = "UPDATE materi SET topik='$topik', slot=$slot, judul='$judul', isi='$isi', video_url='$video_url', gambar='$gambar' WHERE id=$id";
} else {
    $cek = mysqli_query($conn, "SELECT id FROM materi WHERE topik='$topik' AND slot=$slot");
    if (mysqli_num_rows($cek) > 0) {
        $existing = mysqli_fetch_assoc($cek);
        $sql = "UPDATE materi SET judul='$judul', isi='$isi', video_url='$video_url', gambar='$gambar' WHERE id=" . $existing['id'];
        $sql = "INSERT INTO materi (topik, slot, judul, isi, video_url, gambar) 
        VALUES ('$topik', $slot, '$judul', '$isi', '$video_url', '$gambar')
        ON DUPLICATE KEY UPDATE judul='$judul', isi='$isi', video_url='$video_url', gambar='$gambar'";
    }
}

if (mysqli_query($conn, $sql)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
}
mysqli_close($conn);
?>