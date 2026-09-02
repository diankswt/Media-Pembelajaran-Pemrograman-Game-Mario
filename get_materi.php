<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'koneksi.php';

// Kalau ada parameter id, ambil satu materi
if (isset($_GET['id'])) {
    $id = intval($_GET['id']);
    $result = mysqli_query($conn, "SELECT * FROM materi WHERE id=$id");
    $row = mysqli_fetch_assoc($result);
    echo json_encode($row);
    mysqli_close($conn);
    exit;
}

// Kalau ada parameter slot, ambil materi berdasarkan topik + slot
if (isset($_GET['slot'])) {
    $topik = mysqli_real_escape_string($conn, $_GET['topik'] ?? 'percabangan');
    $slot  = intval($_GET['slot']);
    $result = mysqli_query($conn, "SELECT * FROM materi WHERE topik='$topik' AND slot=$slot");
    $row = mysqli_fetch_assoc($result);
    echo json_encode($row ? $row : null);
    mysqli_close($conn);
    exit;
}

// Default: ambil semua materi berdasarkan topik
$topik = mysqli_real_escape_string($conn, $_GET['topik'] ?? 'percabangan');
$result = mysqli_query($conn, "SELECT * FROM materi WHERE topik='$topik' ORDER BY slot");
$data = [];
while ($row = mysqli_fetch_assoc($result)) {
    $data[] = $row;
}
echo json_encode($data);
mysqli_close($conn);
?>