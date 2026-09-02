<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'koneksi.php';

$data       = json_decode(file_get_contents('php://input'), true);
$id         = (isset($data['id']) && $data['id'] !== '') ? (int)$data['id'] : 0;
$topik      = mysqli_real_escape_string($conn, $data['topik']      ?? '');
$slot       = (int)($data['slot']       ?? 1);
$pertanyaan = mysqli_real_escape_string($conn, $data['pertanyaan'] ?? '');
$a          = mysqli_real_escape_string($conn, $data['pilihan_a']  ?? '');
$b          = mysqli_real_escape_string($conn, $data['pilihan_b']  ?? '');
$c          = mysqli_real_escape_string($conn, $data['pilihan_c']  ?? '');
$d          = mysqli_real_escape_string($conn, $data['pilihan_d']  ?? '');
$e          = mysqli_real_escape_string($conn, $data['pilihan_e']  ?? '');
$jawaban    = mysqli_real_escape_string($conn, $data['jawaban']    ?? 'a');
$pembahasan = mysqli_real_escape_string($conn, $data['pembahasan'] ?? '');
$gambar_a   = mysqli_real_escape_string($conn, $data['gambar_a'] ?? '');
$gambar_b   = mysqli_real_escape_string($conn, $data['gambar_b'] ?? '');
$gambar_c   = mysqli_real_escape_string($conn, $data['gambar_c'] ?? '');
$gambar_d   = mysqli_real_escape_string($conn, $data['gambar_d'] ?? '');
$gambar_e   = mysqli_real_escape_string($conn, $data['gambar_e'] ?? '');

if ($id > 0) {
    $sql = "UPDATE soal SET topik='$topik', slot=$slot, pertanyaan='$pertanyaan',
    pilihan_a='$a', pilihan_b='$b', pilihan_c='$c',
    pilihan_d='$d', pilihan_e='$e', jawaban='$jawaban',
        gambar_a='$gambar_a', gambar_b='$gambar_b', gambar_c='$gambar_c',
        gambar_d='$gambar_d', gambar_e='$gambar_e'
        WHERE id=$id";
} else {
    $sql = "INSERT INTO soal (topik, slot, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, jawaban, pembahasan) 
            VALUES ('$topik', $slot, '$pertanyaan', '$a', '$b', '$c', '$d', '$e', '$jawaban', '$pembahasan')";
}

if (mysqli_query($conn, $sql)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
}

mysqli_close($conn);
?>